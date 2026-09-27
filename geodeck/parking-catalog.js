import {boundsOverlap,inBounds,mergeParking,parkingCount} from './parking-core.js?v=0.7.2';
import {loadNearbyParking} from './parking-provider.js?v=0.7.2';
import {loadTaiwanParking} from './taiwan-parking.js?v=0.7.2';
import {normalizeOfficial} from './parking-sources.js?v=0.7.2';

export function createParkingCatalog({fetcher=fetch,config=()=>globalThis.KTAK_CONFIG}={}){
  let indexPromise;const tiles=new Map(),live=new Map(),pending=new Map();
  const get=async url=>{const r=await fetcher(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('停車資料連線失敗');return r.json()};
  function index(){return indexPromise??=get('./data/parking/index.json').catch(e=>{indexPromise=null;throw e})}
  async function base(bounds,zoom){
    const meta=await index(),needed=meta.tiles.filter(t=>boundsOverlap(t,bounds));
    if(zoom<11)return {lots:[],summaries:needed.filter(p=>inBounds(p,bounds)),meta};
    const parts=await Promise.all(needed.map(t=>{
      if(!tiles.has(t.id))tiles.set(t.id,get('./data/parking/'+t.file).catch(e=>{tiles.delete(t.id);throw e}));
      return tiles.get(t.id);
    }));
    return {lots:parts.flat().filter(p=>inBounds(p,bounds)),summaries:[],meta};
  }
  function proxy(source){
    if(!pending.has(source))pending.set(source,readProxy(source).finally(()=>pending.delete(source)));
    return pending.get(source);
  }
  async function readProxy(source){
    const c=config();if(!c?.SUPABASE_URL||!c.SUPABASE_PUBLISHABLE_KEY)throw Error('公開資料轉接尚未設定');
    const r=await fetcher(c.SUPABASE_URL+'/functions/v1/geodeck-parking?source='+source,{headers:{apikey:c.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error('停車來源暫時無法讀取');return r.json();
  }
  async function refresh(bounds,catalog){
    const warnings=[],updates=[];
    const areas=[
      ['taipei',{south:24.94,north:25.23,west:121.45,east:121.67}],
      ['tainan',{south:22.85,north:23.5,west:120,east:120.7}],
      ['ntpc',{south:24.7,north:25.32,west:121.28,east:122}],
      ['taoyuan',{south:24.5,north:25.15,west:120.95,east:121.5}],
      ['taichung',{south:24,north:24.45,west:120.45,east:120.9}]
    ];
    await Promise.all(areas.filter(([,b])=>boundsOverlap(bounds,b)).map(async([source])=>{
      const now=Date.now();let entry=live.get(source);
      try{
        if(!entry||now-entry.at>60000||['taipei','tainan'].includes(source)){
          let rows;
          if(source==='taipei'){
            const data=await loadNearbyParking({lat:25.04,lng:121.54},{bounds,limit:Infinity});
            rows=data.lots.map(p=>({...p,id:'taipei-'+p.id,source,kind:'lot'}));
            if(data.failedSource)warnings.push('台北即時車位暫時無法取得');
          }else if(source==='tainan'){
            const data=await loadTaiwanParking({lat:22.99,lng:120.2},{bounds,limit:Infinity});
            rows=data.lots.map(p=>({...p,source,kind:/路邊|^tainan-D/.test(p.id)||/路邊/.test(p.name)?'curb':'lot'}));
            if(data.failedSource)warnings.push('台南即時車位暫時無法取得');
          }else{
            const data=await proxy(source);
            rows=source==='ntpc'?data.rows.map(r=>({id:'ntpc-'+r.ID,available:parkingCount(r.AVAILABLECAR),fetchedAt:data.fetchedAt,lastUpdated:null})):normalizeOfficial(source,data.rows,{fetchedAt:data.fetchedAt});
          }
          entry={at:now,rows,bounds};live.set(source,entry);
        }
        updates.push(...entry.rows);
      }catch{warnings.push(source==='ntpc'?'新北即時車位暫時無法取得':source==='taoyuan'?'桃園即時車位暫時無法取得':'部分官方即時資料暫時無法取得')}
    }));
    return {lots:mergeParking(catalog,updates).filter(p=>inBounds(p,bounds)),warnings};
  }
  return {base,refresh};
}
