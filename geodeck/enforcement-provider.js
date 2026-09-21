import {finite,validPoint} from './core.js?v=0.4.0';
import {freshness} from './drive-core.js?v=0.4.0';

const sources=[
  {file:'enforcement-tw.json',label:'警政署測速'},
  {file:'enforcement-sections-ntpc.json',label:'新北區間測速'}
];
export async function loadEnforcement(fetcher=fetch){
  const results=await Promise.allSettled(sources.map(async source=>{
    const response=await fetcher('./data/'+source.file,{cache:'no-cache',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(source.label+' 載入失敗');
    const data=await response.json();
    if(!Array.isArray(data.points)||!data.provider||!data.source)throw Error(source.label+' 格式無法使用');
    const points=data.points.filter(p=>p.id&&validPoint(p)).map(p=>({...p,provider:data.provider,source:data.source,fetchedAt:data.fetchedAt,lastUpdated:p.lastUpdated??data.lastUpdated??null,speedLimit:finite(p.speedLimit)&&p.speedLimit>0&&p.speedLimit<=130?p.speedLimit:null}));
    if(!points.length)throw Error(source.label+' 沒有可用點位');
    return{...data,points,count:points.length};
  }));
  const loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value),errors=results.flatMap((r,i)=>r.status==='rejected'?[sources[i].label+' 未載入']:[]);
  if(!loaded.length)throw Error('執法資料皆無法載入');
  return{points:loaded.flatMap(s=>s.points),sources:loaded.map(({points,...meta})=>meta),errors};
}
export function enforcementSummary(catalog,next=null){
  const text=next?`${next.provider} · ${freshness(next)}`:catalog.sources.map(s=>`${s.provider} ${s.count}點 · ${freshness(s)}`).join('；');
  return text+(catalog.errors.length?'；'+catalog.errors.join('、'):'');
}
