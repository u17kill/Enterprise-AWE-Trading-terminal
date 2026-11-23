import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const routes=['/','/canary','/canary/direction','/canary/momentum','/canary/valuation','/canary/cn-radar','/canary/us-radar','/canary/hk','/canary/apac','/news','/voices','/calendar','/holdings','/research','/chart/SPX','/portfolio','/options','/framework','/philosophy','/charter'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [1440,1024,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  for(const route of routes){
   const response=await page.goto('http://127.0.0.1:'+(process.env.AWE_UI_PORT||'3111')+route,{waitUntil:'domcontentloaded'});
   assert.equal(response?.status(),200,`${route} at ${width}`);
   const state=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,window:innerWidth,headings:document.querySelectorAll('h1').length}));
   assert.ok(state.scroll<=state.window+2,`${route} at ${width}: overflow ${state.scroll}-${state.window}`);
   assert.ok(state.headings>=1,`${route} at ${width}: missing heading`);
   if(width===1440&&['/','/canary/momentum','/portfolio','/research','/chart/SPX'].includes(route))await page.screenshot({path:`docs/v1.12-${route==='/'?'dashboard':route.slice(1).replaceAll('/','-')}-1440.png`});
   if(width===390&&['/','/portfolio','/calendar'].includes(route))await page.screenshot({path:`docs/v1.12-${route==='/'?'dashboard':route.slice(1)}-390.png`});
  }
  await page.close();
 }
 console.log('PASS: 16 routes × 3 widths; no page overflow; each has a heading');
}finally{await browser.close();}
