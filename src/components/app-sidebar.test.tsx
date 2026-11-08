import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppSidebar } from "./app-sidebar";

describe("two-level app navigation", () => {
  it("opens the active group and retains existing destinations", () => {
    render(<AppSidebar currentPath="/canary/temperature" />);
    expect(screen.getByRole("button", { name: /金丝雀指标/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "指标大全" })).toHaveAttribute("href", "/canary");
    expect(screen.getByRole("link", { name: "市场温度" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: /市场情报/ }));
    expect(screen.getByRole("link", { name: "财经日历" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "大佬持仓" })).toHaveAttribute("href", "/holdings");
    expect(screen.getByRole("link", { name: "机构研报" })).toHaveAttribute("href", "/research");
  });
  it("keeps the top-level dashboard and all three new canary links", () => {
    render(<AppSidebar currentPath="/" />);
    expect(screen.getByRole("link", { name: "总览看板" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: /金丝雀指标/ }));
    for (const label of ["市场温度", "估值分析", "短线精灵"]) expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  });
});
