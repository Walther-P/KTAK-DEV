(() => {
'use strict';
// ktak-v35-assignment-prompt-v14
const core=window.__KTAK35_CORE;
if(!core)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const ACTIVE=new Set(['pending','accepted','active']);
let roomKey='',channel=null,current=null,pollTimer=null,lastShownKey='',visiblePromptId='';

function room(){return core.roomUuid}
function me(){return core.userId}
function sb(){return core.sb}
function promptSeenStorageKey(){return `ktak35.assignmentPrompt.v356.${room()||'none'}.${me()||'none'}`}
function promptStateKey(a){return a?.id&&a?.status?String(a.id)+':'+String(a.status):''}
function readPromptSeen(){try{const x=JSON.parse(localStorage.getItem(promptSeenStorageKey())||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function wasPromptSeen(a){const k=promptStateKey(a);return !!k&&readPromptSeen().includes(k)}
function markPromptSeen(a){const k=promptStateKey(a);if(!k)return;try{const list=readPromptSeen().filter(x=>x!==k);list.push(k);localStorage.setItem(promptSeenStorageKey(),JSON.stringify(list.slice(-240)))}catch{}}
function hidePrompt(a=null){if(a)markPromptSeen(a);const root=document.getElementById('v35AssignmentPrompt14');if(root)root.classList.add('hidden');visiblePromptId=''}
function memberView(a){return window.__KTAK35_ASSIGNMENTS.memberView(a,me())}
function isMine(a){return !!a&&Array.isArray(a.assigned_to)&&a.assigned_to.includes(me())}
function rank(a){return a?.status==='active'?3:a?.status==='accepted'?2:a?.status==='pending'?1:0}
function placeText(a){return a?.search_sector_id?'▦ 已連結搜索區':(Number.isFinite(a?.lat)&&Number.isFinite(a?.lng)?'📍 已設定任務位置':'未設定任務位置')}

function ensureStyle(){
 if($('v35AssignmentPrompt14Style'))return;
 const s=document.createElement('style');s.id='v35AssignmentPrompt14Style';s.textContent=`
/* v14 supersedes the older V9 assignment modal */
.v35AssignmentActionModal{display:none!important}
.v35AssignmentPrompt14{position:fixed;inset:0;z-index:32000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(3px)}
.v35AssignmentPrompt14.hidden{display:none!important}
.v35AssignmentPrompt14Card{width:min(680px,100%);max-height:calc(100dvh - 36px);overflow:auto;background:#0c1b22;border:3px solid #56b5e9;border-radius:22px;padding:22px;box-shadow:0 26px 90px #000f,0 0 0 1px #8bd7ff33;color:#eef9fd}
.v35AssignmentPrompt14Card.priority-high{border-color:#f4a84a}.v35AssignmentPrompt14Card.priority-critical{border-color:#ff5f67;background:#281318;box-shadow:0 26px 90px #000f,0 0 28px #ff5f6744}
.v35AssignmentPrompt14Eyebrow{font-size:13px;font-weight:900;color:#8fd8ff;letter-spacing:.04em;margin-bottom:8px}.v35AssignmentPrompt14Card.priority-critical .v35AssignmentPrompt14Eyebrow{color:#ff9ca2}
.v35AssignmentPrompt14Title{font-size:27px;line-height:1.25;margin:0 0 10px}.v35AssignmentPrompt14Body{font-size:17px;line-height:1.6;white-space:pre-wrap;margin:12px 0;color:#edf7fa}
.v35AssignmentPrompt14Meta{font-size:14px;line-height:1.6;color:#b9cbd3;border-top:1px solid #35515f;border-bottom:1px solid #35515f;padding:11px 0;margin:14px 0}
.v35AssignmentPrompt14Actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v35AssignmentPrompt14Actions button{min-height:50px;border-radius:12px;font-size:15px;font-weight:900}.v35AssignmentPrompt14Actions .primary{grid-column:1/-1;min-height:62px;font-size:18px;background:#1479b5;border-color:#5fc4ff;color:white}.v35AssignmentPrompt14Actions .danger{border-color:#8d4b50;color:#ffb2b7}
.v35AssignmentPrompt14Later{width:100%;margin-top:10px;min-height:42px;font-size:13px;color:#aec3cc;background:#122630;border:1px solid #35515f;border-radius:10px}
@media(max-width:820px){.v35AssignmentPrompt14{align-items:flex-end;padding:0}.v35AssignmentPrompt14Card{width:100%;max-height:90dvh;border-radius:22px 22px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom));border-width:3px}.v35AssignmentPrompt14Title{font-size:24px}.v35AssignmentPrompt14Body{font-size:16px}.v35AssignmentPrompt14Meta{font-size:13px}.v35AssignmentPrompt14Actions{grid-template-columns:1fr}.v35AssignmentPrompt14Actions .primary{grid-column:auto;min-height:60px;font-size:17px}}
`;
 document.head.append(s);
}

function ensurePrompt(){
 ensureStyle();let root=$('v35AssignmentPrompt14');if(root)return root;
 root=document.createElement('div');root.id='v35AssignmentPrompt14';root.className='v35AssignmentPrompt14 hidden';
 root.innerHTML='<div id="v35AssignmentPrompt14Card" class="v35AssignmentPrompt14Card"><div id="v35AssignmentPrompt14Eyebrow" class="v35AssignmentPrompt14Eyebrow">📣 新任務派遣</div><h2 id="v35AssignmentPrompt14Title" class="v35AssignmentPrompt14Title"></h2><div id="v35AssignmentPrompt14Body" class="v35AssignmentPrompt14Body"></div><div id="v35AssignmentPrompt14Meta" class="v35AssignmentPrompt14Meta"></div><div id="v35AssignmentPrompt14Actions" class="v35AssignmentPrompt14Actions"></div><button id="v35AssignmentPrompt14Later" class="v35AssignmentPrompt14Later" type="button">稍後處理</button></div>';
 document.body.append(root);$('v35AssignmentPrompt14Later').onclick=()=>hidePrompt(current);return root;
}
function btn(text,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;if(cls)b.className=cls;b.onclick=fn;return b}

async function openTaskLocation(a=current){
 if(!a)return;core.openMapPage?.();
 if(a.search_sector_id&&sb()&&room()){
  const {data:s}=await sb().from('ktak35_search_sectors').select('polygon').eq('room_id',room()).eq('id',a.search_sector_id).maybeSingle();
  const pts=Array.isArray(s?.polygon)?s.polygon:[];
  if(pts.length&&core.map&&window.L){setTimeout(()=>core.map.fitBounds(L.latLngBounds(pts),{padding:[36,36]}),80);return}
 }
 if(Number.isFinite(a.lat)&&Number.isFinite(a.lng)){core.openMapAt?.(a.lat,a.lng,18);return}
 core.toast?.('這個任務沒有設定地圖位置');
}
async function updateStatus(a,status){
 if(!a||!sb())return false;
 markPromptSeen(a);
 const r=room(),u=me();
 try{
  const out=await window.__KTAK35_ASSIGNMENTS.respond(a,status);
  if(r!==room()||u!==me())return false;
  if(out.queued){hidePrompt(a);core.toast?.('回報已暫存，尚未送達；恢復連線後會重試');return false}
  current=window.__KTAK35_ASSIGNMENTS.memberView(out.row,me());
  if(current)markPromptSeen(current);
  hidePrompt(current||a);
  await window.__KTAK35?.refresh?.();await refresh(false);
  return true;
 }catch(e){core.toast?.('任務回報未送達：'+(e?.message||e));return false}
}

function renderPrompt(a,force=false){
 a=memberView(a);if(a?.room_id!==room())return;
 if(!a||!isMine(a)||!ACTIVE.has(a.status))return;
 const key=room()+':'+me()+':'+a.id+':'+a.status;if(!force&&a.status!=='pending')return;if(!force&&(wasPromptSeen(a)||key===lastShownKey))return;lastShownKey=key;current=a;visiblePromptId=String(a.id||'');if(!force)markPromptSeen(a);
 const root=ensurePrompt(),card=$('v35AssignmentPrompt14Card'),actions=$('v35AssignmentPrompt14Actions');
 card.className='v35AssignmentPrompt14Card priority-'+(a.priority||'normal');
 $('v35AssignmentPrompt14Eyebrow').textContent=a.status==='pending'?'📣 新任務派遣':a.status==='accepted'?'✅ 任務已接受':'🎯 任務執行中';
 $('v35AssignmentPrompt14Title').textContent=a.title||'未命名任務';
 $('v35AssignmentPrompt14Body').textContent=a.details||'（無補充說明）';
 $('v35AssignmentPrompt14Meta').innerHTML='狀態：<b>'+esc(a.status==='pending'?'等待接受':a.status==='accepted'?'等待開始':'執行中')+'</b><br>優先度：<b>'+esc(a.priority||'normal')+'</b><br>'+esc(placeText(a))+(a.location_label?'<br>'+esc(a.location_label):'');
 actions.innerHTML='';
 if(a.status==='pending'){
  actions.append(btn('✅ 接受並開始執行',async()=>{if(await updateStatus(a,'active'))core.toast?.('已接受並開始執行')},'primary'));
  actions.append(btn('接受任務',()=>updateStatus(a,'accepted')));
  actions.append(btn('無法執行',()=>updateStatus(a,'declined'),'danger'));
 }
 if(a.status==='accepted'){
  actions.append(btn('▶ 開始執行',async()=>{if(await updateStatus(a,'active'))core.toast?.('已開始執行')},'primary'));
  actions.append(btn('🎯 查看任務區',()=>openTaskLocation(a)));
 }
 if(a.status==='active'){
  actions.append(btn('🎯 前往任務區',()=>openTaskLocation(a),'primary'));
  actions.append(btn('✓ 完成任務',()=>updateStatus(a,'completed')));
 }
 if(window.__KTAK35_ASSIGNMENTS.pendingFor(a.id)){actions.querySelectorAll('button').forEach(b=>b.disabled=true);const note=document.createElement('p');note.textContent='⏳ 此任務回報待送，尚未確認送達';actions.append(note);}
 root.classList.remove('hidden');
 try{navigator.vibrate?.(a.priority==='critical'?[180,90,180,90,300]:[120,70,160])}catch{}
}

function chooseTask(rows){return (rows||[]).map(memberView).filter(x=>isMine(x)&&ACTIVE.has(x.status)).sort((a,b)=>rank(b)-rank(a)||new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null}
function chooseUnseenPending(rows){return (rows||[]).map(memberView).filter(x=>isMine(x)&&x.status==='pending'&&!wasPromptSeen(x)).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0]||null}
async function refresh(show=true){
 if(!room()||!me()||!sb())return;
 const r=room(),u=me();const {data,error}=await sb().from('ktak35_assignments').select('*').eq('room_id',r).contains('assigned_to',[u]).in('status',['pending','accepted','active']).order('created_at',{ascending:false}).limit(100);
 if(error){console.warn('v14 assignment refresh',error);return}
 if(r!==room()||u!==me())return;
 const views=(data||[]).map(memberView).filter(isMine);current=chooseTask(data);
 if(visiblePromptId){const shown=views.find(x=>String(x.id)===String(visiblePromptId));if(!shown||shown.status!=='pending')hidePrompt(shown||null)}
 if(show){const pending=chooseUnseenPending(data);if(pending)renderPrompt(pending,false)}
 if(!current&&visiblePromptId)hidePrompt(null);
}
async function setupRealtime(){
 const r=room();if(!r||!sb()||r===roomKey)return;try{await sb().realtime.setAuth()}catch(e){console.warn('KTAK35 v14 realtime auth',e);return}roomKey=r;current=null;lastShownKey='';hidePrompt(null);
 if(channel)try{await sb().removeChannel(channel)}catch{}
 channel=sb().channel('ktak35-assignment-prompt-v14:'+r,{config:{private:true}})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'ktak35_assignments',filter:'room_id=eq.'+r},payload=>{if(r!==room())return;const a=memberView(payload.new);if(isMine(a)&&a.status==='pending')renderPrompt(a,false)})
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ktak35_assignments',filter:'room_id=eq.'+r},payload=>{if(r!==room())return;const a=memberView(payload.new);if(isMine(a)&&ACTIVE.has(a.status)){current=a;if(a.status==='pending')renderPrompt(a,false);else if(String(visiblePromptId)===String(a.id))hidePrompt(a)}else if(String(visiblePromptId)===String(a?.id))hidePrompt(a)})
  .subscribe(status=>{if(status==='SUBSCRIBED')refresh(true);else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')roomKey=''});
}
async function boot(){
 ensurePrompt();
 if(room()&&me()){await setupRealtime();await refresh(true)}
 clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(room()&&me()){if(roomKey!==room())await setupRealtime();await refresh(false)}},8000);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(true)});
setTimeout(boot,350);
window.__KTAK35_ASSIGNMENT_PROMPT14={version:14,revision:'14.2-v356',refresh,show:a=>renderPrompt(a,true),openTaskLocation,getState:()=>({room:room(),user:me(),current:current?{id:current.id,status:current.status,title:current.title}:null,visible:!ensurePrompt().classList.contains('hidden'),visiblePromptId,realtimeRoom:roomKey})};
})();

