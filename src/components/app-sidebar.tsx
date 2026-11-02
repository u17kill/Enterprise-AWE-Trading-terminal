"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "./brand";

const groups = [
  { id: "canary", label: "金丝雀指标", icon: "◈", links: [["/canary", "指标大全"], ["/canary/temperature", "市场温度"], ["/canary/valuation", "估值分析"], ["/canary/sentiment", "短线精灵"]] },
  { id: "intelligence", label: "市场情报", icon: "◉", links: [["/news", "市场动态"], ["/voices", "最新风向"], ["/calendar", "财经日历"], ["/holdings", "大佬持仓"]] },
  { id: "tools", label: "投资工具", icon: "⌁", links: [["/chart/SPX", "图表空间"], ["/portfolio", "持仓地图"], ["/options", "期权计算"]] },
  { id: "academy", label: "投资学堂", icon: "✦", links: [["/framework", "投资框架"], ["/philosophy", "大师哲学"]] },
] as const;

export function AppSidebar({ currentPath }: { currentPath: string }) {
  const normalized = currentPath.startsWith("/chart/") ? "/chart/SPX" : currentPath;
  const initialGroup = groups.find((group) => group.links.some(([href]) => href === normalized))?.id ?? "";
  const [openGroup, setOpenGroup] = useState<string>(initialGroup);
  return <aside className="sidebar app-sidebar"><Brand /><div className="sidebar-label">工作台</div><nav aria-label="主导航">
    <Link className={`nav-item${normalized === "/" ? " active" : ""}`} href="/" aria-current={normalized === "/" ? "page" : undefined}><span className="nav-glyph" aria-hidden="true">◫</span>总览看板</Link>
    {groups.map((group) => <div className="nav-group" key={group.id}>
      <button type="button" className={`nav-item nav-group-toggle${openGroup === group.id ? " active" : ""}`} aria-expanded={openGroup === group.id} onClick={() => setOpenGroup(openGroup === group.id ? "" : group.id)}><span className="nav-glyph" aria-hidden="true">{group.icon}</span>{group.label}<span className="nav-chevron" aria-hidden="true">{openGroup === group.id ? "⌄" : "›"}</span></button>
      {openGroup === group.id && <div className="nav-children">{group.links.map(([href, label]) => <Link key={href} href={href} className={`nav-child${normalized === href ? " active" : ""}`} aria-current={normalized === href ? "page" : undefined}>{label}</Link>)}</div>}
    </div>)}
  </nav><div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />Enterprise AWE Terminal</div><p>按主题浏览研究、市场情报与投资工具。</p></div></aside>;
}
