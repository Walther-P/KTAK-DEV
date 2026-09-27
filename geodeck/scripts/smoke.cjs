// Run against scripts/preview.mjs. Uses real public services; never ships mock data.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  fs.mkdirSync('geodeck/qa',{recursive:true});
  const engine=process.env.BROWSER_ENGINE||'chromium';
  const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  page.on('console',m=>{if(m.text().startsWith('GeoDeck parking:'))console.log(m.text())});
  try{
    await page.goto('http://127.0.0.1:4173/geodeck/');
    await page.locator('#mapState').waitFor({state:'hidden',timeout:35000});
    await page.screenshot({path:`geodeck/qa/${engine}-map.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('searchbox').fill('22.9915,120.204');await page.getByRole('button',{name:'搜尋',exact:true}).click();
    await page.getByRole('button',{name:'↗ 前往這裡',exact:true}).click();
    await page.locator('#openNavigation').waitFor({timeout:25000});
    assert.match(await page.locator('#openNavigation').getAttribute('href'),/google.com\/maps\/dir/);
    await page.getByRole('button',{name:'大眾運輸',exact:true}).click();
    assert.match(await page.locator('#openNavigation').getAttribute('href'),/travelmode=transit/);
    await page.getByRole('button',{name:'查看目的地附近停車'}).click();
    await page.locator('[data-parking-route]').first().waitFor({timeout:25000});
    const parkingText=await page.locator('#parkingResults').innerText();
    await page.screenshot({path:`geodeck/qa/${engine}-parking.png`});
    await page.locator('[data-parking-route]').first().click();
    await page.locator('#openNavigation').waitFor({timeout:25000});
    assert.match(await page.locator('.journey-card').innerText(),/原目的地/);
    await page.getByRole('button',{name:'已停好，記住此車位'}).click();
    await page.getByRole('button',{name:'走回車位'}).click();
    await page.locator('#openNavigation').waitFor();
    assert.match(await page.locator('#openNavigation').getAttribute('href'),/travelmode=walking/);
    await page.goto('http://127.0.0.1:4173/geodeck/?lat=37.5665&lng=126.978&name=Seoul');
    await page.locator('#mapState').waitFor({state:'hidden',timeout:35000});
    await page.getByRole('button',{name:'↗ 前往這裡',exact:true}).click();
    await page.locator('#openNavigation').waitFor({timeout:25000});
    assert.match(await page.locator('#openNavigation').getAttribute('href'),/^nmap:\/\//);
    assert.equal(await page.locator('.journey-card').count(),0,'A different destination must not show the previous parking trip');
    await page.getByRole('button',{name:'大眾運輸',exact:true}).click();
    assert.match(await page.locator('#openNavigation').getAttribute('href'),/^nmap:\/\/route\/public/);
    await page.screenshot({path:`geodeck/qa/${engine}-naver.png`});
    await page.locator('#destinationQuery').fill('changed destination');
    assert.equal(await page.locator('#openNavigation').count(),0);
    await page.locator('#navigationProvider').selectOption('google');
    assert.equal(await page.locator('#openNavigation').count(),0);
    assert.equal(requests.some(u=>/maps\.googleapis\.com|places\.googleapis\.com|routes\.googleapis\.com/.test(u)),false);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({engine,pass:true,parkingLive:!parkingText.includes('即時車位資料暫時無法取得'),parkingCards:parkingText.includes('前往此停車場'),googleApiCalls:0,errors},null,2));
  }catch(error){await page.screenshot({path:`geodeck/qa/${engine}-failure.png`});console.error(JSON.stringify({error:error.message,pageErrors:errors,body:(await page.locator('body').innerText()).slice(-4000)}));process.exitCode=1}
  finally{await browser.close()}
})();
