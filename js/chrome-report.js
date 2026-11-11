(function (root) {
  'use strict';
  const MAX_REPORT_BODY = 4 * 1024 * 1024;
  const PHOTO_RETRY_PROFILES = [[900, 0.65], [640, 0.52], [480, 0.42]];

  function photoJpeg(source, maxSide, quality) {
    const scale = Math.min(1, maxSide / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  async function serialize(element, title) {
    await document.fonts.ready;
    const copy = element.cloneNode(true);
    copy.querySelectorAll('.no-print, script, iframe, object, embed').forEach(node => node.remove());
    const originals = Array.from(element.querySelectorAll('img'));
    const images = Array.from(copy.querySelectorAll('img'));
    await Promise.all(images.map(async (image, index) => {
      const source = originals[index];
      // Los mosaicos del mapa son opcionales; una descarga fallida no debe bloquear el reporte.
      if (image.classList.contains('leaflet-tile') && (!source.complete || !source.naturalWidth)) { image.remove(); return; }
      try {
        await source.decode();
        if (image.closest('.report-photos')) {
          const src = source.currentSrc || source.src;
          image.src = /^data:image\/jpeg;base64,/i.test(src) ? src : photoJpeg(source, 1200, 0.75);
          image.removeAttribute('srcset');
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
        canvas.getContext('2d').drawImage(source, 0, 0);
        image.src = canvas.toDataURL('image/png');
        image.removeAttribute('srcset');
        // Leaflet fades new tiles with JS. The static report must keep every decoded tile visible.
        if (image.classList.contains('leaflet-tile')) { image.style.opacity = '1'; image.classList.add('leaflet-tile-loaded'); }
      } catch (_) {
        if (image.classList.contains('leaflet-tile')) { image.remove(); return; }
        throw new Error('No se pudo cargar una imagen del reporte. Revise la conexión y reintente.');
      }
    }));
    const css = Array.from(document.styleSheets).map(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n')).join('\n');
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + escape(title) + '</title><style>' + css.replace(/<\/style/gi, '<\\/style') + '</style></head><body class="font-sans antialiased"><section class="print-report report-open">' + copy.outerHTML + '</section></body></html>';
  }
  async function compressReportPhotos(html, maxSide, quality) {
    const report = new DOMParser().parseFromString(html, 'text/html');
    const photos = Array.from(report.querySelectorAll('.report-photos img'));
    if (!photos.length) return null;
    for (const photo of photos) {
      const source = new Image();
      source.src = photo.src;
      await source.decode();
      const jpeg = photoJpeg(source, maxSide, quality);
      if (jpeg.length < photo.src.length) photo.src = jpeg;
    }
    return '<!doctype html>' + report.documentElement.outerHTML;
  }

  async function encodeReport(html) {
    const compressed = new Uint8Array(await new Response(new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < compressed.length; offset += 32768) binary += String.fromCharCode(...compressed.subarray(offset, offset + 32768));
    return JSON.stringify({htmlGzip: btoa(binary)});
  }

  async function generate(element, title) {
    const html = typeof element === 'string' ? element : await serialize(element, title);
    let candidate = html;
    for (const profile of [...PHOTO_RETRY_PROFILES, null]) {
      const body = await encodeReport(candidate);
      // El cuerpo contiene únicamente JSON y base64 ASCII.
      if (body.length <= MAX_REPORT_BODY) {
        const response = await fetch('/api/chrome-report', {method: 'POST', headers: {'Content-Type': 'application/json'}, body, signal: AbortSignal.timeout(90000)});
        if (response.ok) {
          if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('El servidor no devolvió un PDF válido.');
          return response.blob();
        }
        const result = await response.json().catch(() => ({}));
        if (response.status !== 413) throw new Error(result.error || 'No se pudo generar el PDF con Chrome. Reintente el guardado.');
      }
      if (!profile) break;
      candidate = await compressReportPhotos(html, ...profile);
      if (candidate === null) break;
    }
    throw new Error('El reporte supera el tamaño permitido incluso después de optimizar las fotografías. Reduzca el tamaño de las imágenes más grandes y reintente.');
  }
  function preparePrint() {
    try {
      const popup = window.open('', '_blank');
      if (popup) { popup.document.title = 'Preparando reporte'; popup.document.body.textContent = 'Preparando reporte para imprimir…'; }
      return popup;
    } catch (_) { return null; }
  }
  async function print(html, title, popup) {
    if (popup && !popup.closed) {
      try {
        popup.document.open();
        const loaded = new Promise(resolve => popup.addEventListener('load', resolve, {once: true}));
        popup.document.write(html);
        popup.document.close();
        await loaded;
        await popup.document.fonts.ready;
        await Promise.all(Array.from(popup.document.images, image => image.decode()));
        popup.document.title = title || popup.document.title;
        popup.addEventListener('afterprint', () => popup.close(), {once: true});
        popup.focus();
        popup.print();
        return;
      } catch (error) { popup.close(); throw error; }
    }
    const originalTitle = document.title;
    let printTitle;
    const frame = document.createElement('iframe');
    frame.className = 'no-print';
    frame.title = 'Impresión del reporte';
    frame.style.cssText = 'position:fixed;left:-2000px;top:0;width:1123px;height:794px;border:0';
    const loaded = new Promise(resolve => { frame.onload = resolve; });
    frame.srcdoc = html;
    document.body.appendChild(frame);
    const cleanup = () => {
      if (document.title === printTitle) document.title = originalTitle;
      frame.remove();
    };
    try {
      await loaded;
      await frame.contentDocument.fonts.ready;
      await Promise.all(Array.from(frame.contentDocument.images, image => image.decode()));
      printTitle = title || frame.contentDocument.title || originalTitle;
      // Chrome puede proponer el título principal al guardar un reporte desde un iframe.
      document.title = printTitle;
      frame.contentDocument.title = printTitle;
      frame.title = printTitle;
      frame.contentWindow.addEventListener('afterprint', cleanup, {once: true});
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (error) { cleanup(); throw error; }
  }
  root.WashChrome = {serialize, generate, preparePrint, print};
})(window);
