// Checks the real parking -> verified camera -> original parking navigation flow.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const engine=process.env.BROWSER_ENGINE||'chromium',browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const base='https://walther-p.github.io/KTAK-DEV/';
 await page.route(base+'**',async route=>{
  const p=new URL(route.request().url()).pathname.replace('/KTAK-DEV/','');
  if(process.env.LIVE_SITE==='1'){
   if(p!=='geodeck/app.js')return route.continue();
   const r=await route.fetch();return route.fulfill({response:r,body:(await r.text()).replace("$('mapState').classList.add('hidden');","globalThis.__testMap=state.map;$('mapState').classList.add('hidden');")});
  }
  const file=path.resolve(p.endsWith('/')?p+'index.html':p);
  if(!file.startsWith(process.cwd()+path.sep)||!fs.existsSync(file))return route.continue();
  let body=fs.readFileSync(file);if(p==='geodeck/app.js')body=Buffer.from(body.toString().replace("$('mapState').classList.add('hidden');","globalThis.__testMap=state.map;$('mapState').classList.add('hidden');"));
  const contentType={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.gz':'application/gzip'}[path.extname(file)]||'application/octet-stream';
  return route.fulfill({body,contentType,headers:{'Cache-Control':'no-store'}});
 });
 try{
  await page.goto(base+'geodeck/?lat=25.17&lng=121.561&name=原目的地');
  await page.locator('#mapState').waitFor({state:'hidden',timeout:35000});
  assert.equal(await page.locator('meta[name=geodeck-version]').getAttribute('content'),require('../package.json').version);
  await page.getByRole('button',{name:'關閉面板'}).click();
  await page.evaluate(()=>{__testMap.panTo({lat:25.1657,lng:121.5636});__testMap.setZoom(19)});await page.waitForTimeout(800);
  await page.locator('#parking').click();
  const pin=page.locator('.parking-pin:not(.parking-cluster)[title^="歐特儀股份有限公司冷水坑1號停車場"]');
  await pin.waitFor({timeout:25000});await pin.click({force:true});
  await page.locator('#viewParkingCameras').waitFor({timeout:25000});assert.match(await page.locator('#viewParkingCameras').innerText(),/入口/);
  await page.screenshot({path:`geodeck/qa/${engine}-parking-verified-camera.png`});
  await page.locator('#viewParkingCameras').click();
  await page.waitForFunction(()=>document.querySelector('#cameraFrame img')?.naturalWidth>0,null,{timeout:20000});
  assert.match(await page.locator('#panelBody').innerText(),/拍攝範圍：入口/);
  assert.match(await page.getByRole('link',{name:'在原站觀看 ↗'}).getAttribute('href'),/ymsnp.gov.tw/);
  await page.screenshot({path:`geodeck/qa/${engine}-parking-camera-view.png`});
  await page.locator('#backToParkingDetails').click();assert.match(await page.locator('#panelTitle').innerText(),/冷水坑1號停車場/);
  await page.locator('#viewParkingCameras').click();await page.locator('#cameraParkingRoute').click();
  await page.locator('#openNavigation').waitFor({timeout:15000});
  const destination=new URL(await page.locator('#openNavigation').getAttribute('href')).searchParams.get('destination');
  assert.equal(destination,'25.1657,121.5636');assert.match(await page.locator('#panelBody').innerText(),/原目的地：原目的地/);
  await page.getByRole('button',{name:'關閉面板'}).click();
  await page.evaluate(()=>{__testMap.panTo({lat:22.998839,lng:120.244329});__testMap.setZoom(19)});await page.waitForTimeout(800);
  await page.locator('#parking').click();
  const unverified=page.locator('.parking-pin:not(.parking-cluster)[title^="復興路停車場"]');await unverified.waitFor({timeout:25000});await unverified.click({force:true});
  await page.getByText('附近無拍攝監視器',{exact:true}).waitFor();assert.equal(await page.locator('#viewParkingCameras').count(),0);
  await page.screenshot({path:`geodeck/qa/${engine}-parking-no-verified-camera.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,live:process.env.LIVE_SITE==='1',pass:true,verifiedEntrance:true,imageLoaded:true,unverifiedRoadCameraExcluded:true,parkingDestinationPreserved:true,errors}));
 }catch(e){await page.screenshot({path:`geodeck/qa/${engine}-parking-camera-failure.png`});console.error(JSON.stringify({error:e.message,errors,body:(await page.locator('body').innerText()).slice(-3000)}));process.exitCode=1}
 finally{await browser.close()}
})();
