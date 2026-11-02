const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const catalog = [{ code: 'A_1', title: 'Indicador 1' }, { code: 'A_2', title: 'Indicador 2' }];
const info = { facilityName: 'Hospital', team: [{ id: 'm1', name: 'Ana', role: '' }] };
const dataset = (indicator = {}) => ({ schemaVersion: 2, generalInfo: info, indicators: [{ code: 'A_1', score: 0, ...indicator }] });
const norm = indicator => Core.normalizeDataset(dataset(indicator), catalog).indicators[0];

test('files without extra actions keep a single action and open unchanged', () => {
  const ind = norm({ action: '• Reparar', startDate: '2026-10-01', targetDate: '2026-10-10', cost: 100 });
  assert.deepEqual(ind.extraActions, []);
  assert.equal(Core.planActions(ind).length, 1);
  assert.equal(Core.planActions(ind)[0], ind);
});

test('extra actions are validated and normalized on import', () => {
  const ind = norm({ action: 'A', extraActions: [{ action: 'B', startDate: '2026-11-01', targetDate: '2026-11-05', cost: 50, responsible: 'Ana', trackingStatus: 'En Progreso' }] });
  assert.equal(ind.extraActions.length, 1);
  assert.ok(ind.extraActions[0].id);
  assert.equal(ind.extraActions[0].responsibleId, 'm1');
  assert.throws(() => norm({ extraActions: [{ startDate: '2026-11-10', targetDate: '2026-11-01' }] }), /anterior/);
  assert.throws(() => norm({ extraActions: [{ cost: -1 }] }), /costo/);
  assert.throws(() => norm({ extraActions: 'x' }), /Máximo/);
  assert.throws(() => norm({ extraActions: Array.from({ length: Core.MAX_PLAN_ACTIONS }, () => ({})) }), /Máximo/);
});

test('add and remove actions, promoting the next one when the first is removed', () => {
  const ind = norm({ action: 'Primera', cost: 10 });
  const added = Core.addPlanAction(ind);
  added.action = 'Segunda'; added.cost = 20;
  Core.addPlanAction(ind).action = 'Tercera';
  assert.equal(Core.planActions(ind).length, 3);
  Core.removePlanAction(ind, 1);
  assert.deepEqual(Core.planActions(ind).map(a => a.action), ['Primera', 'Tercera']);
  Core.removePlanAction(ind, 0);
  assert.equal(ind.action, 'Tercera'); assert.equal(ind.extraActions.length, 0); assert.equal(ind.cost, null);
  Core.removePlanAction(ind, 0);
  assert.equal(ind.action, 'Tercera');
  for (let i = 0; i < Core.MAX_PLAN_ACTIONS - 1; i++) Core.addPlanAction(ind);
  assert.throws(() => Core.addPlanAction(ind), /Máximo/);
});

test('indicator status and summary are derived from all actions', () => {
  const ind = norm({ action: 'A', startDate: '2026-09-29', targetDate: '2026-10-16', cost: 800, trackingStatus: 'En Progreso', extraActions: [
    { action: 'B', startDate: '2026-10-13', targetDate: '2026-11-03', cost: 1500 },
    { action: 'C', startDate: '2026-11-10', targetDate: '2026-11-21', cost: 300, trackingStatus: 'Completado' }] });
  assert.equal(Core.actionStatus(ind, '2026-11-01'), 'Retrasado');
  assert.equal(Core.actionStatus(ind.extraActions[0], '2026-11-01'), 'No Iniciado');
  assert.equal(Core.trackingStatus(ind, '2026-11-01'), 'Retrasado');
  const summary = Core.planSummary(ind, '2026-11-01');
  assert.deepEqual(summary, { count: 3, startDate: '2026-09-29', targetDate: '2026-11-21', cost: 2600, delayed: 1 });
  ind.trackingStatus = 'Completado'; ind.extraActions[0].trackingStatus = 'Completado';
  assert.equal(Core.trackingStatus(ind, '2026-12-31'), 'Completado');
  ind.extraActions[0].trackingStatus = 'En Progreso'; ind.extraActions[0].targetDate = '2027-01-01';
  assert.equal(Core.trackingStatus(ind, '2026-12-31'), 'En Progreso');
});

test('a single action behaves exactly as before', () => {
  const ind = norm({ action: 'A', targetDate: '2026-10-01', trackingStatus: 'En Progreso' });
  assert.equal(Core.trackingStatus(ind, '2026-11-01'), 'Retrasado');
  assert.equal(Core.trackingStatus(norm({ action: 'A' }), '2026-11-01'), 'No Iniciado');
});

test('follow-up text combines the actions of an indicator and history keeps them', () => {
  const ind = norm({ action: '• Reparar', extraActions: [{ action: '• Capacitar' }, { action: '' }] });
  assert.equal(Core.actionsText(ind), 'Acción 1:\n• Reparar\n\nAcción 2:\n• Capacitar');
  assert.equal(Core.actionsText(norm({ action: '• Solo una' })), '• Solo una');
  const entry = Core.recordReview(ind, info.team, '2026-11-01T10:00:00.000Z');
  assert.equal(entry.extraActions.length, 2);
  assert.equal(Core.actionsText(entry), Core.actionsText(ind));
  const reimported = norm({ ...ind });
  assert.equal(reimported.history.length, 1);
});

test('gantt rows are grouped per indicator with one bar per action', () => {
  const rows = [
    { id: 'a', groupId: 'A_1', startDate: '2026-10-01', targetDate: '2026-10-05' },
    { id: 'b', groupId: 'A_1', startDate: '2026-10-06', targetDate: '2026-10-09' },
    { id: 'c', groupId: 'A_2', startDate: '2026-10-02', targetDate: '2026-10-03' },
    { id: 'd', groupId: 'A_3', startDate: '', targetDate: '' }
  ];
  const g = Core.buildGantt(rows, '2026-10-04');
  assert.deepEqual(g.rows.map(r => [r.groupStart, r.groupSize]), [[true, 2], [false, 1], [true, 1]]);
});
