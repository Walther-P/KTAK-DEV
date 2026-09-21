import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlace,nearbyPlaces,serviceError} from '../places-provider.js';
const point={lat:22.99,lng:120.21,title:'收藏位置'};
test('coordinates and selected/saved places do not require Google authorization',async()=>{
  const fail=async()=>{throw Error('must not call API')};
  assert.deepEqual(await resolvePlace('22.99,120.21',{importLibrary:fail}),{lat:22.99,lng:120.21,title:'22.99,120.21'});
  assert.equal(await resolvePlace('收藏位置',{known:[point],importLibrary:fail}),point);
});
test('new Places resolves names while unavailable Geocoding is not required',async()=>{
  const p=await resolvePlace('台南車站',{importLibrary:async()=>({Place:{searchByText:async()=>({places:[{location:{lat:()=>22.997,lng:()=>120.212},displayName:'臺南車站',id:'station'}]})}})});
  assert.equal(p.title,'臺南車站');assert.equal(p.lat,22.997);
});
test('authorization, quota, empty and network errors stay distinct',()=>{
  for(const [message,kind] of [['REQUEST_DENIED','AUTH'],['PERMISSION_DENIED','AUTH'],['OVER_QUERY_LIMIT','QUOTA'],['ZERO_RESULTS','EMPTY'],['Rpc xhr failed','NETWORK']])assert.equal(serviceError(Error(message)).kind,kind);
});
test('a Places failure plus an empty geocoder response never means no result',async()=>{
  await assert.rejects(resolvePlace('unknown',{importLibrary:async()=>{throw Error('PERMISSION_DENIED')},geocoder:{geocode:(req,cb)=>cb([],'ZERO_RESULTS')}}),e=>e.kind==='AUTH');
});
test('nearby modern request uses the requested center and only successful empty response yields no results',async()=>{
  let req;const result=await nearbyPlaces('charging',point,{importLibrary:async()=>({Place:{searchNearby:async r=>{req=r;return{places:[]}}}})});
  assert.deepEqual(result,[]);assert.equal(req.locationRestriction.center,point);assert.deepEqual(req.includedTypes,['electric_vehicle_charging_station']);
  await assert.rejects(nearbyPlaces('hospital',point,{importLibrary:async()=>{throw Error('REQUEST_DENIED')}}),e=>e.kind==='AUTH');
});
