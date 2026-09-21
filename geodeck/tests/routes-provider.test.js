import test from 'node:test';
import assert from 'node:assert/strict';
import {computeModernRoute, createModernRenderer} from '../routes-provider.js';

const a = {lat: 25, lng: 121}, b = {lat: 25.01, lng: 121.01};
function mockGoogle(t, maps) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'google');
  Object.defineProperty(globalThis, 'google', {configurable: true, value: {maps}});
  t.after(() => { if (original) Object.defineProperty(globalThis, 'google', original); else delete globalThis.google; });
}

test('modern driving request uses bounded fields and converts documented units and instructions', async t => {
  let request;
  const modern = {description: '測試', warnings: ['warning'], path: [a, b], legs: [{distanceMeters: 1234, durationMillis: 3_661_500, startLocation: a, endLocation: b,
    steps: [{distanceMeters: 800, staticDurationMillis: 61_500, instructions: '右轉 <道路> & 前進', maneuver: 'TURN_RIGHT', path: [{lat: () => 25, lng: () => 121}, b], startLocation: a, endLocation: b}]}]};
  mockGoogle(t, {importLibrary: async name => { assert.equal(name, 'routes'); return {Route: {computeRoutes: async value => {request = value; return {routes: [modern]}; }}}; }});
  const result = await computeModernRoute(a, b), route = result.routes[0], leg = route.legs[0], step = leg.steps[0];
  assert.equal(request.travelMode, 'DRIVING'); assert.equal(request.routingPreference, 'TRAFFIC_UNAWARE'); assert.equal(request.language, 'zh-TW'); assert.equal(request.computeAlternativeRoutes, true);
  assert.deepEqual(request.fields, ['legs', 'path', 'durationMillis', 'distanceMeters', 'description', 'warnings', 'viewport']);
  assert.equal(route.modern, modern); assert.match(route.copyrights, /^Google Maps/); assert.deepEqual(route.warnings, ['warning']);
  assert.deepEqual(leg.distance, {value: 1234, text: '1.2 km'}); assert.deepEqual(leg.duration, {value: 3661.5, text: '1 小時 2 分鐘'});
  assert.deepEqual(step.distance, {value: 800, text: '800 m'}); assert.deepEqual(step.duration, {value: 61.5, text: '2 分鐘'});
  assert.equal(step.instructions, '右轉 &lt;道路&gt; &amp; 前進'); assert.equal(step.maneuver, 'turn-right'); assert.deepEqual(step.path, [a, b]);
});

test('missing or nonfinite durations remain unknown, zero is preserved, and API failures propagate', async t => {
  let reply = {routes: [{legs: [{distanceMeters: 0, durationMillis: 0, steps: [{distanceMeters: Infinity, staticDurationMillis: Infinity}, {}]}]}]};
  mockGoogle(t, {importLibrary: async () => ({Route: {computeRoutes: async () => { if (reply instanceof Error) throw reply; return reply; }}})});
  const leg = (await computeModernRoute(a, b)).routes[0].legs[0];
  assert.deepEqual(leg.distance, {value: 0, text: '0 m'}); assert.deepEqual(leg.duration, {value: 0, text: '0 分鐘'});
  for (const step of leg.steps) { assert.equal(step.distance.value, null); assert.equal(step.duration.value, null); }
  reply = {routes: []}; await assert.rejects(computeModernRoute(a, b), /ZERO_RESULTS/);
  reply = new Error('REQUEST_DENIED'); await assert.rejects(computeModernRoute(a, b), /REQUEST_DENIED/);
});

test('modern renderer switches alternatives and clears every polyline and endpoint marker', t => {
  const created = [], bounds = [], fits = [];
  class Overlay { constructor(options) {Object.assign(this, options); created.push(this); } setMap(value) {this.map = value;} }
  mockGoogle(t, {Polyline: Overlay, Marker: Overlay, LatLngBounds: class {extend(p) {bounds.push(p);}}});
  const map = {fitBounds: value => fits.push(value)}, viewport = {test: true};
  const route = path => ({modern: {path}, legs: [{steps: [], start_location: path[0], end_location: path.at(-1)}]});
  const second = route([b, a]); second.modern.viewport = viewport;
  const renderer = createModernRenderer(map);
  renderer.setDirections({routes: [route([a, b]), second]});
  assert.equal(created.length, 3); assert.deepEqual(bounds, [a, b]); assert.equal(created[1].label, 'A'); assert.equal(created[2].label, 'B');
  renderer.setRouteIndex(1);
  assert.ok(created.slice(0, 3).every(item => item.map === null)); assert.deepEqual(created[3].path, [b, a]); assert.equal(fits.at(-1), viewport);
  renderer.setMap(null); assert.ok(created.every(item => item.map === null));
  renderer.setMap(map); assert.equal(created.length, 9);
  renderer.setDirections(null); assert.ok(created.every(item => item.map === null));
});
