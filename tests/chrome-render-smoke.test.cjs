const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../api/chrome-report.js');
test('PDF bookmarks contain all six steps with distinct page destinations', { skip: process.platform !== 'linux' && !process.env.WASH_CHROME_EXECUTABLE, timeout: 60000 }, async () => {
  const titles = ['Paso 1: Datos Generales', 'Paso 2: Evaluación de la Situación', 'Paso 3: Evaluación del Riesgo', 'Paso 4: Plan de Mejora', 'Paso 5: Monitoreo y Revisión', 'Resumen'];
  const sections = titles.map(title => `<section><h2>${title}</h2><p>Contenido de prueba</p></section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>section + section { break-before: page; }</style></head><body><div class="report-content"><h1>WASH FIT</h1>${sections}</div></body></html>`;
  const pdf = await render(html);
  const source = pdf.toString('latin1');
  assert.ok(source.includes('/Outlines'));
  const objects = source.split('endobj');
  const destinations = titles.map(title => {
    const encoded = 'FEFF' + Buffer.from(title, 'utf16le').swap16().toString('hex').toUpperCase();
    const bookmark = objects.find(object => object.includes(`/Title (${title})`) || object.includes(`/Title <${encoded}>`));
    assert.ok(bookmark, `Missing bookmark: ${title}`);
    const destination = bookmark.match(/\/Dest \[(\d+) 0 R/);
    assert.ok(destination, `Missing page destination: ${title}`);
    const page = objects.find(object => object.trim().startsWith(`${destination[1]} 0 obj`));
    assert.match(page, /\/Type \/Page\b/);
    return destination[1];
  });
  assert.equal(new Set(destinations).size, 6);
});
test('the packaged Chrome actually renders a PDF, including an embedded image', { skip: process.platform !== 'linux' && !process.env.WASH_CHROME_EXECUTABLE, timeout: 60000 }, async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><div class="report-content"><h1>WASH FIT</h1><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII="></div></body></html>';
  const pdf = await render(html);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1000);
});


test('repeated and simultaneous reports release their temporary profiles, including failed renders', { skip: process.platform !== 'linux' && !process.env.WASH_CHROME_EXECUTABLE, timeout: 60000 }, async () => {
  const {readdir} = require('node:fs/promises');
  const {tmpdir} = require('node:os');
  const scratch = async () => (await readdir(tmpdir())).filter(name => name.startsWith('wash-report-')).sort();
  const before = await scratch();
  const html = '<!doctype html><html><head></head><body><div class="report-content">Repeated report</div></body></html>';
  const results = await Promise.all([render(html), render(html), render(html)]);
  for (const pdf of results) assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  await assert.rejects(render(html.replace('Repeated report', '<img src="data:image/png;base64,broken">')));
  assert.equal((await render(html)).subarray(0, 5).toString(), '%PDF-');
  assert.deepEqual(await scratch(), before);
});
