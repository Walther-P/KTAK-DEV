import {escapeHtml, finite, validPoint} from './core.js?v=0.4.0';

// Official schema: https://developers.google.com/maps/documentation/javascript/reference/route
const point = value => {
  const p = {lat: typeof value?.lat === 'function' ? value.lat() : value?.lat, lng: typeof value?.lng === 'function' ? value.lng() : value?.lng};
  return validPoint(p) ? p : null;
};
const pathOf = values => (values || []).map(point).filter(Boolean);
const numeric = value => finite(value) && value >= 0 ? value : null;
const distance = meters => { const value = numeric(meters); return {value, text: value === null ? '—' : value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`}; };
const duration = millis => {
  const ms = numeric(millis), value = ms === null ? null : ms / 1000;
  if (value === null) return {value, text: '—'};
  const minutes = Math.ceil(value / 60);
  return {value, text: minutes < 60 ? `${minutes} 分鐘` : `${Math.floor(minutes / 60)} 小時${minutes % 60 ? ` ${minutes % 60} 分鐘` : ''}`};
};

export async function computeModernRoute(origin, destination) {
  const {Route} = await google.maps.importLibrary('routes');
  if (!Route?.computeRoutes) throw new Error('Modern Routes class unavailable');
  const response = await Route.computeRoutes({origin, destination, travelMode: 'DRIVING', routingPreference: 'TRAFFIC_UNAWARE', language: 'zh-TW', computeAlternativeRoutes: true,
    fields: ['legs', 'path', 'durationMillis', 'distanceMeters', 'description', 'warnings', 'viewport']});
  if (!response.routes?.length) throw new Error('ZERO_RESULTS');
  return {routes: response.routes.map(route => {
    if (!route.legs?.length) throw new Error('Route legs unavailable');
    return {summary: route.description || '', copyrights: 'Google Maps · Routes（不含即時路況）', warnings: route.warnings || [], modern: route,
      legs: route.legs.map(leg => ({distance: distance(leg.distanceMeters), duration: duration(leg.durationMillis),
        start_location: point(leg.startLocation), end_location: point(leg.endLocation),
        steps: (leg.steps || []).map(step => ({instructions: escapeHtml(step.instructions || ''),
          maneuver: step.maneuver ? step.maneuver.toLowerCase().replaceAll('_', '-') : null,
          path: pathOf(step.path), start_location: point(step.startLocation), end_location: point(step.endLocation),
          distance: distance(step.distanceMeters), duration: duration(step.staticDurationMillis)}))}))};
  })};
}

export function createModernRenderer(initialMap) {
  let map = initialMap, directions = null, index = 0, overlays = [];
  function clear() { for (const overlay of overlays) overlay.setMap(null); overlays = []; }
  function draw() {
    clear();
    const route = directions?.routes?.[index];
    if (!map || !route) return;
    const modern = route.modern;
    let path = pathOf(modern?.path);
    if (!path.length) path = route.legs.flatMap(leg => leg.steps.flatMap(step => pathOf(step.path)));
    if (path.length < 2) return;
    overlays.push(new google.maps.Polyline({map, path, strokeColor: '#a9bfd3', strokeWeight: 6, strokeOpacity: .9}));
    overlays.push(new google.maps.Marker({map, position: point(route.legs[0]?.start_location) || path[0], label: 'A', title: '出發地'}));
    overlays.push(new google.maps.Marker({map, position: point(route.legs.at(-1)?.end_location) || path.at(-1), label: 'B', title: '目的地'}));
    if (modern?.viewport) map.fitBounds(modern.viewport);
    else { const bounds = new google.maps.LatLngBounds(); for (const p of path) bounds.extend(p); map.fitBounds(bounds); }
  }
  return {setMap(value) { map = value; draw(); }, setDirections(value) { directions = value; index = 0; draw(); }, setRouteIndex(value) { if (!Number.isInteger(value) || value < 0 || value >= (directions?.routes?.length || 0)) return; index = value; draw(); }};
}
