import type { PortfolioMatrix } from "../lib/portfolio-matrix";
import { formatUsdAmount, type MatrixTotals } from "../lib/portfolio-matrix-totals";

type SummaryProps = { matrix: PortfolioMatrix; totals: MatrixTotals };

function Breakdown({ title, entries }: { title: string; entries: { id: string; name: string; amount?: number }[] }) {
  return <section className="matrix-summary-breakdown" aria-label={title}>
    <h3>{title}</h3>
    <div className="matrix-summary-list">{entries.map((entry) => <div className="matrix-summary-row" key={entry.id}>
      <span title={entry.name}>{entry.name}</span>
      <strong>{entry.amount === undefined ? "—" : formatUsdAmount(entry.amount)}</strong>
    </div>)}</div>
  </section>;
}

export function PortfolioMatrixSummary({ matrix, totals }: SummaryProps) {
  const groupNames = new Map(matrix.groups.map((group) => [group.id, group.name]));
  return <section className="matrix-summary" aria-label="仓位汇总">
    <div className="matrix-summary-lead">
      <section className="matrix-summary-total" aria-label="普通持仓总额">
        <span>普通持仓总额</span><strong>{formatUsdAmount(totals.totalUsd)}</strong>
        <small>{totals.includedCount} 张计入计算 · 灰色已持仓 + 绿色计划加仓</small>
      </section>
      <section className="matrix-summary-options" aria-label="期权单列">
        <span>期权 · 单独展示</span><strong>{totals.optionItems.length} 张期权</strong>
        <div className="matrix-summary-option-list">{totals.optionItems.length
          ? totals.optionItems.map((item) => <span key={item.id}>{item.symbol}{item.amount ? ` · ${item.amount}` : ""}</span>)
          : <small>暂无蓝色期权卡片</small>}</div>
      </section>
    </div>
    <div className="matrix-summary-breakdowns">
      <Breakdown title="按策略" entries={matrix.groups.map((group) => ({ id: group.id, name: group.name, amount: totals.groups[group.id] }))} />
      <Breakdown title="按地区" entries={matrix.regions.map((region) => ({ id: region.id, name: region.name, amount: totals.regions[region.id] }))} />
      <Breakdown title="按主题" entries={matrix.columns.map((column) => ({ id: column.id, name: `${groupNames.get(column.groupId) ?? "未分组"} / ${column.name}`, amount: totals.columns[column.id] }))} />
    </div>
    <p className="matrix-summary-note">按备注中的数字k计算，统一视为美元；黄色观察与蓝色期权不计入。这里是仓位备注合计，并非实时市值。</p>
  </section>;
}
