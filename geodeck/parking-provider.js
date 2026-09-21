import {haversine,validPoint} from './core.js?v=0.4.0';

// Taipei Parking Management and Development Office; Government Open Data License v1.
export const PARKING_SOURCE='https://data.gov.tw/dataset/128435';
const INFO='https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json';
const AVAILABLE='https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json';
const caches=new WeakMap();
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// The official feed's CST means Asia/Taipei, never the host's timezone or US CST.
function officialTime(value){
  if(typeof value!=='string')return null;
  const m=value.match(/^\w{3} (\w{3}) (\d{1,2}) (\d{2}):(\d{2}):(\d{2}) CST (\d{4})$/);
  if(!m||!months.includes(m[1]))return null;
  const year=Number(m[6]),month=months.indexOf(m[1]),day=Number(m[2]),hour=Number(m[3]),minute=Number(m[4]),second=Number(m[5]);
  const local=new Date(Date.UTC(year,month,day,hour,minute,second));
  if(local.getUTCFullYear()!==year||local.getUTCMonth()!==month||local.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
  return new Date(local.getTime()-8*3600000).toISOString();
}
function status(time,now){const age=time?now-Date.parse(time):NaN;return !Number.isFinite(age)||age<0?'unknown':age>300000?'stale':'live'}
function count(value){if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;const n=Number(value);return Number.isInteger(n)&&n>=0?n:null}
function coordinate(row){
  const entrances=row.EntranceCoord?.EntrancecoordInfo;
  if(!Array.isArray(entrances))return null;
  for(const entry of entrances){
    if(entry.Xcod==null||entry.Ycod==null||String(entry.Xcod).trim()===''||String(entry.Ycod).trim()==='')continue;
    const point={lat:Number(entry.Xcod),lng:Number(entry.Ycod)};
    // Verified official Xcod=latitude / Ycod=longitude. Do not reinterpret TWD97.
    if(validPoint(point)&&point.lat>=24.9&&point.lat<=25.3&&point.lng>=121.4&&point.lng<=121.7)return point;
  }
  return null;
}
async function read(url,ttl,fetcher,now,cache){
  const old=cache.get(url);
  if(old&&now>=old.fetchedAt&&now-old.fetchedAt<ttl)return old;
  const response=await fetcher(url,{cache:'no-cache',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('停車資料暫時無法載入');
  const payload=await response.json();
  if(!Array.isArray(payload?.data?.park))throw Error('停車資料格式無效');
  const result={rows:payload.data.park,lastUpdated:officialTime(payload.data.UPDATETIME),fetchedAt:now};
  cache.set(url,result);return result;
}

export async function loadNearbyParking(center,{fetcher=fetch,now=Date.now()}={}){
  if(!validPoint(center))throw Error('停車搜尋位置無效');
  const base={provider:'臺北市停車管理工程處',source:PARKING_SOURCE,lastUpdated:null,fetchedAt:null,freshness:'unknown',coverage:'none',lots:[]};
  // The Taipei feed cannot establish parking availability elsewhere in Taiwan.
  if(center.lat<24.87||center.lat>25.33||center.lng<121.37||center.lng>121.73)return base;
  let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache)}
  const [infoResult,dynamicResult]=await Promise.allSettled([read(INFO,1800000,fetcher,now,cache),read(AVAILABLE,60000,fetcher,now,cache)]);
  if(infoResult.status==='rejected')throw Error('臺北市停車場資訊暫時無法載入');
  const info=infoResult.value,dynamic=dynamicResult.status==='fulfilled'?dynamicResult.value:null;
  const byId=new Map((dynamic?.rows||[]).map(row=>[String(row.id),row]));
  const seen=new Set();
  const lots=info.rows.flatMap(row=>{
    const point=coordinate(row),id=String(row.id??'').trim();
    if(!point||!id||seen.has(id))return[];seen.add(id);
    const distance=haversine(center,point);if(distance>3000)return[];
    const available=count(byId.get(id)?.availablecar),lastUpdated=dynamic?.lastUpdated??null;
    return[{id,...point,name:String(row.name||'停車場'),distance,available,total:count(row.totalcar),rate:String(row.payex||'費率依現場公告'),hours:row.serviceTime?String(row.serviceTime):null,lastUpdated,freshness:available===null?'unknown':status(lastUpdated,now)}];
  }).sort((a,b)=>a.distance-b.distance).slice(0,20);
  return{...base,lastUpdated:dynamic?.lastUpdated??null,fetchedAt:new Date(dynamic?.fetchedAt??info.fetchedAt).toISOString(),freshness:dynamic?status(dynamic.lastUpdated,now):'unknown',coverage:lots.length?'available':'none',lots,...(!dynamic?{failedSource:AVAILABLE}:{})};
}
