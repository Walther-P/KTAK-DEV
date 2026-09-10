(() => {
'use strict';
// ktak-v35-field-v9-runtime
const core=window.__KTAK35_CORE;
if(!core)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FINAL=new Set(['completed','cancelled','declined']);
let roomKey='',channel=null,currentTask=null,lastModalKey='',refreshTimer=null;

function room(){return core.roomUuid}
function me(){return core.userId}
function sb(){return core.sb}
function notify(t){core.toast?.(t)}
function memberView(a){return window.__KTAK35_ASSIGNMENTS.memberView(a,me())}
function isMine(a){return Array.isArray(a?.assigned_to)&&a.assigned_to.includes(me())}
function rank(a){return a?.status==='active'?3:a?.status==='accepted'?2:a?.status==='pending'?1:0}
function taskPlace(a){return a?.search_sector_id?'▦ 已連結搜索區':(Number.isFinite(a?.lat)&&Number.isFinite(a?.lng)?'📍 已設定任務位置':'未設定任務位置')}

function ensureStyle(){
 if($('v35FieldV9Style'))return;
 const s=document.createElement('style');s.id='v35FieldV9Style';s.textContent=`
/* ktak-v35-field-v9 */
.v35OfflineBanner{top:calc(5px + env(safe-area-inset-top))!important;right:8px!important;left:auto!important;transform:none!important;font-size:11px!important;padding:5px 9px!important;max-width:46vw!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.v35AssignmentActionModal{position:fixed;inset:0;z-index:20050;background:#0009;display:grid;place-items:center;padding:18px}.v35AssignmentActionModal.hidden{display:none!important}.v35AssignmentActionCard{width:min(620px,100%);max-height:min(760px,calc(100vh - 36px));overflow:auto;border:2px solid #56839a;border-radius:18px;background:#0d1b22;box-shadow:0 20px 70px #000d;padding:18px}.v35AssignmentActionCard.priority-critical{border-color:#ff5f67;background:#271317}.v35AssignmentActionCard.priority-high{border-color:#d79b49}.v35AssignmentActionHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.v35AssignmentActionHead h2{margin:0;font-size:22px;line-height:1.25}.v35AssignmentActionState{font-size:12px;font-weight:900;border:1px solid #46697a;border-radius:999px;padding:5px 8px;white-space:nowrap}.v35AssignmentActionBody{font-size:15px;line-height:1.55;white-space:pre-wrap;margin:13px 0;color:#e7f2f6}.v35AssignmentActionMeta{font-size:12px;line-height:1.55;color:#abc0c9;border-top:1px solid #2c4652;border-bottom:1px solid #2c4652;padding:9px 0;margin-bottom:12px}.v35AssignmentActionButtons{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v35AssignmentActionButtons button{min-height:48px;font-size:14px;font-weight:900}.v35AssignmentActionButtons .primary{grid-column:1/-1;min-height:56px;font-size:16px}.v35AssignmentActionClose{margin-top:9px;width:100%;font-size:12px!important}.v35ActiveTaskShortcut{border:2px solid #50a7d5;border-radius:12px;background:#0c2633;padding:10px;margin:8px 0;box-shadow:0 4px 16px #0005}.v35ActiveTaskShortcut b{display:block;font-size:13px;margin-bottom:3px}.v35ActiveTaskShortcut small{display:block;font-size:11px!important;line-height:1.4;color:#b3cad4}.v35ActiveTaskShortcutActions{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.v35ActiveTaskShortcutActions button{font-size:12px!important;padding:7px 9px!important;min-height:36px}.v35ActiveTaskMapBtn{position:absolute;z-index:970;left:10px;top:10px;border:2px solid #5bb7e8!important;background:#0c2633eF!important;color:#ecf9ff!important;border-radius:999px!important;padding:8px 11px!important;font-size:12px!important;font-weight:900!important;box-shadow:0 5px 18px #0009}.v35ActiveTaskMapBtn.hidden{display:none!important}
.v35CommandShell{font-size:13px!important}.v35Card h3{font-size:15px!important}.v35Card .muted,.v35Card small,.v35Task small,.v35StatusRow,.v35StatusRow small,.v35TimelineRow,.v35TimelineRow small,.v35MissionModeGuide,.v35ModeFields label,.v35QuickTasks>span,.v35TaskMode,.v35TaskLocation,.v35SectorLink,.v35SectorQuick span,.v35RadarPlaybackStatus,.v35MetricGridLabel{font-size:11px!important;line-height:1.45!important}.v35TaskBody,.v35DisasterItem,.v35DisasterOk{font-size:12px!important;line-height:1.5!important}.v35Card button,.v35Card select,.v35Card input,.v35Card textarea,.v35RadarTools button,.v35RadarTools select,.v35RadarTools label,.v35RadarTools a{font-size:12px!important}.v35RadarTools>div span{font-size:11px!important;line-height:1.45!important}.mapSidebar .muted,.mapSidebar small{font-size:11px!important;line-height:1.45!important}
@media(max-width:820px){.v35OfflineBanner{top:calc(3px + env(safe-area-inset-top))!important;right:5px!important;max-width:44vw!important;font-size:10px!important}.v35AssignmentActionModal{padding:0;place-items:end center}.v35AssignmentActionCard{width:100%;max-height:86vh;border-radius:18px 18px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom))}.v35AssignmentActionHead h2{font-size:20px}.v35AssignmentActionBody{font-size:14px}.v35AssignmentActionButtons{grid-template-columns:1fr}.v35AssignmentActionButtons .primary{grid-column:auto}.v35ActiveTaskMapBtn{top:8px;left:8px;max-width:58vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v35Card button,.v35Card select,.v35Card input,.v35Card textarea{font-size:13px!important}}
`;
 document.head.append(s);
}

function ensureModal(){
 let m=$('v35AssignmentActionModal');if(m)return m;
 m=document.createElement('div');m.id='v35AssignmentActionModal';m.className='v35AssignmentActionModal hidden';m.innerHTML='<div id="v35AssignmentActionCard" class="v35AssignmentActionCard"><div class="v35AssignmentActionHead"><h2 id="v35AssignmentActionTitle">接獲派遣</h2><span id="v35AssignmentActionState" class="v35AssignmentActionState">待處理</span></div><div id="v35AssignmentActionBody" class="v35AssignmentActionBody"></div><div id="v35AssignmentActionMeta" class="v35AssignmentActionMeta"></div><div id="v35AssignmentActionButtons" class="v35AssignmentActionButtons"></div><button id="v35AssignmentActionClose" class="v35AssignmentActionClose" type="button">稍後處理</button></div>';
 document.body.append(m);$('v35AssignmentActionClose').onclick=()=>m.classList.add('hidden');return m;
}

async function sectorFor(a){if(!a?.search_sector_id||!sb()||!room())return null;const {data}=await sb().from('ktak35_search_sectors').select('*').eq('room_id',room()).eq('id',a.search_sector_id).maybeSingle();return data||null}
async function openTaskLocation(a=currentTask){
 if(!a)return;
 core.openMapPage?.();
 if(a.search_sector_id){const s=await sectorFor(a),pts=Array.isArray(s?.polygon)?s.polygon:[];if(pts.length&&core.map&&window.L){setTimeout(()=>core.map.fitBounds(L.latLngBounds(pts),{padding:[36,36]}),80);return}}
 if(Number.isFinite(a.lat)&&Number.isFinite(a.lng)){core.openMapAt?.(a.lat,a.lng,18);return}
 notify('這個任務沒有設定地圖位置');
}

async function updateTask(a,status){
 if(!a||!sb())return false;
 const r=room(),u=me();
 try{
  const out=await window.__KTAK35_ASSIGNMENTS.respond(a,status);
  if(r!==room()||u!==me())return false;
  if(out.queued){notify('回報已暫存，尚未送達；恢復連線後會重試');renderModal(a,true);return false}
  currentTask=window.__KTAK35_ASSIGNMENTS.memberView(out.row,me());
  await window.__KTAK35?.refresh?.();await loadTasks(false);
  if(['completed','declined','cancelled'].includes(status)){document.getElementById('v35AssignmentActionModal')?.classList.add('hidden')}else renderModal(currentTask,true);
  return true;
 }catch(e){notify('任務回報未送達：'+(e?.message||e));return false}
}

function button(text,handler,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;if(cls)b.className=cls;b.onclick=handler;return b}
function renderModal(a,force=false){
 a=memberView(a);if(a?.room_id!==room())return;
 if(!a||!['pending','accepted','active'].includes(a.status))return;
 const key=room()+':'+me()+':'+a.id+':'+a.status;if(!force&&key===lastModalKey)return;lastModalKey=key;
 const m=ensureModal(),card=$('v35AssignmentActionCard');card.className='v35AssignmentActionCard priority-'+(a.priority||'normal');$('v35AssignmentActionTitle').textContent=(a.status==='pending'?'📥 接獲派遣':a.status==='accepted'?'✅ 已接受派遣':'🎯 任務執行中')+'｜'+a.title;
 $('v35AssignmentActionState').textContent=a.status==='pending'?'等待接受':a.status==='accepted'?'等待開始':'執行中';$('v35AssignmentActionBody').textContent=a.details||'（無補充說明）';$('v35AssignmentActionMeta').innerHTML='優先度：<b>'+esc(a.priority||'normal')+'</b><br>'+esc(taskPlace(a))+(a.location_label?'<br>'+esc(a.location_label):'');
 const root=$('v35AssignmentActionButtons');root.innerHTML='';
 if(a.status==='pending'){
  root.append(button('接受並開始執行',async()=>{if(await updateTask(a,'active')){renderModal(currentTask,true);notify('已開始執行任務')}},'primary'));
  root.append(button('接受任務',async()=>{if(await updateTask(a,'accepted'))renderModal(currentTask,true)}));
  root.append(button('無法執行',async()=>{if(await updateTask(a,'declined'))m.classList.add('hidden')}));
 }
 if(a.status==='accepted'){
  root.append(button('開始執行',async()=>{if(await updateTask(a,'active')){renderModal(currentTask,true);notify('已開始執行任務')}},'primary'));
  root.append(button('📍 先看任務區',()=>openTaskLocation(a)));
 }
 if(a.status==='active'){
  root.append(button('🎯 前往任務區',()=>openTaskLocation(a),'primary'));
  root.append(button('完成任務',async()=>{if(await updateTask(a,'completed'))m.classList.add('hidden')}));
 }
 if(window.__KTAK35_ASSIGNMENTS.pendingFor(a.id)){root.querySelectorAll('button').forEach(b=>b.disabled=true);}
 m.classList.remove('hidden');
}

function ensureShortcut(){
 let s=$('v35ActiveTaskShortcut');if(!s){s=document.createElement('div');s.id='v35ActiveTaskShortcut';s.className='v35ActiveTaskShortcut hidden';const host=document.querySelector('#mapPage .mapSidebar')||document.querySelector('.mapSidebar');if(host)host.prepend(s)}
 let f=$('v35ActiveTaskMapBtn');if(!f){f=document.createElement('button');f.id='v35ActiveTaskMapBtn';f.type='button';f.className='v35ActiveTaskMapBtn hidden';const map=$('map');if(map?.parentElement){const p=map.parentElement;if(getComputedStyle(p).position==='static')p.style.position='relative';p.append(f)}f.onclick=()=>openTaskLocation(currentTask)}
 return s;
}
function renderShortcut(a){
 a=memberView(a);if(a?.room_id!==room())a=null;
 const s=ensureShortcut(),f=$('v35ActiveTaskMapBtn');if(!s||!f)return;
 if(!a||FINAL.has(a.status)){s.classList.add('hidden');f.classList.add('hidden');return}
 s.classList.remove('hidden');s.innerHTML='<b>'+(a.status==='active'?'🎯 執行中：':a.status==='accepted'?'✅ 已接受：':'📥 待接受：')+esc(a.title)+'</b><small>'+esc(taskPlace(a))+'</small><div class="v35ActiveTaskShortcutActions"></div>';
 const ac=s.querySelector('.v35ActiveTaskShortcutActions');
 if(a.status==='pending')ac.append(button('處理派遣',()=>renderModal(a,true),'primary'));
 if(a.status==='accepted')ac.append(button('開始執行',()=>updateTask(a,'active').then(ok=>ok&&renderModal(currentTask,true)),'primary'));
 ac.append(button('🎯 前往任務區',()=>openTaskLocation(a)));
 f.textContent=(a.status==='active'?'🎯 ':'📥 ')+a.title;f.classList.remove('hidden');
}

async function loadTasks(showPending=true){
 if(!room()||!me()||!sb())return;
 const r=room(),u=me();const {data,error}=await sb().from('ktak35_assignments').select('*').eq('room_id',r).contains('assigned_to',[u]).in('status',['pending','accepted','active']).order('created_at',{ascending:false}).limit(100);
 if(error){console.warn('v9 assignments',error);return}
 if(r!==room()||u!==me())return;const mine=(data||[]).map(memberView).filter(x=>isMine(x)&&!FINAL.has(x.status)).sort((a,b)=>rank(b)-rank(a)||new Date(b.created_at)-new Date(a.created_at));currentTask=mine[0]||null;renderShortcut(currentTask);
 if(showPending&&currentTask&&['pending','accepted'].includes(currentTask.status))renderModal(currentTask,false);
}
async function setupRealtime(){
 const r=room();if(!r||!sb()||r===roomKey)return;try{await sb().realtime.setAuth()}catch(e){console.warn('KTAK35 v9 realtime auth',e);return}roomKey=r;currentTask=null;lastModalKey='';renderShortcut(null);ensureModal().classList.add('hidden');if(channel)try{await sb().removeChannel(channel)}catch{}
 channel=sb().channel('ktak35:v9-assignment:'+r,{config:{private:true}}).on('postgres_changes',{event:'*',schema:'public',table:'ktak35_assignments',filter:'room_id=eq.'+r},payload=>{if(r!==room())return;const row=memberView(payload.new||payload.old);if(row&&isMine(row)){loadTasks(false).then(()=>{if(payload.eventType==='INSERT'&&row.status==='pending')renderModal(row,true);else if(payload.eventType==='UPDATE'&&['pending','accepted'].includes(row.status))renderModal(row,true)})}else loadTasks(false)}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')roomKey=''});
}
function tick(){ensureStyle();ensureModal();ensureShortcut();if(room()&&room()!==roomKey){setupRealtime();loadTasks(true)}else if(room())loadTasks(false)}
ensureStyle();setTimeout(tick,350);setInterval(tick,5000);refreshTimer=setInterval(()=>loadTasks(false),30000);
})();

