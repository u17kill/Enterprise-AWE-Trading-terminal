const VER = /*__VER__*/"";
const BUILT = /*__BUILT__*/"";
let DATA = JSON.parse(document.getElementById('temperature-snapshot').textContent).payload.momentum || {};
let VAL = JSON.parse(document.getElementById('temperature-snapshot').textContent).payload.valuation;
let SEN = JSON.parse(document.getElementById('temperature-snapshot').textContent).payload.cn;
let USS = JSON.parse(document.getElementById('temperature-snapshot').textContent).payload.us;
let HKS = JSON.parse(document.getElementById('temperature-snapshot').textContent).payload.hk;
let HKA = JSON.parse(document.getElementById('temperature-snapshot').textContent).payload.apac;
let MKT = /*__MARKET__*/null;
let WIND = /*__WIND__*/null;
let NEWS = /*__NEWS__*/null;
let RPT = /*__RPT__*/null;
let CAL = /*__CAL__*/null;
let sKind = "industry";
let schart = null;
let schartDom = null;

const CLS = {"极端超卖":"#1f6feb","警戒超卖":"#6aa9f0","正常":"#b4b2a9","警戒超买":"#e08b3a","极端超买":"#d64545"};
function tagClass(b){
  if(b==="极端超卖")return "t-os2";
  if(b==="警戒超卖")return "t-os1";
  if(b==="正常")return "t-neu";
  if(b==="警戒超买")return "t-ob1";
  return "t-ob2";
}
function barColor(v){
  if(v<=15)return "#1f6feb";
  if(v<=30)return "#6aa9f0";
  if(v<=70)return "#b4b2a9";
  if(v<=85)return "#e08b3a";
  return "#d64545";
}
let KEYS=[], VKEYS=[], cur="", vcur="";

const SAY={
  pos:v=> v<=10?"价格被压到近一年最低区，远离平均成本":
         v<=30?"价格低于平均成本，但还没到极端":
         v<=70?"价格大致贴着平均成本，不偏不倚":
         v<=90?"价格明显高于平均成本":
                "价格冲到近一年最贵区，离平均成本很远",
  crowd:v=> v<=15?"交易极冷清：没什么人关注，波动也小":
           v<=35?"交易偏清淡，注意力份额不高":
           v<=60?"交易强度正常，跟平时差不多":
           v<=85?"资金扎堆：成交占比和波动同时抬升":
                  "交易非常激烈：成交占比高、上下剧烈震荡",
  mom:v=> v<=15?"还在往下砸，而且速度不慢":
        v<=35?"还在往下走，但力道在减弱":
        v<=65?"基本走平，横着":
        v<=85?"在往上走，力道不弱":
               "往上冲得很猛，还在加速"
};
function combo(p,c,m){
  if(p<=30&&m<=30&&c<=40)return "跌得深、交易也冷清了、还在往下走 —— 超跌，但下跌还没止住";
  if(p<=30&&m<=30&&c>=60)return "跌得深、交易却很激烈、还在往下走 —— 放量下跌，抛压在集中释放";
  if(p<=30&&m<=30)return "跌得深、还在往下走 —— 超跌，但下跌还没止住";
  if(p<=30&&c<=40&&m>=60)return "跌得深、交易冷清、但下跌已经刹住 —— 底部区域常见的形态";
  if(p<=30&&m>=60)return "跌得深、但下跌已经刹住 —— 止跌迹象出现，还需后续确认";
  if(p<=30&&c>=60)return "跌得深，但交易非常激烈 —— 恐慌性放量杀跌，抛压在集中释放，常见于阶段性底部附近";
  if(p<=30&&m<60)return "价格已在历史低位区，但下跌劲头不强 —— 横着磨底，方向还没选出来";
  if(p>=70&&c>=60&&m>=60)return "涨得多、交易火爆、还在加速 —— 过热，短期风险最大";
  if(p>=70&&m<=40)return "位置还很高但劲头没了 —— 强弩之末";
  if(p>=70&&c<=40)return "价格高但交易清淡 —— 缩量上行，缺后续动力";
  if(p>=70)return "位置偏高，拥挤与动能都处在中间地带 —— 偏热但没有加速";
  if(m<=15&&p>30)return "位置不算极端，但在快速下滑 —— 下跌刚开始";
  return "没有明显极端信号，处在常态波动中";
}

/* ================= 第一页 ================= */
function renderMeta(){
  const d=DATA[KEYS[0]], L=d.last;
  document.getElementById("metaLine").textContent =
    "样本区间以 " + KEYS[0] + " 为准 " + d.start + " ~ " + d.end + " ｜ 有效交易日 " + d.n + " 个 ｜ 各卡片单独标注截止日（美股与 A 股交易时段不同）";
  document.getElementById("scaleDesc").innerHTML = "总分为分位分项的加权合成与3日EMA，不等于总分自身的历史排名。各卡片的历史排名另按完整样本中低于当前总分的交易日比例计算。高低描述状态，不预测后续涨跌。";
}

function renderCards(){
  document.getElementById("cards").innerHTML = KEYS.map(k=>{
    const d=DATA[k], L=d.last;
    const mods=[["位置",L.s_pos,"pos"],["拥挤",L.s_crowd,"crowd"],["动能",L.s_mom,"mom"]];
    return `<div class="card">
      <div class="card-h"><span class="nm">${k}</span><span class="dt">${L.close.toFixed(2)}${PROXY[k]?`<span style="font-size:9.5px;color:#b4b2a9;margin-left:4px">${PROXY[k]}</span>`:""}</span></div>
      <div class="score-row">
        <span class="score" style="color:${barColor(L.score)}">${L.score.toFixed(1)}</span>
        <span class="tag ${tagClass(L.bk)}">${L.bk}</span>
      </div>
      <div class="rank">截至 ${L.date} ｜ 历史排名：过去 ${d.n} 个交易日里，约 ${d.historical_rank==null?"待计算":d.historical_rank.toFixed(1)}% 比今天更冷</div>
      <div class="mods">${mods.map(m=>`<div class="mod">
        <span class="lb">${m[0]}</span>
        <span class="bar"><i style="width:${Math.max(2,Math.min(100,m[1]))}%;background:${barColor(m[1])}"></i></span>
        <span class="vl">${m[1].toFixed(1)}</span></div>`).join("")}</div>
      <div class="read">${mods.map(m=>`<div class="ln"><span>${m[0]}</span><span>${SAY[m[2]](m[1])}</span></div>`).join("")}</div>
      <div class="concl"><b>合起来看：</b>${combo(L.s_pos,L.s_crowd,L.s_mom)}</div>
    </div>`;
  }).join("");
}

const GUIDE=[
  {key:"pos",name:"位置",val:L=>L.s_pos,
   q:"价格离“平时该在的地方”有多远。",
   body:"想象一根橡皮筋，一头拴着这只指数的平均成本，另一头拴着当前价格。价格越跑偏，皮筋绷得越紧，往回拽的力就越大。",
   lo:"皮筋往<b>下</b>绷到最紧——价格跌到近一年最惨的位置",
   mid:"价格贴着平均成本走，不松不紧",
   hi:"皮筋往<b>上</b>绷到最紧——价格涨到近一年最贵的位置",
   note:"0 和 100 都是“绷紧”，只是一个朝下、一个朝上。看的是：价格偏离 20 日均线多少、在布林带里靠上还是靠下、离一年最高点跌了多少。"},
  {key:"crowd",name:"拥挤",val:L=>L.s_crowd,
   q:"场子有多热闹：多少注意力盯着它，买卖有多激烈。",
   body:"看两件事：一是有多少资金在它身上成交（它占了两市成交额的多少），二是买卖有多激烈（价格一天上下波动多大、筹码换手多快）。这两件事跟价格涨跌方向无关，所以能提供位置看不到的信息。",
   lo:"门可罗雀——它在两市成交里只占很小一块，波动也小，没人理",
   mid:"正常关注度，交易不冷也不热",
   hi:"资金扎堆、交易激烈——成交占比高、上下剧烈震荡，一件事能引出很大的换手",
   note:"这里衡量的不是“多少人看多”，而是“交易有多激烈”。暴跌时波动率同样会冲高，所以拥挤度高搭配位置极低，读作“恐慌抛售中”，不是“人多看多”。A 股口径：成交占比 50%、20 日波动率 30%、换手率 20%。<b>美股四只因无换手率与全市场成交额，改用：占 SPY 成交额 50%、波动率 30%、成交量分位 20%</b>（详见页脚说明）。"},
  {key:"mom",name:"动能",val:L=>L.s_mom,
   q:"这股劲儿正在往哪使、使多大。",
   body:"位置回答“在哪儿”，动能回答“正在往哪走、走得多快”。这两个最容易搞混：位置是<b>在哪儿</b>，动能是<b>往哪走</b>。",
   lo:"往下砸得很猛，还在加速下跌",
   mid:"走平，横着，没有明显方向",
   hi:"往上冲得很猛，还在加速上涨",
   note:"价格可以在很高的位置（位置 95）但动能已经泄了（动能 20），那是“强弩之末”。反过来，位置很低但动能已经回升，说明下跌在刹住。"}
];
const MKC=["#1f2328","#1f6feb","#e08b3a","#8a3fb8","#3b6d11","#0f7b7b","#a2394b","#5b6b8c"];
/* 行情代理：标普500、道琼斯在数据源只有 ETF 可拿，卡片上的价格是 ETF 价，
   不是指数点位。不标出来会被误读成"标普500 才 759 点"。 */
const PROXY={"标普500":"IVV","道琼斯":"DIA"};
function renderGuides(){
  document.getElementById("guides").innerHTML = GUIDE.map(g=>{
    const rows=KEYS.map(k=>{
      const v=g.val(DATA[k].last);
      return `<div class="r"><span>${k}</span><span><b style="font-family:ui-monospace,Consolas,monospace">${v.toFixed(1)}</b>　${SAY[g.key](v)}</span></div>`;
    }).join("");
    const sub = g.key==="crowd" ? KEYS.filter(k=>DATA[k].last.c_share!=null).map(k=>{
      const L=DATA[k].last, us=DATA[k].crowd_mode==="v4-us";
      return us
        ? `<div class="r" style="opacity:.9;margin-top:5px"><span>└ ${k}</span><span>占SPY <b>${L.c_share.toFixed(0)}</b>　波动 <b>${L.c_vol.toFixed(0)}</b>　成交量 <b>${L.c_turn.toFixed(0)}</b>　<span style="color:var(--ink3)">（均为分位）</span></span></div>`
        : `<div class="r" style="opacity:.9;margin-top:5px"><span>└ ${k}</span><span>成交占比 <b>${L.c_share.toFixed(0)}</b>　波动 <b>${L.c_vol.toFixed(0)}</b>　换手 <b>${L.c_turn.toFixed(0)}</b>　<span style="color:var(--ink3)">（均为分位）</span></span></div>`;
    }).join("") : "";
    return `<div class="guide">
      <div class="gh"><span class="gn">${g.name}</span></div>
      <div class="gq">${g.q}</div>
      <div style="font-size:11.5px;color:var(--ink2);margin-bottom:11px">${g.body}</div>
      <div class="ruler">
        <div class="track">${KEYS.map((k,i)=>`<div class="mk" style="left:${Math.max(0,Math.min(100,g.val(DATA[k].last)))}%;background:${MKC[i%MKC.length]}" title="${k} ${g.val(DATA[k].last).toFixed(1)}"></div>`).join("")}</div>
        <div class="lb"><span>0</span><span>50</span><span>100</span></div>
      </div>
      <div class="ends">
        <div class="e"><b>0</b><span>${g.lo}</span></div>
        <div class="e"><b>50</b><span>${g.mid}</span></div>
        <div class="e"><b>100</b><span>${g.hi}</span></div>
      </div>
      <div style="font-size:10.5px;color:var(--ink3);margin-top:7px">↑ 竖线为当前位置：${KEYS.map((k,i)=>`<span style="color:${MKC[i%MKC.length]};font-weight:600">${k}</span>`).join("　")}</div>
      <div class="now">${rows}${sub}</div>
      <div style="font-size:11px;color:var(--ink3);margin-top:10px;padding-top:9px;border-top:1px dashed var(--line)">${g.note}</div>
    </div>`;
  }).join("");
}

const BKDEF=[
  ["极端超卖","≤15","价格和资金同时被压到历史最低区，是样本里最冷的日子","历史罕见，说明处在极端状态，但样本往往太少，统计上不能当结论"],
  ["警戒超卖","15–30","偏冷，但还没到极端","值得开始留意，重点看动能是否止跌（动能回升才是转折信号）"],
  ["正常","30–70","历史常态区间，谈不上超买或超卖","多数时间都在这里，不需要特别解读"],
  ["警戒超买","70–85","偏热，交易拥挤度抬升","短期波动可能加大，但历史上这一档之后市场仍偏强，不是卖出信号"],
  ["极端超买","≥85","历史最热的一批日子","出现过，但通常只能维持几天到两周；之后短期回调概率上升，中期方向不确定"]
];
function renderBkDef(){
  document.getElementById("bkDefTable").innerHTML =
    `<thead><tr><th>档位</th><th style="text-align:left">分数区间</th><th style="text-align:left">含义</th><th style="text-align:left">看到这一档该想什么</th>
     ${KEYS.map(k=>`<th style="white-space:nowrap">${k} 占比</th>`).join("")}</tr></thead><tbody>`+
    BKDEF.map(r=>`<tr>
      <td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CLS[r[0]]};margin-right:7px"></span>${r[0]}</td>
      <td style="text-align:left" class="dim">${r[1]}</td>
      <td style="text-align:left">${r[2]}</td>
      <td style="text-align:left" class="dim">${r[3]}</td>
      ${KEYS.map(k=>`<td>${(DATA[k].dist[r[0]]||0).toFixed(1)}%</td>`).join("")}
    </tr>`).join("")+`</tbody>`;
}

const chart=echarts.init(document.getElementById("chart"));
function renderChart(){
  const d=DATA[cur];
  const xs=d.series.map(p=>p[0]);
  const sc=d.series.map(p=>p[1]);
  const px=d.series.map(p=>p[2]);
  chart.setOption({
    animation:false,
    grid:{left:52,right:58,top:24,bottom:44},
    tooltip:{trigger:"axis",axisPointer:{type:"line",lineStyle:{color:"#b4b2a9"}},
      backgroundColor:"#fff",borderColor:"#e6e4de",textStyle:{color:"#1f2328",fontSize:12},
      formatter:p=>{
        const i=p[0].dataIndex;
        return `<div style="font-weight:500;margin-bottom:4px">${xs[i]}</div>`+
          `读数 <b>${sc[i].toFixed(1)}</b><br>指数 ${px[i].toFixed(2)}`;
      }},
    xAxis:{type:"category",data:xs,boundaryGap:false,
      axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
      axisLabel:{color:"#8a8880",fontSize:11,interval:Math.max(1,Math.floor(xs.length/8))}},
    yAxis:[
      {type:"value",min:0,max:100,interval:25,
       name:"读数",nameTextStyle:{color:"#a8a69d",fontSize:10.5,padding:[0,0,0,-28]},
       axisLine:{show:false},axisTick:{show:false},
       axisLabel:{color:"#8a8880",fontSize:11},
       splitLine:{lineStyle:{color:"#f0eee8"}}},
      {type:"value",scale:true,
       name:"指数",nameTextStyle:{color:"#a8a69d",fontSize:10.5,padding:[0,-30,0,0]},
       axisLine:{show:false},axisTick:{show:false},
       axisLabel:{color:"#a8a69d",fontSize:11},
       splitLine:{show:false}}
    ],
    series:[
      {name:"复合读数",type:"line",data:sc,smooth:false,symbol:"none",
       lineStyle:{width:1.6,color:"#2c2c2a"},
       areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
         {offset:0,color:"rgba(44,44,42,.13)"},{offset:1,color:"rgba(44,44,42,0)"}])},
       markLine:{silent:true,symbol:"none",
         label:{color:"#8a8880",fontSize:10,position:"insideEndTop",distance:3,
                backgroundColor:"rgba(255,255,255,.86)",padding:[2,4],borderRadius:2,
                formatter:p=>p.name},
         lineStyle:{width:.8,type:"dashed",color:"#c9c7bd"},
         data:[{yAxis:15,name:"15 极端"},{yAxis:30,name:"30 警戒"},{yAxis:70,name:"70 警戒"},{yAxis:85,name:"85 极端"}]}},
      {name:"指数收盘",type:"line",yAxisIndex:1,data:px,symbol:"none",smooth:false,
       lineStyle:{width:1.1,color:"#b9b6ab",type:"dotted"}}
    ]
  },true);
}

function renderTables(){
  const d=DATA[cur];
  const rows=d.buckets.filter(b=>b.n>0);
  document.getElementById("bkTable").innerHTML =
    `<thead><tr><th>档位</th><th>交易日数</th><th>占全样本</th><th>平均持续</th><th>后续 5 日</th><th>后续 20 日</th>
     <th>20 日均最深回撤</th><th>20 日均最高上冲</th><th>20 日上涨占比</th></tr></thead><tbody>`+
    rows.map(b=>{
      const share=d.dist[b.bk]||0;
      const dw=d.dwell[b.bk];
      const r20=b.ret20;
      return `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CLS[b.bk]};margin-right:7px"></span>${b.bk}</td>
        <td>${b.n}</td><td class="dim">${share.toFixed(1)}%</td>
        <td class="dim">${dw!=null?dw.toFixed(1)+' 日':'—'}</td>
        <td class="${b.ret5>0?'pos':(b.ret5<0?'neg':'dim')}">${b.ret5>0?'+':''}${b.ret5.toFixed(2)}%</td>
        <td class="${r20>0?'pos':(r20<0?'neg':'dim')}">${r20>0?'+':''}${r20.toFixed(2)}%</td>
        <td class="${b.md20<0?'neg':'dim'}">${b.md20.toFixed(2)}%</td>
        <td class="${b.mu20>0?'pos':'dim'}">${b.mu20>0?'+':''}${b.mu20.toFixed(2)}%</td>
        <td>${b.win20.toFixed(1)}%</td></tr>`;
    }).join("")+`</tbody>`;
  document.getElementById("bkNote").textContent = `统计口径：自信号日收盘起算 ｜ ${cur}`;
  document.getElementById("bkCap").innerHTML =
    `复合指标 IC(10 日) <b>${d.ic.ic10}</b>，纯 RSI6 <b>${d.ic.rsi10}</b>。IC 为正说明“读数越高、后续收益越好”，即指标刻画的是<b>热度</b>而非<b>方向</b>。`+
    `本表 ${cur} 共 ${d.n} 个交易日。`;

  document.getElementById("yrTable").innerHTML =
    `<thead><tr><th>年份</th><th>年内最高点</th><th>当天读数</th><th>年内最低点</th><th>当天读数</th></tr></thead><tbody>`+
    d.year.map(y=>`<tr><td>${y.y}</td><td class="dim" style="font-family:ui-monospace,Consolas,monospace">${y.hi_d}</td>
      <td><b>${y.hi_s.toFixed(1)}</b></td>
      <td class="dim" style="font-family:ui-monospace,Consolas,monospace">${y.lo_d}</td>
      <td><b>${y.lo_s.toFixed(1)}</b></td></tr>`).join("")+`</tbody>`;

  const evs=d.events.slice().reverse();
  document.getElementById("evTable").innerHTML = evs.length
    ? `<thead><tr><th>状态</th><th>起</th><th>止</th><th>持续</th><th>期间极值</th></tr></thead><tbody>`+
      evs.map(e=>`<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CLS[e.bk]};margin-right:7px"></span>${e.bk}</td>
        <td class="dim" style="font-family:ui-monospace,Consolas,monospace;font-size:11px">${e.from}</td>
        <td class="dim" style="font-family:ui-monospace,Consolas,monospace;font-size:11px">${e.to}</td>
        <td>${e.days} 日</td><td><b>${e.peak.toFixed(1)}</b></td></tr>`).join("")+`</tbody>`
    : `<tbody><tr><td class="dim" style="padding:16px 10px">样本期内未出现持续 3 日以上的极端状态</td></tr></tbody>`;

  const hasOS=d.events.some(e=>e.bk==="极端超卖");
  const dws=d.dwell["极端超卖"];
  document.getElementById("evCap").innerHTML = hasOS ? ""
    : (dws==null
      ? `${cur} 样本内<b>从未出现极端超卖档</b>（0 个交易日），因此不存在持续 3 日以上的极端超卖时段。这说明该标的历史分数分布整体偏向上半区，<b>不具备识别底部的样本基础</b>，其低分读数不宜当作抄底依据。`
      : `${cur} 样本内极端超卖平均仅维持 ${dws} 天，从未出现持续 3 日以上的极端超卖时段——这也说明该档位信号短暂、噪音大，不宜单独依据。`);
}

function renderFoot(){
  const sample=KEYS.map(k=>`${k}：${DATA[k].start}～${DATA[k].end}，${DATA[k].n}个有效交易日`).join('；');
  const ics=KEYS.map(k=>DATA[k].ic&&DATA[k].ic.ic20).filter(v=>Number.isFinite(v));
  const icRange=ics.length?`${Math.min(...ics).toFixed(3)}～${Math.max(...ics).toFixed(3)}`:'未获取';
  document.getElementById('footNote').innerHTML=`<b>构造与校准</b> 位置40%＋拥挤35%＋动能25%，之后3日EMA。位置含乖离、布林位置、250日回撤；动能为Wilder RSI6与10日风险调整收益。各分项按自身滚动分布校准，不能将A股与美股拥挤度混比。历史排名不等于合成分数。<br>
  <b>拥挤与代理</b> A股分母为沪深两市成交额；美股为SPY成交额，成交量替代换手率。IVV代表标普500、DIA代表道琼斯。融资观察项不参与评分；legacy代表退回旧拥挤口径，必须分开看。<br>
  <b>算法沿革</b> 原RSI/MACD变化量测加速度，当前改用RSI6与风险调整收益；拥挤口径改用成交额占比与波动率以减少价格位置重复计权。<br>
  <b>六条限制</b> ①描述统计不预测，当前各标的样本内20日IC范围为${icRange}；②位置与动能均源自价格，可能高度相关；③拥挤独立性与预测力存在取舍，不能将历史研究相关系数冒充本次实测；④极端档样本可能很少，须查看分档交易日数；⑤纯量价框架不一定识别缩量阴跌；⑥各市场样本期长度与行情环境不同，不能从短样本外推。<br>
  <b>本次样本</b> ${sample}。<br><b>来源</b> westock日线；A股两市成交额与可用两融汇总；美股ETF代理。具体缓存/降级见各卡片标记。<br>本页为指标状态播报工具，不含任何买卖建议。过往统计不预示未来表现。`;
}

/* ================= 第二页：估值 ================= */
function peColor(p){
  if(p==null)return "#b4b2a9";
  if(p<=20)return "#1f6feb";
  if(p<=50)return "#6aa9f0";
  if(p<=80)return "#e08b3a";
  return "#d64545";
}
function peLabel(p){
  if(p==null)return "无数据";
  if(p<=20)return "低估区";
  if(p<=50)return "偏低";
  if(p<=80)return "偏高";
  return "高估区";
}
function renderCompare(){
  const box=document.getElementById("compareBox");
  if(!VAL){ box.innerHTML=`<div class="ci"><div class="ct">估值数据未加载</div><div class="dim">请点右上角更新数据</div></div>`; return; }
  box.innerHTML = VKEYS.map(k=>{
    const D=DATA[k]&&DATA[k].last, V=VAL[k];
    if(!V){ return `<div class="ci"><div class="ct">${k}</div><div class="dim">估值数据缺失</div></div>`; }
    if(V.missing){ return `<div class="ci"><div class="ct">${k}</div>
      <div class="dim" style="line-height:1.7">无可用估值口径，无法与价格位置对照。
      这不是漏配，是数据源不提供道指的 PE 历史——宁可空着，也不拿别的指数顶替。</div></div>`; }
    if(!D){ return `<div class="ci"><div class="ct">${k}</div><div class="dim">行情数据缺失</div></div>`; }
    const p=V.pe_stats.pos_all;
    const isFwd=V.basis==="前瞻PE";
    const posLow = D.s_pos<=30, posHigh = D.s_pos>=70;
    const peLow = p!=null && p<=30, peHigh = p!=null && p>=70;
    let verdict, vcolor;
    if(posLow && peLow){
      verdict="价格跌到历史低位，估值也确实便宜了——杀估值比较彻底，中长期风险释放较充分";vcolor="#3b6d11";
    }else if(posLow && peHigh){
      verdict="价格跌到历史低位，但估值仍在高位——盈利下滑的速度比股价更快，跌了却没变便宜";vcolor="#a32d2d";
    }else if(posLow){
      verdict="价格跌到历史低位，估值却还在中位——股价跌了、盈利也同步下滑，所以没跌出便宜来";vcolor="#5f5e5a";
    }else if(posHigh && peHigh){
      verdict="价格和估值都在高位——双高，风险最大";vcolor="#a32d2d";
    }else if(posHigh && peLow){
      verdict="价格在高位但估值不贵——盈利增长消化了涨幅，属于健康的高位";vcolor="#5f5e5a";
    }else if(posHigh){
      verdict="价格在高位、估值在中位——涨得有盈利支撑，但价格本身已经不便宜";vcolor="#5f5e5a";
    }else if(peLow){
      verdict="价格在中位，估值偏便宜——没有明显泡沫，也没到被错杀的程度";vcolor="#5f5e5a";
    }else if(peHigh){
      verdict="价格在中位，估值偏高——涨幅已由估值扩张承担，继续上行要靠盈利兑现";vcolor="#a32d2d";
    }else{
      verdict="价格与估值都处在中间地带，没有明显偏向";vcolor="#5f5e5a";
    }
    return `<div class="ci">
      <div class="ct">${k}${isFwd?'<span style="font-size:10px;font-weight:400;color:#a32d2d;margin-left:6px">前瞻口径</span>':""}</div>
      <div class="cr"><span>短期位置</span><span><b style="font-family:ui-monospace,Consolas,monospace">${D.s_pos.toFixed(1)}</b> / 100（越低越接近近一年最低）</span></div>
      <div class="cr"><span>${isFwd?"前瞻分位":"PE 分位"}</span><span><b style="font-family:ui-monospace,Consolas,monospace;color:${peColor(p)}">${p==null?"—":p.toFixed(1)+"%"}</b>（${peLabel(p)}）</span></div>
      <div class="cr"><span>${isFwd?"前瞻 PE":"当前 PE"}</span><span style="font-family:ui-monospace,Consolas,monospace">${V.pe_stats.cur.toFixed(2)}</span></div>
      <div class="cc" style="color:${vcolor}">→ ${verdict}</div>
    </div>`;
  }).join("");
}

function peConcl(k,p,st,basis){
  const nm = basis==="前瞻PE" ? "前瞻 PE" : "PE";
  if(p==null) return "分位数据不足。";
  if(p<=20) return `${k} 的 ${nm} 处于历史 ${p.toFixed(1)}% 分位，是样本里最便宜的那一档。历史中位 ${nm} 为 ${st.median.toFixed(1)}，当前 ${st.cur.toFixed(2)} 明显低于中位。`;
  if(p<=50) return `${k} 的 ${nm} 处于历史 ${p.toFixed(1)}% 分位，略低于中位数 ${st.median.toFixed(1)}，属于中性偏便宜。`;
  if(p<=80) return `${k} 的 ${nm} 处于历史 ${p.toFixed(1)}% 分位，高于中位数 ${st.median.toFixed(1)}，估值不便宜。`;
  return `${k} 的 ${nm} 处于历史 ${p.toFixed(1)}% 分位，接近历史高位。历史上只有约 ${(100-p).toFixed(1)}% 的时间比现在更贵。`;
}

function renderVCards(){
  const box=document.getElementById("vCards");
  if(!VAL){ box.innerHTML=`<div class="card">估值数据未加载，请点右上角更新数据</div>`; return; }
  const srcs=[...new Set(VKEYS.map(k=>VAL[k]&&VAL[k].src).filter(Boolean))];
  const ends=VKEYS.map(k=>VAL[k]&&VAL[k].pe_stats&&VAL[k].pe_stats.end).filter(Boolean).sort();
  document.getElementById("vSrc").textContent =
    "数据源：" + (srcs.length?srcs.join(" ／ "):"蛋卷基金指数估值") +
    " ｜ 更新至 " + (ends.length?ends[ends.length-1]:"");
  box.innerHTML = VKEYS.map(k=>{
    const V=VAL[k]; if(!V) return `<div class="card">${k} 无估值数据</div>`;
    if(V.missing){
      const D=DATA[k]&&DATA[k].last;
      return `<div class="card">
        <div class="card-h"><span class="nm">${k}</span><span class="dt" style="color:#a32d2d">无可用口径</span></div>
        <div style="font-size:12.5px;color:var(--ink2);line-height:1.75;margin-top:2px">
          <b>这一格故意留空。</b>${V.reason}
        </div>
        <div style="font-size:11px;color:var(--ink3);margin-top:11px;padding-top:9px;border-top:1px dashed var(--line);line-height:1.7">
          能替代的只有两条：① 道指的<b>价格位置</b>见第一页${D?`（当前 ${D.s_pos.toFixed(1)}／100）`:""}，
          它不依赖盈利数据；② 要看美股大盘估值，用标普500 的 PE 分位代替，
          两者成分重叠度不高，但方向不会差太远。<b>不要用标普500 的数值冒充道琼斯。</b>
        </div>
      </div>`;
    }
    const st=V.pe_stats, p=st.pos_all;
    const longLb = st.n>=480 ? "近10年" : "成立以来";
    const rows=[["近3年",st.pos["3年"]],["近5年",st.pos["5年"]],[longLb,st.pos["10年"]]];
    const basis=V.basis||"PE-TTM";
    return `<div class="card">
      <div class="card-h"><span class="nm">${k}</span><span class="dt">${basis}</span></div>
      <div class="score-row">
        <span class="vpe" style="color:${peColor(p)}">${st.cur.toFixed(2)}</span>
        <span class="tag" style="background:#f1efe8;color:${peColor(p)}">${peLabel(p)}</span>
      </div>
      <div class="rank">当前${basis==="前瞻PE"?"前瞻 PE":"PE"}在 ${st.start.slice(0,4)} 年以来的 ${st.n} 个样本中，高于 ${p==null?"—":p.toFixed(1)}% 的时间</div>
      ${rows.map(r=>`<div class="vrow">
        <span class="k">${r[0]}</span>
        <span class="bar"><i style="width:${Math.max(2,Math.min(100,r[1]||2))}%;background:${peColor(r[1])}"></i></span>
        <span class="v">${r[1]==null?"—":r[1].toFixed(1)+"%"}</span></div>`).join("")}
      <div class="vinfo">
        <span>PB <b>${V.pb_stats?V.pb_stats.cur.toFixed(2):"—"}</b></span>
        <span>历史中位 ${basis==="前瞻PE"?"前瞻 PE":"PE"} <b>${st.median.toFixed(1)}</b></span>
        <span>历史区间 <b>${st.min.toFixed(1)} ~ ${st.max.toFixed(1)}</b></span>
      </div>
      <div class="vconcl" style="color:var(--ink2)">${peConcl(k,p,st,V.basis)}</div>
      ${V.note?`<div style="font-size:10.5px;color:var(--ink3);margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)">${V.note}</div>`:""}
    </div>`;
  }).join("");
}

const vchart=echarts.init(document.getElementById("vchart"));
function renderVChart(){
  if(!VAL || !VAL[vcur]) return;
  const V=VAL[vcur], st=V.pe_stats;
  if(V.missing){
    if(vchart){
      vchart.clear();
      vchart.setOption({title:{
        text:"道琼斯：无可用估值序列",
        subtext:"道指为价格加权指数，指数 PE 需按 30 只成分股市值÷盈利另行汇总\n蛋卷 / History of Market / westock 均不提供该口径",
        left:"center", top:"middle",
        textStyle:{fontSize:13,color:"#8a8880",fontWeight:400},
        subtextStyle:{fontSize:11,color:"#b4b2a9",lineHeight:18}}});
    }
    return;
  }
  const xs=V.pe.map(p=>p[0]);
  const ys=V.pe.map(p=>p[1]);
  const dates=DATA[vcur].series.map(p=>p[0]);
  const closeMap={};
  DATA[vcur].series.forEach(p=>{ closeMap[p[0]]=p[2]; });
  function priceAt(d){
    if(closeMap[d]!=null) return closeMap[d];
    let lo=0,hi=dates.length-1,best=null;
    while(lo<=hi){const mid=(lo+hi)>>1; if(dates[mid]<=d){best=dates[mid];lo=mid+1;}else hi=mid-1;}
    return best?closeMap[best]:null;
  }
  const px=xs.map(priceAt);
  const basis=V.basis||"PE-TTM";
  const tt=document.getElementById("vChartTitle");
  if(tt) tt.textContent=(basis==="前瞻PE"?"前瞻 PE":"PE")+" 历史走势与"+(V.undl?V.undl:"指数")+"价格";
  vchart.setOption({
    animation:false,
    grid:{left:56,right:62,top:26,bottom:46},
    tooltip:{trigger:"axis",backgroundColor:"#fff",borderColor:"#e6e4de",
      textStyle:{color:"#1f2328",fontSize:12},
      formatter:p=>{
        const i=p[0].dataIndex;
        return `<div style="font-weight:500;margin-bottom:4px">${xs[i]}</div>`+
          `${basis} <b>${ys[i].toFixed(2)}</b><br>${V.undl||"指数"} ${px[i]!=null?px[i].toFixed(2):"—"}`;
      }},
    xAxis:{type:"category",data:xs,boundaryGap:false,
      axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
      axisLabel:{color:"#8a8880",fontSize:11,interval:Math.max(1,Math.floor(xs.length/8))}},
    yAxis:[
      {type:"value",scale:true,name:basis==="前瞻PE"?"前瞻PE":"PE",nameTextStyle:{color:"#a8a69d",fontSize:10.5,padding:[0,0,0,-24]},
       axisLine:{show:false},axisTick:{show:false},
       axisLabel:{color:"#8a8880",fontSize:11},splitLine:{lineStyle:{color:"#f0eee8"}}},
      {type:"value",scale:true,name:"价格",nameTextStyle:{color:"#a8a69d",fontSize:10.5,padding:[0,-32,0,0]},
       axisLine:{show:false},axisTick:{show:false},
       axisLabel:{color:"#a8a69d",fontSize:11},splitLine:{show:false}}
    ],
    series:[
      {name:basis,type:"line",data:ys,symbol:"none",smooth:false,
       lineStyle:{width:1.7,color:"#2c2c2a"},
       areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[
         {offset:0,color:"rgba(44,44,42,.11)"},{offset:1,color:"rgba(44,44,42,0)"}])},
       markLine:{silent:true,symbol:"none",
         label:{color:"#8a8880",fontSize:10,position:"insideStartTop",distance:4,formatter:p=>p.name},
         data:[
           {yAxis:st.p20,name:"P20  "+st.p20.toFixed(0),lineStyle:{width:1,type:"dashed",color:"#6aa9f0"}},
           {yAxis:st.median,name:"",lineStyle:{width:1,type:"dotted",color:"#c9c7bd"}},
           {yAxis:st.p80,name:"P80  "+st.p80.toFixed(0),lineStyle:{width:1,type:"dashed",color:"#e08b3a"}}
         ]}},
      {name:"指数收盘",type:"line",yAxisIndex:1,data:px,symbol:"none",smooth:false,
       lineStyle:{width:1.1,color:"#b9b6ab",type:"dotted"}}
    ]
  },true);
}

function renderVTable(){
  if(!VAL) return;
  const P=v=>v==null?"—":v.toFixed(1)+"%";
  const C=v=>v==null?"":(v<=30?"pos":(v>=70?"neg":""));
  document.getElementById("vTable").innerHTML =
    `<thead><tr><th>指数</th><th>口径</th><th>当前 PE</th><th>近 3 年分位</th><th>近 5 年分位</th><th>长期分位</th>
     <th>历史中位</th><th>历史区间</th><th>PB</th><th>股息率</th></tr></thead><tbody>`+
    KEYS.map(k=>{
      const V=VAL[k]; if(!V) return "";
      const st=V.pe_stats;
      if(V.missing) return `<tr><td>${k}</td><td class="dim" style="white-space:nowrap">不可得</td>
        <td class="dim" colspan="8" style="text-align:left">估值源不提供该指数的 PE 口径，见上方卡片说明；道指的价格位置仍可在第一页查看</td></tr>`;
      const dy=(V.detail&&V.detail.yeild!=null)?(V.detail.yeild*100).toFixed(2)+"%":"—";
      return `<tr><td>${k}</td>
        <td class="dim" style="white-space:nowrap">${V.basis||"PE-TTM"}</td>
        <td><b>${st.cur.toFixed(2)}</b></td>
        <td class="${C(st.pos["3年"])}">${P(st.pos["3年"])}</td>
        <td class="${C(st.pos["5年"])}">${P(st.pos["5年"])}</td>
        <td class="${C(st.pos["10年"])}">${P(st.pos["10年"])}</td>
        <td class="dim">${st.median.toFixed(2)}</td>
        <td class="dim">${st.min.toFixed(1)} ~ ${st.max.toFixed(1)}</td>
        <td>${V.pb_stats?V.pb_stats.cur.toFixed(2):"—"}</td>
        <td>${dy}</td></tr>`;
    }).join("")+`</tbody>`;
}

function renderValFoot(){
  const any=VAL&&VAL[KEYS[0]];
  const hasSOX=!!(VAL&&VAL["SOXX"]);
  document.getElementById("valFoot").innerHTML = `
<b>估值口径</b>　A 股（科创 50 / 创业板指）与 QQQ 为 <b>PE-TTM</b>（滚动市盈率），来自蛋卷基金指数估值接口，加权口径；分位为自算值
（当前值在过去 N 年周度样本中的百分位）。QQQ 取跟踪标的「纳斯达克100」的估值，与 A 股同口径，可直接横比。<br>
${hasSOX?`<b style="color:#a32d2d">SOXX 是另一套口径</b>　它用的是费城半导体的<b>前瞻 PE</b>（价格 ÷ 未来 12 个月共识 EPS），数据来自
History of Market（CC BY 4.0）。分母是预期盈利而非已实现盈利，<b>绝对值和上面的 PE-TTM 不可横比，只能在同一口径内看纵向分位</b>。
半导体盈利周期波动极大，前瞻 PE 与 TTM 常常相差 30% 以上。<br>`:""}
<b>口径提醒</b>　不同平台的 PE 绝对值不可直接比较。以 2026-10-28 科创 50 为例：蛋卷为 105.19，中证指数官网为 84.64（总股本法），差约 24%。
差异来自成分股加权方式与亏损股处理规则。<b>因此本页只用分位做纵向比较，不用绝对值做横向比较。</b><br>
<b>样本窗口</b>　四个标的的长期分位都对齐到<b>近 10 年</b>（纳斯达克100 与费城半导体均自 2016-10 起）。费半不取 2002 年以来的全历史，
是因为互联网泡沫期其前瞻 PE 曾达 195 倍，留在样本里会把整个分布压平、失去区分度。<br>
<b>为什么是周频</b>　估值接口提供周度采样${any?"（"+any.pe_stats.n+" 个样本点）":""}。对判断中长期估值位置而言周频足够，但它不适合用来做日内或短线择时。
费半近三个月改用日频补齐（官方周频序列滞后约两个月），否则最新分位会高估 20 个百分点以上。<br>
<b>估值不是择时工具</b>　低估值可以更低。创业板指 2022 年 PE 跌至 23 倍附近之后，仍有漫长的磨底期。“便宜”说明向下空间可能有限，不说明何时上涨。
它需要和第一页配合看：<b>估值定位置，动能定时机</b>。<br>
<b>数据来源</b>　行情：腾讯自选股 westock；A 股与 QQQ／标普500 估值：蛋卷基金（沪深300、中证红利同源）；SOXX 估值：History of Market（CC BY 4.0）。
点击右上角「更新数据」可同时刷新。<b>道琼斯不提供估值</b>：道指为价格加权指数，指数 PE 需按 30 只成分股合计市值÷合计盈利另行汇总，
蛋卷、History of Market、westock 均无此口径，故留空而非用其他指数顶替。<br>
<b>标普500 的口径拆分</b>　价格与成交量来自 IVV（iShares 标普500 ETF），PE 取自标普500 指数本身——两者跟踪同一篮子，
日频差异仅为费率与跟踪误差；指数层面无可用实时行情，ETF 层面无 PE，只能这样拼。道琼斯同理（行情用 DIA）。<br>
<span style="color:#8a8880">本页为指标状态播报工具，不含任何买卖建议。估值数据存在口径差异与延迟，历史分位不代表未来回报。</span>`;
}

/* ================= 渲染总控 ================= */
function renderLev(){
  const el=document.getElementById("levCard");
  const L=DATA[KEYS[0]].last;
  if(L.lev==null){ el.style.display="none"; return; }
  el.style.display="";
  const pos=L.lev_pos;
  const lvl = pos<=25?"偏低":pos<=75?"中性":"偏高";
  const mean = pos<=25
    ? "杠杆资金几乎没有参与。这波下跌不是靠“借钱盘被强平”砸出来的，更像是主动减仓——这类下跌通常不带强制平仓的连锁反应。"
    : pos>=75
      ? "杠杆资金拥挤。涨的时候它会助涨，跌的时候容易触发被动平仓，形成连环踩踏，波动会被放大。"
      : "杠杆参与度处在常态区间，既没有明显助推，也不构成额外的连锁风险。";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px;gap:12px">
      <div style="font-size:12.5px;font-weight:600">杠杆环境（观察项，不计入总分）</div>
      <div style="font-size:10.5px;color:var(--ink3)">数据截至 ${L.lev_date}</div>
    </div>
    <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap">
      <div style="font-size:26px;font-weight:600;font-family:ui-monospace,Consolas,monospace">${L.lev.toFixed(2)}<span style="font-size:13px;font-weight:400">%</span></div>
      <div style="font-size:11.5px;color:var(--ink2)">两市融资买入额 ÷ 两市成交额　·　历史分位 <b>${pos.toFixed(0)}</b>（${lvl}）</div>
    </div>
    <div style="font-size:11.5px;color:var(--ink2);margin-top:9px;line-height:1.75">${mean}</div>
    <div style="font-size:11px;color:var(--ink3);margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)">
      为什么不计入总分：实测它跟“位置”的相关性高达 <b>0.64</b>——涨的时候加杠杆、跌的时候撤杠杆，本质上是价格的影子。放进去等于给位置模块再加一次权，不会带来新信息，所以只留作背景参考。
    </div>`;
}

/* 两个页头条上的「标的数 / 数据截至」：只读已算好的数据，不做新统计。
   估值那条取各标的 pe_stats.end 的最大值——QQQ 与 A 股走不同源，收假日不一致。 */
function momMeta(){
  const n=document.getElementById("momN"), d=document.getElementById("momDate");
  if(!n||!d) return;
  const ks=Object.keys(DATA||{});
  n.textContent = ks.length || "—";
  const ends=ks.map(k=>DATA[k]&&DATA[k].end).filter(Boolean).sort();
  d.textContent = ends.length ? ends[ends.length-1] : "—";
}
function valMeta(){
  const n=document.getElementById("valN"), d=document.getElementById("valDate");
  if(!n||!d) return;
  const ks=Object.keys(VAL||{}).filter(k=>VAL[k]&&VAL[k].pe_stats);
  n.textContent = ks.length || "—";
  const ends=ks.map(k=>VAL[k].pe_stats.end).filter(Boolean).sort();
  d.textContent = ends.length ? ends[ends.length-1] : "—";
}

function renderAll(){
  DATA=DATA||{};
  KEYS=Object.keys(DATA);
  VKEYS=(VAL&&Object.keys(VAL).length)?Object.keys(VAL):[];
  if(!cur || !DATA[cur]) cur=KEYS[0];
  if(!vcur || !VAL || !VAL[vcur]) vcur=VKEYS[0]||"";

  document.getElementById("tabs").innerHTML = KEYS.map(k=>
    `<button data-k="${k}" class="${k===cur?'on':''}">${k}</button>`).join("");
  document.getElementById("vtabs").innerHTML = VKEYS.map(k=>
    `<button data-k="${k}" class="${k===vcur?'on':''}">${k}</button>`).join("");

  if(KEYS.length){renderMeta(); renderCards(); renderGuides(); renderBkDef(); renderLev(); renderChart(); renderTables(); renderFoot();}else{document.getElementById("cards").innerHTML="尚无动能数据，请刷新动能获取八个标的日线。";}
  if(VKEYS.length){ renderCompare(); renderVCards(); renderVChart(); renderVTable(); renderValFoot(); }
  momMeta(); valMeta();
}

document.getElementById("tabs").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  cur=b.dataset.k;
  [...e.currentTarget.children].forEach(x=>x.classList.toggle("on",x===b));
  renderChart(); renderTables();
});
document.getElementById("vtabs").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  vcur=b.dataset.k;
  [...e.currentTarget.children].forEach(x=>x.classList.toggle("on",x===b));
  renderVChart();
});

/* ================= A股雷达（情绪周期复盘） ================= */
const FU=(v,d=2)=>{const n=Number(v);return (v===null||v===undefined||v===""||isNaN(n))?"—":n.toFixed(d);};
const SG=(v,d=2)=>{const n=Number(v);return (v===null||v===undefined||v===""||isNaN(n))?"—":(n>0?"+":"")+n.toFixed(d);};
const CC=v=>Number(v)>0?"pos":Number(v)<0?"neg":"";
const BANDC={"冰点":"#1f6feb","低温":"#6aa9f0","中性":"#b4b2a9","升温":"#e08b3a","亢奋":"#d64545"};

function sThermo(){
  const S=SEN,b=S.breadth,v=S.volume,L=S.ladder;
  const col=BANDC[S.band]||"#b4b2a9";
  const pos=Math.max(0,Math.min(100,Number(S.temp)||0));
  const amtVs10=(v.amt&&v.ma10)?v.amt/v.ma10*100:null;
  return `<div class="sec" style="margin-top:0">
    <div class="sec-h"><h2>情绪温度计</h2><div class="note">三项公开广度合成 · 只看赚钱效应，不看指数涨跌</div></div>
    <div class="sec-desc">温度 = 50% × 上涨家数占比 + 30% × 涨停强度 + 20% × 跌停惩罚。它回答“今天冷不冷”，不回答“明天涨不涨”。</div>
    <div class="thermo">
      <div class="tcard">
        <div class="tnum">
          <div class="v">${FU(S.temp,1)}</div><div class="u">/ 100</div>
          <div class="tbd" style="background:${col}22;color:${col}">${S.band}</div>
        </div>
        <div class="trk"><div class="bar"></div><div class="mk" style="left:${pos}%"></div>
          <div class="sc"><span>0 冰点</span><span>25</span><span>50 中性</span><span>75</span><span>100 亢奋</span></div>
        </div>
        <div class="tkpi">
          <div class="k"><div class="n">${FU(b.up_pct,2)}%</div><div class="l">上涨占比</div><div class="s">${b.up} / ${b.total} 家</div></div>
          <div class="k"><div class="n">${b.lu}/${b.ld}</div><div class="l">涨停 / 跌停</div><div class="s">涨跌比 ${FU(b.ratio,2)}</div></div>
          <div class="k"><div class="n">${FU(v.amt,2)}</div><div class="l">成交额（万亿）</div><div class="s">120 日均值 ${FU(v.pct120,1)}%</div></div>
          <div class="k"><div class="n">${L.count}/${L.max}</div><div class="l">连板数 / 最高板</div><div class="s">2 板以上 ${L.ge2} 只</div></div>
        </div>
      </div>
      <div class="judg">
        <h3>${S.verdict.title}</h3>
        <p>${S.verdict.body}</p>
        <div class="jimg">
          <div class="r"><span>变化</span><span>较前一日 ${S.temp_delta===null?"—":SG(S.temp_delta,1)+" 点"}，${S.verdict.trend}</span></div>
          <div class="r"><span>量能</span><span>${FU(v.amt,2)} 万亿，为 10 日均值 ${FU(amtVs10,1)}%、120 日均值 ${FU(v.pct120,1)}%</span></div>
          <div class="r"><span>结构</span><span>最高 ${L.max} 板，2 板以上 ${L.ge2} 只，占涨停 ${FU(L.count?L.ge2/L.count*100:null,0)}%</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

function sPulse(){
  const P=SEN.pulse||[];
  const chips=P.map(p=>`<div class="pc"><div class="d">${p.d}</div><div class="t">${FU(p.temp,1)}</div>
    <div class="u">涨停 ${p.lu}　涨 ${FU(p.up_pct,1)}%</div></div>`).join("");
  return `<div class="sec">
    <div class="sec-h"><h2>近六日情绪脉搏</h2><div class="note">线 = 情绪温度（左轴）｜柱 = 涨停家数（相对高度）</div></div>
    <div class="sec-desc">单看一天没有意义——同样是 30 分，从 80 掉下来和从 20 爬起来，含义完全不同。这条线看的是节奏。</div>
    <div class="card" style="padding:14px 12px 10px"><div id="schart"></div></div>
    <div class="pchips">${chips}</div>
  </div>`;
}

function sBreadth(){
  const b=SEN.breadth,v=SEN.volume,t=SEN.tech,va=SEN.val;
  const pc=x=>b.total?(x/b.total*100):0;
  const rows=(SEN.index||[]).map(i=>`<tr><td>${i.name}</td><td class="dim">${FU(i.close,2)}</td>
    <td class="${CC(i.chg)}">${SG(i.chg,2)}%</td></tr>`).join("");
  const nlRatio=b.nh20?(b.nl20/b.nh20):null;
  return `<div class="sec">
    <div class="sec-h"><h2>赚钱效应：谁在跌</h2><div class="note">沪深 A 股全市场口径 · ${b.total} 只</div></div>
    <div class="two" style="margin-top:6px;align-items:start">
      <div class="card">
        <div class="dbar">
          <div style="width:${pc(b.up)}%;background:#3b6d11">上涨 ${b.up}</div>
          <div style="width:${pc(b.flat)}%;background:#c9c7bd;color:#5f5e5a">${b.flat?"平 "+b.flat:""}</div>
          <div style="width:${pc(b.down)}%;background:#a32d2d">下跌 ${b.down}</div>
        </div>
        <div class="dleg"><span><i style="background:#3b6d11"></i>上涨 ${FU(b.up_pct,2)}%</span>
          <span><i style="background:#c9c7bd"></i>平盘 ${FU(pc(b.flat),2)}%</span>
          <span><i style="background:#a32d2d"></i>下跌 ${FU(b.down_pct,2)}%</span></div>
        <div style="margin-top:16px;font-size:11.5px;color:var(--ink2);line-height:2">
          · 20 日新低 <b>${b.nl20}</b> 只 / 新高 <b>${b.nh20}</b> 只${nlRatio?`，新低是新高的 <b>${FU(nlRatio,1)}</b> 倍`:""}<br>
          · 250 日新低 <b>${b.nl250}</b> 只，中期趋势同步转弱<br>
          · 涨跌比 <b>${FU(b.ratio,2)}</b>${(b.ratio&&b.ratio<0.3)?"，赚钱效应严重缺失":""}
        </div>
        <div class="cap">新低数量是判断“下跌是全市场性还是个别板块拖累”的关键，比指数跌幅更可靠。</div>
      </div>
      <div class="card">
        <table style="font-size:11.5px"><thead><tr><th>指数</th><th>收盘</th><th>涨跌</th></tr></thead>
          <tbody>${rows}</tbody></table>
        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line);font-size:11.5px;color:var(--ink2);line-height:1.95">
          均线：MA5 ${FU(t.ma5,2)}　MA20 ${FU(t.ma20,2)}　MA60 ${FU(t.ma60,2)}<br>
          MACD ${FU(t.macd,2)}　RSI6 ${FU(t.rsi6,2)}　250 日均 ${FU(t.ma250,2)}<br>
          中证全指 PE ${FU(va.pe,2)}，5 年分位 ${FU(va.pe_pct5,1)}%、10 年分位 ${FU(va.pe_pct10,1)}%
        </div>
      </div>
    </div>
  </div>`;
}

function sLadder(){
  const L=SEN.ladder;
  const mx=Math.max.apply(null,(L.dist_list||[]).map(d=>d.n).concat([1]));
  const bars=(L.dist_list||[]).map(d=>`<div class="c"><div class="n">${d.n}</div>
    <div class="bb" style="height:${Math.max(10,d.n/mx*74)}px"></div><div class="t">${d.label}</div></div>`).join("");
  const rows=(L.samples||[]).map(s=>`<tr>
    <td>${s.days} 板</td><td class="dim" style="font-family:ui-monospace,Consolas,monospace">${s.code}</td>
    <td>${s.name}</td><td class="${CC(s.chg)}">${SG(s.chg,2)}%</td><td>${FU(s.turn,2)}%</td>
    <td>${FU(s.amt,2)}</td><td class="${CC(s.chg20)}">${SG(s.chg20,2)}%</td>
    <td class="${CC(s.chg60)}">${SG(s.chg60,2)}%</td><td>${s.yizi?"一字/缩量":"换手"}</td></tr>`).join("");
  return `<div class="sec">
    <div class="sec-h"><h2>连板梯队：高度与宽度</h2><div class="note">收录 ${L.count} 只 · 最高 ${L.max} 板</div></div>
    <div class="sec-desc">高度是情绪的空间，宽度是情绪的厚度。两者背离时，高度往往是虚的。</div>
    <div class="two" style="margin-top:4px">
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:10px">梯队分布</div>
        <div class="lb2">${bars}</div></div>
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:10px">结构拆解</div>
        <div style="font-size:11.5px;color:var(--ink2);line-height:2.1">
          · 一字 / 缩量板 <b>${L.yizi}</b> 只，换手板 <b>${L.huan}</b> 只<br>
          · 连板股平均换手 <b>${FU(L.avg_turn,2)}%</b><br>
          · 2 板以上占涨停总数 <b>${FU(L.count?L.ge2/L.count*100:null,0)}%</b>
        </div>
        <div class="cap">一字板是资金锁仓而非资金认可——买不到的高度，对空仓者没有意义。</div>
      </div>
    </div>
    <div class="card" style="padding:8px 4px;margin-top:16px">
      <table style="font-size:11.5px"><thead><tr><th>板数</th><th>代码</th><th>名称</th><th>当日</th>
        <th>换手</th><th>成交额(亿)</th><th>20 日</th><th>60 日</th><th>形态</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="9" class="dim">无 2 板以上个股</td></tr>'}</tbody></table>
    </div>
    <div class="cap">按板数降序，同板数内按换手率降序——换手最高的那只才是当日真正的风向标。</div>
  </div>`;
}

function sSector(){
  const set=(SEN.sector||{})[sKind]||{up:[],down:[]};
  const line=(r,cls)=>`<div class="row"><span class="nm">${r.name}</span>
    <span class="vv ${cls}">${SG(r.chg,2)}%</span>
    <span class="dim" style="font-size:10.5px">宽度 ${r.up}/${r.total}　5 日 ${SG(r.net5,1)} 亿</span></div>`;
  return `<div class="sec">
    <div class="sec-h"><h2>主线辨识：板块强弱</h2>
      <div class="tabs" id="stabs">
        <button data-k="industry" class="${sKind==="industry"?"on":""}">申万行业</button>
        <button data-k="concept" class="${sKind==="concept"?"on":""}">概念板块</button>
      </div></div>
    <div class="sec-desc">主线要三者共振：涨幅领先、资金持续流入、内部出现连板高度。<b>注意这一组是实时快照（抓取于 ${SEN.live_at}），不是 ${SEN.date} 的收盘截面</b>——接口的实时榜不支持历史日期，两者不能混读。</div>
    <div class="two" style="margin-top:4px">
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:10px">领涨</div>
        <div class="slist">${(set.up||[]).map(r=>line(r,"pos")).join("")||'<span class="dim">—</span>'}</div></div>
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:10px">领跌</div>
        <div class="slist">${(set.down||[]).map(r=>line(r,"neg")).join("")||'<span class="dim">—</span>'}</div></div>
    </div>
  </div>`;
}

function sInst(){
  const I=SEN.inst||{in:[],out:[]};
  const mxIn=Math.max.apply(null,(I.in||[]).map(x=>Math.abs(x.amt)).concat([0.01]));
  const mxOut=Math.max.apply(null,(I.out||[]).map(x=>Math.abs(x.amt)).concat([0.01]));
  const row=(x,mx,cls)=>`<div class="row"><span class="nm">${x.name}</span>
    <span class="vv ${cls}">${SG(x.amt,2)}</span>
    <span class="bb"><i style="width:${Math.min(100,Math.abs(x.amt)/mx*100)}%;background:${cls==="pos"?"#3b6d11":"#a32d2d"}"></i></span></div>`;
  return `<div class="sec">
    <div class="sec-h"><h2>机构动向：龙虎榜专用席位</h2>
      <div class="note">上榜 ${I.lhb_count} 只 · 有机构席位 ${I.inst_count} 只</div></div>
    <div class="sec-desc">机构买入合计 <b>${SG(I.sum_in,2)}</b> 亿、卖出合计 <b>${SG(I.sum_out,2)}</b> 亿。买卖的量级差，比单个席位更有信息量。</div>
    <div class="two" style="margin-top:4px">
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:10px">机构净买入（亿元）</div>
        <div class="slist">${(I.in||[]).map(x=>row(x,mxIn,"pos")).join("")||'<span class="dim">—</span>'}</div></div>
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:10px">机构净卖出（亿元）</div>
        <div class="slist">${(I.out||[]).map(x=>row(x,mxOut,"neg")).join("")||'<span class="dim">—</span>'}</div></div>
    </div>
    <div class="cap">同一只票可能在「1 日榜」与「3 日榜」同时出现，此处已按代码去重并优先取 1 日口径。</div>
  </div>`;
}

function sGap(){
  const G=SEN.gap;
  return `<div class="sec">
    <div class="sec-h"><h2>状态检验</h2><div class="note">检查广度、涨跌停与板块条件是否同时出现</div></div>
    <div class="gitems">${G.items.map(i=>`<div class="gi ${i.tone}"><div class="k">${i.k}</div>
      <div class="v">${i.v}</div><div class="n">${i.note}</div></div>`).join("")}</div>
    <div class="concl" style="margin-top:14px"><b>${G.concl}</b></div>
    <div class="cap">${G.rule}</div>
  </div>`;
}

function sRisk(){
  const lv={"高":"lv-h","中":"lv-m","低":"lv-l"};
  return `<div class="sec">
    <div class="sec-h"><h2>风险提示</h2><div class="note">按对次日情绪的杀伤力排序</div></div>
    <div class="rk">${SEN.risks.map((r,i)=>`<div class="it"><div class="h">
      <span class="lv ${lv[r.lv]||"lv-l"}">${r.lv}</span><b>${i+1}. ${r.t}</b></div>
      <div class="b">${r.b}</div></div>`).join("")}</div>
  </div>`;
}

function sNext(){
  const N=SEN.next;
  return `<div class="sec">
    <div class="sec-h"><h2>次日观察</h2><div class="note">情景推演，不含买卖指令</div></div>
    <div class="scn">${N.scenarios.map(s=>`<div class="c"><div class="tg">${s.tag}</div>
      <div class="cd">${s.cond}</div><div class="bd">${s.b}</div></div>`).join("")}</div>
    <div class="wt">${N.watch.map(w=>`<div class="it"><div class="k">${w.k}</div>
      <div class="v">${w.v}</div><div class="s">${w.s}</div></div>`).join("")}</div>
  </div>`;
}

function sFoot(){
  return `<div class="foot">
    <b>口径说明</b>　复盘层（情绪温度 / 涨跌宽度 / 连板梯队 / 龙虎榜）取最近一个<b>已收盘</b>交易日 ${SEN.date}。
    盘中刷新会自动沿用上一交易日——连板与龙虎榜当日尚未定稿，用未完成的数据算温度会给出错误读数。<br>
    板块强弱为接口实时榜（抓取于 ${SEN.live_at}），该榜不支持历史日期，故与复盘层分列，两者不可混读。<br>
    两融余额按 T+1 披露，当日通常为空，本频道不纳入。<br>
    <b>免责声明</b>　本页为情绪周期的结构化播报与方法论演示，所有判断基于公开数据推演，不构成投资建议或买卖指令。
    文中个股仅用于说明市场结构，不代表推荐。
  </div>`;
}

function renderSentiChart(){
  const el=document.getElementById("schart");
  if(!el||!window.echarts||!SEN) return;
  // 每次重渲染 innerHTML 都会换掉节点，实例必须跟着重新绑定，否则画在已脱离文档的旧节点上
  if(!schart||schartDom!==el){
    if(schart&&schart.dispose){try{schart.dispose();}catch(e){}}
    schart=echarts.init(el); schartDom=el;
  }
  const P=SEN.pulse||[];
  schart.setOption({
    grid:{left:38,right:58,top:28,bottom:26},
    tooltip:{trigger:"axis"},
    xAxis:{type:"category",data:P.map(p=>p.d),
      axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
      axisLabel:{color:"#8a8880",fontSize:11}},
    yAxis:[{type:"value",min:0,max:100,splitLine:{lineStyle:{color:"#eeece6"}},
      axisLabel:{color:"#8a8880",fontSize:10}},
      {type:"value",splitLine:{show:false},axisLabel:{show:false}}],
    series:[
      {name:"涨停家数",type:"bar",yAxisIndex:1,data:P.map(p=>p.lu),
        itemStyle:{color:"#e8e5dd"},barWidth:"44%"},
      {name:"情绪温度",type:"line",data:P.map(p=>p.temp),smooth:true,symbolSize:7,
        lineStyle:{width:2,color:"#1f2328"},itemStyle:{color:"#1f2328"},
        label:{show:true,position:"top",fontSize:10,color:"#5f5e5a"}}
    ]
  });
  schart.resize();
}

function renderSenti(){
  const body=document.getElementById("sentiBody");
  if(!body) return;
  const dEl=document.getElementById("sDate"), tEl=document.getElementById("sTemp"),
        bEl=document.getElementById("sBand");
  if(!SEN){
    dEl.textContent="—"; tEl.textContent="—"; bEl.textContent="—";
    body.innerHTML='<div class="sec-desc" style="margin-top:16px">暂无情绪复盘数据。点右上角「刷新情绪」，取最近一个已收盘交易日。</div>';
    return;
  }
  dEl.textContent=SEN.date+"（"+SEN.weekday+"）";
  tEl.textContent=FU(SEN.temp,1);
  bEl.textContent=SEN.band;
  body.innerHTML=[sThermo(),sPulse(),sBreadth(),sLadder(),sSector(),sInst(),sGap(),sRisk(),sNext(),sFoot()].join("");
  renderSentiChart();
}

/* ================= 美股雷达 ================= */
const UC={up:"#3b6d11",dn:"#a32d2d",flat:"#8a8880"};
const uc=v=>(v>0?UC.up:(v<0?UC.dn:UC.flat));
const ucls=v=>(v>0?"pos":(v<0?"neg":""));
function fngColor(s){
  if(s==null)return "#b4b2a9";
  if(s<25)return "#1f6feb";
  if(s<45)return "#6aa9f0";
  if(s<55)return "#b4b2a9";
  if(s<75)return "#e08b3a";
  return "#d64545";
}
/* 美元金额按 亿/万 显示，8 位数读起来费劲 */
function uAmt(v){
  const n=Number(v);
  if(!n||isNaN(n))return "—";
  if(n>=1e8)return "$"+(n/1e8).toFixed(1)+"亿";
  return "$"+(n/1e4).toFixed(0)+"万";
}
/* 美股公司名动辄 30 个字符，不截断会把整行撑满 */
function uName(s,n=20){
  const t=String(s||"");
  return t.length>n?t.slice(0,n)+"…":t;
}
/* 池标签只显示最有区分度的那一个：标普500 与纳指100 高度重叠，并列没有信息量 */
function uPool(pools){
  if(!pools||!pools.length)return "";
  if(pools.indexOf("中概")>=0)return "中概";
  if(pools.indexOf("道指")>=0)return "道指";
  if(pools.indexOf("纳指100")>=0)return "纳指100";
  return "标普500";
}
const usCharts={};
function usChart(id,opt){
  const el=document.getElementById(id);
  if(!el||!window.echarts)return;
  const old=usCharts[id];
  if(!old||old.dom!==el){
    if(old&&old.dispose){try{old.dispose();}catch(e){}}
    usCharts[id]=echarts.init(el);
    usCharts[id].dom=el;
  }
  usCharts[id].setOption(opt,true);
  usCharts[id].resize();
}

/* ① 恐惧贪婪 */
function uFng(){
  const F=USS.fng;
  if(!F){
    return `<div class="sec"><div class="sec-h"><h2>① 恐惧贪婪指数</h2></div>
      <div class="sec-desc">CNN 恐惧贪婪指数本次未取到（接口反爬或网络异常）。其余模块不受影响，可稍后重试。</div></div>`;
  }
  const p=F.score;
  const prev=[["前收盘",F.prev_close],["一周前",F.prev_week],
              ["一个月前",F.prev_month],["一年前",F.prev_year]];
  const parts=(F.parts||[]).map(x=>`<div class="fp" title="${x.desc}">
    <span class="k">${x.k}</span>
    <span class="bar"><i style="width:${Math.max(2,Math.min(100,x.score||0))}%;background:${fngColor(x.score)}"></i></span>
    <span class="v" style="color:${fngColor(x.score)}">${FU(x.score,1)}</span></div>`).join("");
  return `<div class="sec">
    <div class="sec-h"><h2>① 恐惧贪婪指数 · 美股全市场</h2>
      <div class="note">CNN Fear &amp; Greed ｜ 读数 ${F.date} ｜ 已存档 ${F.archive_days||0} 天</div></div>
    <div class="sec-desc">这是<b>标普 500 全市场</b>的情绪读数，不是纳指或半导体自己的情绪。它由 7 个分项合成，
      每个分项本身也是 0–100 的排名，越低越恐惧。分项比总分更有信息量——总分 26 分，
      但可能是「宽度还行、只是避险极端」。</div>
    <div class="card">
      <div class="fng">
        <div class="col">
          <div class="fnum" style="color:${fngColor(p)}">${FU(p,1)}</div>
          <span class="frate" style="background:${fngColor(p)}18;color:${fngColor(p)}">${F.label}</span>
          <div class="fmeter"><div class="mk" style="left:${Math.max(1,Math.min(99,p||0))}%"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);
               font-family:ui-monospace,Consolas,monospace;margin-top:7px">
            <span>0 极度恐惧</span><span>100 极度贪婪</span></div>
          <div class="fprev">${prev.map(x=>`<span class="k">${x[0]}</span>
            <span class="v" style="color:${fngColor(x[1])}">${FU(x[1],1)}</span>`).join("")}</div>
        </div>
        <div class="col">
          <div style="font-size:12px;font-weight:600;margin-bottom:11px">七个分项</div>
          <div class="fparts">${parts}</div>
          <div class="cap" style="margin-top:11px">鼠标移到分项名称上可看该项含义。全部为当日最新读数，未做历史分位。</div>
        </div>
        <div class="col">
          <div style="font-size:12px;font-weight:600;margin-bottom:2px">近一年走势</div>
          <div id="usfchart"></div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ② 涨跌榜 */
function uRank(){
  const mk=(list,cls)=>list.map((x,i)=>`<div class="it">
    <span class="no">${i+1}</span>
    <span class="nm">${uName(x.name)}<em>${String(x.code||"").replace(/^us/,"")}</em><span class="ptag">${uPool(x.pools)}</span></span>
    <span class="ch" style="color:${uc(x.chg)}">${SG(x.chg,2)}%</span>
    <span class="am">${uAmt(x.amt)}</span></div>`).join("");
  const U=USS.universe||{};
  return `<div class="sec">
    <div class="sec-h"><h2>② 涨跌榜</h2>
      <div class="note">道指 30 + 标普500 503 + 纳指100 101 + 中概 ${U.cn_kept||0} 只，去重 ${U.total||0} 只</div></div>
    <div class="sec-desc">涨跌幅为当日收盘口径，成交额单位美元。<b>中概池已按成交额 ≥ 500 万美元过滤</b>——
      全池 466 只里大量是粉单和仙股，不过滤的话榜首永远是成交额为零的壳股。</div>
    <div class="two" style="margin-top:0">
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:8px;color:${UC.up}">涨幅前十</div>
        <div class="rk2">${mk(USS.gainers||[],"pos")}</div></div>
      <div class="card"><div style="font-size:12px;font-weight:600;margin-bottom:8px;color:${UC.dn}">跌幅前十</div>
        <div class="rk2">${mk(USS.losers||[],"neg")}</div></div>
    </div>
  </div>`;
}

/* ③ 板块热力 */
function uSector(){
  const S=USS.sectors||[];
  const rows=S.map(s=>{
    const pos=(s.pos52==null?null:Math.max(0,Math.min(100,s.pos52)));
    return `<tr>
      <td>${s.name}</td>
      <td class="${ucls(s.chg)}"><b>${SG(s.chg,2)}%</b></td>
      <td class="${ucls(s.chg5)}">${SG(s.chg5,2)}</td>
      <td class="${ucls(s.chg20)}">${SG(s.chg20,2)}</td>
      <td class="${ucls(s.chg60)}">${SG(s.chg60,2)}</td>
      <td class="${ucls(s.ytd)}">${SG(s.ytd,1)}</td>
      <td><div style="display:flex;align-items:center;gap:7px;justify-content:flex-end">
        <span style="flex:1;max-width:64px;height:5px;background:#f0eee8;border-radius:3px;overflow:hidden;display:block">
          <i style="display:block;height:100%;width:${pos||0}%;background:${pos>=80?"#e08b3a":(pos<=20?"#6aa9f0":"#b4b2a9")};border-radius:3px"></i></span>
        <span style="font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--ink3);width:30px;text-align:right">${pos==null?"—":pos.toFixed(0)+"%"}</span>
      </div></td></tr>`;
  }).join("");
  const top=S[0], bot=S[S.length-1];
  return `<div class="sec">
    <div class="sec-h"><h2>③ 板块热力 · 11 个 SPDR 行业</h2>
      <div class="note">按当日涨跌幅排序 ｜ 末列为 52 周区间位置</div></div>
    <div class="sec-desc">板块是判断「钱从哪走到哪」最直接的一层。当日最强 <b>${top?top.name:"—"}</b>
      （${SG(top?top.chg:null,2)}%），最弱 <b>${bot?bot.name:"—"}</b>（${SG(bot?bot.chg:null,2)}%）。
      52 周位置 =（现价 − 52 周低）÷（52 周高 − 低），越接近 100 越靠近一年最高。</div>
    <div class="card" style="padding:6px 18px 14px">
      <table><thead><tr><th>板块</th><th>当日</th><th>5 日</th><th>20 日</th><th>60 日</th>
        <th>年初至今</th><th>52 周位置</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  </div>`;
}

/* ④ 涨跌家数 */
function uBreadth(){
  const P=(USS.breadth||{}).pools||[];
  const A=(USS.breadth||{}).all||{};
  const row=p=>{
    const t=p.total||1;
    const w=n=>Math.max(0,n/t*100);
    return `<div class="r">
      <span class="nm">${p.name}</span>
      <span class="bar">
        <div style="width:${w(p.up)}%;background:#3b6d11">${p.up>=10?p.up:""}</div>
        <div style="width:${w(p.down)}%;background:#a32d2d">${p.down>=10?p.down:""}</div>
        <div style="width:${w(p.flat)}%;background:#d3d1c7">${p.flat>=10?p.flat:""}</div>
      </span>
      <span class="n">涨 <b class="pos">${p.up}</b> / 跌 <b class="neg">${p.down}</b>
        　±5% <b class="pos">${p.p5}</b>/<b class="neg">${p.m5}</b></span>
    </div>`;
  };
  return `<div class="sec">
    <div class="sec-h"><h2>④ 涨跌家数</h2>
      <div class="note">${A.up||0} 涨 / ${A.down||0} 跌 / ${A.flat||0} 平</div></div>
    <div class="sec-desc">美股没有涨跌停，所以 A 股温度计里的「涨停 / 跌停」这一项在这里换成
      <b>涨跌超 5% 的家数</b>——含义接近（极端个股的赚钱与亏钱效应），而且用同一批成分股算，自己就能解释。
      合计行对四池去重后统计，不能把上面四行直接相加。</div>
    <div class="card">
      <div class="brw">${P.map(row).join("")}
        <div class="r" style="border-top:1px solid var(--line);padding-top:10px;margin-top:2px">
          <span class="nm">${A.name||"合计"}</span>
          <span class="bar">
            <div style="width:${(A.up/(A.total||1)*100).toFixed(1)}%;background:#3b6d11">${A.up>=10?A.up:""}</div>
            <div style="width:${(A.down/(A.total||1)*100).toFixed(1)}%;background:#a32d2d">${A.down>=10?A.down:""}</div>
            <div style="width:${(A.flat/(A.total||1)*100).toFixed(1)}%;background:#d3d1c7">${A.flat>=10?A.flat:""}</div>
          </span>
          <span class="n">涨 <b class="pos">${A.up}</b> / 跌 <b class="neg">${A.down}</b>
            　±5% <b class="pos">${A.p5}</b>/<b class="neg">${A.m5}</b></span>
        </div>
      </div>
      <div class="dleg" style="margin-top:14px">
        <span><i style="background:#3b6d11"></i>上涨</span>
        <span><i style="background:#a32d2d"></i>下跌</span>
        <span><i style="background:#d3d1c7"></i>平盘</span>
        ${P.filter(p=>p.hint).map(p=>`<span class="dim">${p.name}：${p.hint}</span>`).join("")}
      </div>
    </div>
  </div>`;
}

/* ⑤⑥ 防御 vs 进攻 + Mag7 */
function uDefMag(){
  const D=USS.defensive||{};
  const R=D.rel||{};
  const M=USS.mag||{};
  const diff=(D.def_now!=null&&D.off_now!=null)?(D.def_now-D.off_now):null;
  const tone=diff==null?"":(diff>0?"防御占优（risk-off）":"进攻占优（risk-on）");
  const rows=(M.rows||[]).map(m=>{
    const w=Math.max(0,Math.min(100,(m.w||0)*4));
    return `<div class="it">
      <span class="nm">${m.name}</span>
      <span class="wb"><i style="width:${w}%"></i></span>
      <span class="ch" style="color:${uc(m.chg)}">${SG(m.chg,2)}%</span>
      <span class="ct">${SG(m.contrib,2)}</span></div>`;
  }).join("");
  const gap=(M.avg!=null&&M.qqq!=null)?(M.avg-M.qqq):null;
  return `<div class="sec">
    <div class="two" style="margin-top:0">
      <div class="card">
        <div class="card-h"><span class="nm">⑤ 防御 vs 进攻</span>
          <span class="dt">XLU+XLP+XLV ／ XLK+XLY+XLC</span></div>
        <div class="sec-desc" style="margin-bottom:8px">比值上行 = 钱在往公用事业、必需消费、医疗这些「不怕衰退」的地方躲；
          下行 = 钱在往科技、可选消费、通讯这些「博增长」的地方冲。这是判断 risk-on / risk-off 最直接的一组。</div>
        <div id="usdchart"></div>
        <div class="tkpi" style="grid-template-columns:repeat(4,1fr);margin-top:12px">
          <div class="k"><div class="n" style="color:${uc(D.def_now)}">${SG(D.def_now,2)}</div><div class="l">防御当日</div></div>
          <div class="k"><div class="n" style="color:${uc(D.off_now)}">${SG(D.off_now,2)}</div><div class="l">进攻当日</div></div>
          <div class="k"><div class="n" style="color:${uc(R.r20)}">${SG(R.r20,1)}</div><div class="l">20 日相对</div></div>
          <div class="k"><div class="n" style="color:${uc(R.r60)}">${SG(R.r60,1)}</div><div class="l">60 日相对</div></div>
        </div>
        <div class="concl" style="margin-top:11px">${tone?`<b>${tone}</b>：`:"暂无当日对比。"}
          防御组平均 ${SG(D.def_now,2)}%，进攻组平均 ${SG(D.off_now,2)}%，相差 ${SG(diff,2)} 个百分点。
          ${(R.r20==null)?"":(R.r20>0
              ? `近 20 日防御组跑赢 ${Math.abs(R.r20).toFixed(1)} 个百分点。`
              : `近 20 日进攻组跑赢 ${Math.abs(R.r20).toFixed(1)} 个百分点。`)}
          ${(R.r20||0)>8?"防御连续跑赢的幅度已经不小，属于典型的资金撤离风险资产。":""}</div>
      </div>
      <div class="card">
        <div class="card-h"><span class="nm">⑥ Mag7 贡献度</span>
          <span class="dt">市值加权 ${SG(M.avg,2)}% ｜ QQQ ${SG(M.qqq,2)}%</span></div>
        <div class="sec-desc" style="margin-bottom:8px">七巨头按市值加权平均涨跌，与 QQQ 实际涨跌对比。
          如果 Mag7 明显强于 QQQ，说明拖累来自七巨头之外的中小成分；反之则是巨头在砸盘。</div>
        <div class="mg7">${rows}</div>
        <div class="concl" style="margin-top:11px">Mag7 加权 ${SG(M.avg,2)}%，QQQ ${SG(M.qqq,2)}%，
          <b>${gap==null?"—":(gap>0?`七巨头比指数抗跌 ${Math.abs(gap).toFixed(2)} 个百分点`:`七巨头比指数多跌 ${Math.abs(gap).toFixed(2)} 个百分点`)}</b>。
          最后一列是各股对 Mag7 组合涨跌的贡献（百分点），正负相抵后等于加权涨幅。</div>
      </div>
    </div>
  </div>`;
}

/* ⑦⑧ 半导体 + 新高新低 */
function uSemiHigh(){
  const S=USS.semi||{};
  const R=S.rel||{};
  const L=S.soxx||{}, P=S.spy||{};
  const H=USS.highlow||{};
  const nh=H.nh||0, nl=H.nl||0;
  const ratio=(H.total&&H.total>0)?((nh-nl)/H.total*100):0;
  const li=(x,cls)=>`<div class="it" style="grid-template-columns:1fr 56px">
    <span class="nm">${x.name}<em>${String(x.code||"").replace(/^us/,"")}</em></span>
    <span class="ch" style="color:${uc(x.ytd)}">${SG(x.ytd,1)}%</span></div>`;
  return `<div class="sec">
    <div class="two" style="margin-top:0">
      <div class="card">
        <div class="card-h"><span class="nm">⑦ 半导体相对强弱</span><span class="dt">SOXX ÷ SPY</span></div>
        <div class="sec-desc" style="margin-bottom:8px">半导体是这轮行情的高 beta 端。这条比值线往上，
          说明资金愿意承担更高波动去博成长；往下则是撤离。它比单看 SOXX 涨跌更干净——已经剔除了大盘的影响。</div>
        <div id="usschart"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;font-size:11.5px">
          <div style="background:#faf9f6;border-radius:8px;padding:10px 12px">
            <div style="color:var(--ink3);font-size:10.5px;margin-bottom:4px">SOXX 当日 / 20 日 / 60 日</div>
            <div style="font-family:ui-monospace,Consolas,monospace;font-weight:600">
              <span style="color:${uc(L.chg)}">${SG(L.chg,2)}</span> /
              <span style="color:${uc(L.chg20)}">${SG(L.chg20,1)}</span> /
              <span style="color:${uc(L.chg60)}">${SG(L.chg60,1)}</span></div>
          </div>
          <div style="background:#faf9f6;border-radius:8px;padding:10px 12px">
            <div style="color:var(--ink3);font-size:10.5px;margin-bottom:4px">SPY 当日 / 20 日 / 60 日</div>
            <div style="font-family:ui-monospace,Consolas,monospace;font-weight:600">
              <span style="color:${uc(P.chg)}">${SG(P.chg,2)}</span> /
              <span style="color:${uc(P.chg20)}">${SG(P.chg20,1)}</span> /
              <span style="color:${uc(P.chg60)}">${SG(P.chg60,1)}</span></div>
          </div>
        </div>
        <div class="concl" style="margin-top:11px">近 20 个交易日半导体${(R.r20||0)>0?"跑赢":"跑输"}标普 500
          <b>${Math.abs(R.r20||0).toFixed(1)}</b> 个百分点，近 5 日 ${SG(R.r5,1)}，近 60 日 ${SG(R.r60,1)}。
          ${(R.r20||0)<-10?"20 日跑输超过 10 个百分点，是明确的资金撤离，不是普通回调。":""}</div>
      </div>
      <div class="card">
        <div class="card-h"><span class="nm">⑧ 52 周新高 / 新低</span>
          <span class="dt">主池 ${H.total||0} 只</span></div>
        <div class="sec-desc" style="margin-bottom:10px">统计现价距 52 周高点 0.5% 以内、距低点 0.5% 以内的只数。
          涨跌家数会被震荡来回洗，新高新低更能看出趋势是否在转折。</div>
        <div class="hl2">
          <div class="b"><div class="v" style="color:${UC.up}">${nh}</div><div class="t">创 52 周新高</div></div>
          <div class="b"><div class="v" style="color:${UC.dn}">${nl}</div><div class="t">创 52 周新低</div></div>
        </div>
        <div class="concl" style="margin-top:11px">净值 ${nh>nl?"+":""}${nh-nl} 只，
          占主池 ${ratio.toFixed(1)}%。全池在 52 周区间中的中位位置为 <b>${FU(H.med_pos,0)}%</b>
          ——${(H.med_pos||0)>=70?"整体仍在高位，回落属于高位震荡":(H.med_pos||0)>=40?"中位区间，方向不明":"整体已跌到偏低位置"}。</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div><div style="font-size:11px;font-weight:600;margin-bottom:6px;color:${UC.up}">新高（按市值）</div>
            <div class="rk2">${(H.hi_sample||[]).map(x=>li(x,"pos")).join("")||'<span class="dim" style="font-size:11px">无</span>'}</div></div>
          <div><div style="font-size:11px;font-weight:600;margin-bottom:6px;color:${UC.dn}">新低（按市值）</div>
            <div class="rk2">${(H.lo_sample||[]).map(x=>li(x,"neg")).join("")||'<span class="dim" style="font-size:11px">无</span>'}</div></div>
        </div>
        <div class="cap">列表里的百分比是年初至今涨幅，不是当日。</div>
      </div>
    </div>
  </div>`;
}

function uFoot(){
  const U=USS.universe||{};
  return `<div class="foot">
    <b>口径与来源</b>　行情：腾讯自选股（westock）批量接口；情绪：CNN Fear &amp; Greed（
    production.dataviz.cnn.io）。<b>恐惧贪婪只取当日最新读数，不做历史分位</b>——CNN 只提供 1 年序列，
    251 个点不足以支撑有意义的长期分位，因此每日存一份快照到本地，攒够样本再谈分位。<br>
    <b>三个不能混读的地方</b>　① 恐惧贪婪衡量<b>标普 500 全市场</b>，不是纳指或半导体，会出现「指数在涨、
    情绪在恐惧」的背离；② CNN 的 0–100 与「A股雷达」页自建的温度计算法完全无关，两者只能各看趋势，
    <b>绝不能放在一张图上比高低</b>；③ 中概池按成交额 ≥ 500 万美元过滤，与美股主池的入选标准不同，
    宽度数字不能直接互比。当前合计 ${U.total||0} 只（主池 ${U.main||0} + 中概 ${U.cn_kept||0}/${U.cn_raw||0}）。<br>
    <b>涨跌榜池子</b>　道指 30 只、标普 500 503 只、纳指 100 101 只，三者高度重叠（纳指 100 与道指几乎全部
    包含在标普 500 内），去重后为 ${U.main||0} 只；中概另计。榜单已剔除名称含 ETF / ETN 的品种。<br>
    <span style="color:#8a8880">本页为市场情绪与结构的客观播报，所有判断基于公开数据推演，不构成投资建议或买卖指令。
    提及个股仅用于说明市场结构，不代表推荐。行情存在延迟，盘后与盘中读数不同属正常。</span>
  </div>`;
}

function renderUSChart(){
  const F=USS.fng;
  if(F&&F.history&&F.history.length){
    usChart("usfchart",{
      grid:{left:30,right:10,top:14,bottom:20},
      tooltip:{trigger:"axis",backgroundColor:"#fff",borderColor:"#e6e4de",
        textStyle:{color:"#1f2328",fontSize:11},
        formatter:p=>`${p[0].axisValue}<br>F&amp;G <b>${p[0].data}</b>`},
      xAxis:{type:"category",data:F.history.map(x=>x.d),boundaryGap:false,
        axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
        axisLabel:{color:"#8a8880",fontSize:9.5,
          interval:Math.max(1,Math.floor(F.history.length/4))}},
      yAxis:{type:"value",min:0,max:100,splitLine:{lineStyle:{color:"#f2f0ea"}},
        axisLabel:{color:"#8a8880",fontSize:9.5}},
      series:[{type:"line",data:F.history.map(x=>x.v),symbol:"none",
        lineStyle:{width:1.6,color:"#1f2328"},
        areaStyle:{color:"rgba(31,35,40,0.06)"},
        markLine:{silent:true,symbol:"none",animation:false,
          data:[{yAxis:25,lineStyle:{color:"#6aa9f0",type:"dashed",width:1},label:{show:false}},
                {yAxis:75,lineStyle:{color:"#e08b3a",type:"dashed",width:1},label:{show:false}}]}}]
    });
  }
  const D=(USS.defensive||{}).curve||[];
  if(D.length){
    usChart("usdchart",{
      grid:{left:36,right:10,top:14,bottom:20},
      tooltip:{trigger:"axis",backgroundColor:"#fff",borderColor:"#e6e4de",
        textStyle:{color:"#1f2328",fontSize:11},
        formatter:p=>`${p[0].axisValue}<br>防御 ÷ 进攻 <b>${p[0].data}</b>`},
      xAxis:{type:"category",data:D.map(x=>x.d),boundaryGap:false,
        axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
        axisLabel:{color:"#8a8880",fontSize:9.5,interval:Math.max(1,Math.floor(D.length/4))}},
      yAxis:{type:"value",scale:true,splitLine:{lineStyle:{color:"#f2f0ea"}},
        axisLabel:{color:"#8a8880",fontSize:9.5}},
      series:[{type:"line",data:D.map(x=>x.v),symbol:"none",smooth:true,
        lineStyle:{width:2,color:"#8a3fb8"},
        areaStyle:{color:"rgba(138,63,184,0.07)"},
        markLine:{silent:true,symbol:"none",animation:false,
          data:[{yAxis:100,lineStyle:{color:"#d3d1c7",type:"dashed",width:1},
                 label:{formatter:"起点 100",position:"insideEndTop",fontSize:9.5,
                        color:"#8a8880",backgroundColor:"#fff",padding:[1,3]}}]}}]
    });
  }
  const S=(USS.semi||{}).curve||[];
  if(S.length){
    usChart("usschart",{
      grid:{left:36,right:10,top:14,bottom:20},
      tooltip:{trigger:"axis",backgroundColor:"#fff",borderColor:"#e6e4de",
        textStyle:{color:"#1f2328",fontSize:11},
        formatter:p=>`${p[0].axisValue}<br>SOXX ÷ SPY <b>${p[0].data}</b>`},
      xAxis:{type:"category",data:S.map(x=>x.d),boundaryGap:false,
        axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
        axisLabel:{color:"#8a8880",fontSize:9.5,interval:Math.max(1,Math.floor(S.length/4))}},
      yAxis:{type:"value",scale:true,splitLine:{lineStyle:{color:"#f2f0ea"}},
        axisLabel:{color:"#8a8880",fontSize:9.5}},
      series:[{type:"line",data:S.map(x=>x.v),symbol:"none",smooth:true,
        lineStyle:{width:2,color:"#1f6feb"},
        areaStyle:{color:"rgba(31,111,235,0.07)"},
        markLine:{silent:true,symbol:"none",animation:false,
          data:[{yAxis:100,lineStyle:{color:"#d3d1c7",type:"dashed",width:1},
                 label:{formatter:"起点 100",position:"insideEndTop",fontSize:9.5,
                        color:"#8a8880",backgroundColor:"#fff",padding:[1,3]}}]}}]
    });
  }
}

function renderUS(){
  const body=document.getElementById("usBody");
  if(!body) return;
  const dEl=document.getElementById("uDate"), pEl=document.getElementById("uPhase"),
        uEl=document.getElementById("uUni"), fEl=document.getElementById("uFng");
  if(!USS){
    if(dEl)dEl.textContent="—";
    if(pEl)pEl.textContent="—";
    if(uEl)uEl.textContent="—";
    if(fEl)fEl.textContent="—";
    body.innerHTML='<div class="sec-desc" style="margin-top:16px">暂无美股数据。点右上角「刷新美股」取最新快照。</div>';
    return;
  }
  dEl.textContent=USS.date||"—";
  pEl.textContent=USS.phase||"—";
  uEl.textContent=(USS.universe||{}).total||"—";
  const F=USS.fng;
  fEl.textContent=F?`${FU(F.score,1)} ${F.label}`:"—";
  body.innerHTML=[uFng(),uRank(),uSector(),uBreadth(),uDefMag(),uSemiHigh(),uFoot()].join("");
  renderUSChart();
}

/* ================= 港股全景 ================= */
const hkCharts={};
function hkChart(id,opt){
  const el=document.getElementById(id);
  if(!el||!window.echarts)return;
  const old=hkCharts[id];
  if(!old||old.dom!==el){
    if(old&&old.dispose){try{old.dispose();}catch(e){}}
    hkCharts[id]=echarts.init(el);
    hkCharts[id].dom=el;
  }
  hkCharts[id].setOption(opt,true);
  hkCharts[id].resize();
}
function hAmt(v){
  const n=Number(v);
  if(!n||isNaN(n))return "—";
  if(n>=1e8)return (n/1e8).toFixed(1)+"亿";
  if(n>=1e4)return (n/1e4).toFixed(0)+"万";
  return String(Math.round(n));
}
function hName(s,n=12){
  const t=String(s||"");
  return t.length>n?t.slice(0,n)+"…":t;
}
/* 位置/动能/量能三条都用同一色带：低=冷（蓝）→ 高=热（红），与 A 股页一致 */
function hBand(v){
  if(v==null)return "#b4b2a9";
  if(v<=15)return "#1f6feb";
  if(v<=30)return "#6aa9f0";
  if(v<=70)return "#b4b2a9";
  if(v<=85)return "#e08b3a";
  return "#d64545";
}
function hBar(label,v){
  const w=(v==null?0:Math.max(0,Math.min(100,v)));
  return `<div style="display:grid;grid-template-columns:34px 1fr 42px;gap:8px;align-items:center;margin-top:5px">
    <span style="font-size:10.5px;color:var(--ink3)">${label}</span>
    <span style="height:6px;background:#f2f0ea;border-radius:3px;overflow:hidden">
      <i style="display:block;height:100%;width:${w}%;background:${hBand(v)}"></i></span>
    <span style="font-size:11px;font-family:ui-monospace,Consolas,monospace;text-align:right">${v==null?"—":v.toFixed(1)}</span></div>`;
}

/* ① 三指数温度 */
function hTemp(){
  const I=HKS.indices||[];
  if(!I.length) return "";
  const cards=I.map(d=>`
    <div class="card" style="padding:14px 16px">
      <div class="card-h" style="margin-bottom:6px">
        <span class="nm">${d.name}</span>
        <span class="dt">${d.code}</span></div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-size:20px;font-weight:600;font-family:ui-monospace,Consolas,monospace;letter-spacing:-.5px">${d.close.toFixed(2)}</span>
        <span style="font-size:12px;color:${uc(d.chg)}">${SG(d.chg,2)}%</span></div>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:10px">
        <span style="font-size:26px;font-weight:600;font-family:ui-monospace,Consolas,monospace;letter-spacing:-.8px;color:${hBand(d.heat)}">${d.heat==null?"—":d.heat.toFixed(1)}</span>
        <span style="font-size:10.5px;color:var(--ink3)">热度（位置5 动能3 量能2）</span></div>
      ${hBar("位置",d.pos)}${hBar("动能",d.mom)}${hBar("量能",d.volx_pr)}
      <div style="font-size:10px;color:var(--ink3);margin-top:9px;line-height:1.5">
        距一年高点 ${SG(d.dd250,1)}%　RSI6 ${SG(d.rsi6,1)}<br>${d.n} 日样本 ${d.start}~${d.end}</div>
    </div>`).join("");
  return `<div class="sec" style="margin-top:18px">
    <div class="sec-h"><h2>① 三指数温度</h2><div class="note">位置与动能可跨页比，热度不可</div></div>
    <div class="sec-desc">港股没有 CNN 那种现成情绪指数，这三个数是从指数自身的日线里算出来的：
      <b>位置</b>看现在站在近一年什么位置，<b>动能</b>看最近 10 天推进得多快，<b>量能</b>看成交额相对自身 20 日均额放大了多少倍。
      三项都是 250 日滚动分位（0=最冷，100=最热）。<b>热度是本页自建的合成分，权重与 A 股总分不同，两页的 60 分不是一回事，不能横比。</b></div>
    <div style="display:grid;grid-template-columns:repeat(${I.length},1fr);gap:14px;margin-top:14px">${cards}</div>
  </div>`;
}

/* ② 广度 + ③ 涨跌榜 */
function hBreadthRank(){
  const B=HKS.breadth||{}; const A=B.all||{};
  const rows=[
    ["涨",A.up,"up"],["跌",A.down,"dn"],["平",A.flat,"flat"]];
  const bars=rows.map(([k,v,c])=>{
    const pct=A.n?((v/A.n)*100):0;
    return `<div style="display:grid;grid-template-columns:24px 1fr 52px;gap:8px;align-items:center;margin-top:6px">
      <span style="font-size:11px;color:var(--ink3)">${k}</span>
      <span style="height:8px;background:#f2f0ea;border-radius:4px;overflow:hidden">
        <i style="display:block;height:100%;width:${pct}%;background:${UC[c]}"></i></span>
      <span style="font-size:11px;font-family:ui-monospace,Consolas,monospace;text-align:right">${v} 只</span></div>`;
  }).join("");
  const poolRows=(B.pools||[]).map(p=>`<div class="it" style="grid-template-columns:1fr 48px 48px 48px">
      <span class="nm">${p.name}<em>${p.n}</em></span>
      <span class="ch" style="color:${UC.up}">${p.up}</span>
      <span class="ch" style="color:${UC.dn}">${p.down}</span>
      <span class="ch" style="color:${UC.flat}">${p.flat}</span></div>`).join("");
  const list=(arr)=>arr.map(r=>`<div class="it" style="grid-template-columns:1fr 56px 66px">
      <span class="nm">${hName(r.name)}<em>${String(r.code).replace(/^hk/,"")}</em></span>
      <span class="ch" style="color:${uc(r.chg)}">${SG(r.chg,2)}%</span>
      <span class="ct">${hAmt(r.amt)}</span></div>`).join("");
  return `<div class="sec">
    <div class="two" style="margin-top:0">
      <div class="card">
        <div class="card-h"><span class="nm">② 涨跌家数</span><span class="dt">并集 ${A.n||0} 只 ｜ 涨超5% ${A.p5||0} 跌超5% ${A.m5||0}</span></div>
        <div class="sec-desc" style="margin-bottom:8px">港股没有涨跌停，所以用 ±5% 替代 A 股的涨跌停口径，
          看的是极端两端有没有失控。下面三个池子重复度很高（恒生科技 30 只几乎全在恒指里），
          分池数字只用于看结构，不要相加。</div>
        ${bars}
        <div style="display:grid;grid-template-columns:1fr 48px 48px 48px;gap:8px;margin-top:14px;padding-top:10px;border-top:1px solid var(--line2);font-size:10px;color:var(--ink3)">
          <span>分池</span><span style="text-align:right">涨</span><span style="text-align:right">跌</span><span style="text-align:right">平</span></div>
        ${poolRows}
        <div class="tkpi" style="grid-template-columns:repeat(4,1fr);margin-top:14px">
          <div class="k"><div class="n">${A.near_hi||0}</div><div class="l">距一年高点 &lt;3%</div></div>
          <div class="k"><div class="n">${A.far_hi||0}</div><div class="l">回撤 &gt;30%</div></div>
          <div class="k"><div class="n">${A.up20==null?"—":A.up20.toFixed(0)+"%"}</div><div class="l">20 日收益为正</div></div>
          <div class="k"><div class="n">${A.up60==null?"—":A.up60.toFixed(0)+"%"}</div><div class="l">60 日收益为正</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><span class="nm">③ 涨跌榜</span><span class="dt">成交额 ≥ ${hAmt(HKS.min_amt)}</span></div>
        <div class="sec-desc" style="margin-bottom:10px">已按成交额门槛过滤。港股有大量成交额为 0 的仙股，
          不设门槛的话涨幅榜前排全是 0.01 元跳到 0.02 元的品种，看起来涨了 100%，实际一分钱都没成交。</div>
        <div style="font-size:10.5px;color:var(--ink3);margin-bottom:2px">涨幅前 10</div>
        ${list(HKS.gainers||[])}
        <div style="font-size:10.5px;color:var(--ink3);margin:12px 0 2px">跌幅前 10</div>
        ${list(HKS.losers||[])}
      </div>
    </div>
  </div>`;
}

/* ④ 沽空压力 */
function hShort(){
  const S=HKS.short||{};
  const B=S.bins||{};
  const deg=S.degraded;
  const top=(S.top||[]).map(x=>`<div class="it" style="grid-template-columns:1fr 60px">
      <span class="nm">${hName(x.name)}<em>${String(x.code).replace(/^hk/,"")}</em></span>
      <span class="ch" style="color:${x.ratio>=30?UC.dn:UC.flat}">${x.ratio.toFixed(1)}%</span></div>`).join("");
  const diff=(S.ratio!=null&&S.ratio20!=null)?(S.ratio-S.ratio20):null;
  return `<div class="sec">
    <div class="two" style="margin-top:0">
      <div class="card">
        <div class="card-h"><span class="nm">④ 沽空压力</span><span class="dt">${S.date||"—"}　金额加权</span></div>
        <div class="sec-desc" style="margin-bottom:8px">港股每天披露卖空成交，这是全项目唯一一个<b>官方口径</b>的情绪指标——
          A 股没有，美股虽有但不在本页。沽空率高不代表要跌，代表<b>有空头在押注下跌、也有人在对冲</b>，
          通常伴随分歧放大与波动上升。这里用「Σ卖空金额 ÷ Σ成交额」聚合，与个股 ShortRatio 口径一致。</div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <span style="font-size:32px;font-weight:600;font-family:ui-monospace,Consolas,monospace;letter-spacing:-1px;color:${S.ratio>=30?UC.dn:(S.ratio>=15?UC.flat:UC.up)}">${S.ratio==null?"—":S.ratio.toFixed(2)}%</span>
          <span style="font-size:11px;color:var(--ink3)">池内加权沽空率</span></div>
        <div class="tkpi" style="grid-template-columns:repeat(4,1fr);margin-top:14px">
          <div class="k"><div class="n">${S.med==null?"—":S.med.toFixed(1)+"%"}</div><div class="l">个股中位数</div></div>
          <div class="k"><div class="n">${S.ratio20==null?"—":S.ratio20.toFixed(1)+"%"}</div><div class="l">基线（${S.base_n||0} 日）</div></div>
          <div class="k"><div class="n" style="color:${UC.dn}">${B.hi||0}</div><div class="l">沽空率 ≥30%</div></div>
          <div class="k"><div class="n" style="color:${UC.up}">${B.lo||0}</div><div class="l">沽空率 &lt;10%</div></div>
        </div>
        ${deg?`<div class="concl" style="background:#fdf6ec;color:#8a5a12;margin-top:12px">
          <b>本模块降级：</b>接口批次成功率仅 ${S.cover}%，样本不完整。沽空率按剩余样本计算，仅供参考，不建议据此判断。</div>`:""}
        <div class="concl" style="margin-top:12px">${(S.ratio20==null||S.ratio==null)
          ? `基线还在积累（当前 ${S.base_n||0} 个交易日）。沽空接口按「区间」拉取会被限频到连发三批就掉，
             所以改成每天存一条、由归档自然攒出 20 日均值——这个数从今天起只会越来越准。`
          : `当前 ${S.ratio.toFixed(2)}% 对基线 ${S.ratio20.toFixed(2)}%，
             <b>${diff>0?"高":"低"} ${Math.abs(diff).toFixed(2)} 个百分点</b>。
             ${diff>5?"空头明显加压，属于情绪转弱信号。":(diff<-5?"空头在撤退，压力缓解。":"与近 20 日基线基本持平。")}`}</div>
      </div>
      <div class="card">
        <div class="card-h"><span class="nm">沽空率最高的 5 只</span><span class="dt">池内 ${S.n||0} 只有读数</span></div>
        <div class="sec-desc" style="margin-bottom:10px">只看绝对高低容易被小盘股带偏——它们的成交额小，
          一笔卖空就能把比例顶上去。这里原样列出，不做权重调整，用途是<b>找分歧最大的名字</b>，不是选股。</div>
        ${top||'<div class="sec-desc">暂无数据</div>'}
      </div>
    </div>
  </div>`;
}

/* ⑤ 南向 + ⑥ 结构强弱 */
function hSouthCoef(){
  const S=HKS.south||{};
  const C=HKS.coef||{};
  const items=(S.top||[]).map(x=>{
    const w=S.total?Math.max(2,(x.amt/S.total)*100):2;
    return `<div class="it" style="grid-template-columns:1fr 78px">
      <span class="nm">${hName(x.name)}<em>${String(x.code).replace(/^hk/,"")}</em></span>
      <span class="ct" style="text-align:right">${hAmt(x.amt)}</span></div>
      <div style="height:4px;background:#f2f0ea;border-radius:2px;margin:-2px 0 6px">
        <i style="display:block;height:100%;width:${w}%;background:#8a3fb8;border-radius:2px"></i></div>`;
  }).join("");
  const up=(C.chg==null)?null:(C.chg>0);
  return `<div class="sec">
    <div class="two" style="margin-top:0">
      <div class="card">
        <div class="card-h"><span class="nm">⑤ 南下资金活跃度</span><span class="dt">${S.date||"—"}　Top10 合计 ${hAmt(S.total)}</span></div>
        <div class="sec-desc" style="margin-bottom:8px">用的是「成交活跃榜」而不是「净买入」。
          净买入接口（东财 kamt）收盘后返回值恒等于当日额度 420 亿，不是真实净流入，不可展示。
          成交活跃度虽然不是方向，但它能回答另一个问题：<b>南向今天在哪些票上最有存在感</b>。</div>
        ${items||'<div class="sec-desc">暂无数据</div>'}
      </div>
      <div class="card">
        <div class="card-h"><span class="nm">⑥ 结构强弱</span><span class="dt">恒生科技 ÷ 恒生指数</span></div>
        <div class="sec-desc" style="margin-bottom:8px">港股没有可用的行业板块接口（恒生分类指数与 VHSI 在清单里却无行情），
          所以退一步用「科技 vs 大盘」这组比值。往上 = 资金愿意承担更高波动去博成长；
          往下 = 撤离高 beta。已剔除大盘涨跌的影响，比单看恒生科技涨跌干净。</div>
        <div id="hkcoef"></div>
        <div class="concl" style="margin-top:11px">近 60 日比值 ${C.last==null?"—":C.last.toFixed(1)}（起点 100），
          <b>${C.chg==null?"—":(up?"跑赢":"跑输")+" "+(C.chg==null?"":Math.abs(C.chg).toFixed(1))+" 个百分点"}</b>。
          ${(C.chg!=null&&C.chg<-10)?"科技端 60 日跑输超过 10 个百分点，是明确的风格切换，不是普通回调。":""}</div>
      </div>
    </div>
  </div>`;
}

/* ⑦ 估值分布 */
function hVal(){
  const V=HKS.valuation;
  if(!V) return "";
  const band=(lab,a,b)=>`<div class="it" style="grid-template-columns:1fr 72px">
      <span class="nm">${lab}</span><span class="ct" style="text-align:right">${b}</span></div>`;
  return `<div class="sec">
    <div class="card">
      <div class="card-h"><span class="nm">⑦ 估值分布</span><span class="dt">${V.pe_n} 只有效 / ${V.n} 只</span></div>
      <div class="sec-desc" style="margin-bottom:10px">这里<b>没有历史分位</b>，只有当前快照——个股历史 PE 拿不到，
        本项目的「分位」定义（同一标的与自己的历史比）在这个模块上无法成立。
        所以它回答的是「现在贵不贵」，不能回答「比过去贵还是便宜」。用中位数而非平均值，
        因为亏损股会把平均值拉到没有意义的位置。</div>
      <div class="tkpi" style="grid-template-columns:repeat(4,1fr);margin-top:4px">
        <div class="k"><div class="n">${V.pe_med.toFixed(2)}</div><div class="l">PE 中位数</div></div>
        <div class="k"><div class="n">${V.pe_q1.toFixed(2)}</div><div class="l">25 分位</div></div>
        <div class="k"><div class="n">${V.pe_q3.toFixed(2)}</div><div class="l">75 分位</div></div>
        <div class="k"><div class="n">${V.pb_med==null?"—":V.pb_med.toFixed(2)}</div><div class="l">PB 中位数</div></div>
      </div>
      <div class="concl" style="margin-top:12px">池内 ${V.n} 只中 ${V.pe_n} 只有正 PE，
        <b>${V.loss} 只（${V.loss_pct}%）处于亏损或数据缺失</b>，被排除在 PE 统计之外。
        中位 PE ${V.pe_med.toFixed(2)} 倍，四分位区间 ${V.pe_q1.toFixed(2)}~${V.pe_q3.toFixed(2)}，
        分布${(V.pe_q3-V.pe_q1)>V.pe_med?"很散——成分股之间的估值差异远大于整体水平，中位数代表性有限":"较集中，中位数能代表整体水位"}。</div>
    </div>
  </div>`;
}

function hFoot(){
  return `<div class="sec"><div class="card" style="background:#faf9f6">
    <div style="font-size:11.5px;color:var(--ink2);line-height:1.75">
      <b>本页口径</b>　标的池为恒生指数（95）+ 恒生科技（30）+ 国企指数（50）去重，
      当前 ${(HKS.universe||{}).total||0} 只。三个池子高度重叠，分池数字不可相加。<br>
      <b>位置与动能</b>　与 A 股、美股页完全同一套 v4 公式，这两项可跨页比较；
      <b>热度</b>是本页自建合成（位置 50% + 动能 30% + 量能 20%），权重与 A 股总分不同，<b>不可横比</b>。<br>
      <b>沽空</b>　港股官方每日披露，Σ卖空金额 ÷ Σ成交额。20 日基线由自建归档累积，起步阶段为空。<br>
      <b>估值</b>　只有当前快照，无历史分位。<b>南向</b>　只有成交活跃榜，无净买入。
      <span style="color:#8a8880"><br>本页为市场情绪与结构的客观播报，所有判断基于公开数据推演，不构成投资建议或买卖指令。
      提及个股仅用于说明市场结构，不代表推荐。行情存在延迟，盘后与盘中读数不同属正常。</span>
    </div></div></div>`;
}

function renderHKChart(){
  const C=(HKS&&HKS.coef)||{};
  const D=C.curve||[];
  if(!D.length) return;
  hkChart("hkcoef",{
    grid:{left:36,right:10,top:14,bottom:20},
    tooltip:{trigger:"axis",backgroundColor:"#fff",borderColor:"#e6e4de",
      textStyle:{color:"#1f2328",fontSize:11},
      formatter:p=>`${p[0].axisValue}<br>恒生科技 ÷ 恒指 <b>${p[0].data}</b>`},
    xAxis:{type:"category",data:D.map(x=>x.d),boundaryGap:false,
      axisLine:{lineStyle:{color:"#d3d1c7"}},axisTick:{show:false},
      axisLabel:{color:"#8a8880",fontSize:9.5,interval:Math.max(1,Math.floor(D.length/4))}},
    yAxis:{type:"value",scale:true,splitLine:{lineStyle:{color:"#f2f0ea"}},
      axisLabel:{color:"#8a8880",fontSize:9.5}},
    series:[{type:"line",data:D.map(x=>x.v),symbol:"none",smooth:true,
      lineStyle:{width:2,color:"#8a3fb8"},
      areaStyle:{color:"rgba(138,63,184,0.07)"},
      markLine:{silent:true,symbol:"none",animation:false,
        data:[{yAxis:100,lineStyle:{color:"#d3d1c7",type:"dashed",width:1},
               label:{formatter:"起点 100",position:"insideEndTop",fontSize:9.5,
                      color:"#8a8880",backgroundColor:"#fff",padding:[1,3]}}]}}]
  });
}

function renderHK(){
  const body=document.getElementById("hkBody");
  if(!body) return;
  const dEl=document.getElementById("hDate"), pEl=document.getElementById("hPhase"),
        uEl=document.getElementById("hUni"), sEl=document.getElementById("hShort");
  if(!HKS){
    if(dEl)dEl.textContent="—";
    if(pEl)pEl.textContent="—";
    if(uEl)uEl.textContent="—";
    if(sEl)sEl.textContent="—";
    body.innerHTML='<div class="sec-desc" style="margin-top:16px">暂无港股数据。点右上角「刷新港股」取最新快照。</div>';
    return;
  }
  dEl.textContent=HKS.date||"—";
  pEl.textContent=HKS.phase||"—";
  uEl.textContent=(HKS.universe||{}).total||"—";
  const S=HKS.short||{};
  sEl.textContent=S.ratio==null?"—":(S.ratio.toFixed(2)+"%");
  body.innerHTML=[hTemp(),hBreadthRank(),hShort(),hSouthCoef(),hVal(),hFoot()].join("");
  renderHKChart();
}

/* ================= 亚太温度 ================= */
const apCharts={};
function apChart(id,opt){
  const el=document.getElementById(id);
  if(!el||!window.echarts)return;
  const old=apCharts[id];
  if(!old||old.dom!==el){
    if(old&&old.dispose){try{old.dispose();}catch(e){}}
    apCharts[id]=echarts.init(el);
    apCharts[id].dom=el;
  }
  apCharts[id].setOption(opt,true);
  apCharts[id].resize();
}
const AP_BENCH={SPX:"标普500",CSI300:"沪深300"};
const AP_COLOR={"日经":"#2f5d8a","韩国":"#8a5a2f","台湾":"#2f7a5d",
                "印度":"#7a3f6d","新加坡":"#5d6b2f","恒指":"#8a8880"};
let apB="SPX";
function apC(s){return AP_COLOR[s]||"#8a8880";}
function apNum(v,d=2){
  const n=Number(v);
  return (v==null||isNaN(n))?"—":n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
}

/* ① 五地指数卡 */
function apCard(d){
  const isRef=!!d.is_ref;
  return `<div class="apcard"${isRef?' style="opacity:.72"':''}>
    <div class="hd2"><span class="r1">${d.short}</span><span class="r2">${d.sym}</span></div>
    <div class="px"><span class="v">${apNum(d.close)}</span>
      <span class="c" style="color:${uc(d.chg)}">${SG(d.chg,2)}%</span></div>
    <div class="pos"><span class="v" style="color:${hBand(d.pos)}">${d.pos==null?"—":d.pos.toFixed(1)}</span>
      <span class="l">${d.label||"—"}</span></div>
    ${hBar("位置",d.pos)}${hBar("动能",d.mom)}
    <div class="ft">距一年高点 ${SG(d.dd250,1)}%　RSI6 ${d.rsi6==null?"—":d.rsi6.toFixed(1)}<br>
      20日 ${SG(d.r20,1)}%　60日 ${SG(d.r60,1)}%<br>${d.n} 根　${d.start}~${d.end}</div>
  </div>`;
}
/* 恒指不做第六张卡：六张卡在五列网格里会单出一行，视觉上像漏了一个。
   改成卡片下方一条细带，既说明它只是参照，也不破坏五地的整齐排列。 */
function apRefStrip(d){
  if(!d)return "";
  return `<div class="apref">
    <span class="k">参照</span>
    <span class="n">恒生指数</span>
    <span class="v">${apNum(d.close)}</span>
    <span style="color:${uc(d.chg)}">${SG(d.chg,2)}%</span>
    <span class="sp">位置 <b style="color:${hBand(d.pos)}">${d.pos==null?"—":d.pos.toFixed(1)}</b> ${d.label||""}</span>
    <span class="sp">动能 <b>${d.mom==null?"—":d.mom.toFixed(1)}</b></span>
    <span class="sp">距一年高点 ${SG(d.dd250,1)}%</span>
    <span class="src">${d.n} 根 ${d.start}~${d.end}　来源 ${HKA.ref_src==="live"?"westock 实时":"本地缓存"}</span>
  </div>`;
}

function apCards(){
  const M=HKA.markets||[];
  if(!M.length)return "";
  const cards=M.map(apCard).join("");
  return `<div class="sec" style="margin-top:18px">
    <div class="sec-h"><h2>① 五地指数温度</h2>
      <div class="note">位置 / 动能可跨页比；本页不合成总分，也不做量能与估值</div></div>
    <div class="sec-desc">五个市场各一张卡。大数字是<b>位置分位</b>（0=近一年最冷，100=最热），
      下面两条细条是位置与动能的分位。位置=乖离/布林/回撤三合一，动能=RSI6 与 10 日风险调整动量各半，
      <b>与 A 股页、港股页同一套公式，读数是同一个含义</b>。灰卡的恒指只作参照，不参与五地排序。</div>
    <div class="ap5">${cards}</div>
    ${apRefStrip(HKA.ref)}
  </div>`;
}

/* ② 位置 × 动能 象限 */
function apQuad(){
  return `<div class="sec">
    <div class="sec-h"><h2>② 位置 × 动能</h2>
      <div class="note">右上=既高位又加速；右下=高位滞涨；左上=低位修复</div></div>
    <div class="sec-desc">横轴位置、纵轴动能。分档线画在 30 与 70——右下角（位置高、动能已掉）通常出现在
      上涨末段，左上角（位置低、动能先起）通常出现在修复初期。两个轴都是分位，所以点落在哪一格本身
      就说明了状态，不需要再合成一个总分。</div>
    <div class="card"><div id="apQuadChart" class="apchart" style="height:340px"></div></div>
  </div>`;
}
function apQuadOpt(){
  const M=HKA.markets||[];
  const ref=HKA.ref;
  const ser=[{
    name:"五地", type:"scatter", symbolSize:13,
    data:M.map(d=>({name:d.short,value:[d.pos,d.mom],itemStyle:{color:apC(d.short)}})),
    label:{show:true,position:"right",distance:8,fontSize:11,color:"#3a3833",
           formatter:p=>p.name},
    emphasis:{scale:1.4},
    markLine:{silent:true,symbol:"none",
      lineStyle:{color:"#e0ddd4",type:"dashed",width:1},
      label:{show:false},
      data:[{xAxis:30},{xAxis:70},{yAxis:30},{yAxis:70}]}
  }];
  if(ref){
    ser.push({name:"恒指（参照）",type:"scatter",symbolSize:12,
      data:[{name:"恒指",value:[ref.pos,ref.mom]}],
      itemStyle:{color:"#fff",borderColor:"#8a8880",borderWidth:1.6},
      label:{show:true,position:"right",distance:8,fontSize:10.5,color:"#8a8880",
             formatter:"恒指（参照）"}});
  }
  return {
    grid:{left:52,right:34,top:40,bottom:46},
    xAxis:{type:"value",min:0,max:100,name:"位置",nameLocation:"middle",nameGap:28,
      nameTextStyle:{fontSize:10.5,color:"#8a8880"},
      axisLabel:{fontSize:10,color:"#8a8880"},
      splitLine:{lineStyle:{color:"#f2f0ea"}},axisLine:{show:false},axisTick:{show:false}},
    yAxis:{type:"value",min:0,max:100,name:"动能",nameLocation:"end",nameGap:16,
      nameRotate:0,nameTextStyle:{fontSize:10.5,color:"#8a8880",align:"left"},
      axisLabel:{fontSize:10,color:"#8a8880"},
      splitLine:{lineStyle:{color:"#f2f0ea"}},axisLine:{show:false},axisTick:{show:false}},
    tooltip:{trigger:"item",formatter:p=>`${p.name}<br>位置 ${p.value[0].toFixed(1)}　动能 ${p.value[1].toFixed(1)}`},
    series:ser
  };
}

/* ③ 相对强弱：双基准 × 三周期 */
function apRSTable(key){
  const rows=(HKA.rs||{})[key]||[];
  if(!rows.length)return "";
  const H=[20,60,120];
  const head=`<div class="aprsh"><span>地区</span>${H.map(h=>`<span>${h} 日超额</span>`).join("")}</div>`;
  const body=rows.map(r=>{
    const cells=H.map(h=>{
      const v=r["r"+h];
      if(!v)return `<div class="apcell"><b style="color:#b4b2a9">—</b><i>无数据</i></div>`;
      const ex=v.ex;
      return `<div class="apcell"><b style="color:${ex==null?"#b4b2a9":uc(ex)}">${ex==null?"—":SG(ex,2)}</b>
        <i>本地 ${SG(v.loc,1)} / 基准 ${v.bench==null?"—":SG(v.bench,1)}</i></div>`;
    }).join("");
    return `<div class="aprow${r.is_ref?" ref":""}"><span class="nm2">${r.short}${r.is_ref?"<em>参照</em>":""}</span>${cells}</div>`;
  }).join("");
  return `<div class="card">
    <div class="card-h"><span class="nm">vs ${AP_BENCH[key]}</span>
      <span class="dt">${(HKA.curves&&HKA.curves[key]&&HKA.curves[key].dates.length)?HKA.curves[key].dates.slice(-1)[0]:""}</span></div>
    ${head}${body}
    <div class="concl">小字是分解：<b>本地涨幅 / 同期基准涨幅</b>，两者相减即上方的超额。
      基准那一列按同一日历窗口对齐取数，所以与「基准自身最近 60 根」不完全相同。</div>
  </div>`;
}
function apRS(){
  return `<div class="sec">
    <div class="sec-h"><h2>③ 相对强弱</h2>
      <div class="note">主基准标普500（全球风险偏好）／副基准沪深300（A 股联动）</div></div>
    <div class="sec-desc">超额收益 = 本地涨幅 − 同期基准涨幅，单位是百分点。两个基准并排看，
      能分出一件事：是跟着美股走，还是跟着 A 股走。比如对美股为正、对沪深300 为负，
      说明这段是全球普跌但本地更抗跌，而不是本地在独立走强。</div>
    <div class="grid2">${apRSTable("SPX")}${apRSTable("CSI300")}</div>
  </div>`;
}

/* ④ 相对强弱曲线 */
function apCurve(){
  return `<div class="sec">
    <div class="sec-h"><h2>④ 相对强弱曲线</h2>
      <div class="note">120 个交易日累计超额，以窗口首日为 0</div></div>
    <div class="sec-desc">曲线是「本地累计涨幅 − 同期基准累计涨幅」，向上代表持续跑赢。
      它比单点超额多一个信息：领先是在扩大还是在收敛。虚线是恒指参照。</div>
    <div class="card">
      <div class="card-h" style="margin-bottom:10px">
        <span class="nm">累计超额（百分点）</span>
        <div class="apsw" id="apSw">
          <button data-b="SPX" class="${apB==='SPX'?'on':''}">vs 标普500</button>
          <button data-b="CSI300" class="${apB==='CSI300'?'on':''}">vs 沪深300</button>
        </div>
      </div>
      <div id="apCurveChart" class="apchart"></div>
      <div id="apCurveLegend" style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;margin-top:8px"></div>
    </div>
  </div>`;
}
function apCurveOpt(){
  const C=(HKA.curves||{})[apB]||{dates:[],series:[]};
  const ser=C.series.map((s,i)=>({
    name:s.short,type:"line",showSymbol:false,smooth:false,
    lineStyle:{width:s.is_ref?1.3:1.9,type:s.is_ref?"dashed":"solid",color:apC(s.short)},
    itemStyle:{color:apC(s.short)},
    emphasis:{focus:"series",lineStyle:{width:s.is_ref?1.6:2.6}},
    markLine:i===0?{silent:true,symbol:"none",
      lineStyle:{color:"#c9c6bd",type:"dashed",width:1},
      label:{show:false},data:[{yAxis:0}]}:undefined,
    data:(s.dates||[]).map((date,index)=>[date,s.pts[index]])
  }));
  return {
    grid:{left:46,right:30,top:16,bottom:28},
    xAxis:{type:"time",boundaryGap:false,
      axisLabel:{fontSize:10,color:"#8a8880",hideOverlap:true,formatter:v=>new Date(v).toISOString().slice(2,10)},
      axisLine:{lineStyle:{color:"#e6e3dc"}},axisTick:{show:false}},
    yAxis:{type:"value",scale:true,
      axisLabel:{fontSize:10,color:"#8a8880",formatter:"{value}"},
      splitLine:{lineStyle:{color:"#f2f0ea"}},axisLine:{show:false}},
    tooltip:{trigger:"axis",axisPointer:{type:"line",lineStyle:{color:"#d8d5cc"}},
      formatter:p=>{
        const d=p[0]?new Date(p[0].axisValue).toISOString().slice(0,10):"";
        const rows=p.map(x=>`${x.marker}${x.seriesName} <b style="float:right;margin-left:14px">${SG(x.value[1],2)}</b>`).join("<br>");
        return `<b>${d}</b><br>${rows}`;
      }},
    series:ser
  };
}
function apCurveLegend(){
  const C=(HKA.curves||{})[apB]||{series:[]};
  const rk=[...C.series].sort((a,b)=>b.last-a.last);
  return rk.map(s=>`<span style="color:var(--ink2)">
    <i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${apC(s.short)};margin-right:5px;opacity:${s.is_ref?.45:1}"></i>
    ${s.short}${s.is_ref?'<span style="color:var(--ink3)">（参照）</span>':""}
    <b style="font-family:ui-monospace,Consolas,monospace;color:${uc(s.last)}">${SG(s.last,2)}</b></span>`).join("");
}

/* ⑤ 区域联动 */
function apCorr(){
  const C=HKA.corr;
  if(!C)return "";
  return `<div class="sec">
    <div class="sec-h"><h2>⑤ 区域联动</h2>
      <div class="note">${C.n} 个共同交易日的日收益相关性（${C.from} ~ ${C.to}）</div></div>
    <div class="sec-desc">这张表决定了「亚太」到底能不能当一个板块看。相关性高的一群是同涨同跌，
      分散配置没有意义；相关性低的是真正独立的beta。取共同交易日，所以样本天数会少于 60。</div>
    <div class="card"><div id="apCorrChart" class="apchart" style="height:330px"></div></div>
  </div>`;
}
function apCorrOpt(){
  const C=HKA.corr;
  const data=[];
  C.names.forEach((n,i)=>C.names.forEach((m,j)=>{
    const v=C.m[i][j];
    data.push({value:[j,i,v],label:{color:v>0.55?"#fff":"#2b2b2b"}});
  }));
  return {
    grid:{left:56,right:16,top:16,bottom:48},
    xAxis:{type:"category",data:C.names,splitArea:{show:false},
      axisLabel:{fontSize:10.5,color:"#5c5a54"},axisLine:{show:false},axisTick:{show:false}},
    yAxis:{type:"category",data:C.names,splitArea:{show:false},
      axisLabel:{fontSize:10.5,color:"#5c5a54"},axisLine:{show:false},axisTick:{show:false}},
    visualMap:{min:0,max:1,calculable:false,orient:"horizontal",left:"center",bottom:0,
      itemWidth:12,itemHeight:80,text:["1.0","0"],textStyle:{fontSize:10,color:"#8a8880"},
      inRange:{color:["#f7f6f1","#dbe3ec","#9fb4c9","#5c7f9e","#2c4a63"]}},
    tooltip:{formatter:p=>`${C.names[p.value[1]]} × ${C.names[p.value[0]]}<br>相关性 <b>${p.value[2].toFixed(2)}</b>`},
    series:[{type:"heatmap",data:data,
      label:{show:true,fontSize:10,formatter:p=>p.value[2].toFixed(2)},
      itemStyle:{borderColor:"#fff",borderWidth:1.5},
      emphasis:{itemStyle:{shadowBlur:8,shadowColor:"rgba(0,0,0,.18)"}}}]
  };
}

/* ⑥ 口径与边界 */
function apNote(){
  const N=(HKA.notes||[]).map(t=>`<div class="q"><span>·</span><span>${t}</span></div>`).join("");
  const R=HKA.ref?`<div class="q"><span>·</span><span>恒指按参照处理，取数来源为 westock（${HKA.ref_src==="live"?"实时":"缓存"}），
    样本 ${HKA.ref.n} 根，起点比其他五地晚，分位窗口内的市场环境不完全一致。</span></div>`:"";
  return `<div class="sec">
    <div class="sec-h"><h2>⑥ 口径与边界</h2><div class="note">读之前先看这一段</div></div>
    <div class="card">${N}${R}</div>
  </div>`;
}

function renderAPCharts(){
  if(!HKA)return;
  try{ apChart("apQuadChart",apQuadOpt()); }catch(e){}
  try{
    const o=apCurveOpt();
    if(o) apChart("apCurveChart",o);
    const lg=document.getElementById("apCurveLegend");
    if(lg) lg.innerHTML=apCurveLegend();
  }catch(e){}
  try{ if(HKA.corr) apChart("apCorrChart",apCorrOpt()); }catch(e){}
}

function renderAP(){
  const body=document.getElementById("apBody");
  const dEl=document.getElementById("aDate");
  if(dEl) dEl.textContent=(HKA&&HKA.date)||"—";
  if(!body)return;
  if(!HKA){
    body.innerHTML=`<div class="card" style="margin-top:18px">尚无亚太数据。点右上角「刷新亚太」取一次。</div>`;
    return;
  }
  body.innerHTML=[apCards(),apQuad(),apRS(),apCurve(),apCorr(),apNote()].join("");
  renderAPCharts();
}
