/* KTAK V4 interaction layer
 * Reuses V3.5.11 controls instead of replacing mission/data logic.
 */
(() => {
  'use strict';

  const V4_VERSION = '4.0.0-alpha.1';
  const LONG_PRESS_MS = 560;
  const MOVE_TOLERANCE = 11;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  window.__KTAK_V4 = {
    version: V4_VERSION,
    baseVersion: '3.5.11',
    shell: 'full-screen-long-press',
  };

  let radial = null;
  let picker = null;
  let sheet = null;
  let scrim = null;
  let savedPoint = null;
  let activeSurface = 'briefPage';
  let suppressWorkspaceClickUntil = 0;
  let syntheticPlacement = false;

  const pageMeta = {
    briefPage: ['📋', '任務'],
    mapPage: ['🗺️', '地圖'],
    boardPage: ['🧭', '戰術板'],
    chatPage: ['💬', '聊天'],
  };

  function closeSidebars() {
    $('mapSidebar')?.classList.remove('v4-open');
    $('boardSidebar')?.classList.remove('v4-open');
  }

  function closeTransient() {
    radial?.classList.remove('open');
    picker?.classList.remove('open');
    sheet?.classList.remove('open');
    scrim?.classList.remove('open');
  }

  function openScrim() {
    scrim?.classList.add('open');
  }

  function safePoint(clientX, clientY, radius = 118) {
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth;
    const vh = vv?.height || window.innerHeight;
    return {
      x: Math.max(radius, Math.min(vw - radius, clientX)),
      y: Math.max(radius + 4, Math.min(vh - radius - 8, clientY)),
      rawX: clientX,
      rawY: clientY,
    };
  }

  function navTo(pageId) {
    const original = document.querySelector(`.navBtn[data-page="${pageId}"]`);
    if (!original) return;
    original.click();
    closeSidebars();
    closeTransient();
    setTimeout(syncActivePage, 0);
  }

  function syncActivePage() {
    const page = document.querySelector('.page.active');
    if (page?.id) activeSurface = page.id;
    $$('.v4Dock button[data-v4-page]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.v4Page === activeSurface);
    });
  }

  function buildDock() {
    const dock = document.createElement('div');
    dock.className = 'v4Dock';
    dock.setAttribute('aria-label', 'KTAK V4 主選單');

    Object.entries(pageMeta).forEach(([pageId, [icon, label]]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.v4Page = pageId;
      button.innerHTML = `<span class="v4Icon">${icon}</span><span>${label}</span>`;
      button.addEventListener('click', () => navTo(pageId));
      dock.append(button);
    });

    const more = document.createElement('button');
    more.type = 'button';
    more.id = 'v4MoreBtn';
    more.innerHTML = '<span class="v4Icon">•••</span><span>更多</span>';
    more.addEventListener('click', openMoreSheet);
    dock.append(more);

    document.body.append(dock);
  }

  function buildOverlays() {
    scrim = document.createElement('div');
    scrim.className = 'v4Scrim';
    scrim.addEventListener('click', () => {
      closeTransient();
      closeSidebars();
    });

    radial = document.createElement('div');
    radial.className = 'v4Radial';
    radial.setAttribute('role', 'menu');

    picker = document.createElement('div');
    picker.className = 'v4Picker';

    sheet = document.createElement('div');
    sheet.className = 'v4Sheet';

    document.body.append(scrim, radial, picker, sheet);
  }

  function openMoreSheet() {
    closeTransient();
    const currentTools = activeSurface === 'mapPage'
      ? '<button type="button" data-v4-action="mapTools">🧰 地圖工具</button>'
      : activeSurface === 'boardPage'
        ? '<button type="button" data-v4-action="boardTools">🧰 戰術板工具</button>'
        : '';

    const permissionVisible = !$('permissionTab')?.classList.contains('hidden');
    sheet.innerHTML = `
      <div class="v4PickerHead">
        <div class="v4PickerTitle">更多</div>
        <button type="button" class="v4PickerClose" data-v4-action="close">×</button>
      </div>
      <div class="v4SheetGrid">
        ${currentTools}
        <button type="button" data-v4-action="briefQuick">📋 任務簡報</button>
        ${permissionVisible ? '<button type="button" data-v4-action="permission">🔐 權限 / 成員</button>' : ''}
        <button type="button" data-v4-action="leave">↩ 離開房間</button>
      </div>
      <div class="v4Hint">地圖與戰術板的主要操作以「長按工作區」為主，這裡只保留備援入口。</div>`;

    sheet.querySelector('[data-v4-action="close"]')?.addEventListener('click', closeTransient);
    sheet.querySelector('[data-v4-action="mapTools"]')?.addEventListener('click', () => openSidebar('map'));
    sheet.querySelector('[data-v4-action="boardTools"]')?.addEventListener('click', () => openSidebar('board'));
    sheet.querySelector('[data-v4-action="briefQuick"]')?.addEventListener('click', () => navTo('briefPage'));
    sheet.querySelector('[data-v4-action="permission"]')?.addEventListener('click', () => navTo('permissionPage'));
    sheet.querySelector('[data-v4-action="leave"]')?.addEventListener('click', () => {
      closeTransient();
      $('leaveBtn')?.click();
    });
    sheet.classList.add('open');
    openScrim();
  }

  function openSidebar(kind, focusSelector = '') {
    closeTransient();
    closeSidebars();
    const sidebar = kind === 'map' ? $('mapSidebar') : $('boardSidebar');
    if (!sidebar) return;
    sidebar.classList.add('v4-open');
    openScrim();
    if (focusSelector) {
      requestAnimationFrame(() => {
        sidebar.querySelector(focusSelector)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function radialButton(icon, label, action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'v4RadialAction';
    btn.innerHTML = `<span class="v4Icon">${icon}</span><span>${label}</span>`;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
    return btn;
  }

  function showRadial(surface, clientX, clientY) {
    closeTransient();
    savedPoint = safePoint(clientX, clientY);
    radial.innerHTML = '';

    const center = document.createElement('div');
    center.className = 'v4RadialCenter';
    center.textContent = '取消';
    center.addEventListener('click', closeTransient);
    radial.append(center);

    if (surface === 'map') {
      radial.append(
        radialButton('◉', '圖樣', () => openTacticalPicker('map')),
        radialButton('✎', '繪圖', () => openToolPicker('map')),
        radialButton('📷', '照片', () => choosePhotoAtSavedPoint()),
        radialButton('🎯', '定位', () => {
          closeTransient();
          $('locationCenterBtn')?.click();
        }),
        radialButton('☰', '工具', () => openSidebar('map')),
      );
    } else {
      radial.append(
        radialButton('◉', '圖樣', () => openTacticalPicker('board')),
        radialButton('✎', '畫筆', () => openToolPicker('board')),
        radialButton('▤', '樓層', () => openSidebar('board', '.floorControls')),
        radialButton('↶', '復原', () => {
          closeTransient();
          $('boardUndoBtn')?.click();
        }),
        radialButton('☰', '工具', () => openSidebar('board')),
      );
    }

    radial.style.left = `${savedPoint.x}px`;
    radial.style.top = `${savedPoint.y}px`;
    radial.classList.add('open');
    openScrim();
  }

  function pickerHead(title) {
    const head = document.createElement('div');
    head.className = 'v4PickerHead';
    head.innerHTML = `<div class="v4PickerTitle">${title}</div><button type="button" class="v4PickerClose">×</button>`;
    head.querySelector('button').addEventListener('click', closeTransient);
    return head;
  }

  function openTacticalPicker(surface) {
    radial?.classList.remove('open');
    picker.innerHTML = '';
    picker.append(pickerHead(surface === 'map' ? '選擇地圖圖樣' : '選擇戰術板圖樣'));

    const grid = document.createElement('div');
    grid.className = 'v4PickerGrid';
    const sourceId = surface === 'map' ? 'mapTacticalList' : 'boardTacticalList';
    const originals = $$(`#${sourceId} .tacticalPickBtn`);

    originals.forEach((original) => {
      const clone = document.createElement('button');
      clone.type = 'button';
      clone.innerHTML = original.innerHTML;
      clone.setAttribute('aria-label', original.textContent.trim() || '戰術圖樣');
      clone.addEventListener('click', () => {
        original.click();
        closeTransient();
        closeSidebars();
        setTimeout(() => placeAtSavedPoint(surface), 30);
      });
      grid.append(clone);
    });

    if (!originals.length) {
      const empty = document.createElement('div');
      empty.className = 'v4Hint';
      empty.textContent = '圖樣庫尚未就緒，請稍後再試。';
      picker.append(empty);
    } else {
      picker.append(grid);
    }
    picker.classList.add('open');
    openScrim();
  }

  function openToolPicker(surface) {
    radial?.classList.remove('open');
    picker.innerHTML = '';
    picker.append(pickerHead(surface === 'map' ? '選擇繪圖工具' : '選擇畫筆 / 物件'));

    const grid = document.createElement('div');
    grid.className = 'v4PickerGrid';
    const originals = surface === 'map' ? $$('.mapTool') : $$('.boardTool');

    originals.forEach((original) => {
      const clone = document.createElement('button');
      clone.type = 'button';
      clone.textContent = original.textContent.trim();
      clone.disabled = original.classList.contains('disabled') || original.disabled;
      clone.addEventListener('click', () => {
        original.click();
        closeTransient();
        closeSidebars();
      });
      grid.append(clone);
    });

    picker.append(grid);
    const hint = document.createElement('div');
    hint.className = 'v4Hint';
    hint.textContent = surface === 'map'
      ? '選定後選單立即收起，直接在地圖上操作。'
      : '選定後選單立即收起，直接在戰術板上操作。';
    picker.append(hint);
    picker.classList.add('open');
    openScrim();
  }

  function choosePhotoAtSavedPoint() {
    radial?.classList.remove('open');
    const input = $('photoInput');
    if (!input || input.classList.contains('disabled')) {
      closeTransient();
      return;
    }

    const onChange = () => {
      if (!input.files?.length) return;
      setTimeout(() => {
        $('photoPlaceBtn')?.click();
        closeTransient();
        closeSidebars();
        setTimeout(() => placeAtSavedPoint('map'), 30);
      }, 0);
    };
    input.addEventListener('change', onChange, { once: true });
    closeTransient();
    input.click();
  }

  function placeAtSavedPoint(surface) {
    if (!savedPoint) return;
    const target = surface === 'map' ? $('map') : $('boardCanvas');
    if (!target) return;
    syntheticPlacement = true;
    suppressWorkspaceClickUntil = 0;
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: savedPoint.rawX,
      clientY: savedPoint.rawY,
      view: window,
    }));
    setTimeout(() => { syntheticPlacement = false; }, 0);
  }

  function isMapObjectTarget(target) {
    return !!target?.closest?.('.leaflet-marker-icon,.leaflet-interactive,.map-symbol-shell,.photoPin');
  }

  function contextMenuIsOpen() {
    return !!document.querySelector('.contextMenu.open');
  }

  function dispatchContextMenu(target, point) {
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: point.rawX,
      clientY: point.rawY,
      button: 2,
      buttons: 0,
      view: window,
    }));
  }

  function installLongPress(element, surface) {
    if (!element) return;
    element.style.webkitTouchCallout = 'none';
    element.style.userSelect = 'none';

    let press = null;

    const cancel = () => {
      if (press?.timer) clearTimeout(press.timer);
      press = null;
    };

    element.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target?.closest?.('button,input,select,textarea,a')) return;
      cancel();
      const start = { x: event.clientX, y: event.clientY };
      press = {
        pointerId: event.pointerId,
        start,
        target: event.target,
        timer: setTimeout(() => {
          if (!press) return;
          const raw = { rawX: start.x, rawY: start.y };
          suppressWorkspaceClickUntil = Date.now() + 900;

          if (surface === 'map' && isMapObjectTarget(press.target)) {
            dispatchContextMenu(press.target, raw);
            cancel();
            return;
          }

          if (surface === 'board') {
            const canvas = $('boardCanvas');
            if (canvas) {
              dispatchContextMenu(canvas, raw);
              setTimeout(() => {
                if (!contextMenuIsOpen()) showRadial('board', start.x, start.y);
              }, 0);
              cancel();
              return;
            }
          }

          showRadial(surface, start.x, start.y);
          cancel();
        }, LONG_PRESS_MS),
      };
    }, { capture: true, passive: true });

    element.addEventListener('pointermove', (event) => {
      if (!press || event.pointerId !== press.pointerId) return;
      const distance = Math.hypot(event.clientX - press.start.x, event.clientY - press.start.y);
      if (distance > MOVE_TOLERANCE) cancel();
    }, { capture: true, passive: true });

    element.addEventListener('pointerup', cancel, { capture: true, passive: true });
    element.addEventListener('pointercancel', cancel, { capture: true, passive: true });
  }

  function suppressAccidentalMapObjectClicks() {
    const map = $('map');
    if (!map) return;
    map.addEventListener('click', (event) => {
      if (syntheticPlacement) return;
      if (Date.now() < suppressWorkspaceClickUntil || isMapObjectTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function installAutoClose() {
    $('mapTacticalList')?.addEventListener('click', () => setTimeout(() => {
      closeSidebars();
      closeTransient();
    }, 0));
    $('boardTacticalList')?.addEventListener('click', () => setTimeout(() => {
      closeSidebars();
      closeTransient();
    }, 0));

    $$('.mapTool,.boardTool').forEach((button) => {
      button.addEventListener('click', () => setTimeout(() => {
        closeSidebars();
        closeTransient();
      }, 0));
    });

    ['mapShapePlaceBtn', 'boardShapePlaceBtn', 'photoPlaceBtn'].forEach((id) => {
      $(id)?.addEventListener('click', () => setTimeout(() => {
        closeSidebars();
        closeTransient();
      }, 0));
    });
  }

  function installNavigationSync() {
    $$('.navBtn').forEach((btn) => btn.addEventListener('click', () => setTimeout(syncActivePage, 0)));
    const main = document.querySelector('main');
    if (main) {
      const observer = new MutationObserver((records) => {
        if (records.some((r) => r.attributeName === 'class')) syncActivePage();
      });
      $$('.page', main).forEach((page) => observer.observe(page, { attributes: true }));
    }
  }

  function updateBrand() {
    const brand = document.querySelector('.brandText');
    if (!brand) return;
    const title = brand.querySelector('b');
    const subtitle = brand.querySelector('small');
    if (title) title.textContent = 'KTAK V4';
    if (subtitle) subtitle.textContent = `V${V4_VERSION} · Full-screen operational workspace`;
  }

  function handleOrientationChange() {
    closeTransient();
    closeSidebars();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      const activeOriginal = document.querySelector(`.navBtn[data-page="${activeSurface}"]`);
      activeOriginal?.click();
    }, 220);
  }

  function init() {
    if (document.body.classList.contains('ktakV4')) return;
    document.body.classList.add('ktakV4');
    updateBrand();
    buildOverlays();
    buildDock();
    installNavigationSync();
    installAutoClose();
    installLongPress($('map'), 'map');
    installLongPress($('boardCanvas') || $('boardStage'), 'board');
    suppressAccidentalMapObjectClicks();
    syncActivePage();

    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });
    window.addEventListener('pageshow', syncActivePage, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
