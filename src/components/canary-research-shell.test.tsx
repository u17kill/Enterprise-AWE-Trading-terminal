import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanaryResearchShell } from "./canary-research-shell";

describe("V1.5 research page frame", () => {
  beforeEach(() => localStorage.clear());
  it("keeps market selection across research pages", () => {
    const first = render(<CanaryResearchShell kind="temperature" />);
    fireEvent.click(screen.getByRole("button", { name: "A 股" }));
    expect(screen.getByRole("button", { name: "A 股" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();
    render(<CanaryResearchShell kind="valuation" />);
    expect(screen.getByRole("button", { name: "A 股" })).toHaveAttribute("aria-pressed", "true");
  });
  it("has distinct pages and no sample quote masquerading as data", () => {
    render(<CanaryResearchShell kind="sentiment" />);
    expect(screen.getByRole("heading", { name: "短线精灵" })).toBeInTheDocument();
    expect(screen.getByText("历史走势尚无已核验数据")).toBeInTheDocument();
  });
  it("does not save a wholly unavailable refresh as the last successful observation", async () => {
    const key = "awe-v15-temperature-us";
    const previous = { market: "us", kind: "temperature", refreshedAt: "2026-10-30T21:00:00Z", readings: [{ id: "SPY.US", title: "标普", value: 61, unit: "/ 100", asOf: "2026-10-30", source: "Longbridge", summary: "上次", explanation: "上次", points: [], status: "正常" }], errors: {} };
    localStorage.setItem(key, JSON.stringify(previous));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ market: "us", kind: "temperature", refreshedAt: "2026-11-02T05:00:00Z", readings: [{ ...previous.readings[0], value: null }], errors: { "SPY.US": "来源截断" } }) }));
    render(<CanaryResearchShell kind="temperature" />);
    fireEvent.click(screen.getByRole("button", { name: "↻ 更新本页" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("来源截断"));
    expect(localStorage.getItem(key)).toBe(JSON.stringify(previous));
    expect(screen.getByText("61.00")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("labels the US movers as a dated large-cap sample rather than full-market breadth", () => {
    localStorage.setItem("awe-v15-sentiment-us", JSON.stringify({ market: "us", kind: "sentiment", refreshedAt: "2026-11-02T05:00:00Z", closeAsOf: "2026-10-30", readings: [{ id: "temperature", title: "市场温度", value: 34, unit: "/100", asOf: "2026-10-30", source: "Longbridge", summary: "", explanation: "", points: [], status: "正常" }], movers: { universe: 1195, gainers: [{ symbol: "AAA.US", name: "甲公司", changePercent: 10, marketCap: 20_000_000_000 }], losers: [{ symbol: "BBB.US", name: "乙公司", changePercent: -10, marketCap: 30_000_000_000 }] }, errors: {} }));
    render(<CanaryResearchShell kind="sentiment" />);
    expect(screen.getByRole("heading", { name: "美股大市值涨跌榜" })).toBeInTheDocument();
    expect(screen.getByText(/市值至少 100 亿美元/)).toBeInTheDocument();
    expect(screen.getByText("甲公司")).toBeInTheDocument();
    expect(screen.getByText("乙公司")).toBeInTheDocument();
  });
  it("separates intraday large-cap movers from the completed US close", () => {
    localStorage.setItem("awe-v15-sentiment-us", JSON.stringify({ market: "us", kind: "sentiment", refreshedAt: "2026-11-02T15:05:00Z", closeAsOf: "2026-10-30", readings: [{ id: "temperature", title: "市场温度", value: 34, unit: "/100", asOf: "2026-10-30", source: "Longbridge", summary: "", explanation: "", points: [], status: "正常" }], moverAsOf: "2026-11-02", moverLayer: "intraday", movers: { universe: 1200, gainers: [{ symbol: "AAA.US", name: "甲公司", changePercent: 10, marketCap: 20_000_000_000 }], losers: [{ symbol: "BBB.US", name: "乙公司", changePercent: -10, marketCap: 30_000_000_000 }] }, errors: {} }));
    render(<CanaryResearchShell kind="sentiment" />);
    expect(screen.getByText(/2026-10-30 · 最近完整交易日/)).toBeInTheDocument();
    expect(screen.getByText(/2026-11-02 · 1200 只筛选样本 · 盘中观察/)).toBeInTheDocument();
    expect(screen.getByText(/盘中数值会变化，不纳入上方收盘判断/)).toBeInTheDocument();
  });
  it("shows verified 5/20/60-session A-share industry trends beneath the heatmap", () => {
    localStorage.setItem("awe-v15-sentiment-cn", JSON.stringify({ market: "cn", kind: "sentiment", refreshedAt: "2026-11-02T08:00:00Z", closeAsOf: "2026-11-02", readings: [{ id: "temperature", title: "市场温度", value: 63, unit: "/100", asOf: "2026-11-02", source: "Longbridge", summary: "", explanation: "", points: [], status: "正常" }], sectorAsOf: "2026-11-02", sectorLayer: "close", sectors: [{ symbol: "IN40197.SH", title: "电影和娱乐", changePercent: 10.53, change5: 12.4, change20: 23.5, change60: 31.6 }], errors: {} }));
    localStorage.setItem("awe-v15-market", "cn");
    render(<CanaryResearchShell kind="sentiment" />);
    expect(screen.getByText("行业指数")).toBeInTheDocument();
    expect(screen.getByText("+12.40%")).toBeInTheDocument();
    expect(screen.getByText("+23.50%")).toBeInTheDocument();
  });
});
