import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:3108/portfolio');
 await page.getByRole('heading',{name:'¥819.7万',exact:true}).waitFor();
 await page.screenshot({path:'docs/v1.11-total-preview.png'});
 await page.getByRole('button',{name:'核心仓',exact:true}).click();
 await page.getByRole('heading',{name:'黑翼多策略 · 编辑'}).waitFor();
 await page.screenshot({path:'docs/v1.11-core-preview.png'});
 await page.getByRole('button',{name:'卫星仓',exact:true}).click();
 await page.locator('.pb-tile').filter({hasText:'NVDA'}).click();
 await page.getByLabel('金额备注（美元 k）').fill('99k');
 // Intercept all writes so this browser test never changes personal data files.
 await page.route('**/api/portfolio',async route=>{
  if(route.request().method()==='POST')return route.fulfill({json:{ok:true,matrix:route.request().postDataJSON().matrix,revision:'test-only',as_of:new Date().toISOString()}});
  return route.continue();
 });
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await page.getByRole('button',{name:'总仓',exact:true}).click();
 await page.getByRole('heading',{name:'¥882.3万',exact:true}).waitFor();
 const mobile=await browser.newPage({viewport:{width:390,height:900}});
 await mobile.goto('http://127.0.0.1:3108/portfolio');
 const size=await mobile.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.equal(size[0],size[1]);
 await mobile.screenshot({path:'docs/v1.11-mobile-preview.png'});
 for(const name of ['核心仓','卫星仓']){await mobile.getByRole('button',{name,exact:true}).click();const dims=await mobile.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.equal(dims[0],dims[1]);}
 console.log('PASS: three views; 9.5k → 99k gives ¥882.3万; 390px no page overflow; no personal-data writes');
}finally{await browser.close();}
