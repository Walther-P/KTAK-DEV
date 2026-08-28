const VERSION="ktak-v21-dev3-retirement";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("ktak-")).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))
});
self.addEventListener("fetch",e=>{
  if(e.request.method==="GET")e.respondWith(fetch(e.request,{cache:"no-store"}).catch(()=>fetch(e.request)))
});