export function rainfallText(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return '雨量未知';
  return value.toFixed(1)+' mm';
}
