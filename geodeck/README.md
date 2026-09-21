# GeoDeck 0.5.0 — foreground Drive Mode and parking checkpoint

## 0.5.0 basic-use repair checkpoint

Resumed clean ab762539c4ee9e161b787d9bea011e528616a518. Nearby now uses Places New and explicitly distinguishes service failure from successful empty results. Default center is current GPS, with selected-point/map-center choices and stale-request suppression. Routes have an explicit current-location origin, map-picked endpoints and saved endpoint selectors. Search/route fields use debounced Places New suggestions with session tokens; selected coordinates bypass geocoding. Place resolution and routing errors are separated. 44 tests pass.

Direct official REST diagnostics using the existing public browser key and public Tainan coordinates returned:
- Routes: HTTP 403 PERMISSION_DENIED / API_KEY_SERVICE_BLOCKED for routes.googleapis.com.
- Places New: HTTP 403 PERMISSION_DENIED / SERVICE_DISABLED for places.googleapis.com in project 260981316953.
- Existing browser Geocoding reports API not activated; legacy Directions reports legacy API not enabled. Modern RPC's generic XHR error alone previously concealed the service restriction.

Google Cloud owner action: enable Places API (New), Routes API and Geocoding API in the key's project; under the existing key's API restrictions allow these APIs plus Maps JavaScript API. Keep Website/HTTP-referrer restrictions for https://walther-p.github.io/*; do not make the key unrestricted. Check project billing and quotas if enablement is refused. Re-test names, Nearby and routing after propagation. No account settings or keys were changed by this release.

Status: Nearby Search PARTIAL, Geocoding PARTIAL, Current Location origin PARTIAL (device GPS permission required), In-map Routing BLOCKED, Taiwan Parking PARTIAL, Tainan Parking NOT STARTED, Prepare to Park NOT STARTED, Road Speed Limit BLOCKED, Section Average Speed NOT STARTED, Enforcement Classification PARTIAL, CCTV Coverage/FOV PARTIAL (nearby coordinates only), Route Weather NOT STARTED, Route Risk NOT STARTED, Lane Guidance BLOCKED (schema/UI only). Background/lock-screen navigation NATIVE ONLY. Phase 1 is not complete.

Next: integrate verified Tainan official feed behind extensible Taiwan parking routing, retain Taipei; verify East and West Central districts. Rollback: ab762539c4ee9e161b787d9bea011e528616a518. Revert release commits; never reset unrelated work.

Test on iPhone Safari: https://walther-p.github.io/KTAK-DEV/geodeck/

## This release

- Charcoal/slate/blue-gray controls, route line and PWA icons replace the lime accent. Existing search, favorites, weather, radar, CCTV, transit and maps remain.
- 1,895 official NPA enforcement points, bundled as a dated snapshot. Coordinates, original direction, point speed limit, provider and source are retained. Official record update time is unknown; acquisition time never claims to be a live update. Snapshots older than 30 days show STALE. See [data provenance and refresh](data/ENFORCEMENT.md).
- Settings offer 300/500/800/1000 m enforcement range, speech and device-supported vibration. Candidates use foreground GPS, heading, travel direction when explicit, and route geometry when available. Same point has a ten-minute reminder cooldown. Accuracy worse than 30 m, stale fixes, missing direction of travel, low speed, background or off-route state suppress enforcement reminders.
- Drive Mode shows the next maneuver/distance, estimated arrival/remaining distance, GPS speed, next enforcement candidate and its published point speed limit. Other map tools and non-traffic layers are hidden/suspended until exit. Driving first tries the existing Directions service, then the modern Google Routes API when legacy authorization is denied. The modern fallback requests traffic-unaware routes to avoid additional traffic features; Google API authorization/billing still applies. Free driving works without routing entitlement.
- Pure route/enforcement logic and typed provider contracts are separate from the UI. Lane schema includes maneuver, instruction, distanceToManeuver, roadName, exitNumber, junction, fork and lanes with direction[], recommended and active. No lane metadata is fabricated.

## Test on a phone

1. Open the public URL in Safari; in Settings confirm **GeoDeck 0.4.1**, using Check for updates if necessary.
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

- **Enforcement: Partial.** Official 7320 does not identify device function per row. `fixed-speed` is the current schema tag, not proof of hardware type. Separate red-light/technology enforcement classification remains unconnected. New Taipei contributes 25 published section pairs (50 endpoints); other regions and average-speed tracking remain unconnected. Only explicit origin-to-destination direction text is parsed; other descriptions remain unknown. Candidate matching cannot distinguish all parallel/stacked roads, loops, temporary closures or GPS ambiguity. No claim of complete coverage or absence of enforcement.
- **Road speed limit: Provider unavailable.** A camera point limit is not the current road's limit. No automatic road-limit + X warning. Existing manually set speed threshold remains a separate general-map tool.
- **Navigation: Partial.** Foreground geometric route tracking, no automatic rerouting. ETA is proportional to the originally requested route duration, not continuously refreshed traffic. No spoken turn-by-turn. Stop safely and replan after deviating.
- **Lane Guidance: Schema/UI only / Provider unavailable.** Normal maneuvers work when Google returns a route; this Directions adapter supplies no reliable lane metadata, road/exit/junction fields stay null. Native navigation integration remains future work.
- **Parking: Taipei first version.** The dedicated P shortcut queries official Taipei parking metadata and availability within 3 km, using published WGS84 entrances only. Missing/negative counts remain unknown; data over five minutes old shows STALE and marker P ?. Map-position and GPS search work without navigation. No coverage elsewhere is explicit. Prepare-to-park and preserved-destination walking handoff remain next work.
- **CCTV Coverage: Nearby Only.** Existing twipcam coordinate catalog is retained. No reliable heading/FOV, no visibility claims or invented view cones. Coverage metadata contract is reserved.
- **Route Risk / Route Weather: Not connected.** Existing point weather/earthquakes are not route risk or ETA weather analysis. No false all-clear status.
- **PWA:** foreground/screen-on only. Background GPS, lock-screen guidance, continuous navigation and iOS vibration are not guaranteed. Wake Lock is best effort. Internet required for maps/routes and data loading. Service worker caches the versioned shell, never live external APIs; this is not offline Google Maps.
- **Native:** WebView + Maps JavaScript API is not native navigation. Future Map/Routing/Navigation/Location/SpeedLimit/Enforcement/Parking/Camera/Weather/Alert adapters should replace the relevant boundary incrementally, with actual native SDKs for background GPS, lane guidance and CarPlay/Android Auto.

## Checkpoint and rollback

Baseline inspected: `0cbae5c725eef84a1568eddc06b74a416a67b8e1` (GeoDeck 0.2.0); its 8 tests passed and public Pages served 0.2.0 before these changes. No unfinished newer commit existed in the remote checkout. Keep this as the rollback reference. Revert the 0.3.0 release commit to undo this checkpoint without rewriting repository history. The root KTAK application and its configuration are not changed.

## 2026-09-21 resume checkpoint

Remote/local starting commit: `4f9c771ebb896697d56cf7b53ff8cc496d5acaa8`, deployed 0.3.0. No tracked unstaged/staged changes; two unfinished untracked files (`routes-provider.js` and its tests) were preserved and integrated. The parent `KTAK-Native-V3` working tree is a different project and was not overwritten.

0.3.1 connects the pending modern Routes adapter to driving requests after legacy REQUEST_DENIED, including its own map renderer, alternative-route switching, versioned service-worker shell and publication checks. It retains external Google navigation and free driving if the modern API is also unavailable. No Google account permissions or API restrictions were changed.

Public 0.3.0 verification: maps, Drive Mode entry/exit, official snapshot, missing-GPS state and PWA update all worked. The Taipei Station → Taipei 101 coordinate query returned legacy API not enabled; this was a real provider blocker, not a completed navigation test. The new fallback requires fresh public verification after this commit.

Current Phase 1 status:
- Complete checkpoint: gray/slate theme, official enforcement snapshot, conservative heading/ahead candidate filter, GPS speed, foreground Drive Mode, stale snapshot label and GPS expiration handling.
- Partial: driving route integration (provider authorization dependent), device speech/vibration (real iPhone validation pending), generalized freshness (only enforcement is standardized here).
- Schema/UI only: lane guidance; no reliable lane provider.
- Unavailable: current-road speed limits and limit+X alert; camera limits are not road limits. Existing manual-threshold warning remains separate.
- Next priority after 0.4.0: official technology/red-light coverage, improve routing availability, then prepare-to-park destination handoff. Taipei nearby parking and New Taipei section endpoints are now connected.
- Not started: confirmed CCTV heading/FOV coverage (existing cameras are Nearby Only), ETA-aligned route weather and route-specific risk alerts.

Rollback for this small adapter patch: `4f9c771ebb896697d56cf7b53ff8cc496d5acaa8`. Earlier pre-Drive baseline remains `0cbae5c725eef84a1568eddc06b74a416a67b8e1`. Revert the relevant release commit; do not reset unrelated work.


## 0.4.0 second checkpoint

- Integrates official New Taipei section-speed endpoint snapshot with independent provenance/freshness and partial-source failure handling. Endpoint reminders only: no inferred section road geometry, average-speed measurement or fabricated travel direction. See data/SECTIONS.md for actual counts and rejected rows.
- Adds independent nearby-parking shortcut, official Taipei availability, fees/capacity/hours when provided, map markers, GPS/map-position search and destination selection. Static metadata and dynamic response caching preserve official update times; markers age to unknown after five minutes, without background API polling. No nationwide coverage claim.
- Includes modern Routes capability check and failure logging for the unresolved public routing blocker. No Google account changes.
- Preserves both prior shipped checkpoints. Rollback for 0.4.0 is c4e029c2851c46630809503be9add6d34d442dcf (0.3.1).

## 0.4.1 resume handoff

- Resumed from clean 9d69ebd (0.4.0); no pending files were discarded. Public parking results exposed zero-car-capacity lots, now excluded while full lots (zero available spaces) and unknown capacities remain distinct. All 39 Node tests pass.
- Public 0.4.0 checks: Taipei Station parking metadata/markers loaded; stale official availability showed P ?; selecting a parking lot populated the route destination and external Google navigation link correctly. No real-device road drive was performed.
- Public routing remains blocked: legacy Directions reports API not enabled; modern Routes reports an RPC/XHR failure (code 6). Its root cause is not established. Do not claim successful in-map routing or change Google credentials/restrictions without an actual diagnosis.
- Publication verification now waits for exact asset bytes as well as the version, avoiding a premature failure when a same-version patch is still deploying. PWA assets move together to 0.4.1.
- Next work: diagnose routing provider availability, then prepare-to-park destination preservation/walking handoff. Technology/red-light classification, nationwide parking/section coverage, average-speed tracking, road limits, CCTV heading/FOV, Route Weather and Route Risk remain incomplete. Lane Guidance stays schema/UI only; background/lock-screen navigation requires Native integration.
- Rollback for this patch: 9d69ebd7840acf1cea882bdf3e113275b1c7f90a. Rollback before parking/sections: c4e029c2851c46630809503be9add6d34d442dcf. Revert commits rather than resetting unrelated work.
