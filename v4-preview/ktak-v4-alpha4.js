/* KTAK V4.0.0-alpha.4 — compact human-first interaction */
(() => {
'use strict';
const VERSION='4.0.0-alpha.4',HOLD_MS=520,MOVE_TOL=12;
const $=id=>document.getElementById(id),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const core=()=>window.__KTAK_V4_BRIDGE;
let radial,panel,dock,mapHud,teamStrip,mode,ghost,hold=null,activePage='briefPage',lastPoint={x:220,y:260},suppressClickUntil=0;
const pages=[['briefPage','📋','任務'],['mapPage','🗺️','地圖'],['boardPage','🧭','戰術'],['commandPage','🚨','指揮'],['chatPage','💬','聊天']];

function closeMenus(){radial?.classList.remove('open');panel?.classList.remove('open')}
function clearMode(){if(!mode)return;mode.classList.remove('open','actionable');mode.innerHTML='';ghost?.classList.remove('open')}
function showMode(label,html='',surface='',actions=[]){
  mode.innerHTML='';
  const lead=document.createElement('span');lead.className='v4ModeLabel';lead.innerHTML=`${html?`<span class="icon">${html}</span>`:''}<span>${label}</span>`;mode.append(lead);
  if(actions.length){const box=document.createElement('span');box.className='v4ModeActions';actions.forEach(a=>{const b=document.createElement('button');b.type='button';b.textContent=a.label;b.onclick=e=>{e.preventDefault();e.stopPropagation();a.action()};box.append(b)});mode.append(box)}
  mode.classList.add('open');mode.classList.toggle('actionable',actions.length>0);
  if(surface&&html&&matchMedia('(pointer:fine)').matches){const wrap=document.createElement('div');wrap.innerHTML=html;ghost.innerHTML=wrap.querySelector('svg')?.outerHTML||html;ghost.classList.add('open')}else ghost.classList.remove('open')
}
function showToolMode(label,surface,html='✦'){showMode(label,html,surface,[{label:'結束',action:()=>{core()?.cancelSurface?.(surface);clearMode()}}])}
function showRouteMode(){showMode('導航路線：點地圖加入節點','🧭','map',[
  {label:'退一步',action:()=>$('routeDraftUndo')?.click()},
  {label:'完成',action:()=>{const b=$('routeDraftSave');if(!b||b.disabled)return;b.click();clearMode()}},
  {label:'取消',action:()=>{$('routeDraftClear')?.click();core()?.cancelSurface?.('map');clearMode()}}
])}
document.addEventListener('pointermove',e=>{if(!ghost?.classList.contains('open'))return;ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px'},{passive:true});

function nav(pageId){const b=document.querySelector(`.navBtn[data-page="${pageId}"]`);if(!b)return false;b.click();closeMenus();clearMode();setTimeout(syncPage,0);return true}
function syncPage(){
  activePage=document.querySelector('.page.active')?.id||activePage;
  $$('.v4Dock4 [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===activePage));
  if(mapHud){mapHud.hidden=activePage!=='mapPage';mapHud.style.display=activePage==='mapPage'?'grid':'none'}
  document.body.classList.toggle('v4MapActive',activePage==='mapPage');
  document.body.classList.toggle('v4BoardActive',activePage==='boardPage');
  if(activePage==='mapPage')setTimeout(async()=>{core()?.invalidateMap?.();const r=await core()?.ensureGoogle?.();if(r?.pending)setTimeout(()=>core()?.ensureGoogle?.(),700)},80);
  if(activePage==='boardPage')setTimeout(()=>core()?.renderBoard?.(),40)
}
function buildDock(){
  dock=document.createElement('div');dock.className='v4Dock4';dock.setAttribute('aria-label','KTAK 主選單');
  pages.forEach(([page,icon,label])=>{if(!$(page))return;const b=document.createElement('button');b.type='button';b.dataset.page=page;b.innerHTML=`<b>${icon}</b><span>${label}</span>`;b.onclick=()=>nav(page);dock.append(b)});
  const s=document.createElement('button');s.type='button';s.id='v4SettingsBtn';s.innerHTML='<b>⚙️</b><span>設定</span>';s.onclick=openSettings;dock.append(s);document.body.append(dock)
}
function buildOverlays(){
  radial=document.createElement('div');radial.className='v4Radial4';panel=document.createElement('div');panel.className='v4Menu4';mode=document.createElement('div');mode.className='v4Mode4';ghost=document.createElement('div');ghost.className='v4PlacementGhost4';document.body.append(radial,panel,mode,ghost);
  document.addEventListener('pointerdown',e=>{if(panel.classList.contains('open')&&!panel.contains(e.target)&&!radial.contains(e.target))closeMenus()},true)
}
function menuPos(){const w=Math.min(310,innerWidth-16),h=Math.min(420,innerHeight-90);let left=Math.max(8,Math.min(innerWidth-w-8,lastPoint.x+18));let top=Math.max(8,Math.min(innerHeight-h-8,lastPoint.y-70));if(lastPoint.x>innerWidth*.62)left=Math.max(8,lastPoint.x-w-18);return{left,top,w,h}}
function positionMenu(){const p=menuPos();panel.style.left=p.left+'px';panel.style.top=p.top+'px';panel.style.width=p.w+'px';panel.style.maxHeight=p.h+'px'}
function menuHeader(title,back){const h=document.createElement('div');h.className='v4MenuHead';h.innerHTML='<button type="button" data-back>‹</button><strong></strong><button type="button" data-close>×</button>';h.querySelector('strong').textContent=title;h.querySelector('[data-close]').onclick=closeMenus;const bb=h.querySelector('[data-back]');bb.style.visibility=back?'visible':'hidden';if(back)bb.onclick=back;return h}
function openChoices(title,items,back=null,{icons=false}={}){panel.innerHTML='';panel.append(menuHeader(title,back));const g=document.createElement('div');g.className='v4MenuList'+(icons?' iconGrid':'');items.filter(Boolean).forEach(item=>{const b=document.createElement('button');b.type='button';b.disabled=!!item.disabled;b.innerHTML=item.html||`${item.icon?`<b>${item.icon}</b>`:''}<span>${item.label}</span>${item.more?'<i>›</i>':''}`;b.onclick=()=>item.action?.(b);g.append(b)});panel.append(g);positionMenu();panel.classList.add('open');radial.classList.remove('open')}
function openInput(title,placeholder,initial,onSubmit,back){panel.innerHTML='';panel.append(menuHeader(title,back));const r=document.createElement('div');r.className='v4MenuInput';const i=document.createElement('input');i.placeholder=placeholder;i.value=initial||'';const ok=document.createElement('button');ok.type='button';ok.className='primary';ok.textContent='確定';const submit=()=>{const v=i.value.trim();if(v)onSubmit(v)};ok.onclick=submit;i.onkeydown=e=>{if(e.key==='Enter')submit()};r.append(i,ok);panel.append(r);positionMenu();panel.classList.add('open');radial.classList.remove('open');setTimeout(()=>i.focus(),30)}

function tacticalGroups(surface){return core()?.symbolCatalog?.(surface)||[]}
function openSymbols(surface){const groups=tacticalGroups(surface);openChoices('圖樣',groups.map(g=>({icon:'▦',label:g.label,more:true,action:()=>openSymbolGroup(surface,g)})),()=>showRadial(surface,lastPoint.x,lastPoint.y))}
function openSymbolGroup(surface,group){openChoices(group.label,(group.items||[]).map(item=>({html:item.html||`<span>${item.label}</span>`,action:()=>{if(!core()?.selectSymbol?.(surface,item.key))return;closeMenus();showToolMode(item.label||'放置圖樣',surface,item.html||'✦');(surface==='map'?$('map'):$('boardCanvas'))?.focus?.()}})),()=>openSymbols(surface),{icons:true})}
function clickTool(selector,label,surface){const b=document.querySelector(selector);if(!b||b.disabled||b.classList.contains('disabled'))return false;b.click();closeMenus();showToolMode(label||b.textContent.trim(),surface);return true}
function openMapDraw(){const items=[
  {icon:'╱',label:'直線',action:()=>clickTool('.mapTool[data-tool="line"]','直線','map')},
  {icon:'□',label:'方形',action:()=>clickTool('.mapTool[data-tool="rect"]','方形','map')},
  {icon:'○',label:'圓形',action:()=>clickTool('.mapTool[data-tool="circle"]','圓形','map')},
  {icon:'✎',label:'自由畫筆',action:()=>clickTool('.mapTool[data-tool="free"]','自由畫筆','map')},
  $('routeDraftStart')&&{icon:'🧭',label:'導航路線',action:()=>{closeMenus();$('routeDraftStart').click();showRouteMode()}},
  {icon:'↶',label:'復原',action:()=>{closeMenus();$('mapUndoBtn')?.click()}}
];openChoices('繪圖',items,()=>showRadial('map',lastPoint.x,lastPoint.y))}
function openBoardDraw(){const defs=[
  ['✎','自由畫','.boardTool[data-board-tool="free"]'],['╱','直線','.boardTool[data-board-tool="line"]'],['□','方形','.boardTool[data-board-tool="rect"]'],['○','圓形','.boardTool[data-board-tool="circle"]'],['T','文字','.boardTool[data-board-tool="text"]'],['▮','門','.boardTool[data-board-tool="door"]'],['▤','樓梯 ↑','.boardTool[data-board-tool="stairsUp"]'],['▤','樓梯 ↓','.boardTool[data-board-tool="stairsDown"]'],['⌫','橡皮擦','.boardTool[data-board-tool="eraser"]']
];openChoices('繪圖／建築',defs.map(([icon,label,sel])=>({icon,label,action:()=>clickTool(sel,label,'board')})),()=>showRadial('board',lastPoint.x,lastPoint.y))}
function floorButtons(){return $$('#floorSideList button')}
function openFloors(){const items=[];floorButtons().forEach((orig,i)=>items.push({icon:'▤',label:orig.textContent.trim()||`樓層 ${i+1}`,action:()=>{orig.click();closeMenus();clearMode()}}));items.push({icon:'＋',label:'新增樓層',action:()=>openInput('新增樓層','例如：1F、大廳、頂樓','',name=>{$('addFloorBtn')?.click();setTimeout(()=>{const i=$('floorName');if(i){i.value=name;i.dispatchEvent(new Event('change',{bubbles:true}))}closeMenus()},40)},openFloors)});items.push({icon:'✎',label:'重新命名',action:()=>openInput('重新命名樓層','樓層名稱',$('floorName')?.value||'',name=>{const i=$('floorName');if(i){i.value=name;i.dispatchEvent(new Event('change',{bubbles:true}))}closeMenus()},openFloors)});if($('deleteFloorBtn'))items.push({icon:'🗑',label:'刪除本層',action:()=>{closeMenus();$('deleteFloorBtn').click()}});openChoices('樓層',items,()=>showRadial('board',lastPoint.x,lastPoint.y))}
function openFloorplan(){openChoices('平面圖',[
  $('boardFloorplanSet')&&{icon:'🖼',label:'上傳／更換平面圖',action:()=>{closeMenus();$('boardFloorplanSet').click()}},
  $('boardFloorplanRemove')&&{icon:'✕',label:'移除平面圖',action:()=>{closeMenus();$('boardFloorplanRemove').click()}}
],()=>showRadial('board',lastPoint.x,lastPoint.y))}
function choosePhoto(){closeMenus();const i=$('photoInput');if(!i||i.disabled)return;i.addEventListener('change',()=>{if(i.files?.length)setTimeout(()=>{$('photoPlaceBtn')?.click();showToolMode('照片：點地圖放置','map','📷')},0)},{once:true});i.click()}

function safePoint(x,y){const r=112;return{x:Math.max(r,Math.min(innerWidth-r,x)),y:Math.max(r+8,Math.min(innerHeight-r-8,y))}}
function radialBtn(icon,label,fn){const b=document.createElement('button');b.type='button';b.innerHTML=`<b>${icon}</b>${label}`;b.onclick=e=>{e.preventDefault();e.stopPropagation();fn()};return b}
function showRadial(surface,x,y){closeMenus();lastPoint=safePoint(x,y);radial.innerHTML='';const a=surface==='map'?[['◉','圖樣',()=>openSymbols('map')],['✎','繪圖',openMapDraw],['📷','照片',choosePhoto],['🎯','定位',()=>{closeMenus();$('locationCenterBtn')?.click()}],['↶','復原',()=>{closeMenus();$('mapUndoBtn')?.click()}]]:[['◉','圖樣',()=>openSymbols('board')],['✎','繪圖',openBoardDraw],['▤','樓層',openFloors],['🖼','平面圖',openFloorplan],['↶','復原',()=>{closeMenus();$('boardUndoBtn')?.click()}]];a.forEach(x=>radial.append(radialBtn(...x)));const c=document.createElement('button');c.type='button';c.className='cancel';c.textContent='取消';c.onclick=closeMenus;radial.append(c);radial.style.left=lastPoint.x+'px';radial.style.top=lastPoint.y+'px';radial.classList.add('open')}
function mapObjectTarget(t){return !!t?.closest?.('.leaflet-marker-icon,.leaflet-interactive,.map-symbol-shell,.photoPin,.map-select-frame,.map-transform-handle,.map-duplicate-handle')}
function installLongPress(el,surface){
  if(!el)return;
  const cancel=()=>{if(hold?.timer)clearTimeout(hold.timer);hold=null};
  el.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    if(e.target?.closest?.('button,input,select,textarea,a,.v4MapHud4,.quickBriefDock,.v4Mode4'))return;
    if(surface==='map'&&mapObjectTarget(e.target))return;
    if(surface==='board'&&core()?.boardTool?.()==='select'&&core()?.boardHit?.(e.clientX,e.clientY))return;
    cancel();
    hold={id:e.pointerId,x:e.clientX,y:e.clientY,timer:setTimeout(()=>{
      const px=e.clientX,py=e.clientY;
      suppressClickUntil=Date.now()+850;
      try{core()?.cancelSurface?.(surface)}catch(err){console.warn('[KTAK V4] tool cancel recovered before radial',err)}
      clearMode();
      hold=null;
      requestAnimationFrame(()=>showRadial(surface,px,py))
    },HOLD_MS)}
  },{capture:true,passive:true});
  el.addEventListener('pointermove',e=>{if(hold&&hold.id===e.pointerId&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>MOVE_TOL)cancel()},{capture:true,passive:true});
  const end=()=>cancel();
  el.addEventListener('pointerup',end,{capture:true,passive:true});
  el.addEventListener('pointercancel',end,{capture:true,passive:true});
  el.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
  el.addEventListener('contextmenu',e=>{if(e.pointerType==='touch'||matchMedia('(pointer:coarse)').matches)e.preventDefault()})
}

function buildMapHud(){
  mapHud=document.createElement('div');mapHud.className='v4MapHud4';mapHud.hidden=true;
  const search=document.createElement('div');search.className='v4MapSearch4';const input=document.createElement('input');input.id='v4MapSearch';input.placeholder='搜尋地址';const go=document.createElement('button');go.type='button';go.title='搜尋';go.textContent='⌕';const sat=document.createElement('button');sat.type='button';sat.title='道路／衛星';sat.textContent='🛰';const street=document.createElement('button');street.type='button';street.title='Google 街景';street.textContent='👁';
  const run=()=>{const old=$('mapSearch');if(!old)return;old.value=input.value.trim();$('mapSearchBtn')?.click()};
  go.onclick=run;input.onkeydown=e=>{if(e.key==='Enter')run()};
  sat.onclick=()=>{$('mapLayerBtn')?.click()};
  street.onclick=()=>{$('streetViewBtn')?.click()};
  search.append(input,go,sat,street);
  teamStrip=document.createElement('div');teamStrip.className='v4TeamStrip4';mapHud.append(search,teamStrip);$('mapPage')?.append(mapHud);
  const oldList=$('locationMemberList');if(oldList){new MutationObserver(syncTeamStrip).observe(oldList,{childList:true,subtree:true,attributes:true});syncTeamStrip()}
}
function syncTeamStrip(){if(!teamStrip)return;teamStrip.innerHTML='';$$('#locationMemberList .locationMemberRow').forEach(row=>{const jump=row.querySelector('.locationJumpAvatar');const b=document.createElement('button');b.type='button';b.className='v4TeamChip4';const name=(row.querySelector('span')?.childNodes?.[0]?.textContent||row.textContent||'隊員').trim().replace('（我）','');if(jump){b.innerHTML=jump.outerHTML+`<span>${name}</span>`;b.onclick=()=>jump.click()}else{b.innerHTML=`<span>○</span><span>${name}</span>`;b.disabled=true}teamStrip.append(b)})}
function openSettings(){const items=[];if($('permissionPage')&&!$('permissionTab')?.classList.contains('hidden'))items.push({icon:'🔐',label:'權限',action:()=>nav('permissionPage')});items.push({icon:'↩',label:'離開房間',action:()=>{closeMenus();$('leaveBtn')?.click()}});openChoices('設定',items)}
function installModeCleanup(){$('map')?.addEventListener('click',()=>setTimeout(()=>{if(core()?.mapTool?.()==='pan')clearMode()},140),true);$('boardCanvas')?.addEventListener('pointerup',()=>setTimeout(()=>{if(core()?.boardTool?.()==='select')clearMode()},160),true);document.addEventListener('click',e=>{if(e.target?.closest?.('.navBtn,.v4Dock4'))clearMode()},true)}
function boot(){
  if(!core())throw new Error('KTAK V4 bridge unavailable');
  document.body.classList.remove('ktakV4','ktakV4A3');
  document.body.classList.add('ktakV4A4');
  buildDock();buildOverlays();buildMapHud();installLongPress($('map'),'map');installLongPress($('boardCanvas'),'board');installModeCleanup();syncPage();
  const pageObserver=new MutationObserver(()=>syncPage());
  document.querySelectorAll('.page').forEach(page=>pageObserver.observe(page,{attributes:true,attributeFilter:['class']}));
  window.addEventListener('orientationchange',()=>setTimeout(()=>{syncPage();closeMenus()},150));
  window.__KTAK_V4={version:VERSION,baseVersion:'3.5.11',interaction:'persistent-long-press-compact-hierarchy',openSymbols,openMapDraw,openBoardDraw,openFloors,openFloorplan,showRadial,syncPage}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
