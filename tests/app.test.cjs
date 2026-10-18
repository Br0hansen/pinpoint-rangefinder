const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function app(mediaDevices = {}) {
  const elements = new Map();
  const alerts = [];
  const draw = new Proxy({}, { get: () => () => {} });
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      classList: { toggle() {} }, lastElementChild: {}, value: '30',
      addEventListener() {}, setAttribute() {}, getContext: () => draw,
      clientWidth: 320, clientHeight: 400, videoWidth: 1920, videoHeight: 1080, readyState: 2,
      play: async () => {},
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element, createElement: () => ({ getContext: () => draw }) },
    window: { devicePixelRatio: 1, addEventListener() {} },
    navigator: { mediaDevices }, location: { protocol: 'http:' },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame() {}, alert: text => alerts.push(text), confirm: () => true,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  return { run: code => vm.runInContext(code, context), element, alerts, context };
}

test('one pending camera request; late stream is stopped after leaving page', async () => {
  let resolve, requests = 0, stopped = 0;
  const a = app({ getUserMedia: () => { requests++; return new Promise(r => { resolve = r; }); } });
  const first = a.run('startCamera()');
  await a.run('startCamera()');
  assert.equal(requests, 1);
  assert.equal(a.element('captureButton').disabled, true);
  a.run('stopCamera()');
  resolve({ getTracks: () => [{ stop: () => { stopped++; } }] });
  await first;
  assert.equal(stopped, 1);
  assert.equal(a.run('state.stream'), null);
  assert.equal(a.element('captureButton').disabled, false);
});

test('camera refusal allows retry', async () => {
  const a = app({ getUserMedia: async () => { throw { name: 'NotAllowedError' }; } });
  await a.run('startCamera()');
  assert.equal(a.element('captureButton').disabled, false);
  assert.match(a.alerts[0], /ikke tillatt/);
});

test('successful camera startup and capture refresh camera metadata', async () => {
  let zoom = 1, stopped = 0;
  const track = { getSettings: () => ({ deviceId: 'rear', zoom }), addEventListener() {}, stop: () => { stopped++; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const a = app({ getUserMedia: async () => stream });
  await a.run('startCamera()');
  assert.equal(a.run('state.stream'), stream);
  zoom = 2;
  a.run('capture()');
  assert.equal(a.run('state.meta.zoom'), 2);
  a.run('stopCamera()');
  assert.equal(stopped, 1);
});

function measurement(a) {
  a.run(`state.mode = 'measure';
    state.frozen = { width: 1920, height: 1080 };
    state.points = [{ x: 100, y: 100 }, { x: 100, y: 154 }];
    state.meta = { deviceId: 'rear', zoom: 1 };
    state.calibration = { distance: 30, relativeHeight: 0.2, aspect: 1920/1080, camera: { deviceId: 'rear', zoom: 1 } };`);
}

test('quarter reference image size gives four times the distance', () => {
  const a = app(); measurement(a); a.run('measureOrSave()');
  assert.equal(a.run('state.lastEstimate.distance'), 120);
});

for (const [reason, change] of [
  ['camera', "state.meta.deviceId = 'front'"],
  ['zoom', 'state.meta.zoom = 2'],
  ['missing zoom', 'state.meta.zoom = null'],
  ['aspect', 'state.frozen.width = 1080; state.frozen.height = 1920'],
]) test(`reject changed ${reason} rather than display misleading distance`, () => {
  const a = app(); measurement(a); a.run(change); a.run('measureOrSave()');
  assert.equal(a.run('state.lastEstimate'), null);
  assert.match(a.alerts[0], /Kalibrer på nytt/);
});

test('service worker keeps other applications caches', async () => {
  const listeners = {};
  const removed = [];
  const scope = 'https://example.github.io/pinpoint-rangefinder/';
  const ownPrefix = 'pinpoint:' + scope;
  const context = vm.createContext({
    self: { registration: { scope }, addEventListener: (name, callback) => { listeners[name] = callback; }, clients: { claim() {} } },
    caches: { keys: async () => ['another-app', ownPrefix + ':v010', ownPrefix + ':v011'], delete: async key => { removed.push(key); } },
    URL,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), context);
  let completed;
  listeners.activate({ waitUntil: task => { completed = task; } });
  await completed;
  assert.deepEqual(removed, [ownPrefix + ':v010']);
  let intercepted = false;
  listeners.fetch({ request: { method: 'GET', url: 'https://example.github.io/another-app/' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
