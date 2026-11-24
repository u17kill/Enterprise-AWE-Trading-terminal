import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.AWE_VERIFY_URL||'http://127.0.0.1:3129';
const pages=[['/news','市场新闻',8],['/voices','专家观点',7],['/research','机构研报',9],['/calendar','财经日历',12],['/holdings','大佬持仓',10]];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await mkdir('.local',{recursive:true});
 await page.goto(base+'/news');
 for(const [path,name,pane]of pages){
  await page.getByRole('navigation',{name:'市场情报页面'}).getByRole('link',{name,exact:true}).click();
  const frame=page.frameLocator('iframe');await frame.locator('#pane'+pane).waitFor({state:'visible'});await page.waitForTimeout(200);
  assert.equal(await page.locator('.intelligence-page-nav a').count(),5);
  for(const width of [1440,980,620,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
   const outer=await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);
   const inner=await frame.locator('body').evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);
   assert(outer[1]<=outer[0]+1,`${path} outer ${width}: ${outer}`);
   assert(inner[1]<=inner[0]+1,`${path} inner ${width}: ${inner}`);
   const title=await page.locator('main h1').boundingBox(),nav=await page.locator('.intelligence-page-nav').boundingBox();
   assert(title.y+title.height<=nav.y,'title must precede tabs');
   if(width===1440||width===390&&['/news','/holdings'].includes(path))await page.screenshot({path:`docs/v1.16-${path.slice(1)}-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});console.log(name,'responsive and title/tabs passed');
 }
 await page.getByRole('navigation',{name:'市场情报页面'}).getByRole('link',{name:'市场新闻',exact:true}).click();
 const frame=page.frameLocator('iframe');
 for(const status of [429,500]){
  await page.route('**/api/news/refresh',route=>route.fulfill({status,json:{ok:false,error:`verification-${status}`}}));
  const count=await frame.locator('.nwcard').count();await frame.locator('#nRefBtn').click();
  await frame.locator('#nStale').filter({hasText:`verification-${status}`}).waitFor();
  assert(await frame.locator('#nRefBtn').isEnabled());assert.equal(await frame.locator('.nwcard').count(),count);
  await page.unroute('**/api/news/refresh');
 }
 // Changing subpages replaces the history entry and legacy hashes still resolve.
 const oldHistory=await page.evaluate(()=>history.length);
 await page.getByRole('navigation',{name:'市场情报页面'}).getByRole('link',{name:'机构研报',exact:true}).click();
 assert.equal(await page.evaluate(()=>history.length),oldHistory);
 await page.goto(base+'/#wind');await page.waitForURL(base+'/voices');
 await page.goto(base+'/portfolio');
 assert.equal(await page.locator('.intelligence-page-nav').count(),0);
 assert(await page.getByRole('link',{name:'当前持仓',exact:true}).isVisible());
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 const response=await page.request.get(base+'/api/intelligence/export');assert.equal(response.status(),200);
 const html=await response.text();await writeFile('.local/v116-offline.html',html);
 assert(!/<(?:script[^>]+src|link[^>]+href)=?["']?https?:/i.test(html));
 const offline=await browser.newPage({viewport:{width:1440,height:1000}}),offErrors=[];
 offline.on('pageerror',e=>offErrors.push(e.message));
 await offline.goto(new URL('../.local/v116-offline.html',import.meta.url).href);
 assert.equal(await offline.locator('[data-offline-page]').count(),6);
 for(const name of ['专家观点','机构研报','财经日历','大佬持仓','当前持仓'])await offline.getByRole('button',{name,exact:true}).click();
 await offline.locator('#pmSeg2 button[data-m="sat"]').click();
 await offline.locator('#pmGrid .pmt').first().click();await offline.locator('#pmAmt').fill('1.234k');await offline.locator('#pmSave2').click();
 assert((await offline.locator('#pmSave').textContent()).includes('只在本机'));
 const draft=await offline.evaluate(()=>JSON.parse(localStorage.getItem('pmx_map_v1')));
 assert.equal(draft.data.currency,'USD');assert(draft.data.items.some(i=>i.amount==='1.234k'));
 await offline.reload();await offline.getByRole('button',{name:'当前持仓',exact:true}).click();
 assert(await offline.evaluate(()=>pmBook.sat.items.some(i=>i.amount==='1.234k')));
 await offline.locator('#pmSeg2 button[data-m="core"]').click();
 assert.equal(await offline.evaluate(()=>pmPure(pmBook.core).currency),'CNY');
 assert((await offline.locator('#pmcSave').textContent()).includes('只在本机'));
 // Imported satellite data must survive a round trip through total view.
 await offline.locator('#pmSeg2 button[data-m="sat"]').click();
 offline.once('dialog',dialog=>dialog.accept());
 await offline.evaluate(()=>{const imported=structuredClone(pmBook.sat);imported.items[0].amount='2.345k';pmImportText(JSON.stringify(imported));});
 await offline.locator('#pmSeg2 button[data-m="total"]').click();
 await offline.locator('#pmSeg2 button[data-m="sat"]').click();
 assert(await offline.evaluate(()=>pmBook.sat.items[0].amount==='2.345k'));
 assert((await offline.locator('#pmSave').textContent()).includes('只在本机'));
 await offline.reload();await offline.getByRole('button',{name:'当前持仓',exact:true}).click();
 await offline.locator('#offline-portfolio-conflicts').waitFor({state:'visible'});
 assert((await offline.locator('#offline-portfolio-conflicts').textContent()).includes('浏览器草稿与本文件快照不同'));
 assert.deepEqual(offErrors,[]);await offline.close();assert.deepEqual(errors,[]);
 console.log('Failure recovery, replace navigation, hashes, portfolio scope and offline six-page editing passed');
}finally{await browser.close();}
