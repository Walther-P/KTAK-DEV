const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto((process.env.GEODECK_URL||'https://walther-p.github.io/KTAK-DEV/geodeck/')+'?lat=22.9915&lng=120.204&name=offline-check');
  assert.equal(await page.locator('meta[name=geodeck-version]').getAttribute('content'),require('../package.json').version);
  await page.locator('#mapState').waitFor({state:'hidden',timeout:35000});
  await page.getByRole('button',{name:'☆ 收藏',exact:true}).click();
  await page.locator('#savedName').fill('離線驗證地點');await page.locator('#savedNote').fill('備註保留');
  await page.getByRole('button',{name:'儲存收藏'}).click();
  await page.getByRole('button',{name:'關閉面板'}).click();
  await page.getByRole('button',{name:'圖層',exact:true}).click();
  await page.locator('[data-layer=radar]').click();
  await page.locator('#radarControl').waitFor({state:'visible',timeout:20000});
  assert.match(await page.locator('#radarTime').innerText(),/雷達回波/);
  await page.locator('[data-layer=camera]').click();
  await page.waitForFunction(()=>document.getElementById('layerBadges').textContent.includes('支 · 目錄'),null,{timeout:20000});
  await page.screenshot({path:'geodeck/qa/desktop-layers.png'});
  await page.locator('[data-layer=radar]').click();await page.locator('[data-layer=camera]').click();
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.locator('#mapState').waitFor({state:'hidden',timeout:35000});
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'收藏',exact:true}).click();
  await page.getByRole('button',{name:'離線驗證地點',exact:true}).waitFor();
  assert.match(await page.locator('#panelBody').innerText(),/備註保留/);
  assert.equal(await page.locator('#offlineBanner').isVisible(),true);
  await page.screenshot({path:'geodeck/qa/offline-favorites.png'});
  assert.deepEqual(errors,[]);console.log('PASS: live radar + camera layers, desktop, installed PWA offline favorites/notes');
 }catch(e){console.error(e.message,errors);await page.screenshot({path:'geodeck/qa/offline-failure.png'});process.exitCode=1}
 finally{await browser.close()}
})();
