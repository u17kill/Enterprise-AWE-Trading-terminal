import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Dashboard } from "./dashboard";
import { STORAGE_KEY } from "../lib/watchlist";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe("dashboard", () => {
  it("shows twelve macro and four stock cards by default", async () => {
    render(<Dashboard />);
    expect(await screen.findByRole("heading", { name: "宏观资产" })).toBeInTheDocument();
    expect(screen.getAllByTestId("asset-card")).toHaveLength(16);
    expect(screen.getByText("日经 225")).toBeInTheDocument();
    expect(screen.queryByText("4,126.80")).not.toBeInTheDocument();
    for (const card of screen.getAllByTestId("asset-card")) expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  });

  it("searches Chinese names and adds a symbol only once", async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "移除 DJI" }));
    fireEvent.click(screen.getByRole("button", { name: "添加资产" }));
    fireEvent.change(screen.getByPlaceholderText("搜索代码或名称"), { target: { value: "道琼斯" } });
    const result = await screen.findByRole("button", { name: /添加 DJI/ });
    fireEvent.click(result);
    expect(screen.getAllByTestId("asset-card")).toHaveLength(16);
    expect(screen.getAllByText("DJI")).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").macro).toContain("DJI");
  });

  it("removes a symbol and keeps the change after remount", async () => {
    const view = render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "移除 AAPL" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "移除 AAPL" })).not.toBeInTheDocument());
    view.unmount();
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "移除 AAPL" })).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").stocks).not.toContain("AAPL");
  });

  it("links cards to their chart workspace", async () => {
    render(<Dashboard />);
    const card = (await screen.findByText("标普 500 指数")).closest('[data-testid="asset-card"]');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole("link", { name: /查看 SPX 图表/ })).toHaveAttribute("href", "/chart/SPX");
  });

  it("opens the chart workspace from the left navigation", () => {
    render(<Dashboard />);
    expect(screen.getByRole("link", { name: /图表空间/ })).toHaveAttribute("href", "/chart/SPX");
    expect(screen.getByRole("link", { name: /期权计算/ })).toHaveAttribute("href", "/options");
  });

  it("updates visible quotes only when the user presses refresh", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quotes: { AAPL: { value: 347.725, changePercent: -0.14, timestamp: "2026-10-23T20:00:01Z" } }, trendsBySymbol: { AAPL: [{ timestamp: "2026-10-23T13:30:00Z", price: 350.75 }, { timestamp: "2026-10-23T19:59:00Z", price: 347.725 }] }, unsupported: ["XAUUSD", "US10Y"], asOf: "2026-10-24T00:00:00Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<Dashboard />);
    const refresh = await screen.findByRole("button", { name: "更新当前页面数据" });
    await waitFor(() => expect(refresh).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(refresh);
    const card = screen.getByText("苹果").closest('[data-testid="asset-card"]') as HTMLElement;
    await waitFor(() => expect(within(card).getByText("347.73")).toBeInTheDocument());
    expect(within(card).getByText(/Longbridge/)).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /最近交易日分时走势/ })).toBeInTheDocument();
    expect(within(card).queryByText("示例走势")).not.toBeInTheDocument();
    const gold = screen.getByText("黄金 / 美元").closest('[data-testid="asset-card"]') as HTMLElement;
    expect(within(gold).getByText("黄金现货参考价暂不可用")).toBeInTheDocument();
    expect(within(gold).queryByText("4,126.80")).not.toBeInTheDocument();
    expect(within(gold).queryByRole("img")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the Asian index trading date rather than the later snapshot download time", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/longbridge/status"
      ? { ok: true, json: async () => ({ connected: true }) }
      : { ok: true, json: async () => ({ quotes: { N225: { value: 62189.65, changePercent: -0.8, timestamp: "2026-10-26T15:37:39Z", marketDate: "2026-10-26", source: "DeanFi · Nikkei 225" } }, trendsBySymbol: {}, unsupported: [], asOf: "2026-10-26T15:37:39Z" }) }));
    render(<Dashboard />);
    const refresh = await screen.findByRole("button", { name: "更新当前页面数据" });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    const card = screen.getByText("日经 225").closest('[data-testid="asset-card"]') as HTMLElement;
    await waitFor(() => expect(within(card).getByText("62,189.65")).toBeInTheDocument());
    expect(within(card).getByText(/2026\/10\/26 交易日/)).toBeInTheDocument();
  });

  it("keeps the last manual market update after returning from a chart", async () => {
    let refreshCount = 0;
    const fetchMock = vi.fn(async (url: string) => url === "/api/longbridge/status"
      ? { ok: true, json: async () => ({ connected: true }) }
      : { ok: true, json: async () => {
        refreshCount += 1;
        const value = refreshCount === 1 ? 347.725 : 350.625;
        return { quotes: { AAPL: { value, changePercent: -0.14, timestamp: "2026-10-23T20:00:01Z" } }, trendsBySymbol: { AAPL: [{ timestamp: "2026-10-23T13:30:00Z", price: 350.75 }, { timestamp: "2026-10-23T19:59:00Z", price: value }] }, unsupported: [], asOf: "2026-10-24T00:00:00Z" };
      } });
    vi.stubGlobal("fetch", fetchMock);

    const firstVisit = render(<Dashboard />);
    const refresh = await screen.findByRole("button", { name: "更新当前页面数据" });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    expect(await screen.findByText("347.73")).toBeInTheDocument();
    firstVisit.unmount();

    render(<Dashboard />);
    const card = screen.getByText("苹果").closest('[data-testid="asset-card"]') as HTMLElement;
    await waitFor(() => expect(within(card).getByText("347.73")).toBeInTheDocument());
    expect(within(card).getByRole("img", { name: /最近交易日分时走势/ })).toBeInTheDocument();
    expect(screen.getByText("行情已更新")).toBeInTheDocument();
    expect(refreshCount).toBe(1);

    const secondRefresh = screen.getByRole("button", { name: "更新当前页面数据" });
    await waitFor(() => expect(secondRefresh).toBeEnabled());
    fireEvent.click(secondRefresh);
    expect(await screen.findByText("350.63")).toBeInTheDocument();
    expect(refreshCount).toBe(2);
  });

  it("searches Longbridge US securities and keeps a selected stock after remount", async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes("/search?")
      ? { ok: true, json: async () => ({ total: 16102, items: [{ id: "ADBE.US", name: "Adobe", englishName: "Adobe Inc.", category: "美股", group: "stocks", unit: "美元", sampleValue: "", sampleChange: "", trend: [], color: "blue", source: "longbridge" }] }) }
      : { ok: true, json: async () => ({ connected: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "添加资产" }));
    fireEvent.change(screen.getByPlaceholderText("搜索代码或名称"), { target: { value: "ADBE" } });
    const result = await screen.findByRole("button", { name: "添加 ADBE.US" }, { timeout: 5000 });
    fireEvent.click(result);
    expect(screen.getByRole("button", { name: "移除 ADBE.US" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").stocks).toContain("ADBE.US");
    view.unmount();
    render(<Dashboard />);
    expect(screen.getByRole("button", { name: "移除 ADBE.US" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看 ADBE.US 图表" })).toHaveAttribute("href", "/chart/ADBE.US?name=Adobe");
  });
});
