import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {navigationChoice,parkingHandoff,journeyForSelection} from '../journey.js';
import {createPlaceSearch,photonPlaces} from '../open-places.js';
import {tainanLots,tainanTime,loadTaiwanParking} from '../taiwan-parking.js';
const tainan={lat:22.9915,lng:120.204,country:'TW',title:'美術館'};
const feature={type:'Feature',geometry:{type:'Point',coordinates:[126.98,37.56]},properties:{name:'首爾',countrycode:'kr'}};
test('handoff uses Google destination coordinates and preserves transit without requesting a route',()=>{
  const result=navigationChoice(tainan,{mode:'transit'}),url=new URL(result.href);
  assert.equal(result.provider,'google');assert.equal(url.searchParams.get('destination'),'22.9915,120.204');
  assert.equal(url.searchParams.get('travelmode'),'transit');assert.equal(url.searchParams.has('origin'),false);assert.equal(url.searchParams.has('key'),false);
});
test('Korean results select NAVER, explicit preference overrides it and public transit stays public',()=>{
  const p=photonPlaces({features:[feature]})[0];assert.equal(p.country,'KR');
  assert.match(navigationChoice(p,{mode:'transit'}).href,/nmap:\/\/route\/public\?/);
  assert.equal(navigationChoice(p,{preference:'google'}).provider,'google');
  assert.equal(navigationChoice({lat:NaN,lng:2}),null);
});
test('parking handoff does not overwrite the original destination',()=>{
  const original={...tainan},lot={lat:22.99,lng:120.195,name:'停車場'};
  const trip=parkingHandoff(original,lot);trip.parking.title='different';
  assert.deepEqual(original,tainan);assert.equal(trip.destination.title,'美術館');assert.equal(lot.name,'停車場');
});
test('changing parking keeps the destination, but a new destination cannot inherit an old trip',()=>{
  const lot={lat:22.99,lng:120.195,title:'停車場'},trip=parkingHandoff(tainan,lot);
  assert.equal(journeyForSelection(trip,{...lot}),trip);
  assert.equal(journeyForSelection(trip,{...tainan}),trip);
  const next={lat:23,lng:120.22,title:'另一個目的地'};
  assert.equal(journeyForSelection(trip,next),null);
  assert.equal(parkingHandoff(journeyForSelection(trip,next)?.destination||next,lot).destination.title,'另一個目的地');
});
test('coordinate/saved-place searches work offline and a malformed response is not empty',async()=>{
  const search=createPlaceSearch({fetcher:()=>{throw Error('no network')},interval:0});
  assert.equal((await search.search('22.99,120.2'))[0].lat,22.99);
  assert.equal((await search.search('美術館',{known:[tainan]}))[0],tainan);
  assert.throws(()=>photonPlaces({}),/格式/);
});
test('search caches successful queries; rate limits and network errors never become empty results',async()=>{
  let calls=0;const search=createPlaceSearch({interval:0,fetcher:async()=>{calls++;return {ok:true,json:async()=>({features:[feature]})}}});
  await search.search('首爾');await search.search('首爾');assert.equal(calls,1);
  const limited=createPlaceSearch({interval:0,fetcher:async()=>({ok:false,status:429})});
  await assert.rejects(limited.search('test'),/忙碌/);
});
const row={id:'1',code:'A1',name:'官方停車場',car:0,car_total:20,lnglat:'22.991501,120.195621',update_time:'2026-09-27 21:00:00'};
test('Tainan latitude-first coordinates, Taiwan time and zero spaces stay distinct from unknown',()=>{
  const now=Date.parse('2026-09-27T13:01:00Z');
  const [lot]=tainanLots({data:[row]},tainan,{now});
  assert.equal(lot.lat,22.991501);assert.equal(lot.lastUpdated,'2026-09-27T13:00:00.000Z');
  assert.equal(lot.available,0);assert.equal(lot.freshness,'live');
  for(const value of [null,'',-1,false])assert.equal(tainanLots({data:[{...row,car:value}]},tainan,{now})[0].available,null);
  assert.equal(tainanTime('2026-02-30 21:00:00'),null);
});
test('Tainan static fallback can never claim live spaces, even when just downloaded',async()=>{
  const now=Date.parse('2026-09-27T13:01:00Z');let calls=0;
  const result=await loadTaiwanParking(tainan,{now,fetcher:async url=>{calls++;if(url.startsWith('https:'))throw TypeError('CORS');return {ok:true,json:async()=>({data:[row],fetchedAt:new Date(now).toISOString()})}}});
  assert.equal(calls,2);assert.ok(result.failedSource);assert.equal(result.lots[0].available,null);assert.equal(result.lots[0].freshness,'unknown');
});
test('old, future and invalid parking timestamps do not become live; unsupported regions do not fetch',async()=>{
  assert.equal(tainanLots({data:[row]},tainan,{now:Date.parse('2026-09-27T14:00:00Z')})[0].freshness,'stale');
  assert.equal(tainanLots({data:[row]},tainan,{now:Date.parse('2026-09-27T12:00:00Z')})[0].freshness,'unknown');
  const result=await loadTaiwanParking({lat:37.56,lng:126.98},{fetcher:()=>{throw Error('should not fetch')}});assert.equal(result.coverage,'none');
});
test('shipped companion dependency graph never loads a Google SDK, billing key or old routes adapter',()=>{
  const base=new URL('../',import.meta.url),seen=new Set();
  function visit(name){if(seen.has(name))return;seen.add(name);const text=fs.readFileSync(new URL(name,base),'utf8');
    assert.doesNotMatch(text,/maps\.googleapis\.com|KTAK_CONFIG|google\.maps\./,name);
    for(const m of text.matchAll(/from ['"]\.\/([^'"?]+)(?:\?[^'"]*)?['"]/g))visit(m[1]);
  }
  visit('app.js');assert.equal(seen.has('routes-provider.js'),false);assert.equal(seen.has('places-provider.js'),false);
  assert.doesNotMatch(fs.readFileSync(new URL('index.html',base),'utf8'),/\.\.\/config\.js/);
});
