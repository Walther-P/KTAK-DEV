// Use downloaded official datasets and a single OSM Taiwan extract. No availability is bundled.
import fs from 'node:fs/promises';
import {osmParking,mergeParking} from '../parking-core.js';
import {normalizeOfficial,SOURCES} from '../parking-sources.js';
const read=async name=>JSON.parse(await fs.readFile('geodeck/qa/'+name+'.json','utf8'));
const osm=await read('parking-osm-raw');
let lots=osmParking(osm);
const inputs=[['ntpc','ntpc-all'],['ntpc-curb','ntpc-curb-all'],['taoyuan','taoyuan'],['taichung','taichung']];
for(const [source,file]of inputs)lots.push(...normalizeOfficial(source,await read(file),{snapshot:true}));
const tainan=await read('tainan-catalog').catch(()=>null);
if(tainan)lots.push(...tainan);
const taipei=await read('taipei-catalog').catch(()=>null);
if(taipei)lots.push(...taipei);
lots=mergeParking(lots,[]);
const dir='geodeck/data/parking';await fs.mkdir(dir,{recursive:true});
const tiles=new Map();
for(const p of lots){const key=Math.floor(p.lat*4)+'_'+Math.floor(p.lng*4);if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(p)}
const index={fetchedAt:new Date().toISOString(),osmTimestamp:osm.osm3s.timestamp_osm_base,sources:SOURCES,total:lots.length,tiles:[],sourceCounts:{},kindCounts:{}};
for(const p of lots){index.sourceCounts[p.source]=(index.sourceCounts[p.source]||0)+1;index.kindCounts[p.kind]=(index.kindCounts[p.kind]||0)+1}
for(const [id,points]of tiles){const [y,x]=id.split('_').map(Number);const file=id+'.json';
  await fs.writeFile(dir+'/'+file,JSON.stringify(points.map(p=>{const {available,lastUpdated,fetchedAt,...rest}=p;return rest})));
  index.tiles.push({id,file,count:points.length,south:y/4,north:(y+1)/4,west:x/4,east:(x+1)/4,lat:points.reduce((s,p)=>s+p.lat,0)/points.length,lng:points.reduce((s,p)=>s+p.lng,0)/points.length});
}
await fs.writeFile(dir+'/index.json',JSON.stringify(index));
console.log(JSON.stringify({total:index.total,tiles:index.tiles.length,sources:index.sourceCounts,kinds:index.kindCounts}));
