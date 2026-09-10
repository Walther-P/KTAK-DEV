(() => {
'use strict';
// ktak-v35-radar-v13
const core=window.__KTAK35_CORE;
const api=window.__KTAK35;
if(!core?.map||!api||!window.L)return;

const map=core.map;
const BOUNDS=[[17.75,115.0],[29.25,126.5]];
const SOUTH=17.75,WEST=115.0,NORTH=29.25,EAST=126.5;
const STRIPS=48;
let pane=null,root=null,strips=[],visible=false,currentUrl='',raf=0;
let frames=[],frameIndex=0,timer=null,state='idle',hours=3,statusText='';
const preloadCache=new Map();
const previousShowLatest=typeof api.showLatestRadar==='function'?api.showLatestRadar.bind(api):null;

function $(id){return document.getElementById(id)}
function ensurePane(){
  if(pane)return;
  try{window.__KTAK35_RADAR_WARP?.hide?.()}catch{}
  pane=map.getPane('ktakRadarV13Pane')||map.createPane('ktakRadarV13Pane');
  pane.style.zIndex='351';pane.style.pointerEvents='none';
  root=document.createElement('div');root.className='ktakRadarV13Root';
  Object.assign(root.style,{position:'absolute',left:'0',top:'0',pointerEvents:'none',opacity:'.58',display:'none'});
  pane.appendChild(root);
  for(let i=0;i<STRIPS;i++){
    const clip=document.createElement('div');
    Object.assign(clip.style,{position:'absolute',overflow:'hidden',pointerEvents:'none',backfaceVisibility:'hidden'});
    const img=document.createElement('img');img.alt='';img.draggable=false;
    Object.assign(img.style,{position:'absolute',left:'0',maxWidth:'none',userSelect:'none',pointerEvents:'none',backfaceVisibility:'hidden'});
    clip.appendChild(img);root.appendChild(clip);strips.push({clip,img});
  }
  map.on('move zoom viewreset resize',scheduleLayout);
}
function scheduleLayout(){if(!visible||raf)return;raf=requestAnimationFrame(()=>{raf=0;layout()})}
function layout(){
  if(!visible||!root)return;
  const left=map.latLngToLayerPoint([23.5,WEST]).x;
  const right=map.latLngToLayerPoint([23.5,EAST]).x;
  const width=Math.max(1,right-left);
  for(let i=0;i<STRIPS;i++){
    const f0=i/STRIPS,f1=(i+1)/STRIPS;
    const latTop=NORTH-(NORTH-SOUTH)*f0,latBottom=NORTH-(NORTH-SOUTH)*f1;
    const yTop=map.latLngToLayerPoint([latTop,WEST]).y;
    const yBottom=map.latLngToLayerPoint([latBottom,WEST]).y;
    const h=Math.max(1,yBottom-yTop+0.8),it=strips[i];
    it.clip.style.transform=`translate3d(${left}px,${yTop}px,0)`;
    it.clip.style.width=`${width+0.7}px`;it.clip.style.height=`${h}px`;
    it.img.style.width=`${width+0.7}px`;it.img.style.height=`${h*STRIPS}px`;it.img.style.top=`${-i*h}px`;
  }
}
function isRadarImage(el){const s=String(el?.src||'').toLowerCase();return /o-a0058|radar|cwaopendata|south\.cwa\.gov\.tw/.test(s)}
function hideOrdinaryRadar(){
  const host=map.getContainer?.()||document;
  host.querySelectorAll?.('img.leaflet-image-layer').forEach(el=>{if(!isRadarImage(el))return;if(el.dataset.ktakRadar13Hidden!=='1'){el.dataset.ktakRadar13Hidden='1';el.dataset.ktakRadar13Opacity=el.style.opacity||''}el.style.opacity='0'});
}
function restoreOrdinaryRadar(){
  const host=map.getContainer?.()||document;
  host.querySelectorAll?.('img.leaflet-image-layer[data-ktak-radar13-hidden="1"]').forEach(el=>{el.style.opacity=el.dataset.ktakRadar13Opacity||'';delete el.dataset.ktakRadar13Hidden;delete el.dataset.ktakRadar13Opacity});
}
function showFrameUrl(url){
  if(!url)return false;ensurePane();hideOrdinaryRadar();
  if(url!==currentUrl){currentUrl=url;for(const it of strips)it.img.src=url}
  visible=true;root.style.display='block';layout();return true;
}
function hideWarp(){visible=false;if(root)root.style.display='none'}
api.setRadarFrame=(url,_bounds)=>showFrameUrl(url);
api.showLatestRadar=(...args)=>{stop(false);hideWarp();restoreOrdinaryRadar();return previousShowLatest?.(...args)};

function preload(frame){
  if(!frame?.url)return null;let img=preloadCache.get(frame.url);if(img)return img;
  img=new Image();img.decoding='async';img.src=frame.url;preloadCache.set(frame.url,img);return img;
}
function setStatus(t){statusText=t||'';const el=$('v35RadarPlaybackStatus');if(el&&el.textContent!==statusText)el.textContent=statusText}
function syncUi(){
  const b=$('v35RadarPlay'),want=state==='playing'?'⏸ 暫停':state==='loading'?'⏳ 載入中':'▶ 播放';if(b&&b.textContent!==want)b.textContent=want;
  const sel=$('v35RadarHours'),hv=String(hours);if(sel&&document.activeElement!==sel&&sel.value!==hv)sel.value=hv;
  if(statusText)setStatus(statusText);
}
function stop(restoreLatest=false){
  if(timer)clearInterval(timer);timer=null;state='idle';syncUi();
  if(restoreLatest){hideWarp();restoreOrdinaryRadar();previousShowLatest?.()}
}
function showIndex(i){
  if(!frames.length)return;frameIndex=(i+frames.length)%frames.length;const f=frames[frameIndex];preload(f);
  showFrameUrl(f.url);setStatus(`${f.time||'雷達影像'} · ${frameIndex+1}/${frames.length}`);
  for(let n=1;n<=6;n++)preload(frames[(frameIndex+n)%frames.length]);
}
async function loadFrames(){
  state='loading';syncUi();setStatus(`載入最近 ${hours} 小時官方雷達影像…`);
  const {data,error}=await core.sb.functions.invoke('ktak35-radar-history',{body:{hours}});
  if(error)throw error;
  const got=(data?.frames||[]).filter(x=>x?.url).sort((a,b)=>(a.timeMs||0)-(b.timeMs||0));
  if(got.length<2)throw new Error('官方歷史雷達影像不足');
  frames=got;frameIndex=0;got.slice(0,Math.min(10,got.length)).forEach(preload);return true;
}
async function play(){
  try{
    hours=Number($('v35RadarHours')?.value)||hours||3;
    if(!frames.length)await loadFrames();
    state='playing';syncUi();showIndex(frameIndex);
    if(timer)clearInterval(timer);
    timer=setInterval(()=>{if(state==='playing')showIndex(frameIndex+1)},1000);
  }catch(e){state='idle';syncUi();setStatus('雷達動畫載入失敗：'+(e?.message||e));core.toast?.('雷達動畫載入失敗')}
}
function toggle(){if(state==='playing'||state==='loading')stop(false);else play()}

document.addEventListener('click',e=>{
  const b=e.target?.closest?.('#v35RadarPlay');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();toggle();
},true);
document.addEventListener('change',e=>{
  if(e.target?.id==='v35RadarHours'){hours=Number(e.target.value)||3;frames=[];frameIndex=0;stop(false);setStatus('已切換時間範圍，按播放載入')}
  if(e.target?.id==='v35RadarToggle'&&!e.target.checked){stop(false);hideWarp();restoreOrdinaryRadar()}
},true);
document.addEventListener('click',e=>{if(e.target?.closest?.('#v35RadarNow')){stop(false);hideWarp();restoreOrdinaryRadar()}},true);

const mo=new MutationObserver(()=>syncUi());mo.observe(document.documentElement,{childList:true,subtree:true});
ensurePane();syncUi();
window.__KTAK35_RADAR13={version:13,bounds:BOUNDS,strips:STRIPS,getState:()=>({state,hours,frameIndex,count:frames.length,statusText}),play,toggle,stop,showFrameUrl,layout,relayout:layout};
})();
