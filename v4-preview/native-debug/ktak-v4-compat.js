/* KTAK V4 compatibility bridge for V3.5.11 UI add-ons. */
(() => {
  'use strict';

  const style=document.createElement('style');
  style.id='ktak-v4-legacy-suppression';
  style.textContent=`
    body.ktakV4 .v3511BoardToolsDock{display:none!important}
    @media (pointer:coarse){body.ktakV4 #boardPage .boardDesktopZoom{display:none!important}}
  `;
  document.head.append(style);

  function closeV4Transient(){
    document.querySelectorAll('.v4Radial.open,.v4Picker.open,.v4Sheet.open,.v4Scrim.open').forEach(el=>el.classList.remove('open'));
  }

  document.addEventListener('click',event=>{
    const quick=event.target?.closest?.('[data-v4-action="briefQuick"]');
    if(quick){
      const legacy=document.getElementById('quickBriefFab');
      if(legacy){
        event.preventDefault();
        event.stopImmediatePropagation();
        closeV4Transient();
        legacy.click();
      }
      return;
    }

    if(event.target?.closest?.('.navBtn,.v4Dock')){
      document.querySelectorAll('.contextMenu.open').forEach(el=>el.classList.remove('open'));
    }
  },true);

  window.__KTAK_V4_COMPAT={baseVersion:'3.5.11',legacyBoardDockSuppressed:true,quickBriefPreserved:true};
})();
