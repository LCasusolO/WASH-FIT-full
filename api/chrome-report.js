const {gunzipSync} = require('node:zlib');
const MAX_BODY = 4 * 1024 * 1024;
const MAX_HTML = 40 * 1024 * 1024;
async function render(html, env = process.env) {
  const {chromium: playwright} = require('playwright-core');
  const chromium = require('@sparticuz/chromium').default;
  const browser = await playwright.launch({
    executablePath: env.WASH_CHROME_EXECUTABLE || await chromium.executablePath(),
    args: env.WASH_CHROME_EXECUTABLE ? [] : chromium.args,
    headless: true
  });
  try {
    const context = await browser.newContext({javaScriptEnabled: false, viewport: {width: 1123, height: 794}, serviceWorkers: 'block'});
    // The report is self-contained. Block all network/file requests, including CSS URLs.
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.emulateMedia({media: 'print'});
    await page.setContent(html.replace(/<head>/i, `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">`), {waitUntil: 'load'});
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, image => image.decode()));
    });
    return await page.pdf({format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true, timeout: 30000});
  } finally { await browser.close(); }
}
function createHandler({env = process.env, renderPdf = html => render(html, env)} = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({error: 'Método no permitido.'});
    if (req.headers.origin !== (env.WASH_APP_ORIGIN || 'https://wash-fit-full.vercel.app')) return res.status(403).json({error: 'Origen no permitido.'});
    let html;
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body.htmlGzip !== 'string' || JSON.stringify(body).length > MAX_BODY) throw Error();
      html = gunzipSync(Buffer.from(body.htmlGzip, 'base64'), {maxOutputLength: MAX_HTML}).toString('utf8');
      if (!html.startsWith('<!doctype html>') || !html.includes('report-content')) throw Error();
    } catch (_) { return res.status(400).json({error: 'El reporte enviado no es válido o supera el tamaño permitido.'}); }
    try {
      const pdf = await renderPdf(html);
      if (pdf.length > 4 * 1024 * 1024) return res.status(413).json({error: 'El PDF supera el tamaño permitido. Reduzca el tamaño de las fotografías y reintente.'});
      res.setHeader('Content-Type', 'application/pdf');
      return res.status(200).end(pdf);
    } catch (error) { console.error('Chrome PDF generation failed:', error.message); return res.status(502).json({error: 'No se pudo generar el PDF con Chrome. Reintente el guardado.'}); }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.render = render;
