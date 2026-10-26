import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FiveLightsPanel } from "./five-lights-panel";
import { HEALTH_STORAGE_KEY } from "../lib/market-health";

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
afterEach(() => vi.restoreAllMocks());

describe("V0.9 market health panel", () => {
  it("renders a ten-slot dashboard and waits for its own refresh", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<FiveLightsPanel />);
    expect(screen.getAllByTestId("health-slot")).toHaveLength(10);
    expect(screen.getByText("预留指标")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新计算市场健康指标" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes only the health API and persists the published metric", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ refreshedAt: "2026-10-26T10:00:00Z", readings: { fearGreed: { value: 21, unit: "/ 100", asOf: "2026-10-23T20:00:00Z", source: "CNN Business", sourceUrl: "https://www.cnn.com/markets/fear-and-greed", state: "unknown", summary: "Extreme Fear" } }, errors: {} }) }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<FiveLightsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "重新计算市场健康指标" }));
    await waitFor(() => expect(screen.getByText("21")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/market-health", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(localStorage.getItem(HEALTH_STORAGE_KEY) ?? "{}").readings.fearGreed.value).toBe(21);
    view.unmount(); render(<FiveLightsPanel />);
    expect(await screen.findByText("21")).toBeInTheDocument();
  });

  it("preserves old values and marks them stale when one source fails", async () => {
    localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify({ refreshedAt: "2026-10-23T20:00:00Z", readings: { volatility: { value: 19.5, unit: "点", asOf: "2026-10-23T20:00:00Z", source: "Longbridge", sourceUrl: "https://longbridge.com", state: "green", summary: "波动温和" } }, errors: {} }));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ refreshedAt: "2026-10-26T10:00:00Z", readings: {}, errors: { volatility: "报价暂不可用" } }) })));
    render(<FiveLightsPanel />);
    const card = (await screen.findByText("波动率")).closest('[data-testid="health-slot"]') as HTMLElement;
    fireEvent.click(screen.getByRole("button", { name: "重新计算市场健康指标" }));
    await waitFor(() => expect(within(card).getByText("旧数据")).toBeInTheDocument());
    expect(within(card).getByText("19.50")).toBeInTheDocument();
    expect(within(card).getByText(/报价暂不可用/)).toBeInTheDocument();
  });
  it("still renders when the browser refuses access to local storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<FiveLightsPanel />);
    expect(screen.getByText("预留指标")).toBeInTheDocument();
  });
  it("scales both Put and Call bars when Put volume exceeds Call volume", async () => {
    localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify({ refreshedAt: "2026-10-23T20:00:00Z", readings: { putCall: { value: 1.5, unit: "倍", asOf: "2026-10-23T20:00:00Z", source: "Longbridge", sourceUrl: "https://longbridge.com", state: "unknown", summary: "SPY" } }, errors: {} }));
    render(<FiveLightsPanel />);
    const card = (await screen.findByText("Put / Call")).closest('[data-testid="health-slot"]') as HTMLElement;
    const bars = card.querySelectorAll(".mh-bars i");
    expect((bars[0] as HTMLElement).style.width).toBe("66.6667%");
    expect((bars[1] as HTMLElement).style.width).toBe("100%");
  });
  it("marks every retained reading stale when the whole request fails", async () => {
    localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify({ refreshedAt: "2026-10-23T20:00:00Z", readings: { volatility: { value: 19.5, unit: "点", asOf: "2026-10-23T20:00:00Z", source: "Longbridge", sourceUrl: "https://longbridge.com", state: "green", summary: "波动温和" } }, errors: {} }));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("网络失败"); }));
    render(<FiveLightsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "重新计算市场健康指标" }));
    const card = screen.getByText("波动率").closest('[data-testid="health-slot"]') as HTMLElement;
    await waitFor(() => expect(within(card).getByText("旧数据")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("网络失败");
  });
  it("shows a new reading even if the browser cannot save it", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ refreshedAt: "2026-10-26T10:00:00Z", readings: { fearGreed: { value: 21, unit: "/ 100", asOf: "2026-10-23T20:00:00Z", source: "CNN", sourceUrl: "https://www.cnn.com/markets/fear-and-greed", state: "unknown", summary: "Extreme Fear" } }, errors: {} }) })));
    render(<FiveLightsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "重新计算市场健康指标" }));
    expect(await screen.findByText("21")).toBeInTheDocument();
  });
});
