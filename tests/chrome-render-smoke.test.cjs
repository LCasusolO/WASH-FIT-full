const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../api/chrome-report.js');
test('the packaged Chrome actually renders a PDF, including an embedded image', { skip: process.platform !== 'linux' && !process.env.WASH_CHROME_EXECUTABLE, timeout: 60000 }, async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><div class="report-content"><h1>WASH FIT</h1><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII="></div></body></html>';
  const pdf = await render(html);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1000);
});
