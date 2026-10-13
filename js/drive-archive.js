(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WashArchive = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  async function api(body, request) {
    const response = await request('/api/drive-archive', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(60000)});
    let result;
    try { result = await response.json(); } catch (_) { throw new Error('El repositorio de Drive no está disponible.'); }
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar en Drive.');
    return result;
  }
  async function upload(file, blob, request) {
    if (new URL(file.session).origin !== 'https://www.googleapis.com') throw new Error('Destino de subida inválido.');
    // Consultar el offset permite reintentar un archivo sin crear otro.
    let response = await request(file.session, {method: 'PUT', headers: {'Content-Range': `bytes */${blob.size}`}, signal: AbortSignal.timeout(60000)});
    if (response.ok) return (await response.json()).id;
    if (response.status !== 308) throw new Error('La sesión de subida no está disponible. Vuelva a Exportar.');
    let offset = 0;
    while (response.status === 308) {
      const range = response.headers.get('range');
      const start = range ? Number(range.split('-')[1]) + 1 : 0;
      if (!Number.isSafeInteger(start) || start < offset || start >= blob.size) throw new Error('Respuesta de subida inválida.');
      offset = start;
      const end = Math.min(start + 1024 * 1024, blob.size);
      response = await request(file.session, {method: 'PUT', headers: {'Content-Type': file.mime, 'Content-Range': `bytes ${start}-${end - 1}/${blob.size}`}, body: blob.slice(start, end), signal: AbortSignal.timeout(120000)});
      if (response.status === 308 && response.headers.get('range') === range) throw new Error('La subida no avanzó. Reintente el guardado.');
    }
    if (!response.ok) throw new Error('Se interrumpió la subida a Drive. Reintente el guardado.');
    const result = await response.json();
    if (!result.id) throw new Error('Drive no confirmó el archivo.');
    return result.id;
  }
  async function save(job, progress, request = fetch) {
    if (!job.session) job.session = await api({action: 'start', facility: job.dataset.generalInfo.facilityName, jsonBytes: job.json.size, pdfBytes: job.pdf.size}, request);
    job.ids ||= [null, null];
    for (let i = 0; i < 2; i++) {
      if (job.ids[i]) continue;
      progress(i === 0 ? 'Guardando JSON en Drive…' : 'JSON guardado. Guardando PDF en Drive…');
      job.ids[i] = await upload(job.session.files[i], i ? job.pdf : job.json, request);
    }
    progress('Confirmando ambos archivos…');
    const result = await api({action: 'verify', receipt: job.session.receipt, ids: job.ids}, request);
    if (!result.saved) throw new Error('Drive no confirmó ambos archivos.');
    return result;
  }
  return {save};
});
