const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Exercise the app's module rules without a browser or external CDN dependencies.
function loadApp() {
  let app;
  const context = vm.createContext({
    Vue: {
      ref: value => ({ value }),
      computed: getter => ({ get value() { return getter(); } }),
      onMounted() {},
      nextTick() {},
      watch() {},
      createApp: options => ({ mount() { app = options.setup(); } })
    },
    window: { innerWidth: 1200 },
    navigator: { onLine: true },
    WashStorage: { createStore: () => ({ save: async data => data.savedAt }) },
    setTimeout() {},
    clearTimeout() {},
    Date,
    Intl,
    FileReader: class {
      readAsText(file) { return this.onload({ target: { result: file.text } }); }
    }
  });
  for (const file of ['js/core.js', 'js/data/indicators.js', 'js/app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  return app;
}

test('all indicators belong to a stable module, and module totals match the global total', () => {
  const app = loadApp();
  const ids = new Set(app.modulesList.map(mod => mod.id));
  assert.equal(app.indicators.value.length, 99);
  assert.ok(app.indicators.value.every(ind => ids.has(ind.moduleId)));
  assert.equal(app.modulesList.reduce((sum, mod) => sum + app.getModuleTotalCount(mod.id), 0), app.totalVisibleIndicators.value);
  app.activeModuleTab.value = 'waste';
  assert.equal(app.getFilteredIndicatorsByModule.value.length, 18);
  app.generalInfo.value.level = app.levelOptions[1];
  assert.equal(app.getFilteredIndicatorsByModule.value.length, 20);
});

test('renaming module and indicator labels preserves filtering, progress, scores, radar and reset', () => {
  const app = loadApp();
  app.activeModuleTab.value = 'waste';
  app.modulesList.find(mod => mod.id === 'waste').name = 'Residuos Hospitalarios';
  app.indicators.value.filter(ind => ind.moduleId === 'waste').forEach(ind => { ind.module = 'Nueva etiqueta'; });
  const waste = app.getFilteredIndicatorsByModule.value;
  waste[0].score = 2;
  waste[1].score = 1;
  app.indicators.value.find(ind => ind.moduleId === 'water').score = 2;
  assert.equal(waste.length, 18);
  assert.equal(app.getModuleAnsweredCount('waste'), 2);
  assert.equal(app.getModuleScoreAchieved('waste'), 3);
  assert.equal(app.getModulePercentage('waste'), 75);
  assert.equal(app.getActiveModuleProgressPercentage.value, 11);
  assert.equal(app.radarChartData.value.points[2].pct, 75);
  app.clearCurrentModule();
  assert.equal(app.getModuleAnsweredCount('waste'), 0);
  assert.equal(app.getModuleAnsweredCount('water'), 1);
});

test('legacy JSON with either waste label migrates to the stable ID without losing answers', async () => {
  for (const label of ['Gestión de Residuos', 'Residuos Hospitalarios']) {
    const app = loadApp();
    const data = JSON.parse(JSON.stringify({ generalInfo: app.generalInfo.value, indicators: app.indicators.value }));
    data.indicators.forEach(ind => {
      delete ind.moduleId;
      if (ind.code.startsWith('RES_')) ind.module = label;
    });
    data.indicators.find(ind => ind.code === 'RES_2').score = 2;
    await app.importData({ target: { files: [{ text: JSON.stringify(data) }] } });
    app.activeModuleTab.value = 'waste';
    assert.equal(app.getFilteredIndicatorsByModule.value.length, 18);
    assert.equal(app.getModuleAnsweredCount('waste'), 1);
    assert.ok(app.indicators.value.filter(ind => ind.code.startsWith('RES_')).every(ind => ind.moduleId === 'waste'));
  }
});

test('assessment tabs and summary pass stable IDs to module calculations', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const method of ['getModuleTotalCount', 'getModuleAnsweredCount', 'getModuleScoreAchieved', 'getModulePercentage']) {
    assert.ok(html.includes(`${method}(mod.id)`));
    assert.ok(!html.includes(`${method}(mod.name)`));
  }
});
