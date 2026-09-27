import {validPoint,haversine} from './core.js?v=0.7.1';

export const parkingCount=value=>value===null||value===undefined||typeof value==='boolean'||String(value).trim()===''?null:Number.isInteger(Number(value))&&Number(value)>=0?Number(value):null;
export function inBounds(p,b){return validPoint(p)&&p.lat>=b.south&&p.lat<=b.north&&(b.west<=b.east?p.lng>=b.west&&p.lng<=b.east:p.lng>=b.west||p.lng<=b.east)}
export function boundsOverlap(a,b){
  const segments=p=>p.west<=p.east?[[p.west,p.east]]:[[p.west,180],[-180,p.east]];
  return a.south<=b.north&&a.north>=b.south&&segments(a).some(x=>segments(b).some(y=>x[0]<=y[1]&&x[1]>=y[0]));
}
export function parkingStatus(lot,now=Date.now()){
  const count=parkingCount(lot.available),updated=Date.parse(lot.lastUpdated),fetched=Date.parse(lot.fetchedAt);
  if(count===null)return {label:'?',kind:'unknown',text:'來源未提供剩餘車位'};
  if(Number.isFinite(updated)){
    const age=now-updated;
    if(age<0)return {label:'?',kind:'unknown',text:'來源時間異常，車位數暫不採用'};
    if(age>300000)return {label:'?',kind:'stale',text:'車位資料超過 5 分鐘，剩餘數暫不採用'};
    return {label:String(count),kind:count===0?'full':'live',text:'即時剩餘 '+count+' 格'};
  }
  if(Number.isFinite(fetched)&&now>=fetched&&now-fetched<=300000)return {label:'~'+count,kind:'reported',text:'來源回報 '+count+' 格；未提供資料更新時間'};
  return {label:'?',kind:'unknown',text:'沒有有效的即時車位資料'};
}
export function osmParking(data){
  if(!Array.isArray(data?.elements))throw Error('OSM 停車目錄格式無效');
  return data.elements.flatMap(item=>{
    const tags=item.tags||{},lat=item.lat??item.center?.lat,lng=item.lon??item.center?.lon;
    if(!validPoint({lat,lng})||['private','no'].includes(tags.access)||tags.disused==='yes'||tags.abandoned==='yes'||tags.motorcar==='no')return [];
    const curb=['street_side','lane'].includes(tags.parking)||!!tags.highway,kind=curb?'curb':tags.amenity==='parking_space'?'space':'lot';
    return [{id:`osm-${item.type}-${item.id}`,lat,lng,name:tags['name:zh']||tags.name||(kind==='curb'?'路邊停車':kind==='space'?'停車格':'停車場'),kind,
      total:parkingCount(tags.capacity),available:null,rate:tags.charge||(tags.fee==='no'?'資料標示免費，依現場公告':tags.fee==='yes'?'收費，未提供費率':null),
      hours:tags.opening_hours||null,address:[tags['addr:city'],tags['addr:district'],tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join(''),
      access:tags.access==='customers'?'限顧客使用':tags.access==='permit'?'需許可':null,source:'osm',url:`https://www.openstreetmap.org/${item.type}/${item.id}`}];
  });
}
export function mergeParking(catalog,official){
  const byId=new Map(catalog.map(p=>[p.id,p]));
  for(const lot of official)byId.set(lot.id,{...byId.get(lot.id),...lot});
  const sources=[...byId.values()].filter(p=>p.source!=='osm');
  const grid=new Map();
  for(const p of sources){const key=Math.floor(p.lat*1000)+':'+Math.floor(p.lng*1000);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p)}
  return [...byId.values()].filter(p=>{
    if(p.source!=='osm')return true;
    const x=Math.floor(p.lat*1000),y=Math.floor(p.lng*1000);
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const q of grid.get((x+a)+':'+(y+b))||[]){
      const distance=haversine(p,q);
      if(p.kind===q.kind&&(distance<12||(distance<100&&p.name&&p.name===q.name)))return false;
    }
    return true;
  });
}
export function clusterParking(lots,zoom){
  const groups=new Map(),scale=2**zoom,cell=zoom>=18?32:60;
  for(const p of lots){const sin=Math.sin(p.lat*Math.PI/180),x=256*(.5+p.lng/360)*scale,y=256*(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale;
    const key=Math.floor(x/cell)+':'+Math.floor(y/cell);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p)}
  return [...groups.values()].map(items=>({items,lat:items.reduce((s,p)=>s+p.lat,0)/items.length,lng:items.reduce((s,p)=>s+p.lng,0)/items.length}));
}
