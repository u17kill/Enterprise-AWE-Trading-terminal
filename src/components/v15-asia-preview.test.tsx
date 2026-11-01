import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { V15AsiaPreview, V15_ASIA_STORAGE_KEY } from "./v15-asia-preview";

const reading = { symbol: "EWS.US", market: "新加坡", name: "iShares MSCI Singapore ETF", benchmark: "MSCI Singapore Index", kind: "us_etf_proxy", currency: "USD", asOf: "2026-10-27", close: 31.4, barCount: 100, change1d: 1, change5d: 2, change20d: 3, change60d: 4, source: "Longbridge" };
beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

describe("V1.5 Asia preview", () => {
  it("does not fetch on entry and identifies the proxy instead of labeling it an index", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<V15AsiaPreview />);
    expect(screen.getByRole("heading", { name: "亚太观察" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /日本待接入/ })).toBeInTheDocument();
    expect(screen.getByText(/美股上市 ETF 代理/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refreshes explicitly and retains the last valid reading after remount and partial failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ connected: true, readings: { "EWS.US": reading }, errors: { "INDA.US": "获取失败" } }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ connected: true, readings: {}, errors: { "EWS.US": "获取失败", "INDA.US": "获取失败" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<V15AsiaPreview />);
    fireEvent.click(screen.getByRole("button", { name: /更新亚太数据/ }));
    await waitFor(() => expect(screen.getByText("31.40")).toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem(V15_ASIA_STORAGE_KEY) ?? "{}").readings["EWS.US"].close).toBe(31.4);
    first.unmount();
    render(<V15AsiaPreview />);
    await waitFor(() => expect(screen.getByText("31.40")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /更新亚太数据/ }));
    await waitFor(() => expect(within(screen.getByTestId("asia-ews")).getByText(/保留上次成功读数/)).toBeInTheDocument());
    expect(screen.getByText("31.40")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/canary-v15/asia", expect.objectContaining({ method: "POST" }));
  });
  it("offers connection when the server reports an unauthorized session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ connected: false, readings: {}, errors: {} }) }));
    render(<V15AsiaPreview />);
    fireEvent.click(screen.getByRole("button", { name: /更新亚太数据/ }));
    await waitFor(() => expect(screen.getByRole("link", { name: /连接 Longbridge/ })).toBeInTheDocument());
  });
});
