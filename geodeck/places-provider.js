import {parseCoordinates,validPoint} from './core.js?v=0.5.0';

export function serviceError(error,stage='地點搜尋'){
  const raw=[error?.code,error?.message,String(error||'UNKNOWN')].join(' ');
  const code=/REQUEST_DENIED|PERMISSION_DENIED|API.*not.*(enabled|activated)|API_KEY|SERVICE_DISABLED/i.test(raw)?'AUTH':/OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|quota/i.test(raw)?'QUOTA':/ZERO_RESULTS|NOT_FOUND/.test(raw)?'EMPTY':/INVALID_REQUEST|INVALID_ARGUMENT/.test(raw)?'REQUEST':'NETWORK';
  const message={AUTH:'Google 服務授權未通過，需檢查 API 啟用與金鑰限制。',QUOTA:'Google 服務配額已用完，請稍後再試。',EMPTY:'查無相符地點，請補上縣市或改用地圖選點。',REQUEST:'搜尋請求無效，請修改輸入後重試。',NETWORK:'服務連線失敗，請檢查網路後重試；這不代表沒有結果。'}[code];
  return Object.assign(new Error(`${stage}：${message}`),{stage,kind:code});
}
export function placePoint(p){
  const l=p?.location||p?.geometry?.location;
  const point={lat:typeof l?.lat==='function'?l.lat():l?.lat,lng:typeof l?.lng==='function'?l.lng():l?.lng};
  if(!validPoint(point))return null;
  return{...point,title:p.displayName||p.name||p.formattedAddress||p.formatted_address||'選取位置',placeId:p.id||p.place_id,country:(p.addressComponents||[]).find(c=>c.types.includes('country'))?.shortText||''};
}
export async function resolvePlace(text,{known=[],geocoder,importLibrary=name=>google.maps.importLibrary(name)}={}){
  text=text.trim();const coordinates=parseCoordinates(text);if(coordinates)return{...coordinates,title:text};
  const matches=known.filter(p=>validPoint(p)&&p.title===text);
  if(matches.length===1)return matches[0];
  let searchError;
  try{
    const {Place}=await importLibrary('places');
    const {places}=await Place.searchByText({textQuery:text,fields:['displayName','location','formattedAddress','id'],language:'zh-TW',region:'tw',maxResultCount:5});
    const point=places?.map(placePoint).find(Boolean);if(point)return point;
    searchError=Error('ZERO_RESULTS');
  }catch(error){searchError=error}
  if(!geocoder)throw serviceError(searchError,'地點解析');
  const result=await new Promise(resolve=>geocoder.geocode({address:text,region:'tw'},(results,status)=>resolve({results,status})));
  if(result.status==='OK'){const point=result.results?.map(placePoint).find(Boolean);if(point)return point}
  // Only two successful empty responses mean "not found"; preserve provider failures.
  throw serviceError(result.status==='ZERO_RESULTS'?searchError:Error(result.status),'地點解析');
}
export async function nearbyPlaces(type,center,{importLibrary=name=>google.maps.importLibrary(name)}={}){
  if(!validPoint(center))throw Error('搜尋位置無效，請重新定位或選取地圖位置。');
  try{
    const {Place}=await importLibrary('places');
    const includedType={toilet:'public_bathroom',charging:'electric_vehicle_charging_station'}[type]||type;
    const {places}=await Place.searchNearby({fields:['displayName','location','id'],locationRestriction:{center,radius:6000},includedTypes:[includedType],maxResultCount:15,rankPreference:'DISTANCE',language:'zh-TW'});
    return (places||[]).map(placePoint).filter(Boolean);
  }catch(error){throw serviceError(error,'附近搜尋')}
}

// Explicit selection retains coordinates; no extra geocoding of a chosen prediction.
export function attachSuggestions(input,{onSelect,bias=()=>null,importLibrary=name=>google.maps.importLibrary(name)}={}){
  const box=document.createElement('div');box.className='poi-list';box.setAttribute('aria-live','polite');input.insertAdjacentElement('afterend',box);
  let timer,sequence=0,sessionToken;
  input.addEventListener('input',()=>{
    clearTimeout(timer);const token=++sequence;box.replaceChildren();
    const value=input.value.trim();if(value.length<2||parseCoordinates(value))return;
    timer=setTimeout(async()=>{
      try{
        const {AutocompleteSuggestion,AutocompleteSessionToken}=await importLibrary('places');sessionToken??=new AutocompleteSessionToken();
        const center=bias();const {suggestions}=await AutocompleteSuggestion.fetchAutocompleteSuggestions({input:value,sessionToken,language:'zh-TW',region:'tw',...(validPoint(center)?{locationBias:{center,radius:20000}}:{})});
        if(token!==sequence||!input.isConnected)return;
        box.replaceChildren();
        for(const suggestion of suggestions.slice(0,5)){
          const prediction=suggestion.placePrediction;if(!prediction)continue;
          const button=document.createElement('button');button.type='button';button.textContent=prediction.text.toString();
          button.onclick=async()=>{const selection=++sequence;clearTimeout(timer);box.textContent='取得地點…';try{const place=prediction.toPlace();await place.fetchFields({fields:['location','displayName','id']});if(selection!==sequence||!input.isConnected)return;const p=placePoint(place);if(!p)throw Error('ZERO_RESULTS');input.value=p.title;box.replaceChildren();sessionToken=null;onSelect(p)}catch(error){if(selection===sequence&&input.isConnected)box.textContent=serviceError(error,'地點建議').message}};
          box.append(button);
        }
      }catch(error){if(token===sequence&&input.isConnected)box.textContent=serviceError(error,'地點建議').message}
    },450);
  });
}
