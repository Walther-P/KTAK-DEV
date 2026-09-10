/* KTAK V4.0.0-alpha.2 usability state machine */
(() => {
  'use strict';
  const VERSION='4.0.0-alpha.2';
  const $=id=>document.getElementById(id);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let armedBoardTool=null;
  let holdTimer=null;
  let pointerStart=null;
  let modeChip=null;

  function closeTransient(){
    $$('.v4Radial.open,.v4Picker.open,.v4Sheet.open,.v4Scrim.open').forEach(el=>el.classList.remove('open'));
    $('mapSidebar')?.classList.remove('v4-open');
    $('boardSidebar')?.classList.remove('v4-open');
  }

  function navigate(pageId){
    const original=document.querySelector(`.navBtn[data-page="${pageId}"]`);
    if(!original)return false;
    original.click();
    closeTransient();
    requestAnimationFrame(syncDock);
    if(pageId==='mapPage')stabilizeMap('navigate');
    return true;
  }

  function syncDock(){
    const active=document.querySelector('.page.active')?.id||'';
    $$('.v4Dock [data-v4-page]').forEach(b=>b.classList.toggle('active',b.dataset.v4Page===active));
  }

  function ensureCommandDock(){
    const dock=document.querySelector('.v4Dock');
    if(!dock||!$('commandPage')||dock.querySelector('[data-v4-page="commandPage"]'))return;
    const b=document.createElement('button');
    b.type='button';b.dataset.v4Page='commandPage';
    b.innerHTML='<span class="v4Icon">🚨</span><span>指揮</span>';
    b.addEventListener('click',()=>navigate('commandPage'));
    const chat=dock.querySelector('[data-v4-page="chatPage"]');
    dock.insertBefore(b,chat||dock.querySelector('#v4MoreBtn'));
    syncDock();
  }

  function enhanceMoreSheet(){
    const grid=document.querySelector('.v4Sheet.open .v4SheetGrid');
    if(!grid||!$('commandPage')||grid.querySelector('[data-v4-alpha2-command]'))return;
    const b=document.createElement('button');b.type='button';b.dataset.v4Alpha2Command='1';
    b.textContent='🚨 指揮／派遣／SOS';b.addEventListener('click',()=>navigate('commandPage'));
    grid.prepend(b);
  }

  function ensureModeChip(){
    if(modeChip)return modeChip;
    modeChip=document.createElement('div');modeChip.className='v4ModeChip';modeChip.id='v4ModeChip';
    modeChip.innerHTML='<span></span><button type="button" aria-label="取消目前工具">×</button>';
    modeChip.querySelector('button').addEventListener('click',()=>resetBoardTool('cancel'));
    document.body.append(modeChip);return modeChip;
  }

  function armBoardTool(key,label){
    if(!key||key==='select'){armedBoardTool=null;ensureModeChip().classList.remove('open');return}
    armedBoardTool={key,label:label||key};
    const chip=ensureModeChip();chip.querySelector('span').textContent=`${armedBoardTool.label} · 操作一次後自動回選取`;
    chip.classList.add('open');
  }

  function resetBoardTool(reason='done'){
    clearTimeout(holdTimer);holdTimer=null;pointerStart=null;
    const select=document.querySelector('.boardTool[data-board-tool="select"]');
    if(select&&!select.classList.contains('active'))select.click();
    armedBoardTool=null;ensureModeChip().classList.remove('open');
    document.body.dataset.v4BoardResetReason=reason;
  }

  function installBoardOneShot(){
    document.addEventListener('click',e=>{
      const original=e.target?.closest?.('.boardTool');
      if(original){
        const key=original.dataset.boardTool||'';
        queueMicrotask(()=>key==='select'?resetBoardTool('select'):armBoardTool(key,original.textContent.trim()));
      }

      const pick=e.target?.closest?.('.v4Picker .v4PickerGrid button');
      const title=document.querySelector('.v4Picker.open .v4PickerTitle')?.textContent||'';
      if(pick&&/戰術板圖樣/.test(title)){
        setTimeout(()=>resetBoardTool('symbol-once'),180);
      }
    },true);

    const canvas=$('boardCanvas');if(!canvas)return;
    canvas.addEventListener('pointerdown',e=>{
      if(!armedBoardTool)return;
      pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY};
      clearTimeout(holdTimer);
      // Holding means the user is asking for context, not another placement.
      holdTimer=setTimeout(()=>resetBoardTool('long-press-context'),430);
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(!pointerStart||e.pointerId!==pointerStart.id)return;
      if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>12){clearTimeout(holdTimer);holdTimer=null}
    },true);
    const finish=e=>{
      if(!pointerStart||e.pointerId!==pointerStart.id)return;
      clearTimeout(holdTimer);holdTimer=null;pointerStart=null;
      if(armedBoardTool)setTimeout(()=>resetBoardTool('one-shot-complete'),120);
    };
    canvas.addEventListener('pointerup',finish,true);
    canvas.addEventListener('pointercancel',finish,true);
  }

  function makeToolPickersNonBlocking(){
    const picker=document.querySelector('.v4Picker');if(!picker)return;
    const apply=()=>{
      const title=picker.querySelector('.v4PickerTitle')?.textContent||'';
      const toolPicker=/繪圖工具|畫筆 \/ 物件/.test(title);
      picker.classList.toggle('v4NonBlockingPicker',toolPicker&&picker.classList.contains('open'));
      if(toolPicker&&picker.classList.contains('open'))document.querySelector('.v4Scrim.open')?.classList.remove('open');
    };
    new MutationObserver(apply).observe(picker,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('pointerdown',e=>{
      if(!picker.classList.contains('v4NonBlockingPicker')||!picker.classList.contains('open'))return;
      if(picker.contains(e.target))return;
      picker.classList.remove('open','v4NonBlockingPicker');
    },true);
  }

  function mapLooksEmpty(){
    const map=$('map'),google=$('googleMapBase');if(!map)return false;
    const r=map.getBoundingClientRect();if(r.width<120||r.height<120)return true;
    const leaflet=map.querySelector('.leaflet-map-pane');
    const tiles=map.querySelectorAll('.leaflet-tile').length;
    const googleReady=!!google?.firstElementChild;
    return !leaflet||(!tiles&&!googleReady);
  }

  function stabilizeMap(reason='layout'){
    const run=()=>{
      try{window.__KTAK35_CORE?.map?.invalidateSize?.({pan:false})}catch{}
      window.dispatchEvent(new Event('resize'));
    };
    requestAnimationFrame(()=>requestAnimationFrame(run));
    setTimeout(run,180);
    setTimeout(()=>{
      run();
      if($('mapPage')?.classList.contains('active')&&mapLooksEmpty()){
        try{window.__KTAK35_GOOGLE_FALLBACK?.activate?.(`V4 ${reason}: empty basemap guard`)}catch{}
        setTimeout(run,80);
      }
    },950);
  }

  function installMapRecovery(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('.v4Dock [data-v4-page="mapPage"],.navBtn[data-page="mapPage"]'))stabilizeMap('map-open');
    },true);
    window.addEventListener('orientationchange',()=>setTimeout(()=>stabilizeMap('orientation'),140));
    window.addEventListener('resize',()=>{if($('mapPage')?.classList.contains('active'))requestAnimationFrame(()=>window.__KTAK35_CORE?.map?.invalidateSize?.({pan:false}))});
  }

  function installMoreEnhancement(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#v4MoreBtn'))setTimeout(enhanceMoreSheet,0);
    },true);
  }

  function boot(){
    if(window.__KTAK_V4)window.__KTAK_V4.version=VERSION;
    document.body.dataset.ktakV4Version=VERSION;
    ensureCommandDock();ensureModeChip();
    installBoardOneShot();makeToolPickersNonBlocking();installMapRecovery();installMoreEnhancement();
    syncDock();
    if($('mapPage')?.classList.contains('active'))stabilizeMap('boot');
    const pageRoot=document.querySelector('main');if(pageRoot)new MutationObserver(syncDock).observe(pageRoot,{subtree:true,attributes:true,attributeFilter:['class']});
    window.__KTAK_V4_ALPHA2={version:VERSION,navigate,stabilizeMap,resetBoardTool,get armedBoardTool(){return armedBoardTool?.key||null}};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
