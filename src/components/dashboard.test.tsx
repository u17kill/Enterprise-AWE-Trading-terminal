import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Dashboard } from "./dashboard";
import { STORAGE_KEY } from "../lib/watchlist";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("dashboard", () => {
  it("shows four macro and four stock cards by default", async () => {
    render(<Dashboard />);
    expect(await screen.findByRole("heading", { name: "宏观资产" })).toBeInTheDocument();
    expect(screen.getAllByTestId("asset-card")).toHaveLength(8);
    expect(screen.queryByText("4,126.80")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("searches Chinese names and adds a symbol only once", async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "添加资产" }));
    fireEvent.change(screen.getByPlaceholderText("搜索代码或名称"), { target: { value: "道琼斯" } });
    const result = await screen.findByRole("button", { name: /添加 DJI/ });
    fireEvent.click(result);
    expect(screen.getAllByTestId("asset-card")).toHaveLength(9);
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
    expect(within(gold).getByText("行情不可用")).toBeInTheDocument();
    expect(within(gold).queryByText("4,126.80")).not.toBeInTheDocument();
    expect(within(gold).queryByRole("img")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
