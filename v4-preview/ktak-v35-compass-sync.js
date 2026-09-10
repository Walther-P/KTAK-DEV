(() => {
  'use strict';

  const core = window.__KTAK35_CORE;
  const applyBearing = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    window.ktak35SetMapBearing?.(((n % 360) + 360) % 360);
    return true;
  };

  function cssRotationDeg(el) {
    if (!el) return null;
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === 'none') return null;
    try {
      const m = new DOMMatrixReadOnly(transform);
      const deg = Math.atan2(m.b, m.a) * 180 / Math.PI;
      return Number.isFinite(deg) && Math.abs(deg) > 0.01 ? deg : null;
    } catch {
      return null;
    }
  }

  function readBearing() {
    const map = core?.map;
    if (!map) return 0;

    try {
      if (typeof map.getBearing === 'function') {
        const v = Number(map.getBearing());
        if (Number.isFinite(v)) return v;
      }
    } catch {}

    for (const v of [map._bearing, map.options?.bearing, map.getContainer?.()?.dataset?.bearing, map.getContainer?.()?.dataset?.mapBearing]) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }

    const container = map.getContainer?.();
    for (const el of [container, container?.querySelector('.leaflet-map-pane')]) {
      const deg = cssRotationDeg(el);
      if (deg != null) return deg;
    }
    return 0;
  }

  let last = null;
  function sync() {
    const bearing = ((Number(readBearing()) || 0) % 360 + 360) % 360;
    if (last == null || Math.abs(bearing - last) > 0.05) {
      last = bearing;
      applyBearing(bearing);
    }
  }

  window.addEventListener('ktak-map-bearing', (event) => {
    const detail = event.detail;
    const bearing = typeof detail === 'number' ? detail : detail?.bearing;
    if (applyBearing(bearing)) last = ((Number(bearing) % 360) + 360) % 360;
  });

  const map = core?.map;
  if (map?.on) {
    ['rotate', 'rotatestart', 'rotateend', 'move', 'moveend', 'zoom', 'zoomend'].forEach((name) => map.on(name, sync));
  }

  const container = map?.getContainer?.();
  if (container && window.MutationObserver) {
    new MutationObserver(sync).observe(container, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-bearing', 'data-map-bearing'],
      subtree: true,
    });
  }

  screen.orientation?.addEventListener?.('change', sync);
  window.addEventListener('orientationchange', sync);
  window.addEventListener('resize', sync);

  sync();
  setInterval(sync, 500);
  window.__KTAK35_COMPASS_SYNC = { sync, readBearing };
})();
