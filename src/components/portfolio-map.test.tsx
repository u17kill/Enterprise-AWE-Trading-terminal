import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PortfolioMapPage } from "./portfolio-map";
import { DEFAULT_MATRIX, MATRIX_KEY } from "../lib/portfolio-matrix";
import { PORTFOLIO_KEY } from "../lib/portfolio-map";

beforeEach(() => { localStorage.clear(); vi.stubGlobal("confirm", () => true); });

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
    expect(await screen.findByRole("alert", { name: "保存失败" })).toHaveTextContent("没有保存");
    vi.restoreAllMocks();
  });
});
