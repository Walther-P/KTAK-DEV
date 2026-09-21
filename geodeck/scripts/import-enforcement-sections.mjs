import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const DOWNLOAD='https://data.ntpc.gov.tw/api/datasets/27b97ad9-9dba-4ca9-b0ed-14b29000ffec/csv/file';
const SOURCE='https://data.gov.tw/dataset/126156',PROVIDER='新北市政府警察局';
function csv(text){let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[]}}else field+=c}if(quoted)throw Error('Incomplete CSV');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows}
export function parseSections(text,fetchedAt=new Date().toISOString()){
  const rows=csv(text.replace(/^\uFEFF/,'')),headers=rows.shift().map(x=>x.trim()),points=[];let skipped=0,segments=0;
  for(const key of ['location','limit','start latitude','start longitude','end latitude','end longitude'])if(!headers.includes(key))throw Error('Missing '+key);
  for(const values of rows){if(values.every(x=>!x.trim()))continue;const row=Object.fromEntries(headers.map((key,i)=>[key,(values[i]||'').trim()]));
    const arrays=['start latitude','start longitude','end latitude','end longitude'].map(key=>row[key].split(/\s+/).map(Number));
    if(!row.location||arrays.some(a=>a.length!==arrays[0].length||a.some(n=>!Number.isFinite(n)))){skipped++;continue}
    for(let i=0;i<arrays[0].length;i++){
      const start={lat:arrays[0][i],lng:arrays[1][i]},end={lat:arrays[2][i],lng:arrays[3][i]};
      if([start,end].some(p=>p.lat<21||p.lat>27||p.lng<117||p.lng>123)){skipped++;continue}
      const sectionId='ntpc-'+createHash('sha256').update(JSON.stringify([row.location,start,end])).digest('hex').slice(0,16),limit=row.limit.match(/^(\d{1,3})(?:\s*(?:公里|km\/h))?$/i);
      const length=row.length?.match(/^(\d+(?:\.\d+)?)\s*(?:公尺|m)?$/i);
      const speedLimit=limit&&Number(limit[1])>0&&Number(limit[1])<=130?Number(limit[1]):null;
      const common={sectionId,name:row.location,directionText:row.direct||'',speedLimit,provider:PROVIDER,source:SOURCE,lastUpdated:null,publishedLength:length?Number(length[1]):null,lengthText:row.length||''};
      points.push({...common,id:sectionId+'-start',...start,kind:'section-start',counterpart:end},{...common,id:sectionId+'-end',...end,kind:'section-end',counterpart:start});segments++;
    }
  }
  if(!points.length)throw Error('No valid section endpoints');
  return{provider:PROVIDER,source:SOURCE,download:DOWNLOAD,lastUpdated:null,fetchedAt,license:'政府資料開放授權條款-第1版',statistics:{segments,points:points.length,skipped},points};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let text;if(process.argv[2])text=await readFile(process.argv[2],'utf8');else{const r=await fetch(DOWNLOAD,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Download failed '+r.status);text=await r.text()}
  const result=parseSections(text);result.sourceSha256=createHash('sha256').update(text).digest('hex');await writeFile(new URL('../data/enforcement-sections-ntpc.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result.statistics);
}
