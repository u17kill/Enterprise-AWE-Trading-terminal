import { AppSidebar } from "../../components/app-sidebar";
import Image from "next/image";
import { FundCharterLink } from "../../components/fund-charter-link";

export default function InvestmentFrameworkPage() {
  return <div className="app-shell framework-shell">
    <AppSidebar currentPath="/framework" />
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>投资框架</strong></div><div className="topbar-actions"><span className="sample-pill">原图展示</span><FundCharterLink /></div></header>
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
