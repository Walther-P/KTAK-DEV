(() => {
'use strict';
const core=window.__KTAK35_CORE;
if(!core){console.error('KTAK V3.5.3 map integration core bridge missing');return}
const $=id=>document.getElementById(id);
const role=()=>core.role?.()||'';
const toast=t=>core.toast?.(t);
const state=()=>core.state||null;
let briefLocationPicking=false;
let mapBound=false;
let lastGroupSignature='';

function validLocation(v){
  const lat=Number(v?.lat),lng=Number(v?.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)?{...v,lat,lng}:null;
}
function missionLocation(){return validLocation(state()?.brief?.missionLocation)}
function missionMarker(){return (state()?.map?.items||[]).find(x=>x?.ktakV353Kind==='mission-brief-location')||null}
function missionLabel(){
  const b=state()?.brief||{};
  return String($('executionLocation')?.value||b.executionLocation||b.caseType||'主任務位置').trim()||'主任務位置';
}
function persistMissionMap(){
  try{core.publish?.()}catch(e){console.warn('V3.5.3 publish mission location',e)}
  try{core.renderMapItems?.()}catch(e){console.warn('V3.5.3 render mission map',e)}
}
function upsertMissionMarker(loc,label=missionLabel()){
  const s=state();if(!s?.map)return null;
  if(!Array.isArray(s.map.items))s.map.items=[];
  let item=missionMarker();
  if(!item){
    item={id:crypto.randomUUID(),type:'symbol',icon:'objective',label:'主任務｜'+label,lat:loc.lat,lng:loc.lng,rotation:0,scale:1,fan:null,note:'由任務簡報建立',color:'#ffc650',ownerId:core.userId,ownerName:core.displayName?.()||'指揮官',ktakV353Kind:'mission-brief-location'};
    s.map.items.push(item);
  }else{
    Object.assign(item,{lat:loc.lat,lng:loc.lng,label:'主任務｜'+label,note:'由任務簡報建立',color:'#ffc650',ktakV353Kind:'mission-brief-location'});
  }
  return item;
}
function renderMissionLocationUi(){
  const tools=$('v353BriefLocationTools'),loc=missionLocation(),editing=$('briefSaveBtn')&&!$('briefSaveBtn').classList.contains('hidden');
  if(tools){
    $('v353BriefLocationStatus').textContent=loc?`📍 已設定 ${loc.label||missionLabel()} · ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`:'尚未設定主任務地圖位置';
    $('v353BriefLocationView').classList.toggle('hidden',!loc);
    $('v353BriefLocationClear').classList.toggle('hidden',!loc||!editing);
    $('v353BriefLocationSet').classList.toggle('hidden',!editing);
  }
  const missionBtn=$('v353MissionLocationView');if(missionBtn)missionBtn.classList.toggle('hidden',!loc);
}
function ensureMissionCardLocation(){
  const actions=document.querySelector('#v352MissionCard .v352MissionActions');if(!actions)return;
  let b=$('v353MissionLocationView');if(!b){b=document.createElement('button');b.id='v353MissionLocationView';b.type='button';b.textContent='📍 主任務位置';b.onclick=()=>{const l=missionLocation();if(l)core.openMapAt?.(l.lat,l.lng,18)};actions.prepend(b)}
  renderMissionLocationUi();
}
function ensureBriefLocationUi(){
  const field=$('executionLocation');if(!field)return;
  const host=field.parentElement;if(!host||$('v353BriefLocationTools')){renderMissionLocationUi();return}
  const wrap=document.createElement('div');wrap.id='v353BriefLocationTools';wrap.className='v353BriefLocationTools';
  wrap.innerHTML='<div class="v353BriefLocationActions"><button id="v353BriefLocationSet" type="button">📍 在地圖設定位置</button><button id="v353BriefLocationView" type="button">查看地圖</button><button id="v353BriefLocationClear" type="button" class="danger">清除位置</button></div><div id="v353BriefLocationStatus" class="muted"></div>';
  host.append(wrap);
  $('v353BriefLocationSet').onclick=beginBriefLocationPick;
  $('v353BriefLocationView').onclick=()=>{const l=missionLocation();if(l)core.openMapAt?.(l.lat,l.lng,18)};
  $('v353BriefLocationClear').onclick=clearBriefLocation;
  renderMissionLocationUi();
}
function beginBriefLocationPick(){
  const editing=$('briefSaveBtn')&&!$('briefSaveBtn').classList.contains('hidden');
  if(!editing){toast('請先按「編輯」，再設定主任務位置');return}
  briefLocationPicking=true;
  try{core.setMapTool?.('pan')}catch{}
  core.openMapPage?.();
  toast('主任務位置：請在任務地圖點一下位置');
}
function setBriefLocation(lat,lng){
  const s=state();if(!s?.brief||!s?.map)return;
  const label=missionLabel();
  const loc={lat:Number(lat),lng:Number(lng),label,updatedAt:new Date().toISOString()};
  s.brief.missionLocation=loc;
  upsertMissionMarker(loc,label);
  persistMissionMap();
  renderMissionLocationUi();ensureMissionCardLocation();
  toast('主任務位置已設定；從簡報建立派遣時會自動帶入');
}
function clearBriefLocation(){
  const s=state();if(!s?.brief||!s?.map)return;
  delete s.brief.missionLocation;
  s.map.items=(s.map.items||[]).filter(x=>x?.ktakV353Kind!=='mission-brief-location');
  persistMissionMap();
  renderMissionLocationUi();ensureMissionCardLocation();
  toast('主任務地圖位置已清除');
}
function syncMissionMarkerLabel(){
  const loc=missionLocation();if(!loc)return;
  const label=String(state()?.brief?.executionLocation||loc.label||'主任務位置').trim()||'主任務位置';
  const marker=missionMarker();
  const changed=loc.label!==label||!marker||marker.label!=='主任務｜'+label;
  if(!changed)return;
  state().brief.missionLocation={...loc,label};
  if(role()==='commander')upsertMissionMarker({...loc,label},label);
  persistMissionMap();renderMissionLocationUi();ensureMissionCardLocation();
}
function bindMap(){
  const map=core.map;if(!map||mapBound)return;mapBound=true;
  map.on('click',e=>{if(!briefLocationPicking)return;briefLocationPicking=false;setBriefLocation(e.latlng.lat,e.latlng.lng)});
}
function inheritMissionLocationIntoDispatch(){
  const loc=missionLocation();if(!loc)return;
  window.__KTAK35?.setDispatchLocation?.({lat:loc.lat,lng:loc.lng,label:loc.label||missionLabel()});
}
function ensureUseMissionLocationButton(){
  const box=document.querySelector('#v352DispatchForm .v35TaskLocationBox');if(!box||$('v353UseMissionLocation'))return;
  const b=document.createElement('button');b.id='v353UseMissionLocation';b.type='button';b.textContent='📍 使用主任務位置';b.onclick=()=>{const loc=missionLocation();if(!loc){toast('任務簡報尚未設定主任務位置');return}window.__KTAK35?.setDispatchLocation?.({lat:loc.lat,lng:loc.lng,label:loc.label||missionLabel()});toast('派遣位置已帶入主任務位置')};
  box.prepend(b);
}
function groupSignature(groups){return JSON.stringify(groups.map(g=>[g.id,g.code,g.type,g.color]))}
function renderMapGroupShortcuts(){
  const root=$('mapTacticalList'),api=window.__KTAK35_V352;if(!root||!api?.getGroups)return;
  const groups=api.getGroups().slice().sort((a,b)=>String(a.code).localeCompare(String(b.code)));
  const sig=groupSignature(groups),hasExisting=!!root.querySelector('[data-v353-map-group]');
  if(sig===lastGroupSignature&&(groups.length?hasExisting:!hasExisting))return;
  lastGroupSignature=sig;
  root.querySelectorAll('[data-v353-map-group]').forEach(x=>x.remove());
  if(!groups.length)return;
  const titles=[...root.querySelectorAll('.tacticalGroupTitle')];
  const vehicleTitle=titles.find(x=>x.textContent.trim()==='車輛／載具');if(!vehicleTitle)return;
  const staticGroup=root.querySelector('[data-tactical-key="group"]');
  const svg=staticGroup?.querySelector('svg')?.outerHTML||'<span class="v353GroupEmoji">👥</span>';
  const title=document.createElement('div');title.className='tacticalGroupTitle v353MapGroupTitle';title.dataset.v353MapGroup='title';title.textContent='目前編組';vehicleTitle.before(title);
  groups.forEach(g=>{
    const b=document.createElement('button');b.type='button';b.className='tacticalPickBtn v353MapGroupPick';b.dataset.v353MapGroup=g.id;b.style.setProperty('--team-color',g.color||'#45aff2');
    b.innerHTML=svg+`<span><b>${String(g.code||'')} ${String(g.type||'編組')}</b><small><i class="v353TeamDot"></i>隊伍快速圖樣</small></span>`;
    b.onclick=()=>{core.chooseMapSymbol?.('group',`${g.code} ${g.type||'編組'}`,g.color||'#45aff2');toast(`已選擇 ${g.code} ${g.type||'編組'} 圖樣，請點地圖放置`)};
    vehicleTitle.before(b);
  });
}
function ensureMissionMarkerFromBrief(){
  const loc=missionLocation();if(!loc||missionMarker()||role()!=='commander')return;
  upsertMissionMarker(loc,loc.label||missionLabel());persistMissionMap();
}
function ensureUi(){
  ensureBriefLocationUi();ensureMissionCardLocation();ensureUseMissionLocationButton();bindMap();renderMapGroupShortcuts();ensureMissionMarkerFromBrief();renderMissionLocationUi();
}

document.addEventListener('click',e=>{
  const id=e.target?.id||'';
  if(id==='briefEditBtn'||id==='briefSaveBtn')setTimeout(()=>{ensureUi();if(id==='briefSaveBtn')syncMissionMarkerLabel()},0);
  if(id==='v352BriefDispatch'||id==='v352BriefDispatchTop'){
    const save=$('briefSaveBtn');if(save&&!save.classList.contains('hidden'))return;
    setTimeout(()=>{inheritMissionLocationIntoDispatch();ensureUseMissionLocationButton()},180);
  }
});
document.addEventListener('input',e=>{if(e.target?.closest?.('#v352GroupCard'))setTimeout(renderMapGroupShortcuts,50)});
document.addEventListener('change',e=>{if(e.target?.closest?.('#v352GroupCard'))setTimeout(renderMapGroupShortcuts,50)});
setInterval(()=>{if(document.visibilityState==='visible')ensureUi()},1200);
setTimeout(ensureUi,0);
window.__KTAK35_V353={version:'3.5.3',ensureUi,renderMapGroupShortcuts,missionLocation,inheritMissionLocationIntoDispatch,setBriefLocation};
})();
