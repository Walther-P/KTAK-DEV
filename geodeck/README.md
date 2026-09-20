# GeoDeck 0.2.0

Phone-first information map at https://walther-p.github.io/KTAK-DEV/geodeck/ .

## This release

- Dark Google road map, satellite and terrain views; search addresses or coordinates.
- Point weather: next 24 hours, destination timezone, wind, sunrise/sunset and UV; US AQI model estimates with valid times and explicit missing-data states.
- RainViewer observations, playback, radar coverage mask and overzoom beyond source zoom 7.
- NASA GIBS regional infrared clouds (Himawari/GOES); MODIS daily cloud-top temperature for other longitudes. Latest available timestamp comes from provider metadata.
- Taiwan public cameras: lazy-loaded twipcam catalog, clustered markers, one active feed, source link and image failure handling. The bundled compressed catalog is a dated fallback, not a guarantee every camera is online.
- Google traffic and USGS magnitude 2.5+ earthquake records from the past week.
- Favorites with notes, migration from v0.1, local storage and JSON backup/import.
- Driving/walking/transit selection. In-map routes require the existing Google project's Directions API access. If unavailable, users can open the selected provider. NAVER links require NAVER Maps; Amap links use GCJ-02 coordinates.
- Nearby essential facilities using the existing Places service.
- Foreground GPS speed with a user-set threshold. No road-speed-limit or enforcement-camera dataset is connected.
- Scoped PWA shell caching, iOS icons and an update control. External live data and map imagery are never saved by the service worker.

## Validation

`node --test geodeck/tests/*.test.js`

Serve the repository root (not only this directory) for local preview, because the existing public browser Google key is read from `../config.js`. Do not embed private server credentials here. The public browser key should remain restricted to authorized website origins/APIs in its Google project.

## Operational limits

Internet is needed for Google maps, route queries and live data. Offline favorites work after the shell has been saved; this is not offline Google Maps. Browser geolocation does not provide reliable background tracking on iOS. Camera/catalog, radar, satellite and transit coverage differ by region. Weather and air quality are model outputs, not observations at the exact device location. Current Google Maps, weather and data-provider terms, quotas and billing apply.

The original KTAK application, its configuration and its service worker are not modified by this release. Roll back by reverting the GeoDeck release commit. Each page displays its own GeoDeck version in Settings.
