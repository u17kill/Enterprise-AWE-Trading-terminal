import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "./app-sidebar";

describe("two-level app navigation", () => {
  it("opens the active group and retains existing destinations", () => {
    render(<AppSidebar currentPath="/canary/momentum" />);
    expect(screen.getByRole("button", { name: /金丝雀指标/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "指标大全" })).toHaveAttribute("href", "/canary");
    expect(screen.getByRole("link", { name: "动能分析" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: /市场情报/ }));
    expect(screen.getByRole("link", { name: "财经日历" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "大佬持仓" })).toHaveAttribute("href", "/holdings");
    expect(screen.getByRole("link", { name: "机构研报" })).toHaveAttribute("href", "/research");
    expect(screen.getByRole("link", { name: "市场新闻" })).toHaveAttribute("href", "/news");
    expect(screen.getByRole("link", { name: "专家观点" })).toHaveAttribute("href", "/voices");
    expect(screen.queryByRole("link", { name: "当前持仓" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /投资工具/ }));
    expect(screen.getByRole("link", { name: "当前持仓" })).toHaveAttribute("href", "/portfolio");
  });
  it("keeps the top-level dashboard and both retained pages and all six replacement pages", () => {
    render(<AppSidebar currentPath="/" />);
    expect(screen.getByRole("link", { name: "总览看板" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: /金丝雀指标/ }));
    for (const label of ["指标大全", "资产风向", "动能分析", "估值分位", "A股雷达", "美股雷达", "港股全景", "亚太温度"]) expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    for (const old of ["市场温度","估值分析","短线精灵"]) expect(screen.queryByRole("link",{name:old})).not.toBeInTheDocument();
  });
});
