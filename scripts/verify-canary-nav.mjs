import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.env.AWE_VERIFY_URL||'http://127.0.0.1:3128';
const paths=['/canary','/canary/direction','/canary/momentum','/canary/valuation','/canary/cn-radar','/canary/us-radar','/canary/hk','/canary/apac'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+paths[0]);
 for(const path of [...paths,paths[0]]){
  const nav=page.locator('.canary-page-nav');
  await nav.locator(`a[href="${path}"]`).click();
  await page.waitForURL(base+path);
  await nav.locator(`a[href="${path}"][aria-current="page"]`).waitFor();
  assert.equal(await page.locator('main .topbar').count(),0,`${path}: no separate workspace header`);
  assert.equal(await nav.locator('a').count(),8);
  assert.equal(await nav.locator('[aria-current="page"]').count(),1);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   const size=await nav.evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,viewport:innerWidth}));
   assert(size.scroll<=size.width+1,JSON.stringify({path,...size}));
   assert(size.left>=0&&size.right<=size.viewport+1,JSON.stringify({path,...size}));
   const title=await page.locator('main h1').boundingBox();
   const tabs=await nav.boundingBox();
   assert(title&&tabs&&title.y+title.height<=tabs.y,`${path}: page title must be above tabs at ${width}px`);
  }
  await page.setViewportSize({width:1440,height:1000});
  console.log(path,'eight links, unique active state, desktop/mobile passed');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
