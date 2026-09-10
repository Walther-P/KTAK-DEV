(() => {
'use strict';
// ktak-v35-maintenance-v355
const core=window.__KTAK35_CORE;
if(!core){console.error('KTAK V3.5.5 core bridge missing');return}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let briefDraft=null,returnAfterMapPick=false,mapBound=false,sosRepairBusy=false,lastSosRepairAt=0;

function room(){return core.roomUuid||''}
function me(){return core.userId||''}
function role(){return core.role?.()||''}
function sb(){return core.sb}
function toast(t){core.toast?.(t)}
function userById(id){return core.state?.users?.[id]||null}
function nameOf(id){return userById(id)?.nick||String(id||'').slice(0,8)||'成員'}
function isCommanderUser(id){const u=userById(id);return !!u&&(u.role==='commander'||String(id)===String(core.state?.meta?.creatorId||''))}

/* -------- 3. Brief map picking keeps the unsaved brief draft -------- */
function fallbackCaptureBriefDraft(){
  const page=$('briefPage');if(!page)return null;
  const controls=[...page.querySelectorAll('input[id],textarea[id],select[id]')].map(el=>({id:el.id,value:el.value,checked:'checked' in el?el.checked:undefined}));
  return {fallback:true,controls};
}
function captureBriefDraft(){
  try{return core.captureBriefDraft?.()||fallbackCaptureBriefDraft()}catch(e){console.warn('V3.5.5 capture brief draft',e);return fallbackCaptureBriefDraft()}
}
function fallbackRestoreBriefDraft(d){
  if(!d?.controls)return;
  const edit=$('briefEditBtn'),save=$('briefSaveBtn');if(save?.classList.contains('hidden')&&edit&&!edit.classList.contains('hidden'))edit.click();
  setTimeout(()=>d.controls.forEach(x=>{const el=$(x.id);if(!el)return;el.value=x.value;if(typeof x.checked==='boolean')el.checked=x.checked;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}),0);
}
function restoreBriefDraft(d){
  try{if(core.restoreBriefDraft)core.restoreBriefDraft(d);else fallbackRestoreBriefDraft(d)}catch(e){console.warn('V3.5.5 restore brief draft',e);fallbackRestoreBriefDraft(d)}
}
function returnToBriefEditor(){
  if(!briefDraft)return;
  document.querySelector('.navBtn[data-page="briefPage"]')?.click();
  const saved=briefDraft;briefDraft=null;
  setTimeout(()=>{restoreBriefDraft(saved);$('executionLocation')?.focus?.();toast('已保留尚未儲存的任務簡報，請確認後再按「儲存」')},100);
}
function bindBriefLocationReturn(){
  if(document.documentElement.dataset.v355BriefPick==='1')return;document.documentElement.dataset.v355BriefPick='1';
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('#v353BriefLocationSet');if(!b)return;
    const save=$('briefSaveBtn');if(!save||save.classList.contains('hidden'))return;
    briefDraft=captureBriefDraft();returnAfterMapPick=!!briefDraft;
  },true);
}
function bindMapReturn(){
  const map=core.map;if(!map||mapBound)return;mapBound=true;
  map.on('click',()=>{
    if(!returnAfterMapPick)return;
    returnAfterMapPick=false;
    // V3.5.3's own map listener stores the selected coordinate first.
    setTimeout(returnToBriefEditor,80);
  });
}

/* -------- 1. Clear SOS-generated emergency status after SOS is resolved -------- */
async function reconcileResolvedSosStatus(force=false){
  const now=Date.now();if(sosRepairBusy||!room()||!me()||!sb()||(!force&&now-lastSosRepairAt<12000))return;
  sosRepairBusy=true;lastSosRepairAt=now;const r=room();
  try{
    const [sosRes,statusRes]=await Promise.all([
      sb().from('ktak35_sos').select('user_id').eq('room_id',r).eq('status','active'),
      sb().from('ktak35_member_status').select('user_id,status,note').eq('room_id',r).eq('status','emergency')
    ]);
    if(sosRes.error||statusRes.error)throw sosRes.error||statusRes.error;
    if(r!==room())return;
    const active=new Set((sosRes.data||[]).map(x=>String(x.user_id)));
    let changed=false;
    for(const row of statusRes.data||[]){
      const uid=String(row.user_id||'');
      if(active.has(uid)||row.note!=='SOS 已觸發')continue;
      if(uid!==String(me())&&role()!=='commander')continue;
      const {error}=await sb().from('ktak35_member_status').update({status:'available',note:'',updated_at:new Date().toISOString()})
        .eq('room_id',r).eq('user_id',uid).eq('status','emergency').eq('note','SOS 已觸發');
      if(error){console.warn('V3.5.5 SOS status repair',uid,error);continue}
      changed=true;
    }
    if(changed)await window.__KTAK35?.refresh?.();
  }catch(e){console.warn('V3.5.5 SOS reconciliation',e)}finally{sosRepairBusy=false}
}

/* -------- 2. Group shortcut preview uses the new directional pentagon -------- */
function miniTeamSvg(color){
  const c=/^#[0-9a-f]{6}$/i.test(color||'')?color:'#45aff2';
  return `<span class="v355GroupMini" style="--v355-team:${c}"><svg viewBox="0 0 96 50" aria-hidden="true"><path d="M4 5H66L92 25 66 45H4Z" fill="${c}" fill-opacity=".78" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></span>`;
}
function decorateGroupShortcuts(){
  const api=window.__KTAK35_V352;if(!api?.getGroups)return;
  const groups=api.getGroups();
  document.querySelectorAll('[data-v353-map-group]').forEach(b=>{
    if(b.dataset.v353MapGroup==='title')return;
    const g=groups.find(x=>String(x.id)===String(b.dataset.v353MapGroup));if(!g)return;
    b.querySelector(':scope > svg')?.classList.add('v355LegacyGroupIcon');
    b.querySelector(':scope > .v353GroupEmoji')?.classList.add('v355LegacyGroupIcon');
    let mini=b.querySelector(':scope > .v355GroupMini');
    if(!mini){b.insertAdjacentHTML('afterbegin',miniTeamSvg(g.color));mini=b.querySelector(':scope > .v355GroupMini')}
    if(mini)mini.style.setProperty('--v355-team',g.color||'#45aff2');
    b.style.setProperty('--team-color',g.color||'#45aff2');
    b.onclick=()=>{core.chooseMapSymbol?.(`v355team:${g.id}`,`${g.code} ${g.type||'編組'}`,g.color||'#45aff2');toast(`已選擇 ${g.code} ${g.type||'編組'}，請點地圖放置`)};
  });
}

/* -------- 6. Detailed Timeline CSV export -------- */
const STATUS_TEXT={pending:'等待接受',accepted:'已接受',active:'執行中',completed:'已完成',cancelled:'已取消',declined:'無法執行',available:'可派遣',standby:'待命',support:'需要支援',emergency:'緊急',offline:'離線'};
function eventDescription(x){
  const d=x?.details&&typeof x.details==='object'?x.details:{};
  const actorCommander=isCommanderUser(x?.actor_user_id);
  const actor=nameOf(x?.actor_user_id),target=nameOf(x?.target_user_id||d.user_id);
  const type=String(x?.event_type||'');
  if(type==='assignment_created')return `指揮官派遣任務：${String(x.title||'').replace(/^派遣任務：/,'')}`;
  if(type==='assignment_updated'){
    if(actorCommander&&d.status==='completed')return '指揮官結案';
    if(actorCommander&&d.status==='cancelled')return '指揮官取消任務';
    return `${actor}更新任務狀態：${STATUS_TEXT[d.status]||d.status||'更新'}`;
  }
  if(type==='sos')return `${actor}觸發 SOS`;
  if(type==='sos_resolved')return `${actor}解除${x.target_user_id||d.user_id?' '+target+' 的':''} SOS`;
  if(type==='sos_support')return `${actor}回應 ${target} 的 SOS：前往支援`;
  if(type==='member_status')return `${actor}狀態更新：${STATUS_TEXT[d.status]||d.status||x.title||'更新'}`;
  if(type==='search_sector_created')return x.title||`${actor}建立搜索區`;
  if(type.includes('search'))return x.title||`${actor}更新搜索區`;
  if(type.includes('floor'))return x.title||`${actor}更新樓層狀態`;
  return x?.title||type||'任務事件';
}
function detailText(details){
  if(!details||typeof details!=='object')return String(details||'');
  const labels={status:'狀態',note:'備註',priority:'優先度',assigned_to:'指派人員',assignment_id:'任務ID',sos_id:'SOS ID',lat:'緯度',lng:'經度',altitude_m:'高度',progress:'進度',points:'點數',user_id:'人員'};
  return Object.entries(details).map(([k,v])=>{
    let val=v;
    if(k==='assigned_to'&&Array.isArray(v))val=v.map(nameOf).join('、');
    else if(k==='status')val=STATUS_TEXT[v]||v;
    else if(k==='user_id')val=nameOf(v);
    else if(Array.isArray(v))val=v.join('、');
    else if(v&&typeof v==='object')val=JSON.stringify(v);
    return `${labels[k]||k}：${String(val??'')}`;
  }).join('；');
}
function csvCell(v){const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
async function fetchAllTimeline(){
  const rows=[];const pageSize=1000;
  for(let from=0;;from+=pageSize){
    const {data,error}=await sb().from('ktak35_timeline').select('*').eq('room_id',room()).order('created_at',{ascending:true}).range(from,from+pageSize-1);
    if(error)throw error;rows.push(...(data||[]));if((data||[]).length<pageSize)break;
  }
  return rows;
}
async function exportTimeline(){
  if(!room()||!sb()){toast('尚未加入任務房間');return}
  const btn=$('v355TimelineExport');if(btn){btn.disabled=true;btn.textContent='匯出中…'}
  try{
    const rows=await fetchAllTimeline();
    const header=['時間','事件類型','事件','執行者','執行者權限','對象','詳細內容','原始標題'];
    const lines=[header.map(csvCell).join(',')];
    rows.forEach(x=>{
      const u=userById(x.actor_user_id),roleText=isCommanderUser(x.actor_user_id)?'指揮官':(u?.role||'成員');
      const vals=[x.created_at?new Date(x.created_at).toLocaleString('zh-TW',{hour12:false}):'',x.event_type||'',eventDescription(x),nameOf(x.actor_user_id),roleText,x.target_user_id?nameOf(x.target_user_id):'',detailText(x.details),x.title||''];
      lines.push(vals.map(csvCell).join(','));
    });
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    const d=new Date(),pad=n=>String(n).padStart(2,'0');
    a.href=url;a.download=`KTAK-Timeline-${room().slice(0,8)}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
    toast(`Timeline 已匯出 ${rows.length} 筆詳細紀錄`);
  }catch(e){console.warn('V3.5.5 timeline export',e);toast('Timeline 匯出失敗：'+(e?.message||e))}
  finally{if(btn){btn.disabled=false;btn.textContent='匯出 Timeline'}}
}
function ensureTimelineExport(){
  if($('v355TimelineExport'))return;
  const toggle=$('v35TimelineToggle');if(!toggle)return;
  const host=toggle.parentElement||toggle;
  const b=document.createElement('button');b.id='v355TimelineExport';b.type='button';b.textContent='匯出 Timeline';b.onclick=exportTimeline;host.insertBefore(b,toggle);
}

function ensure(){
  bindBriefLocationReturn();bindMapReturn();decorateGroupShortcuts();ensureTimelineExport();reconcileResolvedSosStatus(false);
}
window.addEventListener('focus',()=>{ensure();reconcileResolvedSosStatus(true)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){ensure();reconcileResolvedSosStatus(true)}});
setInterval(()=>{if(document.visibilityState==='visible')ensure()},1800);
setTimeout(()=>{ensure();reconcileResolvedSosStatus(true)},400);
window.__KTAK35_V355={version:'3.5.5',ensure,exportTimeline,eventDescription,reconcileResolvedSosStatus,getState:()=>({briefDraft:!!briefDraft,returnAfterMapPick})};
})();
