import type { CSSProperties } from "react";
import type { PortfolioMatrix } from "../lib/portfolio-matrix";
import { formatUsdAmount, type MatrixTotals } from "../lib/portfolio-matrix-totals";
import { buildPortfolioVisuals, layoutTreemap, type PortfolioVisualSlice } from "../lib/portfolio-matrix-visuals";

type Props = { matrix: PortfolioMatrix; totals: MatrixTotals };

const percent = (share: number) => `${share.toFixed(1)}%`;
const description = (item: PortfolioVisualSlice) => `${item.label}，${formatUsdAmount(item.amount)}，占 ${percent(item.share)}`;

export function PortfolioMatrixVisuals({ matrix, totals }: Props) {
  const visuals = buildPortfolioVisuals(matrix, totals);
  const boxes = new Map(layoutTreemap(visuals.themes).map((box) => [box.id, box]));
  const regionArcs = visuals.regions.map((item, index) => ({
    item,
    offset: visuals.regions.slice(0, index).reduce((sum, previous) => sum + previous.share, 0),
    dash: Math.max(0, item.share - Math.min(item.share * 0.1, 0.35)),
  }));

  return <section className="matrix-summary-visuals" aria-label="仓位结构图示">
    {visuals.totalUsd === 0 ? <div className="matrix-visual-empty">暂无可计算的普通仓位，添加有效的数字k备注后显示图示。</div> : <>
      <div className="matrix-visual-top">
        <section className="matrix-visual-panel matrix-visual-region" aria-label="按地区·环形图">
          <div className="matrix-visual-heading"><h3>按地区 · 环形</h3><small>环段长度 = 占总额比例</small></div>
          <div className="matrix-donut-body"><div className="matrix-donut-wrap"><svg viewBox="0 0 220 220" role="img" aria-label={`地区合计 ${formatUsdAmount(visuals.totalUsd)}`}>
            <circle cx="110" cy="110" r="76" fill="none" stroke="#edf2f7" strokeWidth="32" />
            {regionArcs.map(({ item, offset, dash }) => <circle key={item.id} cx="110" cy="110" r="76" fill="none" stroke={item.color} strokeWidth="32" pathLength="100" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-offset} transform="rotate(-90 110 110)"><title>{description(item)}</title></circle>)}
          </svg><div className="matrix-donut-center"><span>合计</span><strong>{formatUsdAmount(visuals.totalUsd)}</strong></div></div>
            <div className="matrix-donut-legend">{visuals.regions.map((item) => <div key={item.id} className="matrix-donut-legend-row" aria-label={description(item)}><i style={{ backgroundColor: item.color }} /><span>{item.name}</span><strong>{formatUsdAmount(item.amount)}</strong><small>{percent(item.share)}</small></div>)}</div>
          </div>
        </section>
        <section className="matrix-visual-panel matrix-visual-strategy" aria-label="按策略·比例条">
          <div className="matrix-visual-heading"><h3>按策略 · 比例条</h3><small>带长 = 占总额比例</small></div>
          <div className="matrix-strategy-metrics">{visuals.strategies.map((item) => <div key={item.id} aria-label={description(item)}><span><i style={{ backgroundColor: item.color }} />{item.name}</span><strong style={{ color: item.color }}>{percent(item.share)}</strong><small>{formatUsdAmount(item.amount)}</small></div>)}</div>
          <div className="matrix-strategy-bar" role="img" aria-label={`按策略分布，合计 ${formatUsdAmount(visuals.totalUsd)}`}>{visuals.strategies.map((item) => <span key={item.id} style={{ width: `${item.share}%`, backgroundColor: item.color }} title={description(item)} />)}</div>
          <div className="matrix-strategy-axis"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div>
        </section>
      </div>
      <section className="matrix-visual-panel matrix-visual-theme" aria-label="按主题·方块图">
        <div className="matrix-visual-heading"><h3>按主题 · 方块图</h3><small>方块面积 = 计入金额，越大占比越高</small></div>
        <div className="matrix-treemap">{visuals.themes.map((item) => { const box = boxes.get(item.id); if (!box) return null; return <div key={item.id} className="matrix-treemap-tile" role="img" aria-label={description(item)} title={description(item)} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, backgroundColor: item.color, "--tile-color": item.color } as CSSProperties}><strong>{item.name}</strong><small>{formatUsdAmount(item.amount)} · {percent(item.share)}</small></div>; })}</div>
      </section>
    </>}
  </section>;
}
