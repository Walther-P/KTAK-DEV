import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEnforcement,enforcementSummary} from '../enforcement-provider.js';
const data={provider:'official',source:'https://data.gov.tw/dataset/7320',fetchedAt:'2026-09-20',lastUpdated:null,points:[{id:'a',lat:25,lng:121,speedLimit:50}]};
test('failure of optional region does not disable national enforcement',async()=>{const catalog=await loadEnforcement(async url=>{if(url.includes('sections'))throw Error('offline');return{ok:true,json:async()=>data}});assert.equal(catalog.points.length,1);assert.equal(catalog.errors.length,1);assert.equal(catalog.points[0].lastUpdated,null);assert.match(enforcementSummary(catalog),/未載入/)});
test('multiple sources retain independent provenance and do not coerce unknown speed limits',async()=>{const catalog=await loadEnforcement(async url=>({ok:true,json:async()=>url.includes('sections')?{...data,provider:'region',points:[{id:'b',lat:25.1,lng:121,speedLimit:null},{id:'bad',lat:999,lng:121}]}:data}));assert.equal(catalog.points.length,2);assert.equal(catalog.points[1].provider,'region');assert.equal(catalog.points[1].speedLimit,null);assert.equal(catalog.errors.length,0)});
test('complete data failure stays unavailable rather than an empty all-clear',async()=>assert.rejects(()=>loadEnforcement(async()=>({ok:false})),/皆無法載入/));
