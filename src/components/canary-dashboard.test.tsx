import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CanaryDashboard } from "./canary-dashboard";
import { CANARY_STORAGE_KEY } from "../lib/canary";
import { normalizeCanaryOrder } from "../lib/canary-order";

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
afterEach(() => vi.restoreAllMocks());

describe("V1.1 canary dashboard", () => {
  it("shows the agreed bands, guidance, and an explicit pending value without refreshing indicators on entry", () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url !== "/api/canary-order") throw new Error(`Unexpected request: ${url}`);
      return { ok: true, json: async () => ({ order: normalizeCanaryOrder(null) }) };
    }); vi.stubGlobal("fetch", fetchMock);
    render(<CanaryDashboard />);
    expect(screen.getByRole("heading", { name: "指标大全" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "宏观先行" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "美股风险" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A 股资金与情绪" })).toBeInTheDocument();
    const card = screen.getByTestId("canary-fedWatch");
    expect(card.querySelector(".canary-card-status")).toHaveTextContent("待刷新");
    expect(within(card).getByText(/点击更新读取芝商所下一次会议/)).toBeInTheDocument();
    fireEvent.click(within(card).getByText(/下次 FOMC 加息 25 基点概率/));
    expect(within(card).getByText(/需本机 Chrome\/Edge/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => url !== "/api/canary")).toBe(true);
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

  it("moves a card within its category, saves the order, and loads it after remount", async () => {
    let saved = normalizeCanaryOrder(null);
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url === "/api/canary-order" && options?.method === "PUT") { saved = JSON.parse(options.body as string); return { ok: true, json: async () => ({ saved: true }) }; }
      return { ok: true, json: async () => ({ order: saved }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<CanaryDashboard />);
    const macro = screen.getByRole("heading", { name: "宏观先行" }).closest("section")!;
    const originalUs = saved.us;
    await screen.findByRole("button", { name: "向上移动美国国债 10 年期" });
    fireEvent.click(screen.getByRole("button", { name: "向上移动美国国债 10 年期" }));
    await waitFor(() => expect(saved.macro.slice(0, 2)).toEqual(["us10", "us30"]));
    expect(saved.us).toEqual(originalUs);
    expect(within(macro).getAllByTestId(/^canary-/).slice(0, 2).map((node) => node.getAttribute("data-testid"))).toEqual(["canary-us10", "canary-us30"]);
    expect(screen.getByTestId("canary-us10")).not.toHaveAttribute("open");
    view.unmount();
    render(<CanaryDashboard />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "宏观先行" }).closest("section")!.querySelector('[data-testid^="canary-"]')?.getAttribute("data-testid")).toBe("canary-us10"));
  });

  it("restores the original order if saving a dragged card fails", async () => {
    const defaults = normalizeCanaryOrder(null);
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => url === "/api/canary-order" && options?.method === "PUT"
      ? { ok: false, status: 500, json: async () => ({ error: "保存失败" }) }
      : { ok: true, json: async () => ({ order: defaults }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CanaryDashboard />);
    const handle = await screen.findByRole("button", { name: "拖动美国国债 30 年期" });
    const target = screen.getByTestId("canary-us2").parentElement!;
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(target, { clientX: 200, clientY: 300 });
    fireEvent.pointerUp(target, { clientX: 200, clientY: 300 });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("排序保存失败"));
    const macro = screen.getByRole("heading", { name: "宏观先行" }).closest("section")!;
    expect(within(macro).getAllByTestId(/^canary-/).slice(0, 3).map((node) => node.getAttribute("data-testid"))).toEqual(["canary-us30", "canary-us10", "canary-us2"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/canary-order", expect.objectContaining({ method: "PUT" }));
  });

  it("supports pointer dragging on narrow layouts", async () => {
    let saved = normalizeCanaryOrder(null);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "PUT") { saved = JSON.parse(options.body as string); return { ok: true, json: async () => ({ saved: true }) }; }
      return { ok: true, json: async () => ({ order: saved }) };
    }));
    render(<CanaryDashboard />);
    const handle = await screen.findByRole("button", { name: "拖动美国国债 30 年期" });
    const target = screen.getByTestId("canary-us10").parentElement!;
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(target, { clientX: 200, clientY: 300 });
    fireEvent.pointerUp(target, { clientX: 200, clientY: 300 });
    await waitFor(() => expect(saved.macro.slice(0, 2)).toEqual(["us10", "us30"]));
  });
});
