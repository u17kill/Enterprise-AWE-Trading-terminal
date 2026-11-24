const MKT=null;const offlinePortfolio=JSON.parse(document.getElementById('portfolio-offline-data').textContent);let PMX=offlinePortfolio.sat,COREX=offlinePortfolio.core;
let pm = null;
let pmQ = "", pmDensity = "compact", pmThemeOpen = true;
let pmEdit = null, pmTh = null, pmLocalAt = "";

/* ---------------- 两个仓 + 总仓（v1.37.0） ----------------
   卫星仓＝v1.36.0 那张持仓地图，美元计，口径与渲染一个字没动；
   核心仓＝人民币计，结构与卫星仓同构，共用同一套渲染函数——把 `pm` 指向
   不同的数据对象就行，所以矩阵、抽屉、图表、导入导出全都自动跟着走；
   总仓＝核心仓（已是人民币）+ 卫星仓（美元 × 7），只读汇总，不进编辑。

   三个视图同时只显示一个，DOM 也只有一套：否则 id 会撞
   （#pmGrid 出现两遍，getElementById 只认第一个，第二个就静默失效）。
   所以这里不是「三份页面」，是「一份页面三个数据源」。 */
let pmMode = "total";                                  // total | core | sat
let pmBook = {sat: null, core: null};                  // 两个仓的活数据
const PM_SRC = {sat: () => PMX, core: () => COREX};    // 构建期内嵌的初值
/* core 的键从 v1 升到 v2：v1.37.0 存的是矩阵结构的草稿（items），
   v1.38.0 起是 funds —— 键不换会把旧结构当成本仓数据读进来。 */
const PM_KEY = {sat: "pmx_map_v1", core: "pmx_core_v2"};
/* 卫星仓的 key 必须还是 pmx_map_v1：换了名，用户现有的浏览器草稿就找不到了 */
const pmKey = () => PM_KEY[pmMode === "core" ? "core" : "sat"];
const pmApi = () => (pmMode === "core" ? "/api/core" : "/api/portfolio");
/* 总仓与核心仓都是人民币口径，只有卫星仓是美元 */
const pmCur = () => (pmMode === "total" || pmMode === "core" || (pm && pm.currency === "CNY")) ? "¥" : "US$";
let pmDraftAt = {sat: "", core: ""};   // 两仓各自的本机草稿时间，切视图时不互相污染
/* 冲突要记在「仓」上，不能只记在「当前视图」上：启动时视图是总仓，那会儿若把提示
   吞掉，等用户切到该仓时提示已经没了，旧草稿就会一直静静压着源文件——
   表现就是「明明改过了，刷新还是旧的」。 */
let pmConflict = {sat: null, core: null};

const PM_ST = {
  held:   {name: "已持仓",  cls: "held"},
  watch:  {name: "观察中",  cls: "watch"},
  add:    {name: "计划加仓", cls: "add"},
  option: {name: "期权",    cls: "option"}
};
const PM_COUNTED = ["held", "add"];

const pmEl = id => document.getElementById(id);
const pmEsc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* 备注 → 分。不可计算返回 null，绝不返回 0。 */
function pmParseCents(a){
  const t = String(a == null ? "" : a).trim();
  if(!/^\d+(?:\.\d{1,5})?k$/i.test(t)) return null;
  const n = Math.round(Number(t.slice(0, -1)) * 100000);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
/* 分 → 展示串。两个纯格式化函数先分开，再由 pmUsd 按当前仓的币种选一个。
   为什么拆：总仓视图里两种币种要同屏显示（卫星仓原币 US$ + 折算后 ¥），
   只靠「当前币种」一个开关是画不出来的。
   美元沿用 v1.36.0 的规则（≥1000 用 k）；人民币用中文读数的「万」——
   ¥289.7万 比 ¥2,897.4k 好认，也和券商 App 的口径一致。
   函数名 pmUsd 不改，是为了不动四十多个调用点；语义以本注释为准。 */
function pmFmtK(c){
  if(c == null) return "—";
  const v = c / 100;
  if(Math.abs(v) >= 1000){
    const k = v / 1000;
    return (Math.abs(k - Math.round(k)) < 1e-9 ? k.toFixed(0) : k.toFixed(1)) + "k";
  }
  return v.toFixed(0);
}
function pmFmtW(c){
  if(c == null) return "—";
  const v = c / 100;
  if(Math.abs(v) >= 10000){
    const w = v / 10000;
    return (Math.abs(w - Math.round(w)) < 1e-9 ? w.toFixed(0) : w.toFixed(1)) + "万";
  }
  return v.toFixed(0);
}
function pmUsd(c){ return pmCur() === "¥" ? pmFmtW(c) : pmFmtK(c); }

/* ---------------- 折算与总仓（v1.37.0） ---------------- */
/* 固定汇率，写死在代码里，不取实时价。
   1 美分 = 0.07 元 = 7 分，7 是整数——「美分 × 7 = 人民币分」精确成立，
   一次舍入都不需要。这是选 7 而不是 7.13 的附带好处。
   要改汇率就改这里，并在 CHANGELOG 记账：历史合计会跟着变，必须留痕。 */
const PM_FX = {USD: 7, CNY: 1};

/* 原币分 → 人民币分。返回新对象，不改入参——
   同一份 pmTotals() 结果在总仓里要被读两次（原币一次、折算一次）。 */
function pmToCny(t, cur){
  const c = cur || (t && t.cur) || "USD";
  const k = PM_FX[c] || 1;
  if(k === 1) return t;
  const out = Object.assign({}, t);
  out.total = t.total * k;
  out.orphan = t.orphan * k;
  out.cur = "CNY";
  out.fxFrom = c;
  out.fxRate = k;
  for(const f of ["g", "r", "c", "cell"]){
    out[f] = {};
    for(const key in t[f]) out[f][key] = t[f][key] * k;
  }
  return out;
}

/* 资产类别的合并规则（写死，用户 v1.38.2 要求）：资产名里只要带「股票」两个字，
   就并入同一项「股票」统计，不再按名字各列一行。理由很实际——「股票多头」
   「股票中性」「股票指增」在口径上是同一类资产的不同做法，拆开列反而看不出
   股票这一类到底占了多少。卫星仓整仓本来就是「股票」，天然并进同一项。 */
function pmCatName(nm){
  const s = String(nm == null ? "" : nm);
  return s.indexOf("股票") >= 0 ? "股票" : s;
}

/* 总仓 = 核心仓 + 卫星仓 × 7。两仓先各自按原币汇总，再折成人民币相加。
   三个维度都合并，因为两边语义对齐了：
     国家   ← 卫星仓的「地区」+ 核心仓资产的「国家」
     风格   ← 卫星仓的「策略」（本来就是进攻/均衡/防御）+ 核心仓资产的「风格」
     资产类别 ← 核心仓资产的「资产名」+ 卫星仓整仓记为「股票」
   卫星仓全是个股，所以按用户口径整仓算一类「股票」，不拿主题去冒充资产类别。 */
function pmTotalData(){
  const out = {parts: {}, total: 0, r: {}, s: {}, c: {}, mergedCat: [],
               rname: {}, sname: {}, core: pmBook.core, sat: pmBook.sat};
  PMC_STYLE_DEF.forEach(x => { out.sname[x.id] = x.name; });
  PMC_REG_DEF.forEach(x => { out.rname[x.id] = x.name; });

  const core = pmBook.core;
  if(core){
    const st = pmcTotals(core);
    out.parts.core = {book: "core", name: "核心仓", cur: "CNY", unit: "只基金",
                      counted: st.counted, raw: st, cny: st,
                      unparsed: st.unparsed, assets: st.assets};
    out.total += st.total;
    for(const k in st.r) out.r[k] = (out.r[k] || 0) + st.r[k];
    for(const k in st.s) out.s[k] = (out.s[k] || 0) + st.s[k];
    for(const k in st.c){
      const kk = pmCatName(k);
      if(kk !== k && out.mergedCat.indexOf(k) < 0) out.mergedCat.push(k);
      out.c[kk] = (out.c[kk] || 0) + st.c[k];
    }
    pmcStyles(core).forEach(x => { out.sname[x.id] = x.name; });
    pmcRegions(core).forEach(x => { out.rname[x.id] = x.name; });
  }else out.parts.core = null;

  const sat = pmBook.sat;
  if(sat){
    const raw = pmTotals(sat);
    const cny = pmToCny(raw, sat.currency);
    out.parts.sat = {book: "sat", name: "卫星仓", cur: sat.currency || "USD", unit: "张",
                     counted: raw.counted, raw: raw, cny: cny,
                     unparsed: raw.unparsed, watch: raw.watch, option: raw.option,
                     orphanN: raw.orphanN, orphan: cny.orphan};
    out.total += cny.total;
    for(const k in cny.r) out.r[k] = (out.r[k] || 0) + cny.r[k];
    for(const k in cny.g) out.s[k] = (out.s[k] || 0) + cny.g[k];
    out.c["股票"] = (out.c["股票"] || 0) + cny.total;
    (sat.regions || []).forEach(x => { out.rname[x.id] = x.name || x.id; });
    (sat.groups || []).forEach(x => { out.sname[x.id] = x.name || x.id; });
  }else out.parts.sat = null;
  return out;
}

/* ---------------- 视图切换：总仓 / 核心仓 / 卫星仓 ---------------- */
/* 三套文案。卫星仓那段就是 v1.36.0 的原文，一字未改——它在页面上必须
   看起来跟加这个功能之前完全一样。 */
const PM_HEAD = {
  total: {
    t: "总仓",
    d: `核心仓（人民币）+ 卫星仓（美元 × <b>7.00</b>）= 总仓。两个仓分开记账、分开维护，
      这里只做折算后的合并读数：美元部分按<b>固定汇率 7.00</b> 折成人民币，不取实时价——
      汇率一动，历史合计就跟着变，月度对比就没意义了。`
  },
  core: {
    t: "核心仓",
    d: `分两层：<b>基金</b>（名称 + 金额）→ <b>资产</b>（名称 + 国家 + 风格 + 权重）。
      一只基金的钱按各资产权重摊下来，国家 / 风格 / 资产类别都按<b>摊完的金额</b>统计——
      所以「多策略基金：红利 40% / 商品 50% / 黄金 10%」是一张卡加三行资产，不是三只基金。
      这里记的是<b>人民币</b>：<b>50k</b> 记作 50,000 元，不做任何汇率换算。
      <b>Σ 是填写金额的合计，不是实时市值、不是成本、也不是盈亏</b>。`
  },
  sat: {
    t: "卫星仓",
    d: `按 <b>策略</b> 分三段自上而下排开（进攻 / 均衡 / 防御），段内再按 <b>主题 → 地区</b> 落格子；
      主题列在各自段里等分铺满、一律从左边起排，段与段之间不再横向串列或对不齐。四类状态分别是已持仓、观察中、计划加仓和期权。
      这里汇总的是你填在卡片上的 <b>仓位备注</b>（<b>1.5k</b> 记作 1,500 美元），
      <b>不是实时市值、不是持仓成本、也不是盈亏</b>。只有「已持仓」和「计划加仓」里
      完整写成「数字 k」的备注才计入；观察中与期权一律不进普通合计。`
  }
};
const PM_FOOT = {
  sat: `<b>口径</b>　合计只累加「已持仓 + 计划加仓」中完整写成「数字 k」的备注，按 1k = 1,000 美元计，
    不做汇率换算；<b>Σ 是备注合计，不是资产价值</b>。
    纯文字、<code>put 115</code>、区间 <code>2.7k–5</code>、没有 k 的裸数字都不计入，也不会被当作 0。
    <b>日韩台印</b> 是合并地区，不构成单一国家统计。
    期权数量与标的另列，永不并入普通仓位金额；备注里出现 put / call <b>不会</b>自动改状态。`,
  core: `<b>口径</b>　合计只累加「已持仓 + 计划加仓」中完整写成「数字 k」的备注，按 1k = 1,000 <b>元</b>计，
    <b>不做任何汇率换算</b>——核心仓本身就以人民币记账；<b>Σ 是备注合计，不是资产价值</b>。
    纯文字、区间 <code>2.7k–5</code>、没有 k 的裸数字都不计入，也不会被当作 0。
    期权数量与标的另列，永不并入普通仓位金额；备注里出现 put / call <b>不会</b>自动改状态。`
};

function pmSetHead(mode){
  const h = PM_HEAD[mode] || PM_HEAD.total;
  pmEl("pmTitle").textContent = h.t;
  pmEl("pmDesc").innerHTML = h.d;
  pmEl("pmHeadBtn").style.display = mode === "total" ? "none" : "";
  pmEl("pmFoot").innerHTML = mode === "core" ? PM_FOOT.core : PM_FOOT.sat;
  pmEl("pmModeHint").innerHTML = mode === "total"
    ? `折算口径：<b>1 美元 = 7.00 人民币</b>，固定值。总仓按<b>国家 / 风格 / 资产类别</b>三个维度合并，编辑请进各自的仓。`
    : mode === "core"
      ? `人民币记账，<b>不乘汇率</b>。核心仓是「基金 → 资产」两层，与卫星仓是两份独立文件，互不影响。`
      : `美元记账，<b>1k = 1,000 美元</b>。在总仓里这一仓会整体 <b>×7</b> 折成人民币。`;
}

function pmSwitch(mode){
  if(!PM_HEAD[mode]) mode = "total";
  pmMode = mode;
  try{ localStorage.setItem("pmx_mode", mode); }catch(e){}
  const bar = pmEl("pmSeg2");
  if(bar) bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === mode));
  pmSetHead(mode);
  const isTotal = mode === "total";
  pmEl("pmTotalView").style.display = isTotal ? "" : "none";
  /* 核心仓与卫星仓各有一套 DOM：矩阵装不下「基金」这层容器，
     所以核心仓不是「换个数据源」，是另一套渲染。三个视图同时只显示一个。 */
  pmEl("pmCoreView").style.display = mode === "core" ? "" : "none";
  pmEl("pmBookView").style.display = mode === "sat" ? "" : "none";
  pmClose(); pmThClose(); pmcCloseAll();          // 切视图不留浮层
  if(isTotal){ pmRenderTotal(); return; }
  pm = pmBook[mode];
  pmQ = ""; if(pmEl("pmQ")) pmEl("pmQ").value = "";
  pmLocalAt = pmDraftAt[mode] || "";
  pmPushState = "idle"; pmFileAt = ""; pmFailBanner(false);
  if(!pm){ pmRenderNoData(mode); return; }
  if(mode === "core"){ pmcRender(); pmSaveBadge("ok"); return; }
  if(!Array.isArray(pm.items)) pm.items = [];
  pmRenderAll();
  pmSaveBadge("ok");
  /* 装载那一刻就发现过冲突，切回来时要重新亮出来（提示条是随视图重建的） */
  const cf = pmConflict[mode];
  if(cf){
    pmPushState = "conflict";
    pmSaveBadge("dirty", "本机草稿与源文件不一致，等你选一份");
    pmConflictBanner(cf.localAt, cf.fileAt, cf.fresh);
  }
}

/* 当前视图重画。三个视图各有一套渲染入口，集中在这里，
   免得每个调用点都写一遍 if(core)…else…（漏一处就是「数据变了但页面没变」）。 */
function pmRedraw(){
  if(pmMode === "total"){ pmRenderTotal(); return; }
  if(pmMode === "core"){ pmcRender(); return; }
  pmRenderAll();
}

/* ---------------- 总仓视图 ---------------- */
/* ================= 持仓体检（v1.44.0） =================
   用户要的不是「总仓多少、几成股票」——那些上面已经有了。要的是：这张表合不合理、
   现在这个环境适合什么风格、哪块有问题、要不要微调比例。

   所以这块劈成两半，界线必须清楚：
     左半边 = 判断（人写，存在 data/portfolio/review.json，随构建内嵌）
     右半边 = 读数（程序实时算，带目标区间与偏离）
   判断不自动生成。理由不是做不到，是这个项目从 v1.22.0 起就守的一条：
   程序只搬运、合并、体检，观点得有人负责。一个会自动改口的结论，
   跌的时候说「早就提示风险」，涨的时候说「结构健康」，那不叫判断。
   所以数据每天动、读数实时变、正文不动，两者对不上时页面自己会说。

   「合理」怎么变成可复核的：review.json 里给每个维度写一个目标区间，
   前端算出当前值并判断超/欠。区间是人定的（也就是可被质疑的），
   但「现在是多少、离区间多远」是算的——不让判断和数字各说各话。 */
let PM_REVIEW = offlinePortfolio.review;

/* 地区别名：卫星仓用 asia / europe，核心仓用 jp / eu / hk，同一块地方两个 id。
   不统一就会在体检里出现「日本 3%」和「日韩台 11%」并排，读者以为漏了一块。 */
const PMRV_ALIAS = {china: "cn", hk: "cn", us: "us", asia: "asia", jp: "asia",
                    europe: "eu", eu: "eu", other: "other"};
/* 真防守的识别靠资产名。红利、可转债不进来——它们是低 beta 股票，
   股灾里照样跌，只是跌得少。把它们算成防守会让「防御 42.7%」显得比实际扎实。 */
const PMRV_REALDEF = /国债|黄金|中性|套利|CTA/;

function pmrvMetrics(){
  const T = pmTotalData();
  const tot = T.total || 0;
  const pct = v => tot > 0 ? v / tot * 100 : 0;
  const rg = {};
  for(const k in T.r){
    const a = PMRV_ALIAS[k] || "other";
    rg[a] = (rg[a] || 0) + T.r[k];
  }
  /* 核心仓必须在「资产」这一层归类，不能看基金名——
     「金和全天候」听着像防守，里面 20% 是标普 500、20% 是商品时序 CTA。 */
  const ct = pmcTotals(pmBook.core);
  let realDef = 0, aiCore = 0;
  Object.keys(ct.c || {}).forEach(nm => {
    const v = ct.c[nm];
    if(PMRV_REALDEF.test(nm)) realDef += v;
    if(nm.indexOf("纳斯达克") >= 0) aiCore += v;
    else if(nm.indexOf("标普500") >= 0) aiCore += v / 3;   // 标普里科技约三分之一
  });
  /* 卫星仓：AI 主题按主题列名判断，黄金按标的名判断（它挂在「贵金属」列下，
     但性质是商品，不该算进中国 beta）。 */
  let satTot = 0, satAI = 0;
  const sits = [];
  const sat = pmBook.sat;
  if(sat){
    const cols = new Map((sat.columns || []).map(c => [c.id, c]));
    (sat.items || []).forEach(it => {
      if(PM_COUNTED.indexOf(it.status) < 0) return;
      const c = pmParseCents(it.amount);
      if(c == null || !it.columnId) return;
      const v = c * PM_FX.USD;
      satTot += v;
      const col = cols.get(it.columnId) || {};
      if(String(col.name || "").indexOf("AI") === 0) satAI += v;
      if(String(it.name || "").indexOf("黄金") >= 0) realDef += v;
      sits.push({name: it.name || "", v});
    });
  }
  sits.sort((a, b) => b.v - a.v);
  const top5 = sits.slice(0, 5).reduce((a, b) => a + b.v, 0);
  const hhi = sits.reduce((a, b) => a + Math.pow(b.v / (satTot || 1), 2), 0);

  /* 即期汇率只做「记账 vs 今天能换回多少」的对照，不参与任何合计。
     合计必须留在 7.00，否则汇率一动历史对比就全废。 */
  let spot = null;
  ((MKT && MKT.assets) || []).forEach(a => {
    if(a.code === "fxUSDCNY" && a.price) spot = Number(a.price);
  });

  const M = {
    "region.cn": pct(rg.cn || 0),
    "style.attack": pct(T.s.attack || 0),
    "style.balance": pct(T.s.balance || 0),
    "style.defense": pct(T.s.defense || 0),
    "band.real_def": pct(realDef),
    "factor.ai": pct(aiCore + satAI),
    "conc.top5": satTot > 0 ? top5 / satTot * 100 : 0
  };
  return {M: M, tot: tot, satTot: satTot, n: sits.length,
          hhi: hhi, eff: hhi > 0 ? 1 / hhi : 0, top5: top5,
          spot: spot, fxDiff: spot ? satTot - satTot * spot / PM_FX.USD : null,
          aiCore: aiCore, satAI: satAI, realDef: realDef,
          core: (T.parts.core && T.parts.core.cny.total) || 0,
          satCny: (T.parts.sat && T.parts.sat.cny.total) || 0};
}

function pmrvHTML(){
  const R = PM_REVIEW;
  if(!R){
    return `<div class="sec" id="pmReview" style="margin-top:18px">
      <div class="sec-h"><h2>持仓体检</h2>
        <div class="note">判断文字缺文件</div></div>
      <div class="pmrv-none">这个位置是对整张表的判断，不是数字总结。判断存在
        <b>data/portfolio/review.json</b>，现在没读到。读数（地区 / 风格 / 因子 / 集中度）
        仍然会自动算，缺的只是「怎么读这张表」那几句话。</div>
    </div>`;
  }

  const K = pmrvMetrics();
  const M = K.M;
  const d0 = new Date(String(R.as_of || "") + "T00:00:00");
  const days = isNaN(d0.getTime()) ? null
             : Math.max(0, Math.floor((Date.now() - d0.getTime()) / 86400000));

  /* 锚点漂移：这份判断是照着某个仓位形状写的。仓位形状变了，
     结论就失去了依据——不是数字过期，是前提过期。 */
  const nowWan = K.tot / 1e6;
  const anchorWan = R.anchor && Number(R.anchor.total_wan);
  const drift = anchorWan ? (nowWan - anchorWan) / anchorWan * 100 : null;

  const rows = (R.targets || []).map(t => {
    const v = M[t.key];
    if(v == null) return "";
    const over = v > t.hi + 1e-9, under = v < t.lo - 1e-9;
    const st = over ? "over" : under ? "under" : "ok";
    const tx = over ? "超 " + (v - t.hi).toFixed(1) + "pp"
             : under ? "欠 " + (t.lo - v).toFixed(1) + "pp" : "区间内";
    const lo = Math.max(0, Math.min(100, t.lo));
    const hi = Math.max(0, Math.min(100, t.hi));
    const pos = Math.max(0, Math.min(100, v));
    return `<div class="pmrv-m">
      <div class="nm" title="${pmEsc(t.why || t.name)}">${pmEsc(t.name)}${t.scope && t.scope !== "总仓" ? `<em>· ${pmEsc(t.scope)}</em>` : ""}</div>
      <div class="v">${v.toFixed(1)}%</div>
      <div class="tk"><i class="bd" style="left:${lo}%;width:${Math.max(hi - lo, 1)}%"></i><i class="dt" style="left:${pos}%"></i></div>
      <div class="st ${st}">${tx}</div>
    </div>`;
  }).join("");

  const issues = (R.issues || []).map(x => `
    <div class="it"><span class="dot ${pmEsc(x.sev || "mid")}"></span><div>
      <b>${pmEsc(x.title)}</b>
      <p>${pmEsc(x.fact)}</p>
      <em>${pmEsc(x.why)}</em>
    </div></div>`).join("");

  const DG = {减: "cut", 补: "add", 并: "mrg", 加: "add", 清: "cut"};
  const moves = (R.moves || []).map(x => `
    <div class="mv"><div class="dg ${DG[x.dir] || "mrg"}">${pmEsc(x.dir)}</div><div>
      <b>${pmEsc(x.what)}<span class="rg">${pmEsc(x.range || "")}</span></b>
      <p>${pmEsc(x.why)}</p>
      <em>触发 · ${pmEsc(x.trigger || "—")}</em>
    </div></div>`).join("");

  const env = R.env_asof || {};
  const list = (arr, lb) => (arr && arr.length)
    ? `<div class="row"><div class="lb">${lb}</div><div>${arr.map(x => "· " + pmEsc(x)).join("<br>")}</div></div>` : "";

  const warn = [];
  if(days != null && days > 30) warn.push(`判断写于 ${days} 天前，宏观的时效比仓位短，该重写了`);
  if(drift != null && Math.abs(drift) > 10)
    warn.push(`总仓相对写判断时（¥${anchorWan.toFixed(0)}万）变了 ${drift > 0 ? "+" : ""}${drift.toFixed(1)}%，前提已经不同`);

  const fxLine = (K.spot && K.fxDiff != null)
    ? `卫星仓按 <b>7.00</b> 折 ¥${pmFmtW(K.satCny)}；按即期 <b>${K.spot.toFixed(3)}</b>
       折 ¥${pmFmtW(K.satTot / PM_FX.USD * K.spot)}，
       记账口径比即期口径高 <b>¥${pmFmtW(Math.abs(K.fxDiff))}</b>
       （${(Math.abs(K.fxDiff) / (K.tot || 1) * 100).toFixed(1)}% 总仓）。`
    : `即期汇率这次没取到，只给记账口径。`;

  return `<div class="sec" id="pmReview" style="margin-top:18px">
    <div class="sec-h"><h2>持仓体检</h2>
      <div class="note">不是这张表的总结，是对这张表的判断 · 写于 ${pmEsc(R.as_of || "—")}${
        days ? `（${days} 天前）` : "（今天）"} · ${pmEsc(R.writer || "")}</div></div>
    <div class="pmrv">
      <div class="pmrv-say">
        <div class="blk">
          <div class="k">当前情势 <em>市场 ${pmEsc(env.market || "—")} / 风向 ${pmEsc(env.wind || "—")}</em></div>
          <b>${pmEsc((R.regime || {}).tag || "")}</b>
          <p>${pmEsc((R.regime || {}).line || "")}</p>
        </div>
        <div class="blk">
          <div class="k">结构判断</div>
          <b>${pmEsc((R.verdict || {}).tag || "")}</b>
          <p>${pmEsc((R.verdict || {}).line || "")}</p>
        </div>
        ${(R.verdict || {}).note ? `<div class="keep">${pmEsc(R.verdict.note)}</div>` : ""}
      </div>

      <div class="pmrv-rd">
        <div class="hd"><span>读 数 · 现 状 对 目 标</span><i>带＝目标区间，刻线＝现在；未注明的均为占总仓</i></div>
        ${rows}
        <div class="src">
          总仓 <b>¥${pmFmtW(K.tot)}</b>（核心 ${(K.tot ? K.core / K.tot * 100 : 0).toFixed(1)}% / 卫星 ${(K.tot ? K.satCny / K.tot * 100 : 0).toFixed(1)}%）·
          卫星 <b>${K.n}</b> 项、等效 <b>${K.eff.toFixed(0)}</b> 只 · 单只均 ${K.n ? (K.satTot / K.n / K.tot * 100).toFixed(2) : "—"}% 总仓<br>
          ${fxLine}
        </div>
      </div>

      <div class="pmrv-iss"><div class="cap">哪 里 有 问 题</div>${issues}</div>
      <div class="pmrv-mov"><div class="cap">如 果 只 动 三 处</div>${moves}</div>

      <div class="pmrv-foot">
        ${list(R.invalidates, "会让它作废")}
        ${list(R.watch, "另外盯住")}
        <div class="row"><div class="lb">口径</div><div>
          真防守＝国债＋黄金＋股指中性＋期权套利＋CTA；红利与可转债是低 beta 股票，不算。
          AI / 半导体因子＝卫星 AI 主题＋纳指 100＋标普 500×⅓。
          前五占比的分母是卫星仓，不是总仓。</div></div>
        ${warn.length ? `<div class="row warn"><div class="lb">该重写了</div><div>${warn.join("<br>")}</div></div>` : ""}
        <div class="fine"><b>右边是算的，左边是写的。</b>
          读数随你改卡片实时变，正文不动——两者对不上时，说明该重写判断了。
          判断文字不自动生成：数据每天在动，观点得有人负责。重写请改
          <b>data/portfolio/review.json</b>，或让助手按当前读数重起一版。</div>
      </div>
    </div>
  </div>`;
}

function pmRenderTotal(){
  const host = pmEl("pmTotalView");
  if(!host) return;
  const T = pmTotalData();
  const pCore = T.parts.core, pSat = T.parts.sat;
  const has = T.total > 0;
  const pct = v => T.total > 0 ? (v / T.total * 100) : 0;

  /* 构成条：两段宽度就是占比。占比为 0 时不给它撑一条假色块，
     写灰底「零」——「没有」和「很小」是两件事。 */
  const seg = (cls, name, v) => {
    const p = pct(v);
    return `<div class="sg ${p > 0 ? cls : "zero"}" style="flex-grow:${p > 0 ? Math.max(p, 0.6) : 1}">
      <span>${name}${p > 0 ? " " + p.toFixed(1) + "%" : " 0"}</span></div>`;
  };
  const barHtml = `<div class="pmbar2">
      ${seg("core", "核心仓", pCore ? pCore.cny.total : 0)}
      ${seg("sat", "卫星仓", pSat ? pSat.cny.total : 0)}
    </div>`;

  const eqParts = [];
  if(pCore && pCore.cny.total) eqParts.push(`核心仓 <b>¥${pmFmtW(pCore.cny.total)}</b>`);
  if(pSat && pSat.raw.total) eqParts.push(`卫星仓 <b>US$${pmFmtK(pSat.raw.total)}</b> × 7.00`);
  const eq = eqParts.length ? "= " + eqParts.join(" + ") : "";

  const main = `
  <div class="sec" style="margin-top:18px">
    <div class="sec-h"><h2>总仓合计</h2>
      <div class="note">人民币口径 · 折算率固定 7.00，不取实时行情</div></div>
    <div class="pmtot">
      <div class="big">
        <div class="lab">总仓 · 两仓填写金额合计 <i>非市值</i></div>
        <div class="num${has ? "" : " na"}"><span class="cur">¥</span><strong>${has ? pmFmtW(T.total) : "—"}</strong></div>
        <div class="eq">${has ? eq : "两个仓都还没有可计算的金额"}</div>
      </div>
      <div class="right">
        ${barHtml}
        <div class="pmleg">
          <span><i style="background:#a8613c"></i>核心仓 <b>¥${pmFmtW(pCore ? pCore.cny.total : 0)}</b>
            <em>${pCore ? pCore.counted + " 只基金 · " + pCore.assets + " 项资产" : "无数据"}</em></span>
          <span><i style="background:#2c4a63"></i>卫星仓 <b>¥${pmFmtW(pSat ? pSat.cny.total : 0)}</b>
            <em>${pSat ? pSat.counted + " 张 · US$" + pmFmtK(pSat.raw.total) + " × 7.00" : "无数据"}</em></span>
        </div>
      </div>
    </div>
  </div>`;

  /* 两仓构成：一行一仓，中间一句「几只 · 原币 × 汇率 = 折人民币」，
     让「这个数是怎么来的」在同一个视线里成立，不用横向追六列。 */
  const rowOf = (p, isCore) => p ? `
    <div class="row">
      <div class="nm">${p.name}<small>${isCore ? "core.json" : "matrix.json"}</small></div>
      <div class="tag">${p.cur}</div>
      <div class="tr" title="占两仓折算后合计 ${pct(p.cny.total).toFixed(1)}%">
        <i style="width:${p.cny.total > 0 ? Math.max(pct(p.cny.total), 0.8) : 0}%"></i></div>
      <div class="calc">${p.counted} ${p.unit} · ${p.cur === "CNY" ? "¥" + pmFmtW(p.raw.total) : "US$" + pmFmtK(p.raw.total)}
        × ${p.cur === "CNY" ? "1.00" : "7.00"} = <b>¥${pmFmtW(p.cny.total)}</b></div>
    </div>` : `
    <div class="row">
      <div class="nm">${isCore ? "核心仓" : "卫星仓"}<small>文件缺失</small></div>
      <div class="tag">—</div>
      <div class="tr"></div>
      <div class="calc">0 · 没有可计算的数据</div>
    </div>`;
  const table = `
  <div class="sec">
    <div class="sec-h"><h2>两仓构成</h2>
      <div class="note">核心仓按<b>基金</b>填金额、按<b>资产</b>摊分；卫星仓按<b>卡片</b>填备注</div></div>
    <div class="pmtable">
      ${rowOf(pCore, true)}${rowOf(pSat, false)}
      <div class="row sum">
        <div class="nm">总仓</div><div class="tag">CNY</div>
        <div class="tr" style="background:transparent"></div>
        <div class="calc">人民币合计 <b>¥${pmFmtW(T.total)}</b></div>
      </div>
    </div>
    <div class="pmsrc">
      折算率是<b>常量</b>：<code>PM_FX = 7.00</code>（页面）与 <code>portfolio.FX</code>（后端），两处必须一致。
      不接实时汇率，是因为总仓要能跨月比较——汇率一动，同样的持仓就会给出不同的历史合计。
      ${pCore && pCore.unparsed ? `<br>核心仓另有 <b>${pCore.unparsed}</b> 只基金金额不是「数字 k」，不计入合计。` : ""}
      ${pSat && pSat.unparsed ? `<br>卫星仓有 <b>${pSat.unparsed}</b> 张卡片备注不是完整的「数字 k」，既不计入也不当作 0。` : ""}
      ${pSat && pSat.orphanN ? `<br>卫星仓有 <b>${pSat.orphanN}</b> 张未归类卡片（¥${pmFmtW(pSat.orphan)}）不计入。` : ""}
      ${pSat && (pSat.watch || pSat.option) ? `<br>卫星仓观察中 <b>${pSat.watch}</b> 张、期权 <b>${pSat.option}</b> 张，按口径不进普通合计。` : ""}
    </div>
  </div>`;

  /* 三个合并切分：国家 / 风格 / 资产类别。
     风格保持「进攻→均衡→防御」的定义顺序：按金额排会让顺序随行情跳动，
     同一页里两个视图的顺序还不一致，读起来要重新找。国家与资产没有天然顺序，按金额降序。 */
  const splitRows = (map, names, total, order) => {
    const rows = Object.keys(map).filter(k => map[k] > 0);
    rows.sort((a, b) => {
      if(order){
        const ia = order.indexOf(a), ib = order.indexOf(b);
        if(ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      }
      return map[b] - map[a];
    });
    if(!rows.length) return `<div class="pmempty2">这一项还没有计入的金额</div>`;
    return rows.map(k => {
      const v = map[k], p = total > 0 ? v / total * 100 : 0;
      return `<div class="pmrow">
        <div class="nm" title="${pmEsc(names[k] || k)}">${pmEsc(names[k] || k)}</div>
        <div class="tr"><i style="width:${Math.max(p, 0.8)}%"></i></div>
        <div class="n">¥${pmFmtW(v)}<em>${p.toFixed(1)}%</em></div>
      </div>`;
    }).join("");
  };
  const sOrder = PMC_STYLE_DEF.map(x => x.id);
  const split = `
  <div class="sec">
    <div class="sec-h"><h2>合并切分</h2>
      <div class="note">同一总额的三种切法，<b>彼此不可相加</b></div></div>
    <div class="pmgrid3">
      <div class="pmbox">
        <div class="bt">按国家 · 两仓合并</div>
        ${splitRows(T.r, T.rname, T.total, null)}
        <div class="pmsrc" style="margin-top:8px">核心仓按资产的「国家」，卫星仓按卡片的「地区」。</div>
      </div>
      <div class="pmbox">
        <div class="bt">按风格 · 两仓合并</div>
        ${splitRows(T.s, T.sname, T.total, sOrder)}
        <div class="pmsrc" style="margin-top:8px">核心仓按资产的「风格」，卫星仓按「策略」——两边是同一组 进攻 / 均衡 / 防御。</div>
      </div>
      <div class="pmbox">
        <div class="bt">按资产类别 · 两仓合并</div>
        ${splitRows(T.c, {}, T.total, null)}
        <div class="pmsrc" style="margin-top:8px">核心仓按资产的名称逐项列；卫星仓全是个股，整仓记为 <b>股票</b> 一类。${
          (T.mergedCat || []).length
            ? `<br>名称含「股票」的 <b>${T.mergedCat.length}</b> 项（${T.mergedCat.map(pmEsc).join(" / ")}）已并入 <b>股票</b> 一项统计。`
            : ""}</div>
      </div>
    </div>
  </div>`;

  /* 体检放在总仓合计与两仓构成之间：先看合计，紧接着一句「这张表合不合理」，
     再往下才是构成与切分。放到页尾就等于「结论在最后一行」，没人翻到。 */
  host.innerHTML = main + pmrvHTML() + table + split;
}
/* ================= 核心仓：基金 → 资产（v1.38.0） =================
   卫星仓记的是个股，一只票一行，单层就够。基金不是：一只「多策略基金」里装着
   红利 40% / 商品 50% / 黄金 10%，国家与风格落在**资产**这一层。
   所以核心仓不共用卫星仓的矩阵 DOM，而是「卡里套表」：
     基金 = 一张卡（名称 + 金额 + 备注）
     资产 = 卡里的一行（名称 + 国家 + 风格 + 权重）
   统计一律在资产层：基金金额按权重切开，再按国家 / 风格 / 资产名聚合。
   权重不要求凑满 100 —— 40/50/10 和 4/5/1 是同一件事，按总和归一化。 */
const PMC_STYLE_DEF = [
  {id: "attack",  name: "进攻", color: "#70d5a2"},
  {id: "balance", name: "均衡", color: "#90d9f5"},
  {id: "defense", name: "防御", color: "#ee8d8c"}
];
const PMC_REG_DEF = [
  {id: "china", name: "中国"},   {id: "hk", name: "中国香港"},
  {id: "us",    name: "美国"},   {id: "jp", name: "日本"},
  {id: "eu",    name: "欧洲"},   {id: "other", name: "其他"}
];
/* 六个国家各自一个色相，深灰兜底；和卫星仓那四个地区色不共用，
   因为两页的「地区」口径本来就不同（那边「日韩台印」是一个合并地区）。 */
const PMC_REG_C = {china: "#a8613c", hk: "#bb8a55", us: "#2c4a63",
                   jp: "#4f9179", eu: "#9a8cae", other: "#8a8069"};
const pmcRegColor = (id, i) => PMC_REG_C[id] || PM_REG_X[i % PM_REG_X.length];

const pmcD = () => pmBook.core;
const pmcStyles = d => ((d && d.styles && d.styles.length) ? d.styles : PMC_STYLE_DEF);
const pmcRegions = d => ((d && d.regions && d.regions.length) ? d.regions : PMC_REG_DEF);
const pmcStyleOf = (d, id) => pmcStyles(d).find(s => s.id === id) || PMC_STYLE_DEF[1];
const pmcRegName = (d, id) => (pmcRegions(d).find(r => r.id === id) || {name: "其他"}).name;
let pmcFund = null, pmcAsset = null;      // 抽屉状态：{id} 或 {fundId, id}
const pmcUid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/* 基金金额 → 各资产分到的分。整数分不留零头：逐项向下取整，
   余数补到金额最大的一项，Σ 恰好等于基金金额（与后端 portfolio._split 同一算法）。 */
function pmcSplit(cents, ws){
  const n = ws.length;
  if(!n) return [];
  const sw = ws.reduce((a, b) => a + b, 0);
  if(sw <= 0){
    const base = Math.floor(cents / n), out = new Array(n).fill(base);
    out[0] += cents - base * n;
    return out;
  }
  const out = ws.map(w => Math.floor(cents * w / sw));
  const acc = out.reduce((a, b) => a + b, 0);
  let mi = 0;
  out.forEach((v, i) => { if(v > out[mi]) mi = i; });
  out[mi] += cents - acc;
  return out;
}

function pmcTotals(d){
  d = d || pmcD();
  const out = {total: 0, counted: 0, assets: 0, unparsed: 0,
               funds: [], r: {}, s: {}, c: {}, empty: true};
  if(!d || !Array.isArray(d.funds)) return out;
  const sids = new Set(pmcStyles(d).map(s => s.id));
  const rids = new Set(pmcRegions(d).map(r => r.id));
  d.funds.forEach(f => {
    const as = Array.isArray(f.assets) ? f.assets : [];
    const cents = pmParseCents(f.amount);
    if(cents == null || !as.length){ out.unparsed++; return; }
    const raw = as.map(a => (typeof a.weight === "number" && isFinite(a.weight) && a.weight >= 0)
      ? a.weight : null);
    const filled = raw.filter(w => w != null);
    let eff, norm;
    if(!filled.length){ eff = as.map(() => 1); norm = "equal"; }
    else if(filled.length < as.length){
      const rest = Math.max(100 - filled.reduce((a, b) => a + b, 0), 0);
      const blankN = as.length - filled.length;
      eff = raw.map(w => w == null ? rest / blankN : w);
      norm = "partial";
    }else{ eff = raw; norm = "weight"; }
    if(eff.reduce((a, b) => a + b, 0) <= 0){ eff = as.map(() => 1); norm = "equal"; }
    const parts = pmcSplit(cents, eff);
    const rows = as.map((a, i) => {
      const rid = rids.has(a.regionId) ? a.regionId : "other";
      const st = sids.has(a.style) ? a.style : "balance";
      const nm = String(a.name || "").trim() || "未命名";
      const c = parts[i];
      out.r[rid] = (out.r[rid] || 0) + c;
      out.s[st] = (out.s[st] || 0) + c;
      out.c[nm] = (out.c[nm] || 0) + c;
      return {id: a.id, name: nm, regionId: rid, style: st, weight: a.weight,
              cents: c, pct: cents ? c / cents * 100 : 0};
    });
    out.total += cents; out.counted++; out.assets += as.length; out.empty = false;
    out.funds.push({id: f.id, name: f.name || "", amount: f.amount || "",
                    note: f.note || "", cents: cents, norm: norm, assets: rows});
  });
  return out;
}

/* ---------------- 核心仓渲染 ---------------- */
function pmcRender(){
  const d = pmcD();
  const t = pmcTotals(d);
  const fn = d && Array.isArray(d.funds) ? d.funds.length : 0;
  if(pmEl("pmcFN")) pmEl("pmcFN").textContent = fn;
  if(pmEl("pmcAN")) pmEl("pmcAN").textContent = t.assets;
  if(pmEl("pmcTT")) pmEl("pmcTT").textContent = t.empty ? "—" : "¥" + pmFmtW(t.total);
  pmcRenderSum(t);
  pmcRenderViz(t);
  pmcRenderList(t, d);
}

function pmcRenderSum(t){
  const host = pmEl("pmcSum");
  if(!host) return;
  const has = !t.empty;
  const chip = (name, v, extra) => `<span class="pchip">${pmEsc(name)}
    <b>${v == null ? "—" : pmFmtW(v)}</b>${extra || ""}</span>`;
  const sChips = pmcStyles(pmcD()).map(s => chip(s.name, t.s[s.id])).join("");
  const rChips = pmcRegions(pmcD()).filter(r => (t.r[r.id] || 0) > 0)
    .sort((a, b) => (t.r[b.id] || 0) - (t.r[a.id] || 0))
    .map(r => chip(r.name, t.r[r.id])).join("");
  const cKeys = Object.keys(t.c).sort((a, b) => t.c[b] - t.c[a]);
  host.innerHTML = `
    <div class="tot">
      <div class="lab">核心仓合计 <i>按资产层摊分</i></div>
      <div class="num${has ? "" : " na"}"><span class="cur">¥</span><strong>${has ? pmFmtW(t.total) : "—"}</strong></div>
      <div class="recon">${has
        ? `<span class="ri"><b>${t.counted}</b> 只基金</span><span class="ri"><b>${t.assets}</b> 项资产</span>`
          + (t.unparsed ? `<span class="ri"><i class="d" style="background:#c9c5bb"></i>${t.unparsed} 只金额不可计算</span>` : "")
        : "还没有基金 · 点右上角「+ 添加基金」开始"}</div>
    </div>
    <div class="splits">
      <div class="srow"><span class="lab">按风格</span>
        <div class="chips">${sChips || `<span class="ghint">—</span>`}</div>
        <span class="ssum"><em>Σ</em>${has ? pmFmtW(t.total) : "—"}</span><span></span></div>
      <div class="srow"><span class="lab">按国家</span>
        <div class="chips">${rChips || `<span class="ghint">—</span>`}</div>
        <span class="ssum"><em>Σ</em>${has ? pmFmtW(t.total) : "—"}</span><span></span></div>
      <div class="srow"><span class="lab">按资产</span>
        <div class="chips">${cKeys.length ? cKeys.map(k => chip(k, t.c[k])).join("") : `<span class="ghint">—</span>`}</div>
        <span class="ssum"><em>Σ</em>${has ? pmFmtW(t.total) : "—"}</span><span></span></div>
      <div class="snote">三种拆分是同一总额的不同视角，右列同为 <b>Σ</b>，<b>不可相加</b>。
        金额先按各资产权重从基金摊下来，再按国家 / 风格 / 资产名汇总——所以这里的每一行都能追回到某只基金的某一行资产。</div>
    </div>`;
}

function pmcRenderViz(t){
  const el = pmEl("pmcViz");
  if(!el) return;
  const d = pmcD();
  if(t.empty){
    el.innerHTML = `<div class="vcard" style="grid-column:1/-1"><div class="vempty">
      还没有可摊分的基金金额，图表暂不生成。填了「数字 k」形式的金额（如 50k）之后才会出现。</div></div>`;
    return;
  }
  /* 国家：环形。顺序按金额降序，图例同序，否则对不上号 */
  const items = pmcRegions(d).map((r, i) => (
    {id: r.id, name: r.name, v: t.r[r.id] || 0, c: pmcRegColor(r.id, i)}
  )).filter(x => x.v > 0).sort((a, b) => b.v - a.v);

  const pie = items.length
    ? `<div class="pie">${pmPieSVG(items, t.total, "c")}<div class="lg">${items.map(x => `
        <div class="lr" title="${pmEsc(x.name)}">
          <i class="sw" style="background:linear-gradient(155deg,${pmMix(x.c, .48, [255, 255, 255])} 0%,${x.c} 52%,${pmMix(x.c, .74, [8, 12, 16])} 100%)"></i>
          <span class="nm">${pmEsc(x.name)}</span>
          <span class="am">${pmFmtW(x.v)}</span>
          <span class="pc">${pmPctStr(x.v / t.total * 100)}</span></div>`).join("")}</div></div>`
    : `<div class="vempty">暂无可计算的国家金额</div>`;

  /* 风格：温度计。三段固定顺序（进攻 → 均衡 → 防御），不按金额排——
     顺序随行情跳，每次看都要重新找位置。 */
  const gs = pmcStyles(d).map(s => ({s: s, v: t.s[s.id] || 0})).filter(x => x.v > 0);
  const thm = gs.length ? `<div class="thm">
      <div class="tl">${gs.map(x => `<div style="flex:${x.v}">
        <span class="nm"><i style="background:${x.s.color}"></i><span>${pmEsc(x.s.name)}</span></span>
        <span class="pc" style="color:${x.s.color}">${pmPctStr(x.v / t.total * 100)}</span>
        <span class="am">¥${pmFmtW(x.v)}</span></div>`).join("")}</div>
      <div class="tube">
        <span class="bulb" style="background:radial-gradient(circle at 33% 26%,
          ${pmMix(gs[0].s.color, .30, [255, 255, 255])} 0%,
          ${pmMix(gs[0].s.color, .78, [255, 255, 255])} 16%,
          ${gs[0].s.color} 48%,
          ${pmMix(gs[0].s.color, .62, [8, 12, 16])} 100%)"></span>
        ${gs.map(x => `<span class="seg" style="flex:${x.v};background:linear-gradient(180deg,
          ${pmMix(x.s.color, .52, [255, 255, 255])} 0%,
          ${pmMix(x.s.color, .88, [255, 255, 255])} 24%,
          ${x.s.color} 56%,
          ${pmMix(x.s.color, .78, [8, 12, 16])} 100%)"></span>`).join("")}</div>
      <div class="scale">${[0, 25, 50, 75, 100].map(v => `<span>${v}${v === 100 ? "%" : ""}</span>`).join("")}</div>
    </div>` : `<div class="vempty">暂无可计算的风格金额</div>`;

  /* 资产：格子。面积＝摊到的金额，颜色跟所属风格走，
     所以这张图同时读得出「哪类资产最重、它属于哪一段」。 */
  const rows = Object.keys(t.c).map(k => ({name: k, v: t.c[k]}))
    .sort((a, b) => b.v - a.v);
  const styleOfName = {};
  (t.funds || []).forEach(f => f.assets.forEach(a => {
    const cur = styleOfName[a.name];
    if(!cur || a.cents > cur.v){ styleOfName[a.name] = {style: a.style, v: a.cents}; }
  }));
  /* 格子按「切片」切：每次把剩余矩形沿长边按权重一分为二，面积严格等于金额，
     不存在「最后一行被拉宽」的假象——那会让 6% 的资产看起来和 30% 一样大。 */
  pmcTileData = {items: rows.map(x => ({name: x.name, v: x.v,
    style: (styleOfName[x.name] || {}).style || "balance"})), total: t.total};

  el.innerHTML = `
    <div class="vcard">
      <div class="vhead"><span class="t">按国家 · 环形</span>
        <span class="n">环段长度 = 占总额比例</span></div>
      ${pie}
    </div>
    <div class="vcard">
      <div class="vhead"><span class="t">按风格 · 温度计</span>
        <span class="n">管长 = 占总额比例</span></div>
      ${thm}
    </div>
    <div class="vcard vtheme">
      <div class="vhead"><span class="t">按资产 · 格子大小</span>
        <span class="n">格子面积 = 摊到的金额，颜色＝所属风格</span></div>
      <div class="cblocks" id="pmcBlocks"></div>
    </div>`;
  pmcDrawTiles();
}

/* 方格图的切片：把矩形按权重一分为二，再对两半递归。面积严格按金额，
   小到写不下字的格子就只留颜色——硬塞文字会溢出到邻居身上。 */
let pmcTileData = null;
function pmcSlice(items, x, y, w, h, out){
  if(!items.length) return;
  if(items.length === 1){ out.push(Object.assign({}, items[0], {x: x, y: y, w: w, h: h})); return; }
  const sum = items.reduce((a, b) => a + b.v, 0);
  if(sum <= 0) return;
  let i = 0, acc = 0;
  while(i < items.length - 1){ acc += items[i].v; if(acc >= sum / 2) break; i++; }
  const A = items.slice(0, i + 1), B = items.slice(i + 1);
  if(!B.length){ out.push(Object.assign({}, items[0], {x: x, y: y, w: w, h: h})); return; }
  const f = acc / sum;
  if(w >= h){
    const aw = Math.round(w * f);
    pmcSlice(A, x, y, aw, h, out);
    pmcSlice(B, x + aw, y, w - aw, h, out);
  }else{
    const ah = Math.round(h * f);
    pmcSlice(A, x, y, w, ah, out);
    pmcSlice(B, x, y + ah, w, h - ah, out);
  }
}
function pmcDrawTiles(){
  const box = pmEl("pmcBlocks");
  if(!box || !pmcTileData) return;
  const W = box.clientWidth;
  /* 面板还没显示时宽度是 0：量不到就等下一帧，不能按 0 切出一堆零宽格子 */
  if(!W){ requestAnimationFrame(pmcDrawTiles); return; }
  const H = box.clientHeight || 190;
  const rects = [];
  pmcSlice(pmcTileData.items, 0, 0, W, H, rects);
  const d = pmcD(), total = pmcTileData.total || 1;
  /* 材质、标签梯子、右下角百分比水印全部与卫星仓的主题方格共用
     （`pmMetalDefs` / `pmMetalCell` / `pmCellLabel` / `pmPctMark`），
     区别只有颜色：这里按**风格**取色，那里按所属策略取色。
     id 前缀用 pmc，避免与卫星仓那份 defs 撞名——同一个 id 只认文档里靠前的那个，
     后画的那份会引用到被 display:none 藏着的定义上，一条线都不画。 */
  const GAP = 3, out = [], defs = [pmMetalDefs("pmc")];
  rects.forEach((r, k) => {
    const st = pmcStyleOf(d, r.style);
    const base = (st && st.color) ? st.color : "#8d8778";
    const x = r.x + GAP / 2, y = r.y + GAP / 2;
    const w = Math.max(1, r.w - GAP), h = Math.max(1, r.h - GAP);
    const rr = Math.min(13, Math.max(4, Math.min(w, h) * .055));
    const p = r.v / total * 100;
    out.push(`<g><title>${pmEsc(r.name)} ¥${pmFmtW(r.v)} · ${p.toFixed(1)}%</title>
      ${pmMetalCell(x, y, w, h, rr, base, k, "pmc", defs)}`);
    out.push(pmPctMark(x, y, w, h, p));
    out.push(pmCellLabel(x, y, w, h, r.name, "¥" + pmFmtW(r.v), p));
    out.push(`</g>`);
  });
  box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
    role="img" aria-label="按资产占比"><defs>${defs.join("")}</defs>${out.join("")}</svg>`;
}
let pmcTileTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(pmcTileTimer);
  pmcTileTimer = setTimeout(() => {
    if(pmMode === "core" && pmEl("pmcBlocks")) pmcDrawTiles();
  }, 200);
});

function pmcRenderList(t, d){
  const host = pmEl("pmcList");
  if(!host) return;
  const funds = (d && Array.isArray(d.funds)) ? d.funds : [];
  if(!funds.length){
    host.innerHTML = `<div class="pmempty" style="border:1px dashed var(--line);background:#fff;border-radius:10px">
      <div class="ic">＋</div><h3>还没有基金</h3>
      <p>点右上角「+ 添加基金」。一只基金一条：先填名称与金额，
        再在它下面加资产（红利 / 商品 / 黄金……），每个资产填国家、风格和权重。<br>
        金额写 <b>50k</b> 就是 <b>50,000 元</b>。</p></div>`;
    return;
  }
  const sumById = {};
  (t.funds || []).forEach(f => { sumById[f.id] = f; });
  host.innerHTML = funds.map(f => {
    const agg = sumById[f.id] || null;
    const as = Array.isArray(f.assets) ? f.assets : [];
    const cents = pmParseCents(f.amount);
    const chip = agg && agg.norm === "equal"
      ? `<span class="chip" title="这只基金的资产权重一个都没填，按资产个数等分">等分</span>`
      : agg && agg.norm === "partial"
        ? `<span class="chip" title="有资产没填权重，剩余部分由它们等分">部分等分</span>` : "";
    const wsum = as.reduce((a, x) => a + (typeof x.weight === "number" && isFinite(x.weight) ? x.weight : 0), 0);
    const wchip = (wsum > 0 && Math.abs(wsum - 100) > 0.01)
      ? `<span class="chip" title="权重合计不是 100%，按比例归一化">合计 ${wsum}%</span>` : "";

    const rows = as.map((a, i) => {
      const st = pmcStyleOf(d, a.style);
      const w = (typeof a.weight === "number" && isFinite(a.weight)) ? a.weight : null;
      const c = cents != null && agg ? agg.assets[i].cents : null;
      const pct = c != null && cents ? c / cents * 100 : null;
      return `<tr data-aid="${pmEsc(a.id)}">
        <td class="nm" title="点开编辑">${pmEsc(a.name || "未命名")}</td>
        <td>${pmEsc(pmcRegName(d, a.regionId))}</td>
        <td><span class="stl"><i style="background:${pmSoften(st.color)}"></i>${pmEsc(st.name)}</span></td>
        <td><div class="wcell"><div class="wbar"><i style="width:${Math.min(pct == null ? 0 : pct, 100)}%"></i></div>
          <span class="num">${w == null ? "等分" : w + "%"}</span></div></td>
        <td class="num rt">${c == null ? "—" : "¥" + pmFmtW(c)}</td>
        <td class="pc">${pct == null ? "—" : pmPctStr(pct)}</td>
      </tr>`;
    }).join("");

    return `<div class="cfund" data-fid="${pmEsc(f.id)}">
      <div class="fh">
        <span class="nm" title="点开改名称与金额">${pmEsc(f.name || "未命名基金")}</span>
        <span class="am">${cents == null ? `<span class="na">金额未计</span>` : "¥" + pmFmtW(cents)}</span>
        ${chip}${wchip}
        ${f.note ? `<span class="na" title="${pmEsc(f.note)}">${pmEsc(f.note)}</span>` : ""}
        <span class="r">
          <button data-act="fund" title="改名称 / 金额 / 备注">编辑基金</button>
          <button data-act="add" title="在这只基金下面加一项资产">+ 资产</button>
        </span>
      </div>
      <table class="cft">
        <colgroup><col style="width:26%"><col style="width:14%"><col style="width:13%">
          <col style="width:17%"><col style="width:16%"><col style="width:14%"></colgroup>
        <thead><tr><th>资产</th><th>国家</th><th>风格</th><th>权重</th>
          <th style="text-align:right">摊到金额</th><th style="text-align:right">占基金</th></tr></thead>
        <tbody>${rows}
          <tr class="addrow"><td colspan="6">
            <button data-act="add">＋ 在这只基金下面加一项资产</button></td></tr>
        </tbody>
      </table>
      <div class="cband"><b>${as.length}</b> 项资产 · 权重合计 <b>${wsum ? wsum + "%" : "未填（等分）"}</b>
        ${cents == null ? ` · <b>金额写成「数字 k」才会计入合计</b>` : ` · 摊分后合计 <b>¥${pmFmtW(cents)}</b>`}</div>
    </div>`;
  }).join("");

  /* 事件委托：卡片是整块重渲染的，逐个绑会漏掉新节点 */
  host.onclick = ev => {
    const fund = ev.target.closest(".cfund");
    if(!fund) return;
    const fid = fund.dataset.fid;
    const btn = ev.target.closest("[data-act]");
    if(btn){
      if(btn.dataset.act === "fund") pmcOpenFund(fid);
      if(btn.dataset.act === "add") pmcOpenAsset(fid, null);
      return;
    }
    const tr = ev.target.closest("tr[data-aid]");
    if(tr){ pmcOpenAsset(fid, tr.dataset.aid); return; }
    if(ev.target.closest(".fh")) pmcOpenFund(fid);
  };
}

/* ---------------- 核心仓编辑 ---------------- */
function pmcEnsure(){
  let d = pmcD();
  if(!d){
    d = {schemaVersion: 2, currency: "CNY", styles: PMC_STYLE_DEF,
         regions: PMC_REG_DEF, funds: []};
    pmBook.core = d; pm = d;
  }
  if(!Array.isArray(d.funds)) d.funds = [];
  return d;
}
function pmcOpenDrawer(id, on){
  if(on){
    ["pmcFDr", "pmcADr"].forEach(x => { if(x !== id && pmEl(x)) pmEl(x).classList.remove("on"); });
  }
  pmEl(id).classList.toggle("on", on);
  const any = ["pmcFDr", "pmcADr"].some(x => pmEl(x) && pmEl(x).classList.contains("on"));
  if(pmEl("pmcMask")) pmEl("pmcMask").classList.toggle("on", any);
}
function pmcCloseAll(){
  pmcOpenDrawer("pmcFDr", false);
  pmcOpenDrawer("pmcADr", false);
  pmcFund = null; pmcAsset = null;
}
function pmcOpenFund(fid){
  const d = pmcEnsure();
  const f = fid ? (d.funds || []).find(x => x.id === fid) : null;
  pmcFund = f ? {id: f.id} : {id: null};
  pmEl("pmcFT").textContent = f ? "编辑基金" : "新增基金";
  pmEl("pmcFName").value = f ? (f.name || "") : "";
  pmEl("pmcFAmt").value = f ? (f.amount || "") : "";
  pmEl("pmcFNote").value = f ? (f.note || "") : "";
  pmEl("pmcFDel").style.visibility = f ? "" : "hidden";
  pmEl("pmcFCalc").textContent = f ? fmtFundCalc(f) : "新基金默认带一项与它同名的资产，加完再拆。";
  pmcOpenDrawer("pmcFDr", true);
  setTimeout(() => pmEl("pmcFName").focus(), 60);
}
function fmtFundCalc(f){
  const c = pmParseCents(f.amount);
  const n = (f.assets || []).length;
  if(c == null) return "金额不是「数字 k」形式，这只基金暂时不计入合计（原文照常保存）。";
  return `计入 ¥${pmFmtW(c)}（${(c / 100).toLocaleString("zh-CN")} 元）· 摊到 ${n} 项资产。`;
}
function pmcSaveFund(){
  const d = pmcEnsure();
  const name = (pmEl("pmcFName").value || "").trim();
  if(!name){ pmToast("基金得有个名字"); pmEl("pmcFName").focus(); return; }
  const amount = (pmEl("pmcFAmt").value || "").trim();
  const note = (pmEl("pmcFNote").value || "").trim();
  let f = pmcFund && pmcFund.id ? d.funds.find(x => x.id === pmcFund.id) : null;
  if(f){ f.name = name; f.amount = amount; f.note = note; }
  else{
    f = {id: pmcUid("f_"), name: name, amount: amount, note: note,
         assets: [{id: pmcUid("a_"), name: name, regionId: "china",
                   style: "balance", weight: null}]};
    d.funds.push(f);
    pmToast("已添加基金，再点「+ 资产」把它拆开");
  }
  pm = d;
  pmPersist(); pmcRender();
  pmcCloseAll();
}
function pmcDelFund(){
  const d = pmcEnsure();
  if(!pmcFund || !pmcFund.id) return;
  const f = d.funds.find(x => x.id === pmcFund.id);
  if(!f) return;
  if(!confirm(`删除基金「${f.name}」？它下面的 ${(f.assets || []).length} 项资产会一起删掉。\n（旧版本会自动备份到 data/portfolio/backups/）`)) return;
  d.funds = d.funds.filter(x => x.id !== f.id);
  pm = d;
  pmPersist(); pmcRender();
  pmcCloseAll();
}
function pmcOpenAsset(fid, aid){
  const d = pmcEnsure();
  const f = d.funds.find(x => x.id === fid);
  if(!f){ pmToast("这只基金不在了"); return; }
  if(!Array.isArray(f.assets)) f.assets = [];
  const a = aid ? f.assets.find(x => x.id === aid) : null;
  pmcAsset = {fundId: fid, id: a ? a.id : null};
  pmEl("pmcAT").textContent = a ? "编辑资产" : "新增资产";
  pmEl("pmcAName").value = a ? (a.name || "") : "";
  pmEl("pmcAReg").innerHTML = pmcRegions(d)
    .map(r => `<option value="${pmEsc(r.id)}">${pmEsc(r.name)}</option>`).join("");
  pmEl("pmcAReg").value = a ? a.regionId : "china";
  pmcSetStyle(a ? a.style : "balance");
  pmEl("pmcAW").value = (a && typeof a.weight === "number") ? a.weight : "";
  pmEl("pmcADel").style.visibility = a ? "" : "hidden";
  pmcCalcAsset();
  pmcOpenDrawer("pmcADr", true);
  setTimeout(() => pmEl("pmcAName").focus(), 60);
}
function pmcSetStyle(st){
  pmEl("pmcASeg").querySelectorAll("button")
    .forEach(b => b.classList.toggle("on", b.dataset.s === st));
}
function pmcGetStyle(){
  const b = pmEl("pmcASeg").querySelector("button.on");
  return b ? b.dataset.s : "balance";
}
function pmcCalcAsset(){
  const box = pmEl("pmcACalc");
  if(!box) return;
  const d = pmcD();
  const f = d && (d.funds || []).find(x => x.id === (pmcAsset && pmcAsset.fundId));
  const cents = f ? pmParseCents(f.amount) : null;
  const wRaw = (pmEl("pmcAW").value || "").trim();
  const w = wRaw === "" ? null : Number(wRaw.replace(/[%\s]/g, ""));
  const n = f ? Math.max((f.assets || []).length, 1) : 1;
  if(cents == null){
    box.textContent = "这只基金还没有可计算的金额，摊分金额在填好金额后显示。";
    return;
  }
  if(w == null){
    box.textContent = `权重留空 → 与这只基金的其余资产等分，当前约 ¥${pmFmtW(Math.round(cents / n))}。`;
    return;
  }
  if(!isFinite(w) || w < 0){ box.textContent = "权重填一个 ≥0 的数字，或者留空等分。"; return; }
  box.textContent = `约占本基金 ${w}% → 约 ¥${pmFmtW(Math.round(cents * w / 100))}（按权重归一化后的实际占比以列表为准）。`;
}
function pmcSaveAsset(){
  const d = pmcEnsure();
  if(!pmcAsset) return;
  const f = d.funds.find(x => x.id === pmcAsset.fundId);
  if(!f){ pmToast("这只基金不在了"); return; }
  const name = (pmEl("pmcAName").value || "").trim();
  if(!name){ pmToast("资产得有个名字"); pmEl("pmcAName").focus(); return; }
  const wRaw = (pmEl("pmcAW").value || "").trim();
  let weight = null;
  if(wRaw !== ""){
    const n = Number(wRaw.replace(/[%\s]/g, ""));
    if(!isFinite(n) || n < 0){ pmToast("权重只能填数字，或者留空等分"); return; }
    weight = n;
  }
  const row = {id: pmcAsset.id || pmcUid("a_"), name: name,
               regionId: pmEl("pmcAReg").value, style: pmcGetStyle(), weight: weight};
  if(!Array.isArray(f.assets)) f.assets = [];
  if(pmcAsset.id){
    const i = f.assets.findIndex(x => x.id === pmcAsset.id);
    if(i >= 0) f.assets[i] = row; else f.assets.push(row);
  }else{
    f.assets.push(row);
  }
  pm = d;
  pmPersist(); pmcRender();
  pmcCloseAll();
}
function pmcDelAsset(){
  const d = pmcEnsure();
  if(!pmcAsset || !pmcAsset.id) return;
  const f = d.funds.find(x => x.id === pmcAsset.fundId);
  if(!f) return;
  if((f.assets || []).length <= 1){
    pmToast("每只基金至少留一项资产；整只不要了请删基金");
    return;
  }
  f.assets = f.assets.filter(x => x.id !== pmcAsset.id);
  pm = d;
  pmPersist(); pmcRender();
  pmcCloseAll();
}


/* 策略色是数据自带的亮色，直接铺在米黄底上会发荧光。
   柔化到 40% 后只做 2px 色条和 6px 圆点，面积小、不抢文字的层级。 */
function pmSoften(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if(!m) return "#d3d1c7";
  const v = parseInt(m[1], 16);
  const ch = [v >> 16, (v >> 8) & 255, v & 255];
  const bg = [246, 245, 242];
  return "#" + ch.map((x, i) => {
    const y = Math.round(x * 0.4 + bg[i] * 0.6);
    return ("0" + y.toString(16)).slice(-2);
  }).join("");
}

/* ---------------- 汇总 ---------------- */
/* src 可选：总仓要同时算两个仓，不能靠全局 pm 轮流指。
   缺省仍读 pm，所以卫星仓那条老路的调用点一个都不用改。
   d 为空时返回一份零值结构，而不是抛异常：总仓视图下 pm 还没指向任何仓，
   而浏览器的「恢复表单状态」会在页面加载后对搜索框补发一次 input——
   那一下就会走到这里。宁可返回空汇总，也不要让控制台红一条。 */
function pmTotals(src){
  const d = src || pm;
  if(!d) return {total: 0, counted: 0, watch: 0, option: 0, unparsed: 0, held: 0, add: 0,
                 orphan: 0, orphanN: 0, g: {}, r: {}, c: {}, cell: {}, opts: [], cur: "USD"};
  const colGroup = new Map((d.columns || []).map(c => [c.id, c.groupId]));
  const grpIds = new Set((d.groups || []).map(g => g.id));
  const regIds = new Set((d.regions || []).map(r => r.id));
  const t = {total: 0, counted: 0, watch: 0, option: 0, unparsed: 0, held: 0, add: 0,
             orphan: 0, orphanN: 0, g: {}, r: {}, c: {}, cell: {}, opts: [],
             cur: (d && d.currency) || "USD"};
  (d.items || []).forEach(it => {
    const st = it.status;
    if(st === "option"){ t.option++; t.opts.push(it); return; }
    if(st === "watch"){ t.watch++; return; }
    if(PM_COUNTED.indexOf(st) < 0){ t.unparsed++; return; }
    const c = pmParseCents(it.amount);
    /* 未归类（主题被删掉）：卡片留着、看得见、点得开，但三种拆分与合计都不收它。
       收而不拆会让「三种切法是同一总额的不同视角」当场失效——地区算它、主题不算它。 */
    if(!it.columnId){ t.orphanN++; t.orphan += c == null ? 0 : c; return; }
    const gid = colGroup.get(it.columnId);
    if(c == null || !gid || !grpIds.has(gid) || !regIds.has(it.regionId)){ t.unparsed++; return; }
    t.total += c; t.counted++;
    if(st === "held") t.held++; else t.add++;
    t.g[gid] = (t.g[gid] || 0) + c;
    t.r[it.regionId] = (t.r[it.regionId] || 0) + c;
    t.c[it.columnId] = (t.c[it.columnId] || 0) + c;
    const k = it.columnId + "\u001f" + it.regionId;
    t.cell[k] = (t.cell[k] || 0) + c;
  });
  return t;
}
const pmCellSum = (t, c, r) => t.cell[c + "\u001f" + r];
const pmColsInOrder = () => {
  const out = [], by = new Map((pm.groups || []).map(g => [g.id, []]));
  (pm.columns || []).forEach(c => { if(by.has(c.groupId)) by.get(c.groupId).push(c); else out.push(c); });
  (pm.groups || []).forEach(g => (by.get(g.id) || []).forEach(c => out.push(c)));
  return out;
};

/* ---------------- 持久化 ---------------- */
/* book 可选：初始化时要把两个仓的草稿各读一次，不能靠全局 pmMode 轮着读。
   缺省仍取当前仓，老的调用点不用改。 */
function pmLoadLocal(book){
  const key = PM_KEY[book || (pmMode === "core" ? "core" : "sat")];
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const o = JSON.parse(raw);
    /* 卫星仓看 items，核心仓看 funds——两种结构各认各的，
       否则核心仓的草稿会被当成「不是这份数据」直接丢掉。 */
    if(o && o.data && (Array.isArray(o.data.items) || Array.isArray(o.data.funds))){
      pmDraftAt[book || (pmMode === "core" ? "core" : "sat")] = o.savedAt || "";
      pmLocalAt = o.savedAt || "";
      return o.data;
    }
  }catch(e){ /* 本地副本坏了就退回构建数据 */ }
  return null;
}
/* 改动分两层落：先写浏览器草稿（毫秒级、断了网也在），再写回源文件。
   只写浏览器等于把数据押在「用户不清缓存」上，那是不能接受的——
   源文件才是权威副本，草稿只是写盘失败时的兜底。
   草稿按仓分开存：核心仓的改动不该覆盖卫星仓的本机副本。 */
function pmPersist(){
  if(pmMode!=="total")pmBook[pmMode]=pm;
  let drafted = false;
  try{
    localStorage.setItem(pmKey(), JSON.stringify({savedAt: new Date().toISOString(), data: pmPure(pm)}));
    pmLocalAt = pmNow();
    drafted = true;
  }catch(e){ drafted = false; }
  if(!drafted) { pmSaveBadge("nostore"); pmFailBanner(true); }
  pmPushFile();
  return drafted;
}

/* ---- 写回源文件 ---- */
let pmPushTimer = null, pmPushState = "idle", pmFileAt = "", pmFileOK = false;
function pmNow(){ return new Date().toISOString(); }
function pmStamp(iso){
  if(!iso) return "";
  return String(iso).replace("T", " ").slice(0, 16);
}
function pmPushFile(immediate){
  if(pmMode === "total") return;                   // 总仓是只读视图，没有可写的东西
  if(pmPushState === "offline"){ pmSaveBadge("offline"); return; }
  if(pmPushState === "conflict"){ return; }        // 冲突未决，先别写
  pmPushState = "dirty"; pmSaveBadge("dirty");
  clearTimeout(pmPushTimer);
  /* 快照与目标仓必须在**排定时**就定下来，不能在定时器里现取：
     600ms 去抖期内用户可能已经切了视图，那一刻 pm 指向的是另一份数据，
     现取就会把卫星仓的内容写进 core.json（反之亦然）。 */
  const book = pmMode === "core" ? "core" : "sat";
  const data = pmPure(pm);
  pmPushTimer = setTimeout(() => pmFlushFile(book, data), immediate ? 0 : 600);
}
async function pmFlushFile(book, data){
  book = book || (pmMode === "core" ? "core" : "sat");
  data = data || pmPure(pm);
  if(pmPushState === "saving") return;
  pmPushState = "saving"; pmSaveBadge("saving");
  try{
    const r = await fetch(book === "core" ? "/api/core" : "/api/portfolio", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({matrix: data})
    });
    const j = await r.json().catch(() => ({}));
    if(!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
    /* 写回的是 book 这一仓，但徽标只在「用户还停在这一仓」时更新；
       否则会拿核心仓的写盘时间去标卫星仓的状态。 */
    if(pmMode === book){
      pmFileAt = j.as_of || pmFileAt; pmFileOK = true;
      pmSaveBadge("ok");
      pmFailBanner(false);
      if(j.backup) pmEl("pmSave").title =
        "已写入 " + (j.path || "data/portfolio/") + "（" + j.bytes + " 字节）" +
        "；写前旧版备份为 backups/" + j.backup;
    }
  }catch(err){
    // file:// 打开或服务没起：不是错误，是没连上，退回「草稿」模式说清楚
    const offline = location.protocol === "file:" || (err instanceof TypeError);
    pmPushState = offline ? "offline" : "fail";
    if(pmMode === book){
      pmSaveBadge(offline ? "offline" : "fail", err && err.message);
      pmFailBanner(true, offline ? "offline" : "fail", err && err.message);
    }
  }
}

const PM_BADGE = {
  ok:      () => "已写入源文件" + (pmFileAt ? " · " + pmFileAt : ""),
  nodata:  () => "没有数据文件 · 不会写盘",
  saving:  () => "正在写回源文件…",
  dirty:   () => "有改动，准备写回…",
  offline: () => "未连本地服务 · 改动只在本机",
  fail:    () => "写回失败 · 草稿还在本机",
  nostore: () => "草稿也没写成 · 只在当前页"
};
function pmSaveBadge(st, detail){
  /* 两个仓各有一条工具条，徽标也得写回各自那一条——否则核心仓的存盘状态
     会显示在卫星仓的条上，看着像「卫星仓刚被改过」。 */
  const el = pmEl(pmMode === "core" ? "pmcSave" : "pmSave");
  if(!el) return;
  el.className = "st" + (st === "ok" ? "" : st === "fail" || st === "nostore" ? " err" : " warn");
  el.textContent = (PM_BADGE[st] || PM_BADGE.ok)();
  if(detail) el.title = detail;
}
/* 本机草稿 vs 源文件：两份都不静默丢弃，选一份，另一份先备份。 */
function pmConflictBanner(localAt, fileAt, fresh){
  const el = pmEl("pmFail");
  if(!el) return;
  el.style.display = "";
  el.innerHTML = `<span><b>本机草稿和源文件不一致</b>——本机 ${pmStamp(localAt) || "未知"}，
    源文件 ${pmStamp(fileAt) || "未知"}。选一份留下，另一份会先备份。</span>
    <span class="r"><button class="btn" id="pmKeepLocal">用本机覆盖文件</button>
      <button class="btn" id="pmKeepFile">用文件覆盖本机</button></span>`;
  pmEl("pmKeepLocal").onclick = () => {
    pmConflict[pmMode === "core" ? "core" : "sat"] = null;
    pmPushState = "idle"; pmFailBanner(false); pmPushFile(true);
    pmToast("正在把本机草稿写回源文件，旧文件先备份");
  };
  pmEl("pmKeepFile").onclick = () => {
    pmConflict[pmMode === "core" ? "core" : "sat"] = null;
    try{
      const raw = localStorage.getItem(pmKey());
      if(raw) localStorage.setItem(pmKey() + "_bak_" + Date.now(), raw);
    }catch(e){ /* 备份失败不阻断，文件本身是完整的 */ }
    try{ localStorage.removeItem(pmKey()); }catch(e){}
    pmLocalAt = ""; pm = fresh;
    pmBook[pmMode === "core" ? "core" : "sat"] = fresh;
    pmPushState = "idle"; pmFailBanner(false);
    pmRenderAll(); pmSaveBadge("ok");
    pmToast("已改用源文件版本；原草稿另存为本机备份");
  };
}
function pmFailBanner(on, kind, detail){
  const el = pmEl(pmMode === "core" ? "pmcFail" : "pmFail");
  if(!el) return;
  el.style.display = on ? "" : "none";
  if(!on) return;
  if(kind === "offline"){
    el.innerHTML = `<span><b>改动还没进文件</b>：当前不是通过本地服务打开的，页面写不了磁盘。
      草稿存在这台浏览器里；要长期保存请<b>导出 JSON</b>，或从 <code>start-dashboard.bat</code> 启动服务后再编辑。</span>
      <span class="r"><button class="btn" id="pmFailExp">导出 JSON</button>
        <button class="btn" id="pmFailRetry">重试写回</button></span>`;
    pmEl("pmFailRetry").onclick = () => {
      pmPushState = "idle"; pmFailBanner(false); pmPushFile(true);
    };
    pmEl("pmFailExp").onclick = pmExport;
    return;
  }
  el.innerHTML = `<span><b>${kind === "nostore" ? "本机草稿没写成" : "写回源文件失败"}</b>：
    ${pmEsc(detail || "未知原因")}。页面上的内容没丢，但还没落盘。</span>
    <span class="r"><button class="btn" id="pmFailRetry">重试</button>
      <button class="btn" id="pmFailExp">先导出 JSON</button></span>`;
  pmEl("pmFailRetry").onclick = () => { pmPushState = "idle"; pmPushFile(true); };
  pmEl("pmFailExp").onclick = pmExport;
}
function pmToast(msg){
  const el = pmEl("pmToast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(pmToast._t);
  pmToast._t = setTimeout(() => el.classList.remove("on"), 2400);
}

/* ---------------- 渲染：顶栏 ---------------- */
function pmRenderBar(t){
  pmEl("pmN").textContent = (pm.items || []).length;
  pmEl("pmC").textContent = t.counted;
  pmEl("pmW").textContent = t.watch;
  pmEl("pmO").textContent = t.option;
  pmEl("pmU").textContent = t.unparsed;
  pmSaveBadge("saved");
}

/* ---------------- 渲染：汇总卡 + 期权条 ---------------- */
/* ---------------- 图表：同一总额的三种视觉切法 ----------------
   三张图读的是同一份 pmTotals()，所以不存在「图和数据对不上」——
   它们只是把 362.4k 换个形状摆出来，不产生任何新数字。 */

/* 地区配色：四个色相 + 一条明度阶梯。
   原先四个颜色把明度都压在 .27–.33 这个窄带里，只靠色相区分——在 19px 粗的
   环上、还叠着金属渐变，深蓝和墨绿几乎读成同一块。判断一块颜色能不能分开，
   靠的是**明度和色相同时拉开**，任一维度都不能省：
     us    .27 深海军蓝   asia  .51 玉绿
     china .43 赤陶       europe .56 淡紫灰
   相邻两块（us-asia、asia-china、china-europe、europe-us）至少一项差 60° 色相
   或 0.12 明度；四个摆一起仍是同一档低饱和，不至于跳出米黄纸的底子。
   「其他」（v1.38.1）刻意取中性灰：它不是一个国家，色相越正越像又一个地区。 */
const PM_REG_C = {us: "#2c4a63", china: "#a8613c", asia: "#4f9179", europe: "#9a8cae",
  other: "#7f7b76"};
const PM_REG_X = ["#7a6a86", "#3d5a70", "#8a6a48", "#5c7a63"];
const pmRegColor = (id, i) => PM_REG_C[id] || PM_REG_X[i % PM_REG_X.length];

/* 往某个底色里兑色，k = 原色占比。图表需要「同色系但不同深浅」，硬编码色值会散架。 */
function pmMix(hex, k, base){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if(!m) return "#d3d1c7";
  const v = parseInt(m[1], 16);
  const ch = [v >> 16, (v >> 8) & 255, v & 255];
  const b = base || [255, 255, 255];
  return "#" + ch.map((x, i) => {
    const y = Math.round(x * k + b[i] * (1 - k));
    return ("0" + Math.max(0, Math.min(255, y)).toString(16)).slice(-2);
  }).join("");
}
const pmTint = (hex, k) => pmMix(hex, k, [246, 245, 242]);   // → 更浅，向页面底色靠
const pmDeep = hex => pmMix(hex, 0.5, [31, 35, 40]);          // → 更深，向墨色靠
const pmPctStr = p => p.toFixed(1) + "%";   // 一律一位小数：不同图里同一块要能对上

function pmLum(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if(!m) return 1;
  const v = parseInt(m[1], 16);
  const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(v >> 16) + 0.7152 * f((v >> 8) & 255) + 0.0722 * f(v & 255);
}
/* 估宽：中文按 1 个字宽、拉丁按 0.56 个字宽。只用来判断标签放不放得下。 */
const pmTextW = (s, fs) => String(s).split("").reduce(
  (a, ch) => a + (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? fs : fs * 0.56), 0);

/* ---- 环形：抛光金属 ----
   一圈环 = 一段被车出来的金属环。金属的读法不是「一个颜色」，而是同一色相沿
   截面走一遍明度：外缘吃光发白 → 中段本色 → 下缘压深 → 最底一线反光。
   6 个停靠点就是这条曲线；少一个就会退回成「一块颜色」。 */
/* 每一片只做 7% 的上下差——它的作用是「别像一块纯色纸」，不是照明。
   v1.25.2 把照明做在每一片自己的包围盒里：下半圈的高光落在下缘、上半圈的
   落在上缘，整圈像被喷枪吹过，还把四个颜色压成同一种深灰。**一块材料只有
   一束光**，所以照明必须是整圈共享的一层（见 pmPieSVG 里的 pmSheen）。 */
const PM_METAL = c => [
  [0,  pmMix(c, .94, [255, 255, 255])],
  [.5, c],
  [1,  pmMix(c, .92, [12, 16, 20])]
];
function pmGrad(id, stops, x1, y1, x2, y2){
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`
    + stops.map(([o, c, a]) =>
        `<stop offset="${o}" stop-color="${c}"${a == null ? "" : ` stop-opacity="${a}"`}/>`).join("")
    + `</linearGradient>`;
}
/* ns 可选：同一页出现第二个环时用来区分渐变的 id。
   SVG 的渐变靠 id 引用，两处同名时浏览器只认**文档里靠前**的那一个；
   卫星仓的环在 DOM 里排在核心仓前面，于是核心仓的引用会落到它身上——
   它那时正被 display:none 藏着，描边就成了「引用不到 → 不画」。
   默认空串，卫星仓的 id 与 v1.36.0 一字不差。 */
function pmPieSVG(items, total, ns){
  const P = ns || "";
  const S = 140, cx = S / 2, cy = S / 2, R = 63, TH = 19, r = R - TH / 2;
  const n = items.length, GAP = n > 1 ? 0.032 : 0;   // 弧度
  let a = -Math.PI / 2;
  const defs = [], out = [];
  defs.push(`<linearGradient id="${P}pmSheen" gradientUnits="userSpaceOnUse"
      x1="${S * .1}" y1="0" x2="${S * .86}" y2="${S}">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>
    <stop offset=".34" stop-color="#ffffff" stop-opacity=".04"/>
    <stop offset=".60" stop-color="#000000" stop-opacity=".03"/>
    <stop offset="1" stop-color="#0c1116" stop-opacity=".20"/>
  </linearGradient>`);
  /* 两条边线共用同一个渐变方向，光才不会一半在左上、一半在右下 */
  const edge = (id, stops) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse"
      x1="${S * .1}" y1="0" x2="${S * .86}" y2="${S}">`
    + stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")
    + `</linearGradient>`;
  defs.push(edge(P + "pmEdge", [[0, "#ffffff", .42], [.42, "#ffffff", .13], [1, "#ffffff", .03]]));
  defs.push(edge(P + "pmEdgeIn", [[0, "#0c1116", .02], [.48, "#0c1116", .10], [1, "#0c1116", .22]]));
  items.forEach((x, i) => {
    const ang = x.v / total * Math.PI * 2;
    const a0 = a + GAP / 2, a1 = a + ang - GAP / 2;
    a += ang;
    const id = P + "pmg" + i;
    defs.push(pmGrad(id, PM_METAL(x.c), 0, 0, 0, 1));
    if(ang >= Math.PI * 2 - 1e-6){
      out.push(`<circle class="sl" data-jump="r:${pmEsc(x.id)}" cx="${cx}" cy="${cy}" r="${r}"
        fill="none" stroke="url(#${id})" stroke-width="${TH}"/>`);
      return;
    }
    /* 太小的扇块吃掉半条缝会直接消失，那种情况就不留缝 */
    const small = ang < GAP * 3;
    const s0 = small ? a - ang : a0, s1 = small ? a : a1;
    const p0 = [cx + r * Math.cos(s0), cy + r * Math.sin(s0)];
    const p1 = [cx + r * Math.cos(s1), cy + r * Math.sin(s1)];
    const large = (s1 - s0) > Math.PI ? 1 : 0;
    out.push(`<path class="sl" data-jump="r:${pmEsc(x.id)}"
      d="M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}A${r} ${r} 0 ${large} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}"
      fill="none" stroke="url(#${id})" stroke-width="${TH}" stroke-linecap="butt"/>`);
  });
  /* 一束光：整圈共享，从左上打过来。不叠在所有扇片之上，色相就会被冲淡——
     所以只用很浅的强度，金属感靠「方向一致」而不是「明暗反差大」。 */
  out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
    stroke="url(#${P}pmSheen)" stroke-width="${TH}" pointer-events="none"/>`);
  /* 内缘压一道暗、外缘提一道亮：这两条细边才让环「立」起来，比投影干净。
     但两条边也必须跟着同一束光——右下用纯白描边会像镶了一圈银边。 */
  out.push(`<circle cx="${cx}" cy="${cy}" r="${(R - TH + .6).toFixed(1)}" fill="none"
    stroke="url(#${P}pmEdgeIn)" stroke-width="1.1"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${(R - .5).toFixed(1)}" fill="none"
    stroke="url(#${P}pmEdge)" stroke-width=".9"/>`);
  /* 中心：合计。数字用等宽、字距收紧，才不像标题而像读数 */
  out.push(`<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-size="8.5"
      fill="#6f6d66" letter-spacing="1">合计</text>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="11.5" font-weight="600"
      fill="#1f2328" letter-spacing="-.3" font-family="ui-monospace,Consolas,monospace"
      ><tspan font-size="8.5" fill="#6f6d66" font-weight="400">${pmCur()}</tspan>${pmUsd(total)}</text>`);
  return `<svg viewBox="0 0 ${S} ${S}" role="img" aria-label="按地区占比"><defs>${defs.join("")}</defs>${out.join("")}</svg>`;
}

/* ---- 方格图 ---- */
/* 平方化树图：按面积比例切矩形，并让每块尽量接近正方形。不这么做的话，
   大块会被拉成细长条，里面放不下字，整张图就退化成彩带。 */
function pmSquarify(vals, w, h){
  const total = vals.reduce((a, b) => a + b, 0);
  if(total <= 0 || w <= 0 || h <= 0) return [];
  const areas = vals.map(v => v / total * w * h);
  const worst = (row, len) => {
    const s = row.reduce((a, b) => a + b, 0);
    if(s <= 0) return Infinity;
    const mx = Math.max.apply(null, row), mn = Math.min.apply(null, row);
    return Math.max(len * len * mx / (s * s), s * s / (len * len * mn));
  };
  const out = [];
  let x = 0, y = 0, rw = w, rh = h, i = 0;
  while(i < areas.length){
    const len = Math.min(rw, rh);
    let row = [areas[i++]];
    while(i < areas.length){
      const cand = row.concat([areas[i]]);
      if(worst(cand, len) <= worst(row, len)){ row = cand; i++; } else break;
    }
    const s = row.reduce((a, b) => a + b, 0);
    if(rw >= rh){
      const cw = s / rh;
      let oy = y;
      row.forEach(a => { const hh = a / cw; out.push({x, y: oy, w: cw, h: hh}); oy += hh; });
      x += cw; rw = Math.max(0, rw - cw);
    }else{
      const ch = s / rw;
      let ox = x;
      row.forEach(a => { const ww = a / ch; out.push({x: ox, y, w: ww, h: ch}); ox += ww; });
      y += ch; rh = Math.max(0, rh - ch);
    }
  }
  return out;
}
/* 画布高度会改变切法。同一个宽度下，画布太扁会把最小的主题挤成一条十几像素的
   细缝——比例没错，但已经不能叫「方格」了，也放不下字。在几个候选高度里挑第一个
   「最小边 ≥ 34px」的（够放两个字），都没有就挑最小边最长的那个。
   比例一点没动，动的只是画布的长宽比。 */
function pmBestH(vals, W){
  let pick = {H: 196, mn: -1};
  for(let H = 170; H <= 280; H += 10){
    const r = pmSquarify(vals, W, H);
    let mn = Infinity;
    r.forEach(o => { mn = Math.min(mn, o.w, o.h); });
    if(mn >= 34) return H;
    if(mn > pick.mn) pick = {H, mn};
  }
  return pick.H;
}
/* ---------------- 方格材质：卫星仓与核心仓共用 ----------------
   一块「陷进去的金属面」：上沿压深（槽壁背光）→ 中段本色 → 下沿提亮（槽壁迎光），
   滤镜在内沿叠一层真实内阴影，描边用竖向白色渐变，所以只有下半圈亮。
   这是「凹陷的槽」和「贴一张色纸」的全部区别，两边必须用同一套，否则两张格子图
   摆在一个页签里会像两个产品。
   ns 是 id 前缀：SVG 的 url(#id) 只认文档里靠前那一个，同 id 会让后画的那份引用到
   被 display:none 藏起来的定义上，结果一条线都不画（v1.38.0 踩过这个坑）。 */
function pmMetalDefs(ns){
  return `<filter id="${ns}Ins" x="-25%" y="-25%" width="150%" height="150%"
      color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="4.2" result="b"/>
    <feOffset in="b" dy="4.2" result="o"/>
    <feComposite in="SourceAlpha" in2="o" operator="out" result="rim"/>
    <feFlood flood-color="#05080c" flood-opacity=".72" result="fc"/>
    <feComposite in="fc" in2="rim" operator="in" result="sh"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/></feMerge></filter>
  <pattern id="${ns}Brush" width="3" height="3" patternUnits="userSpaceOnUse">
    <rect width="3" height="3" fill="none"/>
    <rect width="3" height="1" fill="#ffffff" fill-opacity=".045"/></pattern>
  ${pmGrad(ns + "Sheen", [
    [0, "#ffffff", .13], [.38, "#ffffff", .03], [.62, "#000000", .03], [1, "#000000", .14]
  ], 0, 0, .85, 1)}
  ${pmGrad(ns + "Bez", [
    [0,   "#000000", .74],
    [.30, "#000000", .38],
    [.52, "#000000", .12],
    [.66, "#ffffff", .16],
    [.86, "#ffffff", .40],
    [1,   "#ffffff", .68]
  ], 0, 0, 0, 1)}`;
}
function pmMetalCell(x, y, w, h, rr, base, k, ns, defs){
  const gid = ns + "t" + k;
  defs.push(pmGrad(gid, [
    [0,   pmMix(base, .93, [8, 12, 16])],
    [.14, base],
    [.86, base],
    [1,   pmMix(base, .90, [255, 255, 255])]
  ], 0, 0, 0, 1));
  const ix = x + 1.8, iy = y + 1.8;
  const iw = Math.max(1, w - 3.6), ih = Math.max(1, h - 3.6);
  const irr = Math.max(1, rr - 1.6);
  const R = (v) => v.toFixed(1);
  return `<rect x="${R(x)}" y="${R(y)}" width="${R(w)}" height="${R(h)}"
      rx="${R(rr)}" fill="url(#${ns}Bez)"/>
    <rect x="${R(ix)}" y="${R(iy)}" width="${R(iw)}" height="${R(ih)}"
      rx="${R(irr)}" fill="url(#${gid})" filter="url(#${ns}Ins)"/>
    <rect x="${R(ix)}" y="${R(iy)}" width="${R(iw)}" height="${R(ih)}"
      rx="${R(irr)}" fill="url(#${ns}Brush)"/>
    <rect x="${R(ix)}" y="${R(iy)}" width="${R(iw)}" height="${R(ih)}"
      rx="${R(irr)}" fill="url(#${ns}Sheen)"/>`;
}
/* 右下角的百分比水印：**每格都画**，字号跟着格子大小走。
   大格是 .14 透明度的肌理（远看是材质、近看是读数）；小格把字号压到 7~13px 并提到
   .19，否则一缩小就等于没画。仍然低于 30×20 的不画——那不是「小」，是没地方放。
   字宽要实测：小格里 7px 的「36.7%」也可能撞到左边界，撞了就再缩一档。 */
function pmPctMark(x, y, w, h, pct){
  if(w < 30 || h < 20) return "";
  const padX = Math.min(12, Math.max(5, w * .07));
  /* 小格的下边距不能按 10% 算：14px 的字放在 30px 高的格子里，
     padY 只剩 3px 时基线会贴到圆角上，看着像被裁了一刀。 */
  const padY = Math.min(13, Math.max(5, h * .12));
  let fs = Math.min(40, Math.max(7, Math.min(w, h) * .2), h * .52);
  const unit = pmTextW("000.0%", 1);            // 一位小数百分比在 1px 字号下的宽
  const room = w - padX * 2;
  if(unit * fs > room) fs = room / unit;
  if(fs < 6) return "";
  const op = fs >= 18 ? .14 : .19;
  return `<text x="${(x + w - padX).toFixed(1)}" y="${(y + h - padY).toFixed(1)}"
    text-anchor="end" font-size="${fs.toFixed(1)}" font-weight="600" fill="#fff"
    opacity="${op}" letter-spacing="-1.5" pointer-events="none">${pmPctStr(pct)}</text>`;
}
/* 格子里的标签：名字 + 「金额 · 占比」，逐级降级（整名 → 缩字 → 折两行 → 截断），
   金额行放不下就只留金额，再放不下整行不画。两仓共用同一套梯子。 */
function pmCellLabel(x, y, w, h, name, amt, pct){
  const out = [], pad = 10, inner = w - pad * 2;
  if(h < 24 || inner < 26) return "";
  let fs = 10.5, lines;
  if(pmTextW(name, 10.5) <= inner) lines = [name];
  else if(pmTextW(name, 9.5) <= inner){ fs = 9.5; lines = [name]; }
  else if(h >= 46 && inner >= 24){ fs = 9.5; lines = pmWrap2(name, inner, 9.5) || [pmClip(name, inner, 9.5)]; }
  else {
    /* 只剩几十像素宽时，宁可只留「军工」也不要「军工/工…」——
       半个词加省略号读起来像坏掉的字，一个完整的词不会。 */
    const head = name.split(/[\/·]/)[0].trim();
    if(head && head !== name && pmTextW(head, 9.5) <= inner) lines = [head];
    else { fs = 9.5; lines = [pmClip(name, inner, 9.5)]; }
  }
  lines.forEach((ln, i) => {
    out.push(`<text x="${(x + pad).toFixed(1)}" y="${(y + 19 + i * 13).toFixed(1)}" font-size="${fs}"
      font-weight="600" fill="#fff" fill-opacity=".96" letter-spacing=".1">${pmEsc(ln)}</text>`);
  });
  const amtY = y + 19 + (lines.length - 1) * 13 + 14;
  if(amtY <= y + h - 6){
    const pc = pmPctStr(pct);
    if(pmTextW(amt + " · " + pc, 9) <= inner){
      out.push(`<text x="${(x + pad).toFixed(1)}" y="${amtY.toFixed(1)}" font-size="9"
        fill="#fff" fill-opacity=".72" font-family="ui-monospace,Consolas,monospace">${amt}
        <tspan fill="#fff" fill-opacity=".6"> · ${pc}</tspan></text>`);
    }else if(pmTextW(amt, 9) <= inner){
      out.push(`<text x="${(x + pad).toFixed(1)}" y="${amtY.toFixed(1)}" font-size="9"
        fill="#fff" fill-opacity=".72" font-family="ui-monospace,Consolas,monospace">${amt}</text>`);
    }
  }
  return out.join("");
}
function pmTreemapSVG(t, W){
  if(!W || W < 90) return "";
  const GAP = 3;
  const gById = new Map((pm.groups || []).map(g => [g.id, g]));
  const data = pmColsInOrder()
    .map(c => ({c, v: t.c[c.id] || 0}))
    .filter(d => d.v > 0)
    .sort((a, b) => b.v - a.v);
  if(!data.length) return "";
  const vals = data.map(d => d.v);
  const H = pmBestH(vals, W);
  const rects = pmSquarify(vals, W, H);
  const out = [], defs = [pmMetalDefs("pm")];
  data.forEach((d, k) => {
    const r = rects[k];
    if(!r) return;
    const g = gById.get(d.c.groupId);
    const base = g && g.color ? g.color : "#8d8778";
    const x = r.x + GAP / 2, y = r.y + GAP / 2;
    const w = Math.max(1, r.w - GAP), h = Math.max(1, r.h - GAP);
    const rr = Math.min(13, Math.max(4, Math.min(w, h) * .055));
    const pct = d.v / t.total * 100;
    out.push(`<g class="cel" data-jump="c:${pmEsc(d.c.id)}"><title>${pmEsc(d.c.name)} · ${pmCur()}${pmUsd(d.v)} · ${pmPctStr(pct)}（点击定位）</title>
      ${pmMetalCell(x, y, w, h, rr, base, k, "pm", defs)}`);
    out.push(pmPctMark(x, y, w, h, pct));
    out.push(pmCellLabel(x, y, w, h, d.c.name, pmUsd(d.v), pct));
    out.push(`</g>`);
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="按主题占比">
    <defs>${defs.join("")}</defs>${out.join("")}</svg>`;
}
/* 窄高的格子放不下整名时折成两行。按字数顺序折会折出「航天/机器」+「人」这种
   孤立字，所以改成在**所有能断的位置里挑两行最均匀的那个**，并给「断在 / · 之后」
   一点优惠——「航天/」+「机器人」比「航天/机器」+「人」好认。 */
function pmWrap2(s, maxW, fs){
  const chars = Array.from(String(s).trim());
  let best = null;
  for(let k = 1; k < chars.length; k++){
    const a = chars.slice(0, k).join("").trim();
    const b = chars.slice(k).join("").trim();
    if(!a || !b) continue;
    const wa = pmTextW(a, fs), wb = pmTextW(b, fs);
    if(wa > maxW || wb > maxW) continue;
    let score = Math.max(wa, wb);
    if(/[\/·、]$/.test(a)) score -= fs;      // 断在分隔符后面更像一句话
    if(!best || score < best.score) best = {score, lines: [a, b]};
  }
  return best ? best.lines : null;
}
/* 放不下就截断加省略号，总比溢出到隔壁格子里强 */
function pmClip(s, maxW, fs){
  const chars = String(s).split("");
  let out = "", w = 0;
  for(const ch of chars){
    const cw = /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? fs : fs * 0.56;
    if(w + cw > maxW - fs * 0.6) { out += "…"; break; }
    out += ch; w += cw;
  }
  return out || "…";
}

function pmRenderViz(t){
  const el = pmEl("pmViz");
  if(!el) return;
  const total = t.total || 0;
  if(!total){
    el.innerHTML = `<div class="vcard" style="grid-column:1/-1"><div class="vempty">
      还没有可计算的仓位备注，图表暂不生成。口径与上方一致：只有「已持仓 / 计划加仓」里
      完整写成「数字k」的备注才计入，观察中与期权不进普通合计。</div></div>`;
    return;
  }

  /* 地区：按金额降序，饼的顺序与图例顺序必须是同一个，否则对不上号 */
  const items = (pm.regions || []).map((r, i) => (
    {id: r.id, name: r.name, v: t.r[r.id] || 0, c: pmRegColor(r.id, i)}
  )).filter(x => x.v > 0).sort((a, b) => b.v - a.v);

  const pie = items.length
    ? `<div class="pie">${pmPieSVG(items, total)}<div class="lg">${items.map(x => `
        <div class="lr" data-jump="r:${pmEsc(x.id)}" title="定位到「${pmEsc(x.name)}」这一行">
          <i class="sw" style="background:linear-gradient(155deg,${pmMix(x.c, .48, [255, 255, 255])} 0%,${x.c} 52%,${pmMix(x.c, .74, [8, 12, 16])} 100%)"></i>
          <span class="nm">${pmEsc(x.name)}</span>
          <span class="am">${pmUsd(x.v)}</span>
          <span class="pc">${pmPctStr(x.v / total * 100)}</span></div>`).join("")}</div></div>`
    : `<div class="vempty">暂无可计算的地区金额</div>`;

  /* 策略：温度计。管长 = 占总额比例，一段一色；上方给出比例与具体金额。
     管子铺一层轨道底、球泡带白色外圈、下面加刻度——这三样是「量具」和
     「进度条」的全部区别，缺一个就退回成彩色条。 */
  const gs = (pm.groups || []).map(g => ({g, v: t.g[g.id] || 0})).filter(x => x.v > 0);
  const thm = gs.length ? `<div class="thm">
      <div class="tl">${gs.map(x => `<div style="flex:${x.v}" data-jump="g:${pmEsc(x.g.id)}"
        title="定位到「${pmEsc(x.g.name)}」这一段">
        <span class="nm"><i style="background:${x.g.color}"></i><span>${pmEsc(x.g.name)}</span></span>
        <span class="pc" style="color:${x.g.color}">${pmPctStr(x.v / total * 100)}</span>
        <span class="am">${pmCur()}${pmUsd(x.v)}</span></div>`).join("")}</div>
      <div class="tube">
        <span class="bulb" style="background:radial-gradient(circle at 33% 26%,
          ${pmMix(gs[0].g.color, .30, [255, 255, 255])} 0%,
          ${pmMix(gs[0].g.color, .78, [255, 255, 255])} 16%,
          ${gs[0].g.color} 48%,
          ${pmMix(gs[0].g.color, .62, [8, 12, 16])} 100%)"></span>
        ${gs.map(x => `<span class="seg" style="flex:${x.v};background:linear-gradient(180deg,
          ${pmMix(x.g.color, .52, [255, 255, 255])} 0%,
          ${pmMix(x.g.color, .88, [255, 255, 255])} 24%,
          ${x.g.color} 56%,
          ${pmMix(x.g.color, .78, [8, 12, 16])} 100%)"></span>`).join("")}</div>
      <div class="scale">${[0, 25, 50, 75, 100].map(v => `<span>${v}${v === 100 ? "%" : ""}</span>`).join("")}</div>
    </div>` : `<div class="vempty">暂无可计算的策略金额</div>`;

  /* 主题：方格。颜色跟所属策略走，所以这张图同时能看出「哪个策略里压得重」 */
  const cols = pmColsInOrder();
  const noVal = cols.filter(c => !(t.c[c.id] > 0));
  const legend = gs.map(x => `<span class="kl"><i style="background:linear-gradient(155deg,
    ${pmMix(x.g.color, .48, [255, 255, 255])} 0%,${x.g.color} 52%,
    ${pmMix(x.g.color, .74, [8, 12, 16])} 100%)"></i>${pmEsc(x.g.name)}</span>`).join("");

  el.innerHTML = `
    <div class="vcard">
      <div class="vhead"><span class="t">按地区 · 环形</span>
        <span class="n">环段长度 = 占总额比例</span></div>
      ${pie}
    </div>
    <div class="vcard">
      <div class="vhead"><span class="t">按策略 · 温度计</span>
        <span class="n">管长 = 占总额比例</span></div>
      ${thm}
    </div>
    <div class="vcard vtheme">
      <div class="vhead"><span class="t">按主题 · 方格大小</span>
        <span class="n">格子面积 = 计入金额，越大占比越高</span></div>
      <div class="treemap" id="pmTree"></div>
      <div class="vfoot">${legend}${noVal.length
        ? `<span style="margin-left:auto">未计入金额：${noVal.map(c => pmEsc(c.name)).join("、")}</span>` : ""}</div>
    </div>`;

  /* 用事件委托，而不是逐个绑：方格图是插入之后才画出来的，逐个绑会漏掉它，
     而且窗口变化重切方格时又是一批新节点。挂一个在容器上就不会漏。 */
  el.onclick = ev => {
    const t = ev.target.closest && ev.target.closest("[data-jump]");
    if(t && el.contains(t)) pmLocate(t.dataset.jump);
  };

  /* 方格图必须按真实像素宽度切，插入之后再量一次 */
  const box = pmEl("pmTree");
  if(!box) return;
  const draw = () => { box.innerHTML = pmTreemapSVG(t, box.clientWidth); };
  draw();
  if(!box.clientWidth) requestAnimationFrame(draw);   // 面板刚显示、还没排版出宽度
}

/* 窗口变宽变窄要重切方格，否则图会被拉成拉伸的位图。 */
let pmVizTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(pmVizTimer);
  pmVizTimer = setTimeout(() => {
    const box = pmEl("pmTree");
    if(box && box.clientWidth) box.innerHTML = pmTreemapSVG(pmTotals(), box.clientWidth);
  }, 220);
});

function pmRenderSum(t){
  const n = (pm.items || []).length;
  const has = n > 0;
  const recon = [];
  recon.push(`<span class="ri"><b>${n}</b> 张卡片</span>`);
  recon.push(`<span class="ri">= <b>${t.counted}</b> 张计入</span>`);
  if(t.watch) recon.push(`<span class="ri"><i class="d" style="background:#d9a441"></i>${t.watch} 观察</span>`);
  if(t.option) recon.push(`<span class="ri"><i class="d" style="background:#1f6feb"></i>${t.option} 期权</span>`);
  if(t.orphanN) recon.push(`<span class="ri"><i class="d" style="background:transparent;border:1px dashed #b3afa2"></i>${t.orphanN} 未归类</span>`);
  if(t.unparsed) recon.push(`<span class="ri"><i class="d" style="background:#c9c5bb"></i>${t.unparsed} 备注不可计算</span>`);

  const gChips = (pm.groups || []).map(g => {
    const v = t.g[g.id];
    return `<button class="pchip g" data-jump="g:${pmEsc(g.id)}" style="border-left-color:${pmSoften(g.color)}"
      title="定位到「${pmEsc(g.name)}」">
      <span class="cd" style="background:${pmSoften(g.color)}"></span>${pmEsc(g.name)}
      <b>${v == null ? "—" : pmUsd(v)}</b></button>`;
  }).join("");

  const rChips = (pm.regions || []).map(r => {
    const v = t.r[r.id];
    return `<button class="pchip" data-jump="r:${pmEsc(r.id)}" title="定位到「${pmEsc(r.name)}」行">
      ${pmEsc(r.name)} <b>${v == null ? "—" : pmUsd(v)}</b></button>`;
  }).join("");

  const cols = pmColsInOrder();
  const cChips = cols.map(c => {
    const v = t.c[c.id];
    return `<button class="pchip" data-jump="c:${pmEsc(c.id)}" title="定位到「${pmEsc(c.name)}」列">
      ${pmEsc(c.name)} <b>${v == null ? "—" : pmUsd(v)}</b></button>`;
  }).join("");

  const sum = has ? pmUsd(t.total) : "—";
  pmEl("pmSum").innerHTML = `
    <div class="tot">
      <div class="lab">仓位备注合计 <i>非市值</i></div>
      <div class="num${has ? "" : " na"}"><span class="cur">${pmCur()}</span><strong>${sum}</strong></div>
      <div class="recon">${has ? recon.join(" ") : "暂无卡片 · 还没有可计算的仓位备注"}</div>
    </div>
    <div class="splits">
      <div class="srow">
        <span class="lab">按策略</span><div class="chips">${gChips || `<span class="ghint">—</span>`}</div>
        <span class="ssum"><em>Σ</em>${sum}</span><span></span>
      </div>
      <div class="srow">
        <span class="lab">按地区</span><div class="chips">${rChips || `<span class="ghint">—</span>`}</div>
        <span class="ssum"><em>Σ</em>${sum}</span><span></span>
      </div>
      <div class="srow">
        <span class="lab">按主题</span>
        <div class="chips">${pmThemeOpen ? (cChips || `<span class="ghint">—</span>`)
          : `<span class="ghint">${cols.length} 个主题已收起 · 各列标题仍显示 Σ</span>`}</div>
        <span class="ssum"><em>Σ</em>${sum}</span>
        <button class="rtog" id="pmTog" title="${pmThemeOpen ? "收起主题明细" : "展开主题明细"}">${pmThemeOpen ? "⌃" : "⌄"}</button>
      </div>
      <div class="snote">三种拆分是同一总额的不同视角，右列同为 <b>Σ ${sum}</b>，<b>不可相加</b>。${
        t.orphanN ? `另有 <b>${t.orphanN}</b> 张未归类卡片（${pmCur()}${pmUsd(t.orphan)}）<b>不计入</b>上方任何一行，给它们选回主题即自动回到合计。` : ""}</div>
    </div>`;

  const tog = pmEl("pmTog");
  if(tog) tog.onclick = () => { pmThemeOpen = !pmThemeOpen; pmRenderSum(pmTotals()); };
  /* 胶囊每次重渲染都是新节点，事件得跟着重新绑。
     这是「不用从头往下拉」的入口，漏绑就等于这个功能不存在。 */
  pmEl("pmSum").querySelectorAll("[data-jump]").forEach(el => {
    el.onclick = () => pmLocate(el.dataset.jump);
  });

  const optChips = t.opts.length
    ? t.opts.map(o => `<span class="ochip" title="${pmEsc(o.name || "")}"><b>${pmEsc(o.symbol)}</b>${
        o.name && o.name !== o.symbol ? `<span class="on">${pmEsc(o.name)}</span>` : ""}<em>${pmEsc(o.amount || "未填备注")}</em></span>`).join("")
    : `<span class="ochip" style="border-style:dotted;color:#8a8880;background:#fbfaf7">暂无期权卡片</span>`;
  pmEl("pmOpt").innerHTML = `
    <span class="lab">期权 · 单独展示</span>
    <span class="cnt">${t.option} 张 · <b>不计入</b> 普通仓位合计</span>
    ${optChips}`;

  pmRenderViz(t);
}

/* ---------------- 渲染：卡片 ---------------- */
function pmTile(it, q){
  const c = pmParseCents(it.amount);
  const isCnt = PM_COUNTED.indexOf(it.status) >= 0;
  const counted = isCnt && c != null;
  const unparsed = isCnt && c == null;
  const st = PM_ST[it.status] || PM_ST.held;
  const stack = it.status === "option" || String(it.amount || "").length > 5;
  const showName = it.name && it.name !== it.symbol;
  const hit = !q || (String(it.symbol || "") + " " + String(it.name || "") + " " + String(it.amount || ""))
    .toLowerCase().indexOf(q) >= 0;
  const tip = counted ? `${it.symbol} · 备注 ${it.amount} → 计入 ${pmUsd(c)}`
    : unparsed ? `${it.symbol} · 备注「${it.amount || "空"}」不是完整的「数字k」，不计入合计`
    : `${it.symbol} · 状态「${st.name}」，不计入合计`;
  return `<button class="pmt ${st.cls}${unparsed ? " nocount" : ""}${stack ? " stack" : ""}${hit ? "" : " dim"}"
    data-id="${pmEsc(it.id)}" title="${pmEsc(tip)}">
    <span class="s">${pmEsc(it.symbol)}</span>
    <span class="a">${pmEsc(it.amount || "—")}</span>
    ${showName ? `<span class="n">${pmEsc(it.name)}</span>` : ""}</button>`;
}

/* ---------------- 渲染：桌面矩阵 ----------------
   结构是「三段上下堆叠」：进攻 / 均衡 / 防御 各占一块，
   每段自带标题条 + 自己的列头行 + 自己的地区行，
   段内主题从第 2 列开始靠左铺开，绝不居中，也绝不跨段共列。
   所有段用同一套列宽（都按最大段列数算轨道），于是三段的首尾、
   第 N 个主题列在全页都落在同一条竖线上——读起来是一张图，
   而不是三张参差不齐的图。少了主题的段，右边就剩一条明确标出的空位。 */
function pmRenderGrid(t){
  const grid = pmEl("pmGrid");
  pmEl("pmWrap").dataset.dens = pmDensity;
  const cols = pmColsInOrder();
  if(!cols.length || !(pm.items || []).length){
    grid.style.gridTemplateColumns = "";
    grid.innerHTML = `<div class="pmempty" style="padding:38px 20px">
      <div class="ic">${cols.length
        ? `<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="15" height="15" rx="2.5"/><path d="M2.5 7.5h15M7.5 7.5v10"/></svg>`
        : `<span style="font-size:17px">＋</span>`}</div>
      <h3>${cols.length ? "地图是空的" : "还没有策略或主题"}</h3>
      <p>${cols.length
        ? `分组还在（${(pm.groups || []).length} 个策略 · ${cols.length} 个主题 · ${(pm.regions || []).length} 个地区），可以直接添加标的，或导入一份此前的 JSON。`
        : "持仓地图至少需要一个策略和一个主题才能落卡片。可以先导入一份此前的 JSON。"}</p>
      ${cols.length ? `<button class="btn" id="pmEmptyAdd">添加第一个标的</button>` : ""}
      <button class="btn" id="pmEmptyImp" style="margin-left:8px">导入地图</button>
    </div>`;
    if(pmEl("pmEmptyAdd")) pmEl("pmEmptyAdd").onclick = () => pmOpenNew();
    pmEl("pmEmptyImp").onclick = () => pmEl("pmFile").click();
    return;
  }

  const segs = (pm.groups || []).map(g => ({
    g, gcols: cols.filter(c => c.groupId === g.id)
  })).filter(s => s.gcols.length);

  /* 每段各自等分本段宽度：主题少的段（均衡只有 3 列）把列铺开，
     主题多的段（防御 7 列）自然收窄。宁可列宽不一样，也不让任何一段
     右半边空一大片——三段各有自己的标题条，本来就是三块独立的图。 */

  /* 必须显式给每个格子定位：每段只占自己那几个主题列，若交给自动流，
     段内第一行没占满全宽，下一行的行头就会从上一行的剩余列续排，整张图错位。 */
  let h = "";
  segs.forEach(s => {
    const {g, gcols} = s;
    const gitems = (pm.items || []).filter(it => gcols.some(c => c.id === it.columnId));
    const gcounted = gitems.filter(it =>
      PM_COUNTED.indexOf(it.status) >= 0 && pmParseCents(it.amount) != null).length;
    const gv = t.g[g.id];
    h += `<section class="pmseg" data-seg="${pmEsc(g.id)}">
      <div class="pmsegh" data-g="${pmEsc(g.id)}" style="border-left-color:${pmSoften(g.color)}">
        <span class="gname">${pmEsc(g.name)}</span>
        <span class="gmeta"><span><b>${gcols.length}</b> 个主题</span><span><b>${gitems.length}</b> 张卡片</span><span><b>${gcounted}</b> 张计入</span></span>
        <span class="gsum"><em>Σ</em>${gv == null ? "—" : pmUsd(gv)}</span>
        <button class="addc" data-g="${pmEsc(g.id)}"
          title="在「${pmEsc(g.name)}」里加一个主题">＋ 主题</button>
      </div>
      <div class="pmgrid" style="grid-template-columns:76px repeat(${gcols.length}, minmax(0, 1fr))">`;

    h += `<div class="corner" style="grid-row:1;grid-column:1"><span>主题</span><b>／地区</b></div>`;
    gcols.forEach((c, i) => {
      const v = t.c[c.id];
      h += `<div class="ch" data-c="${pmEsc(c.id)}" data-col="${pmEsc(c.id)}"
        role="button" tabindex="0" title="点击编辑主题：改名 / 换策略 / 删除"
        style="grid-row:1;grid-column:${i + 2}">
        <span class="pen">✎</span>
        <div class="nm">${pmEsc(c.name)}</div>
        <div class="sum${v == null ? "" : " on"}"><em>Σ</em>${v == null ? "—" : pmUsd(v)}</div></div>`;
    });

    (pm.regions || []).forEach((r, ri) => {
      const row = ri + 2;
      /* 行头金额必须是「本策略内该地区」的合计，不是全局地区合计。
         放段里显示全局数，会被读成「这个策略在美国押了 179.4k」—— */
      let rv = null;
      gcols.forEach(c => {
        const v = pmCellSum(t, c.id, r.id);
        if(v != null) rv = (rv || 0) + v;
      });
      h += `<div class="rh" data-r="${pmEsc(r.id)}" style="grid-row:${row};grid-column:1"
        title="${pmEsc(r.name)} · ${pmEsc(g.name)} 内合计 ${rv == null ? "—" : pmCur() + pmUsd(rv)}">
        <span class="rn">${pmEsc(r.name)}</span>
        <span class="rs">${rv == null ? "—" : pmUsd(rv)}</span></div>`;
      gcols.forEach((c, ci) => {
        const items = (pm.items || []).filter(it => it.columnId === c.id && it.regionId === r.id);
        const norm = items.filter(it => it.status !== "option");
        const opts = items.filter(it => it.status === "option");
        const cv = pmCellSum(t, c.id, r.id);
        h += `<div class="cl${items.length ? " has" : ""}" data-c="${pmEsc(c.id)}" data-r="${pmEsc(r.id)}"
          style="grid-row:${row};grid-column:${ci + 2}">`;
        norm.forEach(it => { h += pmTile(it, pmQ); });
        if(opts.length){
          h += `<div class="optsep">期权 · 不计入</div>`;
          opts.forEach(it => { h += pmTile(it, pmQ); });
        }
        if(items.length){
          h += `<div class="csum${cv == null ? " zero" : " on"}">${cv == null ? "—" : "Σ " + pmUsd(cv)}</div>`;
        }
        h += `</div>`;
      });
    });

    h += `</div></section>`;
  });

  /* 未归类：主题被删掉之后卡片的落脚处。仍然按原地区分行，仍然点得开、改得动，
     只是没有段色、Σ 标「未计入」。少了这一块，卡片就是「消失了」而不是「待归类」。 */
  const orph = (pm.items || []).filter(it => !it.columnId);
  if(orph.length){
    h += `<section class="pmseg orph" data-seg="__orphan">
      <div class="pmsegh">
        <span class="gname">未归类</span>
        <span class="gmeta"><span><b>${orph.length}</b> 张卡片</span></span>
        <span class="orphhint">主题已删除 · 未计入任何合计 · 点卡片重新指定主题</span>
        <span class="gsum"><em>未计入</em>${t.orphan ? pmCur() + pmUsd(t.orphan) : "—"}</span>
      </div>
      <div class="pmgrid" style="grid-template-columns:76px minmax(0,1fr)">`;
    let orow = 1;
    (pm.regions || []).forEach(r => {
      const items = orph.filter(it => it.regionId === r.id);
      if(!items.length) return;
      const sum = items.reduce((a, it) =>
        a + (PM_COUNTED.indexOf(it.status) >= 0 ? (pmParseCents(it.amount) || 0) : 0), 0);
      h += `<div class="rh" data-r="${pmEsc(r.id)}" style="grid-row:${orow};grid-column:1"
        title="${pmEsc(r.name)} · 未归类 ${sum ? pmCur() + pmUsd(sum) : "—"}">
        <span class="rn">${pmEsc(r.name)}</span>
        <span class="rs">${sum ? pmUsd(sum) : "—"}</span></div>
        <div class="cl has" data-c="" data-r="${pmEsc(r.id)}" style="grid-row:${orow};grid-column:2">`;
      h += `<div class="clw">`;
      items.forEach(it => { h += pmTile(it, pmQ); });
      h += `</div></div>`;
      orow++;
    });
    h += `</div></section>`;
  }

  grid.innerHTML = h;
  grid.querySelectorAll(".pmt").forEach(el => {
    el.onclick = () => pmOpen(el.dataset.id);
  });
  grid.querySelectorAll(".cl").forEach(el => {
    /* 未归类的格子不给新增入口：新卡片必须有主题，否则一出生就又落在合计之外。
       双击只解释一句，不弹一个填完还得再选主题的抽屉。 */
    el.ondblclick = el.dataset.c
      ? () => pmOpenNew(el.dataset.c, el.dataset.r)
      : () => pmToast("未归类的格子不新增卡片——先点一张卡片把它选回主题");
  });
  /* 列头：点一下开主题抽屉；键盘 Enter / 空格等价，别让它只是「看起来能点」 */
  grid.querySelectorAll(".ch").forEach(el => {
    el.onclick = () => pmOpenTheme(el.dataset.col);
    el.onkeydown = ev => {
      if(ev.key === "Enter" || ev.key === " "){
        ev.preventDefault();
        pmOpenTheme(el.dataset.col);
      }
    };
  });
  grid.querySelectorAll(".addc").forEach(el => {
    el.onclick = ev => { ev.stopPropagation(); pmOpenTheme(null, el.dataset.g); };
  });
}

/* ---------------- 渲染：窄屏分组清单 ---------------- */
function pmRenderList(t){
  const box = pmEl("pmList");
  const cols = pmColsInOrder();
  if(!(pm.items || []).length){
    box.innerHTML = "";
    return;
  }
  let h = "";
  (pm.groups || []).forEach(g => {
    const gcols = cols.filter(c => c.groupId === g.id);
    if(!gcols.length) return;
    const gv = t.g[g.id];
    h += `<div class="lg"><div class="lgh" style="border-left-color:${pmSoften(g.color)}">
      <span class="t">${pmEsc(g.name)}</span>
      <span class="s">Σ ${gv == null ? "—" : pmUsd(gv)}</span></div>`;
    gcols.forEach(c => {
      const cv = t.c[c.id];
      h += `<div class="lgt"><div class="lgth"><span class="n">${pmEsc(c.name)}</span>
        <span class="s">Σ ${cv == null ? "—" : pmUsd(cv)}</span></div>`;
      (pm.regions || []).forEach(r => {
        const items = (pm.items || []).filter(it => it.columnId === c.id && it.regionId === r.id);
        if(!items.length) return;
        items.forEach(it => {
          h += `<div class="row"><span class="rg">${pmEsc(r.name)}</span>${pmTile(it, pmQ)}</div>`;
        });
      });
      h += `</div>`;
    });
    h += `</div>`;
  });
  const orph = (pm.items || []).filter(it => !it.columnId);
  if(orph.length){
    h += `<div class="lg orph"><div class="lgh">
      <span class="t">未归类</span><span class="s">未计入</span></div><div class="lgt">
      <div class="lgth"><span class="n">主题已删除</span>
        <span class="s">${t.orphan ? pmCur() + pmUsd(t.orphan) : "—"}</span></div>`;
    (pm.regions || []).forEach(r => {
      orph.filter(it => it.regionId === r.id).forEach(it => {
        h += `<div class="row"><span class="rg">${pmEsc(r.name)}</span>${pmTile(it, pmQ)}</div>`;
      });
    });
    h += `</div></div>`;
  }
  box.innerHTML = h;
  box.querySelectorAll(".pmt").forEach(el => { el.onclick = () => pmOpen(el.dataset.id); });
}

/* ---------------- 总渲染 ---------------- */
function pmRenderAll(){
  if(!pm){ return; }
  const t = pmTotals();
  pmRenderBar(t);
  pmRenderSum(t);
  pmRenderGrid(t);
  pmRenderList(t);
  pmUpdateHits();
}
function pmUpdateHits(){
  const el = pmEl("pmHits");
  if(!el) return;
  if(!pmQ){ el.textContent = ""; return; }
  const n = (pm.items || []).filter(it => (String(it.symbol || "") + " " + String(it.name || "") +
    " " + String(it.amount || "")).toLowerCase().indexOf(pmQ) >= 0).length;
  el.textContent = n + " 个匹配";
}

/* 从汇总里的胶囊跳到矩阵对应位置：先滚到、再闪一下，
   让用户知道「跳到了哪」，而不是只看见页面动了一下。 */
function pmLocate(key){
  const [kind, id] = key.split(":");
  /* 三段各有自己的列头 / 行头，同一个地区会命中三段里的三个行头，
     一起闪才说明「这个地区在三段里都有」；主题只属于一段，仍是一个。 */
  const sel = kind === "c" ? `.ch[data-c="${id}"]`
    : kind === "g" ? `.pmsegh[data-g="${id}"]`
    : `.rh[data-r="${id}"]`;
  const all = Array.from(document.querySelectorAll("#pmGrid " + sel));
  const els = all.length ? all : Array.from(document.querySelectorAll(sel));
  if(!els.length){ pmToast(kind === "c" ? "该主题暂时没有展开的列" : "该分组暂时没有展开的行"); return; }
  els[0].scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
  els.forEach(el => {
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 1200);
  });
}

/* ---------------- 编辑抽屉 ---------------- */
function pmFillSelects(colId, regId){
  const byGroup = new Map((pm.groups || []).map(g => [g.id, []]));
  (pm.columns || []).forEach(c => { (byGroup.get(c.groupId) || []).push(c); });
  /* 空值不是「没选」，是一个真状态：卡片还在、还显示、只是不进合计。
     没有这一项的话，打开一张未归类卡片会把下拉默认到第一个主题，
     一按保存就悄悄把它塞回合计——用户没做这个决定。 */
  let opt = `<option value="">— 未归类（不计入合计）—</option>`;
  (pm.groups || []).forEach(g => {
    const list = byGroup.get(g.id) || [];
    if(!list.length) return;
    opt += `<optgroup label="${pmEsc(g.name)}">` +
      list.map(c => `<option value="${pmEsc(c.id)}">${pmEsc(c.name)}</option>`).join("") + `</optgroup>`;
  });
  pmEl("pmCol").innerHTML = opt;
  pmEl("pmReg").innerHTML = (pm.regions || [])
    .map(r => `<option value="${pmEsc(r.id)}">${pmEsc(r.name)}</option>`).join("");
  if(colId) pmEl("pmCol").value = colId;
  if(regId) pmEl("pmReg").value = regId;
}
function pmSetStatus(st){
  pmEl("pmSeg").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.s === st));
}
function pmOpen(id){
  const it = (pm.items || []).find(x => x.id === id);
  if(!it){ pmToast("这张卡片已经不在当前地图里"); return; }
  pmEdit = {id: id, isNew: false};
  pmEl("pmDrT").textContent = "编辑标的";
  pmEl("pmSym").value = it.symbol || "";
  pmEl("pmName").value = (it.name && it.name !== it.symbol) ? it.name : "";
  pmFillSelects(it.columnId, it.regionId);
  pmSetStatus(it.status);
  pmEl("pmAmt").value = it.amount || "";
  pmEl("pmDel").style.display = "";
  pmCalcBox();
  pmDrawer(true);
}
function pmOpenNew(colId, regId){
  if(!pm || !(pm.columns || []).length || !(pm.regions || []).length){
    pmToast("先有至少一个主题和一个地区"); return;
  }
  pmEdit = {id: null, isNew: true};
  pmEl("pmDrT").textContent = "添加标的";
  pmEl("pmSym").value = "";
  pmEl("pmName").value = "";
  pmFillSelects(colId || (pm.columns[0] || {}).id, regId || (pm.regions[0] || {}).id);
  pmSetStatus("watch");
  pmEl("pmAmt").value = "";
  pmEl("pmDel").style.display = "none";
  pmCalcBox();
  pmDrawer(true);
}
/* ---------------- 主题（列）管理 ----------------
   改名的本质只是改 columns[i].name：id 不动，而卡片指的一直是 columnId，
   所以改名、换段都不会碰到任何一张卡片的金额，历史读数也不会断。
   删除之所以要拦，是因为 validate() 会把「挂在不存在主题上的卡片」判成错误——
   与其让卡片悄悄消失，不如让用户先把卡片挪走。 */
function pmThNewId(){
  const c = window.crypto;
  if(c && c.randomUUID) return c.randomUUID();
  return "c-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
function pmThStat(colId){
  const items = (pm.items || []).filter(it => it.columnId === colId);
  const t = pmTotals();
  return {
    n: items.length,
    counted: items.filter(it =>
      PM_COUNTED.indexOf(it.status) >= 0 && pmParseCents(it.amount) != null).length,
    sum: t.c[colId]
  };
}
function pmOpenTheme(colId, grpId){
  if(!pm || !(pm.groups || []).length) return;
  const col = colId ? (pm.columns || []).find(c => c.id === colId) : null;
  if(colId && !col){ pmToast("这个主题已经不在当前地图里"); return; }
  pmClose();                    /* 两个抽屉同时只开一个 */
  pmTh = {id: col ? col.id : null, isNew: !col};
  pmEl("pmThT").textContent = col ? "编辑主题" : "添加主题";
  pmEl("pmThName").value = col ? col.name : "";
  pmEl("pmThGrp").innerHTML = (pm.groups || []).map(g =>
    `<option value="${pmEsc(g.id)}">${pmEsc(g.name)}</option>`).join("");
  pmEl("pmThGrp").value = col ? col.groupId : (grpId || pm.groups[0].id);
  pmEl("pmThDel").style.display = col ? "" : "none";
  pmThCalc();
  pmEl("pmThDr").classList.add("on");
  pmEl("pmMask").classList.add("on");
  document.body.style.overflow = "hidden";
  setTimeout(() => { pmEl("pmThName").focus(); pmEl("pmThName").select(); }, 180);
}
function pmThCalc(){
  const box = pmEl("pmThCalc"), warn = pmEl("pmThWarn"), del = pmEl("pmThDel");
  if(!pmTh || !box) return;
  warn.style.display = "none";
  box.className = "calc";
  if(pmTh.isNew){
    box.innerHTML = "新主题加在所选策略的末尾，先是一个空列；卡片用「+ 添加标的」或双击空格子放进去。";
    return;
  }
  const s = pmThStat(pmTh.id);
  box.innerHTML = `这一列现有 <b>${s.n}</b> 张卡片，其中 <b>${s.counted}</b> 张计入，Σ <b>${s.sum == null ? "—" : pmCur() + pmUsd(s.sum)}</b>。`;
  const last = (pm.columns || []).length <= 1;
  warn.className = "warnrow";
  if(last){
    warn.style.display = "";
    warn.textContent = "这是最后一个主题，删掉矩阵就没有列可画了，所以不能删。";
  }else if(s.n){
    /* 这几行不是「警告」，是「会发生什么」。删除是允许的，只是后果要写明：
       卡片不删、金额不删、但暂不计入——用户按下去之前得知道合计会变小。 */
    warn.style.display = "";
    warn.className = "warnrow info";
    warn.innerHTML = `删除后这 ${s.n} 张卡片会移到「<b>未归类</b>」：卡片、代码、金额、地区全部保留，但<b>暂不计入</b>合计${
      s.sum == null ? "" : `（${pmCur()}${pmUsd(s.sum)}）`}。给它们重新选一个主题，数字就自动回来。`;
  }else{
    warn.style.display = "none";
  }
  del.disabled = last;
  del.textContent = s.n ? "删除主题（转未归类）" : "删除主题";
}
function pmSaveTheme(){
  if(!pmTh) return;
  const name = (pmEl("pmThName").value || "").trim();
  const gid = pmEl("pmThGrp").value;
  if(!name){ pmToast("主题名不能为空"); pmEl("pmThName").focus(); return; }
  const dup = (pm.columns || []).some(c =>
    c.id !== pmTh.id && c.groupId === gid && String(c.name).trim() === name);
  if(dup){ pmToast(`这一段已经有叫「${name}」的主题了`); return; }
  const isNew = pmTh.isNew;
  if(isNew){
    pm.columns = (pm.columns || []).concat([{id: pmThNewId(), groupId: gid, name: name}]);
  }else{
    const col = (pm.columns || []).find(c => c.id === pmTh.id);
    if(!col) return;
    col.name = name;
    col.groupId = gid;
  }
  const ok = pmPersist();
  pmThClose();
  pmRenderAll();
  pmToast(ok ? (isNew ? "已添加主题，已保存到本机草稿" : "已保存主题，已保存到本机草稿")
             : "改动只在当前页面，没落盘");
}
/* 删除主题 = 删掉这一列 + 把列里的卡片 columnId 置空。
   两个动作必须同时做完：只删列不置空，validate() 会因为「挂在不存在主题上的卡片」
   把整份数据判成脏数据；只置空不删列，卡片会留在一条空列里。 */
function pmDelTheme(){
  if(!pmTh || pmTh.isNew) return;
  const col = (pm.columns || []).find(c => c.id === pmTh.id);
  if(!col) return;
  if((pm.columns || []).length <= 1){ pmToast("最后一个主题不能删：矩阵会没有列"); return; }
  const s = pmThStat(col.id);
  const money = s.sum == null ? "—" : pmCur() + pmUsd(s.sum);
  const msg = s.n
    ? `删除主题「${col.name}」？\n\n这一列的 ${s.n} 张卡片会移到「未归类」：\n`
      + `· 卡片、代码、金额、地区都保留，不删任何一张\n`
      + `· 但暂不计入合计（这一列原有 ${money}）\n`
      + `· 给它们重新选一个主题，数字就自动回来\n\n`
      + `三段 Σ 和三张图会跟着重算。`
    : `删除主题「${col.name}」？\n这一列没有卡片，合计不变。`;
  if(!confirm(msg)) return;
  let moved = 0;
  (pm.items || []).forEach(it => {
    if(it.columnId === col.id){ it.columnId = ""; moved++; }
  });
  pm.columns = pm.columns.filter(c => c.id !== col.id);
  const ok = pmPersist();
  pmThClose();
  pmRenderAll();
  pmToast(ok
    ? (moved ? `已删除主题，${moved} 张卡片转为未归类，已保存到本机草稿` : "已删除主题，已保存到本机草稿")
    : "删了，但没落盘");
}
function pmThClose(){
  pmEl("pmThDr").classList.remove("on");
  pmEl("pmMask").classList.remove("on");
  document.body.style.overflow = "";
  pmTh = null;
}
function pmDrawer(on){
  pmEl("pmDr").classList.toggle("on", on);
  pmEl("pmMask").classList.toggle("on", on);
  document.body.style.overflow = on ? "hidden" : "";
  if(on) setTimeout(() => pmEl("pmSym").focus(), 180);
}
function pmClose(){
  pmDrawer(false);
  pmEdit = null;
  document.querySelectorAll("#pmGrid .pmt.sel").forEach(el => el.classList.remove("sel"));
}

/* 输入就告诉用户「算不算」，这是「为什么没进合计」的第一道防线。
   注意：这里只解释口径，不替用户改状态——put/call 只是提醒。 */
function pmCalcBox(){
  const box = pmEl("pmCalc"), warn = pmEl("pmWarn");
  if(!box) return;
  const st = (pmEl("pmSeg").querySelector("button.on") || {}).dataset
    ? pmEl("pmSeg").querySelector("button.on").dataset.s : "held";
  const raw = pmEl("pmAmt").value;
  const c = pmParseCents(raw);
  const noCol = pmEl("pmCol") && pmEl("pmCol").value === "";

  if(st === "option"){
    box.className = "calc";
    box.innerHTML = `期权<b>不计入</b>上方任何合计，数量与标的另列期权条。备注原文照常保存。`;
  }else if(st === "watch"){
    box.className = "calc";
    box.innerHTML = `观察中<b>不计入</b>合计。备注原文照常保存，转成已持仓后才开始计入。`;
  }else if(noCol){
    box.className = "calc no";
    box.innerHTML = `所属主题是<b>未归类</b>：卡片会留在「未归类」区，<b>不计入</b>任何合计。选一个主题才会开始计入。`;
  }else if(c != null){
    box.className = "calc ok";
    box.innerHTML = `✓ 解析为 <b>${pmCur()}${(c / 100).toLocaleString("en-US")}</b>，计入合计。`;
  }else{
    box.className = "calc no";
    box.innerHTML = raw.trim()
      ? `! 「${pmEsc(raw)}」不是完整的「数字 k」，<b>不计入</b>；原文照常保存。`
      : `留空＝不计入。要计入请写成 <b>1.5k</b> 这种形式。`;
  }

  const hasPC = /\b(put|call)\b/i.test(raw);
  if(hasPC && st !== "option"){
    warn.style.display = "";
    warn.innerHTML = `备注里有 put / call，但状态是「${PM_ST[st].name}」。<b>不会自动改成期权</b>——如果这确实是期权，请手动切到「期权」。`;
  }else{
    warn.style.display = "none";
  }
}

function pmSaveItem(){
  const sym = pmEl("pmSym").value.trim();
  const name = pmEl("pmName").value.trim();
  const col = pmEl("pmCol").value;
  const reg = pmEl("pmReg").value;
  const btn = pmEl("pmSeg").querySelector("button.on");
  const st = btn ? btn.dataset.s : "held";
  const amt = pmEl("pmAmt").value;

  if(!sym){ pmToast("请填代码或简称"); pmEl("pmSym").focus(); return; }
  if(!reg){ pmToast("请选择地区"); return; }
  /* 已有卡片允许保持「未归类」——它是被删主题留下的状态，不该因为改了金额就被强行塞进某个主题。
     新卡片不行：让一张卡一生下来就在合计之外，除了制造困惑没别的作用。 */
  if(!col && (!pmEdit || pmEdit.isNew)){
    pmToast("请选择一个主题（未归类不计入合计）"); pmEl("pmCol").focus(); return;
  }

  const isNew = pmEdit && pmEdit.isNew;
  if(isNew){
    pm.items.push({
      id: "pm-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      columnId: col, regionId: reg, symbol: sym, name: name || sym, amount: amt, status: st
    });
  }else if(pmEdit){
    const it = (pm.items || []).find(x => x.id === pmEdit.id);
    if(it){
      it.columnId = col; it.regionId = reg; it.symbol = sym;
      it.name = name || sym; it.amount = amt; it.status = st;
    }
  }
  const ok = pmPersist();
  pmClose();
  pmRenderAll();
  pmToast(ok ? (isNew ? "已添加，已保存到本机草稿" : "已保存，已保存到本机草稿") : "改动只在当前页面，没落盘");
}

function pmDelItem(){
  if(!pmEdit || pmEdit.isNew) return;
  const it = (pm.items || []).find(x => x.id === pmEdit.id);
  if(!it) return;
  const c = pmParseCents(it.amount);
  const t = pmTotals();
  const impact = (PM_COUNTED.indexOf(it.status) >= 0 && c != null)
    ? `合计将从 ${pmCur()}${pmUsd(t.total)} 降到 ${pmCur()}${pmUsd(t.total - c)}`
    : "这张卡本来就没计入合计，删除不影响总额";
  if(!confirm(`删除「${it.symbol}」？\n${impact}。`)) return;
  pm.items = pm.items.filter(x => x.id !== it.id);
  const ok = pmPersist();
  pmClose();
  pmRenderAll();
  pmToast(ok ? "已删除，已保存到本机草稿" : "已删在页面里，但没落盘");
}

/* ---------------- 导入 / 导出 / 重置 ---------------- */
function pmExport(){
  try{
    const blob = new Blob([JSON.stringify(pmPure(pm), null, 2)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (pmMode === "core" ? "核心仓-" : "卫星仓-") + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    pmToast("已导出 JSON");
  }catch(e){
    pmToast("导出失败：" + (e.message || "浏览器拒绝"));
  }
}
function pmCheckShape(d){
  if(!d || typeof d !== "object") return "内容不是对象";
  for(const k of ["groups", "columns", "regions", "items"]){
    if(!Array.isArray(d[k])) return "缺少数组字段 " + k;
  }
  const gids = new Set(d.groups.map(g => g.id));
  const rids = new Set(d.regions.map(r => r.id));
  const cids = new Set(d.columns.map(c => c.id));
  for(const c of d.columns){
    if(!gids.has(c.groupId)) return `主题「${c.name || c.id}」挂在不存在的策略上`;
  }
  for(const it of d.items){
    if(!cids.has(it.columnId)) return `卡片 ${it.symbol || it.id} 的主题不存在`;
    if(!rids.has(it.regionId)) return `卡片 ${it.symbol || it.id} 的地区不存在`;
    if(!PM_ST[it.status]) return `卡片 ${it.symbol || it.id} 的状态 "${it.status}" 不认识`;
    if(typeof it.amount !== "string") return `卡片 ${it.symbol || it.id} 的备注必须是字符串`;
  }
  return null;
}
function pmImportText(txt){
  let d;
  try{ d = JSON.parse(txt); }
  catch(e){ pmToast("不是合法的 JSON，没有导入"); return; }
  /* 核心仓是另一套结构（基金 → 资产），不能拿矩阵那套形状检查去套它 */
  if(pmMode === "core"){
    if(!d || !Array.isArray(d.funds)){ pmToast("导入失败：这不是核心仓文件（缺少 funds）"); return; }
    if(!confirm(`导入会覆盖当前核心仓：\n${d.funds.length} 只基金 · ${d.funds.reduce((a, f) => a + ((f.assets || []).length), 0)} 项资产。\n继续？`)) return;
    d.currency = "CNY";
    pmBook.core = d; pm = d;
    const okC = pmPersist();
    pmcRender();
    pmToast(okC ? "已导入 " + d.funds.length + " 只基金，已保存到本机草稿" : "已导入，但没落盘");
    return;
  }
  const bad = pmCheckShape(d);
  if(bad){ pmToast("导入失败：" + bad); return; }
  if(!confirm(`导入会覆盖当前地图：\n${d.groups.length} 个策略 · ${d.columns.length} 个主题 · ${d.regions.length} 个地区 · ${d.items.length} 张卡片。\n继续？`)) return;
  pm = d;
  /* 外部 JSON 不一定带 currency，补上当前仓的——否则核心仓会被当成美元 ×7 */
  if(!pm.currency) pm.currency = pmMode === "core" ? "CNY" : "USD";
  const ok = pmPersist();
  pmRenderAll();
  pmToast(ok ? "已导入 " + d.items.length + " 张卡片，已保存到本机草稿" : "已导入，但没落盘");
}
function pmReset(){
  if(!confirm("重置为构建时的源数据？\n本机草稿会清掉，源文件会被覆盖成构建时那一份（旧文件自动备份到 backups/）。")) return;
  pm = JSON.parse(JSON.stringify((PM_SRC[pmMode] || PM_SRC.sat)()));
  delete pm.sum;
  try{ localStorage.removeItem(pmKey()); }catch(e){}
  pmLocalAt = "";
  pmPushState = "idle";
  pmPersist();
  pmRedraw();
  pmToast("已还原为源数据，已保存到本机草稿");
}

/* ---------------- 初始化 ---------------- */
/* currency 保留为原生文件结构的一部分；sum 前端重算、as_of/book/name 是给页面看的。
   它们一律不进源文件——写回时剔干净，matrix.json / core.json 才会一直是用户手填的那五样。 */
const PM_BUILD_ONLY = ["sum", "as_of", "book", "name"];
function pmPure(d){
  const o = JSON.parse(JSON.stringify(d));
  for(const k of PM_BUILD_ONLY) delete o[k];
  return o;
}
/* 币种不能靠猜：文件里没写就按仓别补，绝不让缺字段悄悄把核心仓放大七倍 */
function pmFit(d, book){
  if(!d) return d;
  for(const k of ["sum", "as_of", "book", "name"]) delete d[k];
  if(!d.currency) d.currency = book === "core" ? "CNY" : "USD";
  return d;
}

/* 地区是**元数据**，不是用户敲进去的内容——界面里根本没有增删地区的入口。
   但草稿存的是整份数据，包括它当时那几行。于是 v1.38.1 给 matrix.json 加了
   「其他」以后，浏览器里那份旧草稿会把它挡在外面：刷新页面下拉还是四项，
   看起来像改动没生效，实际是草稿在覆盖。这里以构建期/文件版为底补地区，
   只补不改序，已有行原样保留（万一将来真的支持删地区，也不会被悄悄加回来）。 */
function pmEnsureRegions(d, book, from){
  if(!d || book === "core") return 0;
  let floor = Array.isArray(from) ? from : [];
  if(!floor.length){
    const src = PM_SRC.sat ? PM_SRC.sat() : null;
    floor = (src && Array.isArray(src.regions)) ? src.regions : [];
  }
  if(!floor.length) return 0;
  d.regions = Array.isArray(d.regions) ? d.regions : [];
  const have = new Set(d.regions.map(r => r.id));
  let add = 0;
  floor.forEach(r => { if(!have.has(r.id)){ d.regions.push({id: r.id, name: r.name}); add++; } });
  return add;
}

/* 两个仓各自装载：本机草稿优先，没有就用构建期内嵌的那一份。
   `sum` 是构建期算的汇总快照，前端一律重算，读进来就删掉——
   留着只会让人误以为页面显示的是「构建那一刻」的数字。 */
function pmBootBook(book){
  let d = pmLoadLocal(book);
  if(!d){
    const src = PM_SRC[book] ? PM_SRC[book]() : null;
    d = src ? JSON.parse(JSON.stringify(src)) : null;
  }
  d = pmFit(d, book);
  pmEnsureRegions(d, book);
  pmBook[book] = d;
  return d;
}

/* 源文件回拉 + 对账。两个仓各跑一次，互不干扰。
   规则与 v1.36.0 相同：没有本机草稿就以文件为准；有草稿且不一致就把两份时间
   摆出来让用户选，绝不自动合并——两边都可能有刚写的东西，静默丢掉哪一份都不可接受。 */
async function pmSyncBook(book){
  try{
    const r = await fetch(book === "core" ? "/api/core" : "/api/portfolio", {cache: "no-store"});
    const j = await r.json();
    if(!j.ok || !j.matrix){
      if(pmMode === book) pmSaveBadge("offline");
      return;
    }
    const fresh = pmFit(j.matrix, book);
    pmEnsureRegions(fresh, book);
    const mine = pmBook[book];
    const viewing = pmMode === book;

    if(!mine){
      pmBook[book] = fresh;
      if(viewing){ pm = fresh; pmRedraw(); pmSaveBadge("ok"); }
      return;
    }
    /* 草稿那份也补一次，底用刚拉下来的文件版——万一页面本身是旧构建（内嵌只有
       四个地区），这一步仍然能把地区补上，不至于让「加了却看不到」重演。
       地区不属于「用户编辑的内容」，不该参与下面的草稿冲突判定。 */
    if(pmEnsureRegions(mine, book, fresh.regions) && viewing) pmRedraw();
    /* 比的是「纯数据」：currency 由仓别补、sum/as_of 是构建期字段，
       它们参与比较只会让每次刷新都判成「不一致」。 */
    if(JSON.stringify(pmPure(fresh)) === JSON.stringify(pmPure(mine))){
      if(viewing) pmSaveBadge("ok");
      return;
    }

    if(!pmDraftAt[book]){
      /* 手上这份只是构建期的快照，文件比它新 → 换成文件版 */
      pmBook[book] = fresh;
      if(viewing){ pm = fresh; pmRedraw(); pmSaveBadge("ok"); }
      return;
    }
    if(viewing){
      pmPushState = "conflict";
      pmSaveBadge("dirty", "本机草稿与源文件不一致，等你选一份");
      pmConflictBanner(pmDraftAt[book], j.as_of || "", fresh);
    }
    pmConflict[book] = {localAt: pmDraftAt[book], fileAt: j.as_of || "", fresh: fresh};
  }catch(e){ if(pmMode === book) pmSaveBadge("offline"); }
}

/* 某个仓没有数据：不编造，直接说缺哪个文件 */
function pmRenderNoData(mode){
  if(mode === "core"){
    /* 核心仓没有矩阵容器，要写的是自己那三块 */
    const host = pmEl("pmcList");
    if(pmEl("pmcFN")) pmEl("pmcFN").textContent = "—";
    if(pmEl("pmcAN")) pmEl("pmcAN").textContent = "—";
    if(pmEl("pmcTT")) pmEl("pmcTT").textContent = "—";
    if(pmEl("pmcSum")) pmEl("pmcSum").innerHTML = `<div class="tot">
      <div class="lab">核心仓合计 <i>按资产层摊分</i></div>
      <div class="num na"><span class="cur">¥</span><strong>—</strong></div>
      <div class="recon">没有读到 data/portfolio/core.json</div></div>
      <div class="splits"><div class="snote">构建时没找到数据文件，页面不会编造任何数字。</div></div>`;
    if(pmEl("pmcViz")) pmEl("pmcViz").innerHTML = "";
    if(host) host.innerHTML = `<div class="pmempty" style="border:0;background:transparent">
      <div class="ic">!</div><h3>没有核心仓数据</h3>
      <p>把 core.json 放到 data/portfolio/ 后重新构建；点「+ 添加基金」也可以直接从空仓开始。</p></div>`;
    pmSaveBadge("nodata");
    return;
  }
  const f = mode === "core" ? "core.json" : "matrix.json";
  pmEl("pmSum").innerHTML = `<div class="tot"><div class="lab">仓位备注合计 <i>非市值</i></div>
    <div class="num"><span class="cur">${mode === "core" ? "¥" : "US$"}</span><strong>—</strong></div>
    <div class="recon">没有读到 data/portfolio/${f}</div></div>
    <div class="splits"><div class="snote">构建时没找到数据文件，页面不会编造任何数字。</div></div>`;
  pmEl("pmViz").innerHTML = "";
  pmEl("pmOpt").innerHTML = `<span class="lab">期权 · 单独展示</span><span class="cnt">0 张</span>`;
  pmEl("pmGrid").innerHTML = `<div class="pmempty" style="border:0;background:transparent">
    <div class="ic">!</div><h3>没有${mode === "core" ? "核心仓" : "卫星仓"}数据</h3>
    <p>把 ${f} 放到 data/portfolio/ 后重新构建；也可以在右上角「导入」一份 JSON 先看起来。</p></div>`;
  pmEl("pmList").innerHTML = "";
  pmSaveBadge("nodata");
}

function pInitMap(){
  pmBootBook("sat");
  pmBootBook("core");

  /* 事件只绑一次：它们都作用于「当前这一套 DOM」，切视图换的是数据，不是节点。
     绑定放在数据判空之前——否则某个仓文件缺失时，连切换按钮都会点不动。 */
  const on = (id, ev, fn) => { const el = pmEl(id); if(el) el.addEventListener(ev, fn); };
  on("pmQ", "input", e => {
    if(!pm) return;                    // 总仓视图没有矩阵，别对着空数据重绘
    pmQ = e.target.value.trim().toLowerCase();
    const t = pmTotals();
    pmRenderGrid(t); pmRenderList(t); pmUpdateHits();
  });
  on("pmDens", "click", e => {
    if(!pm) return;
    const b = e.target.closest("button"); if(!b) return;
    pmDensity = b.dataset.d;
    pmEl("pmDens").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    pmRenderGrid(pmTotals());
  });
  on("pmSeg2", "click", e => {
    const b = e.target.closest("button"); if(!b) return;
    if(b.dataset.m === pmMode) return;
    pmSwitch(b.dataset.m);
  });

  /* ---- 核心仓：基金 / 资产 两个抽屉 ---- */
  on("pmcNew", "click", () => pmcOpenFund(null));
  on("pmcFX", "click", pmcCloseAll);
  on("pmcFCancel", "click", pmcCloseAll);
  on("pmcFSave", "click", pmcSaveFund);
  on("pmcFDel", "click", pmcDelFund);
  on("pmcAX", "click", pmcCloseAll);
  on("pmcACancel", "click", pmcCloseAll);
  on("pmcASave", "click", pmcSaveAsset);
  on("pmcADel", "click", pmcDelAsset);
  on("pmcMask", "click", pmcCloseAll);
  on("pmcAW", "input", pmcCalcAsset);
  on("pmcAReg", "change", pmcCalcAsset);
  on("pmcASeg", "click", e => {
    const b = e.target.closest("button"); if(!b) return;
    pmcSetStyle(b.dataset.s);
  });
  on("pmcFAmt", "input", () => {
    const box = pmEl("pmcFCalc");
    if(!box) return;
    const c = pmParseCents((pmEl("pmcFAmt").value || "").trim());
    box.textContent = c == null
      ? "不是「数字 k」形式 → 暂时不计入合计（原文仍会保存）。例：50k、12.5k。"
      : `计入 ¥${pmFmtW(c)}（${(c / 100).toLocaleString("zh-CN")} 元）。`;
  });
  /* 两个抽屉各按回车＝保存：都只有一到两个输入框，回车没有第二种可能 */
  on("pmcFName", "keydown", ev => { if(ev.key === "Enter"){ ev.preventDefault(); pmcSaveFund(); } });
  on("pmcAName", "keydown", ev => { if(ev.key === "Enter"){ ev.preventDefault(); pmcSaveAsset(); } });
  on("pmcAW", "keydown", ev => { if(ev.key === "Enter"){ ev.preventDefault(); pmcSaveAsset(); } });
  document.addEventListener("keydown", e => {
    if(e.key !== "Escape") return;
    if(pmEl("pmcFDr").classList.contains("on") || pmEl("pmcADr").classList.contains("on")) pmcCloseAll();
  });
  on("pmNew", "click", () => pmOpenNew());
  on("pmExp", "click", pmExport);
  on("pmImp", "click", () => pmEl("pmFile").click());
  on("pmFile", "change", e => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const rd = new FileReader();
    rd.onload = () => pmImportText(String(rd.result || ""));
    rd.readAsText(f, "utf-8");
    e.target.value = "";
  });
  on("pmDrX", "click", pmClose);
  on("pmMask", "click", () => { pmClose(); pmThClose(); });
  on("pmCancel", "click", pmClose);
  on("pmSave2", "click", pmSaveItem);
  on("pmDel", "click", pmDelItem);
  on("pmThX", "click", pmThClose);
  on("pmThCancel", "click", pmThClose);
  on("pmThSave", "click", pmSaveTheme);
  on("pmThDel", "click", pmDelTheme);
  /* 改名后回车＝保存：这个抽屉只有一个输入框，回车没有第二种可能 */
  on("pmThName", "keydown", ev => {
    if(ev.key === "Enter"){ ev.preventDefault(); pmSaveTheme(); }
    if(ev.key === "Escape"){ pmThClose(); }
  });
  on("pmThGrp", "change", pmThCalc);
  on("pmAmt", "input", pmCalcBox);
  on("pmCol", "change", pmCalcBox);
  on("pmSeg", "click", e => {
    const b = e.target.closest("button"); if(!b) return;
    pmSetStatus(b.dataset.s);
    pmCalcBox();
  });
  document.addEventListener("keydown", e => {
    if(!pmEl("pmDr") || !pmEl("pmDr").classList.contains("on")) return;
    if(e.key === "Escape") pmClose();
    if(e.key === "Enter" && (e.metaKey || e.ctrlKey)) pmSaveItem();
  });

  /* 进哪个视图：记忆上一次；第一次来默认「总仓」——总仓是这一页的主读数 */
  let last = "total";
  try{ last = localStorage.getItem("pmx_mode") || "total"; }catch(e){}
  pmSwitch(PM_HEAD[last] ? last : "total");

  pmSyncBook("sat");
  pmSyncBook("core");
}


// Offline reconciliation has no authority to write the online source files.
const offlineDraftErrors={},offlineConflicts={};
const offlineOriginalBadge=pmSaveBadge;
pmSaveBadge=function(st,detail){const b=pmMode==='core'?'core':'sat';if(st==='nostore')offlineDraftErrors[b]=true;if(st==='dirty')offlineDraftErrors[b]=false;if(st==='ok'||st==='offline'||st==='saved')st=offlineDraftErrors[b]?'nostore':'offline';offlineOriginalBadge(st,detail);};
const offlineOriginalBoot=pmBootBook;
pmBootBook=function(book){offlineOriginalBoot(book);const source=PM_SRC[book]();if(source&&pmBook[book]&&JSON.stringify(pmPure(source))!==JSON.stringify(pmPure(pmBook[book])))offlineConflicts[book]={source:structuredClone(source),draft:structuredClone(pmBook[book])};};
const offlineOriginalTotal=pmTotalData;
pmTotalData=function(){const out=offlineOriginalTotal(),merged={};for(const [key,val]of Object.entries(out.r)){const id=({china:'cn',hk:'cn',cn:'cn',jp:'asia',asia:'asia',eu:'europe',europe:'europe'})[key]||key;merged[id]=(merged[id]||0)+val;}out.r=merged;out.rname={...out.rname,cn:'中国（含港）',asia:'日韩台印',europe:'欧洲'};return out;};
function offlineConflictBanner(){
 let box=document.getElementById('offline-portfolio-conflicts');if(!box){box=document.createElement('section');box.id='offline-portfolio-conflicts';box.className='offline-note';document.getElementById('pane11').prepend(box);}
 box.replaceChildren();for(const [book,conflict]of Object.entries(offlineConflicts)){
  const row=document.createElement('div');row.textContent=(book==='core'?'核心仓':'卫星仓')+'：浏览器草稿与本文件快照不同。当前显示草稿，请选择保留哪份；另一份会先备份。 ';
  for(const [key,label]of [['draft','使用浏览器草稿'],['source','使用文件快照']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{const keep=conflict[key],other=conflict[key==='draft'?'source':'draft'];try{localStorage.setItem(PM_KEY[book]+'.backup.'+Date.now(),JSON.stringify({savedAt:new Date().toISOString(),data:other}));localStorage.setItem(PM_KEY[book],JSON.stringify({savedAt:new Date().toISOString(),data:keep}));}catch{alert('备份或草稿保存失败，两份数据仍保留，请先导出。');return;}pmBook[book]=structuredClone(keep);delete offlineConflicts[book];pmSwitch(pmMode);offlineConflictBanner();};row.append(b);}box.append(row);
 }box.hidden=!Object.keys(offlineConflicts).length;
}
pmSyncBook=async function(){};
pmPushFile=function(){pmPushState='offline';pmSaveBadge('offline');};
pmReset=function(){if(!confirm('恢复为本文件内嵌快照？当前本机草稿会先备份。'))return;try{localStorage.setItem(pmKey()+'.backup.'+Date.now(),JSON.stringify({savedAt:new Date().toISOString(),data:pmPure(pm)}));}catch{alert('备份失败，未重置。');return;}pm=structuredClone(PM_SRC[pmMode]());pmBook[pmMode]=pm;pmPersist();pmRenderAll();};
pInitMap();offlineConflictBanner();document.getElementById('pane11').style.display='none';
