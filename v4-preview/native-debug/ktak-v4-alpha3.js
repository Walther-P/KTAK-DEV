/* KTAK V4.0.0-alpha.3 — human-first interaction */
(() => {
'use strict';
const VERSION='4.0.0-alpha.3',HOLD_MS=520,MOVE_TOL=11;
const $=id=>document.getElementById(id),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const core=()=>window.__KTAK_V4_BRIDGE;
let radial,panel,dock,mapHud,teamStrip,mode,ghost,hold=null,activePage='briefPage',lastPoint={x:200,y:260};
const pages=[['briefPage','📋','任務'],['mapPage','🗺️','地圖'],['boardPage','🧭','戰術'],['commandPage','🚨','指揮'],['chatPage','💬','聊天']];

function closeMenus(){radial?.classList.remove('open');panel?.classList.remove('open')}
function clearMode(){mode?.classList.remove('open');ghost?.classList.remove('open')}
function showMode(label,html='',surface=''){
  mode.innerHTML=`${html?`<span class="icon">${html}</span>`:''}<span>${label}</span>`;mode.classList.add('open');
  const svg=html?document.createElement('div'):null;if(svg){svg.innerHTML=html;const only=svg.querySelector('svg');ghost.innerHTML=only?.outerHTML||html}
  ghost.classList.toggle('open',!!surface&&matchMedia('(pointer:fine)').matches&&!!html)
}
document.addEventListener('pointermove',e=>{if(!ghost?.classList.contains('open'))return;ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px'},{passive:true});

function nav(pageId){const b=document.querySelector(`.navBtn[data-page="${pageId}"]`);if(!b)return false;b.click();closeMenus();setTimeout(syncPage,0);return true}
function syncPage(){
  activePage=document.querySelector('.page.active')?.id||activePage;
  $$('.v4Dock3 [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===activePage));
  if(mapHud)mapHud.hidden=activePage!=='mapPage';
  if(activePage==='mapPage')setTimeout(()=>{core()?.invalidateMap?.();core()?.ensureGoogle?.().catch?.(()=>{})},70);
  if(activePage==='boardPage')setTimeout(()=>core()?.renderBoard?.(),30)
}
function buildDock(){
  dock=document.createElement('div');dock.className='v4Dock3';dock.setAttribute('aria-label','KTAK 主選單');
  pages.forEach(([page,icon,label])=>{if(!$(page))return;const b=document.createElement('button');b.type='button';b.dataset.page=page;b.innerHTML=`<b>${icon}</b><span>${label}</span>`;b.onclick=()=>nav(page);dock.append(b)});
  const s=document.createElement('button');s.type='button';s.id='v4SettingsBtn';s.innerHTML='<b>⚙️</b><span>設定</span>';s.onclick=openSettings;dock.append(s);document.body.append(dock)
}
function buildOverlays(){
  radial=document.createElement('div');radial.className='v4Radial3';panel=document.createElement('div');panel.className='v4Panel3';mode=document.createElement('div');mode.className='v4Mode3';ghost=document.createElement('div');ghost.className='v4PlacementGhost';document.body.append(radial,panel,mode,ghost);
  document.addEventListener('pointerdown',e=>{if(panel.classList.contains('open')&&!panel.contains(e.target)&&!radial.contains(e.target))closeMenus()},true)
}
function panelHeader(title,back){const h=document.createElement('div');h.className='v4PanelHead';h.innerHTML='<button type="button" data-back>‹</button><strong></strong><button type="button" data-close>×</button>';h.querySelector('strong').textContent=title;h.querySelector('[data-close]').onclick=closeMenus;const bb=h.querySelector('[data-back]');bb.style.visibility=back?'visible':'hidden';if(back)bb.onclick=back;return h}
function openChoices(title,items,back=null){panel.innerHTML='';panel.append(panelHeader(title,back));const g=document.createElement('div');g.className='v4ChoiceGrid';items.filter(Boolean).forEach(item=>{const b=document.createElement('button');b.type='button';b.disabled=!!item.disabled;b.innerHTML=item.html||`${item.icon?`<b style="font-size:20px">${item.icon}</b>`:''}<span>${item.label}</span>`;b.onclick=()=>item.action?.(b);g.append(b)});panel.append(g);panel.classList.add('open');radial.classList.remove('open')}
function openInput(title,placeholder,initial,onSubmit,back){panel.innerHTML='';panel.append(panelHeader(title,back));const r=document.createElement('div');r.className='v4PanelInput';const i=document.createElement('input');i.placeholder=placeholder;i.value=initial||'';const ok=document.createElement('button');ok.type='button';ok.className='primary';ok.textContent='確定';const submit=()=>{const v=i.value.trim();if(v)onSubmit(v)};ok.onclick=submit;i.onkeydown=e=>{if(e.key==='Enter')submit()};r.append(i,ok);panel.append(r);panel.classList.add('open');radial.classList.remove('open');setTimeout(()=>i.focus(),30)}

function tacticalGroups(sourceId){const root=$(sourceId);if(!root)return[];const groups=[];let current=null;root.querySelectorAll('.tacticalGroupTitle,.tacticalPickBtn').forEach(el=>{if(el.classList.contains('tacticalGroupTitle')){current={label:el.textContent.trim(),buttons:[]};groups.push(current)}else{if(!current){current={label:'圖樣',buttons:[]};groups.push(current)}current.buttons.push(el)}});return groups.filter(g=>g.buttons.length)}
function openSymbols(surface){const groups=tacticalGroups(surface==='map'?'mapTacticalList':'boardTacticalList');openChoices(surface==='map'?'地圖圖樣':'戰術板圖樣',groups.map(g=>({icon:'▦',label:g.label,action:()=>openSymbolGroup(surface,g)})),()=>showRadial(surface,lastPoint.x,lastPoint.y))}
function openSymbolGroup(surface,group){openChoices(group.label,group.buttons.map(original=>({html:original.innerHTML,disabled:original.disabled||original.classList.contains('disabled'),action:()=>{original.click();closeMenus();showMode(original.textContent.trim()||'放置圖樣',original.innerHTML,surface);(surface==='map'?$('map'):$('boardCanvas'))?.focus?.()}})),()=>openSymbols(surface))}
function clickTool(selector,label,surface){const b=document.querySelector(selector);if(!b||b.disabled||b.classList.contains('disabled'))return false;b.click();closeMenus();showMode(label||b.textContent.trim(),'✦',surface);return true}
function openMapDraw(){const items=[['╱','直線','.mapTool[data-tool="line"]'],['□','方形','.mapTool[data-tool="rect"]'],['○','圓形','.mapTool[data-tool="circle"]'],['✎','自由畫筆','.mapTool[data-tool="free"]']].map(([icon,label,sel])=>({icon,label,action:()=>clickTool(sel,label,'map')}));if($('routeDraftStart'))items.push({icon:'🧭',label:'導航路線',action:()=>{closeMenus();$('routeDraftStart').click();showMode('導航路線：依序點地圖節點','🧭','map')}});items.push({icon:'↶',label:'復原',action:()=>{closeMenus();$('mapUndoBtn')?.click()}});openChoices('繪圖',items,()=>showRadial('map',lastPoint.x,lastPoint.y))}
function openBoardDraw(){const d=[['✎','自由畫','.boardTool[data-board-tool="free"]'],['╱','直線','.boardTool[data-board-tool="line"]'],['□','方形','.boardTool[data-board-tool="rect"]'],['○','圓形','.boardTool[data-board-tool="circle"]'],['T','文字','.boardTool[data-board-tool="text"]'],['⌫','橡皮擦','.boardTool[data-board-tool="eraser"]']];openChoices('繪圖',d.map(([icon,label,sel])=>({icon,label,action:()=>clickTool(sel,label,'board')})),()=>showRadial('board',lastPoint.x,lastPoint.y))}

function floorButtons(){return $$('#floorSideList button')}
function openFloors(){const items=[];floorButtons().forEach((orig,i)=>items.push({icon:'▤',label:orig.textContent.trim()||`樓層 ${i+1}`,action:()=>{orig.click();closeMenus();clearMode()}}));items.push({icon:'＋',label:'新增樓層',action:()=>openInput('新增樓層','例如：1F、大廳、頂樓','',name=>{$('addFloorBtn')?.click();setTimeout(()=>{const i=$('floorName');if(i){i.value=name;i.dispatchEvent(new Event('change',{bubbles:true}))}closeMenus();clearMode()},40)},openFloors)});items.push({icon:'✎',label:'重新命名',action:()=>openInput('重新命名樓層','樓層名稱',$('floorName')?.value||'',name=>{const i=$('floorName');if(i){i.value=name;i.dispatchEvent(new Event('change',{bubbles:true}))}closeMenus()},openFloors)});if($('deleteFloorBtn'))items.push({icon:'🗑',label:'刪除本層',action:()=>{closeMenus();$('deleteFloorBtn').click()}});openChoices('樓層',items,()=>showRadial('board',lastPoint.x,lastPoint.y))}
function activateFreeOutline(){if(!core()?.setFreeOutline?.($('#boardColor')?.value||'#45aff2'))return;closeMenus();showMode('自由建築外框','⌁','board')}
function openLayout(){const lock=$('boardLayoutLockBtn');openChoices('建築格局',[
  {icon:'▭',label:'矩形外框',action:()=>clickTool('.boardTool[data-board-tool="rect"]','矩形建築外框','board')},
  {icon:'⌁',label:'自由外框',action:activateFreeOutline},
  {icon:'▮',label:'門',action:()=>clickTool('.boardTool[data-board-tool="door"]','門','board')},
  {icon:'▤',label:'樓梯 ↑',action:()=>clickTool('.boardTool[data-board-tool="stairsUp"]','樓梯 ↑','board')},
  {icon:'▤',label:'樓梯 ↓',action:()=>clickTool('.boardTool[data-board-tool="stairsDown"]','樓梯 ↓','board')},
  lock&&{icon:'🔒',label:lock.textContent.includes('解除')?'解除格局鎖定':'鎖定格局',action:()=>{closeMenus();lock.click();clearMode()}},
  $('boardFloorplanSet')&&{icon:'🖼',label:'平面圖背景',action:()=>{closeMenus();$('boardFloorplanSet').click()}},
  $('boardFloorplanRemove')&&{icon:'✕',label:'移除平面圖',action:()=>{closeMenus();$('boardFloorplanRemove').click()}}
],()=>showRadial('board',lastPoint.x,lastPoint.y))}
function choosePhoto(){closeMenus();const i=$('photoInput');if(!i||i.disabled)return;i.addEventListener('change',()=>{if(i.files?.length)setTimeout(()=>{$('photoPlaceBtn')?.click();showMode('照片：點地圖放置','📷','map')},0)},{once:true});i.click()}

function safePoint(x,y){const r=118;return{x:Math.max(r,Math.min(innerWidth-r,x)),y:Math.max(r+4,Math.min(innerHeight-r-8,y))}}
function radialBtn(icon,label,fn){const b=document.createElement('button');b.type='button';b.innerHTML=`<b>${icon}</b>${label}`;b.onclick=e=>{e.preventDefault();e.stopPropagation();fn()};return b}
function showRadial(surface,x,y){closeMenus();lastPoint=safePoint(x,y);radial.innerHTML='';const a=surface==='map'?[['◉','圖樣',()=>openSymbols('map')],['✎','繪圖',openMapDraw],['📷','照片',choosePhoto],['🎯','定位',()=>{closeMenus();$('locationCenterBtn')?.click()}],['↶','復原',()=>{closeMenus();$('mapUndoBtn')?.click()}]]:[['◉','圖樣',()=>openSymbols('board')],['✎','繪圖',openBoardDraw],['▤','樓層',openFloors],['⌂','格局',openLayout],['↶','復原',()=>{closeMenus();$('boardUndoBtn')?.click()}]];a.forEach(x=>radial.append(radialBtn(...x)));const c=document.createElement('button');c.type='button';c.className='cancel';c.textContent='取消';c.onclick=closeMenus;radial.append(c);radial.style.left=lastPoint.x+'px';radial.style.top=lastPoint.y+'px';radial.classList.add('open')}
function mapObjectTarget(t){return !!t?.closest?.('.leaflet-marker-icon,.leaflet-interactive,.map-symbol-shell,.photoPin,.map-select-frame,.map-transform-handle,.map-duplicate-handle')}
function installBlankLongPress(el,surface){if(!el)return;const cancel=()=>{if(hold?.timer)clearTimeout(hold.timer);hold=null};el.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;if(e.target?.closest?.('button,input,select,textarea,a,.v4MapHud,.quickBriefDock'))return;if(surface==='map'){if(mapObjectTarget(e.target)||core()?.mapTool?.()!=='pan')return}else{if(core()?.boardTool?.()!=='select'||core()?.boardHit?.(e.clientX,e.clientY))return}cancel();hold={id:e.pointerId,x:e.clientX,y:e.clientY,timer:setTimeout(()=>{showRadial(surface,e.clientX,e.clientY);hold=null},HOLD_MS)}},{capture:true,passive:true});el.addEventListener('pointermove',e=>{if(hold&&hold.id===e.pointerId&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>MOVE_TOL)cancel()},{capture:true,passive:true});el.addEventListener('pointerup',cancel,{capture:true,passive:true});el.addEventListener('pointercancel',cancel,{capture:true,passive:true})}

function buildMapHud(){
  mapHud=document.createElement('div');mapHud.className='v4MapHud';mapHud.hidden=true;const search=document.createElement('div');search.className='v4MapSearch';const input=document.createElement('input');input.id='v4MapSearch';input.placeholder='搜尋地址';const go=document.createElement('button');go.type='button';go.title='搜尋';go.textContent='⌕';const sat=document.createElement('button');sat.type='button';sat.title='道路圖／衛星';sat.textContent='🛰';const street=document.createElement('button');street.type='button';street.title='Google 街景';street.textContent='👁';const run=()=>{const old=$('mapSearch');if(old){old.value=input.value.trim();$('mapSearchBtn')?.click()}};go.onclick=run;input.onkeydown=e=>{if(e.key==='Enter')run()};sat.onclick=()=>$('mapLayerBtn')?.click();street.onclick=()=>$('streetViewBtn')?.click();search.append(input,go,sat,street);teamStrip=document.createElement('div');teamStrip.className='v4TeamStrip';mapHud.append(search,teamStrip);document.body.append(mapHud);
  const oldList=$('locationMemberList');if(oldList){new MutationObserver(syncTeamStrip).observe(oldList,{childList:true,subtree:true,attributes:true});syncTeamStrip()}
}
function syncTeamStrip(){if(!teamStrip)return;teamStrip.innerHTML='';$$('#locationMemberList .locationMemberRow').forEach(row=>{const jump=row.querySelector('.locationJumpAvatar');const b=document.createElement('button');b.type='button';b.className='v4TeamChip';const name=(row.querySelector('span')?.childNodes?.[0]?.textContent||row.textContent||'隊員').trim().replace('（我）','');if(jump){b.innerHTML=jump.outerHTML+`<span>${name}</span>`;b.onclick=()=>jump.click()}else{b.innerHTML=`<span>○</span><span>${name}</span>`;b.disabled=true}teamStrip.append(b)})}
function openSettings(){const items=[];if($('permissionPage')&&!$('permissionTab')?.classList.contains('hidden'))items.push({icon:'🔐',label:'權限',action:()=>nav('permissionPage')});items.push({icon:'↩',label:'離開房間',action:()=>{closeMenus();$('leaveBtn')?.click()}});openChoices('設定',items)}
function installModeCleanup(){$('map')?.addEventListener('click',()=>setTimeout(()=>{if(core()?.mapTool?.()==='pan')clearMode()},120),true);$('boardCanvas')?.addEventListener('pointerup',()=>setTimeout(()=>{if(core()?.boardTool?.()==='select')clearMode()},150),true);document.addEventListener('click',e=>{if(e.target?.closest?.('.navBtn,.v4Dock3'))clearMode()},true)}
function boot(){
  if(!core())throw new Error('KTAK V4 bridge unavailable');document.body.classList.remove('ktakV4');document.body.classList.add('ktakV4A3');buildDock();buildOverlays();buildMapHud();installBlankLongPress($('map'),'map');installBlankLongPress($('boardCanvas'),'board');installModeCleanup();syncPage();const main=document.querySelector('main');if(main)new MutationObserver(syncPage).observe(main,{subtree:true,attributes:true,attributeFilter:['class']});window.addEventListener('orientationchange',()=>setTimeout(()=>{syncPage();closeMenus()},120));window.__KTAK_V4={version:VERSION,baseVersion:'3.5.11',interaction:'long-press-category-hierarchical',openSymbols,openMapDraw,openBoardDraw,openFloors,openLayout,showRadial}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
