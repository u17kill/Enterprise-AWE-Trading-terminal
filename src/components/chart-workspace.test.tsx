import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
