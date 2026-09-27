// Read-only, fixed-source public-data proxy. No database or user records are accessed.
const UPSTREAM={
  ntpc:'https://data.ntpc.gov.tw/api/datasets/e09b35a5-a738-48cc-b0f5-570b67ad9c78/json',
  taoyuan:'https://opendata.tycg.gov.tw/api/dataset/f4cc0b12-86ac-40f9-8745-885bddc18f79/resource/0381e141-f7ee-450e-99da-2240208d1773/download',
  taichung:'https://motoretag.taichung.gov.tw/DataAPI/api/ParkingAPIV2/Opendata'
};
export function createHandler({keys,fetcher=fetch,now=Date.now}){
  const cache=new Map(),pending=new Map(),origins=new Set(['https://walther-p.github.io','http://127.0.0.1:4173','http://localhost:4173']);
  async function load(source){
    const at=now(),old=cache.get(source),ttl=source==='taichung'?900000:60000;
    if(old&&at-old.at<ttl)return old.data;
    if(pending.has(source))return pending.get(source);
    const work=(async()=>{
      let rows=[];
      for(let page=0;page<(source==='ntpc'?5:1);page++){
        const url=UPSTREAM[source]+(source==='ntpc'?`?page=${page}&size=1000`:'');
        const r=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('upstream status '+r.status);
        const part=await r.json();if(!Array.isArray(part))throw Error('invalid upstream response');rows.push(...part);
        if(source!=='ntpc'||part.length<1000)break;
        if(page===4)throw Error('upstream pagination limit');
      }
      const seen=new Set();rows=rows.filter(p=>{const id=p.ID??p.parkId;if(seen.has(id))return false;seen.add(id);return true});
      const data={source,fetchedAt:new Date(now()).toISOString(),sourceUpdatedAt:null,rows};cache.set(source,{at:now(),data});return data;
    })();pending.set(source,work);
    try{return await work}finally{pending.delete(source)}
  }
  return async req=>{
    const origin=req.headers.get('origin'),headers={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Cache-Control':'no-store'};
    if(origin&&!origins.has(origin))return new Response('{"error":"origin not allowed"}',{status:403,headers});
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    // Validate this project's publishable API key. This is a public-data endpoint, not user authentication.
    if(!keys().includes(req.headers.get('apikey')||''))return json({error:'invalid API key'},401);
    if(req.method!=='GET')return json({error:'GET required'},405);
    const url=new URL(req.url),source=url.searchParams.get('source');
    if(!Object.hasOwn(UPSTREAM,source)||[...url.searchParams.keys()].some(k=>k!=='source'))return json({error:'unsupported source'},400);
    try{return json(await load(source))}catch{return json({error:'upstream unavailable',source},502)}
  };
}
