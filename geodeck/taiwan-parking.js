import {inBounds} from './parking-core.js?v=0.7.0';
import {loadNearbyParking} from './parking-provider.js?v=0.7.0';
import {validPoint,haversine,parseCoordinates} from './core.js?v=0.7.0';
export const TAINAN_URL='https://soa.tainan.gov.tw/Api/Service/Get/91073f40-d251-42cc-9f4c-88e8937c9911';
export const TAINAN_SOURCE='https://data.tainan.gov.tw/Resource/91073f40-d251-42cc-9f4c-88e8937c9911';
const count=v=>v===null||v===undefined||typeof v==='boolean'||String(v).trim()===''?null:Number.isInteger(Number(v))&&Number(v)>=0?Number(v):null;
export function tainanTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))return null;
  const t=Date.parse(value.replace(' ','T')+'+08:00');
  if(!Number.isFinite(t)||new Date(t+28800000).toISOString().slice(0,19)!==value.replace(' ','T'))return null;
  return new Date(t).toISOString();
}
export function tainanLots(payload,center,{now=Date.now(),snapshot=false,bounds=null,limit=30}={}){
  if(!Array.isArray(payload?.data)||payload.success===false)throw Error('台南停車資料格式無效');
  const seen=new Set();
  return payload.data.flatMap(row=>{
    const p=parseCoordinates(String(row.lnglat||'')),id=String(row.code||row.id||'');
    if(!p||p.lat<22.85||p.lat>23.5||p.lng<120||p.lng>120.7||!id||seen.has(id)||count(row.car_total)===0)return [];
    seen.add(id);const distance=haversine(center,p);if(bounds?!inBounds(p,bounds):distance>3000)return [];
    const lastUpdated=tainanTime(row.update_time),age=lastUpdated?now-Date.parse(lastUpdated):NaN;
    // Bundled data is a location/fee fallback, never a source of live empty spaces.
    const available=snapshot?null:count(row.car);
    return [{id:'tainan-'+id,...p,country:'TW',name:String(row.name||'停車場'),address:String(row.address||''),
      total:count(row.car_total),available,distance,lastUpdated,
      freshness:available===null||!Number.isFinite(age)||age<0?'unknown':age>300000?'stale':'live',
      rate:String(row.chargeFee||'未提供，依現場公告'),hours:row.chargeTime?String(row.chargeTime):null}];
  }).sort((a,b)=>a.distance-b.distance).slice(0,limit);
}
const caches=new WeakMap();
async function loadTainan(center,{fetcher=fetch,now=Date.now(),bounds=null,limit=30}={}){
  let entry=caches.get(fetcher);
  if(!entry||now-entry.at>60000||now<entry.at){
    let payload,snapshot=false;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
    try{const r=await fetcher(TAINAN_URL,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error();payload=await r.json();if(!Array.isArray(payload?.data)||payload.success===false)throw Error()}
    catch{const r=await fetcher('./data/parking-tainan.json');if(!r.ok)throw Error('台南停車資料暫時無法取得');payload=await r.json();snapshot=true}
    finally{clearTimeout(timer)}
    entry={payload,snapshot,at:now};caches.set(fetcher,entry);
  }
  const lots=tainanLots(entry.payload,center,{now,snapshot:entry.snapshot,bounds,limit});
  return {provider:'臺南市政府交通局',source:TAINAN_SOURCE,lots,coverage:lots.length?'available':'none',
    snapshotAt:entry.snapshot?entry.payload.fetchedAt:null,
    ...(entry.snapshot?{failedSource:TAINAN_URL}: {})};
}
// Provider registry: extend coverage here without adding city-specific UI branches.
const providers=[
  {covers:p=>p.lat>=22.85&&p.lat<=23.5&&p.lng>=120&&p.lng<=120.7,load:loadTainan},
  {covers:p=>p.lat>=24.87&&p.lat<=25.33&&p.lng>=121.37&&p.lng<=121.73,load:loadNearbyParking}
];
export async function loadTaiwanParking(center,options={}){
  if(!validPoint(center))throw Error('停車搜尋位置無效');
  const provider=providers.find(p=>p.covers(center));
  if(provider)return provider.load(center,options);
  return {provider:'GeoDeck 資料涵蓋說明',source:TAINAN_SOURCE,lots:[],coverage:'none'};
}
