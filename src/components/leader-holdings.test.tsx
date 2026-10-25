import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LeaderHoldings } from "./leader-holdings";

describe("V0.7 holdings directory", () => {
  it("shows the 13F scope, filters institutions, and opens a right-side detail panel", () => {
    render(<LeaderHoldings />);
    expect(screen.getByRole("heading", { name: "大佬持仓" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /更新持仓/ })).toBeDisabled();
    expect(screen.queryByText("做空研究")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /宏观与多策略/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索机构" }), { target: { value: "查诺斯" } });
    expect(screen.getByRole("button", { name: /Jim Chanos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Jim Chanos/ }));
    const panel = screen.getByRole("dialog", { name: /Jim Chanos/ });
    expect(within(panel).getAllByText(/历史申报/)).toHaveLength(2);
    expect(within(panel).getByText(/2023-09-30/)).toBeInTheDocument();
    expect(within(panel).getByText(/7 项非期权申报/)).toBeInTheDocument();
    expect(within(panel).getByText("S&P REGL BKG")).toBeInTheDocument();
    expect(within(panel).getByText(/49,786 股/)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /SEC 信息表/ })).toHaveAttribute("href", expect.stringContaining("infotable.xml"));
    expect(within(panel).getByRole("link", { name: /SEC 原件/ })).toHaveAttribute("href", expect.stringContaining("sec.gov/Archives/edgar/data/1446440/"));
    fireEvent.click(within(panel).getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
