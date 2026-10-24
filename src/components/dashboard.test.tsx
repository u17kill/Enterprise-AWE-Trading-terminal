import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Dashboard } from "./dashboard";
import { STORAGE_KEY } from "../lib/watchlist";

beforeEach(() => window.localStorage.clear());

describe("dashboard", () => {
  it("shows four macro and four stock cards by default", async () => {
    render(<Dashboard />);
    expect(await screen.findByRole("heading", { name: "宏观资产" })).toBeInTheDocument();
    expect(screen.getAllByTestId("asset-card")).toHaveLength(8);
  });

  it("searches Chinese names and adds a symbol only once", async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "添加资产" }));
    fireEvent.change(screen.getByPlaceholderText("搜索代码或名称"), { target: { value: "道琼斯" } });
    const result = await screen.findByRole("button", { name: /添加 DJI/ });
    fireEvent.click(result);
    expect(screen.getAllByTestId("asset-card")).toHaveLength(9);
    expect(screen.getAllByText("DJI")).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").macro).toContain("DJI");
  });

  it("removes a symbol and keeps the change after remount", async () => {
    const view = render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "移除 AAPL" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "移除 AAPL" })).not.toBeInTheDocument());
    view.unmount();
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "移除 AAPL" })).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").stocks).not.toContain("AAPL");
  });

  it("links cards to their chart workspace", async () => {
    render(<Dashboard />);
    const card = (await screen.findByText("标普 500 指数")).closest('[data-testid="asset-card"]');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole("link", { name: /查看 SPX 图表/ })).toHaveAttribute("href", "/chart/SPX");
  });
});
