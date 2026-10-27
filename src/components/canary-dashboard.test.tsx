import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CanaryDashboard } from "./canary-dashboard";
import { CANARY_STORAGE_KEY } from "../lib/canary";

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
afterEach(() => vi.restoreAllMocks());

describe("V1.1 canary dashboard", () => {
  it("shows the agreed bands, guidance, and an explicit pending value without fetching on entry", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<CanaryDashboard />);
    expect(screen.getByRole("heading", { name: "金丝雀指标" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "宏观先行" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "美股风险" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A 股资金与情绪" })).toBeInTheDocument();
    const card = screen.getByTestId("canary-fedWatch");
    expect(card.querySelector(".canary-card-status")).toHaveTextContent("待刷新");
    expect(within(card).getByText(/点击更新读取芝商所下一次会议/)).toBeInTheDocument();
    fireEvent.click(within(card).getByText(/下次 FOMC 加息 25 基点概率/));
    expect(within(card).getByText(/需本机 Chrome\/Edge/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a verified number on its card and persists it after refresh", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ refreshedAt: "2026-10-27T10:00:00Z", readings: { us10: { value: 4.27, unit: "%", asOf: "2026-10-27", source: "FRED", sourceUrl: "https://fred.stlouisfed.org/series/DGS10", state: "unknown", summary: "美国国债 10 年期" } }, errors: {} }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CanaryDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /更新指标/ }));
    const card = screen.getByTestId("canary-us10");
    await waitFor(() => expect(within(card).getByText("4.27")).toBeInTheDocument());
    expect(within(card).getAllByText(/2026-10-27/).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith("/api/canary", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(localStorage.getItem(CANARY_STORAGE_KEY) ?? "{}").readings.us10.value).toBe(4.27);
  });
});
