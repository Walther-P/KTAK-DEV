import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inBounds,boundsOverlap,parkingStatus,osmParking,clusterParking,mergeParking} from '../parking-core.js';
import {createParkingCatalog} from '../parking-catalog.js';
import {normalizeOfficial,twd97} from '../parking-sources.js';
import {rainfallText} from '../weather-core.js';
import {createHandler} from '../backend/geodeck-parking/handler.js';
const now=Date.parse('2026-09-27T15:00:00Z');
test('parking freshness distinguishes zero, unknown, stale and source reports without update times',()=>{
  assert.equal(parkingStatus({available:0,lastUpdated:new Date(now).toISOString()},now).kind,'full');
  assert.equal(parkingStatus({available:10,lastUpdated:new Date(now-301000).toISOString()},now).label,'?');
  assert.equal(parkingStatus({available:10,lastUpdated:new Date(now+1).toISOString(),fetchedAt:new Date(now).toISOString()},now).label,'?');
  assert.equal(parkingStatus({available:7,fetchedAt:new Date(now).toISOString()},now).label,'~7');
  assert.equal(parkingStatus({available:7},now).label,'?');
  for(const value of [null,'',-9,false])assert.equal(parkingStatus({available:value,fetchedAt:new Date(now).toISOString()},now).label,'?');
});
test('viewport filtering includes edges and supports the date line',()=>{
  const b={north:25,south:24,west:120,east:122};assert.ok(inBounds({lat:25,lng:122},b));assert.equal(inBounds({lat:25.1,lng:121},b),false);
  assert.ok(inBounds({lat:24.5,lng:-179},{...b,west:179,east:-178}));
  assert.ok(boundsOverlap(b,{...b,west:119,east:-178}));
  assert.equal(boundsOverlap(b,{...b,west:179,east:-178}),false);
});
test('OSM private parking is excluded and capacity is never interpreted as vacancy',()=>{
  const d={elements:[{id:1,type:'node',lat:25,lon:121,tags:{amenity:'parking',capacity:'20',access:'private'}},{id:2,type:'node',lat:25,lon:121,tags:{amenity:'parking_space',capacity:'1'}},{id:3,type:'way',center:{lat:25,lon:121},tags:{amenity:'parking',parking:'street_side',capacity:'12'}}]};
  const rows=osmParking(d);assert.equal(rows.length,2);assert.equal(rows[0].kind,'space');assert.equal(rows[1].kind,'curb');assert.equal(rows[1].total,12);assert.equal(rows[1].available,null);
});
test('map clusters preserve every visible location, independent from available-space counts',()=>{
  const rows=Array.from({length:250},(_,i)=>({id:String(i),lat:25+i/100000,lng:121,available:null}));
  const groups=clusterParking(rows,14);assert.equal(groups.reduce((n,g)=>n+g.items.length,0),250);assert.ok(groups.length<rows.length);
});
test('official data joins by stable id, without replacing nearby distinct named parking lots',()=>{
  const base=[{id:'ntpc-1',lat:25,lng:121,name:'甲',kind:'lot',source:'ntpc'},{id:'osm-1',lat:25,lng:121,name:'甲',kind:'lot',source:'osm'},{id:'osm-2',lat:25.0005,lng:121,name:'乙',kind:'lot',source:'osm'}];
  const result=mergeParking(base,[{id:'ntpc-1',available:0}]);assert.equal(result.length,2);assert.equal(result[0].available,0);assert.ok(result.some(p=>p.name==='乙'));
});
test('TWD97 conversion yields a plausible independently published Taipei reference',()=>{
  const p=twd97(306962,2769658);assert.ok(Math.abs(p.lat-25.033)<.001);assert.ok(Math.abs(p.lng-121.5654)<.001);assert.equal(twd97(0,0),null);
});
test('official snapshots discard availability and undocumented curb status remains unknown',()=>{
  const r={parkId:'A',wgsX:'25',wgsY:'121',parkName:'甲',totalSpace:'20',surplusSpace:'0'};
  assert.equal(normalizeOfficial('taoyuan',[r],{snapshot:true})[0].available,null);
  assert.equal(normalizeOfficial('taoyuan',[r])[0].available,0);
  assert.equal(normalizeOfficial('ntpc-curb',[{id:'1',latitude:25,longitude:121,roadname:'道路',parkingstatus:'2'}])[0].available,null);
});
test('hourly rain preserves decimal millimeters and unknown values',()=>{
  assert.equal(rainfallText(0),'0.0 mm');assert.equal(rainfallText(.4),'0.4 mm');assert.equal(rainfallText(12.35),'12.3 mm');
  for(const x of [null,undefined,NaN,-1,'0'])assert.equal(rainfallText(x),'雨量未知');
});
test('public proxy rejects invalid credentials, origins, methods and arbitrary URLs before fetching',async()=>{
  const handler=createHandler({keys:()=>['public-key'],fetcher:()=>{throw Error('must not fetch')}});
  const req=(url,options={})=>new Request(url,{headers:{apikey:'public-key'},...options});
  assert.equal((await handler(req('https://example.com/?source=taoyuan',{headers:{}}))).status,401);
  assert.equal((await handler(req('https://example.com/?source=taoyuan',{headers:{apikey:'public-key',origin:'https://other.example'}}))).status,403);
  assert.equal((await handler(req('https://example.com/?source=https://private.invalid'))).status,400);
  assert.equal((await handler(req('https://example.com/?source=taoyuan&url=https://private.invalid'))).status,400);
  assert.equal((await handler(req('https://example.com/?source=taoyuan',{method:'POST'}))).status,405);
});
test('proxy coalesces concurrent upstream reads and does not invent a source timestamp',async()=>{
  let calls=0,time=now;const handler=createHandler({keys:()=>['k'],now:()=>time,fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return Response.json([{parkId:'1',surplusSpace:'5'}])}});
  const req=()=>new Request('https://example.com/?source=taoyuan',{headers:{apikey:'k',origin:'https://walther-p.github.io'}});
  const result=await Promise.all([handler(req()),handler(req())]);assert.equal(calls,1);
  const data=await result[0].json();assert.equal(data.sourceUpdatedAt,null);assert.equal(data.fetchedAt,new Date(now).toISOString());
  time+=10000;assert.equal((await(await handler(req())).json()).fetchedAt,data.fetchedAt);assert.equal(calls,1);
  time+=60000;await handler(req());assert.equal(calls,2);
});
test('catalog coalesces overlapping viewport requests and keeps blank NTPC counts unknown',async()=>{
  let calls=0;const catalog=createParkingCatalog({config:()=>({SUPABASE_URL:'https://public.example',SUPABASE_PUBLISHABLE_KEY:'k'}),fetcher:async()=>{
    calls++;await new Promise(r=>setTimeout(r,5));return Response.json({fetchedAt:new Date(now).toISOString(),rows:[{ID:'1',AVAILABLECAR:''}]});
  }});
  const b={south:25.2,north:25.3,west:121.8,east:121.9},points=[{id:'ntpc-1',lat:25.25,lng:121.85,name:'甲',source:'ntpc',kind:'lot'}];
  const results=await Promise.all([catalog.refresh(b,points),catalog.refresh(b,points)]);
  assert.equal(calls,1);assert.equal(results[0].lots[0].available,null);assert.equal(results[1].lots[0].available,null);
});
test('the bundled catalog contains valid locations, no live counts, and covers all 22 county seats',()=>{
  const root=new URL('../data/parking/',import.meta.url),index=JSON.parse(fs.readFileSync(new URL('index.json',root)));
  const all=index.tiles.flatMap(t=>JSON.parse(fs.readFileSync(new URL(t.file,root))));
  assert.equal(all.length,index.total);assert.ok(all.length>60000);assert.ok(all.some(p=>p.kind==='curb'));
  assert.ok(all.every(p=>!Object.hasOwn(p,'available')&&!Object.hasOwn(p,'fetchedAt')));
  const centers=[[25.03,121.56],[25.01,121.46],[24.99,121.3],[24.14,120.67],[22.99,120.2],[22.63,120.3],[25.13,121.74],[24.8,120.97],[24.84,121.01],[24.56,120.82],[24.08,120.54],[23.91,120.69],[23.71,120.54],[23.48,120.45],[23.46,120.25],[22.67,120.49],[24.76,121.75],[23.98,121.6],[22.76,121.14],[23.57,119.57],[24.43,118.32],[26.16,119.95]];
  for(const [lat,lng]of centers)assert.ok(all.some(p=>Math.abs(p.lat-lat)<.12&&Math.abs(p.lng-lng)<.12),`catalog missing ${lat},${lng}`);
});
