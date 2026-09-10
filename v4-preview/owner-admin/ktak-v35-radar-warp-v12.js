(() => {
'use strict';
// ktak-v35-radar-warp-v12
const core=window.__KTAK35_CORE;
const api=window.__KTAK35;
if(!core?.map||!api||!window.L)return;

const map=core.map;
const BOUNDS=[[20.5,118.0],[26.5,124.0]];
const SOUTH=BOUNDS[0][0],WEST=BOUNDS[0][1],NORTH=BOUNDS[1][0],EAST=BOUNDS[1][1];
const STRIPS=36;
let pane=null,root=null,images=[],currentUrl='',visible=false,raf=0;
const originalSetRadarFrame=typeof api.setRadarFrame==='function'?api.setRadarFrame.bind(api):null;
const originalShowLatestRadar=typeof api.showLatestRadar==='function'?api.showLatestRadar.bind(api):null;

function ensurePane(){
  if(pane)return;
  pane=map.getPane('ktakRadarWarpPane')||map.createPane('ktakRadarWarpPane');
  pane.style.zIndex='350';
  pane.style.pointerEvents='none';
  root=document.createElement('div');
  root.className='ktakRadarWarpRoot';
  root.style.position='absolute';
  root.style.left='0';root.style.top='0';
  root.style.pointerEvents='none';
  root.style.opacity='.55';
  pane.appendChild(root);
  for(let i=0;i<STRIPS;i++){
    const clip=document.createElement('div');
    clip.className='ktakRadarWarpStrip';
    clip.style.position='absolute';
    clip.style.overflow='hidden';
    clip.style.pointerEvents='none';
    clip.style.backfaceVisibility='hidden';
    const img=document.createElement('img');
    img.alt='';img.draggable=false;
    img.style.position='absolute';img.style.left='0';img.style.maxWidth='none';
    img.style.userSelect='none';img.style.pointerEvents='none';
    img.style.backfaceVisibility='hidden';
    clip.appendChild(img);root.appendChild(clip);images.push({clip,img});
  }
  map.on('move zoom viewreset resize',scheduleLayout);
}

function scheduleLayout(){
  if(!visible||raf)return;
  raf=requestAnimationFrame(()=>{raf=0;layout()});
}

function layout(){
  if(!visible||!root)return;
  const left=map.latLngToLayerPoint([23.5,WEST]).x;
  const right=map.latLngToLayerPoint([23.5,EAST]).x;
  const width=Math.max(1,right-left);
  for(let i=0;i<STRIPS;i++){
    const f0=i/STRIPS,f1=(i+1)/STRIPS;
    const latTop=NORTH-(NORTH-SOUTH)*f0;
    const latBottom=NORTH-(NORTH-SOUTH)*f1;
    const yTop=map.latLngToLayerPoint([latTop,WEST]).y;
    const yBottom=map.latLngToLayerPoint([latBottom,WEST]).y;
    const h=Math.max(1.5,yBottom-yTop+0.8);
    const {clip,img}=images[i];
    clip.style.transform=`translate3d(${left}px,${yTop}px,0)`;
    clip.style.width=`${width+0.5}px`;
    clip.style.height=`${h}px`;
    // Each source strip is 1/STRIPS of the latitude-linear source image.
    // Stretch only that strip to its exact Web-Mercator screen height.
    const fullH=h*STRIPS;
    img.style.width=`${width+0.5}px`;
    img.style.height=`${fullH}px`;
    img.style.top=`${-i*h}px`;
  }
}

function hideWarp(){
  visible=false;
  if(root)root.style.display='none';
}

function showWarp(url){
  if(!url)return false;
  ensurePane();
  const toggle=document.getElementById('v35RadarToggle');
  // Remove the ordinary single-image radar layer first. Keeping the checkbox
  // visually enabled avoids changing the user's radar setting while playback runs.
  if(toggle?.checked){
    toggle.checked=false;
    toggle.dispatchEvent(new Event('change'));
  }
  if(toggle)toggle.checked=true;
  if(url!==currentUrl){
    currentUrl=url;
    for(const {img} of images)img.src=url;
  }
  visible=true;root.style.display='block';layout();
  return true;
}

api.setRadarFrame=(url,_frameBounds)=>showWarp(url);
api.showLatestRadar=(...args)=>{
  hideWarp();
  return originalShowLatestRadar?.(...args);
};

const toggle=document.getElementById('v35RadarToggle');
if(toggle&&!toggle.dataset.v35Warp12){
  toggle.dataset.v35Warp12='1';
  toggle.addEventListener('change',()=>{if(!toggle.checked)hideWarp()});
}

// Expose a tiny diagnostic hook for field testing without changing normal UI.
window.__KTAK35_RADAR_WARP={version:12,bounds:BOUNDS,strips:STRIPS,relayout:layout,hide:hideWarp,show:showWarp,originalSetRadarFrame};
})();
