(() => {
'use strict';
const core=window.__KTAK35_CORE;
if(!core){console.error('KTAK V3.5.2 core bridge missing');return}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const role=()=>core.role?.()||'';
const room=()=>core.roomUuid||'';
const me=()=>core.userId||'';
const sb=()=>core.sb;
const users=()=>Object.values(core.state?.users||{}).filter(x=>x.approved!==false);
const toast=t=>core.toast?.(t);
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COLORS=['#45aff2','#55d572','#ffc650','#f25c5c','#b989f4','#ff944c','#4ed5c7','#e779b8'];
let groups=[];
let groupRoom='';
let groupsLoadedAt=0;
let savingGroups=false;
let groupSaveTimer=null;
let assignmentOrganizing=false;
let lastBriefFingerprint='';

function openPage(id){document.querySelector(`.navBtn[data-page="${id}"]`)?.click()}
function brief(){return core.state?.brief||{}}
function executionText(b=brief()){
  if(b.executionMode==='其他'&&b.executionOther)return b.executionOther;
  return String(b.executionMode||'').trim();
}
function briefFingerprint(){const b=brief();return JSON.stringify([b.caseType,b.executionMode,b.executionOther,b.missionTime,b.executionLocation,b.riskLevel,b.situationSummary,b.missionNotes])}
function renderMissionBrief(){
  const card=$('v352MissionCard');if(!card)return;
  const b=brief(),fp=briefFingerprint();if(fp===lastBriefFingerprint&&card.dataset.ready==='1')return;lastBriefFingerprint=fp;card.dataset.ready='1';
  const title=String(b.caseType||executionText(b)||'主任務尚未填寫').trim();
  const mode=executionText(b);
  const meta=[b.missionTime,b.executionLocation,b.riskLevel?`風險：${b.riskLevel}`:''].filter(Boolean);
  const summary=String(b.missionNotes||b.situationSummary||'').trim();
  $('v352MissionTitle').textContent=title||'主任務尚未填寫';
  $('v352MissionMeta').textContent=meta.join(' · ')||'請先在「任務簡報」填寫主任務資料';
  $('v352MissionSummary').textContent=summary||'本房間以任務簡報作為主任務資料來源。';
  $('v352MissionMode').textContent=mode?`執行方式：${mode}`:'主任務內容以任務簡報為準';
}
function fillDispatchFromBrief(){
  const save=$('briefSaveBtn');
  if(save&&!save.classList.contains('hidden')){toast('請先儲存任務簡報，再建立派遣');return}
  const b=brief();
  openPage('commandPage');
  setTimeout(()=>{
    ensureDispatchUi();
    const title=$('v35TaskTitle'),details=$('v35TaskDetails'),priority=$('v35TaskPriority');
    const suggested=executionText(b)||String(b.caseType||'').trim();
    if(title)title.value=suggested||'';
    if(details)details.value=String(b.missionNotes||'').trim();
    if(priority&&String(b.riskLevel||'').includes('高'))priority.value='high';
    $('v352DispatchForm')?.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>title?.focus(),250);
    toast('已從任務簡報帶入；修改「要做什麼」並選擇派遣人員即可');
  },80);
}
function ensureMissionCard(){
  if($('v352MissionCard'))return;
  const shell=document.querySelector('#commandPage .v35CommandShell');if(!shell)return;
  const hero=shell.querySelector('.v35Hero');
  const card=document.createElement('div');card.id='v352MissionCard';card.className='v35MissionPrimary';
  card.innerHTML='<div class="v352MissionHead"><div><small>主任務 · 來源：任務簡報</small><h3 id="v352MissionTitle">主任務</h3></div><span id="v352MissionMode"></span></div><div id="v352MissionMeta" class="v352MissionMeta"></div><div id="v352MissionSummary" class="v352MissionSummary"></div><div class="v352MissionActions"><button type="button" id="v352OpenBrief">查看任務簡報</button><button type="button" id="v352BriefDispatch" class="primary">從簡報建立派遣</button></div>';
  hero?.after(card);
  $('v352OpenBrief').onclick=()=>openPage('briefPage');
  $('v352BriefDispatch').onclick=fillDispatchFromBrief;
  renderMissionBrief();
}
function ensureBriefDispatchButton(){
  if($('v352BriefDispatchTop'))return;
  const save=$('briefSaveBtn'),edit=$('briefEditBtn');const row=save?.parentElement||edit?.parentElement;if(!row)return;
  const b=document.createElement('button');b.id='v352BriefDispatchTop';b.type='button';b.textContent='從簡報建立派遣';b.onclick=fillDispatchFromBrief;row.prepend(b);
}
function adaptMissionMode(){
  const select=$('v35MissionTemplate');if(!select)return;
  const card=select.closest('.v35Card');const h=card?.querySelector('h3');if(h)h.textContent='🧩 工具預設組';
  const guide=$('v35MissionModeGuide');if(guide)guide.textContent='主任務內容以「任務簡報」為準。這裡只切換情境工具、快捷派遣與相關指揮面板，不需要重新輸入案情。';
  if(!select.dataset.v352GroupGuard){
    select.dataset.v352GroupGuard='1';
    select.addEventListener('change',()=>{if(role()==='commander'&&groups.length){clearTimeout(groupSaveTimer);groupSaveTimer=setTimeout(()=>saveGroupsNow(),900)}});
  }
  const panel=$('v35MissionModePanel');
  if(panel){
    panel.querySelector('.v35ModePanelTitle')?.replaceChildren(document.createTextNode('快速派遣建議'));
    const span=panel.querySelector('.v35QuickTasks>span');if(span)span.textContent='快速派遣建議';
    if(!panel.dataset.v352Bound){
      panel.dataset.v352Bound='1';
      panel.addEventListener('click',e=>{
        const btn=e.target.closest?.('[data-quick-task]');if(!btn)return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const t=$('v35TaskTitle');if(t)t.value=btn.dataset.quickTask||btn.textContent.trim();
        ensureDispatchUi();$('v352DispatchForm')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>t?.focus(),220);
        toast('已帶入快速派遣名稱；主任務內容沿用任務簡報');
      },true);
    }
  }
}
function labeledBlock(label,el,id){const d=document.createElement('div');if(id)d.id=id;d.className='v352Field';const s=document.createElement('div');s.className='label';s.textContent=label;d.append(s,el);return d}
function ensureDispatchUi(){
  const title=$('v35TaskTitle'),details=$('v35TaskDetails'),priority=$('v35TaskPriority'),assignees=$('v35Assignees'),create=$('v35CreateTask');
  if(!title||!details||!priority||!assignees||!create)return;
  const card=title.closest('.v35Card');if(!card)return;
  const h=card.querySelector('h3');if(h)h.textContent='📌 派遣工作';
  title.placeholder='例如：搜索 2F 東側、正門封鎖、後勤補給';
  details.placeholder='只填這個子任務需要補充的注意事項';
  if(!$('v352DispatchForm')){
    [...card.querySelectorAll(':scope>.label')].filter(x=>x.textContent.includes('指派隊員')).forEach(x=>x.remove());
    const form=document.createElement('div');form.id='v352DispatchForm';
    const titleBlock=labeledBlock('要做什麼',title);
    const target=document.createElement('div');target.className='v352Field';target.innerHTML='<div class="label">派給誰</div><div id="v352GroupAssigneeShortcuts" class="v352GroupShortcuts"></div><div class="muted">可先點整隊，再個別增減隊員。</div>';
    target.append(assignees);
    const pr=labeledBlock('優先度',priority);
    const extra=document.createElement('details');extra.className='v352Optional';extra.innerHTML='<summary>補充說明（選填）</summary>';extra.append(details);
    const loc=$('v35TaskLocationMode')?.closest('.v35TaskLocationBox');
    let locWrap=null;if(loc){locWrap=document.createElement('details');locWrap.className='v352Optional';locWrap.innerHTML='<summary>任務位置（選填）</summary>';locWrap.append(loc)}
    form.append(titleBlock,target,pr,extra);if(locWrap)form.append(locWrap);form.append(create);card.append(form);
  }
  create.textContent='送出派遣';create.style.width='100%';renderGroupShortcuts();
  if(!assignees.dataset.v352Bound){assignees.dataset.v352Bound='1';assignees.addEventListener('change',renderGroupShortcuts)}
}
function normalizeGroup(g,i){
  return {id:String(g?.id||crypto.randomUUID()),code:LETTERS.includes(String(g?.code||'').toUpperCase())?String(g.code).toUpperCase():(LETTERS[i]||'Z'),type:String(g?.type||'攻擊隊').slice(0,40),leaderId:String(g?.leaderId||''),color:/^#[0-9a-f]{6}$/i.test(g?.color||'')?g.color:COLORS[i%COLORS.length],memberIds:[...new Set((Array.isArray(g?.memberIds)?g.memberIds:[]).map(String))]};
}
async function loadGroups(force=false){
  const r=room();if(!r||!sb()||savingGroups)return;
  if(!force&&groupRoom===r&&Date.now()-groupsLoadedAt<15000)return;
  groupRoom=r;groupsLoadedAt=Date.now();
  try{
    const {data,error}=await sb().from('ktak35_mission_profile').select('template,data').eq('room_id',r).maybeSingle();if(error)throw error;
    if(r!==room()||savingGroups)return;groups=(Array.isArray(data?.data?.groups)?data.data.groups:[]).map(normalizeGroup).sort((a,b)=>a.code.localeCompare(b.code));renderGroups();renderGroupShortcuts();
  }catch(e){console.warn('V3.5.2 groups load',e)}
}
async function saveGroupsNow(){
  clearTimeout(groupSaveTimer);if(savingGroups||role()!=='commander'||!room()||!sb())return;
  const codes=groups.map(g=>g.code);if(new Set(codes).size!==codes.length){toast('編組代號不可重複');return}
  savingGroups=true;const r=room();
  try{
    const {data:profile,error:readError}=await sb().from('ktak35_mission_profile').select('template,data').eq('room_id',r).maybeSingle();if(readError)throw readError;
    const data={...(profile?.data||{}),groups:groups.map(g=>({id:g.id,code:g.code,type:g.type,leaderId:g.leaderId,color:g.color,memberIds:g.memberIds}))};
    const template=profile?.template||$('v35MissionTemplate')?.value||'police_tactical';
    const {error}=await sb().from('ktak35_mission_profile').upsert({room_id:r,template,data,updated_by:me(),updated_at:new Date().toISOString()},{onConflict:'room_id'});if(error)throw error;
    groupsLoadedAt=Date.now();renderGroupShortcuts();
  }catch(e){console.warn('V3.5.2 groups save',e);toast('編組儲存失敗：'+(e.message||e))}finally{savingGroups=false}
}
function scheduleGroupSave(){clearTimeout(groupSaveTimer);groupSaveTimer=setTimeout(saveGroupsNow,500)}
function nextCode(){const used=new Set(groups.map(g=>g.code));return LETTERS.find(x=>!used.has(x))||null}
function addGroup(){const code=nextCode();if(!code){toast('A～Z 編組已全部使用');return}groups.push(normalizeGroup({code,type:'攻擊隊',color:COLORS[groups.length%COLORS.length],memberIds:[]},groups.length));renderGroups();renderGroupShortcuts();scheduleGroupSave()}
function renderGroups(){
  const root=$('v352Groups');if(!root)return;root.innerHTML='';
  const us=users(),assigned=new Set(groups.flatMap(g=>g.memberIds));
  groups.sort((a,b)=>a.code.localeCompare(b.code)).forEach(g=>{
    const box=document.createElement('div');box.className='v352GroupBox';box.style.setProperty('--team-color',g.color);
    const head=document.createElement('div');head.className='v352GroupHead';
    const code=document.createElement('select');LETTERS.forEach(x=>code.add(new Option(x,x)));code.value=g.code;code.title='隊別代號';
    const type=document.createElement('input');type.value=g.type;type.maxLength=40;type.placeholder='例如：攻擊隊、封鎖隊、後勤隊';
    const color=document.createElement('input');color.type='color';color.value=g.color;color.title='隊色';
    const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='刪除';
    head.append(code,type,color,del);box.append(head);
    const leaderRow=document.createElement('div');leaderRow.className='v352LeaderRow';const lab=document.createElement('span');lab.textContent='隊長';const leader=document.createElement('select');leader.add(new Option('未指定',''));us.forEach(u=>leader.add(new Option(u.nick,u.id)));leader.value=g.leaderId;leaderRow.append(lab,leader);box.append(leaderRow);
    const members=document.createElement('div');members.className='v35CheckList v352GroupMembers';
    us.forEach(u=>{const l=document.createElement('label');l.className='v35Check';const c=document.createElement('input');c.type='checkbox';c.value=u.id;c.checked=g.memberIds.includes(String(u.id));const span=document.createElement('span');span.textContent=u.nick;l.append(c,span);members.append(l);c.onchange=()=>{const id=String(u.id);if(c.checked){groups.forEach(other=>{if(other.id!==g.id)other.memberIds=other.memberIds.filter(x=>x!==id)});if(!g.memberIds.includes(id))g.memberIds.push(id)}else{g.memberIds=g.memberIds.filter(x=>x!==id);if(g.leaderId===id)g.leaderId=''}renderGroups();renderGroupShortcuts();scheduleGroupSave()}});
    box.append(members);
    code.onchange=()=>{const wanted=code.value;if(groups.some(x=>x.id!==g.id&&x.code===wanted)){toast(wanted+' 組已存在');code.value=g.code;return}g.code=wanted;renderGroups();renderGroupShortcuts();scheduleGroupSave()};
    type.oninput=()=>{g.type=type.value.slice(0,40);renderGroupShortcuts();scheduleGroupSave()};
    color.oninput=()=>{g.color=color.value;box.style.setProperty('--team-color',g.color);renderGroupShortcuts();scheduleGroupSave()};
    leader.onchange=()=>{g.leaderId=String(leader.value||'');if(g.leaderId&&!g.memberIds.includes(g.leaderId)){groups.forEach(other=>{if(other.id!==g.id)other.memberIds=other.memberIds.filter(x=>x!==g.leaderId)});g.memberIds.push(g.leaderId)}renderGroups();renderGroupShortcuts();scheduleGroupSave()};
    del.onclick=()=>{if(!confirm(`刪除 ${g.code} ${g.type}？`))return;groups=groups.filter(x=>x.id!==g.id);renderGroups();renderGroupShortcuts();scheduleGroupSave()};
    root.append(box);
  });
  const unassigned=us.filter(u=>!assigned.has(String(u.id)));
  const foot=document.createElement('div');foot.className='v352Unassigned';foot.innerHTML='<b>未編組</b><span>'+(unassigned.length?unassigned.map(x=>esc(x.nick)).join('、'):'—')+'</span>';root.append(foot);
}
function ensureGroupCard(){
  if($('v352GroupCard'))return;
  const grid=document.querySelector('#commandPage .v35CommandGrid');const dispatch=$('v35TaskTitle')?.closest('.v35Card');if(!grid||!dispatch)return;
  const card=document.createElement('div');card.id='v352GroupCard';card.className='v35Card v35CommanderOnly v35Full';card.innerHTML='<div class="v35CardHead"><h3>👥 編組</h3><button id="v352AddGroup" type="button">＋ 新增編組</button></div><div class="muted">A～Z 是隊別代號，隊伍類型可重複；例如 A、B、C、D、E、F 都可以是「攻擊隊」。每名隊員同一時間只屬於一隊。</div><div id="v352Groups" class="v352Groups"></div>';
  grid.insertBefore(card,dispatch);$('v352AddGroup').onclick=addGroup;renderGroups();
}
function renderGroupShortcuts(){
  const root=$('v352GroupAssigneeShortcuts'),assignees=$('v35Assignees');if(!root||!assignees)return;root.innerHTML='';
  const checked=()=>new Set([...assignees.querySelectorAll('input:checked')].map(x=>String(x.value)));
  groups.forEach(g=>{const b=document.createElement('button');b.type='button';b.className='v352GroupChip';b.style.setProperty('--team-color',g.color);const count=g.memberIds.length;b.textContent=`${g.code} ${g.type||'編組'} · ${count}人`;const set=checked();if(count>0&&g.memberIds.every(id=>set.has(id)))b.classList.add('selected');b.disabled=count===0;b.onclick=()=>{const now=checked(),all=g.memberIds.every(id=>now.has(id));g.memberIds.forEach(id=>{const c=[...assignees.querySelectorAll('input')].find(x=>String(x.value)===id);if(c)c.checked=!all});renderGroupShortcuts()};root.append(b)});
  if(!groups.length){const s=document.createElement('span');s.className='muted';s.textContent='尚未建立編組，可直接個別勾選隊員。';root.append(s)}
}
function ensureAssignmentArchive(){
  const root=$('v35AssignmentList');if(!root)return null;
  let d=$('v352AssignmentArchive');if(!d){d=document.createElement('details');d.id='v352AssignmentArchive';d.className='v352AssignmentArchive';d.innerHTML='<summary>✓ 已完成 / 已結案（0）</summary><div id="v352AssignmentArchiveBody"></div>';root.after(d)}return d
}
function organizeAssignments(){
  if(assignmentOrganizing)return;const root=$('v35AssignmentList');if(!root)return;assignmentOrganizing=true;
  try{
    const archive=ensureAssignmentArchive(),body=$('v352AssignmentArchiveBody');if(!archive||!body)return;body.innerHTML='';
    const cards=[...root.querySelectorAll(':scope > .v35Task')];let archived=0;
    cards.forEach(card=>{const status=card.querySelector('.v35TaskHead>span')?.textContent||'';if(/整體：(已完成|已取消)/.test(status)){body.append(card);archived++}});
    archive.querySelector('summary').textContent=`✓ 已完成 / 已結案（${archived}）`;archive.classList.toggle('hidden',archived===0);
    if(archived&&root.querySelectorAll(':scope > .v35Task').length===0&&!root.querySelector('[data-v352-empty]')){const e=document.createElement('div');e.className='muted';e.dataset.v352Empty='1';e.textContent='目前沒有進行中的派遣。';root.append(e)}
  }finally{assignmentOrganizing=false}
}
function bindAssignmentObserver(){const root=$('v35AssignmentList');if(!root||root.dataset.v352Observed)return;root.dataset.v352Observed='1';new MutationObserver(()=>queueMicrotask(organizeAssignments)).observe(root,{childList:true});organizeAssignments()}
function ensureUi(){
  ensureMissionCard();ensureBriefDispatchButton();adaptMissionMode();ensureGroupCard();ensureDispatchUi();bindAssignmentObserver();
  const commander=role()==='commander';$('v352BriefDispatch')?.classList.toggle('hidden',!commander);$('v352BriefDispatchTop')?.classList.toggle('hidden',!commander);$('v352GroupCard')?.classList.toggle('hidden',!commander);
  renderMissionBrief();organizeAssignments();
}
async function tick(){
  ensureUi();const r=room();if(r!==groupRoom){groups=[];groupRoom=r;groupsLoadedAt=0;renderGroups();renderGroupShortcuts();if(r)await loadGroups(true)}else if(r&&role()==='commander'&&document.getElementById('commandPage')?.classList.contains('active'))await loadGroups(false)
}
window.addEventListener('focus',()=>loadGroups(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')loadGroups(true)});
const briefPage=$('briefPage');if(briefPage)new MutationObserver(()=>renderMissionBrief()).observe(briefPage,{childList:true,subtree:true,characterData:true});
setInterval(()=>{tick().catch(e=>console.warn('V3.5.2 tick',e))},1800);
setTimeout(()=>tick().catch(console.warn),0);
window.__KTAK35_V352={version:'3.5.2',ensureUi,organizeAssignments,loadGroups,getGroups:()=>groups.map(g=>({...g,memberIds:[...g.memberIds]})),fillDispatchFromBrief};
})();
