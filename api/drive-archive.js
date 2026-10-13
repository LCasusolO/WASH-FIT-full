const crypto = require('node:crypto');
const FOLDER = '1SjIXFiCnnQwTZTTvCqLY6xJYb9sGxb6z';
const MAX_BYTES = 40 * 1024 * 1024;
function createHandler({env = process.env, request = fetch, now = Date.now} = {}) {
  let cachedToken;
  const call = (url, options) => request(url, {...options, signal: AbortSignal.timeout(20000)});
  const sign = body => crypto.createHmac('sha256', env.GOOGLE_CLIENT_SECRET).update(body).digest('base64url');
  async function token() {
    if (cachedToken?.expires > now()) return cachedToken.value;
    const result = await call('https://oauth2.googleapis.com/token', {method: 'POST', body: new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token'})});
    const data = await result.json();
    if (!result.ok || !data.access_token) throw new Error('No se pudo autorizar el repositorio de Drive.');
    cachedToken = {value: data.access_token, expires: now() + Math.max(0, Number(data.expires_in) - 60) * 1000};
    return cachedToken.value;
  }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({error: 'Método no permitido.'});
    if (![env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN].every(Boolean)) return res.status(503).json({error: 'El repositorio aún no está activado. Comuníquese con el administrador.'});
    const allowedOrigin = env.WASH_APP_ORIGIN || 'https://wash-fit-full.vercel.app';
    if (req.headers.origin !== allowedOrigin) return res.status(403).json({error: 'Origen no permitido.'});
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || JSON.stringify(body).length > 8192) return res.status(400).json({error: 'Solicitud inválida.'});
      const folder = env.GOOGLE_DRIVE_FOLDER_ID || FOLDER;
      if (body.action === 'start') {
        if (![body.jsonBytes, body.pdfBytes].every(x => Number.isSafeInteger(x) && x > 0 && x <= MAX_BYTES) || typeof body.facility !== 'string' || body.facility.length > 500) return res.status(400).json({error: 'Nombre o tamaño de archivos inválido (máximo 40 MB por archivo).'});
        const authorization = 'Bearer ' + await token();
        const batch = crypto.randomUUID();
        const name = 'WASH_FIT_' + (body.facility || 'Sin_nombre').normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) + '_' + new Date(now()).toISOString().replace(/[:.]/g, '-') + '_' + batch.slice(0, 8);
        const files = [{kind: 'json', name: name + '.json', mime: 'application/json', bytes: body.jsonBytes}, {kind: 'pdf', name: name + '.pdf', mime: 'application/pdf', bytes: body.pdfBytes}];
        for (const file of files) {
          const response = await call('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', {method: 'POST', headers: {Authorization: authorization, 'Content-Type': 'application/json', 'X-Upload-Content-Type': file.mime, 'X-Upload-Content-Length': String(file.bytes)}, body: JSON.stringify({name: file.name, mimeType: file.mime, parents: [folder], appProperties: {washFitBatch: batch}})});
          const session = response.headers.get('location');
          if (!response.ok || !session || new URL(session).origin !== 'https://www.googleapis.com') throw new Error('No se pudo iniciar la subida. Revise el acceso del propietario a la carpeta.');
          file.session = session;
        }
        const receiptBody = Buffer.from(JSON.stringify({batch, expires: now() + 3600000, files: files.map(({session, ...file}) => file)})).toString('base64url');
        return res.status(200).json({files, receipt: receiptBody + '.' + sign(receiptBody)});
      }
      if (body.action === 'verify') {
        const [payload, signature] = String(body.receipt || '').split('.');
        const expected = Buffer.from(sign(payload || ''));
        const received = Buffer.from(signature || '');
        if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return res.status(400).json({error: 'Comprobante inválido.'});
        const receipt = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (receipt.expires < now() || !Array.isArray(body.ids) || body.ids.length !== 2 || body.ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{5,200}$/.test(id))) return res.status(400).json({error: 'Comprobante vencido o archivos inválidos.'});
        const authorization = 'Bearer ' + await token();
        for (let i = 0; i < 2; i++) {
          const response = await call(`https://www.googleapis.com/drive/v3/files/${body.ids[i]}?supportsAllDrives=true&fields=id,name,mimeType,size,parents,appProperties,trashed`, {headers: {Authorization: authorization}});
          const file = await response.json();
          const wanted = receipt.files[i];
          if (!response.ok || file.trashed || !file.parents?.includes(folder) || file.appProperties?.washFitBatch !== receipt.batch || file.name !== wanted.name || file.mimeType !== wanted.mime || Number(file.size) !== wanted.bytes) throw new Error('No se pudo confirmar el guardado de ambos archivos en la carpeta.');
        }
        return res.status(200).json({saved: true});
      }
      return res.status(400).json({error: 'Acción no válida.'});
    } catch (_) { return res.status(502).json({error: 'No se pudo completar el guardado en Drive. Revise la conexión y la configuración del repositorio.'}); }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
