"use strict";
const FILE_ONLY="需通过本地服务打开；文件快照不能刷新";
async function postJSON(url, ms=240000){
  const ac=new AbortController();
  const tid=setTimeout(()=>ac.abort(), ms);
  try{
    const r=await fetch(url,{method:"POST",signal:ac.signal});
    const txt=await r.text();
    let j=null;
    try{ j=JSON.parse(txt); }
    catch(_){ throw new Error(`服务返回非 JSON（HTTP ${r.status}）：${txt.slice(0,160)||"空响应"}`); }
    if(!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }catch(e){
    if(e && e.name==="AbortError") throw new Error(`请求超时（${Math.round(ms/1000)}s 未返回）`);
    if(e instanceof TypeError) throw new Error("连不上本地服务，请确认应用正在运行");
    throw e;
  }finally{
    clearTimeout(tid);
  }
}

/* ================= 专家观点（原「最新风向」） ================= */
const W_CN = {bull:"偏多", neutral:"中性", bear:"偏空"};
let wQ = "", wTag = "all", wTight = false;

function wEsc(s){
  return String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}
function wDate(s){
  s = String(s||"");
  return s.length > 7 ? s.slice(5) : s.slice(5) + "月";
}
function wMatch(p, q){
  if(!q) return true;
  const s = [p.cn, p.name, p.role, p.org, p.stance]
    .concat((p.points||[]).map(x=>x.text + " " + x.src))
    .concat((p.feed||[]).map(x=>x.title + " " + x.src))
    .join(" ").toLowerCase();
  return s.indexOf(q) >= 0;
}
function wBriefHTML(d){
  const items = (d.brief && d.brief.items) || [];
  return items.map((it,i)=>`
    <div class="wb-item">
      <div class="wb-n">${String(i+1).padStart(2,"0")}</div>
      <div><div class="wb-h">${wEsc(it.h)}</div><div class="wb-t">${wEsc(it.t)}</div></div>
    </div>`).join("");
}
function wTempHTML(d){
  return (d.stats||[]).map(c=>{
    const t = Math.max(c.n, 1);
    return `<button type="button" class="wcell" data-cat="${wEsc(c.id)}" title="跳到「${wEsc(c.name)}」">
      <div class="nm"><span>${wEsc(c.name)}</span><i>${c.n} 人 · ${c.points} 条${c.auto?` · 自动 ${c.auto}`:""}</i></div>
      <div class="track">
        ${c.bull?`<i class="b-bull" style="width:${c.bull/t*100}%"></i>`:""}
        ${c.neutral?`<i class="b-neu" style="width:${c.neutral/t*100}%"></i>`:""}
        ${c.bear?`<i class="b-bear" style="width:${c.bear/t*100}%"></i>`:""}
      </div>
      <div class="lg"><span>多 <b>${c.bull}</b></span><span>中 <b>${c.neutral}</b></span><span>空 <b>${c.bear}</b></span><span class="go">跳转 ↓</span></div>
    </button>`;
  }).join("");
}
/* 自动抓取块：标题原文 + 日期 + 来源 + 链接，一条一行，最多 5 条。
   这里刻意不写「怎么看」，也不改人物的 tag——机器搬的标题没有立场，
   替它标多空就等于替人下判断，而判断是这个模块唯一不许程序碰的东西。 */
function wFeedHTML(p){
  const f = p.feed || [];
  if(!f.length) return "";
  const when = (typeof WIND !== "undefined" && WIND && WIND.feed_fetched_at) ? WIND.feed_fetched_at.slice(5) : "";
  return `<div class="wfeed">
    <div class="wf-h">最近表态<em>自动抓取 · 原文标题</em>${when?`<span>抓于 ${wEsc(when)}</span>`:""}</div>
    ${f.map(x=>`<a class="wf-i" href="${wEsc(iSafeURL(x.url))}" target="_blank" rel="noopener noreferrer" title="${wEsc(x.title)}">
      <span class="wd">${wEsc(wDate(x.date))}</span>
      <span><span class="wf-t">${wEsc(x.title)}</span><span class="wf-s">${wEsc(x.src||"来源未标")} ↗</span></span>
    </a>`).join("")}
  </div>`;
}
function wCardHTML(p){
  const pts = p.points || [];
  const show = wTight ? pts.slice(0, 1) : pts;
  return `<article class="wcard" data-tag="${p.tag}">
    <div class="wch">
      <div class="wav" data-tag="${p.tag}">${wEsc((p.cn||p.name||"?").slice(0,1))}</div>
      <div class="wnm"><b>${wEsc(p.cn||p.name)}</b><span>${wEsc(p.name)}</span></div>
      <span class="wtg ${p.tag}">${W_CN[p.tag]||""}</span>
    </div>
    <div class="wrole">${wEsc(p.role)}${p.org && p.role.indexOf(p.org) < 0 ? " · " + wEsc(p.org) : ""}</div>
    <div class="wst">${wEsc(p.stance)}</div>
    ${show.map(x=>`<div class="wpt">
      <span class="wd">${wEsc(wDate(x.date))}</span>
      <div><em>${wEsc(x.src)}</em><p>${wEsc(x.text)}</p></div>
    </div>`).join("")}
    ${wTight ? "" : wFeedHTML(p)}
  </article>`;
}
function renderWind(){
  if(!WIND) return;
  const d = WIND;
  // 页首这行要说三件事：主线几条（有上限）、多少人多少要点、内容最新到哪天。
  // 「窗口末端」是人写死的快照日，它不会自己往前走；「最近一条要点」才是内容真实的新鲜度，
  // 少了这一项，11-15 点开会以为数据是新的。
  const bItems = (d.brief && d.brief.items) || [];
  const bDrop = (d.brief && d.brief.dropped) || [];
  const wNote = document.getElementById("wNote");
  wNote.innerHTML =
    `主线 <b>${bItems.length}</b> 条`
    + (bDrop.length ? `<span style="color:#8a6a3c">（${bDrop.length} 条超上限未显示）</span>` : "")
    + ` · ${d.n_people||0} 位 / ${d.n_points||0} 条要点`
    + (d.latest_point ? ` · 最近一条 <b>${wDate(d.latest_point)}</b>` : "")
    + (d.n_feed ? ` · 另有自动抓取 <b>${d.n_feed}</b> 条（${d.n_feed_people||0} 位 · 抓于 ${wEsc(String(d.feed_fetched_at||"").slice(5))}）` : "")
    + ` · 窗口 ${d.window[0].slice(5)} ~ ${d.window[1].slice(5)}`;
  wNote.title = bDrop.length
    ? "超出上限、未显示：" + bDrop.join("；")
    : "";
  document.getElementById("wBrief").innerHTML = wBriefHTML(d);
  document.getElementById("wTemp").innerHTML = wTempHTML(d);

  const q = wQ.trim().toLowerCase();
  let shown = 0, npt = 0;
  const html = [];

  (d.cats||[]).forEach(c=>{
    const vis = (d.people||[]).filter(p=>p.cat===c.id
      && (wTag==="all" || p.tag===wTag) && wMatch(p, q));
    if(!vis.length) return;
    shown += vis.length;
    const cnt = vis.reduce((s,p)=>s+(p.points||[]).length, 0);
    npt += cnt;

    let inner = "";
    if(c.groups && c.groups.length){
      c.groups.forEach(g=>{
        const sub = vis.filter(p=>(p.grp||"")===g.id);
        if(!sub.length) return;
        inner += `<div class="wgrp">${wEsc(g.name)} · ${sub.length} 人</div>`
               + `<div class="wgrid">${sub.map(wCardHTML).join("")}</div>`;
      });
      const rest = vis.filter(p=>!c.groups.some(g=>g.id===p.grp));
      if(rest.length) inner += `<div class="wgrid">${rest.map(wCardHTML).join("")}</div>`;
    }else{
      inner = `<div class="wgrid">${vis.map(wCardHTML).join("")}</div>`;
    }

    html.push(`<section class="wcat" id="wcat-${wEsc(c.id)}" data-cat="${wEsc(c.id)}">
      <div class="wcat-h"><h3>${wEsc(c.name)}</h3><span class="d">${wEsc(c.desc||"")}</span>
        <span class="ct">${vis.length} 人 · ${cnt} 条</span></div>
      ${inner}
    </section>`);
  });

  document.getElementById("wBody").innerHTML =
    html.length ? html.join("") : `<div class="wempty">没有匹配的人物或关键词</div>`;
  document.getElementById("wCount").textContent =
    `显示 ${shown} / ${d.n_people||0} 位，${npt} 条要点`
    + (d.n_feed ? `，${d.n_feed} 条自动抓取` : "");
}
/* 温度条跳转：六个分类格子直接滚到对应区块，省掉「从这个人的卡片一直往下拖」。
   筛选生效时目标区块可能整块没有渲染，这时先清掉搜索与立场筛选再跳——点格子的意图就是
   「看这一块」，跳不过去比丢一次筛选更糟；清筛选这件事会写回 wCount，不静默改状态。 */
function wJump(cat){
  const find = ()=>document.querySelector('#wBody .wcat[data-cat="'+cat+'"]');
  let el = find();
  if(!el){
    const had = (wQ || wTag !== "all");
    wQ = ""; wTag = "all";
    const q = document.getElementById("wQ"); if(q) q.value = "";
    document.querySelectorAll("#wFilter button")
      .forEach(b=>b.classList.toggle("on", b.dataset.t === "all"));
    renderWind();
    el = find();
    if(!el) return;
    if(had){
      const cnt = document.getElementById("wCount");
      cnt.textContent = "已清除筛选：该分类在原有筛选下没有卡片";
      setTimeout(renderWind, 1800);
    }
  }
  el.scrollIntoView({behavior:"smooth", block:"start"});
  el.classList.remove("flash");
  void el.offsetWidth;            /* 强制回流，连点两次也能重放动画 */
  el.classList.add("flash");
  setTimeout(()=>el.classList.remove("flash"), 1600);
}
/* 更新按钮：观点是策展内容，程序造不出来。所以这里能做的只有两件事——
   把改过的数据文件重新读进来（服务端还会重建静态页，避免 F5 回退），
   以及体检一遍谁的观点最旧，把该补的名单摆出来。 */
function wShowStale(f){
  const box = document.getElementById("wStale");
  if(!f){ box.innerHTML = ""; return; }
  const stale = f.stale || [], empty = f.empty || [];
  if(!stale.length && !empty.length){
    box.innerHTML = `<div class="wstale"><span><b>全部 ${f.ok} 位</b>在 ${f.days} 天内都有新人写观点。</span>
      <span class="x">×</span></div>`;
    return;
  }
  const names = stale.slice(0, 10)
    .map(s=>`${wEsc(s.cn)}<em> ${s.gap}天</em>`
      + (s.auto ? `<em style="color:#8a8578">（自动 ${wDate(s.auto)}）</em>` : ""))
    .join("、");
  const more = stale.length > 10 ? ` 等 ${stale.length} 位` : "";
  const autoN = stale.filter(s=>s.auto).length;
  box.innerHTML = `<div class="wstale">
    <span><b>${stale.length} 位</b>超过 ${f.days} 天没有新的<b>人写</b>要点：${names}${more}。
    ${autoN ? `其中 ${autoN} 位有自动抓取的近期标题（括号里是最近一条），但判断还是空的。` : ""}
    ${empty.length ? `另有 ${empty.length} 位无要点。` : ""}要补哪几位，说一声我去查。</span>
    <span class="x">×</span></div>`;
}

/* 「更新观点」的结果条。这个按钮现在会真去搜（每人一到两个检索词，四十秒上下），
   所以必须说清三件事：抓到了什么、谁那里多了、谁没搜到。
   只说「已重载 05:23」，用户看到的仍是满屏没动的卡片，只会以为按钮坏了。 */
function wRefSt(j){
  const box = document.getElementById("wRefSt");
  if(!box) return;
  const df = j.diff || {};
  const w = j.wind || {};
  const secs = (j.elapsed != null ? j.elapsed : "?") + "s";
  const built = j.built ? "最新数据已保存" : "本次快照保存失败，旧快照保留";
  const newN = df.new || 0;
  const names = (df.added_names || []).slice(0, 6)
    .map(x=>`${wEsc(x.cn)} +${x.n}`).join("、");
  const more = (df.added_names || []).length > 6 ? ` 等 ${df.added_names.length} 位` : "";
  const nofeed = (df.nofeed || []).map(x=>wEsc(x.cn || x.id));
  const nofeedTxt = nofeed.length
    ? ` · <b>${nofeed.length} 位没搜到</b>：${nofeed.slice(0, 8).join("、")}${nofeed.length > 8 ? " 等" : ""}`
      + `<span class="tip" title="这些多是译名，检索库里没有对应写法。要补的话给我英文名或原名，加一条别名即可。">?</span>`
    : "";
  const auto = `自动合计 ${df.n_feed || 0} 条（${df.n_feed_people || 0} 位，最近 ${df.feed_latest ? wDate(df.feed_latest) : "—"}）`;
  let head, tail;
  if(newN > 0){
    head = `<b>搜到了新表态</b> 新增 <b>${newN}</b> 条，覆盖 ${(df.added_names||[]).length} 位`
         + (names ? `：${names}${more}` : "");
    tail = ` · ${auto} · 人写的 ${w.n_points||0} 条没动 · ${built}（${secs}）`;
  }else{
    head = `<b>这轮没有新内容</b> ${df.hit_people||0} 位能搜到的人，最新标题都已在文件里`;
    tail = ` · ${auto} · ${built}（${secs}）`;
  }
  box.className = "wrefst on" + (newN > 0 ? " up" : "");
  box.innerHTML = `<span>${head}${tail}${nofeedTxt}</span><span class="x">×</span>`;
}

const wSleep = ms => new Promise(r => setTimeout(r, ms));

async function wRefresh(resume=false){
  const btn = document.getElementById("wRefBtn");
  const txt = document.getElementById("wRefTxt");
  if(btn.disabled) return;
  btn.disabled = true; txt.textContent = "检索中…";
  try{
    if(location.protocol==="file:") throw new Error(FILE_ONLY);
    if(resume!==true){
      const r = await fetch("/api/wind/refresh", {method:"POST"});
      const j0 = await r.json();
      if(!j0.ok) throw new Error(j0.error || "更新失败");
    }
    // 后台跑四十秒上下，轮询到 running 变 false 为止；顺带把进度写进按钮，
    // 否则这四十秒里按钮只有一个「检索中…」，看不出是死是活。
    let res = null, last = 0;
    for(let i = 0; i < 400; i++){
      await wSleep(700);
      const p = await (await fetch("/api/wind/progress")).json();
      if(p.error) throw new Error(p.error);
      if(p.running){
        if(p.total && p.done !== last){ last = p.done; txt.textContent = `检索 ${p.done}/${p.total}`; }
        else if(!p.total) txt.textContent = "检索中…";
        continue;
      }
      res = p.result;
      break;
    }
    if(!res) throw new Error("等了太久还没有结果，稍后再点一次；已经抓到的会留在文件里");
    WIND = iSanitize(res.wind);
    renderWind();
    wShowStale(WIND.fresh);
    wRefSt(res);
  }catch(e){
    document.getElementById("wStale").innerHTML =
      `<div class="wstale" style="background:#fdf3f2;border-color:#eccdc9;border-left-color:#c0392b">
         <span><b>更新失败</b>：${wEsc(e.message || String(e))}</span><span class="x">×</span></div>`;
  }finally{
    btn.disabled = false; txt.textContent = "更新观点";
  }
}
document.getElementById("wRefBtn").addEventListener("click", wRefresh);
document.getElementById("wRefSt").addEventListener("click", e=>{
  if(e.target.classList.contains("x")) document.getElementById("wRefSt").innerHTML = "";
});
document.getElementById("wStale").addEventListener("click", e=>{
  if(e.target.classList.contains("x")) document.getElementById("wStale").innerHTML = "";
});

document.getElementById("wQ").addEventListener("input", e=>{ wQ = e.target.value; renderWind(); });document.getElementById("wFilter").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  wTag = b.dataset.t;
  [...e.currentTarget.children].forEach(x=>x.classList.toggle("on", x===b));
  renderWind();
});
document.getElementById("wTight").addEventListener("click", e=>{
  wTight = !wTight;
  e.currentTarget.textContent = wTight ? "展开全部要点" : "只看结论";
  renderWind();
});
document.getElementById("wTemp").addEventListener("click", e=>{
  const c = e.target.closest(".wcell");
  if(c && c.dataset.cat) wJump(c.dataset.cat);
});

/* ================= 市场新闻 ================= */
/* 与风向的区别在于「新闻会过期」：风向三个月都算新，新闻过 24 小时就只剩背景。
   所以这里一切时间都按浏览器当下算，不用构建期快照——否则页面越放越新。 */
function nTime(s){
  s = String(s||"");
  return s.length >= 16 ? s.slice(5,16).replace("T"," ") : s;
}
function nAgeH(d){
  const newest = (d.items||[]).map(x=>x.date).sort().pop();
  if(!newest) return null;
  const t = Date.parse(newest);
  return isNaN(t) ? null : (Date.now() - t) / 3600000;
}
function nBriefHTML(d){
  const b = d.brief || {};
  const head = b.auto
    ? `<div class="nwb-auto"><b>自动摘要</b><span>${wEsc(b.rule||"")}</span></div>`
    : "";
  return head + (b.items||[]).map((it,i)=>`
    <div class="nwb-item">
      <div class="nwb-n">${String(i+1).padStart(2,"0")}</div>
      <div><div class="nwb-h">${wEsc(it.h)}</div>
        <div class="nwb-t">${wEsc(it.t)}${b.auto&&it.src
          ? `<span class="nwb-meta">${wEsc(it.src)} · ${nTime(it.date)}</span>`:""}</div></div>
    </div>`).join("");
}
function nCard(it, rank){
  const imp = (it.impact||[]).map(x=>`<i>${wEsc(x)}</i>`).join("");
  const why = it.why ? `<div class="nww">${wEsc(it.why)}</div>` : "";
  const auto = it.auto ? `<span class="nwauto" title="原料池直接搬运，没有人工判断">未策展</span>` : "";
  return `<article class="nwcard${it.auto?" auto":""}">
    ${rank!=null
      ? `<div class="nwrank"><span>${String(rank).padStart(2,"0")}</span>${it.carry?`<span class="nwcarry">持续</span>`:""}${auto}</div>`
      : (auto?`<div class="nwrank">${auto}</div>`:"")}
    <div class="nwh">${wEsc(it.t)}</div>
    <div class="nwt">${wEsc(it.tcn)}</div>
    ${why}
    <div class="nwf">
      <span class="src">${wEsc(it.src)}</span><span>${nTime(it.date)}</span>
      ${it.n_src>1?`<span>${it.n_src} 家同报</span>`:""}
      ${it.url?`<a href="${wEsc(iSafeURL(it.url))}" target="_blank" rel="noopener">原文</a>`:""}
      ${imp?`<span class="nimp">${imp}</span>`:""}
    </div>
  </article>`;
}
function nSourceNote(d){
 let host=document.getElementById('nSourceNote');if(!host){host=document.createElement('div');host.id='nSourceNote';document.getElementById('nBrief').before(host);}host.replaceChildren();if(!d)return;
 if(d.n_items&&d.n_curated/d.n_items<0.1){const note=document.createElement('p');note.className='i-data-note';note.textContent=d.n_curated===0?'本期没有人工策展，以下全部是原料池搬运；自动摘要不代表人工判断。':'本期人工策展不足10%，其余为原料池搬运，卡片已分别标注。';host.append(note);}
 if(d.sources&&d.sources.length){const details=document.createElement('details');details.className='i-source-health';const summary=document.createElement('summary');summary.textContent='本次来源状态：'+d.sources.filter(x=>x.ok).length+'/'+d.sources.length+' 可用（展开查看）';details.append(summary);for(const source of d.sources){const row=document.createElement('p');row.textContent=(source.name||source.id)+' · '+(source.ok?'可用 · '+source.n+'条':('未纳入 · '+(source.err||'未获取')));details.append(row);}host.append(details);}
}

let nRefreshError="";
function renderNews(){
  const box = document.getElementById("nBrief");
  if(!box) return;
  const d = NEWS;
  nSourceNote(d);
  if(!d){
    for(const id of ["nTop","nBody","nCount","nNote","nStale"])document.getElementById(id).textContent="";
    box.innerHTML = `<div class="nwempty">还没有新闻数据：点右上「更新新闻」抓一次原料池</div>`;
    return;
  }
  const w = d.window || {};
  const flowW = w.flow || ["",""];
  const drop = d.n_drop || {};
  document.getElementById("nNote").innerHTML =
    `${d.n_items||0} 条 · 头条 ${d.n_top||0} 条 · 未策展 ${d.n_auto||0} 条`
    + ` · 窗口 近 ${w.days||7} 天 ${String(flowW[0]).slice(5,10)} ~ ${String(flowW[1]).slice(5,10)}`
    + ` · 原料池 ${(d.raw&&d.raw.n_pool)||0} 条，过期 ${(drop.curated||0)+(drop.raw||0)} / 超额 ${drop.capped||0} 未上屏`;
  box.innerHTML = (d.brief && (d.brief.items||[]).length) ? nBriefHTML(d)
    : `<div class="nwb-item"><div class="nwb-n">—</div><div>
         <div class="nwb-h">本期没有手写导语</div>
         <div class="nwb-t">导语只保留 48 小时——它写的是「当天的判断」，挂到几天后就是误导。
           下面全部来自原料池，判断那句「为什么」要人写，程序拼不出来，所以宁可不写。</div></div></div>`;

  const tops = (d.items||[]).filter(x=>x.place==="top")
    .sort((a,b)=>(a.rank||99)-(b.rank||99));
  document.getElementById("nTop").innerHTML =
    tops.map(it=>nCard(it, it.rank)).join("");

  const html = (d.buckets||[]).map(b=>{
    const its = (d.items||[]).filter(x=>x.place===b.id)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const head = `<div class="nwcat-h"><h3>${wEsc(b.name)}</h3>
      <span class="d">${wEsc(b.desc||"")}${b.rule?" <b>"+wEsc(b.rule)+"</b>":""}</span>
      <span class="ct">${its.length} 条</span></div>`;
    if(!its.length){
      return `<section class="nwcat">${head}<div class="nwempty">窗口内无重大事项——不凑数</div></section>`;
    }
    return `<section class="nwcat">${head}<div class="nwgrid">${
      its.map(it=>nCard(it,null)).join("")}</div></section>`;
  }).join("");
  document.getElementById("nBody").innerHTML = html;
  document.getElementById("nCount").textContent =
    `${(d.n_items||0)-(d.n_top||0)} 条 · ${(d.buckets||[]).length} 个桶 · 同一事件只出现一次 · 标「未策展」的没有人写过判断`;
  nShowStale();
}
function nShowStale(){
  const box = document.getElementById("nStale");
  if(!box) return;
  if(nRefreshError){box.innerHTML=`<div class="nwstale"><span>更新失败：${wEsc(nRefreshError)}。原数据保留。</span></div>`;return;}
  const h = nAgeH(NEWS||{});
  if(h==null || h <= 12){ box.innerHTML = ""; return; }
  const days = (NEWS.window && NEWS.window.days) || 7;
  box.innerHTML = `<div class="nwstale"><span><b>页面最新一条是 ${h.toFixed(1)} 小时前</b>：
    窗口按最近 ${days} 天滚动，过期的会自动掉出去。点右上「更新新闻」重抓原料池。</span><span class="x">×</span></div>`;
}
async function nRefresh(){
  const btn = document.getElementById("nRefBtn");
  const txt = document.getElementById("nRefTxt");
  if(btn.disabled) return;
  nRefreshError="";btn.disabled = true; txt.textContent = "抓取中…";
  const t0 = Date.now();
  try{
    if(location.protocol==="file:") throw new Error(FILE_ONLY);
    const r = await fetch("/api/news/refresh", {method:"POST"});
    const j = await r.json();
    if(!j.ok) throw new Error(j.error || "更新失败");
    NEWS = iSanitize(j.news);
    renderNews();
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const now = new Date().toLocaleTimeString("zh-CN", {hour12:false});
    const f = j.fetched || j.news || {}, drop = f.n_drop || {};
    document.getElementById("nNote").innerHTML +=
      ` · 已重抓 ${now}（${secs}s）：上屏 ${f.n_items||0} 条（未策展 ${f.n_auto||0}），`
      + `过期丢弃 ${(drop.curated||0)+(drop.raw||0)} 条、超额 ${drop.capped||0} 条`
      + `${j.built ? "，最新数据已保存" : "，快照保存失败"}`;
    if(f.newest) document.getElementById("nStale").innerHTML =
      `<div class="nwstale"><span>原料池最新一条 <b>${wEsc(nTime(f.newest))}</b>。
        窗口从 ${f.days||7} 天前算起，早于这个时间的一律不上屏。</span><span class="x">×</span></div>`;
  }catch(e){
    nRefreshError=e.message||String(e);
    document.getElementById("nStale").innerHTML =
      `<div class="nwstale" style="background:#fdf3f2;border-color:#eccdc9;border-left-color:#c0392b">
         <span><b>更新失败</b>：${wEsc(e.message || String(e))}</span><span class="x">×</span></div>`;
  }finally{
    btn.disabled = false; txt.textContent = "更新新闻";
  }
}
document.getElementById("nRefBtn").addEventListener("click", nRefresh);
document.getElementById("nStale").addEventListener("click", e=>{
  if(e.target.classList.contains("x")) document.getElementById("nStale").innerHTML = "";
});


/* ================= 页九：机构研报 ================= */
let rQ = "", rInst = "all", rTopic = "all";
const RTAG = {bull:"偏多", neutral:"中性", bear:"偏空"};

function rEsc(s){
  return String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}
function rInstOf(D, id){
  return D.insts.find(x=>x.id===id) || {cn:id, en:"", focus:""};
}
function rTopicShort(t){ return (t.name||"").split(" · ")[0]; }

/* 筛选：机构 × 主题 × 关键词。三者的交集就是屏幕上能看到的卡片。 */
function rFiltered(){
  const D = RPT; if(!D) return [];
  const q = rQ.trim().toLowerCase();
  return D.reports.filter(r=>{
    if(rInst!=="all" && r.inst!==rInst) return false;
    if(rTopic!=="all" && r.topic!==rTopic) return false;
    if(q){
      const im = rInstOf(D, r.inst);
      const hay = [r.title, r.thesis, r.scope, r.call, (r.pts||[]).join(" "), im.cn, im.en].join(" ").toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
}

/* 覆盖矩阵：行是机构（按类型分组），列是五个主题，格子里是稿子数。
   空格子留着不隐藏——「谁没覆盖哪个主题」本身是信息。 */
function renderRMatrix(){
  const D = RPT, el = document.getElementById("rMatrix");
  if(!D || !el) return;
  const cell = {};
  D.reports.forEach(r=>{
    const k = r.inst+"|"+r.topic;
    (cell[k] = cell[k] || []).push(r);
  });
  let h = '<div class="rmx-h"><div class="c0">机构</div>'
        + D.topics.map(t=>`<div>${rEsc(rTopicShort(t))}</div>`).join("")
        + '<div>覆盖</div></div>';
  D.groups.forEach(g=>{
    h += `<div class="rmx-g"><b>${rEsc(g.name)}</b><i>${g.insts.length} 家`
       + `${g.kinds?" · "+rEsc(g.kinds):""}</i></div>`;
    g.insts.forEach(i=>{
      h += `<div class="rmx-r"><button class="nm${rInst===i.id?" sel":""}" data-inst="${i.id}"`
         + ` title="${rEsc(i.cn)} · ${rEsc(i.en)}｜${rEsc(i.focus||"")}">`
         + `<b>${rEsc(i.cn)}</b><i>${rEsc(i.en)}</i></button>`;
      D.topics.forEach(t=>{
        const list = cell[i.id+"|"+t.id] || [];
        if(!list.length){
          h += '<div class="rmx-c" title="本期无稿">·</div>';
          return;
        }
        const latest = list[0];
        const on = (rInst===i.id && rTopic===t.id) ? " on" : "";
        h += `<button class="rmx-c${on}" data-tag="${latest.tag}" data-inst="${i.id}" data-topic="${t.id}"`
           + ` title="${rEsc(list.map(x=>x.title).join(" ／ "))}">${list.length>1?list.length:"●"}</button>`;
      });
      h += `<div class="cv">${i.topics.length}/${D.n_topic}</div></div>`;
    });
  });
  el.innerHTML = h;
}

function rCard(r, D){
  const im = rInstOf(D, r.inst);
  return `<article class="rcard" data-tag="${r.tag}" id="rpt-${r.id}">
    <div class="rtop"><span class="inst"><b>${rEsc(im.cn)}</b><i>${rEsc(im.en)}</i></span><span class="scope">${rEsc(r.scope)}</span>
      <span class="dt">${rEsc(r.date.slice(5))}</span></div>
    <h4>${rEsc(r.title)}</h4>
    <p class="th">${rEsc(r.thesis)}</p>
    <ul class="pts">${(r.pts||[]).map(p=>`<li>${rEsc(p)}</li>`).join("")}</ul>
    <div class="rfoot"><span class="call">${rEsc(r.call)}</span>
      <span class="tg" data-tag="${r.tag}">${RTAG[r.tag]||""}</span></div>
    <div class="rsrc">${rEsc(r.src)}</div>
  </article>`;
}

function renderRBody(){
  const D = RPT, el = document.getElementById("rBody");
  if(!D || !el) return;
  const list = rFiltered();
  const byTopic = {};
  list.forEach(r=>{ (byTopic[r.topic] = byTopic[r.topic]||[]).push(r); });

  let h = "";
  D.topics.forEach(t=>{
    const rs = byTopic[t.id] || [];
    if(!rs.length) return;
    h += `<section class="rcat" data-topic="${t.id}" id="rc-${t.id}">`
       + `<div class="rcat-h"><h3>${rEsc(t.name)}</h3><span class="d">${rEsc(t.desc)}</span>`
       + `<span class="ct">${rs.length} 篇 · ${new Set(rs.map(r=>r.inst)).size} 家</span></div>`
       + `<div class="rnote">${rEsc(t.note||"")}</div><div class="rgrid">`
       + rs.map(r=>rCard(r, D)).join("")
       + `</div></section>`;
  });
  if(!h) h = '<div class="rempty">当前筛选下没有报告。<b>点「看全部」</b>恢复全量。</div>';
  el.innerHTML = h;
}

function renderRNav(){
  const D = RPT, el = document.getElementById("rNav");
  if(!D || !el) return;
  let h = `<button data-topic="all"${rTopic==="all"?" class=\"on\"":""}>全部<em>${D.n_report}</em></button>`;
  D.topics.forEach(t=>{
    const n = t.reports ? t.reports.length : 0;
    h += `<button data-topic="${t.id}"${rTopic===t.id?" class=\"on\"":""}>${rEsc(rTopicShort(t))}<em>${n}</em></button>`;
  });
  el.innerHTML = h;
}

function renderRState(){
  const D = RPT; if(!D) return;
  const list = rFiltered();
  const nInst = new Set(list.map(r=>r.inst)).size;
  document.getElementById("rCount").textContent =
    `显示 ${list.length} / ${D.n_report} 篇，${nInst} 家机构`;

  const box = document.getElementById("rState");
  if(rInst==="all" && rTopic==="all"){ box.style.display="none"; box.innerHTML=""; return; }
  const im = D.insts.find(x=>x.id===rInst);
  const tp = D.topics.find(x=>x.id===rTopic);
  box.style.display = "flex";
  box.innerHTML = `正在看：<b>${im?rEsc(im.cn):"全部机构"}</b> × <b>${tp?rEsc(rTopicShort(tp)):"全部主题"}</b>`
                + `<span class="x" id="rStateX">清除</span>`;
}

function renderResearch(){
  const D = RPT;
  if(!D) return;
  document.getElementById("rInstN").textContent = D.n_inst;
  document.getElementById("rRptN").textContent = D.n_report;
  document.getElementById("rWin").textContent = (D.window||[]).join(" ~ ");
  document.getElementById("rSt").textContent =
    `${D.n_cell} 个格子有稿 · 共 ${D.n_inst*D.n_topic} 格`;
  renderRMatrix();
  renderRNav();
  renderRBody();
  renderRState();
}

function rJump(topic){
  const sel = topic ? "#rc-"+topic : "#rBody";
  const el = document.querySelector(sel);
  if(!el) return;
  el.scrollIntoView({behavior:"smooth", block:"start"});
  if(topic){
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    setTimeout(()=>el.classList.remove("flash"), 1700);
  }
}

/* 事件绑定不放进 if(RPT)：数据可能在本页第一次「刷新研报」后才到位，
   绑一次就一直有效，比每次刷新重新绑更省心。 */
{
  document.getElementById("rMatrix").addEventListener("click", e=>{
    const cell = e.target.closest(".rmx-c[data-tag]");
    if(cell){
      rInst = cell.dataset.inst;
      rTopic = cell.dataset.topic;
      renderRMatrix(); renderRBody(); renderRState();
      rJump(rTopic);
      return;
    }
    const nm = e.target.closest(".nm");
    if(nm){
      rInst = (rInst===nm.dataset.inst) ? "all" : nm.dataset.inst;
      rTopic = "all";
      renderRMatrix(); renderRBody(); renderRState();
      rJump("");
    }
  });

  document.getElementById("rNav").addEventListener("click", e=>{
    const b = e.target.closest("button[data-topic]");
    if(!b) return;
    rTopic = b.dataset.topic;
    renderRMatrix(); renderRNav(); renderRBody(); renderRState();
    rJump(rTopic==="all" ? "" : rTopic);
  });

  document.getElementById("rQ").addEventListener("input", e=>{
    rQ = e.target.value;
    renderRBody(); renderRState();
  });

  document.getElementById("rReset").addEventListener("click", ()=>{
    rQ = ""; rInst = "all"; rTopic = "all";
    document.getElementById("rQ").value = "";
    renderRMatrix(); renderRBody(); renderRState();
  });

  document.getElementById("rState").addEventListener("click", e=>{
    if(e.target.id!=="rStateX") return;
    rInst = "all"; rTopic = "all";
    renderRMatrix(); renderRBody(); renderRState();
  });
}

const rRefBtn=document.getElementById("rRefBtn"), rRefTxt=document.getElementById("rRefTxt");
const rRefSt=document.getElementById("rRefSt");
async function doResearchRefresh(){
  if(location.protocol==="file:"){ rRefSt.textContent=FILE_ONLY; return; }
  rRefBtn.disabled=true; rRefBtn.classList.add("busy");
  rRefTxt.textContent="重读中…"; rRefSt.textContent="";
  try{
    const j=await postJSON("/api/research/refresh");
    RPT=iSanitize(j.research);
    renderResearch();
    rRefSt.textContent="✅ 已重读 "+j.research.n_report+" 篇（"+j.elapsed+"s）";
    rRefSt.title = "数据快照 "+(j.research.as_of||"—")+"，重读于 "+j.updated;
  }catch(e){
    const msg=(e&&e.message?e.message:String(e));
    rRefSt.textContent="❌ "+msg.slice(0,32)+(msg.length>32?"…":"");
    rRefSt.title=msg;   // 校验错误可能很长，完整原文放 title，不撑破状态条
  }finally{
    rRefTxt.textContent="刷新研报"; rRefBtn.disabled=false; rRefBtn.classList.remove("busy");
  }
}
rRefBtn.addEventListener("click", doResearchRefresh);

let hGroup = "all", hQuery = "", hSel = null, hBusy = false;

const HGRP = [
  {id: "all", name: "全部"},
  {id: "value", name: "价值与质量"},
  {id: "active", name: "主动与特殊机会"},
  {id: "growth", name: "成长与科技"},
  {id: "macro", name: "宏观与多策略"},
  {id: "quant", name: "量化与系统化"},
];

function hEsc(s){
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}
function hQtr(p){
  if(!p || p.length < 7) return "—";
  const y = p.slice(0,4), m = +p.slice(5,7);
  return y + " Q" + Math.ceil(m/3);
}
function hUSD(v){
  if(v == null) return "—";
  const y = v / 1e8;
  if(y >= 1000) return Math.round(y).toLocaleString("en-US") + " 亿";
  if(y >= 100)  return y.toFixed(0) + " 亿";
  if(y >= 10)   return y.toFixed(1) + " 亿";
  if(y >= 1)    return y.toFixed(2) + " 亿";
  return (v / 1e4).toFixed(0) + " 万";
}
function hNum(n){
  if(n == null) return "—";
  return Number(n).toLocaleString("en-US");
}
function hInstOf(id){
  return ((HLD && HLD.insts) || []).find(x => x.id === id) || null;
}
function hBadge(r){
  if(r.status === "error")  return '<span class="b b-err">核对失败</span>';
  if(r.carried)             return '<span class="b b-err">沿用上次</span>';
  if(r.stale)               return '<span class="b b-stale">历史申报</span>';
  if(r.amended)             return '<span class="b b-amend">修正申报</span>';
  if(r.proxied_by)          return '<span class="b b-proxy">代报</span>';
  return "";
}
function hSearchHit(r, q){
  if(!q) return true;
  const hay = [r.name, r.person, r.en, r.filer, r.cik, hQtr(r.period)]
    .filter(Boolean).join(" ").toLowerCase();
  return hay.indexOf(q.toLowerCase()) >= 0;
}

/* ---------------- 卡片 ---------------- */
function hCardHTML(r){
  if(r.status === "error"){
    return `<div class="hc err">
      <div class="hc-t"><span class="nm">${hEsc(r.name)}</span><span class="q">无数据</span></div>
      <div class="fil">${hEsc(r.filer || "")}</div>
      <div class="hc-m" style="color:#a32d2d">核对失败：${hEsc((r.error || "").slice(0,40))}</div>
      <div class="hc-f">CIK ${hEsc(r.proxied_by ? r.proxied_by.cik : r.cik)}${hBadge(r)}</div>
    </div>`;
  }
  const H = (r.holdings || []).slice(0, 3);
  const top = H.length ? H[0].value : 1;
  return `<button class="hc${hSel === r.id ? " on" : ""}" data-id="${hEsc(r.id)}">
    <div class="hc-t">
      <span class="nm">${hEsc(r.name)}</span>
      <span class="q">${hQtr(r.period)}</span>
    </div>
    <div class="fil">${hEsc(r.filer || "")}</div>
    <div class="hc-m">
      <span><b>${hNum(r.n_sec)}</b> 只证券</span>
      <span><b>${hUSD(r.value)}</b>美元</span>
    </div>
    <ol class="hc-h">${H.map((h, i) => `<li><i>${i+1}</i><span>${hEsc(h.issuer)}</span><em>${h.pct == null ? "—" : h.pct.toFixed(1) + "%"}</em></li>`).join("")}</ol>
    <div class="hc-f">CIK ${hEsc(r.proxied_by ? r.proxied_by.cik : r.cik)}${hBadge(r)}</div>
  </button>`;
}

/* ---------------- 详情 ---------------- */
function hDetHTML(r){
  if(!r){
    return `<div class="empty">从左边选一家机构<br><span style="font-size:11px">这里会显示它的申报明细</span></div>`;
  }
  if(r.status === "error"){
    return `<div class="dt"><div><div class="nm">${hEsc(r.name)}</div>
        <div class="fil">${hEsc(r.filer || "")} · CIK ${hEsc(r.cik)}</div></div>
        <button class="x" id="hDetX">&times;</button></div>
      <div class="hflag">本次核对失败，也没有可用的上一次快照：<br>${hEsc(r.error || "")}<br>
        页面不会用估算数字填补这里。</div>`;
  }

  const flags = [];
  if(r.carried) flags.push(['grey', `本次核对失败（${hEsc(((r.keep_error || r.error) || "").slice(0,60))}），下面显示的是上一次成功快照：${hQtr(r.carried_period)}。`]);
  if(r.stale) flags.push(['', `${hEsc(r.stale_reason || "历史申报")}。这不是当前仓位，也不能据此推断它现在在看多还是看空。`]);
  if(r.proxied_by) flags.push(['grey', `${hEsc(r.note || "")} 申报主体：${hEsc(r.proxied_by.name)}（CIK ${hEsc(r.proxied_by.cik)}）。`]);
  if(r.amended) flags.push(['blue', `这是修正申报（${hEsc(r.amend_type || "AMENDMENT")}），会整体替换同一报告期的原申报；原申报的数字不应再被引用。`]);
  if(r.unit_note) flags.push(['grey', `${hEsc(r.unit_note)}。`]);

  const optNote = r.n_opt > 0
    ? `<div class="dnote">本申报含 <b>${hNum(r.n_opt)}</b> 项期权（PUT/CALL），已单列、不进入下面的列表。
        但占比分母用的是申报表总值，<b>包含期权</b>，所以这里的占比不是纯股票多头权重。</div>`
    : "";

  const H = (r.holdings || []).slice(0, 12);
  const top = H.length ? (H[0].pct || 1) : 1;

  return `<div class="dt">
      <div>
        <div class="nm">${hEsc(r.name)}</div>
        <div class="fil">申报主体 ${hEsc(r.proxied_by ? r.proxied_by.name : (r.filer || "—"))} · CIK ${hEsc(r.proxied_by ? r.proxied_by.cik : r.cik)}${r.person ? " · " + hEsc(r.person) : ""}</div>
      </div>
      <button class="x" id="hDetX" title="关闭">&times;</button>
    </div>
    ${r.about ? `<div class="about">${hEsc(r.about)}</div>` : ""}
    <div class="hst">
      <div><div class="k">报告期末</div><div class="v">${hEsc(r.period || "—")}<small>${hQtr(r.period)}</small></div></div>
      <div><div class="k">实际提交日</div><div class="v">${hEsc(r.filed || "—")}</div></div>
      <div><div class="k">申报项数</div><div class="v">${hNum(r.rows)}<small>行</small></div></div>
      <div><div class="k">期权项数</div><div class="v">${hNum(r.n_opt)}<small>项</small></div></div>
      <div><div class="k">非期权证券</div><div class="v">${hNum(r.n_sec)}<small>只</small></div></div>
      <div><div class="k">申报表总值</div><div class="v">${hUSD(r.value)}<small>美元</small></div></div>
    </div>
    ${flags.map(([cls, txt]) => `<div class="hflag ${cls}">${txt}</div>`).join("")}
    ${hDiffHTML(r)}
    <div class="hgrp"><span>市值最高的 ${H.length} 项非期权证券</span><i>占比 / 申报总值</i></div>
    <ol>${H.map(h => `<li>
        <div class="l1"><span class="iss">${hEsc(h.issuer)}</span>
          <span class="pc">${h.pct == null ? "—" : h.pct.toFixed(2) + "%"}</span></div>
        <div class="l2">
          <span class="cls">${hEsc(h.cls || "—")}</span>
          <span>CUSIP ${hEsc(h.cusip || "—")}</span>
          <span>${hNum(h.shares)} ${hEsc(h.sh_type || "股")}</span>
          <span>${hUSD(h.value)}</span>
        </div>
        <div class="bar"><i style="width:${Math.min(100, (h.pct || 0) / top * 100)}%"></i></div>
      </li>`).join("")}</ol>
    ${optNote}
    <div class="lks">
      <a href="${hEsc(iSafeURL(r.url_index))}" target="_blank" rel="noopener">SEC 原件 &nearr;</a>
      <a href="https://13f.info/13f/${hEsc((r.accession || "").replace(/-/g, ""))}" target="_blank" rel="noopener">13f.info 转录 &nearr;</a>
      <a href="https://13f.info/manager/${hEsc(r.cik)}" target="_blank" rel="noopener">该机构全部申报 &nearr;</a>
    </div>`;
}

/* ---------------- 与上一期相比 ---------------- */
/* 口径（写在页面上，不只写在代码里）：
   1) 增减按「持股数量」判，不按市值——13F 的市值是季末价 × 股数，
      价格涨跌会凭空造出「增持」。
   2) 权重变动用两期各自的申报表总值做分母，所以是「组合里的占比挪了多少」。
   3) 期权不进对比，和详情列表口径一致。
   4) 上期不是相邻季度时必须写明跨了几个季度。 */
const HCHG_LABEL = {new: "新进", up: "增持", down: "减持", exit: "退出"};

function hPP(v){
  if(v == null) return "—";
  if(Math.abs(v) < 0.005) return "0.00pp";
  const s = v > 0 ? "+" : (v < 0 ? "−" : "±");
  return s + Math.abs(v).toFixed(2) + "pp";
}
function hSPct(v){
  if(v == null) return "—";
  const s = v > 0 ? "+" : (v < 0 ? "−" : "±");
  return s + Math.abs(v).toFixed(1) + "%";
}
/* 股数按「股 / 万股 / 亿股」印。用在小仓建仓那一条：上期 148 股、本期 695 万股，
   百分比是 +470 万%，数字对但没人读得懂，直接给两期股数。 */
function hSh(v){
  if(v == null) return "—";
  const n = Math.abs(v);
  if(n >= 1e8) return (v / 1e8).toFixed(2) + " 亿股";
  if(n >= 1e4) return (v / 1e4).toFixed(1) + " 万股";
  return Math.round(v).toLocaleString("en-US") + " 股";
}
function hDiffHTML(r){
  const c = r && r.chg;
  if(!c){
    return `<div class="hdiff none"><b>与上一期相比</b> 这份快照是旧版本抓的，没有两期对比数据；
      点右上「更新持仓」重新核对一次就会生成。</div>`;
  }
  if(!c.ok){
    return `<div class="hdiff none"><b>与上一期相比</b> ${hEsc(c.note || "拿不到可比的上一期")}</div>`;
  }
  /* 两期申报表总值差 4 倍以上：不是同一个组合（新设主体 / 代报主体切换 / 申报口径变化）。
     这种时候逐项增减算出来一定很戏剧，但那是换了个簿子，不是调仓。 */
  if(c.comparable === false){
    const a = c.prev_value, b = c.cur_value;
    const times = (a && b) ? (Math.max(a, b) / Math.max(1, Math.min(a, b))).toFixed(1) : "—";
    return `<div class="hdiff">
      <div class="hd-h"><b>与上一期相比</b><span>${hQtr(c.prev_period)} → ${hQtr(c.cur_period)}</span></div>
      <div class="hd-n" style="color:#8a4f12">上期申报表总值 ${hUSD(a)} 美元、本期 ${hUSD(b)} 美元，
        相差 ${times} 倍——这不是同一个组合（新设主体、代报主体切换、申报口径变化都有可能），
        逐项增减算出来是假动作，这里不给。
        <br>上期 ${hNum(c.prev_n_sec)} 只证券，本期 ${hNum(r.n_sec)} 只。</div>
    </div>`;
  }
  const chips = [["k-nw","新进",c.n_new], ["k-up","增持",c.n_up], ["k-dn","减持",c.n_down],
                 ["k-ex","退出",c.n_exit], ["","未动",c.n_flat]]
    .map(([cls, lbl, v]) => `<span class="${cls}">${lbl}<b>${v}</b></span>`).join("");

  const mov = c.mov || [];
  const rows = mov.map(m => {
    const bits = [];
    if(m.cls) bits.push(hEsc(m.cls));
    if(m.kind === "up" || m.kind === "down"){
      /* 上期是几百股的尘埃仓位、本期建成正经仓位时，百分比会到几百万，印出来等于没信息。
         超过 10 倍（+900%）就换成两期股数绝对值。 */
      if(m.sh_prev != null && m.sh_now != null && Math.abs(m.sh_pct || 0) > 900)
        bits.push("股数 " + hSh(m.sh_prev) + " → " + hSh(m.sh_now));
      else
        bits.push("股数 " + hSPct(m.sh_pct));
    }
    if(m.pct_prev != null && m.pct_now != null)
      bits.push("权重 " + m.pct_prev.toFixed(2) + "% → " + m.pct_now.toFixed(2) + "%");
    if(m.sp) bits.push("疑拆股");
    return `<li>
      <div class="l1"><span class="tg" data-k="${m.kind}">${HCHG_LABEL[m.kind] || m.kind}</span>
        <span class="is">${hEsc(m.issuer)}</span>
        <span class="dp ${(m.d_pct || 0) >= 0 ? "p-up" : "p-dn"}">${hPP(m.d_pct)}</span></div>
      <div class="l2">${bits.join(" · ")}</div>
    </li>`;
  }).join("");

  const notes = [];
  notes.push(`新进合计 <b>${hPP(c.new_pp)}</b>，退出合计 <b>${hPP(c.exit_pp)}</b>（占总值的比例）。`);
  notes.push(`增持/减持按持股数量判，不按市值；权重用两期各自的申报表总值做分母，价格涨跌本身也会挪权重。`);
  if((c.mov || []).some(m => m.sh_prev != null && m.sh_now != null && Math.abs(m.sh_pct || 0) > 900))
    notes.push(`上期只有几百股的，本期建到满仓，股数变动按倍数印没有意义，所以那几条直接印「上期 → 本期」股数。`);
  if(c.n_split) notes.push(`其中 <b>${c.n_split}</b> 项股数成整倍变化而权重几乎没动，标了「疑拆股」——判定仍按申报股数。`);
  if(c.n_opt_cur || c.n_opt_prev)
    notes.push(`期权不进对比（本期 ${c.n_opt_cur || 0} 项 / 上期 ${c.n_opt_prev || 0} 项）。`);
  if(c.n_mov > mov.length)
    notes.push(`共 <b>${c.n_mov}</b> 项有动作，这里按权重变动列前 ${mov.length} 项。`);
  if(c.prev_amended) notes.push(`上一期用的是修正申报（${hEsc(c.prev_amend_type || "AMENDMENT")}）。`);
  if(c.note) notes.push(hEsc(c.note));

  const gap = (c.gap_q || 1) > 1
    ? `<div class="hd-n" style="color:#8a4f12">上期不是紧邻的季度：中间缺 ${c.gap_q - 1} 个季度，
       这里的变动是跨 ${c.gap_q} 个季度的累积，不是单季动作。</div>`
    : "";

  return `<div class="hdiff">
    <div class="hd-h"><b>与上一期相比</b><span>${hQtr(c.prev_period)} → ${hQtr(c.cur_period)}</span></div>
    <div class="hd-k">${chips}</div>
    ${gap}
    <ul class="hd-l">${rows || `<li style="color:#8a4f12;font-size:10.5px">两期持仓完全一致，没有任何增减。</li>`}</ul>
    <div class="hd-n">${notes.join("<br>")}</div>
  </div>`;
}

/* ---------------- 季度变化 ---------------- */
/* 这一块不重复详情里的逐项增减，只回答两件事：
   ① 谁有可比的上期、按哪两期比；② 每家自己最大的一次调整排在一起，谁最坚决。 */
function hChangeHTML(){
  const rows = ((HLD && HLD.insts) || []).filter(r => r.status !== "error");
  const ok = rows.filter(r => r.chg && r.chg.ok && r.chg.comparable !== false && (r.chg.mov || []).length);
  const nocomp = rows.filter(r => r.chg && r.chg.ok && r.chg.comparable === false);
  const skip = rows.filter(r => !(r.chg && r.chg.ok));
  if(!ok.length){
    return `<b>还没有两期可比的完整申报。</b>
      点右上「更新持仓」会同时把每家上一期也抓下来；抓完这里才有内容。
      缺上期的原因会逐家写在卡片详情里，不拿别的季度凑数。`;
  }

  const pair = {};
  ok.forEach(r => {
    const k = hQtr(r.chg.prev_period) + " → " + hQtr(r.chg.cur_period);
    pair[k] = (pair[k] || 0) + 1;
  });
  const chips = Object.keys(pair).sort().reverse()
    .map(k => `<span>${k}<em> ${pair[k]} 家</em></span>`).join("");

  /* 每家只取「它自己最大的一次权重变动」，再横向排。
     不同规模的组合，只有相对自己的占比才可比；直接比金额会变成比谁盘子大。 */
  const top = ok.map(r => ({r: r, m: (r.chg.mov || [])[0]}))
    .filter(x => x.m && Math.abs(x.m.d_pct || 0) > 0)
    .sort((a, b) => Math.abs(b.m.d_pct) - Math.abs(a.m.d_pct))
    .slice(0, 6);

  const lis = top.map(x => `<li>
      <span class="nm">${hEsc(x.r.name)}</span>
      <span class="tg" data-k="${x.m.kind}">${HCHG_LABEL[x.m.kind] || x.m.kind}</span>
      <span class="is">${hEsc(x.m.issuer)}</span>
      <span class="dp ${(x.m.d_pct || 0) >= 0 ? "p-up" : "p-dn"}">${hPP(x.m.d_pct)}</span>
    </li>`).join("");

  const skipNote = (() => {
    const bits = [];
    if(nocomp.length) bits.push(nocomp.map(r => {
      const a = r.chg.prev_value || 0, b = r.chg.cur_value || r.value || 0;
      const t = (a && b) ? (Math.max(a, b) / Math.max(1, Math.min(a, b))).toFixed(1) : "—";
      return `${hEsc(r.name)}（两期总值差 ${t} 倍，不是同一个组合）`;
    }).join("；"));
    if(skip.length) bits.push(skip.slice(0, 3).map(r =>
      `${hEsc(r.name)}（${hEsc((r.chg && r.chg.note) || "无上期")}）`).join("；") +
      (skip.length > 3 ? " 等" : ""));
    return bits.length ? "未计入：" + bits.join("；") + "。原因也写在各自详情里。" : "";
  })();

  return `<b>${ok.length} 家有可比的上期${nocomp.length + skip.length ? `，另 ${nocomp.length + skip.length} 家没算（原因见下）` : ""}。</b>
    点开任一张卡片，详情里就是这一家的逐项增减：新进 / 增持 / 减持 / 退出、动了多少股、权重挪了几个点。
    下面先把各家「自己最大的一次调整」排在一起。
    <div class="hqdist">${chips}</div>
    <ul class="hchg-l">${lis}</ul>
    <div class="hchg-n">${skipNote}</div>`;
}

/* ---------------- 目录 ---------------- */
function hRenderDir(){
  const list = ((HLD && HLD.insts) || []).filter(r =>
    (hGroup === "all" || r.group === hGroup) && hSearchHit(r, hQuery));
  const el = document.getElementById("hDir");
  el.innerHTML = list.length
    ? list.map(hCardHTML).join("")
    : `<div class="hempty">没有匹配的机构。清掉搜索词或切回「全部」。</div>`;
  document.getElementById("hRes").textContent = `${list.length} / ${(HLD.insts || []).length} 家`;
  document.getElementById("hCnt").textContent =
    `${(HLD.insts || []).length} 家机构 · 点卡片看申报明细，目录不会消失`;
  el.querySelectorAll(".hc[data-id]").forEach(b => {
    b.addEventListener("click", () => {
      hSel = b.dataset.id;
      hRenderDir();
      hRenderDet();
      document.getElementById("hDet").classList.add("on");
      if(window.matchMedia("(max-width:980px)").matches){
        window.scrollTo({top: document.getElementById("hDet").offsetTop, behavior: "smooth"});
      }
    });
  });
}

function hRenderDet(){
  const el = document.getElementById("hDet");
  el.innerHTML = hDetHTML(hInstOf(hSel));
  const x = document.getElementById("hDetX");
  if(x) x.addEventListener("click", () => { el.classList.remove("on"); });
}

function hRenderTabs(){
  const el = document.getElementById("hTabs");
  el.innerHTML = HGRP.map(g => {
    const n = g.id === "all"
      ? (HLD.insts || []).length
      : (HLD.insts || []).filter(r => r.group === g.id).length;
    return `<button data-g="${g.id}" class="${hGroup === g.id ? "on" : ""}">${g.name}<em>${n}</em></button>`;
  }).join("");
  el.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => { hGroup = b.dataset.g; hRenderTabs(); hRenderDir(); });
  });
}

/* ---------------- 主渲染 ---------------- */
function renderHoldings(){
  if(!HLD){ return; }
  document.getElementById("hInstN").textContent = HLD.n_inst || (HLD.insts || []).length;
  document.getElementById("hOkN").textContent = HLD.n_ok != null ? HLD.n_ok : (HLD.insts || []).filter(r => r.status !== "error").length;
  /* 这里显示「家数最多的那个季度」，不是「最新季度」。
     本期有 27 家在 2026 Q2、1 家在 2026 Q3、2 家更早，取最新会变成「2026-09-30」，
     读者会以为三十家都交了 Q3——这类静默误导比缺一个数字更糟。 */
  const qbox = {};
  (HLD.insts || []).forEach(r => {
    if(r.status === "error" || !r.period) return;
    const q = hQtr(r.period);
    qbox[q] = (qbox[q] || 0) + 1;
  });
  const qkeys = Object.keys(qbox).sort((a, b) => qbox[b] - qbox[a]);
  const mainQ = qkeys[0];
  document.getElementById("hPer").textContent = mainQ
    ? mainQ + "（" + qbox[mainQ] + " 家）" + (qkeys.length > 1 ? " · 另有 " + (qkeys.length - 1) + " 个季度" : "")
    : "—";
  document.getElementById("hAs").textContent = "快照 " + (HLD.as_of || "—");
  document.getElementById("hChange").innerHTML = hChangeHTML();
  hRenderTabs();
  hRenderDir();
  hRenderDet();
}

/* ---------------- 更新 ---------------- */
function hApply(snap){
  snap=iSanitize(snap);
  const prev = {};
  ((HLD && HLD.insts) || []).forEach(r => { if(r.status !== "error" && r.holdings && r.holdings.length) prev[r.id] = r; });
  let carried = (snap.insts || []).filter(r=>r.carried||r.status==="carried").length;
  (snap.insts || []).forEach(r => {
    if(r.status !== "error") return;
    const o = prev[r.id];
    if(!o) return;
    ["holdings","period","filed","value","n_sec","n_opt","rows","form","amended",
     "amend_type","proxied_by","note","url_index","accession","stale","stale_reason","chg"]
      .forEach(k => { if(o[k] !== undefined) r[k] = o[k]; });
    r.status = "carried";          /* 不是 error：有数据可显示，只是不是本次拿到的 */
    r.carried = true;
    r.carried_period = o.period;
    r.keep_error = r.error;        /* 原始失败原因留着，详情里要写出来 */
    carried++;
  });
  snap.n_error = (snap.insts || []).filter(r => r.status === "error").length;
  snap.n_carried = carried;
  snap.n_ok = (snap.insts || []).filter(r => r.status === "ok").length;
  hSel = hSel || ((snap.insts || [])[0] || {}).id || null;
  HLD = snap;
  try{ localStorage.setItem("hld_snap_v1", JSON.stringify(snap)); }catch(e){}
  const st = document.getElementById("hUpdSt");
  const tx = document.getElementById("hUpdTx");
  tx.textContent = "更新持仓";
  const total = (snap.insts || []).length;
  if(snap.n_ok === 0 && carried === 0){
    st.textContent = `${total} 家全部核对失败，没有可用数据`;
  }else if(snap.n_ok === 0){
    st.textContent = `${total} 家本次全部失败，已沿用上次快照`;
  }else if(carried){
    st.textContent = `完成：${snap.n_ok} 家已更新，${carried} 家失败并沿用上次`;
  }else if(snap.n_error){
    st.textContent = `完成：${snap.n_ok} 家已更新，${snap.n_error} 家失败`;
  }else{
    st.textContent = `${snap.n_ok} 家全部核对完成`;
  }
  renderHoldings();
}

async function hUpdate(resume=false){
  if(hBusy) return;
  hBusy = true;
  const btn = document.getElementById("hUpd");
  const tx  = document.getElementById("hUpdTx");
  const st  = document.getElementById("hUpdSt");
  btn.disabled = true; btn.classList.add("busy");
  tx.textContent = "核对中…";
  st.textContent = "正在向 SEC 逐家核对（本期 + 上一期，约 3-5 分钟）";
  try{
    if(location.protocol==="file:") throw new Error(FILE_ONLY);
    if(resume!==true){
      const r0 = await fetch("/api/holdings/refresh", {method: "POST"});
      const j0 = await r0.json();
      if(!j0 || !j0.ok) throw new Error((j0 && j0.error) || "服务端未接受请求");
    }
    let done = false, tick = 0;
    /* 每家要抓两份申报（本期 + 上一期），31 家实测约 4 分钟；上限给到 13 分钟，
       避免网络慢的时候前端先超时、后台其实还在跑。 */
    while(!done && tick < 520){
      await new Promise(s => setTimeout(s, 1500));
      tick++;
      let p = null;
      try{ p = await (await fetch("/api/holdings/progress", {cache: "no-store"})).json(); }
      catch(e){ continue; }
      if(p.running){
        st.textContent = `本次已核对 ${p.done} / ${p.total} 家` + (p.failed ? ` 失败 ${p.failed}` : "");
        tx.textContent = `${p.done}/${p.total}`;
      }else{
        done = true;
        if(p.snapshot) hApply(p.snapshot);
        else throw new Error(p.error || "服务端没有返回快照");
      }
    }
    if(!done) throw new Error("等待超时");
  }catch(e){
    st.textContent = "更新失败：" + (e.message || "网络或服务端异常") + " 仍显示上次快照";
    tx.textContent = "更新持仓";
  }
  btn.disabled = false; btn.classList.remove("busy");
  hBusy = false;
}

/* ---------------- 初始化 ---------------- */
function hInitHoldings(){
  try{
    const raw = localStorage.getItem("hld_snap_v1");
    if(raw){
      const s = JSON.parse(raw);
      if(s && s.insts && s.insts.length){
        /* 比 built_at，不只是 as_of：同一天可能抓过两次（比如新加了字段要重抓），
           只比日期会让浏览器里同日的旧快照把新的一份顶掉，新字段永远看不到。
           旧快照没有 built_at，退回 as_of 比——字符串比较下 "2026-11-15" < "2026-11-15T08:10:00"，
           新格式自然胜出。 */
        const key = x => String(x.built_at || x.as_of || "");
        if(!HLD || key(s) >= key(HLD)) HLD = s;
      }
    }
  }catch(e){ /* 本地快照坏了就用内嵌的 */ }
  if(HLD) hSel = ((HLD.insts || [])[0] || {}).id || null;
  document.getElementById("hQ").addEventListener("input", e => {
    hQuery = e.target.value.trim();
    hRenderDir();
  });
  document.getElementById("hUpd").addEventListener("click", hUpdate);
}

/* ==================== 财经日历（pane12） ==================== */
let calView="month", calCur=null, calOff=new Set(), calIdx=null;

function calPad(n){ return n<10 ? "0"+n : ""+n; }
function calISO(d){ return d.getFullYear()+"-"+calPad(d.getMonth()+1)+"-"+calPad(d.getDate()); }
function calParse(v){ const a=String(v).split("-"); return new Date(+a[0], +a[1]-1, +(a[2]||1)); }
function calAdd(d,n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+n); }
function calMon(d){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function calEsc(v){ return String(v==null?"":v).replace(/[&<>"]/g,
  function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function calT(id){ const a=(CAL&&CAL.types)||[]; for(let i=0;i<a.length;i++) if(a[i].id===id) return a[i];
  return {id:id, name:id, color:"#999"}; }
function calTODAY(){ return calISO(new Date()); }

/* 跨日事件在区间内每一天都挂一次：开始日正常显示，后续日标 cont。
   不展开的话，CES 这种连开四天的大会在月历上只占一格，看不出持续多久。 */
function calBuildIdx(){
  const m={}, evs=(CAL&&CAL.events)||[];
  for(let i=0;i<evs.length;i++){
    const e=evs[i], s=calParse(e.date), en=e.end?calParse(e.end):s;
    let cur=s, idx=0, guard=0;
    while(cur<=en && guard++<20){
      const k=calISO(cur);
      (m[k]=m[k]||[]).push({e:e, cont:idx>0, day:idx+1});
      cur=calAdd(cur,1); idx++;
    }
  }
  return m;
}
function calShow(e){ return !calOff.has(e.type) && !calMarketOff.has(e.mkt); }
function calDay(k){ const a=(calIdx&&calIdx[k])||[]; return a.filter(function(x){ return calShow(x.e); }); }

function calInit(){
  calCur=new Date();
  calIdx=calBuildIdx();
  const z=document.getElementById("calZoom");
  if(z) z.addEventListener("click", function(ev){
    const b=ev.target.closest("button"); if(!b) return;
    calView=b.dataset.v;
    calSyncZoom();
    calRender();
  });
  const l=document.getElementById("calLeg");
  if(l) l.addEventListener("click", function(ev){
    const b=ev.target.closest("button"); if(!b) return;
    const t=b.dataset.t;
    if(calOff.has(t)) calOff.delete(t); else calOff.add(t);
    b.classList.toggle("off");
    calRender();
  });
  const pv=document.getElementById("calPrev"), nx=document.getElementById("calNext"),
        td=document.getElementById("calToday");
  if(pv) pv.addEventListener("click", function(){ calStep(-1); });
  if(nx) nx.addEventListener("click", function(){ calStep(1); });
  if(td) td.addEventListener("click", function(){ calCur=new Date(); calRender(); });
  const bd=document.getElementById("calBody");
  if(bd) bd.addEventListener("click", function(ev){
    /* 年视图：点某个月 → 进月视图；月视图：点「还有 N 条」→ 进周视图 */
    const mm=ev.target.closest("[data-mo]");
    if(mm){ calCur=calParse(mm.dataset.mo+"-01"); calView="month"; calSyncZoom(); calRender(); return; }
    const wk=ev.target.closest("[data-wk]");
    if(wk){ calCur=calParse(wk.dataset.wk); calView="week"; calSyncZoom(); calRender(); }
  });
  calRender();
}
function calSyncZoom(){
  const z=document.getElementById("calZoom");
  if(z) [].forEach.call(z.children, function(x){ x.classList.toggle("on", x.dataset.v===calView); });
}
function calStep(dir){
  if(calView==="year") calCur=new Date(calCur.getFullYear()+dir, calCur.getMonth(), 1);
  else if(calView==="month") calCur=new Date(calCur.getFullYear(), calCur.getMonth()+dir, 1);
  else calCur=calAdd(calCur, dir*7);
  calRender();
}

function calRender(){
  const b=document.getElementById("calBody");
  if(!CAL){ if(b) b.innerHTML='<div class="calempty">日历数据未注入</div>'; return; }
  calRenderWeekBlock();
  calRenderLegend();
  calRenderTitle();
  if(calView==="year") b.innerHTML=calYearHTML();
  else if(calView==="week") b.innerHTML=calWeekHTML();
  else b.innerHTML=calMonthHTML();
  const sub=document.getElementById("calSub");
  if(sub){
    const on=(CAL.types||[]).filter(function(x){ return !calOff.has(x.id); });
    sub.textContent="共 "+(CAL.events||[]).length+" 条 · "+on.length+"/"+(CAL.types||[]).length
      +" 类可见 · 数据截至 "+CAL.as_of;
  }
}
function calRenderLegend(){
  const el=document.getElementById("calLeg"); if(!el||!CAL) return;
  el.innerHTML=(CAL.types||[]).map(function(t){
    return '<button data-t="'+t.id+'" class="'+(calOff.has(t.id)?"off":"")+'" title="'+calEsc(t.desc||"")+'">'
      +'<i style="background:'+t.color+'"></i>'+calEsc(t.name)+'</button>';
  }).join("");
}
function calRenderTitle(){
  const el=document.getElementById("calTitle"); if(!el) return;
  if(calView==="year") el.textContent=calCur.getFullYear()+" 年";
  else if(calView==="week"){
    const a=calMon(calCur), z=calAdd(a,6);
    el.textContent=(a.getMonth()+1)+"月"+a.getDate()+"日 – "+(z.getMonth()+1)+"月"+z.getDate()+"日";
  } else el.textContent=calCur.getFullYear()+" 年 "+(calCur.getMonth()+1)+" 月";
}

/* ---------- 当周核心事件 ---------- */
function calRenderWeekBlock(){
  const el=document.getElementById("calWeek"); if(!el) return;
  const mon=calMon(new Date()), today=calTODAY();
  const WD=["一","二","三","四","五","六","日"];
  let h="", n=0, core=0, seen={}, cont={}, contN=0;
  for(let i=0;i<7;i++){
    const d=calAdd(mon,i), k=calISO(d), evs=calDay(k);
    /* 按事件 id 去重：跨日事件在索引里每天一条，7 天数下来是 8~11「项」，
       而读者数的是「几件事」；上周延续过来的（全程 cont）也是本周在开的会，
       只数起始日会把它漏掉。去重后与 /api/calendar 的 week 完全一致。 */
    evs.forEach(function(x){
      const eid=x.e.id||x.e.title;
      if(seen[eid]) return;
      seen[eid]=1; n++;
      if(x.e.pri===1) core++;
    });
    h+='<div class="cald'+(k===today?" today":"")+'">'
      +'<div class="h"><span>周'+WD[i]+'</span><b>'+d.getDate()+'</b></div>';
    if(!evs.some(function(x){ return !x.cont; })){
      /* 一天里只有延续中的会时，光写「持续中」等于什么都没说——读者不知道是哪几件。
         写件数并把名字放进悬停，至少能判断这天要不要展开看。 */
      if(!evs.length) h+='<div style="font-size:10px;color:#c8c6bd">—</div>';
      else h+='<div class="ncont" title="'+calEsc(evs.map(function(x){ return x.e.title; })
        .filter(function(v,i,a){ return a.indexOf(v)===i; }).join(" · "))+'">'
        +'持续中 '+evs.length+' 项</div>';
    }
    evs.forEach(function(x){
      const t=calT(x.e.type);
      if(x.cont){
        /* 持续中的会不再每天占一行：一周里排下来全是「第 3 天 / 第 4 天」，
           既看不出是哪件事，也把当天真正的日程挤出了框。改为底下统一列一次。 */
        const cid=x.e.id||x.e.title;
        if(!cont[cid]){
          cont[cid]={e:x.e, day:x.day, color:t.color, last:x.day};
          contN++;
        } else cont[cid].last=x.day;
        return;
      }
      let sp="";
      if(x.e.end){
        const d0=calParse(x.e.date), d1=calParse(x.e.end);
        sp=" ·"+Math.round((d1-d0)/86400000+1)+"天";
      }
      h+='<div class="n '+(x.e.conf==='estimated'?'est':x.e.conf==='tbd'?'pending':'confirmed')+'" style="border-left-color:'+t.color+'" title="'
        +calEsc(t.name+" · "+x.e.title+" · "+iConfidence(x.e.conf)+(x.e.note?" · "+x.e.note:""))+'">'+calEsc(x.e.title)+sp+' <small>'+iConfidence(x.e.conf)+'</small></div>';
    });
    h+='</div>';
  }
  if(contN){
    const list=Object.keys(cont).map(function(cid){
      const c=cont[cid];
      return '<span class="cnc" style="border-left-color:'+c.color+'" title="'
        +calEsc(c.e.title+(c.e.end?" · 至 "+c.e.end:""))+'">'+calEsc(c.e.title)
        +' · 第 '+c.day+'–'+c.last+' 天</span>';
    }).join("");
    h+='<div class="calcont"><b>本周持续中 '+contN+' 项</b>'+list+'</div>';
  }
  el.innerHTML=h;
  const note=document.getElementById("calWkNote");
  if(note) note.textContent="本周 "+n+" 项 · 核心 "+core+" 项 · "
    +(mon.getMonth()+1)+"月"+mon.getDate()+"日起";
}

/* ---------- 月视图 ---------- */
function calMonthHTML(){
  const y=calCur.getFullYear(), mo=calCur.getMonth();
  const first=new Date(y,mo,1), start=calMon(first);
  const days=new Date(y,mo+1,0).getDate();
  const cells=Math.ceil((((first.getDay()+6)%7)+days)/7)*7;
  const today=calTODAY();
  const WD=["一","二","三","四","五","六","日"];
  let h='<div class="calm">';
  for(let i=0;i<7;i++) h+='<div class="calwh'+(i>=5?" we":"")+'">周'+WD[i]+'</div>';
  for(let i=0;i<cells;i++){
    const d=calAdd(start,i), k=calISO(d), out=d.getMonth()!==mo;
    const evs=calDay(k);
    h+='<div class="calcell'+(out?" out":"")+(k===today?" today":"")+'">';
    h+='<div class="cd"><b>'+d.getDate()+'</b>'
      +(i<7?'<span class="cn">'+(d.getMonth()+1)+'月</span>':'')+'</div>';
    const MAX=4;                 /* 一天最多列 4 件事；再多折叠成「+N 条」进周视图 */
    let shown=0, bands=0;
    evs.forEach(function(x){
      const t=calT(x.e.type);
      if(x.cont){
        /* 续接日的细色带不占标题名额：它只是一条 2px 的线，占名额会把当天真正的
           事件挤到「+N 条」里去。最多画 4 条，再多就纯属噪点。 */
        if(bands>=4) return;
        bands++;
        h+='<span class="cbar" style="background:'+t.color+'" title="'
          +calEsc(x.e.title+" · 第 "+x.day+" 天")+'"></span>';
        return;
      }
      if(shown>=MAX) return;
      shown++;
      let tip=t.name+" · "+x.e.title;
      if(x.e.sub) tip+=" · "+x.e.sub;
      if(x.e.src) tip+=" · "+x.e.src;
      if(x.e.note) tip+=" · "+x.e.note;
      tip+="（"+iConfidence(x.e.conf)+"）"+(x.e.basis?" · "+x.e.basis:"");
      let sp="";
      if(x.e.end){
        const d0=calParse(x.e.date), d1=calParse(x.e.end);
        sp=" ·"+Math.round((d1-d0)/86400000+1)+"天";
      }
      h+='<span class="cev'+(x.e.conf==="estimated"?" est":x.e.conf==="tbd"?" pending":" confirmed")
        +'" style="--c:'+t.color+'" title="'+calEsc(tip)+'">'
        +calEsc(x.e.title)+sp+'</span>';
    });
    const rest=evs.filter(function(x){ return !x.cont; }).length-shown;
    if(rest>0)
      h+='<div class="cmore" data-wk="'+calISO(calMon(d))+'">+'+rest+' 条</div>';
    h+='</div>';
  }
  return h+'</div>';
}

/* ---------- 周视图 ---------- */
function calWeekHTML(){
  const mon=calMon(calCur), today=calTODAY();
  const WD=["周一","周二","周三","周四","周五","周六","周日"];
  let h='<div class="calw">';
  for(let i=0;i<7;i++){
    const d=calAdd(mon,i), k=calISO(d), evs=calDay(k);
    h+='<div class="calcol'+(k===today?" today":"")+'">'
      +'<div class="ch"><b>'+d.getDate()+'</b><span>'+(d.getMonth()+1)+'月 · '+WD[i]+'</span></div>';
    if(!evs.length) h+='<div class="calempty">无安排</div>';
    evs.forEach(function(x){
      const t=calT(x.e.type);
      if(x.cont){
        h+='<div class="cev3" style="border-left-color:'+t.color+'">▸ '
          +calEsc(x.e.title)+' · 第 '+x.day+' 天</div>';
        return;
      }
      let meta=t.name;
      meta+=" · "+iConfidence(x.e.conf);
      if(x.e.mkt && CAL.mkts){
        const mm=CAL.mkts.filter(function(z){ return z.id===x.e.mkt; })[0];
        if(mm) meta+=" · "+mm.name;
      }
      h+='<div class="cev2'+(x.e.conf==="estimated"?" est":x.e.conf==="tbd"?" pending":" confirmed")+'" style="--c:'+t.color+'">'
        +'<div class="t">'+calEsc(x.e.title)+'</div>'
        +(x.e.sub?'<div class="s">'+calEsc(x.e.sub)+'</div>':'')
        +'<div class="m">'+calEsc(meta)+'</div></div>';
    });
    h+='</div>';
  }
  return h+'</div>';
}

/* ---------- 年视图 ---------- */
function calYearHTML(){
  const y=calCur.getFullYear(), today=calTODAY();
  const MN=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const WD=["一","二","三","四","五","六","日"];
  let h='<div class="caly">';
  for(let mo=0;mo<12;mo++){
    const ym=y+"-"+calPad(mo+1);
    const first=new Date(y,mo,1), start=calMon(first);
    const days=new Date(y,mo+1,0).getDate();
    const rows=Math.ceil((((first.getDay()+6)%7)+days)/7);
    let g="";
    for(let i=0;i<7;i++) g+='<div class="wd">'+WD[i]+'</div>';
    for(let i=0;i<rows*7;i++){
      const d=calAdd(start,i);
      if(d.getMonth()!==mo){ g+='<i></i>'; continue; }
      const k=calISO(d), has=calDay(k).length>0;
      g+='<i class="'+(k===today?"today":(has?"has":""))+'">'+d.getDate()+'</i>';
    }
    /* 每月底下挂两条核心事件，年视图才有内容，不只是密度格子 */
    const tops=(CAL.events||[]).filter(function(e){
      return e.date.slice(0,7)===ym && calShow(e) && e.pri===1;
    }).slice(0,3);
    let top="";
    tops.forEach(function(e){
      const t=calT(e.type);
      top+='<div class="caltop" title="'+calEsc(e.title)+'">'
        +'<i style="background:'+t.color+'"></i>'+calEsc(e.title)+'</div>';
    });
    const cnt=(CAL.events||[]).filter(function(e){
      return e.date.slice(0,7)===ym && calShow(e);
    }).length;
    /* 数据窗口之外的月份写明「窗口外」：空着会让人以为那几个月确实没有事，
       而实际是这一版没去检索。两者的区别必须让人一眼看到。 */
    const inWin = !!(CAL.range && ym >= CAL.range[0].slice(0,7) && ym <= CAL.range[1].slice(0,7));
    const cntTxt=inWin?(cnt+" 项"):"窗口外";
    h+='<div class="calmini'+(inWin?"":" out")+'" data-mo="'+ym+'">'
      +'<div class="h"><b>'+MN[mo]+'</b><span>'+cntTxt+'</span></div>'
      +'<div class="calg">'+g+'</div>'+top+'</div>';
  }
  return h+'</div>';
}



/* Integration boundary: local data only; navigation stays in the native application. */
function iSafeURL(value){try{const u=new URL(String(value||''));return /^(https?:)$/.test(u.protocol)?u.href:'#';}catch(_){return '#';}}
function iSanitize(value,key){
 if(Array.isArray(value))return value.map(x=>iSanitize(x));
 if(value&&typeof value==='object'){const out={};for(const k of Object.keys(value)){if(k==='__proto__'||k==='constructor'||k==='prototype')continue;out[k]=iSanitize(value[k],k);}return out;}
 if(typeof value!=='string')return value;
 if(key&&/^(url|url_|link|href)/.test(key))return iSafeURL(value);
 if(key==='color')return /^#[0-9a-fA-F]{3,8}$/.test(value)?value:'#74879c';
 if(key==='tag')return ['bull','neutral','bear'].includes(value)?value:'neutral';
 if(key==='id')return value.replace(/[^a-zA-Z0-9_-]/g,'_');
 return value;
}
function iConfidence(c){return c==='confirmed'?'已确认':c==='estimated'?'推测':'待定';}
const calMarketOff=new Set();
function iMarkets(){
 const host=document.createElement('div');host.className='cal-market';host.setAttribute('aria-label','按市场筛选日历');
 host.innerHTML=(CAL&&CAL.mkts||[]).map(m=>'<label><input type="checkbox" checked value="'+calEsc(m.id)+'">'+calEsc(m.name)+'</label>').join('')+'<span>实线＝已确认 · 斜纹虚线＝推测 · 紫色点线＝待定</span>';
 document.getElementById('calBody').before(host);
 host.addEventListener('change',e=>{if(e.target.checked)calMarketOff.delete(e.target.value);else calMarketOff.add(e.target.value);calRender();});
}
function iFresh(){
 nShowStale();
 if(!WIND)return;
 const stale=[],empty=[];let ok=0;
 for(const p of WIND.people||[]){const dates=(p.points||[]).map(x=>x.date).filter(Boolean).sort();if(!dates.length){empty.push(p);continue;}const gap=Math.floor((Date.now()-Date.parse(dates[dates.length-1]))/86400000);if(gap>30)stale.push({cn:p.cn||p.name,gap,auto:(p.feed||[]).map(x=>x.date).sort().pop()});else ok++;}
 if(stale.length||empty.length||ok)wShowStale({stale,empty,ok,days:30});else if(WIND.fresh)wShowStale(WIND.fresh);
}
function iRender(kind){
 const panes={wind:7,news:8,research:9,holdings:10,calendar:12};
 for(const [k,n] of Object.entries(panes))document.getElementById('pane'+n).style.display=k===kind?'':'none';
 if(kind==='wind'){renderWind();iFresh();}if(kind==='news')renderNews();if(kind==='research')renderResearch();if(kind==='holdings')renderHoldings();if(kind==='calendar'){calIdx=calBuildIdx();calRender();}
 document.querySelectorAll('a[target="_blank"]').forEach(a=>{a.rel='noopener noreferrer';a.href=iSafeURL(a.href);});
}
WIND=iSanitize(WIND);NEWS=iSanitize(NEWS);RPT=iSanitize(RPT);CAL=iSanitize(CAL);HLD=iSanitize(HLD);
hInitHoldings();
// Stored snapshots are untrusted input and use the same URL/attribute validation.
HLD=iSanitize(HLD);calInit();iMarkets();
let intelligenceKind=window.INTELLIGENCE_KIND||'news';
iRender(intelligenceKind);iFresh();
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||!e.data||e.data.type!=='intelligence-data')return;const m=e.data;if(!['news','wind','research','calendar','holdings'].includes(m.kind))return;intelligenceKind=m.kind;if(m.data){const d=iSanitize(m.data);if(m.kind==='news')NEWS=d;if(m.kind==='wind')WIND=d;if(m.kind==='research')RPT=d;if(m.kind==='calendar')CAL=d;if(m.kind==='holdings')HLD=d;}iRender(m.kind);});
setInterval(()=>{iFresh();if(intelligenceKind==='calendar')calRender();},60000);
// Inline detail on narrow displays, including when rendered inside the shared frame.
document.getElementById('hDir').addEventListener('click',e=>{if(e.target.closest('[data-id]')&&innerWidth<=980)document.getElementById('hDet').scrollIntoView({behavior:'smooth',block:'start'});});
const iFooter=document.createElement('div');iFooter.className='i-foot';iFooter.textContent='来源纪律：新闻「未策展」与专家「自动抓取」只搬运原文，不代表人工判断。研报论据为人工策展。日历日期请核对确认度。13F 为季末申报快照，股数变化不等于实时交易。';document.querySelector('main').append(iFooter);

// Rejoin durable jobs after leaving this route group or restarting the page.
if(location.protocol!=='file:'&&typeof fetch==='function'){
 for(const kind of ['wind','holdings'])fetch('/api/'+kind+'/progress',{cache:'no-store'}).then(r=>r.json()).then(p=>{
  if(!p.running)return;
  if(kind==='wind'&&!document.getElementById('wRefBtn').disabled)void wRefresh(true);
  if(kind==='holdings'&&!hBusy)void hUpdate(true);
 }).catch(()=>{});
}
