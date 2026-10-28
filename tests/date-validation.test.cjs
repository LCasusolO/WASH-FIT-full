const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('../js/core.js');
const catalogContext = {};
vm.runInNewContext(fs.readFileSync('js/data/indicators.js', 'utf8') + ';this.catalog=INDICATORS_DATA;', catalogContext);
const catalog = Core.clone(catalogContext.catalog);
const fixture = () => Core.normalizeDataset({generalInfo: Core.defaults(), indicators: [{code: 'L_15', score: 1, notes: 'Ejemplo sintético'}]}, catalog);

function load({stored = {}, confirm = true} = {}) {
  let app;
  const mounted = [], calls = {downloads: [], archived: [], generated: 0, printed: 0, prompts: [], writes: []};
  const store = {
    async read(key = 'current') { return stored[key] ? Core.clone(stored[key]) : null; },
    async save(data, backup) {
      calls.writes.push(Core.clone(data));
      stored.current = Core.clone(data);
      if (backup) stored.backup = Core.clone(data);
      return data.savedAt;
    },
    async write(key, data) { stored[key] = Core.clone(data); }
  };
  class FileReader {
    readAsText(file) { return this.onload({target: {result: file.text}}); }
  }
  const context = vm.createContext({
    Vue: {ref: value => ({value}), computed: getter => ({get value(){return getter();}}), watch(){}, onMounted: cb => mounted.push(cb), nextTick: async cb => cb?.(), createApp: options => ({mount(){app = options.setup();}})},
    window: {innerWidth: 1200, addEventListener(){}, confirm(message){calls.prompts.push(message); return confirm;}},
    navigator: {onLine: true},
    document: {addEventListener(){}, querySelector: () => ({}), createElement: () => ({click(){}, remove(){}}), body: {appendChild(){}}},
    URL: {createObjectURL(blob){calls.downloads.push(blob); return 'blob:fixture';}, revokeObjectURL(){}},
    WashStorage: {createStore: () => store},
    WashChrome: {serialize: async () => '<html>Prueba</html>', generate: async () => {calls.generated++; return new Blob(['pdf']);}, print: async () => {calls.printed++;}},
    WashArchive: {save: async job => {calls.archived.push(job); return {savedAt: job.dataset.savedAt, files: []};}},
    Blob, FileReader, Date, Intl, setTimeout(){}, clearTimeout(){}
  });
  for (const file of ['js/core.js', 'js/data/indicators.js', 'js/app.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return {app, calls, stored, async mount(){for (const cb of mounted) await cb();}};
}
const indicator = app => app.indicators.value.find(ind => ind.code === 'L_15');

test('calendar validation preserves four-digit years, leap years and optional dates', () => {
  for (const value of ['', '0001-01-01', '0096-02-29', '0999-12-31', '2000-02-29', '2024-02-29', '2011-12-30', '9999-12-31']) assert.equal(Core.validDate(value), true, value);
  for (const value of [null, 0, {}, '0000-01-01', '0001-02-29', '1900-02-29', '2100-02-29', '2026-02-30', '2026-13-01', '2026-01-00', '28/10/2026', '2026-1-01', '2026-10-28T00:00:00Z']) assert.equal(Core.validDate(value), false, String(value));
  const date = new Date(2026, 0, 1, 12); date.setFullYear(1);
  assert.equal(Core.localDate(date), '0001-01-01');
});

test('old year 0001 is imported unchanged, including history, with explicit warnings', () => {
  const data = fixture(), ind = data.indicators.find(ind => ind.code === 'L_15');
  ind.targetDate = '0001-01-01';
  ind.history = [{recordedAt: '2026-10-28T12:00:00Z', nextReviewDate: '0099-01-01'}];
  const normalized = Core.normalizeDataset(data, catalog), restored = normalized.indicators.find(ind => ind.code === 'L_15');
  assert.equal(restored.targetDate, '0001-01-01');
  assert.equal(restored.history[0].nextReviewDate, '0099-01-01');
  const issues = Core.datasetDateIssues(normalized);
  assert.equal(issues.length, 2); assert.ok(issues.every(issue => !issue.invalid));
  assert.match(issues[1].location, /L_15.*historial, revisión 1.*Próxima revisión/);
  assert.equal(Core.dateMessage(''), ''); assert.equal(Core.dateMessage('2026-10-28'), '');
});

test('invalid dates identify the indicator, field and history entry without mutating input', () => {
  const data = fixture(), ind = data.indicators.find(ind => ind.code === 'L_15');
  ind.targetDate = '2026-02-30';
  const original = JSON.stringify(data);
  assert.throws(() => Core.normalizeDataset(data, catalog), /L_15.*Fecha de realización \(targetDate\)/);
  assert.equal(JSON.stringify(data), original);
  ind.targetDate = ''; ind.history = [{recordedAt: '2026-10-28T12:00:00Z'}, {recordedAt: '2026-10-28T13:00:00Z', nextReviewDate: '2026-02-30'}];
  assert.throws(() => Core.normalizeDataset(data, catalog), /L_15.*historial, revisión 2.*Próxima revisión \(nextReviewDate\)/);
  ind.history[1].nextReviewDate = ''; ind.history[1].recordedAt = 'invalid';
  assert.throws(() => Core.normalizeDataset(data, catalog), /L_15.*historial, revisión 2.*recordedAt/);
  data.generalInfo.evaluationDate = '2026-02-30';
  assert.throws(() => Core.normalizeDataset(data, catalog), /Datos generales.*evaluationDate/);
});

test('invalid current or historical data blocks downloads, PDFs, print and uploads', async () => {
  for (const change of [
    app => indicator(app).targetDate = '2026-02-30',
    app => indicator(app).severity = 11,
    app => indicator(app).history = [{recordedAt: '2026-10-28T12:00:00Z', nextReviewDate: '28/10/2026'}],
    app => app.generalInfo.value.evaluationDate = '2026-02-30'
  ]) {
    const {app, calls} = load(); change(app);
    await app.exportData(); await app.printReport(); await app.retryArchive();
    assert.equal(calls.downloads.length, 0); assert.equal(calls.generated, 0);
    assert.equal(calls.printed, 0); assert.equal(calls.archived.length, 0);
    assert.equal(app.toast.value.type, 'error'); assert.match(app.toast.value.message, /L_15|Datos generales/);
    assert.equal(app.archiveBusy.value, false); assert.equal(app.printBusy.value, false);
  }
});

test('unusual years require confirmation and are never silently replaced', async () => {
  for (const confirm of [false, true]) {
    const {app, calls} = load({confirm}); indicator(app).targetDate = '0001-01-01';
    await app.exportData();
    assert.equal(calls.prompts.length, 1); assert.match(calls.prompts[0], /L_15.*0001/);
    assert.equal(indicator(app).targetDate, '0001-01-01');
    assert.equal(calls.downloads.length, confirm ? 1 : 0);
    assert.equal(calls.archived.length, confirm ? 1 : 0);
    if (confirm) {
      const exported = JSON.parse(await calls.downloads[0].text());
      assert.equal(exported.indicators.find(ind => ind.code === 'L_15').targetDate, '0001-01-01');
      assert.doesNotThrow(() => Core.normalizeDataset(exported, catalog));
    }
  }
});

test('incomplete native date edits preserve the previous value and block export until finished or cleared', async () => {
  const {app, calls} = load(), ind = indicator(app), location = 'L_15 — Fecha de realización';
  ind.targetDate = '2026-10-31';
  app.updateDateField({target: {value: '', validity: {badInput: true}}}, ind, 'targetDate', location);
  assert.equal(ind.targetDate, '2026-10-31'); assert.match(app.dateFieldMessage(ind.targetDate, location), /completa la fecha/);
  await app.exportData(); assert.equal(calls.downloads.length, 0);
  app.updateDateField({target: {value: '', validity: {badInput: false}}}, ind, 'targetDate', location);
  assert.equal(ind.targetDate, ''); assert.equal(app.dateFieldMessage('', location), '');
  await app.exportData(); assert.equal(calls.downloads.length, 1);
});

test('local drafts with invalid dates reopen for correction; import remains strict', async () => {
  const current = fixture(), ind = current.indicators.find(ind => ind.code === 'L_15'); ind.targetDate = '2026-02-30';
  const stored = {current}, {app, calls, mount} = load({stored}); await mount();
  assert.equal(indicator(app).targetDate, '2026-02-30'); assert.equal(app.dateIssues.value[0].invalid, true);
  assert.equal(app.recoveryError.value, ''); assert.equal(calls.writes.length, 0);
  await app.exportData(); assert.equal(calls.downloads.length, 0);
  indicator(app).targetDate = '2026-03-01'; await app.saveDraft(); await app.exportData();
  assert.equal(calls.downloads.length, 1); assert.equal(stored.current.indicators.find(ind => ind.code === 'L_15').targetDate, '2026-03-01');
  const event = {target: {files: [{size: 100, text: JSON.stringify(current)}], value: 'file'}};
  await app.importData(event);
  assert.equal(indicator(app).targetDate, '2026-03-01'); assert.equal(event.target.value, '');
  assert.match(app.toast.value.message, /L_15.*targetDate/);
});

test('an unrecoverable stored draft cannot be overwritten and can be downloaded or backed up before replacement', async () => {
  const current = fixture(); current.indicators[0].severity = 99;
  const before = JSON.stringify(current), stored = {current};
  const {app, calls, mount} = load({stored}); await mount();
  assert.match(app.recoveryError.value, /sin sobrescribir/);
  app.generalInfo.value.facilityName = 'Edición provisional';
  assert.equal(await app.saveDraft(), false); await app.exportData();
  assert.equal(calls.writes.length, 0); assert.equal(calls.downloads.length, 0); assert.equal(JSON.stringify(stored.current), before);
  app.downloadProtectedDraft(); assert.equal(await calls.downloads[0].text(), JSON.stringify(current, null, 2));
  const replacement = fixture(); replacement.generalInfo.facilityName = 'Nueva evaluación sintética';
  await app.importData({target: {files: [{size: 100, text: JSON.stringify(replacement)}], value: 'file'}});
  assert.equal(app.recoveryError.value, ''); assert.equal(JSON.stringify(stored.backup), before);
  assert.equal(stored.current.generalInfo.facilityName, 'Nueva evaluación sintética');
});

test('save, reload, export and import preserve answers, dates, history and the previous draft backup', async () => {
  const first = load(); await first.mount();
  const ind = indicator(first.app);
  ind.targetDate = '2026-10-31'; ind.nextReviewDate = ''; ind.score = 1; ind.notes = 'Dato sintético';
  ind.history = [{recordedAt: '2026-10-28T12:00:00Z', targetDate: '2026-11-30', nextReviewDate: '2026-12-31', score: 0, notes: 'Revisión sintética'}];
  assert.equal(await first.app.saveDraft(), true);
  const second = load({stored: first.stored}); await second.mount(); await second.app.exportData();
  const json = await second.calls.downloads[0].text(), exported = JSON.parse(json);
  assert.deepEqual(exported.indicators.find(ind => ind.code === 'L_15').history, Core.clone(indicator(second.app).history));
  assert.equal(JSON.stringify(second.calls.archived[0].dataset), JSON.stringify(exported));
  const third = load(); await third.mount(); third.app.generalInfo.value.facilityName = 'Borrador anterior';
  await third.app.importData({target: {files: [{size: Buffer.byteLength(json), text: json}], value: 'file'}});
  assert.equal(indicator(third.app).targetDate, '2026-10-31'); assert.equal(indicator(third.app).nextReviewDate, '');
  assert.equal(indicator(third.app).history[0].nextReviewDate, '2026-12-31'); assert.equal(indicator(third.app).notes, 'Dato sintético');
  assert.equal(third.stored.backup.generalInfo.facilityName, 'Borrador anterior');
  assert.equal(third.app.toast.value.type, 'success');
});

test('historical invalid dates in a local draft have an explicitly requested recovery download', async () => {
  const current = fixture();
  current.indicators.find(ind => ind.code === 'L_15').history = [{recordedAt: '2026-10-28T12:00:00Z', targetDate: '2026-02-30'}];
  const {app, calls, mount} = load({stored: {current}}); await mount();
  await app.exportData(); assert.equal(calls.downloads.length, 0);
  app.downloadProtectedDraft();
  const recovered = JSON.parse(await calls.downloads[0].text());
  assert.equal(recovered.indicators.find(ind => ind.code === 'L_15').history[0].targetDate, '2026-02-30');
  assert.equal(calls.archived.length, 0);
});

test('a schema-valid dataset exceeding the import byte limit cannot be exported or archived', async () => {
  const {app, calls} = load();
  const url = 'data:image/jpeg;base64,' + 'A'.repeat(6000000);
  app.generalInfo.value.photos = Array.from({length: 7}, (_, i) => ({name: `synthetic-${i}`, url}));
  await app.exportData();
  assert.match(app.toast.value.message, /40 MB/);
  assert.equal(calls.downloads.length, 0); assert.equal(calls.archived.length, 0); assert.equal(calls.generated, 0);
});
