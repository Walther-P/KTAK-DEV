import {parkingCount as count,inBounds} from './parking-core.js?v=0.7.0';
export const SOURCES={
  osm:{name:'OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',license:'ODbL 1.0'},
  taipei:{name:'臺北市停車管理工程處',url:'https://data.gov.tw/dataset/128435'},
  tainan:{name:'臺南市政府交通局',url:'https://data.tainan.gov.tw/Resource/91073f40-d251-42cc-9f4c-88e8937c9911'},
  ntpc:{name:'新北市政府交通局',url:'https://data.ntpc.gov.tw/datasets/b1464ef0-9c7c-4a6f-abf7-6bdf32847e68'},
  'ntpc-curb':{name:'新北市路邊停車空位',url:'https://data.ntpc.gov.tw/datasets/54a507c4-c038-41b5-bf60-bbecb9d052c6'},
  taoyuan:{name:'桃園市政府交通局',url:'https://data.gov.tw/dataset/25940'},
  taichung:{name:'臺中市政府交通局',url:'https://data.gov.tw/dataset/83931'}
};
export const FEEDS={
  ntpc:'https://data.ntpc.gov.tw/api/datasets/b1464ef0-9c7c-4a6f-abf7-6bdf32847e68/json',
  'ntpc-live':'https://data.ntpc.gov.tw/api/datasets/e09b35a5-a738-48cc-b0f5-570b67ad9c78/json',
  'ntpc-curb':'https://data.ntpc.gov.tw/api/datasets/54a507c4-c038-41b5-bf60-bbecb9d052c6/json',
  taoyuan:'https://opendata.tycg.gov.tw/api/dataset/f4cc0b12-86ac-40f9-8745-885bddc18f79/resource/0381e141-f7ee-450e-99da-2240208d1773/download',
  taichung:'https://motoretag.taichung.gov.tw/DataAPI/api/ParkingAPIV2/Opendata'
};

// Inverse transverse Mercator, TWD97 / TM2 zone 121 (EPSG:3826), GRS80.
export function twd97(x,y){
  x=Number(x);y=Number(y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<100000||x>400000||y<2400000||y>2900000)return null;
  const a=6378137,e2=.00669438002290,k=.9999,e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const mu=(y/k)/(a*(1-e2/4-3*e2**2/64-5*e2**3/256));
  const p=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu);
  const c=e2/(1-e2)*Math.cos(p)**2,t=Math.tan(p)**2,n=a/Math.sqrt(1-e2*Math.sin(p)**2),r=a*(1-e2)/(1-e2*Math.sin(p)**2)**1.5,d=(x-250000)/(n*k);
  const lat=p-n*Math.tan(p)/r*(d**2/2-(5+3*t+10*c-4*c**2-9*e2/(1-e2))*d**4/24+(61+90*t+298*c+45*t**2-252*e2/(1-e2)-3*c**2)*d**6/720);
  const lng=121+(d-(1+2*t+c)*d**3/6+(5-2*c+28*t-3*c**2+8*e2/(1-e2)+24*t**2)*d**5/120)/Math.cos(p)*180/Math.PI;
  return {lat:lat*180/Math.PI,lng};
}
const tw={south:21.8,north:26.5,west:118,east:122.1};
export function normalizeOfficial(source,rows,{snapshot=false,fetchedAt=null}={}){
  if(!Array.isArray(rows))throw Error(source+' 資料格式無效');
  return rows.flatMap(row=>{
    let p,id,name,total,available=null,rate,hours,address,kind='lot';
    if(source==='ntpc'){p=twd97(row.TW97X,row.TW97Y);id=row.ID;name=row.NAME;total=row.TOTALCAR;rate=row.PAYEX;hours=row.SERVICETIME;address=row.ADDRESS}
    if(source==='ntpc-curb'){p={lat:Number(row.latitude),lng:Number(row.longitude)};id=row.id;name=row.roadname+' · '+row.cellid+' 號格';kind='curb';total=1;rate=[row.pay,row.paycash].filter(Boolean).join(' ');hours=[row.day,row.hour].filter(Boolean).join(' ');address=row.roadname;
      // The public schema does not define these status codes. Do not guess 0/1 vacancy.
      available=null;
    }
    if(source==='taoyuan'){p={lat:Number(row.wgsX),lng:Number(row.wgsY)};id=row.parkId;name=row.parkName;total=row.totalSpace;available=count(row.surplusSpace);rate=row.payGuide;address=row.address}
    if(source==='taichung'){p={lat:Number(row.Lat),lng:Number(row.Lng)};id=row.ID;name=row.Position;total=row.TotalCar;address=row.KeyWord}
    if(!p||!inBounds(p,tw)||!id||count(total)===0)return [];
    return [{id:source+'-'+id,...p,name:name||'停車場',kind,total:count(total),available:snapshot?null:available,rate:rate||null,hours:hours||null,address:address||'',source,lastUpdated:null,fetchedAt:snapshot?null:fetchedAt}];
  });
}
