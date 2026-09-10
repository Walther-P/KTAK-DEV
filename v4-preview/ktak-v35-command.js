// ktak-v35-metric-grid-v8
// ktak-v35-field-feedback-v7
// ktak-v35-field-feedback-v5
// ktak-v35-field-feedback-v4
// ktak-v35-field-performance-v3
(() => {
'use strict';
const core=window.__KTAK35_CORE;
if(!core){console.error('KTAK 3.5 core bridge missing');return}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtTime=v=>{try{return new Date(v).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
const STATUS={available:['🟢','可派遣'],active:['🔵','執行中'],standby:['🟡','待命'],support:['🟠','需要支援'],emergency:['🔴','緊急'],offline:['⚫','離線']};
const TASK_STATUS={pending:'等待接受',accepted:'已接受',active:'執行中',completed:'已完成',cancelled:'已取消',declined:'無法執行'};
const PRIORITY={low:'低',normal:'一般',high:'高',critical:'緊急'};
const SEARCH={unsearched:'未搜索',searching:'搜索中',complete:'完成',blocked:'受阻'};
const FLOOR={unknown:'UNKNOWN',searching:'SEARCHING',clear:'CLEAR',danger:'DANGER',fire:'FIRE',blocked:'BLOCKED'};
const TEMPLATES={police_tactical:'👮 高風險／戰術勤務',warrant:'🚪 搜索／逮捕',missing_person:'🔎 失蹤人口搜索',crowd:'👥 群眾活動',event_security:'🛡️ 大型活動維安',traffic_major:'🚧 重大交通事故',fire_building:'🚒 建築火警',wildfire:'🔥 山林火災',flood:'🌊 淹水／水災',earthquake:'🏚️ 地震搜救',water_rescue:'🛟 水域救援',mci:'🚑 大量傷病患',custom:'⚙️ 自訂任務'};
const MISSION_GUIDES={
  police_tactical:{text:'高風險／戰術勤務：優先掌握人員狀態、派遣、SOS 與戰術地圖。',focus:['people','dispatch','sos'],placeholder:'例如：建立封鎖線／進入 A 棟'},
  warrant:{text:'搜索／逮捕：優先掌握進入任務、搜索區、隊員位置與完成狀態。',focus:['dispatch','search','people'],placeholder:'例如：A 棟 3F 搜索／拘提目標'},
  missing_person:{text:'失蹤人口：優先使用搜索區、進度、天氣與人員分組。',focus:['search','weather','people'],placeholder:'例如：A 搜索區地毯式搜索'},
  crowd:{text:'群眾活動：優先掌握人員配置、派遣與緊急支援。',focus:['people','dispatch','sos'],placeholder:'例如：東側出入口警戒'},
  event_security:{text:'大型活動維安：優先掌握崗位、人員狀態、派遣與異常事件。',focus:['people','dispatch','sos'],placeholder:'例如：北門安檢／機動支援'},
  traffic_major:{text:'重大交通事故：優先派遣、SOS、現場位置與事件時間軸。',focus:['dispatch','sos','people'],placeholder:'例如：封閉內側車道／傷患區支援'},
  fire_building:{text:'建築火警：優先掌握 SOS、人員、樓層搜索、派遣與天氣。',focus:['sos','people','dispatch','weather'],placeholder:'例如：A 棟 3F 搜索／火點回報'},
  wildfire:{text:'山林火災：優先掌握天氣、搜索區、人員位置與派遣。',focus:['weather','search','people','dispatch'],placeholder:'例如：北側防火線搜索'},
  flood:{text:'淹水／水災：優先掌握天氣、搜索區、SOS 與撤離任務。',focus:['weather','search','sos','dispatch'],placeholder:'例如：低窪區撤離／逐戶搜索'},
  earthquake:{text:'地震搜救：優先使用搜索區、SOS、人員狀態與派遣。',focus:['search','sos','people','dispatch'],placeholder:'例如：倒塌建物 A 區搜索'},
  water_rescue:{text:'水域救援：優先掌握 SOS、人員位置、天氣與派遣。',focus:['sos','people','weather','dispatch'],placeholder:'例如：下游 200m 搜索／岸際支援'},
  mci:{text:'大量傷病患：優先掌握人員、派遣、SOS 與事件時間軸。',focus:['people','dispatch','sos'],placeholder:'例如：紅區後送／檢傷站支援'},
  custom:{text:'自訂任務：所有指揮工具維持可用，依現場自行編組。',focus:['dispatch','people'],placeholder:'輸入自訂任務內容'}
};
const STICKERS=[['ACK','✅','收到'],['GO','➡️','前進'],['STANDBY','⏸️','待命'],['CAUTION','⚠️','注意'],['SUPPORT','🆘','需要支援'],['DONE','✔️','完成'],['EVAC','↩️','撤離'],['RALLY','📍','集合'],['OK','👍','OK'],['STRONG','💪','撐住'],['FIRE','🔥','火點'],['MEDIC','🚑','需要救護']];
let roomKey='',channel=null,data={status:[],assignments:[],sos:[],timeline:[],sectors:[],profile:null,floors:[]};
let searchLayer=null,sosLayer=null,gridLayer=null,radarLayer=null,searchDraftLayer=null,searchDrawing=false,searchPoints=[];
let mapBearing=0,refreshTimer=null,disasterTimer=null;
let taskLocation={mode:'none',lat:null,lng:null,label:'',sectorId:null},taskLocationPicking=false,modeSaveTimer=null;
let dataScope='',refreshGeneration=0;
function sb(){return core.sb}function room(){return core.roomUuid}function me(){return core.userId}function role(){return core.role()}function users(){return Object.values(core.state?.users||{}).filter(x=>x.approved!==false)}function nameOf(id){return core.state?.users?.[id]?.nick||String(id||'').slice(0,8)||'隊員'}function locOf(id=me()){return core.memberLocations?.[id]||null}function notify(t){core.toast(t)}
function pushOperational(kind,recordId){
  if(!recordId||!room()||!sb())return Promise.resolve();
  return sb().functions.invoke('ktak35-push',{body:{kind,roomId:room(),recordId}}).then(({error,data:r})=>{if(error)console.warn('KTAK35 push',kind,error);else if(r&&!r.ok)console.warn('KTAK35 push response',kind,r)}).catch(e=>console.warn('KTAK35 push',kind,e));
}
async function timeline(type,title,details={},target=null){if(!room()||!me())return;try{const {error}=await sb().from('ktak35_timeline').insert({room_id:room(),event_type:type,actor_user_id:me(),target_user_id:target,title,details});if(error)throw error}catch(e){console.warn('timeline',e)}}
// Legacy status/sector/floor delivery. Assignment delivery uses the shared RPC outbox.
const pendingKey=()=>`ktak35.pending.v351.${room()}.${me()}.`;
const isOnline=()=>navigator.onLine!==false;
let queueFlush=null;
function queuedItems(prefix=pendingKey()){
  const items=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
    const q=JSON.parse(localStorage.getItem(key));
    if(!q||key!==prefix+q.operationId)throw new Error('待送資料無法讀取，請保留並回報問題');
    items.push(q);
  }
  return items.sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));
}
function queueAction(action){
  if(!room()||!me())throw new Error('請先加入任務房間');
  const q={...action,operationId:crypto.randomUUID(),roomId:room(),userId:me(),queuedAt:new Date().toISOString()};
  localStorage.setItem(pendingKey()+q.operationId,JSON.stringify(q));renderOffline();return q;
}
async function runOrQueue(action,runner){
  // Persist before attempting the network. A response lost in transit remains pending.
  const q=queueAction(action);await flushQueue();
  const queued=!!localStorage.getItem(`ktak35.pending.v351.${q.roomId}.${q.userId}.`+q.operationId);
  if(queued)notify('操作已暫存，尚未送達；恢復連線後會重試');
  return {queued};
}
async function flushQueue(){
  if(!isOnline()||!room()||!me())return;
  if(queueFlush)return queueFlush;
  const r=room(),u=me(),prefix=pendingKey();
  const run=async()=>{
    let sent=0;
    for(const q of queuedItems(prefix)){
      if(r!==room()||u!==me()||!isOnline())break;
      if(!localStorage.getItem(prefix+q.operationId))continue;
      try{
        if(q.roomId!==r||q.userId!==u)throw new Error('待送身分不符');
        if(q.kind==='status')await setStatus(q.status,q.note,true);
        else if(q.kind==='sector')await updateSector(q.id,q.patch,true);
        else if(q.kind==='floor')await saveFloor(q.pageId,q.status,true);
        else throw new Error('此操作需確認後重新送出');
        localStorage.removeItem(prefix+q.operationId);sent++;
      }catch(e){localStorage.setItem(prefix+q.operationId,JSON.stringify({...q,error:'尚未送達，請確認連線及權限後重試'}));console.warn('KTAK pending delivery',e);break;}
    }
    if(r===room()&&u===me()){if(sent)notify(`已同步 ${sent} 項離線操作`);renderOffline();}
  };
  queueFlush=Promise.resolve().then(()=>navigator.locks?.request?navigator.locks.request(prefix,run):run()).finally(()=>{queueFlush=null;});
  return queueFlush;
}
function renderOffline(){
  window.dispatchEvent(new Event('ktak35:delivery'));const el=$('v35OfflineBanner');if(!el)return;
  let n=0,legacy=false;
  try{n=queuedItems().length+(window.__KTAK35_ASSIGNMENTS?.list()?.length||0);legacy=JSON.parse(localStorage.getItem(`ktak35.pending.${room()}`)||'[]').length>0;}catch{legacy=true;}
  el.classList.toggle('offline',!isOnline());el.classList.toggle('pending',n>0||legacy);
  el.textContent=legacy?'⚠ 舊版待送資料已保留，請至指揮頁確認':!isOnline()?`⚠ 離線模式 · ${n} 項待送`:n?`⏳ ${n} 項尚未送達`:'● 網路已連線';
}
window.addEventListener('online',()=>{renderOffline();flushQueue().catch(console.warn)});
window.addEventListener('offline',renderOffline);
setInterval(()=>{if(document.visibilityState==='visible')flushQueue().catch(console.warn)},30000);

window.__KTAK35_PENDING={flush:flushQueue,list:queuedItems,discard:async id=>{const key=pendingKey()+id,r=room(),u=me();if(queueFlush)await queueFlush;if(r!==room()||u!==me())throw new Error('房間已切換');localStorage.removeItem(key);renderOffline()}};

async function refreshAll(render=true){if(!room()||!sb())return;const r=room(),u=me(),generation=++refreshGeneration,scope=r+':'+u;if(dataScope!==scope){dataScope=scope;data={status:[],assignments:[],sos:[],timeline:[],sectors:[],profile:null,floors:[]};renderAll35();}const [st,as,so,ti,se,pr,fl]=await Promise.all([sb().from('ktak35_member_status').select('*').eq('room_id',r),sb().from('ktak35_assignments').select('*').eq('room_id',r).order('created_at',{ascending:false}).limit(100),sb().from('ktak35_sos').select('*').eq('room_id',r).order('created_at',{ascending:false}).limit(50),sb().from('ktak35_timeline').select('*').eq('room_id',r).order('created_at',{ascending:false}).limit(150),sb().from('ktak35_search_sectors').select('*').eq('room_id',r).order('created_at',{ascending:true}),sb().from('ktak35_mission_profile').select('*').eq('room_id',r).maybeSingle(),sb().from('ktak35_floor_status').select('*').eq('room_id',r)]);if(r!==room()||u!==me()||generation!==refreshGeneration)return;for(const x of [st,as,so,ti,se,pr,fl])if(x.error){console.warn('KTAK35 fetch',x.error);return;}data={status:st.data||[],assignments:as.data||[],sos:so.data||[],timeline:ti.data||[],sectors:se.data||[],profile:pr.data||null,floors:fl.data||[]};if(render)renderAll35()}
let refreshDebounce=null,lastLightRender=0;
function scheduleRefresh(){
  clearTimeout(refreshDebounce);
  refreshDebounce=setTimeout(()=>refreshAll(true).catch(e=>console.warn('KTAK35 refresh',e)),140);
}
function mergeRealtimeRow(list,row,key='id'){
  if(!row)return;const value=row[key];if(value==null)return;
  const i=list.findIndex(x=>x?.[key]===value);
  if(i>=0)list[i]={...list[i],...row};else list.unshift(row);
}
function deleteRealtimeRow(list,row,key='id'){
  const value=row?.[key];return value==null?list:list.filter(x=>x?.[key]!==value);
}
function applyStatusRealtime(payload){
  const row=payload.new||payload.old||{};
  if(payload.eventType==='DELETE')data.status=deleteRealtimeRow(data.status,row,'user_id');else mergeRealtimeRow(data.status,row,'user_id');
  renderSelfStatus();renderSummary();
}
function applyAssignmentRealtime(payload){
  const row=payload.new||payload.old||{};
  if(payload.eventType==='DELETE')data.assignments=deleteRealtimeRow(data.assignments,row);else mergeRealtimeRow(data.assignments,row);
  data.assignments.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  renderAssignments();renderSummary();
  if(payload.eventType==='INSERT')window.dispatchEvent(new CustomEvent('ktak35:assignment',{detail:row}));
}
function applySosRealtime(payload){
  const row=payload.new||payload.old||{};
  if(payload.eventType==='DELETE')data.sos=deleteRealtimeRow(data.sos,row);else mergeRealtimeRow(data.sos,row);
  data.sos.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  renderSos();renderSummary();
  if(payload.eventType==='INSERT')window.dispatchEvent(new CustomEvent('ktak35:sos',{detail:row}));
}
function applyTimelineRealtime(payload){
  const row=payload.new||payload.old||{};
  if(payload.eventType==='DELETE')data.timeline=deleteRealtimeRow(data.timeline,row);else mergeRealtimeRow(data.timeline,row);
  data.timeline.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));data.timeline=data.timeline.slice(0,150);renderTimeline();
}
function applySectorRealtime(payload){
  const row=payload.new||payload.old||{};
  if(payload.eventType==='DELETE')data.sectors=deleteRealtimeRow(data.sectors,row);else mergeRealtimeRow(data.sectors,row);
  data.sectors.sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0));renderSectors();renderSearchMap();renderSummary();
}
function applyProfileRealtime(payload){
  data.profile=payload.eventType==='DELETE'?null:(payload.new||null);
  const template=data.profile?.template||'police_tactical',sel=$('v35MissionTemplate');if(sel)sel.value=template;
  const label=$('v35MissionTemplateLabel');if(label)label.textContent=TEMPLATES[template]||template;applyMissionModeUi(template);renderSummary();
}
function applyFloorRealtime(payload){
  const row=payload.new||payload.old||{};
  if(payload.eventType==='DELETE')data.floors=deleteRealtimeRow(data.floors,row,'page_id');else mergeRealtimeRow(data.floors,row,'page_id');renderFloor();
}
async function setupRealtime(){
  const key=room();if(!key||!sb()||key===roomKey)return;try{await sb().realtime.setAuth()}catch(e){console.warn('KTAK35 realtime auth',e);return}
  roomKey=key;if(channel)try{await sb().removeChannel(channel)}catch{}
  channel=sb().channel(`ktak35:${key}`,{config:{private:true}})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_member_status',filter:`room_id=eq.${key}`},payload=>{if(key===room())applyStatusRealtime(payload)})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_assignments',filter:`room_id=eq.${key}`},payload=>{if(key===room())applyAssignmentRealtime(payload)})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_sos',filter:`room_id=eq.${key}`},payload=>{if(key===room())applySosRealtime(payload)})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_timeline',filter:`room_id=eq.${key}`},payload=>{if(key===room())applyTimelineRealtime(payload)})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_search_sectors',filter:`room_id=eq.${key}`},payload=>{if(key===room())applySectorRealtime(payload)})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_mission_profile',filter:`room_id=eq.${key}`},payload=>{if(key===room())applyProfileRealtime(payload)})
    .on('postgres_changes',{event:'*',schema:'public',table:'ktak35_floor_status',filter:`room_id=eq.${key}`},payload=>{if(key===room())applyFloorRealtime(payload)})
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')roomKey=''});
}
async function ensureRuntime(){
  if(!room()||!core.state)return;
  if(roomKey!==room()){
    await setupRealtime();
    await refreshAll(false);
    initMapLayers();
    renderAll35();
    await flushQueue();
    scheduleDisaster();
    lastLightRender=Date.now();
    return;
  }
  if(Date.now()-lastLightRender>1200){
    lastLightRender=Date.now();
    renderSummary();
    renderSelfStatus();
    renderOffline();
  }
}
function effectiveStatus(u){const row=data.status.find(x=>x.user_id===u.id),s=row?.status||'available',l=locOf(u.id);if(l?.updatedAt&&Date.now()-new Date(l.updatedAt).getTime()>60000)return 'offline';if(s==='emergency'&&row?.note==='SOS 已觸發'&&!data.sos.some(x=>x.status==='active'&&String(x.user_id)===String(u.id)))return 'available';return s}
function renderSummary(){const members=users(),online=members.filter(u=>effectiveStatus(u)!=='offline').length;const active=data.assignments.filter(x=>!['completed','cancelled','declined'].includes(x.status)).length;const sos=data.sos.filter(x=>x.status==='active').length;const sectors=data.sectors,progress=sectors.length?Math.round(sectors.reduce((a,x)=>a+(x.progress||0),0)/sectors.length):0;const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};set('v35SummaryTeam',`${online}/${members.length}`);set('v35SummaryTasks',String(active));set('v35SummarySos',String(sos));set('v35SummarySearch',`${progress}%`);set('v35SearchProgress',sectors.length?`${progress}%`:'—');const label=$('v35MissionTemplateLabel');if(label)label.textContent=TEMPLATES[data.profile?.template]||TEMPLATES.police_tactical}
function renderSelfStatus(){const row=data.status.find(x=>x.user_id===me()),sel=$('v35MyStatus'),note=$('v35MyStatusNote');if(!sel)return;sel.value=row?.status||'available';if(document.activeElement!==note)note.value=row?.note||'';const list=$('v35TeamStatusList');if(!list)return;list.innerHTML='';users().forEach(u=>{const st=effectiveStatus(u),def=STATUS[st]||STATUS.available,l=locOf(u.id),alt=Number.isFinite(l?.altitudeM)?` · 高度 ${Math.round(l.altitudeM)}m`:'';const d=document.createElement('div');d.className='v35StatusRow';d.innerHTML=`<span><b>${def[0]} ${esc(u.nick)}</b><small>${esc(def[1])}${alt}</small></span><span>${l&&Number.isFinite(l.accuracyM)?`±${Math.round(l.accuracyM)}m`:'—'}</span>`;list.append(d)})}
async function setStatus(status,note='',fromQueue=false){
  const previous=data.status.find(x=>x.user_id===me());
  const previousCopy=previous?{...previous}:null;
  if(!fromQueue){
    const next={room_id:room(),user_id:me(),status,note:String(note||'').slice(0,240),updated_at:new Date().toISOString()};
    if(previous)Object.assign(previous,next);else data.status.push(next);
    renderSelfStatus();renderSummary();
  }
  const runner=async()=>{
    const {error}=await sb().from('ktak35_member_status').upsert({room_id:room(),user_id:me(),status,note:String(note||'').slice(0,240),updated_at:new Date().toISOString()},{onConflict:'room_id,user_id'}).select('*').single();
    if(error)throw error;
    if(!fromQueue)timeline('member_status',`狀態更新：${STATUS[status]?.[1]||status}`,{status,note}).catch(e=>console.warn('status timeline',e));
  };
  try{return fromQueue?await runner():await runOrQueue({kind:'status',status,note},runner)}
  catch(e){
    if(!fromQueue){
      data.status=data.status.filter(x=>x.user_id!==me());
      if(previousCopy)data.status.push(previousCopy);
      renderSelfStatus();renderSummary();
    }
    throw e;
  }
}
function sectorById(id){return id?data.sectors.find(x=>String(x.id)===String(id)):null}
function sectorCenter(s){const pts=Array.isArray(s?.polygon)?s.polygon:[];if(!pts.length)return null;let lat=0,lng=0,n=0;for(const p of pts){if(Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))){lat+=Number(p[0]);lng+=Number(p[1]);n++}}return n?{lat:lat/n,lng:lng/n}:null}
function resetTaskLocation(){taskLocation={mode:'none',lat:null,lng:null,label:'',sectorId:null};taskLocationPicking=false;renderTaskLocationUi()}
function resolveTaskLocation(){if(taskLocation.mode==='point'&&Number.isFinite(taskLocation.lat)&&Number.isFinite(taskLocation.lng))return {...taskLocation,searchSectorId:null};if(taskLocation.mode==='sector'){const s=sectorById(taskLocation.sectorId),c=sectorCenter(s);if(!s||!c)return null;return {mode:'sector',lat:c.lat,lng:c.lng,label:s.name||'搜索區',sectorId:s.id,searchSectorId:s.id}}return {mode:'none',lat:null,lng:null,label:'',sectorId:null,searchSectorId:null}}
function renderTaskLocationUi(){const mode=$('v35TaskLocationMode'),point=$('v35TaskPointRow'),sectorRow=$('v35TaskSectorRow'),sector=$('v35TaskSectorSelect'),status=$('v35TaskLocationStatus');if(!mode)return;mode.value=taskLocation.mode||'none';if(sector){const keep=taskLocation.sectorId||sector.value;sector.innerHTML='<option value="">請選搜索區</option>'+data.sectors.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(SEARCH[s.status]||s.status)+' '+(Number(s.progress)||0)+'%</option>').join('');if(keep&&data.sectors.some(s=>String(s.id)===String(keep))){sector.value=keep;taskLocation.sectorId=keep}}point?.classList.toggle('hidden',taskLocation.mode!=='point');sectorRow?.classList.toggle('hidden',taskLocation.mode!=='sector');if(status){if(taskLocation.mode==='point')status.textContent=Number.isFinite(taskLocation.lat)?'📍 已設定 '+(taskLocation.label||(taskLocation.lat.toFixed(5)+', '+taskLocation.lng.toFixed(5))):'尚未選擇地圖位置';else if(taskLocation.mode==='sector')status.textContent=sectorById(taskLocation.sectorId)?'▦ 已連結 '+sectorById(taskLocation.sectorId).name:'尚未選擇搜索區';else status.textContent='此任務不附地圖位置'}const pick=$('v35PickTaskLocation');if(pick)pick.textContent=taskLocationPicking?'請點地圖…':Number.isFinite(taskLocation.lat)?'重新選點':'在地圖選一點'}
function beginTaskLocationPick(){if(searchDrawing)cancelSearch();taskLocation.mode='point';taskLocationPicking=true;renderTaskLocationUi();try{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))}catch{}core.openMapPage?.();notify('任務位置：請在地圖點一下要派遣的位置')}
function bindTaskLocationClick(){if(!core.map||core.map.__ktak35TaskLocationBound)return;core.map.__ktak35TaskLocationBound=true;core.map.on('click',e=>{if(!taskLocationPicking)return;taskLocationPicking=false;taskLocation={mode:'point',lat:e.latlng.lat,lng:e.latlng.lng,label:e.latlng.lat.toFixed(5)+', '+e.latlng.lng.toFixed(5),sectorId:null};renderTaskLocationUi();notify('已設定任務位置')})}
function focusSectorOnMap(s){const pts=Array.isArray(s?.polygon)?s.polygon:[];if(!pts.length)return;core.map?.fitBounds?.(L.latLngBounds(pts),{padding:[30,30]});core.openMapPage?.()}
const MODE_CONFIG={
police_tactical:{title:'👮 戰術指揮資料',fields:[['target','目標／對象'],['threat','威脅與武器風險'],['entry','主要進入點'],['staging','待命／集結點']],tasks:['建立封鎖線','進入控制','外圍警戒','機動支援']},
warrant:{title:'🚪 搜索／逮捕資料',fields:[['target','搜索／拘提目標'],['entry','進入點'],['scope','搜索範圍'],['risk','已知風險']],tasks:['進入搜索','拘提目標','外圍封鎖','證物／現場維持']},
missing_person:{title:'🔎 失蹤人口搜索資料',fields:[['lastSeen','最後目擊地點'],['lastSeenTime','最後目擊時間'],['subject','對象特徵／衣著'],['risk','高風險因素']],tasks:['搜索指定區域','訪查周邊','機動搜索','建立集合點']},
crowd:{title:'👥 群眾活動資料',fields:[['event','活動／群眾概況'],['hotspot','高風險區域'],['egress','疏散／離場方向'],['reserve','預備隊位置']],tasks:['入口管制','外圍警戒','機動支援','疏散引導']},
event_security:{title:'🛡️ 維安任務資料',fields:[['venue','活動／場地'],['vip','重要對象'],['gate','主要管制口'],['risk','重點風險']],tasks:['入口安檢','場內巡查','外圍警戒','機動支援']},
traffic_major:{title:'🚧 重大事故資料',fields:[['site','事故位置'],['lanes','受阻車道／道路'],['casualties','傷患概況'],['hazard','危害物／二次事故風險']],tasks:['交通封鎖','傷患救援','事故調查','改道路線']},
fire_building:{title:'🚒 建築火警指揮資料',fields:[['fireFloor','火點／主要樓層'],['trapped','疑似受困人數'],['smoke','火勢／煙況'],['entry','主要進入點'],['hazard','危害物／坍塌風險']],tasks:['滅火攻擊','搜索救援','人員疏散','外圍警戒','救護待命']},
wildfire:{title:'🔥 山林火災資料',fields:[['front','火線／延燒方向'],['wind','風向／風勢'],['access','進入道路'],['water','水源／補給點']],tasks:['建立防火線','火線偵查','人員撤離','補給支援']},
flood:{title:'🌊 淹水／水災資料',fields:[['depth','積水深度'],['blocked','道路阻斷'],['evac','撤離／收容點'],['vulnerable','受困／弱勢對象']],tasks:['逐戶搜索','人員撤離','道路封鎖','水域救援']},
earthquake:{title:'🏚️ 地震搜救資料',fields:[['collapse','倒塌／受損區'],['trapped','疑似受困人數'],['hazard','瓦斯／電力／坍塌風險'],['rally','救援集結點']],tasks:['倒塌建物搜索','救出受困者','危害排除','外圍警戒']},
water_rescue:{title:'🛟 水域救援資料',fields:[['water','水域／岸段'],['lastSeen','最後目擊點'],['flow','流向／流速'],['downstream','下游攔截點']],tasks:['岸際搜索','下游搜索','水面救援','救護待命']},
mci:{title:'🚑 大量傷病患資料',fields:[['count','估計傷患數'],['triage','檢傷區'],['transport','後送點'],['hazard','現場危害']],tasks:['建立檢傷站','紅區後送','傷患集結','交通管制']},
custom:{title:'⚙️ 自訂任務資料',fields:[['summary','情境摘要'],['objective','主要目標'],['risk','風險'],['note','指揮備註']],tasks:['建立任務','現場支援','外圍警戒','機動待命']}}
function modeDataFor(template=data.profile?.template||$('v35MissionTemplate')?.value||'police_tactical'){const all=data.profile?.data?.modes||{};return all[template]||{}}
function scheduleModeDataSave(){clearTimeout(modeSaveTimer);modeSaveTimer=setTimeout(saveModeDataNow,650)}
async function saveModeDataNow(){if(role()!=='commander'||!room())return;const template=$('v35MissionTemplate')?.value||data.profile?.template||'police_tactical',panel=$('v35MissionModePanel');if(!panel)return;const fields={};panel.querySelectorAll('[data-mode-key]').forEach(el=>fields[el.dataset.modeKey]=String(el.value||'').slice(0,500));const profileData={...(data.profile?.data||{}),modes:{...(data.profile?.data?.modes||{}),[template]:fields}};data.profile={...(data.profile||{}),room_id:room(),template,data:profileData,updated_by:me(),updated_at:new Date().toISOString()};const {error}=await sb().from('ktak35_mission_profile').upsert({room_id:room(),template,data:profileData,updated_by:me(),updated_at:new Date().toISOString()},{onConflict:'room_id'});if(error)console.warn('mode data save',error)}
function fillQuickTask(title){const t=$('v35TaskTitle'),d=$('v35TaskDetails');if(t)t.value=title;const template=$('v35MissionTemplate')?.value||data.profile?.template||'police_tactical',cfg=MODE_CONFIG[template],vals=modeDataFor(template),summary=(cfg?.fields||[]).map(([k,label])=>vals[k]?label+'：'+vals[k]:'').filter(Boolean).join('\n');if(d&&!d.value)d.value=summary;notify('已帶入快速派遣：'+title)}
function renderMissionModePanel(){const root=$('v35MissionModePanel');if(!root)return;const template=$('v35MissionTemplate')?.value||data.profile?.template||'police_tactical',cfg=MODE_CONFIG[template]||MODE_CONFIG.custom,vals=modeDataFor(template);root.innerHTML='<div class="v35ModePanelTitle">'+cfg.title+'</div><div class="v35ModeFields">'+cfg.fields.map(([k,label])=>'<label><span>'+label+'</span><input data-mode-key="'+k+'" value="'+esc(vals[k]||'')+'" placeholder="'+label+'"></label>').join('')+'</div><div class="v35QuickTasks"><span>快速派遣</span>'+cfg.tasks.map(x=>'<button type="button" data-quick-task="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>';root.querySelectorAll('[data-mode-key]').forEach(el=>el.addEventListener('input',scheduleModeDataSave));root.querySelectorAll('[data-quick-task]').forEach(b=>b.onclick=()=>fillQuickTask(b.dataset.quickTask||''))}
function renderAssigneeChoices(){const root=$('v35Assignees');if(!root)return;const keep=new Set([...root.querySelectorAll('input:checked')].map(x=>x.value));root.innerHTML='';users().forEach(u=>{const l=document.createElement('label');l.className='v35Check';l.innerHTML=`<input type="checkbox" value="${u.id}"><span>${esc(u.nick)}</span>`;l.querySelector('input').checked=keep.has(u.id);root.append(l)})}
function renderAssignments(){
  const root=$('v35AssignmentList');if(!root)return;root.innerHTML='';
  const ops=window.__KTAK35_ASSIGNMENTS;
  for(const a of data.assignments){
    const mine=(a.assigned_to||[]).includes(me()),commander=role()==='commander';
    const own=ops.memberStatus(a,me()),pending=ops.pendingFor(a.id),sector=sectorById(a.search_sector_id);
    const d=document.createElement('div');d.className='v35Task priority-'+a.priority;
    const receipts=(a.assigned_to||[]).map(id=>{
      const receipt=a.member_states?.[id];
      return nameOf(id)+'：'+(receipt?.legacy?'舊版整體紀錄 · ':'')+(TASK_STATUS[ops.memberStatus(a,id)]||ops.memberStatus(a,id));
    }).join(' ／ ');
    d.innerHTML='<div class="v35TaskHead"><b>'+esc(a.title)+'</b><span>'+esc(PRIORITY[a.priority]||a.priority)+' · 整體：'+esc(TASK_STATUS[a.status]||a.status)+'</span></div>'+
      (TEMPLATES[a.mission_template]?'<div class="v35TaskMode">'+esc(TEMPLATES[a.mission_template])+'</div>':'')+'<div class="v35TaskBody">'+esc(a.details||'')+'</div><small>'+esc(receipts)+' · '+fmtTime(a.created_at)+'</small>'+
      (a.location_label?'<div class="v35TaskLocation">'+esc(a.location_label)+'</div>':'')+
      (pending?'<p role="status">⏳ '+esc(pending.error||'回報待送，尚未獲得伺服器確認')+'</p>':'')+'<div class="v35TaskActions"></div>';
    const ac=d.querySelector('.v35TaskActions');
    const btn=(txt,status,cls='',command=false)=>{
      const b=document.createElement('button');b.textContent=txt;b.className=cls;b.disabled=!!pending;
      b.onclick=async()=>{b.disabled=true;await updateAssignment(a.id,{status,commander:command});renderAssignments()};ac.append(b);
    };
    if(mine&&own==='pending'){btn('接受','accepted','primary');btn('無法執行','declined')}
    if(mine&&own==='accepted')btn('開始執行','active','primary');
    if(mine&&own==='active')btn('完成我的任務','completed','good');
    if(commander&&!['completed','cancelled'].includes(a.status)){
      btn('取消任務','cancelled','danger',true);btn('指揮官結案','completed','good',true);
    }
    if(sector||Number.isFinite(a.lat)&&Number.isFinite(a.lng)){
      const b=document.createElement('button');b.textContent=sector?'▦ 搜索區':'📍 任務位置';
      b.onclick=()=>sector?focusSectorOnMap(sector):core.openMapAt(a.lat,a.lng,18);ac.append(b);
    }
    root.append(d);
  }
  if(!data.assignments.length)root.innerHTML='<div class="muted">尚無派遣任務。</div>';
}


async function createAssignment(){if(role()!=='commander'){notify('只有指揮官可以派遣任務');return}const title=$('v35TaskTitle').value.trim(),details=$('v35TaskDetails').value.trim(),priority=$('v35TaskPriority').value,assigned=[...$('v35Assignees').querySelectorAll('input:checked')].map(x=>x.value);if(!title){notify('請輸入任務內容');return}if(!assigned.length){notify('至少指派一名隊員');return}const location=resolveTaskLocation();if(taskLocation.mode!=='none'&&!location){notify(taskLocation.mode==='sector'?'請先選擇搜索區':'請先在地圖選擇任務位置');return}const template=$('v35MissionTemplate')?.value||data.profile?.template||'police_tactical';const row={room_id:room(),title,details,priority,assigned_to:assigned,created_by:me(),lat:location?.lat??null,lng:location?.lng??null,search_sector_id:location?.searchSectorId??null,location_label:location?.label||null,mission_template:template,mode_data:modeDataFor(template)};const btn=$('v35CreateTask');if(btn){btn.disabled=true;btn.textContent='派遣中…'}try{const {data:created,error}=await sb().from('ktak35_assignments').insert(row).select('*').single();if(error)throw error;data.assignments.unshift(created||{...row,id:crypto.randomUUID?.()||String(Date.now()),status:'pending',created_at:new Date().toISOString()});if(row.search_sector_id){const s=sectorById(row.search_sector_id);if(s){s.assigned_to=assigned;s.updated_by=me();s.updated_at=new Date().toISOString();renderSectors();sb().from('ktak35_search_sectors').update({assigned_to:assigned,updated_by:me(),updated_at:s.updated_at}).eq('room_id',room()).eq('id',s.id).then(({error:e})=>e&&console.warn('sector assignment link',e))}}renderAssignments();renderSummary();if(created?.id)void pushOperational('assignment',created.id);timeline('assignment_created','派遣任務：'+title,{priority,assigned_to:assigned,search_sector_id:row.search_sector_id,location_label:row.location_label,mission_template:template},assigned[0]||null).catch(e=>console.warn('assignment timeline',e));$('v35TaskTitle').value='';$('v35TaskDetails').value='';resetTaskLocation();notify(row.search_sector_id?'任務已派遣並連結搜索區':'任務已派遣')}catch(e){notify('派遣失敗：'+e.message)}finally{if(btn){btn.disabled=false;btn.textContent='送出派遣'}}}
async function updateAssignment(id,patch,fromQueue=false){
  const item=data.assignments.find(x=>x.id===id),r=room(),u=me();
  try{
    if(fromQueue)throw new Error('舊版派遣回報需要確認目前任務狀態後重新送出');
    const out=await window.__KTAK35_ASSIGNMENTS.respond(item,patch.status,{commander:patch.commander===true});
    if(r!==room()||u!==me())return out;
    if(out.row){Object.assign(item,out.row);renderAssignments();renderSummary();}
    notify(out.queued?'回報已暫存，尚未送達；恢復連線後會重試':'任務回報已送達');
    if(!out.queued)await refreshAll();
    return out;
  }catch(e){notify('任務回報未送達：'+e.message);if(fromQueue)throw e;return {queued:true,error:e};}
}

function renderSos(){const root=$('v35SosList');if(!root)return;root.innerHTML='';const active=data.sos.filter(x=>x.status==='active');active.forEach(x=>{const d=document.createElement('div');d.className='v35SosRow';d.innerHTML=`<div><b>🚨 ${esc(nameOf(x.user_id))}</b><small>${fmtTime(x.created_at)}${Number.isFinite(x.altitude_m)?` · 高度 ${Math.round(x.altitude_m)}m`:''}</small></div><div class="v35TaskActions"></div>`;const ac=d.querySelector('.v35TaskActions');if(Number.isFinite(x.lat)){const b=document.createElement('button');b.textContent='導航至位置';b.onclick=()=>core.openMapAt(x.lat,x.lng,19);ac.append(b)}if(x.user_id===me()||role()==='commander'){const b=document.createElement('button');b.textContent='解除';b.className='good';b.onclick=()=>resolveSos(x.id);ac.append(b)}root.append(d)});if(!active.length)root.innerHTML='<div class="muted">目前沒有 SOS。</div>';renderSosMap(active)}
async function triggerSos(){
  const l=locOf(),row={room_id:room(),user_id:me(),message:'緊急支援',lat:l?.lat??null,lng:l?.lng??null,altitude_m:l?.altitudeM??null};
  try{
    const {data:x,error}=await sb().from('ktak35_sos').insert(row).select('*').single();
    if(error)throw error;
    data.sos.unshift(x||{...row,id:crypto.randomUUID?.()||String(Date.now()),status:'active',created_at:new Date().toISOString()});
    renderSos();renderSummary();
    if(x?.id)void pushOperational('sos',x.id);
    setStatus('emergency','SOS 已觸發').catch(e=>console.warn('SOS status',e));
    timeline('sos','🚨 SOS 緊急支援',{sos_id:x?.id,lat:row.lat,lng:row.lng},me()).catch(e=>console.warn('SOS timeline',e));
    notify('🚨 SOS 已送出給房間成員');
  }catch(e){notify('SOS 送出失敗：'+e.message)}
}
async function resolveSos(id){
  const target=data.sos.find(x=>String(x.id)===String(id))||null;
  const {error}=await sb().from('ktak35_sos').update({status:'resolved',resolved_at:new Date().toISOString(),resolved_by:me()}).eq('room_id',room()).eq('id',id);
  if(error){notify('解除失敗：'+error.message);return}
  const targetId=target?.user_id;
  if(targetId){
    const statusRow=data.status.find(x=>String(x.user_id)===String(targetId));
    if(statusRow?.status==='emergency'&&statusRow?.note==='SOS 已觸發'){
      if(String(targetId)===String(me()))await setStatus('available','');
      else if(role()==='commander'){
        const {error:statusError}=await sb().from('ktak35_member_status').update({status:'available',note:'',updated_at:new Date().toISOString()}).eq('room_id',room()).eq('user_id',targetId).eq('status','emergency').eq('note','SOS 已觸發');
        if(statusError)console.warn('KTAK35 clear resolved SOS status',statusError);
      }
    }
  }
  await timeline('sos_resolved','SOS 已解除',{sos_id:id,user_id:targetId||null},targetId||null);
  await refreshAll()
}
function installSosHold(){const b=$('v35SosHold');if(!b||b.dataset.ready)return;b.dataset.ready='1';let t=null;const start=()=>{if(t)return;b.classList.add('holding');t=setTimeout(()=>{t=null;b.classList.remove('holding');triggerSos()},1500)},cancel=()=>{if(t)clearTimeout(t);t=null;b.classList.remove('holding')};b.addEventListener('pointerdown',e=>{start();b.setPointerCapture?.(e.pointerId);e.preventDefault()});b.addEventListener('pointerup',cancel);b.addEventListener('pointercancel',cancel);b.addEventListener('pointerleave',cancel)}
async function deleteTimelineEntry(id){
  if(role()!=='commander'){notify('只有指揮官可以刪除 Timeline');return}
  if(!confirm('刪除這筆 Timeline 紀錄？'))return;
  const previous=[...data.timeline];data.timeline=data.timeline.filter(x=>String(x.id)!==String(id));renderTimeline();
  const {error}=await sb().from('ktak35_timeline').delete().eq('room_id',room()).eq('id',id);
  if(error){data.timeline=previous;renderTimeline();notify('刪除失敗：'+error.message)}
}
async function clearTimeline(){
  if(role()!=='commander'){notify('只有指揮官可以清空 Timeline');return}
  if(!data.timeline.length)return;
  if(!confirm(`確定清空目前房間的 Timeline（${data.timeline.length} 筆）？此操作無法復原。`))return;
  const previous=[...data.timeline];data.timeline=[];renderTimeline();
  const {error}=await sb().from('ktak35_timeline').delete().eq('room_id',room());
  if(error){data.timeline=previous;renderTimeline();notify('清空失敗：'+error.message)}else notify('Timeline 已清空');
}
function renderTimeline(){
  const root=$('v35Timeline');if(!root)return;root.innerHTML='';const commander=role()==='commander';
  data.timeline.slice(0,80).forEach(x=>{const d=document.createElement('div');d.className='v35TimelineRow';d.innerHTML=`<span>${fmtTime(x.created_at)}</span><div><b>${esc(x.title)}</b><small>${esc(nameOf(x.actor_user_id))}</small></div>`;if(commander){const b=document.createElement('button');b.type='button';b.className='v35TimelineDelete danger';b.textContent='刪除';b.onclick=()=>deleteTimelineEntry(x.id);d.append(b)}root.append(d)});
  if(!data.timeline.length)root.innerHTML='<div class="muted">任務事件會從 V3.5 的派遣、SOS、搜索與樓層狀態開始自動記錄。</div>';
}
function sectorColor(s){return s.status==='complete'?'#55d572':s.status==='searching'?'#45aff2':s.status==='blocked'?'#f25c5c':'#ffc650'}
function initMapLayers(){const map=core.map;if(!map||!window.L)return;if(!searchLayer)searchLayer=L.layerGroup().addTo(map);if(!sosLayer)sosLayer=L.layerGroup().addTo(map);if(!gridLayer)gridLayer=L.layerGroup();if(!searchDraftLayer)searchDraftLayer=L.layerGroup().addTo(map);if(!$('v35ScaleInstalled')){L.control.scale({imperial:false,metric:true,position:'bottomright'}).addTo(map);const m=document.createElement('meta');m.id='v35ScaleInstalled';document.head.append(m)}renderGrid();renderSearchMap();renderSosMap(data.sos.filter(x=>x.status==='active'));map.off('moveend',renderGrid);map.on('moveend',renderGrid);map.off('zoomend',renderGrid);map.on('zoomend',renderGrid)}
function gridStep(z){if(z>=18)return .001;if(z>=16)return .002;if(z>=14)return .01;if(z>=12)return .05;if(z>=10)return .1;if(z>=8)return .5;return 1}
function renderGrid(){if(!gridLayer||!core.map)return;gridLayer.clearLayers();if(core.map.hasLayer(gridLayer))core.map.removeLayer(gridLayer)}
function setMapBearing(deg){mapBearing=((Number(deg)||0)%360+360)%360;const a=$('v35CompassArrow');if(a)a.style.transform=`rotate(${-mapBearing}deg)`;if($('v35CompassDeg'))$('v35CompassDeg').textContent=`${Math.round(mapBearing)}°`}window.ktak35SetMapBearing=setMapBearing;
function renderSearchMap(){if(!searchLayer)return;searchLayer.clearLayers();data.sectors.forEach(s=>{const pts=Array.isArray(s.polygon)?s.polygon:[];if(pts.length<3)return;const p=L.polygon(pts,{color:sectorColor(s),weight:2,fillOpacity:.13}).addTo(searchLayer);p.bindTooltip(`${esc(s.name)} · ${SEARCH[s.status]||s.status} ${s.progress}%`);p.on('click',()=>core.map.fitBounds(p.getBounds(),{padding:[30,30]}))})}
function renderSosMap(active){if(!sosLayer)return;sosLayer.clearLayers();active.forEach(x=>{if(!Number.isFinite(x.lat)||!Number.isFinite(x.lng))return;L.circle([x.lat,x.lng],{radius:40,color:'#ff3333',weight:4,fillOpacity:.18}).addTo(sosLayer);const icon=L.divIcon({className:'',html:'<div class="v35SosPin">SOS</div>',iconSize:[48,48],iconAnchor:[24,24]});L.marker([x.lat,x.lng],{icon,zIndexOffset:9000}).bindTooltip(`SOS · ${esc(nameOf(x.user_id))}`).addTo(sosLayer)})}
function beginSearch(){if(searchDrawing){finishSearch();return}searchDrawing=true;searchPoints=[];$('v35SearchSectorBtn').textContent='✅ 完成搜尋區';$('v35SearchSectorBtnMap').textContent='✅ 完成搜尋區';$('v35SearchCancel').classList.remove('hidden');notify('依序點選地圖建立搜索區，至少 3 點；再按「完成搜尋區」');core.openMapPage?.()}
function cancelSearch(){searchDrawing=false;searchPoints=[];searchDraftLayer?.clearLayers();$('v35SearchSectorBtn').textContent='▦ 建立搜索區';$('v35SearchSectorBtnMap').textContent='▦ 搜索區';$('v35SearchCancel').classList.add('hidden')}
async function finishSearch(){if(searchPoints.length<3){notify('搜索區至少需要 3 個點');return}const name=(prompt('搜索區名稱：',`搜索區 ${data.sectors.length+1}`)||'').trim();if(!name)return;const row={room_id:room(),name,polygon:searchPoints,status:'unsearched',progress:0,created_by:me(),updated_by:me()};const {error}=await sb().from('ktak35_search_sectors').insert(row);if(error){notify('建立搜索區失敗：'+error.message);return}await timeline('search_sector_created',`建立搜索區：${name}`,{points:searchPoints.length});cancelSearch();await refreshAll();notify('搜索區已建立')}
function bindSearchClick(){if(!core.map||core.map.__ktak35SearchBound)return;core.map.__ktak35SearchBound=true;core.map.on('click',e=>{if(!searchDrawing)return;searchPoints.push([e.latlng.lat,e.latlng.lng]);searchDraftLayer.clearLayers();if(searchPoints.length>1)L.polyline(searchPoints,{color:'#ffc650',weight:3,dashArray:'6,5'}).addTo(searchDraftLayer);searchPoints.forEach(p=>L.circleMarker(p,{radius:4,color:'#fff',fillColor:'#ffc650',fillOpacity:1}).addTo(searchDraftLayer))})}
function renderSectors(){const root=$('v35SectorList');if(!root)return;root.innerHTML='';data.sectors.forEach(s=>{const linked=data.assignments.filter(a=>String(a.search_sector_id||'')===String(s.id)),active=linked.filter(a=>!['completed','cancelled','declined'].includes(a.status)),assignees=[...new Set(linked.flatMap(a=>a.assigned_to||[]))].map(nameOf).join('、');const d=document.createElement('div');d.className='v35Sector';d.innerHTML='<div class="v35TaskHead"><b>'+esc(s.name)+'</b><span>'+esc(SEARCH[s.status]||s.status)+' · '+s.progress+'%</span></div>'+(linked.length?'<div class="v35SectorLink">🔗 已連結 '+linked.length+' 個派遣'+(active.length?' · '+active.length+' 個進行中':'')+(assignees?' · '+esc(assignees):'')+'</div>':'')+'<div class="v35SectorControls"><select class="v35SectorStatus"><option value="unsearched">未搜索</option><option value="searching">搜索中</option><option value="complete">完成</option><option value="blocked">受阻</option></select><input class="v35SectorProgress" type="range" min="0" max="100" step="5" value="'+(s.progress||0)+'"><button class="v35SectorMap">📍</button></div><div class="v35SectorQuick"><span>回報進度</span><button data-p="25">25%</button><button data-p="50">50%</button><button data-p="75">75%</button><button data-p="100">完成</button></div>';d.querySelector('select').value=s.status;d.querySelector('select').onchange=e=>updateSector(s.id,{status:e.target.value,progress:e.target.value==='complete'?100:s.progress});d.querySelector('input').onchange=e=>updateSector(s.id,{progress:+e.target.value,status:+e.target.value>=100?'complete':(+e.target.value>0?'searching':s.status)});d.querySelector('.v35SectorMap').onclick=()=>focusSectorOnMap(s);d.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const p=+b.dataset.p;updateSector(s.id,{progress:p,status:p>=100?'complete':'searching'})});root.append(d)});if(!data.sectors.length)root.innerHTML='<div class="muted">尚未建立搜索區。先在任務地圖劃設區域，再於建立派遣時直接選擇該搜索區。</div>'}
async function updateSector(id,patch,fromQueue=false){const runner=async()=>{const p={...patch,updated_by:me(),updated_at:new Date().toISOString()};const {error}=await sb().from('ktak35_search_sectors').update(p).eq('room_id',room()).eq('id',id).select('*').single();if(error)throw error;if(!fromQueue)await timeline('search_sector_updated','搜索區狀態更新',{sector_id:id,...p})};try{return fromQueue?runner():runOrQueue({kind:'sector',id,patch},runner)}catch(e){notify('搜索區更新失敗：'+e.message)}}
function currentFloor(){const s=core.state;return s?.board?.pages?.[s.board.active]||null}
function renderFloor(){const f=currentFloor(),sel=$('v35FloorStatus');if(!f||!sel)return;const r=data.floors.find(x=>x.page_id===f.id);sel.value=r?.status||'unknown';$('v35FloorStatusLabel').textContent=`${f.name||'樓層'} · ${FLOOR[sel.value]||sel.value}`}
async function saveFloor(pageId,status,fromQueue=false){const runner=async()=>{const {error}=await sb().from('ktak35_floor_status').upsert({room_id:room(),page_id:pageId,status,updated_by:me(),updated_at:new Date().toISOString()},{onConflict:'room_id,page_id'}).select('*').single();if(error)throw error;if(!fromQueue)await timeline('floor_status',`樓層狀態：${FLOOR[status]||status}`,{page_id:pageId,status})};return fromQueue?runner():runOrQueue({kind:'floor',pageId,status},runner)}
function applyMissionModeUi(template=data.profile?.template||$('v35MissionTemplate')?.value||'police_tactical'){
  const guide=MISSION_GUIDES[template]||MISSION_GUIDES.custom,page=$('commandPage');
  if(page)page.dataset.missionMode=template;
  const guideEl=$('v35MissionModeGuide');if(guideEl)guideEl.textContent=guide.text;
  const title=$('v35TaskTitle');if(title&&!title.value)title.placeholder=guide.placeholder;
  const targets={people:'v35TeamStatusList',dispatch:'v35AssignmentList',sos:'v35SosHold',search:'v35SearchSectorBtn',weather:'v35DisasterList'};
  document.querySelectorAll('#commandPage .v35Card').forEach(x=>x.classList.remove('v35ModeFocus'));
  for(const key of guide.focus||[]){const el=$(targets[key]);el?.closest?.('.v35Card')?.classList.add('v35ModeFocus')}
}
async function saveTemplate(){if(role()!=='commander'){notify('只有指揮官可以切換任務模板');return}const template=$('v35MissionTemplate').value,previous=data.profile?{...data.profile}:null,profileData=data.profile?.data||{modes:{}};data.profile={...(data.profile||{}),room_id:room(),template,data:profileData,updated_by:me(),updated_at:new Date().toISOString()};$('v35MissionTemplateLabel').textContent=TEMPLATES[template]||template;applyMissionModeUi(template);renderMissionModePanel();try{const {error}=await sb().from('ktak35_mission_profile').upsert({room_id:room(),template,data:profileData,updated_by:me(),updated_at:new Date().toISOString()},{onConflict:'room_id'});if(error)throw error;timeline('mission_template','任務模式：'+(TEMPLATES[template]||template),{template}).catch(e=>console.warn('template timeline',e))}catch(e){data.profile=previous;if(previous){$('v35MissionTemplate').value=previous.template;applyMissionModeUi(previous.template);renderMissionModePanel()}notify('模板更新失敗：'+e.message)}}
function decorateStickers(){document.querySelectorAll('#chatLog .chatText').forEach(el=>{const m=el.textContent.trim().match(/^::K35STICKER::([^:]+)::([^:]+)::(.+)$/);if(!m||el.dataset.sticker)return;el.dataset.sticker='1';el.className='chatText v35StickerMessage';el.innerHTML=`<div class="v35StickerEmoji">${esc(m[2])}</div><b>${esc(m[3])}</b>`})}
function renderStickerTray(){const root=$('v35StickerTray');if(!root||root.children.length)return;STICKERS.forEach(([k,e,t])=>{const b=document.createElement('button');b.type='button';b.innerHTML=`<span>${e}</span><small>${esc(t)}</small>`;b.onclick=()=>{const i=$('chatInput');if(!i)return;i.value=`::K35STICKER::${k}::${e}::${t}`;$('chatSendBtn')?.click();root.classList.remove('open')};root.append(b)});const log=$('chatLog');if(log)new MutationObserver(()=>decorateStickers()).observe(log,{childList:true,subtree:true});decorateStickers()}
const RADAR_URL='https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0058-003.png';
function toggleRadar(){if(!core.map)return;const on=$('v35RadarToggle').checked;if(on){if(radarLayer)core.map.removeLayer(radarLayer);radarLayer=L.imageOverlay(`${RADAR_URL}?t=${Math.floor(Date.now()/600000)}`,[[20.5,118.0],[26.5,124.0]],{opacity:.55,interactive:false,zIndex:350});radarLayer.addTo(core.map)}else if(radarLayer){core.map.removeLayer(radarLayer);radarLayer=null}}
async function refreshDisaster(){
  const root=$('v35DisasterList');if(!root||!sb()||!room())return;
  root.innerHTML='<div class="muted">正在更新政府防災資料…</div>';
  const county=$('v35DisasterCounty'),raw=county?.value||'',label=county?.selectedOptions?.[0]?.textContent?.trim()||'全臺';if(raw==='__choose__'){root.innerHTML='';const u=$('v35DisasterUpdated');if(u)u.textContent='';return;}
  const countyName=raw?label:'';
  let c=core.map?.getCenter?.()||locOf()||{lat:null,lng:null};
  if(raw){const [lat,lng]=raw.split(',').map(Number);if(Number.isFinite(lat)&&Number.isFinite(lng))c={lat,lng}}
  const norm=s=>String(s||'').replace(/台/g,'臺').replace(/\s+/g,'');
  try{
    const {data:r,error}=await sb().functions.invoke('ktak35-disaster',{body:{lat:c.lat,lng:c.lng,county:countyName}});
    if(error)throw error;
    let items=Array.isArray(r?.alerts)?r.alerts:[];
    if(countyName)items=items.filter(x=>norm(x?.county)===norm(countyName));
    root.innerHTML='';
    items.forEach(x=>{const d=document.createElement('div');d.className=`v35DisasterItem level-${x.level||'info'}`;d.innerHTML=`<b>${esc(x.icon||'⚠️')} ${esc(x.title)}</b><div>${esc(x.description||'')}</div><small>${esc(x.source||'政府開放資料')}${x.updatedAt?' · '+fmtTime(x.updatedAt):''}</small>`;root.append(d)});
    if(!items.length)root.innerHTML=`<div class="v35DisasterOk">✅ ${esc(countyName||'全臺')}目前無有效天氣警特報</div>`;
    $('v35DisasterUpdated').textContent=`${countyName||'全臺'} · 更新 ${new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`;
  }catch(e){root.innerHTML=`<div class="muted">防災資料暫時無法取得。可使用下方官方即時平台。<br>${esc(e.message||e)}</div>`}
}
function scheduleDisaster(){clearInterval(disasterTimer);refreshDisaster();disasterTimer=setInterval(refreshDisaster,5*60*1000)}
function renderAll35(){renderSummary();renderSelfStatus();renderAssigneeChoices();renderTaskLocationUi();renderMissionModePanel();renderAssignments();renderSos();renderTimeline();renderSectors();renderFloor();initMapLayers();bindSearchClick();bindTaskLocationClick();renderStickerTray();renderOffline();const t=$('v35MissionTemplate');if(t)t.value=data.profile?.template||'police_tactical';applyMissionModeUi(data.profile?.template||'police_tactical');const commander=role()==='commander';document.querySelectorAll('.v35CommanderOnly').forEach(x=>x.classList.toggle('hidden',!commander));decorateStickers()}
function bindUi(){$('v35MyStatus')?.addEventListener('change',e=>setStatus(e.target.value,$('v35MyStatusNote').value));$('v35MyStatusNote')?.addEventListener('change',e=>setStatus($('v35MyStatus').value,e.target.value));$('v35CreateTask')?.addEventListener('click',createAssignment);$('v35MissionTemplate')?.addEventListener('change',e=>{applyMissionModeUi(e.target.value);renderMissionModePanel();saveTemplate()});$('v35TaskLocationMode')?.addEventListener('change',e=>{taskLocation={mode:e.target.value,lat:null,lng:null,label:'',sectorId:null};taskLocationPicking=false;renderTaskLocationUi()});$('v35PickTaskLocation')?.addEventListener('click',beginTaskLocationPick);$('v35TaskSectorSelect')?.addEventListener('change',e=>{taskLocation={mode:'sector',lat:null,lng:null,label:'',sectorId:e.target.value||null};renderTaskLocationUi()});installSosHold();$('v35SearchSectorBtn')?.addEventListener('click',beginSearch);$('v35SearchSectorBtnMap')?.addEventListener('click',beginSearch);$('v35SearchCancel')?.addEventListener('click',cancelSearch);$('v35GridToggle')?.addEventListener('change',renderGrid);$('v35RadarToggle')?.addEventListener('change',toggleRadar);$('v35DisasterRefresh')?.addEventListener('click',refreshDisaster);$('v35DisasterCounty')?.addEventListener('change',refreshDisaster);$('v35DisasterToggle')?.addEventListener('click',()=>{const body=$('v35DisasterBody'),b=$('v35DisasterToggle');body?.classList.toggle('hidden');if(b)b.textContent=body?.classList.contains('hidden')?'展開':'收合'});$('v35TimelineToggle')?.addEventListener('click',()=>{const body=$('v35TimelineBody'),b=$('v35TimelineToggle');body?.classList.toggle('hidden');if(b)b.textContent=body?.classList.contains('hidden')?'展開':'收合'});$('v35TimelineClear')?.addEventListener('click',clearTimeline);$('v35FloorStatus')?.addEventListener('change',e=>{const f=currentFloor();if(f)saveFloor(f.id,e.target.value).then(refreshAll)});$('v35StickerBtn')?.addEventListener('click',()=>$('v35StickerTray')?.classList.toggle('open'));document.querySelector('[data-page="commandPage"]')?.addEventListener('click',()=>setTimeout(()=>{ensureRuntime();refreshDisaster()},30));document.querySelector('[data-page="boardPage"]')?.addEventListener('click',()=>setTimeout(renderFloor,80));setMapBearing(0);renderOffline()}
window.__KTAK35={onCoreRender:ensureRuntime,setMapBearing,refresh:refreshAll,setRadarFrame:(url,frameBounds)=>{if(!core.map||!url)return false;const fallback=[[20.5,118.0],[26.5,124.0]],bounds=Array.isArray(frameBounds)&&frameBounds.length===2?frameBounds:fallback;if(!radarLayer){radarLayer=L.imageOverlay(url,bounds,{opacity:.55,interactive:false,zIndex:350});radarLayer.addTo(core.map)}else{if(typeof radarLayer.setBounds==='function')radarLayer.setBounds(bounds);radarLayer.setUrl(url);if(!core.map.hasLayer(radarLayer))radarLayer.addTo(core.map)}const t=$('v35RadarToggle');if(t&&!t.checked)t.checked=true;return true},showLatestRadar:()=>{const t=$('v35RadarToggle');if(t&&!t.checked)t.checked=true;toggleRadar()},setDispatchLocation:loc=>{const lat=Number(loc?.lat),lng=Number(loc?.lng);if(Number.isFinite(lat)&&Number.isFinite(lng))taskLocation={mode:'point',lat,lng,label:String(loc?.label||'主任務位置'),sectorId:null};else taskLocation={mode:'none',lat:null,lng:null,label:'',sectorId:null};taskLocationPicking=false;renderTaskLocationUi();return resolveTaskLocation()},focusSector:id=>{const s=sectorById(id);if(s)focusSectorOnMap(s)}};bindUi();setInterval(()=>{if(core.state&&room()&&roomKey!==room())ensureRuntime().catch(e=>console.warn('KTAK35 runtime',e))},10000);refreshTimer=setInterval(()=>{if(core.state&&room()&&document.visibilityState!=='hidden')refreshAll(false).then(renderAll35).catch(e=>console.warn('KTAK35 fallback refresh',e))},300000);
})();

