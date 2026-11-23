import {chromium} from 'playwright-core';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.AWE_VERIFY_URL||'http://127.0.0.1:3128';
const pages=[['momentum','动能分析'],['valuation','估值分位'],['cn-radar','A股雷达'],['us-radar','美股雷达'],['hk','港股全景'],['apac','亚太温度']];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('.local',{recursive:true});
 await page.goto(base+'/canary/momentum');
 await page.frameLocator('iframe').locator('#cards .card').first().waitFor();
 for(const [slug,name]of pages){
  await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name,exact:true}).click();
  const pane=pages.findIndex(p=>p[0]===slug)+1;
  const frame=page.frameLocator('iframe');await frame.locator('#pane'+pane).waitFor({state:'visible'});await page.waitForTimeout(500);
  assert.equal(await frame.locator('.temperature-warning').filter({hasText:'渲染'}).count(),0);
  for(const width of [1440,620,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
   const sizes=await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);
   const inside=await frame.locator('body').evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);
   assert(sizes[1]<=sizes[0]+1,`${slug} outer overflow ${sizes}`);
   assert(inside[1]<=inside[0]+1,`${slug} inner overflow ${inside}`);
   if(width===1440||width===390&&['momentum','hk'].includes(slug))await page.screenshot({path:`docs/v1.15-${slug}-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  console.log(name,'layout and charts ok');
 }
 // Industry/concept switch and benchmark control must select real data.
 await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name:'A股雷达',exact:true}).click();
 const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'概念板块',exact:true}).click();
 assert.equal(await frame.getByRole('button',{name:'概念板块',exact:true}).getAttribute('class'),'on');
 await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name:'亚太温度',exact:true}).click();
 await frame.getByRole('button',{name:'vs 沪深300',exact:true}).click();
 await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name:'美股雷达',exact:true}).click();
 await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name:'亚太温度',exact:true}).click();
 assert.equal(await frame.getByRole('button',{name:'vs 沪深300',exact:true}).getAttribute('class'),'on');
 // An earlier page finishing must not navigate the document back.
 const cached=await (await page.request.get(base+'/api/temperature/momentum')).json();
 await page.route('**/api/temperature/momentum',async route=>{if(route.request().method()==='POST'){await new Promise(r=>setTimeout(r,1000));await route.fulfill({json:cached});}else await route.continue();});
 await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name:'动能分析',exact:true}).click();
 await page.getByRole('button',{name:'刷新动能分析',exact:true}).click();
 await page.getByRole('navigation',{name:'温度研究页面'}).getByRole('link',{name:'估值分位',exact:true}).click();await page.waitForTimeout(1600);
 assert(await frame.locator('#pane2').isVisible(),'background refresh switched active page');
 await page.unroute('**/api/temperature/momentum');
 // Failed/busy refreshes release the button and retain the visible snapshot.
 for(const status of [429,500]){
  await page.route('**/api/temperature/valuation',async route=>{if(route.request().method()==='POST')await route.fulfill({status,json:{ok:false,error:`verification-${status}`}});else await route.continue();});
  await page.getByRole('button',{name:'刷新估值分位',exact:true}).click();
  await page.getByRole('alert').filter({hasText:`verification-${status}`}).waitFor();
  assert(await page.getByRole('button',{name:'刷新估值分位',exact:true}).isEnabled());
  assert(await frame.locator('#pane2').isVisible());
  await page.unroute('**/api/temperature/valuation');
 }
 // Offline export contains no runtime network dependency and handles refresh explicitly.
 const exported=await page.request.get(base+'/api/temperature/export');assert.equal(exported.status(),200);
 const html=await exported.text();await writeFile('.local/temperature-offline.html',html);
 const offline=await browser.newPage();const offlineErrors=[];offline.on('pageerror',e=>offlineErrors.push(e.message));
 await offline.goto(new URL('../.local/temperature-offline.html',import.meta.url).href);
 await offline.getByRole('button',{name:'港股全景',exact:true}).click();await offline.locator('#pane5').waitFor({state:'visible'});
 let dialogSeen=false;offline.once('dialog',async dialog=>{dialogSeen=dialog.message().includes('离线');await dialog.accept();});await offline.locator('#hBtn').click();assert(dialogSeen);
 assert.equal(offlineErrors.length,0,offlineErrors.join('\n'));await offline.close();
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Concept/benchmark switches, background refresh, offline export: passed');
}finally{await browser.close();}
