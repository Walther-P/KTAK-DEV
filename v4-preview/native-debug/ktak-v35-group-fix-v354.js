(() => {
'use strict';
const core=window.__KTAK35_CORE;
if(!core){console.error('KTAK V3.5.4 group fix core bridge missing');return}
const $=id=>document.getElementById(id);
const toast=t=>core.toast?.(t);
const api=()=>window.__KTAK35_V352;
let lastMapSig='';
let persistBusy=false;

function groupsSorted(){
  const a=api();
  if(!a?.getGroups)return [];
  return a.getGroups().slice().sort((x,y)=>String(x.code||'').localeCompare(String(y.code||'')));
}
function groupSig(groups){return JSON.stringify(groups.map(g=>[g.id,g.code,g.type,g.color]))}
function findMapGroupGrid(){
  const staticGroup=document.querySelector('#mapPage [data-tactical-key="group"]');
  let root=staticGroup?.closest('.tacticalListGrid')||$('mapTacticalList')||document.querySelector('#mapPage .tacticalListGrid');
  if(!root)return {root:null,staticGroup:null,anchor:null};
  const actualGroup=staticGroup||root.querySelector('[data-tactical-key="group"]');
  let anchor=null;
  if(actualGroup){
    let n=actualGroup.nextElementSibling;
    while(n){if(n.classList?.contains('tacticalGroupTitle')){anchor=n;break}n=n.nextElementSibling}
  }else{
    const titles=[...root.querySelectorAll('.tacticalGroupTitle')];
    const personnel=titles.find(x=>/人員.*隊伍|人員.*隊/.test(String(x.textContent||'').replace(/\s+/g,'')));
    if(personnel){let n=personnel.nextElementSibling;while(n){if(n.classList?.contains('tacticalGroupTitle')){anchor=n;break}n=n.nextElementSibling}}
  }
  return {root,staticGroup:actualGroup,anchor};
}
function insertBeforeOrAppend(root,node,anchor){if(anchor?.parentElement===root)root.insertBefore(node,anchor);else root.append(node)}
function renderMapGroups(force=false){
  const {root,staticGroup,anchor}=findMapGroupGrid();
  if(!root)return false;
  const groups=groupsSorted(),sig=groupSig(groups);
  const existing=[...root.querySelectorAll('[data-v353-map-group]')];
  if(!force&&sig===lastMapSig&&groups.length&&existing.length===groups.length+1)return true;
  lastMapSig=sig;
  existing.forEach(x=>x.remove());
  if(!groups.length)return true;
  const svg=staticGroup?.querySelector('svg')?.outerHTML||'<span class="v353GroupEmoji">👥</span>';
  const title=document.createElement('div');
  title.className='tacticalGroupTitle v353MapGroupTitle';
  title.dataset.v353MapGroup='title';
  title.textContent='目前編組';
  insertBeforeOrAppend(root,title,anchor);
  groups.forEach(g=>{
    const b=document.createElement('button');
    b.type='button';b.className='tacticalPickBtn v353MapGroupPick';
    b.dataset.v353MapGroup=String(g.id||'');
    b.style.setProperty('--team-color',g.color||'#45aff2');
    const code=String(g.code||''),type=String(g.type||'編組');
    b.innerHTML=svg+`<span><b>${code} ${type}</b><small><i class="v353TeamDot"></i>隊伍快速圖樣</small></span>`;
    b.onclick=()=>{core.chooseMapSymbol?.('group',`${code} ${type}`,g.color||'#45aff2');toast(`已選擇 ${code} ${type} 圖樣，請點地圖放置`)};
    insertBeforeOrAppend(root,b,anchor);
  });
  return true;
}

async function persistCurrentGroups(){
  if(persistBusy||core.role?.()!=='commander'||!core.roomUuid||!core.sb)return;
  persistBusy=true;
  try{
    const groups=groupsSorted().map(g=>({id:g.id,code:g.code,type:g.type,leaderId:g.leaderId||'',color:g.color,memberIds:Array.isArray(g.memberIds)?g.memberIds:[]}));
    const {data:profile,error:readError}=await core.sb.from('ktak35_mission_profile').select('template,data').eq('room_id',core.roomUuid).maybeSingle();
    if(readError)throw readError;
    const data={...(profile?.data||{}),groups};
    const template=profile?.template||$('v35MissionTemplate')?.value||'police_tactical';
    const {error}=await core.sb.from('ktak35_mission_profile').upsert({room_id:core.roomUuid,template,data,updated_by:core.userId,updated_at:new Date().toISOString()},{onConflict:'room_id'});
    if(error)throw error;
    await api()?.loadGroups?.(true);
    renderMapGroups(true);
  }catch(e){console.warn('V3.5.4 persist groups',e);toast('編組同步失敗：'+(e.message||e))}
  finally{persistBusy=false}
}

function groupForDeleteButton(btn){
  const box=btn.closest('.v352GroupBox');if(!box)return null;
  const boxes=[...document.querySelectorAll('#v352Groups .v352GroupBox')];
  const idx=boxes.indexOf(box);if(idx<0)return null;
  return groupsSorted()[idx]||null;
}
function resetDeleteButton(btn){
  if(!btn?.isConnected)return;
  delete btn.dataset.v354ConfirmDelete;btn.textContent='刪除';btn.disabled=false;
}

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#v352GroupCard .v352GroupHead button.danger');
  if(!btn)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(core.role?.()!=='commander'){toast('只有指揮官可以刪除編組');return}
  const g=groupForDeleteButton(btn);if(!g){toast('找不到要刪除的編組，請重新開啟編組面板');return}
  if(btn.dataset.v354ConfirmDelete!=='1'){
    btn.dataset.v354ConfirmDelete='1';btn.textContent='再按一次刪除';
    toast(`再次按下即可刪除 ${g.code} ${g.type}`);
    setTimeout(()=>resetDeleteButton(btn),3500);
    return;
  }
  btn.disabled=true;
  const original=btn.onclick;
  if(typeof original!=='function'){resetDeleteButton(btn);toast('刪除功能尚未就緒，請重新整理後再試');return}
  const oldConfirm=window.confirm;
  try{
    window.confirm=()=>true;
    original.call(btn,e);
  }catch(err){console.warn('V3.5.4 group delete',err);resetDeleteButton(btn);toast('刪除失敗：'+(err.message||err));return}
  finally{window.confirm=oldConfirm}
  toast(`已刪除 ${g.code} ${g.type}`);
  setTimeout(()=>persistCurrentGroups(),80);
  setTimeout(()=>renderMapGroups(true),120);
},true);

document.addEventListener('input',e=>{if(e.target?.closest?.('#v352GroupCard'))setTimeout(()=>renderMapGroups(true),40)});
document.addEventListener('change',e=>{if(e.target?.closest?.('#v352GroupCard'))setTimeout(()=>renderMapGroups(true),40)});
window.addEventListener('focus',()=>setTimeout(()=>renderMapGroups(true),120));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>renderMapGroups(true),120)});
setInterval(()=>{if(document.visibilityState==='visible')renderMapGroups(false)},900);
setTimeout(()=>renderMapGroups(true),0);
window.__KTAK35_V354={version:'3.5.4',renderMapGroups,persistCurrentGroups};
})();
