(function (root) {
  'use strict';
  async function serialize(element, title) {
    await document.fonts.ready;
    const copy = element.cloneNode(true);
    copy.querySelectorAll('.no-print, script, iframe, object, embed').forEach(node => node.remove());
    const originals = Array.from(element.querySelectorAll('img'));
    const images = Array.from(copy.querySelectorAll('img'));
    await Promise.all(images.map(async (image, index) => {
      const source = originals[index];
      try {
        await source.decode();
        const canvas = document.createElement('canvas');
        canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
        canvas.getContext('2d').drawImage(source, 0, 0);
        image.src = canvas.toDataURL('image/png');
        image.removeAttribute('srcset');
      } catch (_) { throw new Error('No se pudo cargar una imagen del reporte. Revise la conexión y reintente.'); }
    }));
    const css = Array.from(document.styleSheets).map(sheet => Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n')).join('\n');
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + escape(title) + '</title><style>' + css.replace(/<\/style/gi, '<\\/style') + '</style></head><body class="font-sans antialiased"><section class="print-report report-open">' + copy.outerHTML + '</section></body></html>';
  }
  async function generate(element, title) {
    const html = typeof element === 'string' ? element : await serialize(element, title);
    const compressed = new Uint8Array(await new Response(new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < compressed.length; offset += 32768) binary += String.fromCharCode(...compressed.subarray(offset, offset + 32768));
    const body = JSON.stringify({htmlGzip: btoa(binary)});
    if (new Blob([body]).size > 4 * 1024 * 1024) throw new Error('El reporte supera el tamaño permitido. Reduzca el tamaño de las fotografías y reintente.');
    const response = await fetch('/api/chrome-report', {method: 'POST', headers: {'Content-Type': 'application/json'}, body, signal: AbortSignal.timeout(90000)});
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'No se pudo generar el PDF con Chrome. Reintente el guardado.');
    }
    if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('El servidor no devolvió un PDF válido.');
    return response.blob();
  }
  async function print(html) {
    const frame = document.createElement('iframe');
    frame.className = 'no-print';
    frame.title = 'Impresi�n del reporte';
    frame.style.cssText = 'position:fixed;left:-2000px;top:0;width:1123px;height:794px;border:0';
    const loaded = new Promise(resolve => { frame.onload = resolve; });
    frame.srcdoc = html;
    document.body.appendChild(frame);
    try {
      await loaded;
      await frame.contentDocument.fonts.ready;
      await Promise.all(Array.from(frame.contentDocument.images, image => image.decode()));
      frame.contentWindow.addEventListener('afterprint', () => frame.remove(), {once: true});
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (error) { frame.remove(); throw error; }
  }
  root.WashChrome = {serialize, generate, print};
})(window);
