import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {matchedParkingCameras,createCameraCatalog,createParkingCameraLookup} from '../camera-catalog.js';
const point={id:'lot-1',lat:23,lng:120},camera=(id,lat=23,image='https://example.com/camera.jpg')=>({id,lat,lng:120,name:id,image});
const now=Date.parse('2026-09-27T16:00:00Z');
const link=(extra={})=>({parkingIds:['lot-1'],cameraId:'a',coverage:'entrance',image:'https://example.com/camera.jpg',verifiedAt:'2026-09-27T15:00:00Z',evidenceUrl:'https://official.example/camera',...extra});

test('distance and a parking name cannot substitute for an explicitly reviewed entrance/interior match',()=>{
  const rows=[camera('a'),{...camera('road'),name:'lot-1 停車場旁'}];
  assert.deepEqual(matchedParkingCameras(point,rows,[],{now}),[]);
  assert.equal(matchedParkingCameras(point,rows,[link()],{now})[0].coverage,'entrance');
  assert.equal(matchedParkingCameras(point,rows,[link({coverage:'interior'})],{now})[0].coverage,'interior');
  for(const changes of [{parkingIds:['other']},{coverage:'nearby-road'},{verifiedAt:null},{verifiedAt:'2020-01-01'},{verifiedAt:'2027-01-01'},{evidenceUrl:''},{image:'https://example.com/changed.jpg'}]){
    assert.deepEqual(matchedParkingCameras(point,rows,[link(changes)],{now}),[]);
  }
  assert.equal(matchedParkingCameras(point,rows,[link(),link()],{now}).length,1);
  assert.deepEqual(matchedParkingCameras(null,rows,[link()],{now}),[]);
});
test('unreviewed parking never downloads or proposes nearby road cameras',async()=>{
  let calls=0;const lookup=createParkingCameraLookup({fetcher:async()=>Response.json({links:[link()]}),catalog:{load:async()=>{calls++;return{cameras:[camera('a')],catalogTime:'2026-09-27'}}},now:()=>now});
  assert.deepEqual((await lookup.find({...point,id:'other'})).cameras,[]);assert.equal(calls,0);
  assert.equal((await lookup.find(point)).cameras.length,1);assert.equal(calls,1);
});
test('camera requests from parking and map layers share one in-flight download',async()=>{
  let calls=0;const catalog=createCameraCatalog({now:()=>0,fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return Response.json([camera('a')])}});
  const [a,b]=await Promise.all([catalog.load(),catalog.load()]);assert.equal(calls,1);assert.equal(a,b);
  assert.equal((await catalog.load()).cameras.length,1);assert.equal(calls,1);
});
test('same-origin camera catalog keeps its date, decodes gzip, and does not invent image times',async()=>{
  let calls=0;const catalog=createCameraCatalog({fetcher:async()=>{
    calls++;return new Response(gzipSync(JSON.stringify({updatedAt:'2026-09-20',cameras:[camera('a')]})));
  }});
  const result=await catalog.load();assert.equal(calls,1);assert.equal(result.catalogTime,'2026-09-20');
  assert.equal(result.cameras[0].lastUpdated,undefined);
});
test('empty camera coverage stays distinct from catalog failure and failed reads can retry',async()=>{
  const empty=createCameraCatalog({fetcher:async()=>Response.json([])});assert.deepEqual((await empty.load()).cameras,[]);
  let fail=true;const catalog=createCameraCatalog({fetcher:async()=>{if(fail)throw Error('offline');return Response.json([camera('a')])}});
  await assert.rejects(catalog.load(),/offline/);fail=false;assert.equal((await catalog.load()).cameras.length,1);
});
