import {validPoint,parseCoordinates,haversine} from './core.js?v=0.7.2';
import {SEARCH_ENDPOINT} from './map-config.js?v=0.7.2';

export function photonPlaces(data){
  if(!Array.isArray(data?.features))throw Error('搜尋服務回傳格式有誤，請稍後重試');
  return data.features.flatMap(f=>{
    const [lng,lat]=f.geometry?.coordinates||[],p=f.properties||{},point={lat,lng};
    if(!validPoint(point))return [];
    return [{...point,title:p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||'地圖位置',
      country:String(p.countrycode||'').toUpperCase(),
      address:[p.country,p.city||p.county,p.district,p.street,p.housenumber].filter(Boolean).join(' '),
      source:'OpenStreetMap / Photon'}];
  });
}

// User-submitted searches only; bounded cache and serialized requests reduce public-service load.
export function createPlaceSearch({fetcher=fetch,endpoint=SEARCH_ENDPOINT,interval=1100}={}){
  const cache=new Map();let queue=Promise.resolve(),last=0;
  function request(path,params){
    const url=endpoint+path+'?'+new URLSearchParams(params);
    if(cache.has(url))return Promise.resolve(cache.get(url));
    const task=queue.catch(()=>{}).then(async()=>{
      if(cache.has(url))return cache.get(url);
      const wait=interval-(Date.now()-last);if(wait>0)await new Promise(r=>setTimeout(r,wait));
      last=Date.now();
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        const r=await fetcher(url,{signal:controller.signal});
        if(!r.ok)throw Error(r.status===429?'免費搜尋服務忙碌，請稍後再試':'搜尋服務暫時無法使用，這不代表沒有結果');
        const places=photonPlaces(await r.json());cache.set(url,places);
        if(cache.size>80)cache.delete(cache.keys().next().value);return places;
      }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('搜尋連線逾時或失敗，請稍後重試');throw e}
      finally{clearTimeout(timer)}
    });queue=task;return task;
  }
  return {
    search(text,{known=[],center}={}){
      const q=text.trim(),p=parseCoordinates(q);if(p)return Promise.resolve([{...p,title:q}]);
      const matches=known.filter(p=>validPoint(p)&&p.title===q);if(matches.length===1)return Promise.resolve(matches);
      if(!q)return Promise.resolve([]);
      return request('/api/',{q,limit:6,...(validPoint(center)?{lat:center.lat,lon:center.lng}: {})});
    },
    async country(p){if(!validPoint(p))return '';const rows=await request('/reverse',{lat:p.lat,lon:p.lng,limit:1,radius:1});return rows[0]?.country||''},
    async nearby(type,center){
      if(!validPoint(center))throw Error('搜尋位置無效');
      const tags={hospital:'hospital',pharmacy:'pharmacy',police:'police',fire_station:'fire_station',gas_station:'fuel',parking:'parking',toilet:'toilets',charging:'charging_station',embassy:'embassy'};
      if(!tags[type])throw Error('不支援的設施分類');
      const rows=await request('/reverse',{lat:center.lat,lon:center.lng,radius:6,limit:20,osm_tag:'amenity:'+tags[type]});
      return rows.map(p=>({...p,distance:haversine(center,p)})).filter(p=>p.distance<=6000).sort((a,b)=>a.distance-b.distance);
    }
  };
}
