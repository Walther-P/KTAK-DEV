const VERSION='0.7.2',CACHE='geodeck-shell-'+VERSION;
const SHELL=['./','./index.html',...['styles.css','app.js','core.js','layers.js','map-config.js','map-provider.js','open-places.js','journey.js','navigation-ui.js','taiwan-parking.js','parking-provider.js','parking-map-ui.js','parking-core.js','parking-catalog.js','parking-sources.js','weather-core.js','camera-catalog.js'].map(p=>'./'+p+'?v='+VERSION),'./data/parking-cameras.json?v='+VERSION,'./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('geodeck-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),scope=new URL(self.registration.scope);if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
// Never cache Google tiles, weather, camera images, routes, or external API responses.
if(u.pathname.endsWith('/data/cameras-tw.json.gz'))return;
if(e.request.mode==='navigate'){e.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(e.request);if(response.ok)await cache.put('./index.html',response.clone());return response}catch{return await cache.match('./index.html')||Response.error()}})());return}
if(!SHELL.some(path=>new URL(path,self.registration.scope).href===u.href))return;
e.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response}catch{return await cache.match(e.request)||Response.error()}})())});
