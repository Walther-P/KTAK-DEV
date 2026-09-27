import {escapeHtml as esc,validPoint} from './core.js?v=0.7.2';
import {navigationChoice} from './journey.js?v=0.7.2';

export function createNavigationUI({openPanel,isOpen,selected,setSelected,saved,search,country,center,read,write,findParking,journey,parked}){
  const $=id=>document.getElementById(id);
  let sequence=0,mode='driving',preference=read('geodeck.navigation','auto');
  if(!['auto','google','naver'].includes(preference))preference='auto';
  function render(){
    sequence++;const p=selected(),trip=journey();
    openPanel('routes','交給導航 App',`<p class="subtle">選好目的地，由導航 App 規劃路線、查看路況與班次。</p>
      <form id="destinationForm"><label class="form-field">目的地<input id="destinationQuery" required placeholder="搜尋地點、地址或座標" value="${esc(p?.title||'')}"></label>
      <button class="button full" type="submit">搜尋目的地</button></form><div id="destinationResults" class="poi-list"></div>
      <label class="form-field">從收藏選擇<select id="navigationSaved"><option value="">選擇收藏地點</option>${saved().map((s,i)=>`<option value="${i}">${esc(s.title)}</option>`).join('')}</select></label>
      <div class="segmented" aria-label="交通方式">${[['driving','開車'],['walking','步行'],['transit','大眾運輸']].map(([m,label])=>`<button data-mode="${m}" aria-pressed="${m===mode}">${label}</button>`).join('')}</div>
      <label class="form-field">導航服務<select id="navigationProvider"><option value="auto">依目的地自動推薦</option><option value="google">Google Maps</option><option value="naver">NAVER Maps（韓國）</option></select></label>
      <div id="navigationLink"></div>
      ${p?'<button class="button full" id="destinationParking">查看目的地附近停車</button>':'<p class="micro">也可關閉面板，直接在地圖上點選目的地。</p>'}
      ${trip?.parking?`<div class="journey-card"><h2>這趟行程</h2><p>停車場：${esc(trip.parking.title)}</p>${trip.destination?`<p>原目的地：${esc(trip.destination.title)}</p><button class="button full" id="walkOriginal">步行前往原目的地</button>`:''}<button class="button full" id="confirmParked">已停好，記住此車位</button></div>`:''}
      <p class="micro">出發地由導航 App 使用目前位置。切換 App 後，GeoDeck 不會在背景提供定位提醒。</p>`, 'NAVIGATION');
    $('navigationProvider').value=preference;
    $('navigationProvider').onchange=()=>{preference=$('navigationProvider').value;write('geodeck.navigation',preference);updateLink()};
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));updateLink()});
    $('destinationQuery').oninput=()=>{sequence++;$('navigationLink').innerHTML='<p class="micro">目的地文字已變更，請先搜尋並選取結果。</p>';$('destinationResults').replaceChildren();$('destinationParking')?.setAttribute('disabled','')};
    $('destinationForm').onsubmit=async e=>{
      e.preventDefault();const current=++sequence,text=$('destinationQuery').value.trim();
      $('destinationResults').textContent='搜尋中…';
      try{const rows=await search(text,{known:saved(),center:center()});
        if(current!==sequence||!isOpen())return;
        $('destinationResults').innerHTML=rows.length?rows.map((r,i)=>`<button data-destination="${i}"><b>${esc(r.title)}</b><small>${esc(r.address||'')}</small></button>`).join(''):'<p class="subtle">查無相符地點，可補上城市名稱或改用地圖選點。</p>';
        $('destinationResults').querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>{setSelected(rows[Number(b.dataset.destination)]);render()});
      }catch(e){if(current===sequence&&isOpen())$('destinationResults').textContent=e.message}
    };
    $('navigationSaved').onchange=()=>{if($('navigationSaved').value==='')return;setSelected(saved()[Number($('navigationSaved').value)]);render()};
    if($('destinationParking'))$('destinationParking').onclick=findParking;
    if($('walkOriginal'))$('walkOriginal').onclick=()=>{setSelected(trip.destination);mode='walking';render()};
    if($('confirmParked'))$('confirmParked').onclick=()=>parked(trip.parking);
    updateLink();
  }
  async function updateLink(){
    if(!isOpen())return;
    const p=selected(),token=++sequence;
    if(!validPoint(p)){$('navigationLink').innerHTML='';return}
    // Editing a label invalidates the old coordinates until a result is chosen.
    if($('destinationQuery').value!==p.title)return;
    let region=p.country||'';
    if(preference==='auto'&&!region){
      $('navigationLink').innerHTML='<p class="subtle">確認目的地地區…</p>';
      try{region=await country(p)}catch{}
      if(token!==sequence||!isOpen())return;
      if(region)p.country=region;
    }
    const choice=navigationChoice(p,{preference,mode,country:region});
    $('navigationLink').innerHTML=`<p class="micro">${preference==='auto'?(region==='KR'?'韓國 · 推薦 NAVER Maps':region==='TW'?'台灣 · 推薦 Google Maps':region?'此地區可使用 Google Maps；可手動切換':'地區未確認，請確認或手動選擇導航服務'):'使用你選擇的導航服務'}</p>
      <a class="button primary full" id="openNavigation" href="${esc(choice.href)}" ${choice.provider==='google'?'target="_blank" rel="noopener noreferrer"':''}>使用 ${choice.title} ${mode==='transit'?'查看大眾運輸':mode==='walking'?'步行前往':'前往'} ↗</a>
      ${choice.provider==='naver'?'<p class="micro">需要安裝 NAVER Maps。<a href="https://apps.apple.com/app/id311867728" target="_blank" rel="noopener noreferrer">iPhone 下載</a> · <a href="https://play.google.com/store/apps/details?id=com.nhn.android.nmap" target="_blank" rel="noopener noreferrer">Android 下載</a>；也可切換 Google Maps。</p>':''}`;
  }
  return {render,walkTo:p=>{setSelected(p);mode='walking';render()},cancel:()=>sequence++};
}
