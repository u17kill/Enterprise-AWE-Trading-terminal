import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { findSymbol } from "../lib/catalog";
import { ChartWorkspace } from "./chart-workspace";

const { createChartMock, setDataMock } = vi.hoisted(() => ({
  createChartMock: vi.fn(),
  setDataMock: vi.fn(),
}));

vi.mock("lightweight-charts", () => {
  const timeScale = {
    setVisibleLogicalRange: vi.fn(), fitContent: vi.fn(),
    coordinateToLogical: vi.fn((x: number) => x / 10), logicalToCoordinate: vi.fn((x: number) => x * 10),
    subscribeVisibleLogicalRangeChange: vi.fn(), unsubscribeVisibleLogicalRangeChange: vi.fn(),
  };
  createChartMock.mockImplementation(() => ({
    addSeries: () => ({ setData: setDataMock, priceScale: () => ({ applyOptions: vi.fn() }), coordinateToPrice: (y: number) => 100 + y, priceToCoordinate: (price: number) => price - 100 }),
    timeScale: () => timeScale, resize: vi.fn(), remove: vi.fn(),
    subscribeClick: vi.fn(), unsubscribeClick: vi.fn(),
    subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn(),
  }));
  return { createChart: createChartMock, CandlestickSeries: {}, HistogramSeries: {}, LineSeries: {} };
});

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});
beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("chart workspace", () => {
  it("mounts a candle chart with interval, indicator and drawing controls", () => {
    const symbol = findSymbol("SPX")!;
    render(<ChartWorkspace symbol={symbol} />);
    expect(screen.getByRole("heading", { name: /标普 500 指数/ })).toBeInTheDocument();
    expect(screen.getByTestId("candlestick-chart")).toBeInTheDocument();
    expect(createChartMock).toHaveBeenCalled();
    expect(setDataMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "日线" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "周线" }));
    expect(screen.getByRole("button", { name: "周线" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /直线/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fibonacci/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /返回总览/ })[0]).toHaveAttribute("href", "/");
    expect(screen.getByText(/非实时行情/)).toBeInTheDocument();
  });

  it.each([
    ["直线", "line"],
    ["Fibonacci", "fib"],
  ])("creates and saves a %s drawing when dragged across the chart", (label, kind) => {
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));
    const overlay = screen.getByLabelText("保存的图表绘图");
    fireEvent.pointerDown(overlay, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 200, clientY: 170, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 200, clientY: 170, pointerId: 1 });
    expect(screen.getByText(/1\s*个/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("awe-chart-drawings:v1:SPX:1D") || "[]")[0].kind).toBe(kind);
  });

  it("keeps two-click drawing available", () => {
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    fireEvent.click(screen.getByRole("button", { name: /直线/ }));
    const overlay = screen.getByLabelText("保存的图表绘图");
    fireEvent.pointerDown(overlay, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(screen.getByText(/第二个位置/)).toBeInTheDocument();
    fireEvent.pointerDown(overlay, { clientX: 200, clientY: 170, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 200, clientY: 170, pointerId: 1 });
    expect(screen.getByText(/1\s*个/)).toBeInTheDocument();
  });

  it("allows MA5 and MA20 to be displayed together and independently hidden", () => {
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    const ma5 = screen.getByRole("checkbox", { name: "MA5" });
    const ma20 = screen.getByRole("checkbox", { name: "MA20" });
    fireEvent.click(ma5);
    expect(ma5).toBeChecked();
    expect(ma20).toBeChecked();
    fireEvent.click(ma20);
    expect(ma5).toBeChecked();
    expect(ma20).not.toBeChecked();
  });

  it("explains when the selected interval lacks enough bars for a moving average", () => {
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "MA250" }));
    expect(screen.getByText(/MA250 需要至少 250 根 K 线/)).toBeInTheDocument();
  });

  it("shows MACD and RSI in independent lower panes and reports unavailable breadth data", () => {
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    expect(screen.queryByRole("region", { name: "MACD 指标" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "MACD" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "RSI" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "标普 500 宽度 MA50" }));
    expect(screen.getByRole("region", { name: "MACD 指标" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "RSI 指标" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "标普 500 宽度 MA50" })).toHaveTextContent("市场宽度数据尚未接入");
    fireEvent.click(screen.getByRole("checkbox", { name: "MACD" }));
    expect(screen.queryByRole("region", { name: "MACD 指标" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "RSI 指标" })).toBeInTheDocument();
  });

  it("deletes an older drawing directly while preserving newer drawings", () => {
    const key = "awe-chart-drawings:v1:SPX:1D";
    window.localStorage.setItem(key, JSON.stringify([
      { id: "older", kind: "line", color: "#2563eb", a: { index: 10, price: 120 }, b: { index: 20, price: 140 } },
      { id: "newer", kind: "fib", color: "#ef6c65", a: { index: 30, price: 130 }, b: { index: 40, price: 150 } },
    ]));
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    const overlay = screen.getByLabelText("保存的图表绘图");
    fireEvent.pointerDown(overlay.querySelectorAll(".drawing-hit")[0]);
    fireEvent.click(screen.getByRole("button", { name: "删除这条绘图" }));
    expect(JSON.parse(window.localStorage.getItem(key) || "[]").map((item: { id: string }) => item.id)).toEqual(["newer"]);
    expect(screen.getByText(/1\s*个/)).toBeInTheDocument();
  });

  it("loads Longbridge candles only after pressing the chart refresh button", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ quotes: { SPX: { value: 7623.68, changePercent: -0.52, timestamp: "2026-10-23T21:03:30Z" } }, candlesByInterval: { "1D": [
        { time: "2026-10-22", open: 7600, high: 7700, low: 7500, close: 7663, volume: 100 },
        { time: "2026-10-23", open: 7637, high: 7660, low: 7612, close: 7623, volume: 120 },
      ] }, unsupported: [], asOf: "2026-10-24T00:00:00Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChartWorkspace symbol={findSymbol("SPX")!} />);
    const refresh = screen.getByRole("button", { name: "更新当前页面数据" });
    await waitFor(() => expect(refresh).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(refresh);
    await waitFor(() => expect(screen.getByText("7,623.68")).toBeInTheDocument());
    expect(screen.getAllByText(/Longbridge K 线/).length).toBeGreaterThan(0);
    expect(setDataMock).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ time: "2026-10-23", close: 7623 })]));
  });
});
