const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const item = (code, startDate, targetDate, extra = {}) => ({ id: code, code, startDate, targetDate, status: 'No Iniciado', ...extra });

test('gantt without dated actions is empty', () => {
  const g = Core.buildGantt([item('A_1', '', ''), item('A_2', '2026-10-01', '')], '2026-11-01');
  assert.deepEqual(g.rows, []); assert.equal(g.totalDays, 0); assert.equal(g.todayOffset, null);
});

test('gantt axis runs Monday to Sunday and places bars by day offset', () => {
  const g = Core.buildGantt([item('A_5', '2026-09-29', '2026-10-16'), item('A_7', '2026-11-03', '2026-11-21')], '2026-11-01');
  assert.equal(g.weeks[0], '28 sep'); assert.equal(g.weeks.at(-1), '16 nov');
  assert.equal(g.totalDays, g.weeks.length * 7); assert.equal(g.totalDays % 7, 0);
  assert.equal(g.rows[0].offset, 1); assert.equal(g.rows[0].days, 18);
  assert.equal(g.rows[1].offset, 36); assert.equal(g.rows[1].days, 19);
  assert.equal(g.todayOffset, 34);
});

test('gantt ignores inverted ranges and keeps at least four weeks', () => {
  const g = Core.buildGantt([item('A_8', '2026-10-24', '2026-10-21'), item('A_9', '2026-10-21', '2026-10-22')], '2026-10-22');
  assert.equal(g.rows.length, 1); assert.equal(g.rows[0].code, 'A_9'); assert.ok(g.weeks.length >= 4);
});

test('gantt includes a nearby today but hides a far one', () => {
  const near = Core.buildGantt([item('A_1', '2026-10-01', '2026-10-10')], '2026-10-25');
  assert.notEqual(near.todayOffset, null);
  const far = Core.buildGantt([item('A_1', '2026-10-01', '2026-10-10')], '2027-03-01');
  assert.equal(far.todayOffset, null); assert.ok(far.totalDays < 60);
});

test('gantt exposes the first line of the action without bullets', () => {
  const g = Core.buildGantt([item('A_1', '2026-10-01', '2026-10-10', { action: '\n• Reparar la fuga\n• Revisar válvulas' }), item('A_2', '2026-10-01', '2026-10-10', { action: '' })], '2026-10-05');
  assert.equal(g.rows[0].actionText, 'Reparar la fuga'); assert.equal(g.rows[1].actionText, '');
});
