const VERSION="ktak-v21-dev6c31-push-runtime-fix";

self.addEventListener("install",()=>self.skipWaiting());

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith("ktak-")).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  )
});

self.addEventListener("push",event=>{
  let payload={
    title:"KTAK",
    body:"你有一則新的任務訊息",
    url:"./",
    tag:"ktak-chat"
  };

  try{
    if(event.data)payload={...payload,...event.data.json()}
  }catch{
    try{
      const text=event.data?.text();
      if(text)payload.body=text
    }catch{}
  }

  event.waitUntil(
    self.registration.showNotification(payload.title||"KTAK",{
      body:payload.body||"你有一則新的任務訊息",
      icon:"./icon-192.png",
      badge:"./icon-192.png",
      tag:payload.tag||"ktak-chat",
      renotify:true,
      data:{url:payload.url||"./"},
      timestamp:Date.now()
    })
  )
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();

  const target=new URL(
    event.notification?.data?.url||"./",
    self.registration.scope
  ).href;

  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({
      type:"window",
      includeUncontrolled:true
    });

    for(const client of windows){
      if(client.url.startsWith(self.registration.scope)){
        try{
          if("navigate" in client&&client.url!==target)await client.navigate(target)
        }catch{}
        return await client.focus()
      }
    }

    if(self.clients.openWindow)return await self.clients.openWindow(target)
  })())
});
