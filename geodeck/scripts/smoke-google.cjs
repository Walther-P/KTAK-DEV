// Test unpublished files at the app's own authorized origin. Live external services are not mocked.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const engine=process.env.BROWSER_ENGINE||'chromium',browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/googleapis/.test(r.url()))api.push(r.url())});
 page.on('console',m=>{if(/Google Maps JavaScript API error/.test(m.text()))errors.push(m.text())});
 const base='https://walther-p.github.io/KTAK-DEV/';
 await page.route(base+'**',async route=>{
   const p=new URL(route.request().url()).pathname.replace('/KTAK-DEV/',''),file=path.resolve(p.endsWith('/')?p+'index.html':p);
   if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.continue();
   let body=fs.readFileSync(file);
   if(p==='geodeck/app.js')body=Buffer.from(body.toString().replace("$('mapState').classList.add('hidden');","globalThis.__testMap=state.map;$('mapState').classList.add('hidden');"));
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.gz':'application/gzip'}[path.extname(file)]||'application/octet-stream';
   await route.fulfill({status:200,contentType:type,body,headers:{'Cache-Control':'no-store'}});
 });
 try{
  await page.goto(base+'geodeck/');await page.locator('#mapState').waitFor({state:'hidden',timeout:35000});
  await page.evaluate(()=>{__testMap.panTo({lat:22.9915,lng:120.204});__testMap.setZoom(16)});
  await page.waitForTimeout(1000);
  const before=await page.evaluate(()=>{const p=__testMap.getCenter();return{lat:p.lat(),lng:p.lng(),zoom:__testMap.getZoom()}});
  await page.locator('#parking').click();await page.locator('.parking-pin').first().waitFor({timeout:25000});
  await page.waitForFunction(()=>document.getElementById('parkingMapStatus').textContent.includes('範圍內')&&!document.getElementById('parkingMapStatus').textContent.includes('更新車位中'),null,{timeout:30000});
  assert.equal(await page.locator('#panel').isVisible(),false);
  const after=await page.evaluate(()=>{const p=__testMap.getCenter();return{lat:p.lat(),lng:p.lng(),zoom:__testMap.getZoom()}});assert.deepEqual(after,before,'P must not move or zoom the viewport');
  const tainan=await page.locator('.parking-pin').allTextContents();assert.ok(tainan.length>0);
  await page.screenshot({path:`geodeck/qa/${engine}-google-parking.png`});
  const pin=page.locator('.parking-pin:not(.parking-cluster)').filter({hasText:/P \d/}).first();
  await pin.click({force:true});await page.getByRole('heading',{name:'計費方式',exact:true}).waitFor();
  await page.screenshot({path:`geodeck/qa/${engine}-google-detail.png`});
  await page.getByRole('button',{name:'返回停車地圖'}).click();assert.ok(await page.locator('.parking-pin').count()>0);
  await page.locator('#parking').click();assert.equal(await page.locator('.parking-pin').count(),0);
  await page.getByRole('searchbox').fill('22.9915,120.204');await page.getByRole('button',{name:'搜尋',exact:true}).click();
  await page.locator('.rain-amount').first().waitFor({timeout:25000});assert.match(await page.locator('.rain-amount').first().innerText(),/mm|未知/);
  await page.locator('.rain-amount').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:`geodeck/qa/${engine}-hourly-rain.png`});
  await page.getByRole('button',{name:'關閉面板'}).click();
  await page.evaluate(()=>{__testMap.panTo({lat:25.012,lng:121.465});__testMap.setZoom(17)});await page.waitForTimeout(1000);
  await page.locator('#parking').click();await page.waitForFunction(()=>document.querySelectorAll('.parking-pin.curb').length>0,null,{timeout:25000});
  await page.screenshot({path:`geodeck/qa/${engine}-ntpc-curb.png`});
  await page.locator('#showCurbParking').uncheck();assert.equal(await page.locator('.parking-pin.curb').count(),0);await page.locator('#showCurbParking').check();
  await page.evaluate(()=>{__testMap.panTo({lat:24.99,lng:121.305});__testMap.setZoom(16)});
  await page.waitForFunction(()=>document.querySelectorAll('.parking-pin.reported').length>0,null,{timeout:30000});
  await page.screenshot({path:`geodeck/qa/${engine}-taoyuan-report.png`});
  await page.locator('#parking').click();
  await page.getByRole('button',{name:'圖層',exact:true}).click();
  await page.locator('[data-layer=radar]').click();
  await page.waitForFunction(()=>!document.getElementById('radarControl').classList.contains('hidden'),null,{timeout:20000});
  await page.locator('[data-layer=camera]').click();
  await page.waitForFunction(()=>document.getElementById('layerBadges').textContent.includes('支 · 目錄'),null,{timeout:20000});
  await page.getByRole('button',{name:'關閉面板'}).click();
  await page.locator('#radarControl').waitFor({state:'visible',timeout:20000});
  await page.waitForFunction(()=>[...document.querySelectorAll('#map img')].some(img=>img.src.includes('rainviewer')&&img.complete&&img.naturalWidth>0),null,{timeout:25000});
  await page.screenshot({path:`geodeck/qa/${engine}-google-layers.png`});
  assert.equal(api.some(u=>/places.googleapis|routes.googleapis/.test(u)),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({engine,pass:true,googleMap:true,tainanPins:tainan.length,curb:true,taoyuanReports:true,hourlyRain:true,radarAndCameras:true,errors}));
 }catch(e){await page.screenshot({path:`geodeck/qa/${engine}-google-failure.png`});console.error(JSON.stringify({error:e.message,errors,body:(await page.locator('body').innerText()).slice(-2500)}));process.exitCode=1}
 finally{await browser.close()}
})();
