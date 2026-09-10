(() => {
'use strict';
// ktak-v35-ux-v18
const $=id=>document.getElementById(id);

function mobileUa(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')}

function hideSearchSectorUi(){
  const commandBtn=$('v35SearchSectorBtn');
  commandBtn?.closest?.('.v35Card')?.classList.add('v18SearchRemoved');
  const mapBtn=$('v35SearchSectorBtnMap');
  mapBtn?.closest?.('.row')?.classList.add('v18SearchRemoved');
  document.querySelectorAll('.v35SearchHelp,[data-for="v35SearchSectorBtnMap"],[data-for="v35SearchSectorBtn"]').forEach(x=>x.classList.add('v18SearchRemoved'));
  $('v35SummarySearch')?.closest?.('.v35Stat')?.classList.add('v18SearchRemoved');
  const mode=$('v35TaskLocationMode');
  if(mode){
    [...mode.options].forEach(o=>{if(o.value==='sector'||/搜索區/.test(o.textContent||''))o.remove()});
    if(mode.value==='sector'){mode.value='none';mode.dispatchEvent(new Event('change',{bubbles:true}))}
  }
  $('v35TaskSectorRow')?.classList.add('v18SearchRemoved');
}

function installMapAidDock(){
  if($('v35MapAidDock'))return true;
  const grid=$('v35GridToggle'),map=$('map');
  if(!grid||!map)return false;
  const source=grid.closest('.card');
  const host=map.parentElement;
  if(!source||!host)return false;
  if(getComputedStyle(host).position==='static')host.style.position='relative';

  const dock=document.createElement('div');dock.id='v35MapAidDock';dock.className='v35MapAidDock';
  const toggle=document.createElement('button');toggle.id='v35MapAidDockToggle';toggle.type='button';toggle.className='v35MapAidDockToggle';toggle.textContent='⚙ 地圖輔助';toggle.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.id='v35MapAidDockPanel';panel.className='v35MapAidDockPanel hidden';

  [...source.children].forEach(node=>{if(node.tagName!=='H3')panel.append(node)});
  source.remove();
  dock.append(panel,toggle);host.append(dock);
  toggle.onclick=()=>{const opening=panel.classList.contains('hidden');panel.classList.toggle('hidden',!opening);toggle.setAttribute('aria-expanded',String(opening));toggle.textContent=opening?'✕ 收合輔助':'⚙ 地圖輔助'};
  hideSearchSectorUi();
  return true;
}

function installLocationCollapse(){
  const cards=[...document.querySelectorAll('.locationCard')];
  if(!cards.length)return false;
  let installed=false;
  for(const card of cards){
    if(card.classList.contains('v18Ready')){installed=true;continue}
    let header=card.querySelector(':scope > h2,:scope > h3,:scope > h4,:scope > .cardTitle,:scope > .sectionTitle,:scope > .title,:scope > [data-location-title]');
    if(!header){
      header=[...card.children].find(el=>{
        if(/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return false;
        const text=(el.textContent||'').trim();
        return text.length>0&&text.length<=40&&/(隊員|定位|位置)/.test(text);
      })||null;
    }
    if(!header){
      header=document.createElement('div');
      header.className='v18LocationHeader';
      const title=document.createElement('b');title.textContent='隊員定位';header.append(title);
      card.prepend(header);
    }else header.classList.add('v18LocationHeader');

    card.classList.add('v18Ready','v18Collapsed');
    const b=document.createElement('button');b.type='button';b.className='v18CardToggle';b.textContent='展開';b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','展開隊員定位');
    header.append(b);
    b.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const open=card.classList.contains('v18Collapsed');
      card.classList.toggle('v18Collapsed',!open);
      b.textContent=open?'收合':'展開';
      b.setAttribute('aria-expanded',String(open));
      b.setAttribute('aria-label',(open?'收合':'展開')+'隊員定位');
    };
    installed=true;
  }
  return installed;
}

function replaceToggle(id,bodyId){
  const old=$(id),body=$(bodyId);if(!old||!body||old.dataset.v18==='1')return false;
  const b=old.cloneNode(true);b.dataset.v18='1';b.textContent='展開';b.setAttribute('aria-expanded','false');old.replaceWith(b);
  body.classList.add('hidden');body.classList.remove('v18Open');
  b.onclick=()=>{const open=body.classList.contains('hidden');body.classList.toggle('hidden',!open);body.classList.toggle('v18Open',open);b.textContent=open?'收合':'展開';b.setAttribute('aria-expanded',String(open))};
  return true;
}

function installWeatherDefault(){
  const select=$('v35DisasterCounty'),body=$('v35DisasterBody'),refresh=$('v35DisasterRefresh');
  if(!select||!body)return false;
  replaceToggle('v35DisasterToggle','v35DisasterBody');
  if(!select.querySelector('option[value="__choose__"]')){
    const placeholder=document.createElement('option');placeholder.value='__choose__';placeholder.textContent='請選擇縣市／全臺';placeholder.disabled=true;select.prepend(placeholder);
  }
  const all=[...select.options].find(o=>o.value==='');
  if(all&&all.textContent!=='全臺')all.textContent='全臺';
  if(select.dataset.v18!=='1'){
    select.dataset.v18='1';select.value='__choose__';if(refresh)refresh.disabled=true;
    select.addEventListener('change',()=>{
      if(select.value==='__choose__')return;
      body.classList.remove('hidden');body.classList.add('v18Open');
      const t=$('v35DisasterToggle');if(t){t.textContent='收合';t.setAttribute('aria-expanded','true')}
      if(refresh)refresh.disabled=false;
    });
  }
  return true;
}

function installTimelineDefault(){return replaceToggle('v35TimelineToggle','v35TimelineBody')}

function install(){
  hideSearchSectorUi();
  installMapAidDock();
  installLocationCollapse();
  installWeatherDefault();
  installTimelineDefault();
  document.documentElement.dataset.ktakV35Ux='18';
}

install();
const observer=new MutationObserver(()=>install());
observer.observe(document.documentElement,{childList:true,subtree:true});
let tries=0;const timer=setInterval(()=>{install();if(++tries>40){clearInterval(timer);observer.disconnect()}},500);
window.__KTAK35_UX18={version:18,revision:'18.3',mobileUa,install,installLocationCollapse};
})();
