const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('worker serves its exact resource version and leaves other revisions to the network', async () => {
  const listeners = {};
  const requested = [];
  const scope = 'https://wash.example/';
  vm.runInNewContext(fs.readFileSync('scripts/sw-template.js', 'utf8'), {
    URL, CACHE: 'wash-fit-current', ASSETS: ['./', './js/app.js?v=current'],
    self: {location: {origin: 'https://wash.example'}, registration: {scope}, addEventListener: (name, fn) => { listeners[name] = fn; }},
    caches: {open: async () => ({match: async request => { requested.push(request.url); return 'current-resource'; }})},
    fetch: async () => { throw new Error('Unexpected network request'); }
  });
  let response;
  const request = url => listeners.fetch({request: {method: 'GET', url}, respondWith: promise => { response = promise; }});
  request(scope + 'js/app.js?v=current');
  assert.equal(await response, 'current-resource');
  assert.deepEqual(requested, [scope + 'js/app.js?v=current']);
  for (const path of ['js/app.js?v=previous', 'js/app.js', '?verify=current']) {
    response = undefined;
    request(scope + path);
    assert.equal(response, undefined, 'A different resource revision must not use this cache');
  }
});
