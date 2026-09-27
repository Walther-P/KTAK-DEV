import fs from 'node:fs/promises';
import {TAINAN_URL,TAINAN_SOURCE} from '../taiwan-parking.js';
const r=await fetch(TAINAN_URL,{signal:AbortSignal.timeout(20000)});
if(!r.ok)throw Error('Official feed HTTP '+r.status);
const payload=await r.json();
if(payload.success!==true||!Array.isArray(payload.data)||!payload.data.length)throw Error('Invalid official feed');
// Discard dynamic counts so the bundle cannot be mistaken for real-time availability.
const data=payload.data.map(({id,code,name,zone,address,car_total,chargeTime,chargeFee,lnglat,update_time})=>({id,code,name,zone,address,car_total,chargeTime,chargeFee,lnglat,update_time}));
await fs.writeFile(new URL('../data/parking-tainan.json',import.meta.url),JSON.stringify({source:TAINAN_SOURCE,fetchedAt:new Date().toISOString(),data}));
console.log('Saved official Tainan metadata:',data.length,'lots; live counts intentionally omitted');
