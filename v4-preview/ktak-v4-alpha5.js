/* KTAK V4 alpha.5 refinement — discoverability + workspace-first layout */
(() => {
'use strict';

const REV='4.0.0-alpha.5-refine';
const $=id=>document.getElementById(id);
let roomChip=null,guide=null,help=null,guideTimer=0;

function ready(fn,tries=0){
  if(window.__KTAK_V4?.version==='4.0.0-alpha.4'&&document.body.classList.contains('ktakV4A4')) return fn();
  if(tries>80) return console.warn('[KTAK V4 refine] alpha.4 shell not ready');
  setTimeout(()=>ready(fn,tries+1),50);
}

function surface(){
  if(document.body.classList.contains('v4MapActive')) return 'map';
  if(document.body.classList.contains('v4BoardActive')) return 'board';
  return '';
}
function keyFor(s){return `ktak.v4.guide.${s}.v1`}
function seen(s){try{return localStorage.getItem(keyFor(s))==='1'}catch{return false}}
function markSeen(s){if(!s)return;try{localStorage.setItem(keyFor(s),'1')}catch{}}
function resetSeen(){try{localStorage.removeItem(keyFor('map'));localStorage.removeItem(keyFor('board'))}catch{}}

function buildRoomChip(){
  if(roomChip) return roomChip;
  roomChip=document.createElement('button');
  roomChip.type='button';
  roomChip.className='v4RoomChip5';
  roomChip.hidden=true;
  roomChip.title='房間狀態／設定';
  roomChip.setAttribute('aria-label','房間狀態／設定');
  roomChip.addEventListener('click',()=>document.getElementById('v4SettingsBtn')?.click());
  document.body.append(roomChip);
  const src=document.querySelector('header .roomStatus');
  if(src)new MutationObserver(syncRoomChip).observe(src,{childList:true,subtree:true,characterData:true,attributes:true});
  syncRoomChip();
  return roomChip;
}
function compactRoomText(raw){
  const t=String(raw||'').replace(/\s+/g,' ').trim();
  if(!t)return 'KTAK';
  const room=t.match(/(?:房(?:號|間)?\s*[:：]?\s*)?([A-Za-z0-9_-]{3,12})/i);
  return room?.[1]&&/\d/.test(room[1])?`● ${room[1]}`:t.replace(/^●\s*/,'● ').slice(0,18);
}
function syncRoomChip(){
  if(!roomChip)return;
  const s=surface();
  roomChip.hidden=!s;
  if(!s)return;
  const src=document.querySelector('header .roomStatus');
  roomChip.textContent=compactRoomText(src?.textContent);
}

function buildGuide(){
  if(guide)return guide;
  guide=document.createElement('div');
  guide.className='v4Guide5';
  guide.innerHTML='<span class="v4GuideIcon5">☝</span><span class="v4GuideText5"></span><button type="button">知道了</button>';
  guide.querySelector('button').addEventListener('click',()=>dismissGuide(true));
  document.body.append(guide);
  return guide;
}
function guideText(s){
  return s==='map'
    ? '長按地圖空白處：圖樣、繪圖、照片、定位都在這裡'
    : '長按戰術板空白處：圖樣、繪圖、樓層、平面圖都在這裡';
}
function showGuide(s,{force=false}={}){
  if(!s)return;
  if(!force&&seen(s))return;
  if(document.querySelector('.v4Mode4.open,.v4Radial4.open,.v4Menu4.open'))return;
  clearTimeout(guideTimer);
  const g=buildGuide();
  g.dataset.surface=s;
  g.querySelector('.v4GuideText5').textContent=guideText(s);
  g.classList.add('open');
  guideTimer=setTimeout(()=>dismissGuide(false),7000);
}
function dismissGuide(remember=false){
  clearTimeout(guideTimer);
  if(!guide)return;
  if(remember)markSeen(guide.dataset.surface);
  guide.classList.remove('open');
}
function scheduleGuide(){
  dismissGuide(false);
  const s=surface();
  if(!s)return;
  setTimeout(()=>{if(surface()===s)showGuide(s)},520);
}

function buildHelp(){
  if(help)return help;
  help=document.createElement('div');
  help.className='v4Help5';
  help.innerHTML=`
    <div class="v4HelpCard5" role="dialog" aria-modal="true" aria-label="KTAK 操作提示">
      <div class="v4HelpHead5"><strong>KTAK 快速操作</strong><button type="button" data-close>×</button></div>
      <div class="v4HelpSteps5">
        <div><b>1</b><span><strong>地圖／戰術板</strong><small>長按空白處，直接叫出目前最常用的工具。</small></span></div>
        <div><b>2</b><span><strong>已放置的物件</strong><small>直接點選後移動、旋轉或調整，不必先找工具列。</small></span></div>
        <div><b>3</b><span><strong>底部主列</strong><small>任務、地圖、戰術、指揮、聊天固定在同一位置；權限與離開放在設定。</small></span></div>
      </div>
      <div class="v4HelpActions5"><button type="button" data-reset>重新顯示長按提示</button><button type="button" class="primary" data-ok>知道了</button></div>
    </div>`;
  help.addEventListener('pointerdown',e=>{if(e.target===help)closeHelp()});
  help.querySelector('[data-close]').onclick=closeHelp;
  help.querySelector('[data-ok]').onclick=closeHelp;
  help.querySelector('[data-reset]').onclick=()=>{
    resetSeen();
    closeHelp();
    const s=surface();
    if(s)setTimeout(()=>showGuide(s,{force:true}),120);
  };
  document.body.append(help);
  return help;
}
function openHelp(){dismissGuide(false);buildHelp().classList.add('open')}
function closeHelp(){help?.classList.remove('open')}

function patchSettings(){
  const settings=$('v4SettingsBtn');
  if(!settings||settings.dataset.v4HelpPatched==='1')return;
  settings.dataset.v4HelpPatched='1';
  settings.addEventListener('click',()=>setTimeout(()=>{
    const list=document.querySelector('.v4Menu4.open .v4MenuList');
    if(!list||list.querySelector('[data-v4-help5]'))return;
    const b=document.createElement('button');
    b.type='button';
    b.dataset.v4Help5='1';
    b.innerHTML='<b>?</b><span>操作提示</span><i>›</i>';
    b.onclick=()=>{document.querySelector('.v4Menu4')?.classList.remove('open');openHelp()};
    list.prepend(b);
  },0));
}

function observeWorkspace(){
  new MutationObserver(()=>{syncRoomChip();scheduleGuide()}).observe(document.body,{attributes:true,attributeFilter:['class']});
  const radial=document.querySelector('.v4Radial4');
  if(radial)new MutationObserver(()=>{
    if(radial.classList.contains('open')){
      const s=surface();
      markSeen(s);
      dismissGuide(false);
    }
  }).observe(radial,{attributes:true,attributeFilter:['class']});
}

function boot(){
  buildRoomChip();
  buildGuide();
  patchSettings();
  observeWorkspace();
  syncRoomChip();
  scheduleGuide();
  window.__KTAK_V4.uiRevision=REV;
  window.__KTAK_V4_REFINEMENT={version:REV,showHelp,showGuide,resetSeen,syncRoomChip};
  console.info('[KTAK V4] refinement ready',REV);
}

ready(boot);
})();