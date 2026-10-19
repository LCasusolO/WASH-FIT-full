const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
function result(domain, scores, info = {}) {
  return Core.calculateJmp({ ...Core.defaults(), ...info }, Object.entries(scores).map(([code, score]) => ({ code, score })))[domain].status;
}
const pairExpected = (a, b) => a >= 1 && b >= 1 ? 'Básico' : a === 0 && b === 0 ? 'Sin Servicio' : 'Limitado';

test('water matches all 27 score combinations across the three facility levels', () => {
  for (const [level, code] of [['Primer Nivel', 'A_1a'], ['Segundo Nivel', 'A_1b'], ['Tercer Nivel', 'A_1b']]) {
    for (let source = 0; source <= 2; source++) for (let available = 0; available <= 2; available++) {
      const scores = { [code]: source, [code === 'A_1a' ? 'A_1b' : 'A_1a']: 2 - source, A_3: available };
      assert.equal(result('water', scores, { level }), source === 0 ? 'Sin Servicio' : available >= 1 ? 'Básico' : 'Limitado', JSON.stringify({ level, scores }));
    }
  }
});

test('sanitation matches all 729 combinations, excluding S_3', () => {
  const codes = ['S_1', 'S_2', 'S_4', 'S_5', 'S_6', 'S_7'];
  for (let combination = 0; combination < 729; combination++) {
    let value = combination;
    const scores = Object.fromEntries(codes.map(code => { const score = value % 3; value = Math.floor(value / 3); return [code, score]; }));
    const expected = scores.S_1 === 0 || scores.S_2 === 0 ? 'Sin Servicio' : Object.values(scores).every(score => score >= 1) ? 'Básico' : 'Limitado';
    assert.equal(result('sanitation', { ...scores, S_3: 0 }), expected, JSON.stringify(scores));
  }
});

test('waste, hand hygiene and cleaning match every pair of scores', () => {
  for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) {
    for (const [route, code] of [['onsite', 'RES_10'], ['external', 'RES_12']]) {
      assert.equal(result('waste', { RES_2: a, [code]: b }, { wasteTreatmentRoute: route }), pairExpected(a, b));
      assert.equal(result('waste', { RES_2: a, [code]: b }), pairExpected(a, b));
    }
    assert.equal(result('hygiene', { H_1: a, S_3: b, H_2: 2 }), pairExpected(a, b));
    const cleaning = a >= 1 && b === 2 ? 'Básico' : a === 0 && b === 0 ? 'Sin Servicio' : 'Limitado';
    assert.equal(result('cleaning', { L_1: a, L_5: b }), cleaning);
  }
});

test('unanswered values remain unassessed or incomplete unless a decisive no-service answer exists', () => {
  for (const domain of ['water', 'sanitation', 'waste', 'hygiene', 'cleaning']) assert.equal(result(domain, {}), 'Sin evaluar');
  for (const [domain, scores] of [['water', { A_1a: 1 }], ['water', { A_3: 0 }], ['sanitation', { S_1: 1, S_2: 1 }], ['waste', { RES_2: 0 }], ['hygiene', { H_1: 0 }], ['cleaning', { L_1: 0 }]]) assert.equal(result(domain, scores), 'Evaluación incompleta');
  assert.equal(result('water', { A_1a: 0 }), 'Sin Servicio');
  assert.equal(result('sanitation', { S_1: 0 }), 'Sin Servicio');
  assert.equal(result('sanitation', { S_2: 0 }), 'Sin Servicio');
});

test('waste respects an explicit route and uses both evaluated treatments when no route is selected', () => {
  const scores = { RES_2: 1, RES_10: 0, RES_12: 2, RES_11: 0, RES_13: 0 };
  assert.equal(result('waste', scores, { wasteTreatmentRoute: 'external' }), 'Básico');
  assert.equal(result('waste', scores, { wasteTreatmentRoute: 'onsite' }), 'Limitado');
  assert.equal(result('waste', scores), 'Limitado');
  assert.equal(result('waste', { RES_2: 2, RES_12: 2 }, { wasteTreatmentRoute: 'onsite' }), 'Evaluación incompleta');
});
