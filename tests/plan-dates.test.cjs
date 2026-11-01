const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const catalog = [{code:'TEST',title:'Test',module:'Agua'}];
const dataset = item => ({generalInfo:Core.defaults(),indicators:[{code:'TEST',...item}]});
test('old plan date is retained as final date, start stays blank', () => {
  const result = Core.normalizeDataset(dataset({targetDate:'2026-11-20',history:[{recordedAt:'2026-10-01T00:00:00Z',targetDate:'2026-11-15'}]}),catalog).indicators[0];
  assert.equal(result.startDate,''); assert.equal(result.targetDate,'2026-11-20');
  assert.equal(result.history[0].startDate,''); assert.equal(result.history[0].targetDate,'2026-11-15');
});
test('both dates survive JSON round-trip and review snapshots', () => {
  const data = Core.normalizeDataset(dataset({startDate:'2026-11-01',targetDate:'2026-11-20'}),catalog);
  Core.recordReview(data.indicators[0],[],'2026-11-01T00:00:00Z');
  const result = Core.normalizeDataset(JSON.parse(JSON.stringify(data)),catalog).indicators[0];
  assert.equal(result.startDate,'2026-11-01'); assert.equal(result.targetDate,'2026-11-20');
  assert.equal(result.history[0].startDate,result.startDate); assert.equal(result.history[0].targetDate,result.targetDate);
});
test('empty and partial plans and same-day actions remain valid', () => {
  for(const dates of [{},{startDate:'2026-11-01'},{targetDate:'2026-11-01'},{startDate:'2026-11-01',targetDate:'2026-11-01'}]) assert.doesNotThrow(()=>Core.normalizeDataset(dataset(dates),catalog));
});
test('invalid dates and inverted ranges are rejected on import without altering source', () => {
  for(const dates of [{startDate:'2026-02-30'},{startDate:'2026-11-20',targetDate:'2026-11-01'}]) {
    const input=dataset(dates),before=JSON.stringify(input);
    assert.throws(()=>Core.normalizeDataset(input,catalog));assert.equal(JSON.stringify(input),before);
  }
});
test('invalid edits are not saved, clearing either date remains possible', () => {
  const item={startDate:'2026-11-01',targetDate:'2026-11-20'};
  const before=JSON.stringify(item);
  assert.throws(()=>Core.updatePlanDate(item,'targetDate','2026-10-31'),/finalización/);
  assert.throws(()=>Core.updatePlanDate(item,'startDate','2026-11-21'),/finalización/);
  assert.equal(JSON.stringify(item),before);
  Core.updatePlanDate(item,'startDate','');Core.updatePlanDate(item,'targetDate','');
  assert.deepEqual(item,{startDate:'',targetDate:''});
});
test('delays depend on final date, not start date', () => {
  assert.equal(Core.trackingStatus({startDate:'2020-01-01',targetDate:'2030-01-01'},'2026-11-01'),'No Iniciado');
  assert.equal(Core.trackingStatus({startDate:'2020-01-01'},'2026-11-01'),'No Iniciado');
});
test('both report formats include separate dates and ten matching columns', () => {
  const fs=require('node:fs'),Pdf=require('../js/pdf-report.js');
  const html=fs.readFileSync('index.html','utf8');
  const plan=html.slice(html.indexOf('data-report-step="4"'),html.indexOf('data-report-step="5"'));
  assert.match(plan,/<th>Fecha de inicio<\/th><th>Fecha de finalización<\/th>/);
  assert.match(plan,/formatDate\(ind.startDate\)/); assert.match(plan,/formatDate\(ind.targetDate\)/);
  assert.match(plan,/colspan="10"/);
  const data=Core.normalizeDataset(dataset({score:0,startDate:'2026-11-01',targetDate:'2026-11-20'}),catalog);
  const report=Pdf.definition(data,['TEST'],[]);
  const table=report.content.find(x=>x.table?.body[0].some(cell=>cell.text==='Fecha de inicio')).table;
  assert.equal(table.body[0].length,10);assert.equal(table.body[1].length,10);
  assert.equal(table.body[1][6],'2026-11-01');assert.equal(table.body[1][7],'2026-11-20');
});
