import test from 'node:test';
import assert from 'node:assert/strict';
import {directionHeadings,aheadEnforcement,navigationModel,routeProgress,AlertGate,freshness,gpsHeading} from '../drive-core.js';
const p={lat:25,lng:121},path=[p,{lat:25.02,lng:121}];
const cam=(id,lat,lng=121,directionText='南往北')=>({id,lat,lng,directionText,speedLimit:50});
const args={position:p,heading:0,speed:40,accuracy:8,distance:500,path};
test('explicit travel headings only; camera bearing alone remains unknown',()=>{
 assert.deepEqual(directionHeadings('南往北'),[0]);assert.deepEqual(directionHeadings('北向南、南向北'),[180,0]);assert.deepEqual(directionHeadings('朝北拍攝'),[]);assert.deepEqual(directionHeadings('東北往西南'),[225]);
});
test('ahead enforcement rejects behind, opposite travel, parallel roads and beyond range',()=>{
 const points=[cam('ahead',25.003),cam('behind',24.997),cam('opposite',25.002,121,'北往南'),cam('parallel',25.003,121.002),cam('far',25.009)];
 assert.deepEqual(aheadEnforcement(points,args).map(c=>c.id),['ahead']);
});
test('missing heading, stationary, inaccurate GPS and off-route suppress candidates',()=>{
 for(const change of [{heading:null},{heading:NaN},{speed:0},{accuracy:80},{position:{lat:25,lng:121.01}}])assert.equal(aheadEnforcement([cam('x',25.003)],{...args,...change}).length,0);
});
test('unknown enforcement direction is explicitly tentative',()=>assert.equal(aheadEnforcement([cam('x',25.003,121,'')],args)[0].confidence,'direction-unknown'));
test('navigation advances to upcoming maneuver rather than showing the turn already passed',()=>{
 const model=navigationModel({duration:{value:600},steps:[{instructions:'向北',path:[p,{lat:25.01,lng:121}]},{instructions:'右轉',maneuver:'turn-right',path:[{lat:25.01,lng:121},{lat:25.01,lng:121.01}]}]});
 const progress=routeProgress(model,{lat:25.005,lng:121},0);
 assert.equal(progress.next.instruction,'右轉');assert.ok(progress.next.distanceToManeuver>550&&progress.next.distanceToManeuver<560);assert.deepEqual(progress.next.lanes,[]);assert.equal(progress.next.laneGuidance,'unavailable');assert.equal(progress.next.roadName,null);
 assert.equal(routeProgress(model,{lat:25.005,lng:121.01}).status,'off-route');assert.equal(routeProgress(model,{lat:25.005,lng:121},180).status,'off-route');
 assert.equal(routeProgress(model,{lat:25.01,lng:121.01},90).status,'arrived');
});
test('same point has a ten-minute cooldown and different points can alert',()=>{const gate=new AlertGate();assert.equal(gate.allow('a',0),true);assert.equal(gate.allow('a',1000),false);assert.equal(gate.allow('b',1000),true);assert.equal(gate.allow('a',600000),true)});
test('snapshot acquisition never impersonates official update time',()=>{assert.match(freshness({fetchedAt:'2026-09-20',lastUpdated:null},Date.parse('2026-09-21')),/官方更新時間未知/);assert.match(freshness({fetchedAt:'2026-01-01'},Date.parse('2026-09-21')),/STALE/)});
test('turn stays visible until reached, including final ten meters',()=>{const a={lat:25,lng:121},b={lat:25.001,lng:121},c={lat:25.001,lng:121.001};const model=navigationModel({steps:[{instructions:'直行',path:[a,b]},{instructions:'右轉',path:[b,c]}]});assert.equal(routeProgress(model,{lat:25.00091,lng:121},0).next.instruction,'右轉')});
test('U-shaped route behind driver cannot trigger an upcoming camera',()=>{const path=[p,{lat:25.001,lng:121},{lat:25.001,lng:120.999},{lat:24.999,lng:120.999},{lat:24.999,lng:121}];assert.equal(aheadEnforcement([cam('u',24.999,121,'北向南')],{...args,heading:180,distance:1000,path}).length,0)});
test('stationary coordinates never manufacture a northbound heading from reported speed',()=>{const fix={timestamp:1000,coords:{latitude:25,longitude:121,heading:null,speed:30,accuracy:5}};assert.equal(gpsHeading({...fix,timestamp:2000},fix),null)});
