(() => {
  'use strict';

  const core = window.__KTAK35_CORE;
  if (!core) return;

  let fallbackLayer = null;
  let fallbackActive = false;
  let fallbackReason = '';
  let checkTimer = null;

  function badge(text) {
    const el = document.getElementById('mapProviderBadge');
    if (el) el.textContent = text;
  }

  function hideGoogleErrorUi() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    mapEl.classList.add('ktak35-google-failed');
    mapEl.querySelectorAll('.gm-err-container,.gm-err-message,.gm-style').forEach((el) => {
      if (el instanceof HTMLElement) el.style.display = 'none';
    });
  }

  function ensureFallbackLayer() {
    const map = core.map;
    if (!map || !window.L) return null;

    if (!map.getPane('ktak35FallbackTiles')) {
      const pane = map.createPane('ktak35FallbackTiles');
      pane.style.zIndex = '250';
      pane.style.pointerEvents = 'none';
    }

    if (!fallbackLayer) {
      fallbackLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        pane: 'ktak35FallbackTiles',
        crossOrigin: true,
      });
    }
    if (!map.hasLayer(fallbackLayer)) fallbackLayer.addTo(map);
    return fallbackLayer;
  }

  function activateFallback(reason = 'Google Maps 驗證失敗') {
    fallbackReason = reason;
    if (!fallbackActive) {
      fallbackActive = true;
      ensureFallbackLayer();
      hideGoogleErrorUi();
      badge('底圖：OpenStreetMap（Google 驗證失敗）');
      core.toast?.('Google Maps 無法通過驗證，已自動切換 OpenStreetMap');
      console.warn('[KTAK35] Google Maps fallback activated:', reason);
    } else {
      ensureFallbackLayer();
      hideGoogleErrorUi();
    }
    try { core.map?.invalidateSize?.(); } catch {}
  }

  function googleErrorVisible() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return false;
    if (mapEl.querySelector('.gm-err-container,.gm-err-message')) return true;
    const text = mapEl.textContent || '';
    return /出了點狀況|無法正確載入 Google 地圖|can't load Google Maps correctly/i.test(text);
  }

  function inspect() {
    if (fallbackActive) {
      ensureFallbackLayer();
      hideGoogleErrorUi();
      return;
    }
    if (googleErrorVisible()) activateFallback('Google Maps error UI detected');
  }

  // Google Maps JavaScript API invokes this global callback when API-key,
  // referrer, billing, or project authorization fails. Keep any existing hook.
  const previousAuthFailure = window.gm_authFailure;
  window.gm_authFailure = function ktak35GoogleAuthFailure() {
    try { previousAuthFailure?.(); } catch {}
    activateFallback('gm_authFailure');
  };

  const mapEl = document.getElementById('map');
  if (mapEl && window.MutationObserver) {
    new MutationObserver(() => inspect()).observe(mapEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Google error DOM can appear asynchronously after the loader resolves.
  checkTimer = window.setInterval(inspect, 1200);
  window.addEventListener('online', inspect);
  window.addEventListener('pageshow', inspect);
  setTimeout(inspect, 300);

  window.__KTAK35_GOOGLE_FALLBACK = {
    activate: activateFallback,
    inspect,
    get active() { return fallbackActive; },
    get reason() { return fallbackReason; },
    stop() { if (checkTimer) clearInterval(checkTimer); checkTimer = null; },
  };
})();
