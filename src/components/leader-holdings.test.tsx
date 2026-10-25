import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LeaderHoldings } from "./leader-holdings";
import seed from "../data/leader-holdings-seed.json";

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

describe("V0.7 holdings directory", () => {
  it("shows filed holdings for an ordinary manager and keeps old filings clearly dated", () => {
    render(<LeaderHoldings />);
    expect(screen.getByRole("button", { name: "更新持仓" })).toBeEnabled();
    expect(screen.queryByText("做空研究")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /伯克希尔·哈撒韦/ }));
    const berkshire = screen.getByRole("dialog", { name: /伯克希尔/ });
    expect(within(berkshire).getByText("AAPL")).toBeInTheDocument();
    expect(within(berkshire).getByText(/2026-06-30/)).toBeInTheDocument();
    expect(within(berkshire).getByRole("link", { name: /SEC 原件/ })).toHaveAttribute("href", expect.stringContaining("sec.gov/Archives/edgar/data/1067983/"));
    fireEvent.click(within(berkshire).getByRole("button", { name: "关闭详情" }));
    fireEvent.click(screen.getByRole("button", { name: /宏观与多策略/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索机构" }), { target: { value: "查诺斯" } });
    expect(screen.getByRole("button", { name: /Jim Chanos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Jim Chanos/ }));
    const panel = screen.getByRole("dialog", { name: /Jim Chanos/ });
    expect(within(panel).getByText(/历史申报 · 报告期 2023-09-30/)).toBeInTheDocument();
    expect(within(panel).getByText("KRE")).toBeInTheDocument();
    expect(within(panel).getByText(/49,786 股/)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /SEC 原件/ })).toHaveAttribute("href", expect.stringContaining("sec.gov/Archives/edgar/data/1446440/"));
    fireEvent.click(within(panel).getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves the current snapshot when refreshing fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LeaderHoldings />);
    fireEvent.click(screen.getByRole("button", { name: "更新持仓" }));
    await waitFor(() => expect(screen.getByText(/更新暂时失败/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /伯克希尔·哈撒韦/ }));
    expect(within(screen.getByRole("dialog")).getByText("AAPL")).toBeInTheDocument();
  });

  it("saves refreshed data and shows it after remount", async () => {
    const changed = { ...seed.managers["0001067983"], checkedAt: "2026-10-26T00:00:00.000Z", topHoldings: [{ ...seed.managers["0001067983"].topHoldings[0], symbol: "TEST" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ asOf: changed.checkedAt, managers: { "0001067983": changed }, failures: [] }) }));
    const view = render(<LeaderHoldings />);
    fireEvent.click(screen.getByRole("button", { name: "更新持仓" }));
    await waitFor(() => expect(localStorage.getItem("awe.leader-holdings.v07")).toContain("TEST"));
    view.unmount();
    render(<LeaderHoldings />);
    fireEvent.click(screen.getByRole("button", { name: /伯克希尔·哈撒韦/ }));
    expect(within(screen.getByRole("dialog")).getByText("TEST")).toBeInTheDocument();
  });
});
