import { beforeAll, describe, expect, it, vi } from "vitest";
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
    coordinateToLogical: vi.fn(() => 20), logicalToCoordinate: vi.fn(() => 100),
    subscribeVisibleLogicalRangeChange: vi.fn(), unsubscribeVisibleLogicalRangeChange: vi.fn(),
  };
  createChartMock.mockImplementation(() => ({
    addSeries: () => ({ setData: setDataMock, priceScale: () => ({ applyOptions: vi.fn() }), coordinateToPrice: () => 100, priceToCoordinate: () => 100 }),
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
});
