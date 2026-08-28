const VERSION="ktak-v21-dev6c3-chat-push";

self.addEventListener("install",event=>{
  self.skipWaiting()
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith("ktak-")).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  )
});

/* KTAK stays network-first. Push needs the worker to remain registered,
   but the operational app itself should not serve stale mission HTML. */
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(fetch(event.request,{cache:"no-store"}))
});

self.addEventListener("push",event=>{
  let payload={
    title:"KTAK",
    body:"你有一則新的任務訊息",
    url:"./",
    tag:"ktak-chat"
  };

  try{
    if(event.data){
      const incoming=event.data.json();
      payload={...payload,...incoming}
    }
  }catch(e){
    try{
      const text=event.data?.text();
      if(text)payload.body=text
    }catch{}
  }

  const options={
    body:payload.body||"你有一則新的任務訊息",
    icon:"./icon-192.png",
    badge:"./icon-192.png",
    tag:payload.tag||"ktak-chat",
    renotify:true,
    data:{url:payload.url||"./"},
    timestamp:Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(payload.title||"KTAK",options)
  )
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||"./",self.registration.scope).href;

  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({
      type:"window",
      includeUncontrolled:true
    });

    for(const client of windows){
      try{
        if(client.url.startsWith(self.registration.scope)){
          if("navigate" in client && client.url!==target){
            try{await client.navigate(target)}catch{}
          }
          return await client.focus()
        }
      }catch{}
    }

    if(self.clients.openWindow)return await self.clients.openWindow(target)
  })())
});
