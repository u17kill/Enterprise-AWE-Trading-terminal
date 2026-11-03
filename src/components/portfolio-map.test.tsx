import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PortfolioMapPage } from "./portfolio-map";
import { DEFAULT_MATRIX, MATRIX_KEY } from "../lib/portfolio-matrix";
import { PORTFOLIO_KEY } from "../lib/portfolio-map";

beforeEach(() => { localStorage.clear(); vi.stubGlobal("confirm", () => true); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("V0.3 portfolio matrix", () => {
  it("renders the screenshot hierarchy and seeded status colors", async () => {
    render(<PortfolioMapPage />);
    expect(await screen.findByRole("table", { name: "持仓矩阵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑策略 进攻" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑主题 AI 基建" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑地区 美国" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑 NVDA" })).toHaveClass("status-held");
    expect(screen.getByRole("button", { name: "编辑 XOM" })).toHaveClass("status-watch");
    expect(screen.getByRole("button", { name: "编辑 DRAM" })).toHaveClass("status-add");
  });

  it("edits an item and keeps it after leaving and returning", async () => {
    const view = render(<PortfolioMapPage />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑 NVDA" }));
    fireEvent.change(screen.getByLabelText("仓位 / 备注"), { target: { value: "12k" } });
    fireEvent.change(screen.getByLabelText("状态"), { target: { value: "add" } });
    fireEvent.click(screen.getByRole("button", { name: "保存标的" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "编辑 NVDA" })).toHaveClass("status-add"));
    expect(screen.getByRole("button", { name: "编辑 NVDA" })).toHaveTextContent("12k");
    view.unmount();
    render(<PortfolioMapPage />);
    expect(await screen.findByRole("button", { name: "编辑 NVDA" })).toHaveTextContent("12k");
    expect(JSON.parse(localStorage.getItem(MATRIX_KEY) ?? "{}").items.find((item: { symbol: string }) => item.symbol === "NVDA").status).toBe("add");
  });

  it("loads the durable copy before showing the map and saves the next edit", async () => {
    const stale = { ...DEFAULT_MATRIX, items: DEFAULT_MATRIX.items.map((item) => item.symbol === "NVDA" ? { ...item, amount: "old" } : item) };
    const current = { ...DEFAULT_MATRIX, items: DEFAULT_MATRIX.items.map((item) => item.symbol === "NVDA" ? { ...item, amount: "latest" } : item) };
    localStorage.setItem(MATRIX_KEY, JSON.stringify(stale));
    const writes: Array<{ items: typeof DEFAULT_MATRIX.items }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") { writes.push(JSON.parse(String(init.body))); return { ok: true }; }
      return { ok: true, json: async () => ({ snapshot: { matrix: current, updatedAt: Date.now() } }) };
    }));
    render(<PortfolioMapPage />);
    expect(await screen.findByRole("button", { name: "编辑 NVDA" })).toHaveTextContent("latest");
    expect(writes).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "编辑 NVDA" }));
    fireEvent.change(screen.getByLabelText("仓位 / 备注"), { target: { value: "newest" } });
    fireEvent.click(screen.getByRole("button", { name: "保存标的" }));
    await waitFor(() => expect(writes.at(-1)?.items.find((item) => item.symbol === "NVDA")?.amount).toBe("newest"));
  });

  it("recovers a browser edit that was newer than the last durable write", async () => {
    const pending = { ...DEFAULT_MATRIX, items: DEFAULT_MATRIX.items.map((item) => item.symbol === "NVDA" ? { ...item, amount: "pending edit" } : item) };
    localStorage.setItem(MATRIX_KEY, JSON.stringify(pending));
    localStorage.setItem(`${MATRIX_KEY}.updatedAt`, "2000");
    const writes: Array<{ items: typeof DEFAULT_MATRIX.items }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") { writes.push(JSON.parse(String(init.body))); return { ok: true }; }
      return { ok: true, json: async () => ({ snapshot: { matrix: DEFAULT_MATRIX, updatedAt: 1000 } }) };
    }));
    render(<PortfolioMapPage />);
    expect(await screen.findByRole("button", { name: "编辑 NVDA" })).toHaveTextContent("pending edit");
    await waitFor(() => expect(writes.at(-1)?.items.find((item) => item.symbol === "NVDA")?.amount).toBe("pending edit"));
  });

  it("adds and removes a theme and its tiles without changing other themes", async () => {
    render(<PortfolioMapPage />);
    fireEvent.click(await screen.findByRole("button", { name: "添加主题到 进攻" }));
    fireEvent.change(screen.getByLabelText("主题名称"), { target: { value: "新赛道" } });
    fireEvent.click(screen.getByRole("button", { name: "保存主题" }));
    fireEvent.click(screen.getByRole("button", { name: "添加标的到 新赛道 美国" }));
    fireEvent.change(screen.getByLabelText("代码 / 简称"), { target: { value: "TEST" } });
    fireEvent.change(screen.getByLabelText("公司 / 资产名称"), { target: { value: "测试公司" } });
    fireEvent.click(screen.getByRole("button", { name: "保存标的" }));
    expect(screen.getByRole("button", { name: "编辑 TEST" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑主题 新赛道" }));
    fireEvent.click(screen.getByRole("button", { name: "删除主题" }));
    expect(screen.queryByRole("button", { name: "编辑 TEST" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑 NVDA" })).toBeInTheDocument();
  }, 15_000);

  it("restores a V0.3 backup while leaving the old portfolio data intact", async () => {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify({ private: "old data" }));
    render(<PortfolioMapPage />);
    const restored = { ...DEFAULT_MATRIX, items: DEFAULT_MATRIX.items.filter((item) => item.symbol === "NVDA") };
    const file = new File([JSON.stringify(restored)], "map.json", { type: "application/json" });
    fireEvent.change(await screen.findByLabelText("导入地图"), { target: { files: [file] } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "编辑 XOM" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "编辑 NVDA" })).toBeInTheDocument();
    expect(localStorage.getItem(PORTFOLIO_KEY)).toBe(JSON.stringify({ private: "old data" }));
  });

  it("warns when browser storage refuses to save", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    render(<PortfolioMapPage />);
    expect(await screen.findByRole("alert", { name: "保存失败" })).toHaveTextContent("持久保存失败");
    vi.restoreAllMocks();
  });
});

describe("V1.7 portfolio totals", () => {
  it("shows USD totals by strategy, region and theme, plus cell subtotals and a separate option list", async () => {
    const matrix = { ...DEFAULT_MATRIX, items: [
      { ...DEFAULT_MATRIX.items[0], amount: "1.5k", status: "held" as const },
      { ...DEFAULT_MATRIX.items[1], amount: "10k", status: "add" as const },
      { ...DEFAULT_MATRIX.items[2], amount: "9k", status: "watch" as const },
      { ...DEFAULT_MATRIX.items[3], amount: "put 115", status: "option" as const },
    ] };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ snapshot: { matrix, updatedAt: Date.now() } }) })));
    render(<PortfolioMapPage />);
    const summary = await screen.findByRole("region", { name: "仓位汇总" });
    expect(within(summary).getByRole("region", { name: "普通持仓总额" })).toHaveTextContent("$11.5k");
    expect(within(summary).getByText(/2 张计入计算/)).toBeInTheDocument();
    expect(within(summary).getByText("1 张期权")).toBeInTheDocument();
    expect(within(summary).getByText(/VST.*put 115/)).toBeInTheDocument();
    expect(within(summary).getByRole("region", { name: "按策略" })).toHaveTextContent("进攻");
    expect(within(summary).getByRole("region", { name: "按地区" })).toHaveTextContent("美国");
    expect(within(summary).getByRole("region", { name: "按主题" })).toHaveTextContent("AI 基建");
    expect(screen.getAllByLabelText("进攻策略小计")[0]).toHaveTextContent("$11.5k");
    expect(screen.getAllByLabelText("AI 基建主题小计")[0]).toHaveTextContent("$11.5k");
    expect(screen.getByLabelText("美国地区小计")).toHaveTextContent("$11.5k");
    expect(screen.getAllByLabelText("AI 基建 / 美国小计")[0]).toHaveTextContent("$11.5k");
  });

  it("allows editing a card to blue option and removes its amount from ordinary totals", async () => {
    const matrix = { ...DEFAULT_MATRIX, items: [{ ...DEFAULT_MATRIX.items[0], amount: "1.5k", status: "held" as const }] };
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { ok: true };
      return { ok: true, json: async () => ({ snapshot: { matrix, updatedAt: Date.now() } }) };
    }));
    render(<PortfolioMapPage />);
    fireEvent.click(await screen.findByRole("button", { name: "编辑 NVDA" }));
    fireEvent.change(screen.getByLabelText("状态"), { target: { value: "option" } });
    fireEvent.click(screen.getByRole("button", { name: "保存标的" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "编辑 NVDA" })).toHaveClass("status-option"));
    expect(screen.getByRole("region", { name: "仓位汇总" })).toHaveTextContent("$0");
    expect(screen.getByRole("region", { name: "仓位汇总" })).toHaveTextContent("1 张期权");
    expect(JSON.parse(localStorage.getItem(MATRIX_KEY) ?? "{}").items[0].status).toBe("option");
  });
});
