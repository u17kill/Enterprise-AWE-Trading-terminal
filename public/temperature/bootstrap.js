/* Only the six temperature panes are mounted. Network/state belongs to the host. */
const viewState=JSON.parse(document.getElementById('temperature-snapshot').textContent);
for(let i=1;i<=6;i++)document.getElementById('pane'+i).style.display=i===viewState.pane?'':'none';
try{cur=localStorage.getItem('awe.temperature.instrument')||'';vcur=localStorage.getItem('awe.temperature.valuation.instrument')||'';}catch{}
function safeRender(fn){try{fn();}catch(error){const alert=document.createElement('div');alert.className='temperature-warning';alert.textContent='本区暂未完成渲染：'+error.message;document.getElementById('pane'+viewState.pane).prepend(alert);console.error(error);}}
safeRender(renderAll);
if(viewState.pane===3)safeRender(renderSenti);
if(viewState.pane===4)safeRender(renderUS);
if(viewState.pane===5)safeRender(renderHK);
if(viewState.pane===6)safeRender(renderAP);
document.getElementById('tabs').addEventListener('click',()=>{try{localStorage.setItem('awe.temperature.instrument',cur);}catch{}});
document.getElementById('vtabs').addEventListener('click',()=>{try{localStorage.setItem('awe.temperature.valuation.instrument',vcur);}catch{}});
document.getElementById('apBody').addEventListener('click',event=>{const b=event.target.closest('#apSw button');if(!b)return;apB=b.dataset.b;for(const child of b.parentNode.children)child.classList.toggle('on',child===b);renderAPCharts();});
function resizeCharts(){for(const element of document.querySelectorAll('[_echarts_instance_]')){const instance=echarts.getInstanceByDom(element);if(instance)instance.resize();}}
window.addEventListener('resize',resizeCharts);setTimeout(resizeCharts,50);
if(viewState.pane===5&&HKS&&HKS.short&&!HKS.short.n){const note=document.createElement('div');note.className='temperature-warning';note.textContent='沽空读数未取到：接口批次成功不代表取得有效读数，不能解释为没有沽空。';document.getElementById('hkBody').prepend(note);}
if(viewState.pane===3&&SEN){const note=document.createElement('div');note.className='temperature-note';note.textContent='板块为实时榜，抓取于 '+(SEN.sector_fetched_at||SEN.generated||'未标注')+'，与复盘交易日 '+SEN.date+' 分开观察。';document.getElementById('sentiBody').prepend(note);}
function escapePayload(value){if(typeof value==='string')return value.replace(/[&<>"'`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));if(Array.isArray(value))return value.map(escapePayload);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,escapePayload(v)]));return value;}
window.addEventListener('message',event=>{
 if((event.origin!==location.origin&&!(location.protocol==='file:'&&event.source===window))||event.source!==parent||event.data?.type!=='temperature-data')return;
 const kinds=['momentum','valuation','cn','us','hk','apac'],kind=event.data.kind,index=kinds.indexOf(kind);if(index<0)return;
 const value=event.data.data===undefined?undefined:escapePayload(event.data.data);
 if(value!==undefined){if(kind==='momentum')DATA=value||{};if(kind==='valuation')VAL=value;if(kind==='cn')SEN=value;if(kind==='us')USS=value;if(kind==='hk')HKS=value;if(kind==='apac')HKA=value;}
 viewState.kind=kind;viewState.pane=index+1;
 for(let i=1;i<=6;i++)document.getElementById('pane'+i).style.display=i===index+1?'':'none';
 safeRender(kind==='momentum'||kind==='valuation'?renderAll:kind==='cn'?renderSenti:kind==='us'?renderUS:kind==='hk'?renderHK:renderAP);
 if(kind==='hk'&&HKS?.short&&!HKS.short.n){const note=document.createElement('div');note.className='temperature-warning';note.textContent='本次未取到沽空读数，不能解释为没有沽空。';document.getElementById('hkBody').prepend(note);}
 if(kind==='cn'&&SEN){const note=document.createElement('div');note.className='temperature-note';note.textContent='板块实时榜 · 抓取于 '+(SEN.sector_fetched_at||SEN.generated||'未标注')+'，不继承复盘日 '+SEN.date;document.getElementById('sentiBody').prepend(note);}
 setTimeout(resizeCharts,0);
});

document.getElementById('sentiBody').addEventListener('click',event=>{const button=event.target.closest('#stabs button');if(!button)return;sKind=button.dataset.k;safeRender(renderSenti);resizeCharts();});
