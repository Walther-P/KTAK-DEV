import {validPoint,navigationUrl,regionalProvider} from './core.js?v=0.7.2';

export function navigationChoice(destination,{preference='auto',mode='driving',country=''}={}){
  if(!validPoint(destination))return null;
  const region=country||destination.country||'';
  const provider=preference==='auto'?regionalProvider(destination,region):preference;
  // This trial enables only integrations validated against their official URL specs.
  const supported=provider==='naver'?'naver':'google';
  return {provider:supported,title:supported==='naver'?'NAVER Maps':'Google Maps',
    href:navigationUrl({destination,mode,provider:supported}),
    regionKnown:!!region};
}

export function parkingHandoff(destination,lot){
  if(!validPoint(lot))throw Error('停車場位置無效');
  return {destination:validPoint(destination)?{...destination}:null,parking:{...lot,title:lot.title||lot.name||'停車場'}};
}

export function journeyForSelection(trip,point){
  if(!validPoint(point)||!validPoint(trip?.parking))return null;
  const matches=p=>validPoint(p)&&Math.abs(p.lat-point.lat)<1e-6&&Math.abs(p.lng-point.lng)<1e-6;
  return matches(trip.parking)||matches(trip.destination)?trip:null;
}
