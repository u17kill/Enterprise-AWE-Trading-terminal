import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { findSymbol } from "../lib/catalog";
import { ChartWorkspace } from "./chart-workspace";

describe("chart workspace", () => {
  it("shows the selected symbol, a sample chart, and a way back", () => {
    const symbol = findSymbol("SPX");
    if (!symbol) throw new Error("SPX missing from catalog");
    render(<ChartWorkspace symbol={symbol} />);
    expect(screen.getByRole("heading", { name: /标普 500 指数/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "SPX 示例走势" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /返回总览/ })[0]).toHaveAttribute("href", "/");
    expect(screen.getByText(/非实时行情/)).toBeInTheDocument();
  });
});
