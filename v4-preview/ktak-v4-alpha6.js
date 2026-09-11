/* KTAK V4.0.0-alpha.6 — unified direct manipulation + mobile gesture hardening */
(() => {
'use strict';

const REV='4.0.0-alpha.6-input';
const HOLD_MS=560;
const MOVE_TOL=13;
const $=id=>document.getElementById(id);
const bridge=()=>window.__KTAK_V4_BRIDGE;
const coarse=matchMedia('(pointer:coarse)').matches;

let customMapTool='';
let customBoardTool='';
let hold=null;
let radialGuardUntil=0;
let pinchCooldownUntil=0;
let suppressMapClickUntil=0;
let mapGesture=null;
let boardGestureA6=null;
let routeLast=null;
let routePreview=null;
let googleDefaultApplied=false;
let googleRetryTimer=0;
const touchPointers=new Map();

const DARK_GOOGLE_STYLES=[
  {elementType:'geometry',stylers:[{color:'#172126'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#172126'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#9aa8ae'}]},
  {featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#42545c'}]},
  {featureType:'administrative.land_parcel',elementType:'labels.text.fill',stylers:[{color:'#65767d'}]},
  {featureType:'poi',elementType:'geometry',stylers:[{color:'#1d2a2f'}]},
  {featureType:'poi',elementType:'labels.text.fill',stylers:[{color:'#829197'}]},
  {featureType:'poi.park',elementType:'geometry.fill',stylers:[{color:'#173028'}]},
  {featureType:'poi.park',elementType:'labels.text.fill',stylers:[{color:'#78a18c'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#2a373d'}]},
  {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#1b252a'}]},
  {featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#c0c9cd'}]},
  {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#39484f'}]},
  {featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#202b30'}]},
  {featureType:'transit',elementType:'geometry',stylers:[{color:'#223137'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#0b2734'}]},
  {featureType:'water',elementType:'labels.text.fill',stylers:[{color:'#6e8791'}]}
];

function ready(fn,tries=0){
  if(window.__KTAK_V4_REFINEMENT?.version==='4.0.0-alpha.5-refine'&&bridge()?.baseVersion==='3.5.11'&&$('map')&&$('boardCanvas'))return fn();
  if(tries>160)return console.warn('[KTAK V4 alpha6] base not ready');
  setTimeout(()=>ready(fn,tries+1),50);
}

function clearHold(){
  if(hold?.timer)clearTimeout(hold.timer);
  hold=null;
}
function clearRoutePreview(){
  if(routePreview){try{map.removeLayer(routePreview)}catch{}routePreview=null}
}
function clearMapGesture(cancel=false){
  if(!mapGesture)return;
  mapGesture=null;
  try{map.dragging.enable()}catch{}
  try{clearPreview()}catch{}
  clearRoutePreview();
  if(cancel)try{renderMapItems()}catch{}
}
function clearBoardGesture(cancel=false){
  if(!boardGestureA6)return;
  boardGestureA6=null;
  if(cancel)try{renderBoard()}catch{}
}

function mapObjectTarget(target){
  return !!target?.closest?.('.leaflet-marker-icon,.leaflet-interactive,.map-symbol-shell,.photoPin,.map-select-frame,.map-transform-handle,.map-duplicate-handle');
}
function surfaceForTarget(target){
  const mapEl=$('map'),board=$('boardCanvas');
  if(mapEl&&(target===mapEl||mapEl.contains(target)))return 'map';
  if(board&&(target===board||board.contains(target)))return 'board';
  return '';
}

/* Alpha.4 has an older one-pointer long-press listener on the surface itself.
   Mark the event target only for the duration of this event so that older listener
   skips it; alpha.6 then owns long-press semantics and can distinguish pinch. */
function bypassLegacyLongPress(target){
  if(!(target instanceof Element))return;
  const already=target.classList.contains('quickBriefDock');
  if(!already)target.classList.add('quickBriefDock');
  setTimeout(()=>{if(!already)target.classList.remove('quickBriefDock')},0);
}

function startLongPress(event,surface){
  if(performance.now()<pinchCooldownUntil)return;
  if(surface==='map'){
    if(customMapTool||bridge()?.mapTool?.()!=='pan'||mapObjectTarget(event.target))return;
  }else{
    if(customBoardTool||bridge()?.boardTool?.()!=='select'||bridge()?.boardHit?.(event.clientX,event.clientY))return;
  }
  clearHold();
  const start={x:event.clientX,y:event.clientY};
  hold={id:event.pointerId,surface,start,timer:setTimeout(()=>{
    if(!hold||touchPointers.size>1||performance.now()<pinchCooldownUntil)return clearHold();
    radialGuardUntil=performance.now()+650;
    window.__KTAK_V4?.showRadial?.(surface,start.x,start.y);
    hold={...hold,opened:true,timer:0};
  },HOLD_MS)};
}

function triangleLatLng(a,b){
  const north=Math.max(a.lat,b.lat),south=Math.min(a.lat,b.lat),west=Math.min(a.lng,b.lng),east=Math.max(a.lng,b.lng),mid=(west+east)/2;
  return [[north,mid],[south,east],[south,west],[north,mid]];
}
function mapToolNow(){return customMapTool||bridge()?.mapTool?.()||''}
function startMapShape(event){
  const tool=mapToolNow();
  if(!['line','rect','circle','triangle'].includes(tool)||mapObjectTarget(event.target))return false;
  if(!can('map')){toast('目前角色只能觀看');return true}
  const start=map.mouseEventToLatLng(event);
  mapGesture={kind:'shape',id:event.pointerId,tool,start,startX:event.clientX,startY:event.clientY,current:start,moved:false};
  try{drawStart=null;clearPreview();map.dragging.disable()}catch{}
  event.preventDefault();event.stopPropagation();
  return true;
}
function drawMapPreview(g,ll){
  clearRoutePreview();
  try{clearPreview()}catch{}
  const opt={color:currentColor,dashArray:'6,5',weight:3,fillOpacity:.06,interactive:false};
  if(g.tool==='line')preview=L.polyline([[g.start.lat,g.start.lng],[ll.lat,ll.lng]],opt).addTo(map);
  else if(g.tool==='rect')preview=L.rectangle([[g.start.lat,g.start.lng],[ll.lat,ll.lng]],opt).addTo(map);
  else if(g.tool==='circle')preview=L.circle([g.start.lat,g.start.lng],{...opt,radius:map.distance(g.start,ll)}).addTo(map);
  else if(g.tool==='triangle')preview=L.polygon(triangleLatLng(g.start,ll),opt).addTo(map);
}
function finishMapShape(event){
  const g=mapGesture;if(!g||g.kind!=='shape'||g.id!==event.pointerId)return false;
  const end=map.mouseEventToLatLng(event),distancePx=Math.hypot(event.clientX-g.startX,event.clientY-g.startY);
  mapGesture=null;suppressMapClickUntil=Date.now()+700;
  try{map.dragging.enable();clearPreview();drawStart=null}catch{}
  if(distancePx<6){toast('按住並拖曳即可畫出形狀');event.preventDefault();event.stopPropagation();return true}
  pushMapHistory();
  const base={id:uid(),rotation:0,color:currentColor,ownerId:currentUserId,ownerName:displayName()};
  if(g.tool==='line')state.map.items.push({...base,type:'line',points:[[g.start.lat,g.start.lng],[end.lat,end.lng]],distanceM:Math.round(map.distance(g.start,end))});
  else if(g.tool==='rect')state.map.items.push({...base,type:'rect',points:[[g.start.lat,g.start.lng],[g.start.lat,end.lng],[end.lat,end.lng],[end.lat,g.start.lng]]});
  else if(g.tool==='circle')state.map.items.push({...base,type:'circle',center:[g.start.lat,g.start.lng],radius:map.distance(g.start,end)});
  else if(g.tool==='triangle')state.map.items.push({...base,type:'free',label:'三角形',alphaShape:'triangle',points:triangleLatLng(g.start,end)});
  publish();renderMapItems();
  event.preventDefault();event.stopPropagation();
  return true;
}

function routePointCount(){return Math.max(0,Number($('routeDraftPoints')?.textContent)||0)}
function routeColor(){return $('routeDraftColor')?.value||'#ffb300'}
function startRouteGesture(event){
  if(!(coarse||event.pointerType==='touch')||bridge()?.mapTool?.()!=='route')return false;
  const ll=map.mouseEventToLatLng(event);
  mapGesture={kind:'route',id:event.pointerId,start:ll,startX:event.clientX,startY:event.clientY,current:ll,moved:false,initialized:false,anchor:routeLast||ll};
  try{map.dragging.disable()}catch{}
  event.preventDefault();event.stopPropagation();
  return true;
}
function initRouteDrag(g){
  if(g.initialized)return;
  if(routePointCount()===0){window.__ktakRoute?.addPoint?.(g.start);routeLast=g.start}
  g.anchor=routeLast||g.start;g.initialized=true;
}
function drawRoutePreview(g,ll){
  clearRoutePreview();
  const a=g.anchor||g.start;
  routePreview=L.polyline([[a.lat,a.lng],[ll.lat,ll.lng]],{color:routeColor(),weight:4,opacity:.95,dashArray:'8,6',interactive:false}).addTo(map);
}
function finishRouteGesture(event){
  const g=mapGesture;if(!g||g.kind!=='route'||g.id!==event.pointerId)return false;
  const end=map.mouseEventToLatLng(event),dist=Math.hypot(event.clientX-g.startX,event.clientY-g.startY);
  mapGesture=null;suppressMapClickUntil=Date.now()+700;clearRoutePreview();
  try{map.dragging.enable()}catch{}
  if(dist>=6){initRouteDrag(g);window.__ktakRoute?.addPoint?.(end);routeLast=end}
  else{window.__ktakRoute?.addPoint?.(end);routeLast=end}
  patchRouteMode();
  event.preventDefault();event.stopPropagation();
  return true;
}

function triangleBoardPoints(a,b){
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y),mid=(minX+maxX)/2;
  return [{x:mid,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY},{x:mid,y:minY}];
}
function makeBoardTriangle(a,b){
  const old=boardPlaceConfig;
  boardPlaceConfig={color:$('boardColor')?.value||'#45aff2',label:'三角形'};
  const obj=createGeom('freeShape',a,b,triangleBoardPoints(a,b));
  boardPlaceConfig=old;
  obj.label='三角形';obj.alphaShape='triangle';
  return obj;
}
function startBoardTriangle(event){
  if(customBoardTool!=='triangle')return false;
  if(!can('board')){toast('目前角色只能觀看');return true}
  const p=boardPoint(event);
  boardGestureA6={id:event.pointerId,start:p,startX:event.clientX,startY:event.clientY,current:p};
  event.preventDefault();event.stopPropagation();
  return true;
}
function finishBoardTriangle(event){
  const g=boardGestureA6;if(!g||g.id!==event.pointerId)return false;
  const p=boardPoint(event),dist=Math.hypot(event.clientX-g.startX,event.clientY-g.startY);boardGestureA6=null;
  if(dist<6){renderBoard();toast('按住並拖曳即可畫出三角形');event.preventDefault();event.stopPropagation();return true}
  pushBoardHistory();floor().objects.push(makeBoardTriangle(g.start,p));publish();renderBoard();
  event.preventDefault();event.stopPropagation();return true;
}

function onPointerDown(event){
  const surface=surfaceForTarget(event.target);if(!surface)return;
  bypassLegacyLongPress(event.target);
  if(event.pointerType==='touch'){
    touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY,surface});
    if(touchPointers.size>1){clearHold();clearMapGesture(true);clearBoardGesture(true);pinchCooldownUntil=performance.now()+550;return}
  }
  if(event.button!==undefined&&event.button!==0)return;
  if(event.target?.closest?.('button,input,select,textarea,a,.v4MapHud4,.v4Mode4'))return;
  if(surface==='map'){
    if(startMapShape(event))return;
    if(startRouteGesture(event))return;
  }else if(startBoardTriangle(event))return;
  startLongPress(event,surface);
}
function onPointerMove(event){
  if(event.pointerType==='touch'&&touchPointers.has(event.pointerId))touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY,surface:touchPointers.get(event.pointerId).surface});
  if(touchPointers.size>1){clearHold();pinchCooldownUntil=performance.now()+450}
  if(hold&&hold.id===event.pointerId&&Math.hypot(event.clientX-hold.start.x,event.clientY-hold.start.y)>MOVE_TOL)clearHold();
  if(mapGesture?.id===event.pointerId){
    const ll=map.mouseEventToLatLng(event);mapGesture.current=ll;
    if(Math.hypot(event.clientX-mapGesture.startX,event.clientY-mapGesture.startY)>=4)mapGesture.moved=true;
    if(mapGesture.kind==='shape')drawMapPreview(mapGesture,ll);
    else if(mapGesture.kind==='route'){if(mapGesture.moved)initRouteDrag(mapGesture);drawRoutePreview(mapGesture,ll)}
    event.preventDefault();event.stopPropagation();return
  }
  if(boardGestureA6?.id===event.pointerId){
    const p=boardPoint(event);boardGestureA6.current=p;renderBoard(makeBoardTriangle(boardGestureA6.start,p));
    event.preventDefault();event.stopPropagation();
  }
}
function onPointerUp(event){
  if(mapGesture?.id===event.pointerId){if(mapGesture.kind==='shape')finishMapShape(event);else finishRouteGesture(event)}
  else if(boardGestureA6?.id===event.pointerId)finishBoardTriangle(event);
  if(hold?.id===event.pointerId){if(hold.opened)radialGuardUntil=Math.max(radialGuardUntil,performance.now()+500);clearHold()}
  if(event.pointerType==='touch')touchPointers.delete(event.pointerId);
  if(!touchPointers.size)pinchCooldownUntil=Math.max(pinchCooldownUntil,performance.now()+180);
}
function onPointerCancel(event){
  if(mapGesture?.id===event.pointerId)clearMapGesture(true);
  if(boardGestureA6?.id===event.pointerId)clearBoardGesture(true);
  if(hold?.id===event.pointerId)clearHold();
  if(event.pointerType==='touch')touchPointers.delete(event.pointerId);
  pinchCooldownUntil=performance.now()+350;
}

function showCustomMode(surface,label,onEnd){
  const mode=document.querySelector('.v4Mode4');if(!mode)return;
  mode.innerHTML='';
  const lead=document.createElement('span');lead.className='v4ModeLabel';lead.innerHTML=`<span class="icon">△</span><span>${label}</span>`;
  const actions=document.createElement('span');actions.className='v4ModeActions';const end=document.createElement('button');end.type='button';end.textContent='結束';end.onclick=e=>{e.preventDefault();e.stopPropagation();onEnd();mode.classList.remove('open','actionable');mode.innerHTML=''};actions.append(end);mode.append(lead,actions);mode.classList.add('open','actionable');
}
function activateMapTriangle(){
  customMapTool='triangle';customBoardTool='';setMapTool('pan');
  document.querySelector('.v4Menu4')?.classList.remove('open');document.querySelector('.v4Radial4')?.classList.remove('open');
  if($('mapHint'))$('mapHint').textContent='目前：按住拖曳畫三角形，放開即完成。';
  showCustomMode('map','三角形：按住拖曳，放開完成',()=>{customMapTool='';setMapTool('pan')});
}
function activateBoardTriangle(){
  customBoardTool='triangle';customMapTool='';setBoardTool('select');
  document.querySelector('.v4Menu4')?.classList.remove('open');document.querySelector('.v4Radial4')?.classList.remove('open');
  showCustomMode('board','三角形：按住拖曳，放開完成',()=>{customBoardTool='';setBoardTool('select')});
}
function patchDrawMenu(){
  const panel=document.querySelector('.v4Menu4.open');if(!panel)return;
  const title=panel.querySelector('.v4MenuHead strong')?.textContent?.trim()||'';
  const grid=panel.querySelector('.v4MenuList');if(!grid||grid.querySelector('[data-alpha6-triangle]'))return;
  const onMap=document.body.classList.contains('v4MapActive');
  const onBoard=document.body.classList.contains('v4BoardActive');
  if(!(onMap&&title==='繪圖')&&!(onBoard&&(title==='繪圖／建築'||title==='繪圖')))return;
  const b=document.createElement('button');b.type='button';b.dataset.alpha6Triangle='1';b.innerHTML='<b>△</b><span>三角形</span>';
  b.onclick=()=>onMap?activateMapTriangle():activateBoardTriangle();
  const square=[...grid.children].find(x=>x.textContent.includes('方形'));if(square?.nextSibling)grid.insertBefore(b,square.nextSibling);else grid.append(b);
}

function patchMapHints(){
  document.querySelectorAll('.mapTool').forEach(btn=>{
    if(btn.dataset.alpha6Hint==='1')return;btn.dataset.alpha6Hint='1';
    btn.addEventListener('click',()=>setTimeout(()=>{
      customMapTool='';const t=btn.dataset.tool;
      if(['line','rect','circle'].includes(t)&&$('mapHint'))$('mapHint').textContent='目前：按住拖曳，放開即完成。';
    },0));
  });
}

function patchRouteMode(){
  if(bridge()?.mapTool?.()!=='route')return;
  const mode=document.querySelector('.v4Mode4');if(!mode?.classList.contains('open'))return;
  const label=mode.querySelector('.v4ModeLabel span:last-child');
  const nextLabel=coarse?'導航路線：拖一段，放開成節點，再繼續拖':'導航路線：點地圖加入節點';if(label&&label.textContent!==nextLabel)label.textContent=nextLabel;
  const finish=[...mode.querySelectorAll('.v4ModeActions button')].find(b=>b.textContent.includes('完成'));
  if(!finish||finish.dataset.alpha6Save==='1')return;
  const replacement=finish.cloneNode(true);replacement.dataset.alpha6Save='1';replacement.textContent='完成共享';finish.replaceWith(replacement);
  replacement.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    const draft=routePointCount();if(draft<2){toast('至少需要 2 個路線節點');return}
    const save=$('routeDraftSave');if(!save){toast('找不到路線儲存控制');return}
    const before=(state?.map?.items||[]).filter(x=>x.type==='route').length;
    save.disabled=false;save.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    setTimeout(()=>{
      const after=(state?.map?.items||[]).filter(x=>x.type==='route').length;
      if(after>before||routePointCount()===0||bridge()?.mapTool?.()==='pan'){
        routeLast=null;clearRoutePreview();mode.classList.remove('open','actionable');mode.innerHTML='';
      }else toast('尚未完成共享，草稿已保留，請再按一次');
    },80);
  };
}
function patchRouteControls(){
  $('routeDraftStart')?.addEventListener('click',()=>{routeLast=null;setTimeout(patchRouteMode,0)});
  $('routeDraftClear')?.addEventListener('click',()=>{routeLast=null;clearRoutePreview()});
  $('routeDraftUndo')?.addEventListener('click',()=>{routeLast=null;clearRoutePreview()});
  $('routeDraftSave')?.addEventListener('click',()=>setTimeout(()=>{if(routePointCount()===0)routeLast=null},0));
}

function installMobileRenderBatching(){
  if(!coarse)return;
  try{
    const original=renderBoard;
    let raf=0,args=[null];
    renderBoard=function(...next){
      args=next;
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;original(...args)});
    };
  }catch(error){console.warn('[KTAK V4 alpha6] board batching unavailable',error)}
  try{
    const originalInit=initGoogleBasemap;
    let inFlight=null,releaseTimer=0;
    initGoogleBasemap=function(...args){
      if(inFlight)return inFlight;
      clearTimeout(releaseTimer);
      inFlight=Promise.resolve(originalInit(...args)).finally(()=>{releaseTimer=setTimeout(()=>{inFlight=null},220)});
      return inFlight;
    };
  }catch(error){console.warn('[KTAK V4 alpha6] google init coalescing unavailable',error)}
}

function applyGoogleDark(){
  try{
    if(googleMap&&mapProvider==='google'&&!satelliteOn){
      googleMap.setOptions({mapTypeId:'roadmap',styles:DARK_GOOGLE_STYLES,backgroundColor:'#10181d',disableDefaultUI:true,clickableIcons:false});
    }
  }catch(error){console.warn('[KTAK V4 alpha6] dark map style',error)}
}
function patchBasemapStyling(){
  try{
    const originalApply=applyBasemapState;
    applyBasemapState=function(...args){const result=originalApply(...args);queueMicrotask(applyGoogleDark);return result};
  }catch(error){console.warn('[KTAK V4 alpha6] basemap styling hook unavailable',error)}
}
async function ensureGoogleDark(attempt=0){
  clearTimeout(googleRetryTimer);
  if(!document.body.classList.contains('v4MapActive'))return;
  try{
    const result=await bridge()?.ensureGoogle?.();
    if(result?.ready){
      mapProvider='google';
      if(!googleDefaultApplied){satelliteOn=false;googleDefaultApplied=true}
      applyBasemapState();applyGoogleDark();bridge()?.invalidateMap?.();return;
    }
    if((result?.pending||result?.reason==='room-not-ready')&&attempt<8)googleRetryTimer=setTimeout(()=>ensureGoogleDark(attempt+1),Math.min(1400,350+attempt*160));
  }catch(error){if(attempt<5)googleRetryTimer=setTimeout(()=>ensureGoogleDark(attempt+1),650)}
}
function watchPageChanges(){
  const mapPage=$('mapPage'),boardPage=$('boardPage');
  const syncMap=()=>{
    if(mapPage?.classList.contains('active'))setTimeout(()=>ensureGoogleDark(0),180);
    else{clearRoutePreview();clearMapGesture(true)}
  };
  const syncBoard=()=>{if(!boardPage?.classList.contains('active'))clearBoardGesture(true)};
  if(mapPage)new MutationObserver(syncMap).observe(mapPage,{attributes:true,attributeFilter:['class']});
  if(boardPage)new MutationObserver(syncBoard).observe(boardPage,{attributes:true,attributeFilter:['class']});
}

function installGuards(){
  document.addEventListener('pointerdown',onPointerDown,{capture:true,passive:false});
  document.addEventListener('pointermove',onPointerMove,{capture:true,passive:false});
  document.addEventListener('pointerup',onPointerUp,{capture:true,passive:false});
  document.addEventListener('pointercancel',onPointerCancel,{capture:true,passive:false});
  document.addEventListener('click',e=>{
    const radial=document.querySelector('.v4Radial4.open');
    if(radial&&radial.contains(e.target)&&performance.now()<radialGuardUntil){e.preventDefault();e.stopImmediatePropagation();return}
    const mapEl=$('map');
    if(mapEl&&(e.target===mapEl||mapEl.contains(e.target))&&Date.now()<suppressMapClickUntil){e.preventDefault();e.stopImmediatePropagation()}
  },true);
}

function installMenuObservers(){
  const panel=document.querySelector('.v4Menu4');if(panel)new MutationObserver(patchDrawMenu).observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const mode=document.querySelector('.v4Mode4');if(mode)new MutationObserver(()=>{if(bridge()?.mapTool?.()==='route')patchRouteMode()}).observe(mode,{attributes:true,attributeFilter:['class']});
}

function boot(){
  document.body.classList.add('v4Alpha6');
  installMobileRenderBatching();
  patchBasemapStyling();
  installGuards();
  installMenuObservers();
  patchMapHints();
  patchRouteControls();
  watchPageChanges();
  if(document.body.classList.contains('v4MapActive'))setTimeout(()=>ensureGoogleDark(0),180);
  window.__KTAK_V4.inputRevision=REV;
  window.__KTAK_V4_INPUT={
    version:REV,
    directDragShapes:true,
    touchRouteSegments:true,
    pinchSafeLongPress:true,
    releaseGuard:true,
    mobileBoardRenderBatching:coarse,
    ensureGoogleDark:()=>ensureGoogleDark(0),
    activateMapTriangle,
    activateBoardTriangle
  };
  console.info('[KTAK V4] input refinement ready',REV);
}

ready(boot);
})();
