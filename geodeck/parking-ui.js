import {loadNearbyParking} from './parking-provider.js?v=0.4.0';
import {finite,escapeHtml as esc} from './core.js?v=0.4.0';

export function createParkingUI({map,openPanel,isOpen,selected,getPosition,routeTo}){
  const $=id=>document.getElementById(id);let sequence=0,markers=[],current=null,center=null,timer=null;
  const freshness=lot=>{const time=Date.parse(lot.lastUpdated),age=Date.now()-time;return Number.isFinite(time)&&age>=0&&age<=300000?'live':Number.isFinite(time)&&age>=0?'stale':'unknown'};
  function clear(){sequence++;markers.forEach(m=>m.setMap(null));markers=[];current=null;clearInterval(timer);timer=null}
  function available(lot){return freshness(lot)==='live'&&finite(lot.available)?String(lot.available):'?'}
  function update(){
    if(!current)return;
    markers.forEach((m,i)=>m.setLabel({text:'P '+available(current.lots[i]),fontSize:'12px',color:'#e7edf3'}));
    if(!isOpen()||!$('parkingResults'))return;
    const lots=current.lots;
    $('parkingResults').innerHTML=`${current.failedSource?'<p class="warning">即時車位資料暫時無法取得；以下基本資訊仍可查看。</p>':''}${!lots.length?'<p class="empty">此區域無即時停車資料<br><small>第一版僅接入臺北市官方資料；可移動地圖後再搜尋。</small></p>':lots.map((lot,i)=>{
      const fresh=freshness(lot),count=available(lot),time=lot.lastUpdated?new Date(lot.lastUpdated).toLocaleString('zh-TW',{hour12:false}):'未提供';
      return `<article class="parking-card ${fresh!=='live'?'stale':''}"><div class="row"><h2>${esc(lot.name)}</h2><strong class="parking-count">P ${count}</strong></div><p class="subtle">直線 ${(lot.distance/1000).toFixed(1)} km · 汽車總格數 ${finite(lot.total)?lot.total:'未知'}</p><p class="micro">${fresh==='live'&&count!=='?'?'即時剩餘 '+count+' 格':fresh==='stale'?'STALE · 車位資料超過 5 分鐘':'無即時空位資料'} · 更新 ${esc(time)}</p><p class="micro">費率：${esc(lot.rate||'未提供')}<br>營業時間：${esc(lot.hours||'未提供')}</p><button class="button full" data-parking-route="${i}">前往此停車場</button></article>`;
    }).join('')}<p class="micro">來源：<a href="${esc(current.source)}" target="_blank" rel="noopener noreferrer">${esc(current.provider)}</a> · 車位會變動，非預約保證。<br>僅顯示有官方經緯度的停車場入口；「?」表示未知或過期。</p>`;
    $('parkingResults').querySelectorAll('[data-parking-route]').forEach(button=>button.onclick=()=>{const lot=lots[Number(button.dataset.parkingRoute)];clear();routeTo({...lot,title:lot.name})});
  }
  async function search(useGps=false){
    clear();const token=sequence;
    openPanel('parking','附近停車',`<div class="actions"><button id="parkingMap" class="button">地圖位置附近</button><button id="parkingGps" class="button">GPS 附近</button></div><p id="parkingStatus" class="micro">搜尋半徑 3 km · 依直線距離排序</p><div id="parkingResults"><p class="subtle">正在取得官方停車資料…</p></div>`,'NEARBY PARKING');
    $('parkingMap').onclick=()=>search(false);$('parkingGps').onclick=()=>search(true);
    try{
      center=useGps?await getPosition():selected()||{lat:map().getCenter().lat(),lng:map().getCenter().lng()};
      const data=await loadNearbyParking(center);if(token!==sequence||!isOpen())return;current=data;
      $('parkingStatus').textContent=`${useGps?'GPS':'選取／地圖位置'}附近 3 km · ${data.lots.length} 個結果 · 依直線距離排序`;
      markers=data.lots.map((lot,i)=>{const marker=new google.maps.Marker({map:map(),position:lot,title:lot.name,icon:{path:google.maps.SymbolPath.CIRCLE,scale:23,fillColor:'#273746',fillOpacity:1,strokeColor:'#a9bdce',strokeWeight:1.5},label:{text:'P '+available(lot),fontSize:'12px',color:'#e7edf3'}});marker.addListener('click',()=>{if(!isOpen()){openPanel('parking','附近停車','<div id="parkingResults"></div>','NEARBY PARKING');update()}$('parkingResults').querySelectorAll('.parking-card')[i]?.scrollIntoView({block:'nearest',behavior:'smooth'})});return marker});
      map().panTo(center);map().setZoom(14);update();timer=setInterval(update,30000);
    }catch(error){if(token===sequence&&isOpen())$('parkingResults').innerHTML=`<p class="warning">${useGps&&error.code===1?'未允許定位，請改用「地圖位置附近」。':'官方停車資料暫時無法取得，請稍後重試。'}</p>`}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
  return{search,clear};
}
