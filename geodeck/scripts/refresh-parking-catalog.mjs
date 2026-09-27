// Run manually from the repository root. One national OSM extract, never per app user.
import fs from 'node:fs/promises';
import {FEEDS} from '../parking-sources.js';
import {TAINAN_URL,tainanLots} from '../taiwan-parking.js';
import {loadNearbyParking} from '../parking-provider.js';
const dir='geodeck/qa';await fs.mkdir(dir,{recursive:true});
const save=async(name,data)=>fs.writeFile(dir+'/'+name+'.json',JSON.stringify(data));
async function read(url,options={}){
  const r=await fetch(url,{signal:AbortSignal.timeout(180000),...options});
  if(!r.ok)throw Error('Public source HTTP '+r.status+' at '+new URL(url).hostname);
  return r.json();
}
async function paged(source,size){
  const rows=[];
  for(let page=0;page<100;page++){
    const part=await read(FEEDS[source]+`?page=${page}&size=${size}`);
    if(!Array.isArray(part))throw Error(source+' invalid dataset');rows.push(...part);
    if(part.length<size)return rows;
  }
  throw Error(source+' pagination limit; no catalog written');
}
const query='[out:json][timeout:150];area["ISO3166-1"="TW"]["admin_level"="2"]->.tw;(nwr["amenity"="parking"](area.tw);nwr["amenity"="parking_space"](area.tw);way["highway"]["parking:both"~"^(lane|street_side)$"](area.tw);way["highway"]["parking:left"~"^(lane|street_side)$"](area.tw);way["highway"]["parking:right"~"^(lane|street_side)$"](area.tw););out center tags;';
const osm=await read('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query})});
if(!Array.isArray(osm.elements)||!osm.osm3s?.timestamp_osm_base)throw Error('Invalid OSM extract');
await save('parking-osm-raw',osm);
await save('ntpc-all',await paged('ntpc',1000));
await save('ntpc-curb-all',await paged('ntpc-curb',10000));
for(const source of ['taoyuan','taichung'])await save(source,await read(FEEDS[source]));
const bounds={south:21.8,north:26.5,west:118,east:122.1};
const tainan=tainanLots(await read(TAINAN_URL),{lat:22.99,lng:120.2},{bounds,limit:Infinity,snapshot:true});
await save('tainan-catalog',tainan.map(p=>({...p,source:'tainan',kind:/^tainan-D/.test(p.id)||/路邊/.test(p.name)?'curb':'lot'})));
const taipei=await loadNearbyParking({lat:25.04,lng:121.54},{bounds,limit:Infinity});
await save('taipei-catalog',taipei.lots.map(p=>({...p,id:'taipei-'+p.id,source:'taipei',kind:'lot'})));
await import('./build-parking-catalog.mjs');
