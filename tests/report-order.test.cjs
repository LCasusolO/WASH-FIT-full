const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../js/core.js');
const Pdf = require('../js/pdf-report.js');

function fixture() {
  return [2, null, 1, 0, 1, 0].map((score, index) => ({
    code: `TEST_${index}`, title: `Indicador ${index}`, moduleId: 'water', module: 'Agua',
    score, severity: index, likelihood: 0, action: 'Acción de prueba', history: [{recordedAt: '2026-11-05T12:00:00Z'}]
  }));
}

test('report sorting groups gaps first, preserves ties and keeps unscored plans last without mutating data', () => {
  const indicators = fixture();
  const before = JSON.stringify(indicators);
  assert.deepEqual(Core.sortReportByAssessment(indicators).map(ind => ind.code), ['TEST_3', 'TEST_5', 'TEST_2', 'TEST_4', 'TEST_0', 'TEST_1']);
  assert.equal(JSON.stringify(indicators), before);
});

test('app report lists sort steps 3–5 while retaining the catalog order for assessment and step 2', () => {
  let app;
  const context = vm.createContext({
    Vue: {ref: value => ({value}), computed: getter => ({get value() {return getter();}}), onMounted() {}, nextTick() {}, watch() {}, createApp: options => ({mount() {app = options.setup();}})},
    window: {innerWidth: 1200}, navigator: {onLine: true}, WashStorage: {createStore: () => ({})},
    setTimeout() {}, clearTimeout() {}, Date, Intl
  });
  for (const file of ['js/core.js', 'js/data/indicators.js', 'js/app.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const indicators = fixture();
  app.indicators.value = indicators;
  const codes = list => Array.from(list, ind => ind.code);
  assert.deepEqual(codes(app.reportRisks.value), ['TEST_3', 'TEST_5', 'TEST_2', 'TEST_4', 'TEST_0']);
  assert.deepEqual(codes(app.reportPlans.value), ['TEST_3', 'TEST_5', 'TEST_2', 'TEST_4', 'TEST_0', 'TEST_1']);
  assert.deepEqual(codes(app.reportIndicators.value), indicators.map(ind => ind.code));
  assert.deepEqual(codes(app.getFilteredIndicatorsByModule.value), indicators.map(ind => ind.code));
  assert.deepEqual(codes(app.indicators.value), indicators.map(ind => ind.code));
  assert.deepEqual(codes(app.getSortedGaps.value), ['TEST_3', 'TEST_5', 'TEST_2', 'TEST_4', 'TEST_0']);
  app.sortRiskOrder.value = 'desc';
  assert.deepEqual(codes(app.getSortedGaps.value), ['TEST_5', 'TEST_3', 'TEST_4', 'TEST_2', 'TEST_0']);
  app.sortRiskOrder.value = 'asc';
  assert.deepEqual(codes(app.getSortedGaps.value), ['TEST_3', 'TEST_5', 'TEST_2', 'TEST_4', 'TEST_0']);
});

test('alternate PDF uses the same order for risks, plans, monitoring and historical groups', () => {
  const indicators = fixture();
  const doc = Pdf.definition({savedAt: '2026-11-05T12:00:00Z', generalInfo: Core.defaults(), indicators}, indicators.map(ind => ind.code), [{id: 'water', name: 'Agua'}]);
  const tables = step => {
    const start = doc.content.findIndex(item => item.style === 'heading' && item.text.startsWith(`Paso ${step}:`));
    const end = doc.content.findIndex((item, index) => index > start && item.style === 'heading');
    return doc.content.slice(start + 1, end === -1 ? undefined : end).filter(item => item.table);
  };
  const titles = table => table.table.body.slice(1).map(row => (row[1].text ?? row[1]).split('\n')[0]);
  assert.deepEqual(titles(tables(2)[0]), indicators.map(ind => ind.title));
  assert.deepEqual(titles(tables(3)[0]), ['Indicador 3', 'Indicador 5', 'Indicador 2', 'Indicador 4', 'Indicador 0']);
  const expected = ['Indicador 3', 'Indicador 5', 'Indicador 2', 'Indicador 4', 'Indicador 0', 'Indicador 1'];
  assert.deepEqual(titles(tables(4)[0]), expected);
  for (const table of tables(5)) assert.deepEqual(titles(table), expected);
  for (const step of [3, 4, 5]) {
    const resultColumn = step === 3 ? 2 : 1;
    const rows = tables(step)[0].table.body.slice(1, 6);
    assert.deepEqual(rows.map(row => row[resultColumn].fillColor), ['#fee2e2', '#fee2e2', '#fef3c7', '#fef3c7', '#dcfce7']);
    for (const row of rows) {
      assert.ok(row.every((cell, index) => index === resultColumn || cell.fillColor === undefined));
    }
  }
});
