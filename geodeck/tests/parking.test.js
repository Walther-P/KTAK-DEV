import test from 'node:test';
import assert from 'node:assert/strict';
import {loadNearbyParking} from '../parking-provider.js';
const center={lat:25.0552,lng:121.5242},now=Date.parse('2026-09-21T00:08:00Z');
const row=(id,extra={})=>({id,name:id,totalcar:17,payex:'100元/時',serviceTime:'00:00:00-23:59:59',EntranceCoord:{EntrancecoordInfo:[{Xcod:'25.0552',Ycod:'121.5242'}]},...extra});
function fixture(rows,dynamic,time='Mon Sep 21 08:07:00 CST 2026'){
  const calls=[];
  const fetcher=async url=>{calls.push(url);if(url.includes('allavailable')&&dynamic instanceof Error)throw dynamic;return{ok:true,json:async()=>({data:{UPDATETIME:time,park:url.includes('alldesc')?rows:dynamic}})}};
  return{fetcher,calls};
}
test('joins exact IDs, preserves zero and never turns unknown values into free spaces',async()=>{
  const rows=['zero','negative','null','missing','empty'].map(id=>row(id));
  const {fetcher}=fixture(rows,[{id:'null',availablecar:null},{id:'negative',availablecar:-9},{id:'zero',availablecar:0},{id:'empty',availablecar:''}]);
  const result=await loadNearbyParking(center,{fetcher,now});
  assert.deepEqual(result.lots.map(l=>l.available),[0,null,null,null,null]);
  assert.equal(result.lots[0].freshness,'live');assert.equal(result.lots[1].freshness,'unknown');
  assert.equal(result.lastUpdated,'2026-09-21T00:07:00.000Z');
});
test('uses WGS84 entrance coordinates and skips TWD97-only or invalid coordinates',async()=>{
  const {fetcher}=fixture([row('ok'),row('tw97',{EntranceCoord:null,tw97x:302864,tw97y:2771988}),row('bad',{EntranceCoord:{EntrancecoordInfo:[{Xcod:302864,Ycod:2771988}]}})],[]);
  const result=await loadNearbyParking(center,{fetcher,now});assert.deepEqual(result.lots.map(l=>l.id),['ok']);assert.equal(result.lots[0].distance,0);
});
test('excludes zero car capacity while retaining full lots and unknown capacity',async()=>{
  const {fetcher}=fixture([row('motorcycle',{totalcar:'0'}),row('full'),row('unknown',{totalcar:null})],[{id:'full',availablecar:0}]);
  const result=await loadNearbyParking(center,{fetcher,now});
  assert.deepEqual(result.lots.map(l=>l.id),['full','unknown']);
  assert.equal(result.lots[0].available,0);assert.equal(result.lots[1].total,null);
});
test('official stale and future timestamps never become live from a fresh fetch',async()=>{
  for(const [time,expected] of [['Mon Sep 21 08:00:00 CST 2026','stale'],['Mon Sep 21 08:09:00 CST 2026','unknown'],['invalid','unknown']]){
    const {fetcher}=fixture([row('a')],[{id:'a',availablecar:1}],time);
    const result=await loadNearbyParking(center,{fetcher,now});assert.equal(result.freshness,expected);assert.equal(result.lots[0].freshness,expected);
  }
});
test('cache preserves official timestamp, recalculates freshness, and uses separate TTLs',async()=>{
  const {fetcher,calls}=fixture([row('a')],[{id:'a',availablecar:2}],'Mon Sep 21 08:03:10 CST 2026');
  const first=await loadNearbyParking(center,{fetcher,now});
  const second=await loadNearbyParking(center,{fetcher,now:now+20000});
  assert.equal(calls.length,2);assert.equal(first.freshness,'live');assert.equal(second.freshness,'stale');assert.equal(second.fetchedAt,first.fetchedAt);
  await loadNearbyParking(center,{fetcher,now:now+60000});assert.equal(calls.length,3);assert.match(calls[2],/allavailable/);
  await loadNearbyParking(center,{fetcher,now:now+1800000});assert.equal(calls.length,5);
});
test('dynamic failure retains static lots with unknown availability and identifies failed source',async()=>{
  const {fetcher}=fixture([row('a')],Error('offline'));
  const result=await loadNearbyParking(center,{fetcher,now});assert.equal(result.coverage,'available');assert.equal(result.lots[0].available,null);assert.equal(result.lots[0].freshness,'unknown');assert.match(result.failedSource,/allavailable/);
});
test('reports no coverage outside Taipei without fetching, and limits nearby lots by distance',async()=>{
  const {fetcher,calls}=fixture(Array.from({length:25},(_,i)=>row(String(i),{EntranceCoord:{EntrancecoordInfo:[{Xcod:25.0552+i*.0001,Ycod:121.5242}]}})).reverse().concat(row('far',{EntranceCoord:{EntrancecoordInfo:[{Xcod:25.2,Ycod:121.5242}]}})),[]);
  const outside=await loadNearbyParking({lat:22.6,lng:120.3},{fetcher,now});assert.equal(outside.coverage,'none');assert.equal(calls.length,0);
  const nearby=await loadNearbyParking(center,{fetcher,now});assert.equal(nearby.lots.length,20);assert.equal(nearby.lots[0].id,'0');assert.ok(nearby.lots.every(l=>l.distance<=3000));
});
test('static failure and malformed payload are explicit failures, not an all-clear',async()=>{
  await assert.rejects(()=>loadNearbyParking(center,{fetcher:async()=>({ok:true,json:async()=>({})}),now}),/無法載入/);
});
