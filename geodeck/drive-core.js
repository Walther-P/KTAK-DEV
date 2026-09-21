import {finite,validPoint,haversine} from './core.js?v=0.4.0';

export const angleDifference=(a,b)=>Math.abs(((a-b+540)%360)-180);
export function bearing(a,b){const r=Math.PI/180,x=Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r),y=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r);return(Math.atan2(x,y)/r+360)%360}
export function directionHeadings(text){
  // Only explicit origin-to-destination travel descriptions; a lone camera bearing is ambiguous.
  const values={北:0,東北:45,東:90,東南:135,南:180,西南:225,西:270,西北:315};
  const matches=[...String(text||'').matchAll(/(東北|東南|西北|西南|北|東|南|西)(?:往|向|至)(東北|東南|西北|西南|北|東|南|西)/g)];
  return [...new Set(matches.filter(m=>angleDifference(values[m[1]],values[m[2]])===180).map(m=>values[m[2]]))];
}
export function gpsHeading(current,previous){
  const c=current.coords;if(finite(c.heading)&&c.heading>=0&&c.heading<360)return c.heading;
  if(!previous||c.accuracy>20||previous.coords.accuracy>20)return null;
  const dt=current.timestamp-previous.timestamp;if(dt<=0||dt>10000)return null;
  const a={lat:previous.coords.latitude,lng:previous.coords.longitude},b={lat:c.latitude,lng:c.longitude};
  return haversine(a,b)>Math.max(15,c.accuracy+previous.coords.accuracy)?bearing(a,b):null;
}
const point=p=>({lat:typeof p?.lat==='function'?p.lat():p?.lat,lng:typeof p?.lng==='function'?p.lng():p?.lng});
export function projectPath(position,path){
  if(!validPoint(position)||!Array.isArray(path)||path.length<2)return null;
  let best=null,total=0;const sx=111195*Math.cos(position.lat*Math.PI/180),sy=111195;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];if(!validPoint(a)||!validPoint(b))continue;
    const ax=(a.lng-position.lng)*sx,ay=(a.lat-position.lat)*sy,dx=(b.lng-a.lng)*sx,dy=(b.lat-a.lat)*sy,len=haversine(a,b);
    if(len<.1)continue;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy))),distance=Math.hypot(ax+t*dx,ay+t*dy);
    if(!best||distance<best.distance)best={distance,along:total+t*len,bearing:bearing(a,b),segment:i-1};total+=len;
  }
  return best?{...best,total}:null;
}
export function navigationModel(leg,stripHtml=s=>String(s||'')){
  let along=0;const path=[];
  const steps=(leg?.steps||[]).map(s=>{
    const pts=(s.path?.length?s.path:[s.start_location,s.end_location]).map(point).filter(validPoint);
    if(path.length&&pts.length&&haversine(path.at(-1),pts[0])>.1)along+=haversine(path.at(-1),pts[0]);
    const at=along;
    for(let i=0;i<pts.length;i++){if(i)along+=haversine(pts[i-1],pts[i]);if(!path.length||haversine(path.at(-1),pts[i])>.1)path.push(pts[i])}
    return{maneuver:s.maneuver||null,instruction:stripHtml(s.instructions),distanceToManeuver:null,roadName:null,exitNumber:null,junction:null,fork:null,lanes:[],laneGuidance:'unavailable',at,end:along,duration:finite(s.duration?.value)?s.duration.value:null};
  });
  return{provider:'GoogleMapsWebProvider',steps,path,total:along,duration:leg?.duration_in_traffic?.value??leg?.duration?.value??null};
}
export function routeProgress(model,position,heading=null){
  const projection=projectPath(position,model?.path);if(!projection||projection.distance>60)return{status:'off-route'};
  if(finite(heading)&&angleDifference(heading,projection.bearing)>100)return{status:'off-route'};
  const next=model.steps.find(s=>s.at>=projection.along&&s.at>0);
  const remaining=Math.max(0,model.total-projection.along),arrived=remaining<25;
  return{status:arrived?'arrived':'on-route',projection,remaining,duration:finite(model.duration)&&model.total>0?model.duration*remaining/model.total:null,
    next:next?{...next,distanceToManeuver:next.at-projection.along}:{maneuver:'arrive',instruction:'抵達目的地',distanceToManeuver:remaining,lanes:[],laneGuidance:'unavailable'}};
}
export function aheadEnforcement(points,{position,heading,speed,accuracy,distance=500,path=null}){
  if(!validPoint(position)||!finite(heading)||heading<0||heading>=360||!finite(speed)||speed<5||!finite(accuracy)||accuracy>30)return[];
  const user=path?projectPath(position,path):null;if(path&&(!user||user.distance>60||angleDifference(heading,user.bearing)>100))return[];
  return points.flatMap(c=>{
    const direct=haversine(position,c);if(direct>distance*1.3||direct<8||angleDifference(heading,bearing(position,c))>55)return[];
    const heads=directionHeadings(c.directionText);if(heads.length&&!heads.some(h=>angleDifference(h,heading)<=55))return[];
    let ahead=direct;
    if(path){const camera=projectPath(c,path);if(!camera||camera.distance>35)return[];ahead=camera.along-user.along;if(ahead<8||ahead>distance)return[]}
    else if(direct>distance)return[];
    return[{...c,distance:ahead,confidence:heads.length?'direction-match':'direction-unknown'}];
  }).sort((a,b)=>a.distance-b.distance);
}
export function freshness(data,now=Date.now()){
  const updated=Date.parse(data?.lastUpdated),fetched=Date.parse(data?.fetchedAt);
  if(!finite(fetched)||now-fetched>30*86400000)return'STALE · 快照超過 30 天或日期未知';
  return finite(updated)?`資料更新 ${new Date(updated).toISOString().slice(0,10)}`:`快照 ${new Date(fetched).toISOString().slice(0,10)} · 官方更新時間未知`;
}
export class AlertGate{
  constructor(){this.seen=new Map()}
  allow(id,now=Date.now()){if(this.seen.has(id)&&now-this.seen.get(id)<600000)return false;this.seen.set(id,now);return true}
}
