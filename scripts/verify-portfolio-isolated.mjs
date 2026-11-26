import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.env.AWE_VERIFY_URL||'http://127.0.0.1:3128';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();
 const core=await(await page.request.get(base+'/api/core')).json(),sat=await(await page.request.get(base+'/api/portfolio')).json();
 const coreDraft=structuredClone(core.matrix),satDraft=structuredClone(sat.matrix);
 coreDraft.funds[0].note+=' · 隔离浏览器验证';satDraft.items[0].amount='2.222k';
 await page.addInitScript(({coreDraft,satDraft})=>{
  localStorage.setItem('pmx_core_v2',JSON.stringify({matrix:coreDraft,revision:'old',dirty:true}));
  localStorage.setItem('pmx_map_v1',JSON.stringify({savedAt:'2020-01-01',data:satDraft}));
 },{coreDraft,satDraft});
 const writes=[];
 // Never allow this verification to change real source files.
 for(const endpoint of ['/api/core','/api/portfolio'])await page.route('**'+endpoint,async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  const body=route.request().postDataJSON();writes.push({endpoint,body});
  await route.fulfill({json:{ok:true,matrix:body.matrix,revision:'mock-saved',as_of:new Date().toISOString(),backup:'mock-backup.json'}});
 });
 await page.goto(base+'/portfolio');
 const coreConflict=page.locator('.pb-warning').filter({hasText:'核心仓文件与本机草稿不同'}),satConflict=page.locator('.pb-warning').filter({hasText:'卫星仓文件与本机草稿不同'});
 await coreConflict.waitFor();await satConflict.waitFor();
 await coreConflict.getByRole('button',{name:'用文件覆盖本机'}).click();
 assert(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('pmx_core_v2.backup.'))));
 await satConflict.getByRole('button',{name:'用本机覆盖文件'}).click();
 await page.getByRole('navigation',{name:'持仓视图'}).getByRole('button',{name:'核心仓',exact:true}).click();
 await page.waitForTimeout(800);
 assert.equal(writes.length,1);assert.equal(writes[0].endpoint,'/api/portfolio');
 assert.equal(writes[0].body.matrix.items[0].amount,'2.222k');assert.equal(writes[0].body.revision,sat.revision);
 const afterCore=await(await page.request.get(base+'/api/core')).json(),afterSat=await(await page.request.get(base+'/api/portfolio')).json();
 assert.equal(afterCore.revision,core.revision);assert.equal(afterSat.revision,sat.revision);
 console.log('Both-book conflicts, draft backup, captured save target and unchanged real source files passed');
}finally{await browser.close();}
