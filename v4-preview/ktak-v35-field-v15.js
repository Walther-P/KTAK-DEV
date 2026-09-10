(() => {
'use strict';
// ktak-v35-field-v15
const core=window.__KTAK35_CORE;
if(!core)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sosRoom='',sosChannel=null,sosPoll=null,currentSos=null;

function room(){return core.roomUuid}
function me(){return core.userId}
function sb(){return core.sb}
function dismissedKey(){return `ktak35.sos.dismissed.${room()||'none'}`}
function dismissed(){try{return new Set(JSON.parse(sessionStorage.getItem(dismissedKey())||'[]'))}catch{return new Set()}}
function rememberDismissed(id){const s=dismissed();s.add(id);try{sessionStorage.setItem(dismissedKey(),JSON.stringify([...s].slice(-50)))}catch{}}

function ensureStyle(){
 if($('v35FieldV15Style'))return;
 const s=document.createElement('style');s.id='v35FieldV15Style';s.textContent=`
/* KTAK V3.5 field v15 */
.v35ActiveTaskMapBtn{left:62px!important;top:10px!important;max-width:min(48vw,420px)!important;cursor:pointer!important;z-index:960!important}.v35ActiveTaskMapBtn::after{content:' · 點擊查看';font-size:10px;opacity:.8}
.v35SosPrompt15{position:fixed;inset:0;z-index:34000;background:rgba(24,0,2,.78);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)}.v35SosPrompt15.hidden{display:none!important}.v35SosPrompt15Card{width:min(700px,100%);max-height:calc(100dvh - 36px);overflow:auto;background:#2a1014;border:4px solid #ff4d58;border-radius:22px;padding:22px;color:#fff2f2;box-shadow:0 0 0 1px #ff9aa055,0 28px 100px #000f,0 0 46px #ff253955}.v35SosPrompt15Eyebrow{font-size:15px;font-weight:1000;letter-spacing:.06em;color:#ff9ca5;margin-bottom:8px}.v35SosPrompt15Title{font-size:30px;line-height:1.2;margin:0 0 10px}.v35SosPrompt15Body{font-size:17px;line-height:1.6;white-space:pre-wrap}.v35SosPrompt15Meta{font-size:14px;line-height:1.65;color:#ffd5d8;border-top:1px solid #7f3940;border-bottom:1px solid #7f3940;margin:14px 0;padding:11px 0}.v35SosPrompt15Actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v35SosPrompt15Actions button{min-height:52px;border-radius:12px;font-size:15px;font-weight:900}.v35SosPrompt15Actions .primary{grid-column:1/-1;min-height:64px;font-size:19px;background:#b51f2b;border-color:#ff7780;color:#fff}.v35SosPrompt15Later{width:100%;margin-top:10px;min-height:42px;background:#351a1d;border:1px solid #764148;border-radius:10px;color:#e9bfc2}
@media(max-width:820px){.v35ActiveTaskMapBtn{left:58px!important;top:8px!important;max-width:56vw!important}.v35SosPrompt15{align-items:flex-end;padding:0}.v35SosPrompt15Card{width:100%;max-height:92dvh;border-radius:22px 22px 0 0;padding:20px 16px calc(18px + env(safe-area-inset-bottom))}.v35SosPrompt15Title{font-size:26px}.v35SosPrompt15Actions{grid-template-columns:1fr}.v35SosPrompt15Actions .primary{grid-column:auto}}
@media(orientation:landscape) and (max-height:520px){.v35Compass{top:auto!important;bottom:8px!important;right:8px!important;width:42px!important;height:50px!important;opacity:.72!important;z-index:720!important}.v35CompassArrow{font-size:22px!important}.v35Compass small{font-size:7px!important;margin-top:-4px!important}.v35ActiveTaskMapBtn{left:58px!important;top:6px!important;max-width:42vw!important}.v35MapModeHud.active{bottom:8px!important;max-width:55vw!important}.v35SosPrompt15Card{max-height:100dvh;border-radius:16px;padding:14px 16px}.v35SosPrompt15Title{font-size:23px}.v35SosPrompt15Body{font-size:15px}.v35SosPrompt15Meta{font-size:12px;margin:8px 0;padding:7px 0}.v35SosPrompt15Actions button{min-height:44px}.v35SosPrompt15Actions .primary{min-height:50px;font-size:16px}}
`;
 document.head.append(s);
}

function ensureSosPrompt(){
 ensureStyle();let root=$('v35SosPrompt15');if(root)return root;
 root=document.createElement('div');root.id='v35SosPrompt15';root.className='v35SosPrompt15 hidden';
 root.innerHTML='<div class="v35SosPrompt15Card"><div class="v35SosPrompt15Eyebrow">🚨 SOS 緊急支援</div><h2 id="v35SosPrompt15Title" class="v35SosPrompt15Title"></h2><div id="v35SosPrompt15Body" class="v35SosPrompt15Body"></div><div id="v35SosPrompt15Meta" class="v35SosPrompt15Meta"></div><div id="v35SosPrompt15Actions" class="v35SosPrompt15Actions"></div><button id="v35SosPrompt15Later" class="v35SosPrompt15Later" type="button">稍後處理</button></div>';
 document.body.append(root);
 $('v35SosPrompt15Later').onclick=()=>{if(currentSos?.id)rememberDismissed(currentSos.id);root.classList.add('hidden')};
 return root;
}
function button(text,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;if(cls)b.className=cls;b.onclick=fn;return b}
function nameOf(id){return core.state?.users?.[id]?.nick||String(id||'').slice(0,8)||'房間成員'}
async function openSosLocation(x=currentSos){
 if(!x)return;ensureSosPrompt().classList.add('hidden');if(x.id)rememberDismissed(x.id);
 core.openMapPage?.();
 if(Number.isFinite(x.lat)&&Number.isFinite(x.lng)){setTimeout(()=>core.openMapAt?.(x.lat,x.lng,18),80);return}
 core.toast?.('這筆 SOS 沒有可用定位');
}
async function respondSupport(x=currentSos){
 if(!x)return;
 try{await sb().from('ktak35_member_status').upsert({room_id:room(),user_id:me(),status:'support',note:'前往支援：'+nameOf(x.user_id),updated_at:new Date().toISOString()},{onConflict:'room_id,user_id'})}catch(e){console.warn('v15 support status',e)}
 try{await sb().from('ktak35_timeline').insert({room_id:room(),event_type:'sos_support',actor_user_id:me(),target_user_id:x.user_id,title:'回應 SOS：前往支援',details:{sos_id:x.id,lat:x.lat,lng:x.lng}})}catch(e){console.warn('v15 support timeline',e)}
 await openSosLocation(x);
}
function showSos(x,force=false){
 if(!x||x.status!=='active'||x.user_id===me())return;
 if(!force&&dismissed().has(x.id))return;
 currentSos=x;
 // SOS outranks ordinary task prompts.
 $('v35AssignmentPrompt14')?.classList.add('hidden');
 const root=ensureSosPrompt(),actions=$('v35SosPrompt15Actions');
 $('v35SosPrompt15Title').textContent='SOS｜'+nameOf(x.user_id);
 $('v35SosPrompt15Body').textContent=x.message||'緊急支援請求';
 const coord=Number.isFinite(x.lat)&&Number.isFinite(x.lng)?`${Number(x.lat).toFixed(6)}, ${Number(x.lng).toFixed(6)}`:'無定位';
 const alt=Number.isFinite(x.altitude_m)?` · 高度 ${Math.round(x.altitude_m)}m`:'';
 $('v35SosPrompt15Meta').innerHTML='來源：<b>'+esc(nameOf(x.user_id))+'</b><br>位置：'+esc(coord+alt)+'<br>時間：'+esc(x.created_at?new Date(x.created_at).toLocaleString('zh-TW'):'剛剛');
 actions.innerHTML='';
 actions.append(button('🚨 前往支援並定位',()=>respondSupport(x),'primary'));
 actions.append(button('📍 只看 SOS 位置',()=>openSosLocation(x)));
 actions.append(button('稍後處理',()=>{rememberDismissed(x.id);root.classList.add('hidden')}));
 root.classList.remove('hidden');
 try{navigator.vibrate?.([260,100,260,100,500])}catch{}
}
async function refreshSos(show=true){
 if(!room()||!me()||!sb())return;
 const {data,error}=await sb().from('ktak35_sos').select('*').eq('room_id',room()).eq('status','active').order('created_at',{ascending:false}).limit(20);
 if(error){console.warn('v15 SOS refresh',error);return}
 const x=(data||[]).find(r=>r.user_id!==me())||null;currentSos=x;if(x&&show)showSos(x,false);
}
async function setupSosRealtime(){
 const r=room();if(!r||!sb()||r===sosRoom)return;try{await sb().realtime.setAuth()}catch(e){console.warn('KTAK35 v15 realtime auth',e);return}sosRoom=r;
 if(sosChannel)try{await sb().removeChannel(sosChannel)}catch{}
 sosChannel=sb().channel('ktak35-sos-prompt-v15:'+r,{config:{private:true}})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'ktak35_sos',filter:'room_id=eq.'+r},p=>showSos(p.new,true))
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ktak35_sos',filter:'room_id=eq.'+r},p=>{if(p.new?.status==='active')showSos(p.new,true);else if(currentSos?.id===p.new?.id)ensureSosPrompt().classList.add('hidden')})
  .subscribe(status=>{if(status==='SUBSCRIBED')refreshSos(true);else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')sosRoom=''});
}

async function showCurrentTaskDetails(){
 const api=window.__KTAK35_ASSIGNMENT_PROMPT14,st=api?.getState?.(),id=st?.current?.id;
 if(!id||!sb()||!room()){core.toast?.('目前沒有執行中的派遣');return}
 const {data,error}=await sb().from('ktak35_assignments').select('*').eq('room_id',room()).eq('id',id).maybeSingle();
 if(error||!data){core.toast?.('無法讀取任務內容');return}
 api.show?.(data);
}

function bindInteractions(){
 ensureStyle();ensureSosPrompt();
 // Navigation from the large assignment prompt must close the sheet first.
 document.addEventListener('click',e=>{
  const b=e.target?.closest?.('#v35AssignmentPrompt14Actions button');if(!b)return;
  if(/任務區/.test(b.textContent||''))$('v35AssignmentPrompt14')?.classList.add('hidden');
 },true);
 // The small map task chip is a task-details affordance, not another navigation button.
 document.addEventListener('click',e=>{
  const b=e.target?.closest?.('#v35ActiveTaskMapBtn');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();showCurrentTaskDetails();
 },true);
 const decorate=()=>{const b=$('v35ActiveTaskMapBtn');if(b){b.title='點擊查看任務內容';b.setAttribute('aria-label','查看目前任務內容')}};
 decorate();new MutationObserver(decorate).observe(document.documentElement,{childList:true,subtree:true});
}
async function boot(){
 bindInteractions();
 if(room()&&me()){await setupSosRealtime();await refreshSos(true)}
 clearInterval(sosPoll);sosPoll=setInterval(async()=>{if(room()&&me()){if(sosRoom!==room())await setupSosRealtime();await refreshSos(true)}},5000);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshSos(true)});
setTimeout(boot,450);
window.__KTAK35_FIELD15={version:15,showSos,refreshSos,showCurrentTaskDetails,getState:()=>({sosRoom,currentSos:currentSos?{id:currentSos.id,user_id:currentSos.user_id,status:currentSos.status}:null})};
})();
