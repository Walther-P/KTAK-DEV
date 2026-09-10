(() => {
  'use strict';

  const core = window.__KTAK35_CORE;
  if (!core) return;

  // V3.5 phone layout hotfix. Keep the six primary pages visible without
  // forcing a horizontal strip, and give the room/status header its own row.
  if (!document.getElementById('ktak-v35-mobile-fix-v1')) {
    const style = document.createElement('style');
    style.id = 'ktak-v35-mobile-fix-v1';
    style.textContent = `
      @media (max-width: 600px) {
        header {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: stretch !important;
          gap: 7px !important;
        }
        header .brand { min-width: 0 !important; }
        header .brandText small {
          display: block !important;
          font-size: 9px !important;
          line-height: 1.2 !important;
        }
        header .roomStatus {
          width: 100% !important;
          max-width: 100% !important;
          justify-content: flex-start !important;
          overflow-x: auto !important;
          gap: 6px !important;
          padding-bottom: 1px !important;
          scrollbar-width: none;
        }
        header .roomStatus::-webkit-scrollbar { display: none; }
        nav {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          overflow: visible !important;
          gap: 5px !important;
          padding: 6px !important;
        }
        nav button {
          min-width: 0 !important;
          white-space: nowrap !important;
          font-size: 10px !important;
          padding: 9px 3px !important;
          touch-action: manipulation !important;
        }
        .v35OfflineBanner {
          top: auto !important;
          bottom: calc(12px + var(--safe)) !important;
        }
        .page {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        button, input, textarea, select { touch-action: manipulation; }
      }
    `;
    document.head.append(style);
  }

  function members() {
    return Object.values(core.state?.users || {}).filter((user) => user.approved !== false);
  }

  function metric(value) {
    return Number.isFinite(value) ? `±${Math.round(value)}m` : '—';
  }

  let refreshQueued = false;
  function refreshAccuracyLabels() {
    refreshQueued = false;
    const root = document.getElementById('v35TeamStatusList');
    if (!root) return;
    const rows = [...root.querySelectorAll('.v35StatusRow')];
    const people = members();

    rows.forEach((row, index) => {
      const user = people[index];
      if (!user) return;
      const loc = core.memberLocations?.[user.id];
      const value = row.lastElementChild;
      if (!value) return;

      const horizontal = metric(loc?.accuracyM);
      const vertical = Number.isFinite(loc?.altitudeAccuracyM)
        ? ` · 高度精度 ${metric(loc.altitudeAccuracyM)}`
        : '';
      const next = `水平精度 ${horizontal}${vertical}`;

      // Do not write an identical text node. On Safari, repeatedly mutating a
      // subtree from inside its own MutationObserver can starve the main thread
      // and make the entire UI appear untappable.
      if (value.textContent !== next) value.textContent = next;
    });
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refreshAccuracyLabels);
  }

  const root = document.getElementById('v35TeamStatusList');
  if (root && window.MutationObserver) {
    // The core renderer replaces/adds direct status rows. Watching only direct
    // child changes avoids observing our own accuracy text updates.
    new MutationObserver(queueRefresh).observe(root, {
      childList: true,
      subtree: false,
    });
  }

  window.addEventListener('ktak-location-update', queueRefresh);
  queueRefresh();
  setInterval(queueRefresh, 1500);
  window.__KTAK35_LOCATION_ACCURACY = { refresh: queueRefresh };
})();
