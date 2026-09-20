import {finite,gpsSpeed} from './core.js?v=0.3.0';
import {navigationModel,routeProgress,aheadEnforcement,gpsHeading,freshness,AlertGate} from './drive-core.js?v=0.3.0';

export function createDrive({map,stripHtml,closePanel,unlockAudio,notify,onStop=()=>{}}){
  const $=id=>document.getElementById(id),gate=new AlertGate();
  let active=false,watch=null,timer=null,last=null,lastAt=0,model=null,catalog=null,wake=null,marker=null,sequence=0,options={},lastSpeech=0;
  const distance=m=>finite(m)?m>=1000?(m/1000).toFixed(1)+' km':Math.round(m/10)*10+' m':'—';
  const say=text=>{if(!options.voice||Date.now()-lastSpeech<8000)return;lastSpeech=Date.now();notify(text)};
  function clearFix(message){
    $('driveSpeed').textContent='—';$('driveInstruction').textContent=message;$('driveDistance').textContent='—';$('driveEta').textContent='—';$('driveRemaining').textContent='—';$('driveEnforcement').textContent='等待可靠定位與行進方向';$('drivePointLimit').textContent='—';
    $('drivePanel').classList.remove('over');marker?.setMap(null);last=null;
  }
  async function requestWake(){if(!active||document.hidden||!options.awake||wake||!navigator.wakeLock)return;const token=sequence;try{const lock=await navigator.wakeLock.request('screen');if(!active||document.hidden||token!==sequence){lock.release();return}wake=lock;lock.addEventListener('release',()=>{if(wake===lock)wake=null})}catch{}}
  function pause(message){sequence++;if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;wake?.release();wake=null;clearFix(message)}
  function resume(){
    if(!active||document.hidden||watch!==null)return;
    if(!navigator.geolocation){clearFix('此裝置無法使用定位');return}
    const token=++sequence;requestWake();
    watch=navigator.geolocation.watchPosition(p=>{if(!active||document.hidden||token!==sequence)return;update(p)},()=>{if(token===sequence){lastAt=0;clearFix('無法取得 GPS · 請檢查定位權限')}},{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
  }
  function update(p){
    const speed=gpsSpeed(p,last),position={lat:p.coords.latitude,lng:p.coords.longitude};
    const heading=gpsHeading(p,last);
    last=p;lastAt=Date.now();
    if(!finite(p.coords.accuracy)||p.coords.accuracy>30||Date.now()-p.timestamp>15000){clearFix('GPS 精度不足 · 提醒暫停');return}
    $('driveSpeed').textContent=finite(speed)?Math.round(speed):'—';
    const progress=model?routeProgress(model,position,heading):null;
    if(progress?.status==='on-route'||progress?.status==='arrived'){
      $('driveInstruction').textContent=progress.status==='arrived'?'已接近目的地':progress.next.instruction;
      $('driveDistance').textContent=distance(progress.next.distanceToManeuver);
      $('driveRemaining').textContent=distance(progress.remaining);
      $('driveEta').textContent=finite(progress.duration)?new Date(Date.now()+progress.duration*1000).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):'—';
    }else{
      $('driveInstruction').textContent=model?'已偏離路線 · 停妥後重新規劃':'自由駕駛 · 尚未載入路線';
      $('driveDistance').textContent='—';$('driveEta').textContent='—';$('driveRemaining').textContent='—';
    }
    marker??=new google.maps.Marker({map:map(),zIndex:100,icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:'#b7c7d6',fillOpacity:1,strokeColor:'#17212b',strokeWeight:3}});
    marker.setMap(map());marker.setPosition(position);map().panTo(position);
    const candidates=catalog&&progress?.status!=='off-route'?aheadEnforcement(catalog.points,{position,heading,speed,accuracy:p.coords.accuracy,distance:options.distance,path:model?.path}):[];
    const next=candidates[0];$('drivePanel').classList.remove('over');
    $('drivePointLimit').textContent=next&&finite(next.speedLimit)?next.speedLimit+' km/h':'—';
    if(!catalog)$('driveEnforcement').textContent='執法資料無法載入 · 不代表沒有執法';
    else if(next){
      const kind={'fixed-speed':'測速','red-light':'闖紅燈','technology':'科技執法','section-start':'區間測速起點','section-end':'區間測速終點'}[next.kind]||'執法';
      $('driveEnforcement').textContent=`前方候選 ${distance(next.distance)} · ${kind} · ${next.name} · ${next.confidence==='direction-match'?'方向符合':'方向未知'}`;
      if(gate.allow(next.id)){say('前方執法候選，請注意道路標誌');if(options.vibrate)navigator.vibrate?.([150,80,150])}
    }else $('driveEnforcement').textContent=heading===null||speed<5?'等待行進方向 · 提醒暫停':progress?.status==='off-route'?'偏離路線 · 執法提醒暫停':'此範圍無符合候選 · 不代表沒有執法';
    // A nearby camera limit is not the current road limit. No automatic road-speed warning without road metadata.
    $('driveSource').textContent=catalog?`${catalog.provider} · ${freshness(catalog)}`:'執法資料尚未取得';
  }
  async function start(leg,settings){
    if(active)return;active=true;options={distance:500,voice:true,vibrate:true,awake:true,...settings};model=leg?navigationModel(leg,stripHtml):null;last=null;lastAt=0;
    closePanel();unlockAudio();document.body.classList.add('driving');$('drivePanel').classList.remove('hidden');$('exitDrive').focus();clearFix('等待 GPS 定位');map()?.setZoom(17);
    resume();timer=setInterval(()=>{if(active&&lastAt&&Date.now()-lastAt>15000)clearFix('GPS 已過期 · 提醒暫停')},3000);
    if(!catalog)try{const response=await fetch('./data/enforcement-tw.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('data');const data=await response.json();if(!Array.isArray(data.points))throw Error('schema');catalog=data;if(active)$('driveSource').textContent=`${data.provider} · ${freshness(data)}`}catch{if(active)$('driveSource').textContent='官方資料快照載入失敗 · 可稍後重新進入'}
  }
  function stop(){active=false;pause('導航已結束');clearInterval(timer);marker?.setMap(null);$('drivePanel').classList.add('hidden');document.body.classList.remove('driving');$('routes').focus();onStop()}
  $('exitDrive').onclick=stop;
  document.addEventListener('visibilitychange',()=>{if(!active)return;if(document.hidden)pause('背景定位已暫停');else resume()});
  return{start,stop,get active(){return active}};
}
