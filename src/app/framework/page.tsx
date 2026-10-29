import Image from "next/image";
import Link from "next/link";
import { Brand } from "../../components/brand";

export default function InvestmentFrameworkPage() {
  return <div className="app-shell framework-shell">
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-label">工作台</div>
      <nav aria-label="主导航">
        <Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link>
        <Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link>
        <Link className="nav-item" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link>
        <Link className="nav-item" href="/calendar"><span className="nav-glyph">▤</span>财经日历</Link>
        <Link className="nav-item" href="/news"><span className="nav-glyph">◉</span>市场动态</Link>
        <Link className="nav-item" href="/holdings"><span className="nav-glyph">♟</span>大佬持仓</Link>
        <Link className="nav-item" href="/options"><span className="nav-glyph">◇</span>期权计算</Link>
        <Link className="nav-item" href="/philosophy"><span className="nav-glyph">✦</span>大师哲学</Link>
        <Link className="nav-item" href="/canary"><span className="nav-glyph">◈</span>金丝雀指标</Link>
        <Link className="nav-item active" href="/framework" aria-current="page"><span className="nav-glyph">⌂</span>投资框架</Link>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V1.2 · 投资框架</div><p>一页查看完整的投资哲学与决策结构。</p></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>投资框架</strong></div><span className="sample-pill">原图展示</span></header>
      <div className="framework-content">
        <div className="framework-heading"><span className="section-eyebrow">AWE / INVESTMENT FRAMEWORK</span><h1>投资哲学与决策框架</h1><p>从价值、价格与机会，走向组合纪律与长期复利。</p></div>
        <div className="framework-image-stage">
          <Image src="/investment-framework-v12.webp" alt="Enterprise AWE 投资哲学与决策框架屋顶图：顶部为长期复利目标，中部依次为价值、价格、机会，三根支柱是理解市场、投资哲学、组合与执行，左右分别为时间维度与中国资产、价格模型与估值工具，底部为八项原则及六项认知土壤。" width={1448} height={1086} unoptimized priority className="framework-image" />
        </div>
        <p className="framework-caption">图片内的 V1.1 是图稿版本；终端功能版本为 V1.2。</p>
      </div>
    </main>
  </div>;
}
