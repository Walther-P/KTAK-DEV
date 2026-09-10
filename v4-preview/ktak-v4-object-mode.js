/* KTAK V4 touch object mode
 * On coarse pointers the build patch makes map panning win by default.
 * Long-press opens the existing object menu; choosing Move arms one drag only.
 */
(() => {
  'use strict';

  const MOVE_CLASS = 'v4-move-armed';
  let armedElement = null;
  let disarmTimer = null;

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function disarm() {
    clearTimeout(disarmTimer);
    if (armedElement?.isConnected) armedElement.classList.remove(MOVE_CLASS);
    armedElement = null;
  }

  function armMove(element) {
    disarm();
    armedElement = element;
    element.classList.add(MOVE_CLASS);
    document.getElementById('mapContextMenu')?.classList.remove('open');
    toast('移動模式：拖曳這個圖樣一次；完成後自動回到拖曳地圖');

    const finish = () => setTimeout(disarm, 80);
    document.addEventListener('pointerup', finish, { once: true, capture: true });
    document.addEventListener('pointercancel', finish, { once: true, capture: true });
    disarmTimer = setTimeout(disarm, 8000);
  }

  function enhanceMenu(element) {
    const menu = document.getElementById('mapContextMenu');
    if (!menu?.classList.contains('open')) return;
    const grid = menu.querySelector('.ctxGrid3');
    if (!grid) return;

    let button = document.getElementById('v4MapMoveObject');
    if (!button) {
      button = document.createElement('button');
      button.id = 'v4MapMoveObject';
      button.type = 'button';
      button.textContent = '✥ 移動一次';
      grid.prepend(button);
    }
    button.onclick = () => armMove(element);
  }

  document.addEventListener('contextmenu', (event) => {
    const map = document.getElementById('map');
    if (!map || !map.contains(event.target)) return;
    const objectElement = event.target.closest?.('.leaflet-marker-icon,.leaflet-interactive,.map-symbol-shell,.photoPin');
    if (!objectElement) return;
    setTimeout(() => enhanceMenu(objectElement), 0);
  }, true);

  window.addEventListener('orientationchange', disarm, { passive: true });
  window.addEventListener('pagehide', disarm, { passive: true });
})();
