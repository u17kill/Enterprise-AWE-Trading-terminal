import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FinancialCalendar } from "./financial-calendar";

beforeEach(() => { localStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe("financial calendar page", () => {
  it("navigates months and filters events", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ connected: false }) })));
    render(<FinancialCalendar />);
    expect(screen.getByRole("link", { name: /财经日历/ })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("heading", { name: "近期重点财报" })).toBeInTheDocument();
    const title = screen.getByRole("heading", { level: 2, name: /年.*月/ }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "下个月" }));
    expect(screen.getByRole("heading", { level: 2, name: /年.*月/ }).textContent).not.toBe(title);
    fireEvent.click(screen.getByRole("button", { name: "产业展会" }));
    expect(screen.getByRole("button", { name: "产业展会" })).toHaveClass("selected");
    expect(screen.getByRole("button", { name: /更新日历/ })).toBeDisabled();
  });
  it("updates on click and retains last successful data when a later refresh fails", async () => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" });
    const month = today.slice(0, 7);
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ connected: true }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ events: [{ id: "live", title: "重点公司 财报", category: "earnings", region: "US", start: today, detail: "第三季度", source: "Longbridge 财经日历", status: "provider" }], asOf: new Date().toISOString() }) }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "暂时不可用" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<FinancialCalendar />);
    await waitFor(() => expect(screen.getByRole("button", { name: "↻ 更新日历" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "↻ 更新日历" }));
    await waitFor(() => expect(localStorage.getItem(`awe.calendar.v04.${month}`)).toContain("重点公司 财报"));
    fireEvent.click(screen.getByRole("button", { name: "产业展会" }));
    fireEvent.click(screen.getByRole("button", { name: `查看 重点公司 财报 ${today}` }));
    expect(screen.getByRole("button", { name: "重点财报" })).toHaveClass("selected");
    expect(screen.getByRole("heading", { name: "重点公司 财报" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "↻ 更新日历" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("暂时不可用"));
    expect(localStorage.getItem(`awe.calendar.v04.${month}`)).toContain("重点公司 财报");
  });
});
