import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrive} from '../drive.js';

function setup(t) {
  const elements = new Map(), events = new Map(), watches = new Map(), cleared = [], timers = new Map(), requests = [], alerts = [], vibrations = [], markers = [];
  let watchId = 0, timerId = 0, now = 1_800_000_000_000;
  const classes = () => { const values = new Set(); return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) }; };
  const element = id => { if (!elements.has(id)) elements.set(id, { textContent: '', classList: classes(), focus() {} }); return elements.get(id); };
  const document = { hidden: false, body: {classList: classes()}, getElementById: element, addEventListener: (name, handler) => events.set(name, handler) };
  const map = {panTo() {}, setZoom() {}};
  const globals = {
    document,
    navigator: {
      geolocation: {watchPosition(success, error) { const id = ++watchId; watches.set(id, {success, error}); return id; }, clearWatch: id => cleared.push(id)},
      wakeLock: {request() { return new Promise(resolve => requests.push(resolve)); }},
      vibrate: pattern => vibrations.push(pattern),
    },
    google: {maps: {SymbolPath: {CIRCLE: 0}, Marker: class { constructor() { markers.push(this); } setMap(value) { this.map = value; } setPosition(value) { this.position = value; } }}},
    fetch: async () => ({ok: true, json: async () => ({provider: 'test', fetchedAt: new Date(now).toISOString(), lastUpdated: null, points: [{id: 'north', lat: 25.002, lng: 121, kind: 'fixed-speed', name: 'test camera', directionText: '南往北', speedLimit: 50}]})}),
    setInterval: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id),
  };
  for (const [name, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {value, configurable: true, writable: true});
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; });
  }
  t.mock.method(Date, 'now', () => now);
  const drive = createDrive({map: () => map, stripHtml: value => value, closePanel() {}, unlockAudio() {}, notify: message => alerts.push(message)});
  return {drive, element, document, watches, cleared, requests, alerts, vibrations, markers, timers,
    fix: (changes = {}) => ({timestamp: now, coords: {latitude: 25, longitude: 121, heading: 0, speed: 10, accuracy: 5, ...changes}}),
    tick(ms) { now += ms; for (const callback of timers.values()) callback(); },
    visibility(hidden) { document.hidden = hidden; events.get('visibilitychange')(); },
  };
}

function assertCleared(h) {
  for (const id of ['driveSpeed', 'driveDistance', 'driveEta', 'driveRemaining', 'drivePointLimit']) assert.equal(h.element(id).textContent, '—', id);
  assert.equal(h.element('driveEnforcement').textContent, '等待可靠定位與行進方向');
  assert.equal(h.markers.at(-1)?.map, null);
}

test('inaccurate GPS and geolocation errors clear an existing speed, point limit and marker', async t => {
  const h = setup(t);
  await h.drive.start(null, {awake: false});
  const watch = h.watches.get(1);
  watch.success(h.fix());
  assert.equal(h.element('drivePointLimit').textContent, '50 km/h');
  assert.equal(h.alerts.length, 1);
  watch.success(h.fix({accuracy: 80}));
  assertCleared(h);
  assert.match(h.element('driveInstruction').textContent, /精度不足/);
  watch.success(h.fix());
  watch.error({code: 1});
  assertCleared(h);
  assert.match(h.element('driveInstruction').textContent, /定位權限/);
  assert.equal(h.alerts.length, 1);
  h.drive.stop();
});

test('expired incoming fixes and silence timeout clear the HUD without emitting alerts', async t => {
  const h = setup(t);
  await h.drive.start(null, {awake: false});
  const watch = h.watches.get(1);
  watch.success(h.fix());
  const old = h.fix();
  h.tick(16_000);
  assertCleared(h);
  assert.match(h.element('driveInstruction').textContent, /已過期/);
  watch.success(old);
  assertCleared(h);
  assert.equal(h.alerts.length, 1);
  assert.equal(h.vibrations.length, 1);
  h.drive.stop();
  assert.equal(h.timers.size, 0);
});

test('background pauses the watch and ignores late callbacks across resume and stop', async t => {
  const h = setup(t);
  await h.drive.start(null, {awake: false});
  const oldWatch = h.watches.get(1);
  oldWatch.success(h.fix());
  h.visibility(true);
  assert.deepEqual(h.cleared, [1]);
  assertCleared(h);
  oldWatch.success(h.fix());
  assertCleared(h);
  h.visibility(false);
  assert.equal(h.watches.size, 2);
  oldWatch.success(h.fix());
  oldWatch.error({code: 1});
  assertCleared(h);
  h.watches.get(2).success(h.fix());
  assert.equal(h.element('driveSpeed').textContent, 36);
  h.drive.stop();
  assert.deepEqual(h.cleared, [1, 2]);
  h.watches.get(2).success(h.fix());
  assertCleared(h);
  assert.equal(h.drive.active, false);
  assert.equal(h.element('drivePanel').classList.contains('hidden'), true);
});

test('a pending wake lock from a stopped session is released after a fast restart', async t => {
  const h = setup(t);
  const lock = () => ({releases: 0, release() { this.releases++; return Promise.resolve(); }, addEventListener() {}});
  await h.drive.start(null, {awake: true});
  assert.equal(h.requests.length, 1);
  h.drive.stop();
  await h.drive.start(null, {awake: true});
  assert.equal(h.requests.length, 2);
  const current = lock(), obsolete = lock();
  h.requests[1](current);
  await Promise.resolve();
  h.requests[0](obsolete);
  await Promise.resolve();
  assert.equal(obsolete.releases, 1);
  assert.equal(current.releases, 0);
  h.drive.stop();
  assert.equal(current.releases, 1);
  assert.equal(obsolete.releases, 1);
});
