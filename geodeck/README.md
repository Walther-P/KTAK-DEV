# GeoDeck 0.3.0 — foreground Drive Mode checkpoint

Test on iPhone Safari: https://walther-p.github.io/KTAK-DEV/geodeck/

## This release

- Charcoal/slate/blue-gray controls, route line and PWA icons replace the lime accent. Existing search, favorites, weather, radar, CCTV, transit and maps remain.
- 1,895 official NPA enforcement points, bundled as a dated snapshot. Coordinates, original direction, point speed limit, provider and source are retained. Official record update time is unknown; acquisition time never claims to be a live update. Snapshots older than 30 days show STALE. See [data provenance and refresh](data/ENFORCEMENT.md).
- Settings offer 300/500/800/1000 m enforcement range, speech and device-supported vibration. Candidates use foreground GPS, heading, travel direction when explicit, and route geometry when available. Same point has a ten-minute reminder cooldown. Accuracy worse than 30 m, stale fixes, missing direction of travel, low speed, background or off-route state suppress enforcement reminders.
- Drive Mode shows the next maneuver/distance, estimated arrival/remaining distance, GPS speed, next enforcement candidate and its published point speed limit. Other map tools and non-traffic layers are hidden/suspended until exit. A route requires the existing Google Directions entitlement; free driving works without a route.
- Pure route/enforcement logic and typed provider contracts are separate from the UI. Lane schema includes maneuver, instruction, distanceToManeuver, roadName, exitNumber, junction, fork and lanes with direction[], recommended and active. No lane metadata is fabricated.

## Test on a phone

1. Open the public URL in Safari; in Settings confirm **GeoDeck 0.3.0**, using Check for updates if necessary.
2. In Settings choose an enforcement distance. Speech follows the saved voice toggle; vibration only works on supporting devices. Distance/vibration save immediately.
3. Choose Routes, driving, origin/destination and Show route, then **開始 Drive Mode**. Alternatively use **自由駕駛 · 測速提醒** without routing.
4. Allow foreground location. Keep the screen on. While stationary or without heading, reminders are paused. Test as a passenger; use road signs for the applicable limit.
5. Exit driving to restore tools/layers. Add to Home Screen from Safari's share menu if desired.

## Validation

Node 20+: `node --test geodeck/tests/*.test.js` from repository root.
`node --check geodeck/app.js`, `node --check geodeck/drive.js`, `node --check geodeck/drive-core.js`, `node --check geodeck/layers.js`, `node --check geodeck/sw.js`.

Tests cover baseline coordinate/navigation/favorite behavior, direction parsing, ahead/behind/opposing/parallel/U-shaped roads, turn boundaries, unknown/stale data, reminder cooldown, GPS and wake-lock lifecycle. Synthetic GPS in unit tests is never shipped as application data. Live iPhone road driving, real-device speech, vibration, and battery behavior are not automated tests.

Serve the repository root for local preview: browser Google configuration is read from `../config.js`. The existing public key may reject localhost; do not loosen its restrictions just to preview. Never embed private server credentials.

## Honest limits and next work

- **Enforcement: Partial.** Official 7320 does not identify device function per row. `fixed-speed` is the current schema tag, not proof of hardware type. Separate red-light/technology enforcement and section-speed endpoints remain unconnected. Only explicit origin-to-destination direction text is parsed; other descriptions remain unknown. Candidate matching cannot distinguish all parallel/stacked roads, loops, temporary closures or GPS ambiguity. No claim of complete coverage or absence of enforcement.
- **Road speed limit: Provider unavailable.** A camera point limit is not the current road's limit. No automatic road-limit + X warning. Existing manually set speed threshold remains a separate general-map tool.
- **Navigation: Partial.** Foreground geometric route tracking, no automatic rerouting. ETA is proportional to the originally requested route duration, not continuously refreshed traffic. No spoken turn-by-turn. Stop safely and replan after deviating.
- **Lane Guidance: Schema/UI only / Provider unavailable.** Normal maneuvers work when Google returns a route; this Directions adapter supplies no reliable lane metadata, road/exit/junction fields stay null. Native navigation integration remains future work.
- **Parking: Not connected.** Existing generic nearby-facility search does not provide official real-time spaces/rates. Nearby parking, prepare-to-park and preserved-destination walking handoff remain next work.
- **CCTV Coverage: Nearby Only.** Existing twipcam coordinate catalog is retained. No reliable heading/FOV, no visibility claims or invented view cones. Coverage metadata contract is reserved.
- **Route Risk / Route Weather: Not connected.** Existing point weather/earthquakes are not route risk or ETA weather analysis. No false all-clear status.
- **PWA:** foreground/screen-on only. Background GPS, lock-screen guidance, continuous navigation and iOS vibration are not guaranteed. Wake Lock is best effort. Internet required for maps/routes and data loading. Service worker caches the versioned shell, never live external APIs; this is not offline Google Maps.
- **Native:** WebView + Maps JavaScript API is not native navigation. Future Map/Routing/Navigation/Location/SpeedLimit/Enforcement/Parking/Camera/Weather/Alert adapters should replace the relevant boundary incrementally, with actual native SDKs for background GPS, lane guidance and CarPlay/Android Auto.

## Checkpoint and rollback

Baseline inspected: `0cbae5c725eef84a1568eddc06b74a416a67b8e1` (GeoDeck 0.2.0); its 8 tests passed and public Pages served 0.2.0 before these changes. No unfinished newer commit existed in the remote checkout. Keep this as the rollback reference. Revert the 0.3.0 release commit to undo this checkpoint without rewriting repository history. The root KTAK application and its configuration are not changed.
