import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PortfolioMatrix } from "../lib/portfolio-matrix";
import { calculateMatrixTotals } from "../lib/portfolio-matrix-totals";
import { PortfolioMatrixSummary } from "./portfolio-matrix-summary";

const matrix: PortfolioMatrix = {
  groups: [{ id: "attack", name: "进攻", color: "#70d5a2" }, { id: "defense", name: "防御", color: "#ee8d8c" }],
  regions: [{ id: "us", name: "美国" }, { id: "cn", name: "中国" }],
  columns: [{ id: "ai", groupId: "attack", name: "AI 基建" }, { id: "finance", groupId: "defense", name: "金融" }],
  items: [
    { id: "a", columnId: "ai", regionId: "us", symbol: "A", name: "A", amount: "6k", status: "held" },
    { id: "b", columnId: "ai", regionId: "cn", symbol: "B", name: "B", amount: "3k", status: "add" },
    { id: "c", columnId: "finance", regionId: "us", symbol: "C", name: "C", amount: "1k", status: "held" },
    { id: "watch", columnId: "finance", regionId: "cn", symbol: "D", name: "D", amount: "8k", status: "watch" },
    { id: "option", columnId: "finance", regionId: "cn", symbol: "PUT", name: "PUT", amount: "2k", status: "option" },
  ],
};

describe("V1.9 portfolio charts", () => {
  it("places donut, proportional bar and treemap below unchanged numeric breakdowns", () => {
    render(<PortfolioMatrixSummary matrix={matrix} totals={calculateMatrixTotals(matrix)} />);
    const summary = screen.getByRole("region", { name: "仓位汇总" });
    expect(within(summary).getByRole("region", { name: "按策略" })).toHaveTextContent("$9k");
    const visuals = within(summary).getByRole("region", { name: "仓位结构图示" });
    expect(summary.compareDocumentPosition(visuals) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(within(visuals).getByRole("region", { name: "按地区·环形图" })).toHaveTextContent("70.0%");
    expect(within(visuals).getByRole("region", { name: "按策略·比例条" })).toHaveTextContent("90.0%");
    expect(within(visuals).getByRole("region", { name: "按主题·方块图" })).toHaveTextContent("AI 基建");
    expect(within(visuals).getByLabelText("进攻 / AI 基建，$9k，占 90.0%")).toBeInTheDocument();
    const themeKey = within(visuals).getByLabelText("主题完整名称与金额");
    expect(themeKey).toHaveTextContent("进攻 / AI 基建");
    expect(themeKey).toHaveTextContent("防御 / 金融");
  });

  it("updates charts from changed totals and displays an honest empty state", () => {
    const view = render(<PortfolioMatrixSummary matrix={matrix} totals={calculateMatrixTotals(matrix)} />);
    const changed = { ...matrix, items: matrix.items.map((item) => item.id === "watch" ? { ...item, status: "held" as const } : item) };
    view.rerender(<PortfolioMatrixSummary matrix={changed} totals={calculateMatrixTotals(changed)} />);
    const visuals = screen.getByRole("region", { name: "仓位结构图示" });
    expect(within(visuals).getByLabelText("防御 / 金融，$9k，占 50.0%")).toBeInTheDocument();
    const empty = { ...matrix, items: matrix.items.filter((item) => item.status === "watch" || item.status === "option") };
    view.rerender(<PortfolioMatrixSummary matrix={empty} totals={calculateMatrixTotals(empty)} />);
    expect(within(screen.getByRole("region", { name: "仓位结构图示" })).getByText("暂无可计算的普通仓位，添加有效的数字k备注后显示图示。" )).toBeInTheDocument();
  });
});
