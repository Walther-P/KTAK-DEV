let googleReady;

function loadGoogle(){
  if(globalThis.google?.maps?.Map)return Promise.resolve();
  if(googleReady)return googleReady;
  googleReady=new Promise((resolve,reject)=>{
    const key=globalThis.KTAK_CONFIG?.GOOGLE_MAPS_API_KEY;
    if(!key){reject(Error('尚未設定 Google 地圖金鑰'));return}
    const timer=setTimeout(()=>reject(Error('Google 地圖連線逾時')),20000);
    globalThis.geodeckGoogleReady=()=>{clearTimeout(timer);resolve()};
    globalThis.gm_authFailure=()=>{clearTimeout(timer);reject(Error('Google 地圖授權失敗，請確認金鑰、網址限制與額度'))};
    const script=document.createElement('script');
    const params=new URLSearchParams({key,v:'quarterly',loading:'async',language:'zh-TW',region:'TW',callback:'geodeckGoogleReady'});
    script.src='https://maps.googleapis.com/maps/api/js?'+params;script.async=true;
    script.onerror=()=>{clearTimeout(timer);reject(Error('Google 地圖無法載入'))};
    document.head.append(script);
  });
  return googleReady;
}

export async function createMap(container,{center,zoom=13}={}){
  await loadGoogle();
  const raw=new google.maps.Map(container,{center,zoom,colorScheme:google.maps.ColorScheme.DARK,
    disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:google.maps.ControlPosition.RIGHT_CENTER},
    clickableIcons:false,gestureHandling:'greedy',minZoom:3,maxZoom:20});
  const rasters=new Map();
  await new Promise(resolve=>google.maps.event.addListenerOnce(raw,'idle',resolve));
  return {raw,
    getCenter:()=>raw.getCenter(),getZoom:()=>raw.getZoom(),setZoom:z=>raw.setZoom(z),
    panTo:p=>raw.panTo(p),getBounds:()=>raw.getBounds(),
    addListener:(event,fn)=>raw.addListener(event,fn),
    addRaster(id,template,{opacity=.7,maxzoom=7,onError}={}){
      this.removeRaster(id);
      const layer={tileSize:new google.maps.Size(256,256),getTile(coord,zoom,doc){
        const tile=doc.createElement('div');Object.assign(tile.style,{width:'256px',height:'256px',overflow:'hidden',position:'relative',opacity:String(opacity)});
        const z=Math.min(zoom,maxzoom),factor=2**(zoom-z),n=2**z,x=((Math.floor(coord.x/factor)%n)+n)%n,y=Math.floor(coord.y/factor);
        if(y<0||y>=n)return tile;
        const img=doc.createElement('img');img.alt='';img.draggable=false;
        Object.assign(img.style,{position:'absolute',width:256*factor+'px',height:256*factor+'px',maxWidth:'none',left:-((coord.x%factor+factor)%factor)*256+'px',top:-(coord.y%factor)*256+'px'});
        img.onerror=()=>onError?.();img.src=template.replace('{x}',x).replace('{y}',y).replace('{z}',z);tile.append(img);return tile;
      },releaseTile(tile){tile.querySelector('img')?.remove()}};
      rasters.set(id,layer);raw.overlayMapTypes.push(layer);
    },
    removeRaster(id){const layer=rasters.get(id);if(!layer)return;for(let i=raw.overlayMapTypes.getLength()-1;i>=0;i--)if(raw.overlayMapTypes.getAt(i)===layer)raw.overlayMapTypes.removeAt(i);rasters.delete(id)}
  };
}

export function createMarker({map,position,title='',label,icon={},zIndex=1,className=''}){
  const el=document.createElement('button');el.type='button';el.className='map-pin '+className;
  el.title=title;el.setAttribute('aria-label',title||'地圖位置');
  el.style.setProperty('--pin-color',icon.fillColor||'#334c60');el.style.setProperty('--pin-border',icon.strokeColor||'#a9bfd3');
  if(icon.scale)el.style.setProperty('--pin-size',Math.max(18,icon.scale*2)+'px');
  Object.assign(el.style,{position:'absolute',zIndex:String(zIndex),transform:'translate(-50%,-50%)'});
  const text=document.createElement('span');el.append(text);
  let point=position;const overlay=new google.maps.OverlayView();
  overlay.onAdd=()=>{overlay.getPanes().overlayMouseTarget.append(el);google.maps.OverlayView.preventMapHitsAndGesturesFrom(el)};
  overlay.draw=()=>{const p=overlay.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(point));if(p){el.style.left=p.x+'px';el.style.top=p.y+'px'}};
  overlay.onRemove=()=>el.remove();
  const adapter={element:el,setMap:m=>overlay.setMap(m?.raw||null),setPosition:p=>{point=p;overlay.draw()},
    setLabel:l=>{text.textContent=typeof l==='string'?l:l?.text||'';text.style.color=l?.color||'#f1f5fa'},
    addListener:(name,fn)=>{el.addEventListener(name,fn);return{remove:()=>el.removeEventListener(name,fn)}}};
  adapter.setLabel(label);if(map)overlay.setMap(map.raw);return adapter;
}

export function projectPoint(p){
  const sin=Math.sin(Math.max(-85,Math.min(85,p.lat))*Math.PI/180);
  return {x:256*(.5+p.lng/360),y:256*(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))};
}
