import {createMarker} from './map-provider.js?v=0.7.0';
import {createParkingCatalog} from './parking-catalog.js?v=0.7.0';
import {clusterParking,parkingStatus} from './parking-core.js?v=0.7.0';
import {SOURCES} from './parking-sources.js?v=0.7.0';
import {escapeHtml as esc,finite} from './core.js?v=0.7.0';

export function createParkingUI({map,openPanel,closePanel,isOpen,routeTo}){
  const $=id=>document.getElementById(id),catalog=createParkingCatalog();
  let active=false,sequence=0,markers=[],current=[],summaries=[],meta,detailId=null,debounce,timer,ageTimer,includeCurb=true;
  const toolbar=$('parkingToolbar'),status=$('parkingMapStatus');
  function bounds(){const b=map().getBounds(),ne=b.getNorthEast(),sw=b.getSouthWest();return{north:ne.lat(),south:sw.lat(),west:sw.lng(),east:ne.lng()}}
  function clearMarkers(){markers.forEach(m=>m.setMap(null));markers=[]}
  function visibleLots(){return current.filter(p=>includeCurb||p.kind==='lot')}
  function render(){
    clearMarkers();if(!active)return;
    const groups=summaries.length?summaries.map(t=>({...t,summary:true,items:[]})):clusterParking(visibleLots(),map().getZoom());
    for(const group of groups){
      const many=group.summary||group.items.length>1,lot=group.items[0],n=group.summary?group.count:group.items.length;
      const freshness=many?null:parkingStatus(lot),prefix=lot?.kind==='curb'?'路':lot?.kind==='space'?'格':'P';
      const marker=createMarker({map:map(),position:group,title:many?`${n} 處停車地點，點選放大`:`${lot.name} · ${freshness.text}`,
        label:many?`${n} 處`:`${prefix} ${freshness.label}`,
        className:'parking-pin '+(many?'parking-cluster':freshness.kind)+' '+(lot?.kind||''),
        icon:{fillColor:many?'#34495b':freshness.kind==='live'?'#204c46':freshness.kind==='full'?'#684235':'#2b3b49',strokeColor:many?'#92a6b8':freshness.kind==='live'?'#8ed0b9':'#a8b8c8'},zIndex:40});
      marker.addListener('click',()=>{
        if(many&&map().getZoom()<20){closePanel();map().panTo(group);map().setZoom(group.summary?Math.max(11,map().getZoom()+2):Math.min(20,map().getZoom()+2));return}
        if(many){openPanel('parking','此處停車地點',group.items.map((p,i)=>`<button class="button full parking-choice" data-parking-choice="${i}">${esc(p.name)} · ${esc(parkingStatus(p).label)}</button>`).join(''),'PARKING');
          document.querySelectorAll('[data-parking-choice]').forEach(b=>b.onclick=()=>details(group.items[Number(b.dataset.parkingChoice)]));return}
        details(lot);
      });markers.push(marker);
    }
  }
  function details(lot){
    detailId=lot.id;const fresh=parkingStatus(lot),source=SOURCES[lot.source]||{name:'公開停車資料',url:'https://data.gov.tw/'};
    const time=lot.lastUpdated?`資料更新：${new Date(lot.lastUpdated).toLocaleString('zh-TW',{hour12:false})}`:lot.fetchedAt?`讀取時間：${new Date(lot.fetchedAt).toLocaleString('zh-TW',{hour12:false})}（來源未提供更新時間）`:'沒有即時車位更新時間';
    openPanel('parking',lot.name,`<article class="parking-detail"><div class="row"><span class="tag">${lot.kind==='curb'?'路邊停車':lot.kind==='space'?'個別停車格':'停車場'}</span><strong class="parking-count">${esc(fresh.label)} <small>格</small></strong></div>
      <p class="${fresh.kind==='live'?'subtle':'micro'}">${esc(fresh.text)}</p><p class="micro">${esc(time)}</p>
      ${lot.address?`<p>${esc(lot.address)}</p>`:''}<h2>計費方式</h2><p class="parking-rate">${esc(lot.rate||'來源未提供，請依現場公告')}</p>
      <p class="subtle">收費／開放時間：${esc(lot.hours||'來源未提供')}<br>總車位：${finite(lot.total)?lot.total+' 格':'未提供'}${lot.access?'<br>'+esc(lot.access):''}</p>
      <button class="button primary full" data-parking-route>前往此停車場</button><button class="button full" id="backToParking">返回停車地圖</button>
      <p class="micro">來源：<a href="${esc(lot.url||source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)}</a>${lot.source==='osm'?' · © OpenStreetMap contributors／ODbL':''}<br>目錄取得：${esc(meta?.fetchedAt?.slice(0,10)||'未知')} · 位置未必是入口，格位與費率依現場公告。</p></article>`,'PARKING');
    document.querySelector('[data-parking-route]').onclick=()=>{disable();routeTo({...lot,title:lot.name,country:'TW'})};
    $('backToParking').onclick=()=>{detailId=null;closePanel()};
  }
  async function refresh(){
    if(!active||document.hidden)return;const token=++sequence,b=bounds(),zoom=map().getZoom();
    status.textContent='正在載入此範圍停車位置…';
    try{
      const base=await catalog.base(b,zoom);if(token!==sequence||!active)return;
      current=base.lots;summaries=base.summaries;meta=base.meta;render();
      if(zoom<11){status.textContent='已收錄 '+meta.total.toLocaleString()+' 處 · 點標記放大查看';return}
      status.textContent=`範圍內 ${visibleLots().length} 處 · 更新車位中…`;
      const data=await catalog.refresh(b,current);if(token!==sequence||!active)return;
      current=data.lots;render();status.textContent=`範圍內 ${visibleLots().length} 處${data.warnings.length?' · 部分即時來源暫停':''}`;
      if(isOpen()&&detailId){const lot=current.find(p=>p.id===detailId);if(lot)details(lot)}
    }catch{if(token===sequence&&active){status.textContent='停車資料暫時無法載入，請按重新整理';current=[];summaries=[];render()}}
  }
  function enable(point){
    closePanel();active=true;toolbar.classList.remove('hidden');$('parking').setAttribute('aria-pressed','true');document.body.classList.add('parking-on');
    if(point){map().panTo(point);map().setZoom(Math.max(15,map().getZoom()))}
    clearInterval(timer);clearInterval(ageTimer);timer=setInterval(refresh,60000);ageTimer=setInterval(()=>{if(!document.hidden)render()},30000);refresh();
  }
  function disable(){active=false;sequence++;clearTimeout(debounce);clearInterval(timer);clearInterval(ageTimer);clearMarkers();toolbar.classList.add('hidden');$('parking').setAttribute('aria-pressed','false');document.body.classList.remove('parking-on');if(isOpen())closePanel()}
  $('refreshParking').onclick=refresh;
  $('showCurbParking').onchange=e=>{includeCurb=e.target.checked;render();if(!summaries.length)status.textContent=`範圍內 ${visibleLots().length} 處`};
  map().addListener('idle',()=>{if(active){sequence++;clearTimeout(debounce);debounce=setTimeout(refresh,350)}});
  document.addEventListener('visibilitychange',()=>{if(active&&!document.hidden)refresh()});
  return {toggle:()=>active?disable():enable(),enable,clear:disable};
}
