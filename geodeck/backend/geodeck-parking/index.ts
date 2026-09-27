import {createHandler} from './handler.js';
function publishableKeys(){
  const raw=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if(raw){try{return Object.values(JSON.parse(raw)).filter((v):v is string=>typeof v==='string')}catch{}}
  const single=Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  return single?[single]:[];
}
Deno.serve(createHandler({keys:publishableKeys}));
