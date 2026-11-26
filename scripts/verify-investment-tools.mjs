import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const base=process.env.AWE_VERIFY_URL||'http://127.0.0.1:3128';
const pages=[['/options','期权计算'],['/portfolio','当前持仓'],['/chart/SPX','图表空间']];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],headerStyles=new Map();
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/options');
 for(const [path,name]of pages){
  await page.getByRole('navigation',{name:'投资工具页面'}).getByRole('link',{name,exact:true}).click();
  await page.waitForURL(base+path);
  assert.equal(await page.locator('.app-sidebar').count(),1);
  assert.equal(await page.locator('.topbar,.workspace-topbar').count(),0);
  assert.equal(await page.locator('.options-hero').count(),0,'options must not retain an independent decorative title card');
  assert.equal(await page.locator('.tools-page-nav a').count(),3);
  assert.equal(await page.locator('.tools-page-nav [aria-current="page"]').count(),1);
  assert.equal(await page.getByRole('button',{name:/投资工具/}).getAttribute('aria-expanded'),'true');
  if(path==='/portfolio'){
   const views=page.getByRole('navigation',{name:'持仓视图'});
   const selected=await views.locator('[aria-pressed="true"]').evaluate(b=>getComputedStyle(b).backgroundColor);
   const other=await views.locator('[aria-pressed="false"]').first().evaluate(b=>getComputedStyle(b).backgroundColor);
   assert.notEqual(selected,other,'current portfolio view retains a visible selected state');
  }
  for(const width of [1440,1024,620,390]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} overflow at ${width}`);
   const h=await page.locator('main h1').boundingBox(),nav=await page.locator('.tools-page-nav').boundingBox();
   assert(h&&nav&&h.y+h.height<=nav.y,'title must precede tool navigation');
   const styles=await page.locator('.tools-page-heading').evaluate(header=>{
    const css=getComputedStyle(header),title=getComputedStyle(header.querySelector('h1')),description=getComputedStyle(header.querySelector('p')),content=getComputedStyle(header.closest('.tools-page-content'));
    return {background:css.backgroundImage,color:css.backgroundColor,border:css.borderWidth,radius:css.borderRadius,shadow:css.boxShadow,padding:css.padding,titleSize:title.fontSize,titleLine:title.lineHeight,titleMargin:title.margin,descriptionSize:description.fontSize,descriptionLine:description.lineHeight,contentPadding:content.padding};
   });
   if(headerStyles.has(width))assert.deepEqual(styles,headerStyles.get(width),`${path}: header styling must match the other tools at ${width}px`);
   else headerStyles.set(width,styles);
   if(path.startsWith('/chart/')){
    const chart=await page.getByTestId('candlestick-chart').boundingBox();
    assert(chart&&chart.width>200&&chart.x+chart.width<=width+1,'chart fits the tool page');
   }
   if(width===1440||width===390)await page.screenshot({path:`docs/v1.16-tools-${name==='图表空间'?'chart':path.slice(1)}-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});console.log(name,'shared navigation, no old header and four widths passed');
 }
 await page.goto(base+'/chart/AAPL');
 await page.getByRole('heading',{name:'图表空间',exact:true}).waitFor();
 assert.equal(await page.locator('.tools-page-nav [aria-current="page"]').getAttribute('href'),'/chart/AAPL');
 assert(await page.getByRole('button',{name:'更新当前页面数据'}).isVisible());
 assert(await page.locator('main .workspace-return').isVisible());
 assert.deepEqual(errors,[]);
 console.log('Stock chart route, refresh control and dashboard return retained');
}finally{await browser.close();}
