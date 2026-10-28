const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const {spawn} = require('node:child_process');
const Core = require('../js/core.js');

test('browser imports, warns, corrects, persists and reimports a synthetic year-0001 evaluation', {
  skip: !process.env.WASH_CHROME_EXECUTABLE, timeout: 60000
}, async () => {
  const {chromium} = require('playwright-core');
  const port = process.env.WASH_TEST_PORT || '18765';
  const server = spawn(process.execPath, ['scripts/serve.cjs'], {env: {...process.env, WASH_FIT_PORT: port}, windowsHide: true});
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject); server.once('exit', code => reject(new Error(`Test server exited: ${code}`)));
      server.stdout.on('data', chunk => {if (String(chunk).includes('http://127.0.0.1:')) resolve();});
    });
    browser = await chromium.launch({executablePath: process.env.WASH_CHROME_EXECUTABLE, headless: true});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, serviceWorkers: 'block'});
    const errors = [], downloads = [], archiveActions = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('download', file => downloads.push(file));
    await page.route('**/api/chrome-report', route => route.fulfill({contentType: 'application/pdf', body: Buffer.from('%PDF-1.4 synthetic test')}));
    await page.route('**/api/drive-archive', route => {
      const body = route.request().postDataJSON(); archiveActions.push(body.action);
      const result = body.action === 'start' ? {receipt: 'test'} : body.action === 'status' ? {offset: 0} : body.action === 'upload' ? {id: 'test-' + body.kind} : {saved: true, savedAt: '2026-10-28T18:00:00Z', files: []};
      return route.fulfill({contentType: 'application/json', body: JSON.stringify(result)});
    });
    await page.goto(`http://127.0.0.1:${port}`);
    const synthetic = {generalInfo: {...Core.defaults(), facilityName: 'Hospital de prueba', level: 'Segundo Nivel'}, indicators: [{code: 'L_15', score: 1, notes: 'Datos sintéticos', targetDate: '0001-01-01'}]};
    const importJson = data => page.locator('#import-file').setInputFiles({name: 'prueba.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data))});
    await importJson(synthetic);
    await page.getByText('Evaluación validada, importada y guardada.', {exact: true}).waitFor();
    await page.locator('aside button').filter({hasText: 'Plan de Mejora'}).click();
    const row = page.locator('tr:visible').filter({hasText: 'los alimentos se manipulan y preparan de manera segura'});
    // Date controls do not expose a consistent textbox role across Chromium versions.
    const input = row.locator('input[aria-label="Plazo"]');
    await input.waitFor(); assert.equal(await input.inputValue(), '0001-01-01');
    assert.match(await row.locator('.date-feedback').innerText(), /0001/);
    const cancel = new Promise(resolve => page.once('dialog', async dialog => {assert.match(dialog.message(), /L_15.*0001/); await dialog.dismiss(); resolve();}));
    await page.getByRole('button', {name: 'Exportar', exact: true}).click(); await cancel;
    assert.equal(downloads.length, 0); assert.equal(archiveActions.length, 0);
    await input.fill('2026-10-31');
    await page.waitForFunction(() => !document.querySelector('.date-notice'));
    await page.waitForFunction(() => /Guardado a las/.test(document.querySelector('.draft-status')?.textContent || ''));
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Exportar', exact: true}).click();
    const download = await downloadReady, exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    await page.waitForFunction(() => document.body.textContent.includes('JSON y PDF guardados en el repositorio.'));
    assert.equal(exported.indicators.find(ind => ind.code === 'L_15').targetDate, '2026-10-31');
    assert.ok(archiveActions.includes('verify'));
    await page.reload();
    await page.locator('aside button').filter({hasText: 'Plan de Mejora'}).click();
    assert.equal(await input.inputValue(), '2026-10-31');
    await importJson(exported);
    await page.getByText('Evaluación validada, importada y guardada.', {exact: true}).waitFor();
    assert.equal(await input.inputValue(), '2026-10-31');
    const invalid = structuredClone(synthetic); invalid.indicators[0].targetDate = '2026-02-30';
    await importJson(invalid);
    await page.getByText(/L_15 — Fecha inválida: Fecha de realización/).waitFor();
    assert.equal(await input.inputValue(), '2026-10-31');
    await input.fill('0001-01-01');
    if (process.env.WASH_DATE_SCREENSHOT) await page.screenshot({path: process.env.WASH_DATE_SCREENSHOT, fullPage: false});
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close(); server.kill();
  }
});
