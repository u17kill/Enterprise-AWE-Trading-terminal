import { AppSidebar } from "../../components/app-sidebar";
import { FundCharterLink } from "../../components/fund-charter-link";
import { FUND_CHARTER_FINAL, FUND_CHARTER_PILLARS } from "../../lib/fund-charter";

export default function FundCharterPage() {
  return <div className="app-shell charter-shell">
    <AppSidebar currentPath="/charter" />
    <main className="main-content"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>基金宪法</strong></div><FundCharterLink current /></header>
      <div className="charter-content"><div className="charter-hero"><span className="section-eyebrow">ENTERPRISE / AWE · CORE INVESTMENT PRINCIPLES</span><h1>投资十大信条</h1><p>Core Investment Principles · V1.0</p></div>
        <div className="charter-manifesto">先求生存，再求收益；以价值为锚，以纪律为尺，以组合为舟，以时间为友。</div>
        <div className="charter-layout"><nav className="charter-toc" aria-label="基金宪法目录"><strong>四大支柱</strong>{FUND_CHARTER_PILLARS.map((pillar, index) => <a href={`#${pillar.id}`} key={pillar.id}><span>{String(index + 1).padStart(2, "0")}</span>{pillar.name}</a>)}<a href="#final-principle">最终投资准则</a></nav>
          <div className="charter-article">{FUND_CHARTER_PILLARS.map((pillar, index) => <section className="charter-pillar" id={pillar.id} key={pillar.id}><div className="charter-pillar-heading"><span>PILLAR {String(index + 1).padStart(2, "0")}</span><div><h2>{pillar.name}</h2><p>{pillar.english}</p></div></div>
            {pillar.principles.map((principle) => <article className="charter-principle" key={principle.number}><span className="charter-number">{principle.number}</span><div><h3>{principle.title}</h3>{principle.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{principle.bullets && <ul>{principle.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}{principle.afterBullets && <p>{principle.afterBullets}</p>}<p className="charter-conclusion">{principle.conclusion}</p></div></article>)}
          </section>)}<section className="charter-final" id="final-principle"><span>AWE / FINAL PRINCIPLE</span><h2>AWE 的最终投资准则</h2>{FUND_CHARTER_FINAL.map((paragraph, index) => index === 0 ? <strong key={paragraph}>{paragraph}</strong> : <p key={paragraph}>{paragraph}</p>)}</section></div>
        </div>
      </div>
    </main>
  </div>;
}
