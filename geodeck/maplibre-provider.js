const MAP_STYLE='https://tiles.openfreemap.org/styles/dark';

// The application depends on this small adapter, not on a map vendor's global API.
export async function createMap(container, {center, zoom=13}={}) {
  if (!globalThis.maplibregl) throw Error('地圖元件未載入');
  const raw = new maplibregl.Map({container, style:MAP_STYLE,
    center:[center.lng,center.lat], zoom, attributionControl:false, maxZoom:19});
  raw.addControl(new maplibregl.AttributionControl({compact:false}), 'bottom-left');
  raw.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
  raw.dragRotate.disable(); raw.touchZoomRotate.disableRotation();
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('底圖連線逾時，請確認網路後重試')),20000);
    raw.once('load',()=>{clearTimeout(timer);resolve()});
    raw.once('error',e=>{if(!raw.isStyleLoaded()){clearTimeout(timer);reject(e.error)}});
  });
  // Keep a dark background while giving road names enough contrast on a phone.
  for(const layer of raw.getStyle().layers){
    if(layer.type==='symbol'&&layer.layout?.['text-field']){
      raw.setPaintProperty(layer.id,'text-color','#c0cbd7');
      raw.setPaintProperty(layer.id,'text-halo-color','#121b25');
    }
    if(layer.type==='background')raw.setPaintProperty(layer.id,'background-color','#141b23');
  }
  const rasterErrors=new Map();
  return {raw,
    getCenter(){const p=raw.getCenter();return {lat:()=>p.lat,lng:()=>p.lng}},
    getZoom:()=>raw.getZoom(), setZoom:z=>raw.setZoom(z),
    panTo:p=>raw.panTo([p.lng,p.lat]),
    getBounds(){const b=raw.getBounds();return {contains:p=>b.contains([p.lng,p.lat]),
      getNorthEast:()=>({lat:()=>b.getNorth(),lng:()=>b.getEast()}),
      getSouthWest:()=>({lat:()=>b.getSouth(),lng:()=>b.getWest()})}},
    addListener(name,fn){const event=name==='idle'?'moveend':name;
      const listener=name==='click'?e=>fn({latLng:{lat:()=>e.lngLat.lat,lng:()=>e.lngLat.lng}}):fn;
      raw.on(event,listener);return {remove:()=>raw.off(event,listener)}},
    addRaster(id,tiles,{opacity=.7,maxzoom=7,onError}={}){
      this.removeRaster(id);
      raw.addSource(id,{type:'raster',tiles:[tiles],tileSize:256,minzoom:0,maxzoom});
      raw.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':opacity}},
        raw.getStyle().layers.find(l=>l.type==='symbol')?.id);
      if(onError){const handler=e=>{if(e.sourceId===id)onError()};rasterErrors.set(id,handler);raw.on('error',handler)}
    },
    removeRaster(id){const handler=rasterErrors.get(id);if(handler){raw.off('error',handler);rasterErrors.delete(id)}if(raw.getLayer(id))raw.removeLayer(id);if(raw.getSource(id))raw.removeSource(id)}
  };
}

export function createMarker({map,position,title='',label,icon={},zIndex=1}) {
  const el=document.createElement('button');el.type='button';el.className='map-pin';
  el.title=title;el.setAttribute('aria-label',title||'地圖位置');
  el.style.setProperty('--pin-color',icon.fillColor||'#334c60');
  el.style.setProperty('--pin-border',icon.strokeColor||'#a9bfd3');
  el.style.zIndex=String(zIndex);
  if(icon.scale)el.style.setProperty('--pin-size',Math.max(18,icon.scale*2)+'px');
  const text=document.createElement('span');el.append(text);
  const marker=new maplibregl.Marker({element:el}).setLngLat([position.lng,position.lat]);
  if(map)marker.addTo(map.raw);
  el.addEventListener('click',e=>e.stopPropagation());
  const adapter={setMap:m=>m?marker.addTo(m.raw):marker.remove(),
    setPosition:p=>marker.setLngLat([p.lng,p.lat]),
    setLabel:l=>{text.textContent=typeof l==='string'?l:l?.text||'';text.style.color=l?.color||'#f1f5fa'},
    addListener:(name,fn)=>el.addEventListener(name,fn)};
  adapter.setLabel(label);return adapter;
}

export function projectPoint(p){
  const sin=Math.sin(Math.max(-85,Math.min(85,p.lat))*Math.PI/180);
  return {x:256*(.5+p.lng/360),y:256*(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))};
}
