import {normalizeCameras,haversine,validPoint} from './core.js?v=0.7.2';

export function matchedParkingCameras(point,cameras,links,{now=Date.now()}={}){
  if(!validPoint(point))return [];
  const seen=new Set(),byId=new Map(cameras.map(c=>[c.id,c]));
  return links.flatMap(link=>{
    const camera=byId.get(link.cameraId),age=now-Date.parse(link.verifiedAt);
    if(!link.parkingIds?.includes(point.id)||!['entrance','interior'].includes(link.coverage)||!link.evidenceUrl||!Number.isFinite(age)||age<0||age>90*86400000)return [];
    if(!camera||!validPoint(camera)||camera.image!==link.image||!/^https:\/\//.test(camera.image)||seen.has(camera.id))return [];
    seen.add(camera.id);return [{...camera,source:link.evidenceUrl,distance:haversine(point,camera),coverage:link.coverage,coverageNote:link.note,verifiedAt:link.verifiedAt,evidenceUrl:link.evidenceUrl}];
  });
}
export function createCameraCatalog({fetcher=fetch}={}){
  let pending;
  async function read(){
    // The public upstream catalog blocks browser CORS. Serve the same-origin
    // catalog snapshot and preserve its date; camera images still load live.
    const r=await fetcher('./data/cameras-tw.json.gz',{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('影像目錄暫時無法載入');
    const bytes=new Uint8Array(await r.arrayBuffer()),stream=new Blob([bytes]).stream();
    const d=await new Response(bytes[0]===31&&bytes[1]===139?stream.pipeThrough(new DecompressionStream('gzip')):stream).json();
    return {cameras:normalizeCameras(d),catalogTime:d.updatedAt||''};
  }
  return {load:()=>pending??=read().catch(e=>{pending=null;throw e})};
}
// Parking details and the camera map layer share one catalog download per page.
export const cameraCatalog=createCameraCatalog();

export function createParkingCameraLookup({catalog=cameraCatalog,fetcher=fetch,now=Date.now}={}){
  let linksPromise;
  async function links(){
    const r=await fetcher('./data/parking-cameras.json?v=0.7.2',{signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error('停車場影像對應資料暫時無法載入');
    const data=await r.json();if(!Array.isArray(data.links))throw Error('停車場影像對應資料格式無效');return data.links;
  }
  return {async find(lot){
    const verified=await(linksPromise??=links().catch(e=>{linksPromise=null;throw e}));
    // Never infer coverage from distance, a similar name, or camera coordinates.
    if(!verified.some(link=>link.parkingIds?.includes(lot.id)))return {cameras:[],catalogTime:''};
    const data=await catalog.load();return {...data,cameras:matchedParkingCameras(lot,data.cameras,verified,{now:now()})};
  }};
}
export const parkingCameraLookup=createParkingCameraLookup();
