(() => {
'use strict';
// ktak-v35-usability-v2-feedback
const core=window.__KTAK35_CORE;
if(!core)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coarse=()=>matchMedia?.('(pointer:coarse)')?.matches===true;
let memberInfoLayer=null,majorGridLayer=null,radarRefreshTimer=null,opsChannel=null,opsRoomKey='',audioCtx=null;

function ensureFeedbackStyle(){
  if($('v35FeedbackStyle'))return;
  const s=document.createElement('style');s.id='v35FeedbackStyle';
  s.textContent=`
.v35MapModeHud:not(.active){display:none!important}.v35MapModeHud.active{display:flex!important}
.member-loc-pin[data-avatar-user]{cursor:pointer!important}
.v35SearchHelp{margin-top:6px;padding:7px 9px;border:1px dashed #36515e;border-radius:9px;color:#a9bec8;font-size:10px;line-height:1.45;background:#0b151a}
.v35OpsAlertStack{position:fixed;z-index:12000;right:14px;top:14px;display:flex;flex-direction:column;gap:8px;width:min(390px,calc(100vw - 28px));pointer-events:none}
.v35OpsAlert{pointer-events:auto;position:relative;padding:12px 38px 12px 13px;border:1px solid #4e7181;border-radius:12px;background:#102129f2;box-shadow:0 8px 28px #000b;color:#eef9ff;cursor:pointer}.v35OpsAlert b{display:block;font-size:15px;margin-bottom:3px}.v35OpsAlert small{display:block;color:#aac1cc;line-height:1.35}.v35OpsAlert.assignment{border-color:#62b9e8;background:#0d2735f5}.v35OpsAlert.sos{border:2px solid #ff5b5b;background:#4a1015f7;animation:v35SosPulse .85s ease-in-out infinite alternate}.v35OpsAlert.sos b{font-size:17px;color:#fff}.v35OpsAlertClose{position:absolute;right:8px;top:7px;border:0!important;background:transparent!important;color:#dbe9ef!important;padding:4px 7px!important;font-size:15px!important}
@keyframes v35SosPulse{from{box-shadow:0 0 0 0 #ff3b3b30,0 8px 28px #000b}to{box-shadow:0 0 0 8px #ff3b3b00,0 8px 32px #000d}}
@media(min-width:821px){.v35RadarTools{display:grid!important;grid-template-columns:auto auto auto minmax(210px,auto)!important;gap:7px!important;align-items:center!important;padding:8px 10px!important}.v35RadarTools>div{grid-column:1/-1!important;display:flex!important;align-items:baseline!important;gap:8px!important;min-width:0!important}.v35RadarTools>div b,.v35RadarTools>div span{writing-mode:horizontal-tb!important;word-break:keep-all!important}.v35RadarTools>div span{display:inline!important;margin:0!important}.v35RadarTools label{white-space:nowrap!important}.v35RadarTools input{width:100px!important}.v35RadarTools button,.v35RadarTools a{white-space:nowrap!important;width:auto!important}.v35MapModeHud.active{left:14px!important;bottom:14px!important;transform:none!important}}
@media(max-width:820px){.v35MapModeHud.active{left:10px!important;right:auto!important;bottom:calc(82px + env(safe-area-inset-bottom))!important;transform:none!important;max-width:calc(100vw - 88px)!important;padding:5px 7px!important}.v35MapModeHud.active #v35MapModeText{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v35MapModeHud.active button{white-space:nowrap}.v35OpsAlertStack{top:calc(8px + env(safe-area-inset-top));right:8px;width:calc(100vw - 16px)}}`;
  document.head.append(s);
}

function ensureMapHud(){
  if($('v35MapModeHud'))return;
  const hud=document.createElement('div');
  hud.id='v35MapModeHud';hud.className='v35MapModeHud';
  hud.innerHTML='<b id="v35MapModeText">一般瀏覽</b><button id="v35CancelMapAction" type="button">取消操作</button>';
  document.body.append(hud);
  $('v35CancelMapAction').onclick=cancelTransientMapWork;
}
function setMode(text,active=false){ensureMapHud();$('v35MapModeText').textContent=text;$('v35MapModeHud').classList.toggle('active',active)}
function clickIf(id){const b=$(id);if(b&&b.offsetParent!==null){try{b.click()}catch{}}}
function cancelTransientMapWork(){
  for(const id of ['v35SearchCancel','routeDraftCancel','routeEditCancel','mobileFanCancel','mapCtxCancel','drawCancelBtn','mapDrawCancel'])clickIf(id);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  setMode('一般瀏覽',false);
  core.toast?.('已取消目前地圖操作');
}
function bindModeWatch(){
  document.addEventListener('click',e=>{
    const t=e.target?.closest?.('button');if(!t)return;
    const txt=(t.textContent||'').trim();
    if(t.id==='v35SearchSectorBtn'||t.id==='v35SearchSectorBtnMap')setTimeout(()=>setMode((t.textContent||'').includes('完成')?'搜索區：依序點邊界（至少 3 點）→ 完成':'一般瀏覽',(t.textContent||'').includes('完成')),0);
    else if(/路線|導航/.test(txt)&&/開始|建立|繪製|新增/.test(txt))setMode('繪製導航路線',true);
    else if(/扇形/.test(txt)&&/開始|繪製|新增/.test(txt))setMode('繪製觀察扇形',true);
    else if(/取消|完成/.test(txt))setTimeout(()=>setMode('一般瀏覽',false),80);
  },true);
}
function installSearchHelp(){
  for(const id of ['v35SearchSectorBtnMap','v35SearchSectorBtn']){
    const b=$(id);if(!b||b.parentElement?.querySelector?.(`.v35SearchHelp[data-for="${id}"]`))continue;
    const h=document.createElement('div');h.className='v35SearchHelp';h.dataset.for=id;
    h.textContent='搜索區：按下後，依序點選區域邊界至少 3 點，再按「完成搜尋區」並命名。建立後可在指揮頁更新未搜索／搜索中／完成／受阻與進度。';
    b.insertAdjacentElement('afterend',h);
  }
}

function bindChatKeys(){
  const input=$('chatInput');if(!input||input.dataset.v35Keys==='2')return;input.dataset.v35Keys='2';
  input.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing)return;
    const mobile=coarse()||innerWidth<=820;
    if(mobile||e.shiftKey){e.stopImmediatePropagation();return}
    e.preventDefault();e.stopImmediatePropagation();$('chatSendBtn')?.click();
  },true);
  input.addEventListener('keypress',e=>{
    if(e.key!=='Enter'||e.isComposing)return;
    const mobile=coarse()||innerWidth<=820;
    e.stopImmediatePropagation();
    if(!mobile&&!e.shiftKey)e.preventDefault();
  },true);
}

async function clearV35SearchSectors(){
  try{
    if(!core.roomUuid||!core.sb)return;
    const {error}=await core.sb.from('ktak35_search_sectors').delete().eq('room_id',core.roomUuid);
    if(error)console.warn('clear ktak35 search sectors',error);
    await window.__KTAK35?.refresh?.();
  }catch(e){console.warn(e)}
}
function bindClearAll(){
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('button');if(!b)return;
    const txt=(b.textContent||'').replace(/\s+/g,'');
    if(!/(刪除全部地圖圖示|清除所有地圖|清除內容|全部清除)/.test(txt))return;
    cancelTransientMapWork();
    setTimeout(clearV35SearchSectors,150);
  },true);
}

function fmtCoord(n){return Number.isFinite(n)?Number(n).toFixed(6):'—'}
function userById(id){return core.state?.users?.[id]||Object.values(core.state?.users||{}).find(x=>x.id===id)||null}
function memberPopupHtml(u,l){return `<div class="v35MemberPopup"><b>${esc(u?.nick||'隊員')}</b><div>座標：${fmtCoord(l?.lat)}, ${fmtCoord(l?.lng)}</div><div>高度：${Number.isFinite(l?.altitudeM)?Math.round(l.altitudeM)+' m':'—'}${Number.isFinite(l?.altitudeAccuracyM)?' ±'+Math.round(l.altitudeAccuracyM)+' m':''}</div><div>水平精度：${Number.isFinite(l?.accuracyM)?'±'+Math.round(l.accuracyM)+' m':'—'}</div><div>速度：${Number.isFinite(l?.speedMps)?(l.speedMps*3.6).toFixed(1)+' km/h':'—'}</div><div>航向：${Number.isFinite(l?.headingDeg)?Math.round(l.headingDeg)+'°':'—'}</div><div>更新：${l?.updatedAt?new Date(l.updatedAt).toLocaleTimeString('zh-TW'):'—'}</div></div>`}
function openMemberPopup(userId){
  const map=core.map,u=userById(userId),l=core.memberLocations?.[userId];
  if(!map||!window.L||!l||!Number.isFinite(l.lat)||!Number.isFinite(l.lng))return false;
  L.popup({maxWidth:310,closeButton:true,autoPan:true}).setLatLng([l.lat,l.lng]).setContent(memberPopupHtml(u,l)).openOn(map);return true;
}
function bindMemberAvatarClicks(){
  if(document.documentElement.dataset.v35MemberTap==='1')return;document.documentElement.dataset.v35MemberTap='1';
  document.addEventListener('click',e=>{
    const pin=e.target?.closest?.('.member-loc-pin[data-avatar-user]');if(!pin)return;
    const id=pin.getAttribute('data-avatar-user');if(!id)return;
    e.preventDefault();e.stopPropagation();openMemberPopup(id);
  },true);
}
function renderMemberInfoTargets(){
  const map=core.map;if(!map||!window.L)return;
  if(!memberInfoLayer)memberInfoLayer=L.layerGroup().addTo(map);memberInfoLayer.clearLayers();
  const users=Object.values(core.state?.users||{}).filter(x=>x.approved!==false);
  for(const u of users){
    const l=core.memberLocations?.[u.id];if(!l||!Number.isFinite(l.lat)||!Number.isFinite(l.lng))continue;
    L.circleMarker([l.lat,l.lng],{radius:28,opacity:0,fillOpacity:0,weight:0,interactive:true}).bindPopup(memberPopupHtml(u,l),{maxWidth:310}).addTo(memberInfoLayer);
  }
}

function gridStep(z){if(z>=18)return .001;if(z>=16)return .005;if(z>=14)return .01;if(z>=12)return .05;if(z>=10)return .1;return .5}
function renderMajorGrid(){
  const map=core.map;if(!map||!window.L)return;if(!majorGridLayer)majorGridLayer=L.layerGroup();majorGridLayer.clearLayers();
  if(!$('v35GridToggle')?.checked){if(map.hasLayer(majorGridLayer))map.removeLayer(majorGridLayer);return}
  if(!map.hasLayer(majorGridLayer))majorGridLayer.addTo(map);
  const b=map.getBounds(),step=gridStep(map.getZoom()),lo=Math.floor(b.getWest()/step)*step,hi=Math.ceil(b.getEast()/step)*step,bot=Math.floor(b.getSouth()/step)*step,top=Math.ceil(b.getNorth()/step)*step;
  let count=0;
  for(let x=lo;x<=hi&&count<80;x+=step,count++){
    L.polyline([[bot,x],[top,x]],{weight:1.45,opacity:.58,interactive:false,dashArray:'2,4'}).addTo(majorGridLayer);
    L.marker([top-step*.12,x],{interactive:false,icon:L.divIcon({className:'v35GridLabel',html:`${x.toFixed(step<.01?3:2)}°E`})}).addTo(majorGridLayer);
  }
  count=0;
  for(let y=bot;y<=top&&count<80;y+=step,count++){
    L.polyline([[y,lo],[y,hi]],{weight:1.45,opacity:.58,interactive:false,dashArray:'2,4'}).addTo(majorGridLayer);
    L.marker([y,lo+step*.15],{interactive:false,icon:L.divIcon({className:'v35GridLabel',html:`${y.toFixed(step<.01?3:2)}°N`})}).addTo(majorGridLayer);
  }
}

function installRadarTools(){
  const toggle=$('v35RadarToggle');if(!toggle||$('v35RadarTools'))return;
  const host=toggle.closest('.v35MapAid')?.parentElement||toggle.parentElement;
  const d=document.createElement('div');d.id='v35RadarTools';d.className='v35RadarTools';
  d.innerHTML='<div><b>雷達時間工具</b><span>內建圖層顯示中央氣象署最新整合回波，每 5 分鐘自動刷新。</span></div><label>起 <input id="v35RadarStart" type="time"></label><label>迄 <input id="v35RadarEnd" type="time"></label><button id="v35RadarNow" type="button">更新最新回波</button><a href="https://qpeplus.cwa.gov.tw/pub/" target="_blank" rel="noopener">官方歷史時間軸／定量降雨預報 ↗</a>';
  host.append(d);
  const now=new Date(),past=new Date(now.getTime()-60*60*1000),hh=x=>`${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`;
  $('v35RadarStart').value=hh(past);$('v35RadarEnd').value=hh(now);
  $('v35RadarNow').onclick=()=>{if(toggle.checked){toggle.checked=false;toggle.dispatchEvent(new Event('change'));setTimeout(()=>{toggle.checked=true;toggle.dispatchEvent(new Event('change'));},80)}else{toggle.checked=true;toggle.dispatchEvent(new Event('change'))}};
  clearInterval(radarRefreshTimer);radarRefreshTimer=setInterval(()=>$('v35RadarNow')?.click(),5*60*1000);
}

function ensureOpsAlertStack(){let s=$('v35OpsAlertStack');if(s)return s;s=document.createElement('div');s.id='v35OpsAlertStack';s.className='v35OpsAlertStack';document.body.append(s);return s}
function warmAudio(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audioCtx)audioCtx=new A();audioCtx.resume?.()}catch{}}
function tone(freq,at,dur,gain=.045){if(!audioCtx)return;try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(gain,audioCtx.currentTime+at);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+at+dur);o.connect(g).connect(audioCtx.destination);o.start(audioCtx.currentTime+at);o.stop(audioCtx.currentTime+at+dur)}catch{}}
function playOperationalTone(kind){warmAudio();if(kind==='sos'){tone(880,0,.17,.07);tone(660,.22,.17,.07);tone(880,.44,.28,.08)}else{tone(740,0,.12,.05);tone(980,.16,.14,.05)}}
function browserNotify(title,body,tag,urgent=false){try{if(!('Notification'in window)||Notification.permission!=='granted')return;const n=new Notification(title,{body,tag,renotify:true,requireInteraction:urgent});n.onclick=()=>{window.focus();n.close()}}catch{}}
function flashTitle(prefix){const base=document.title.replace(/^🚨 |^📣 /,'');document.title=prefix+' '+base;setTimeout(()=>{if(document.title.startsWith(prefix+' '))document.title=base},10000)}
function openCommandPage(){document.querySelector('[data-page="commandPage"]')?.click()}
function showOperationalAlert(kind,title,body,onOpen){
  const stack=ensureOpsAlertStack(),box=document.createElement('div');box.className=`v35OpsAlert ${kind}`;box.setAttribute('role','alert');
  box.innerHTML=`<button class="v35OpsAlertClose" type="button" aria-label="關閉">×</button><b>${esc(title)}</b><small>${esc(body||'')}</small>`;
  box.querySelector('.v35OpsAlertClose').onclick=e=>{e.stopPropagation();box.remove()};box.onclick=()=>{try{onOpen?.()}finally{box.remove()}};stack.prepend(box);
  setTimeout(()=>box.remove(),kind==='sos'?20000:9000);
  try{navigator.vibrate?.(kind==='sos'?[350,120,350,120,700]:[180,90,180])}catch{}
  playOperationalTone(kind);flashTitle(kind==='sos'?'🚨':'📣');browserNotify(title,body,`ktak35-${kind}-${Date.now()}`,kind==='sos');core.toast?.(title);
}
async function setupOperationalNotifications(){
  const room=core.roomUuid;if(!room||!core.sb||room===opsRoomKey)return;opsRoomKey=room;
  if(opsChannel)try{await core.sb.removeChannel(opsChannel)}catch{}
  opsChannel=core.sb.channel(`ktak35-notify:${room}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'ktak35_assignments',filter:`room_id=eq.${room}`},payload=>{
      const a=payload.new||{},assigned=Array.isArray(a.assigned_to)?a.assigned_to:[];if(!assigned.includes(core.userId))return;
      const priority=a.priority==='critical'?'緊急':a.priority==='high'?'高':'一般';
      showOperationalAlert('assignment',`📣 新派案 · ${priority}`,a.title||'你收到一項新任務',openCommandPage);
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'ktak35_sos',filter:`room_id=eq.${room}`},payload=>{
      const s=payload.new||{};if(s.user_id===core.userId)return;const u=userById(s.user_id),who=u?.nick||'隊員';
      showOperationalAlert('sos',`🚨 SOS · ${who}`,Number.isFinite(s.lat)?`位置 ${fmtCoord(s.lat)}, ${fmtCoord(s.lng)}${Number.isFinite(s.altitude_m)?` · 高度 ${Math.round(s.altitude_m)} m`:''}`:'需要緊急支援',()=>{if(Number.isFinite(s.lat)&&Number.isFinite(s.lng))core.openMapAt?.(s.lat,s.lng,19);else openCommandPage()});
    }).subscribe();
}
function bindAudioWarmup(){if(document.documentElement.dataset.v35AudioWarm==='1')return;document.documentElement.dataset.v35AudioWarm='1';document.addEventListener('pointerdown',warmAudio,{once:true,capture:true})}

function tick(){ensureFeedbackStyle();ensureMapHud();bindChatKeys();installRadarTools();installSearchHelp();bindMemberAvatarClicks();renderMemberInfoTargets();renderMajorGrid();setupOperationalNotifications()}
function bindMap(){const map=core.map;if(!map||map.__v35UsabilityBound)return;map.__v35UsabilityBound=true;map.on('moveend',()=>{renderMajorGrid();renderMemberInfoTargets()});map.on('zoomend',renderMajorGrid);$('v35GridToggle')?.addEventListener('change',renderMajorGrid)}

bindModeWatch();bindClearAll();bindAudioWarmup();ensureFeedbackStyle();ensureMapHud();
setInterval(()=>{bindMap();tick()},2500);
setTimeout(()=>{bindMap();tick()},300);
})();
