// ktak-v35-radar-time-v19
// ktak-v35-metric-grid-v8
// ktak-v35-field-feedback-v7
// ktak-v35-field-feedback-v6
// ktak-v35-field-feedback-v5
// ktak-v35-field-feedback-v4
// ktak-v35-field-performance-v3
(() => {
'use strict';
// ktak-v35-usability-v2-feedback
const core=window.__KTAK35_CORE;
if(!core)return;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coarse=()=>matchMedia?.('(pointer:coarse)')?.matches===true;
let memberInfoLayer=null,majorGridLayer=null,radarRefreshTimer=null,opsChannel=null,opsRoomKey='',opsPollTimer=null,opsSeeded=false,audioCtx=null;const seenAssignments=new Set(),seenSos=new Set();

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
  const existing=$('v35SearchHelpOnce');document.querySelectorAll('.v35SearchHelp').forEach(x=>{if(x!==existing)x.remove()});if(existing)return;
  const b=$('v35SearchSectorBtnMap');if(!b)return;const h=document.createElement('div');h.id='v35SearchHelpOnce';h.className='v35SearchHelp';
  h.textContent='搜索區：按下後依序點選邊界至少 3 點，再按「完成搜尋區」並命名；建立後可在指揮頁更新搜索狀態與進度。';b.insertAdjacentElement('afterend',h);
}

function bindChatKeys(){
  const input=$('chatInput');if(!input||input.dataset.v35Keys==='2')return;input.dataset.v35Keys='2';
  input.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing)return;
    const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
    if(mobile||e.shiftKey){e.stopImmediatePropagation();return}
    e.preventDefault();e.stopImmediatePropagation();$('chatSendBtn')?.click();
  },true);
  input.addEventListener('keypress',e=>{
    if(e.key!=='Enter'||e.isComposing)return;
    const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'');
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
  if(document.documentElement.dataset.v35ClearOwnMap==='1')return;
  document.documentElement.dataset.v35ClearOwnMap='1';
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('button');if(!b)return;
    const txt=(b.textContent||'').replace(/\s+/g,'');
    if(/刪除全部地圖圖示/.test(txt)||/刪除我全部地圖內容/.test(txt)){
      e.preventDefault();e.stopImmediatePropagation();cancelTransientMapWork();
      const mine=(core.state?.map?.items||[]).filter(x=>x?.ownerId===core.userId);
      if(!mine.length){core.toast?.('你目前沒有自己建立的地圖內容');return}
      const routes=mine.filter(x=>x.type==='route').length;
      const drawings=mine.filter(x=>['line','rect','circle','free','freeShape'].includes(x.type)).length;
      const symbols=mine.length-routes-drawings;
      const detail=[symbols?'快速圖樣／標記 '+symbols+' 個':'',drawings?'地圖繪圖 '+drawings+' 個':'',routes?'共享路線 '+routes+' 條':''].filter(Boolean).join('、');
      if(!confirm('確定刪除「你自己建立」的全部地圖內容？\n'+detail+'\n\n不會刪除其他人的內容，也不會刪除 V3.5 搜索區。'))return;
      Promise.resolve(core.clearMyMapWork?.()).catch(err=>core.toast?.('刪除失敗：'+(err?.message||err)));
      return;
    }
    if(/(清除所有地圖|清除內容|全部清除)/.test(txt)){
      cancelTransientMapWork();setTimeout(clearV35SearchSectors,150);
    }
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

function metricGridStep(z){if(z>=19)return 50;if(z>=17)return 100;if(z>=16)return 200;if(z>=15)return 250;if(z>=13)return 500;if(z>=11)return 1000;if(z>=9)return 2000;return 5000}
function metricGridText(m){return m>=1000?(m/1000).toLocaleString('zh-TW',{maximumFractionDigits:m%1000?1:0})+' km':m+' m'}
function ensureMetricGridLabel(){let e=$('v35MetricGridLabel');if(e)return e;e=document.createElement('div');e.id='v35MetricGridLabel';e.className='v35MetricGridLabel';const host=$('v35GridToggle')?.closest('.v35MapAid')?.parentElement;if(host)host.insertBefore(e,host.querySelector('.v35RadarTools')||null);return e}
function renderMajorGrid(){
  const map=core.map;if(!map||!window.L)return;if(!majorGridLayer)majorGridLayer=L.layerGroup();majorGridLayer.clearLayers();const label=ensureMetricGridLabel();
  if(!$('v35GridToggle')?.checked){if(map.hasLayer(majorGridLayer))map.removeLayer(majorGridLayer);if(label)label.classList.add('hidden');return}
  if(!map.hasLayer(majorGridLayer))majorGridLayer.addTo(map);if(label)label.classList.remove('hidden');
  const groundStep=metricGridStep(map.getZoom()),center=map.getCenter(),cos=Math.max(.2,Math.cos(center.lat*Math.PI/180)),projectedStep=groundStep/cos,crs=L.CRS.EPSG3857,b=map.getBounds(),sw=crs.project(b.getSouthWest()),ne=crs.project(b.getNorthEast());
  const minX=Math.floor(sw.x/projectedStep)*projectedStep,maxX=Math.ceil(ne.x/projectedStep)*projectedStep,minY=Math.floor(sw.y/projectedStep)*projectedStep,maxY=Math.ceil(ne.y/projectedStep)*projectedStep;
  const style={weight:1.35,opacity:.58,interactive:false,dashArray:'3,4'};let count=0;
  for(let x=minX;x<=maxX&&count<80;x+=projectedStep,count++){const a=crs.unproject(L.point(x,minY)),c=crs.unproject(L.point(x,maxY));L.polyline([[a.lat,a.lng],[c.lat,c.lng]],style).addTo(majorGridLayer)}
  count=0;for(let y=minY;y<=maxY&&count<80;y+=projectedStep,count++){const a=crs.unproject(L.point(minX,y)),c=crs.unproject(L.point(maxX,y));L.polyline([[a.lat,a.lng],[c.lat,c.lng]],style).addTo(majorGridLayer)}
  if(label)label.innerHTML='<b>▦ 網格 '+metricGridText(groundStep)+'</b><span>每格約 '+metricGridText(groundStep)+' × '+metricGridText(groundStep)+'；右下角比例尺是目前地圖距離參考。</span>';
}

let radarPlayTimer=null,radarFrames=[],radarFrameIndex=0,radarPlaying=false,radarDisplayToken=0;const radarPreloads=new Map();function preloadRadarFrame(f){if(!f?.url)return null;let img=radarPreloads.get(f.url);if(img)return img;img=new Image();img.decoding='async';img.src=f.url;radarPreloads.set(f.url,img);return img}
function stopRadarPlayback(restoreLatest=false){if(radarPlayTimer)clearInterval(radarPlayTimer);radarPlayTimer=null;radarPlaying=false;radarDisplayToken++;const b=$('v35RadarPlay');if(b)b.textContent='▶ 播放';if(restoreLatest)window.__KTAK35?.showLatestRadar?.()}
function showRadarFrame(i){if(!radarFrames.length)return;radarFrameIndex=(i+radarFrames.length)%radarFrames.length;const f=radarFrames[radarFrameIndex],token=++radarDisplayToken,img=preloadRadarFrame(f);const apply=()=>{if(token!==radarDisplayToken)return;window.__KTAK35?.setRadarFrame?.(f.url,[[20.5,118.0],[26.5,124.0]]);const s=$('v35RadarPlaybackStatus');if(s)s.textContent=(f.time||'雷達影像')+' · '+(radarFrameIndex+1)+'/'+radarFrames.length;for(let n=1;n<=4;n++)preloadRadarFrame(radarFrames[(radarFrameIndex+n)%radarFrames.length])};if(img?.complete&&img.naturalWidth)apply();else if(img){img.onload=apply;img.onerror=()=>{if(token===radarDisplayToken){const s=$('v35RadarPlaybackStatus');if(s)s.textContent='這一格雷達影像載入失敗，繼續下一格'}}}else apply()}
async function loadRadarPlayback(){const hours=Number($('v35RadarHours')?.value)||3,s=$('v35RadarPlaybackStatus');if(s)s.textContent='載入最近 '+hours+' 小時官方雷達影像…';const {data:r,error}=await core.sb.functions.invoke('ktak35-radar-history',{body:{hours}});if(error)throw error;const frames=(r?.frames||[]).filter(x=>x?.url);if(frames.length<2){if(s)s.textContent='官方歷史影像目前無法直接載入，已開啟中央氣象署動畫頁';window.open(r?.officialUrl||'https://south.cwa.gov.tw/radar_echo','_blank','noopener');return false}radarFrames=frames;radarFrameIndex=0;frames.slice(0,Math.min(10,frames.length)).forEach(preloadRadarFrame);showRadarFrame(0);return true}
async function toggleRadarPlayback(){if(radarPlaying){stopRadarPlayback(false);return}try{if(!radarFrames.length&&!await loadRadarPlayback())return;radarPlaying=true;const b=$('v35RadarPlay');if(b)b.textContent='⏸ 暫停';showRadarFrame(radarFrameIndex);radarPlayTimer=setInterval(()=>showRadarFrame(radarFrameIndex+1),900)}catch(e){const s=$('v35RadarPlaybackStatus');if(s)s.textContent='動畫載入失敗，請改用官方動畫頁';core.toast?.('雷達動畫載入失敗：'+(e?.message||e))}}
function installRadarTools(){const toggle=$('v35RadarToggle');if(!toggle||$('v35RadarTools'))return;const host=toggle.closest('.v35MapAid')?.parentElement||toggle.parentElement,d=document.createElement('div');d.id='v35RadarTools';d.className='v35RadarTools';d.innerHTML='<div><b>雷達時間工具</b><span>內建圖層顯示中央氣象署最新整合回波，每 5 分鐘自動刷新。</span></div><label>起 <input id="v35RadarStart" type="time"></label><label>迄 <input id="v35RadarEnd" type="time"></label><button id="v35RadarNow" type="button">更新最新回波</button><a href="https://qpeplus.cwa.gov.tw/pub/" target="_blank" rel="noopener">官方歷史時間軸／定量降雨預報 ↗</a><div class="v35RadarPlayback"><select id="v35RadarHours" aria-label="雷達動畫時間"><option value="3">最近 3 小時</option><option value="6">最近 6 小時</option><option value="9">最近 9 小時</option><option value="12">最近 12 小時</option></select><button id="v35RadarPlay" type="button">▶ 播放</button><span id="v35RadarPlaybackStatus" class="v35RadarPlaybackStatus">每格約 10 分鐘；歷史影像使用臺灣鄰近回波座標校正，並預載下一幀減少閃爍。</span></div>';host.append(d);const now=new Date(),past=new Date(now.getTime()-60*60*1000),hh=x=>String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0');$('v35RadarStart').value=hh(past);$('v35RadarEnd').value=hh(now);function refreshRadarTimeWindow(){const now=new Date(),past=new Date(now.getTime()-60*60*1000),hh=x=>String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0');const start=$('v35RadarStart'),end=$('v35RadarEnd');if(start)start.value=hh(past);if(end)end.value=hh(now);return {start:hh(past),end:hh(now)}}$('v35RadarNow').onclick=()=>{stopRadarPlayback(false);radarFrames=[];const w=refreshRadarTimeWindow();window.__KTAK35?.showLatestRadar?.();const s=$('v35RadarPlaybackStatus');if(s)s.textContent='最新回波已更新 · '+w.end};$('v35RadarPlay').onclick=toggleRadarPlayback;$('v35RadarHours').onchange=()=>{stopRadarPlayback(false);radarFrames=[];$('v35RadarPlaybackStatus').textContent='已切換時間範圍，按播放載入'};toggle.addEventListener('change',()=>{if(!toggle.checked)stopRadarPlayback(false)});clearInterval(radarRefreshTimer);radarRefreshTimer=setInterval(()=>{if(toggle.checked&&!radarPlaying)$('v35RadarNow')?.click()},5*60*1000)} 

function ensureOpsAlertStack(){let s=$('v35OpsAlertStack');if(s)return s;s=document.createElement('div');s.id='v35OpsAlertStack';s.className='v35OpsAlertStack';document.body.append(s);return s}
function warmAudio(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audioCtx)audioCtx=new A();audioCtx.resume?.()}catch{}}
function tone(freq,at,dur,gain=.045){if(!audioCtx)return;try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(gain,audioCtx.currentTime+at);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+at+dur);o.connect(g).connect(audioCtx.destination);o.start(audioCtx.currentTime+at);o.stop(audioCtx.currentTime+at+dur)}catch{}}
function playOperationalTone(kind){warmAudio();if(kind==='sos'){tone(880,0,.17,.07);tone(660,.22,.17,.07);tone(880,.44,.28,.08)}else{tone(740,0,.12,.05);tone(980,.16,.14,.05)}}
function browserNotify(title,body,tag,urgent=false){try{if(!('Notification'in window)||Notification.permission!=='granted')return;const n=new Notification(title,{body,tag,renotify:true,requireInteraction:urgent});n.onclick=()=>{window.focus();n.close()}}catch{}}
function flashTitle(prefix){const base=document.title.replace(/^🚨 |^📣 /,'');document.title=prefix+' '+base;setTimeout(()=>{if(document.title.startsWith(prefix+' '))document.title=base},10000)}
function openCommandPage(){document.querySelector('[data-page="commandPage"]')?.click()}
function markCommandAlert(kind){const nav=document.querySelector('[data-page="commandPage"]');if(!nav)return;nav.classList.add('v35NavAlert');if(kind==='sos')nav.classList.add('v35NavSos');nav.dataset.alertCount=String((+nav.dataset.alertCount||0)+1);if(!nav.dataset.v35AlertBound){nav.dataset.v35AlertBound='1';nav.addEventListener('click',()=>{nav.classList.remove('v35NavAlert','v35NavSos');nav.dataset.alertCount='0'})}}
function showOperationalAlert(kind,title,body,onOpen){
  markCommandAlert(kind);const stack=ensureOpsAlertStack(),box=document.createElement('div');box.className=`v35OpsAlert ${kind}`;box.setAttribute('role','alert');
  box.innerHTML=`<button class="v35OpsAlertClose" type="button" aria-label="關閉">×</button><b>${esc(title)}</b><small>${esc(body||'')}</small>`;
  box.querySelector('.v35OpsAlertClose').onclick=e=>{e.stopPropagation();box.remove()};box.onclick=()=>{try{onOpen?.()}finally{box.remove()}};stack.prepend(box);
  setTimeout(()=>box.remove(),kind==='sos'?12000:4500);
  try{navigator.vibrate?.(kind==='sos'?[350,120,350,120,700]:[180,90,180])}catch{}
  playOperationalTone(kind);flashTitle(kind==='sos'?'🚨':'📣');
}
let notificationSeenRoom='';
function opsSeenKey(){return `ktak35.opsSeen.v4.${core.roomUuid||'none'}`}
function loadOpsSeen(){
  try{const x=JSON.parse(localStorage.getItem(opsSeenKey())||'{}');for(const id of x.a||[])seenAssignments.add(id);for(const id of x.s||[])seenSos.add(id)}catch{}
}
function persistOpsSeen(){
  try{localStorage.setItem(opsSeenKey(),JSON.stringify({a:[...seenAssignments].slice(-120),s:[...seenSos].slice(-120)}))}catch{}
}
function markOpsSeen(kind,id){if(!id)return;(kind==='assignment'?seenAssignments:seenSos).add(id);persistOpsSeen()}
function assignmentAlert(a){
  const assigned=Array.isArray(a?.assigned_to)?a.assigned_to:[];
  if(!a?.id||a.status!=='pending'||!assigned.includes(core.userId)||seenAssignments.has(a.id))return;
  const age=Date.now()-Date.parse(a.created_at||0);if(Number.isFinite(age)&&age>120000){markOpsSeen('assignment',a.id);return}
  markOpsSeen('assignment',a.id);const priority=a.priority==='critical'?'緊急':a.priority==='high'?'高':'一般';
  showOperationalAlert('assignment',`📣 新派案 · ${priority}`,a.title||'你收到一項新任務',openCommandPage);
}
function sosAlert(s){
  if(!s?.id||s.status!=='active'||s.user_id===core.userId||seenSos.has(s.id))return;
  markOpsSeen('sos',s.id);const u=userById(s.user_id),who=u?.nick||'隊員';
  showOperationalAlert('sos',`🚨 SOS · ${who}`,Number.isFinite(s.lat)?`位置 ${fmtCoord(s.lat)}, ${fmtCoord(s.lng)}${Number.isFinite(s.altitude_m)?` · 高度 ${Math.round(s.altitude_m)} m`:''}`:'需要緊急支援',()=>{if(Number.isFinite(s.lat)&&Number.isFinite(s.lng))core.openMapAt?.(s.lat,s.lng,19);else openCommandPage()});
}
async function catchUpOperational(){
  if(!core.roomUuid||!core.sb)return;const room=core.roomUuid;
  const [a,s]=await Promise.all([
    core.sb.from('ktak35_assignments').select('id,title,priority,assigned_to,status,created_at').eq('room_id',room).eq('status','pending').order('created_at',{ascending:false}).limit(30),
    core.sb.from('ktak35_sos').select('id,user_id,status,lat,lng,altitude_m,created_at').eq('room_id',room).eq('status','active').order('created_at',{ascending:false}).limit(30)
  ]);
  for(const x of [...(a.data||[])].reverse())assignmentAlert(x);for(const x of [...(s.data||[])].reverse())sosAlert(x);opsSeeded=true;
}
let opsEventsBound=false;
async function setupOperationalNotifications(){
  const room=core.roomUuid;if(!room||!core.sb)return;
  if(notificationSeenRoom!==room){notificationSeenRoom=room;seenAssignments.clear();seenSos.clear();loadOpsSeen();catchUpOperational().catch(e=>console.warn('KTAK35 notify catch-up',e))}
  if(!opsEventsBound){opsEventsBound=true;window.addEventListener('ktak35:assignment',e=>assignmentAlert(e.detail||{}));window.addEventListener('ktak35:sos',e=>sosAlert(e.detail||{}))}
}
function bindAudioWarmup(){if(document.documentElement.dataset.v35AudioWarm==='1')return;document.documentElement.dataset.v35AudioWarm='1';document.addEventListener('pointerdown',warmAudio,{once:true,capture:true})}

function tick(){ensureFeedbackStyle();ensureMapHud();bindChatKeys();installRadarTools();installSearchHelp();bindMemberAvatarClicks();setupOperationalNotifications()}
function bindMap(){const map=core.map;if(!map||map.__v35UsabilityBound)return;map.__v35UsabilityBound=true;map.on('moveend',()=>{renderMajorGrid();renderMemberInfoTargets()});map.on('zoomend',renderMajorGrid);$('v35GridToggle')?.addEventListener('change',renderMajorGrid);renderMajorGrid();renderMemberInfoTargets()}

bindModeWatch();bindClearAll();bindAudioWarmup();ensureFeedbackStyle();ensureMapHud();
setInterval(()=>{setupOperationalNotifications().catch(()=>{})},2000);
setInterval(()=>{if(document.visibilityState!=='hidden')renderMemberInfoTargets()},15000);
setTimeout(()=>{bindMap();tick()},300);
})();
