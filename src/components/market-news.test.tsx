import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarketNews } from "./market-news";

const story = { id: "one", title: "Central bank emergency rate decision", summary: "The bank announced a new rate.", source: "Reuters", publishedAt: "2026-10-24T08:00:00Z", url: "https://www.reuters.com/one", category: "macro", importance: 21 };
const snapshot = { items: [story], highlights: [story], asOf: "2026-10-25T00:00:00Z", days: 3, partial: false, missing: [] };

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("market news page", () => {
  it("updates manually, shows source links and keeps the last result on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshot }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "新闻暂不可用" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MarketNews />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "更新新闻" }));
    await waitFor(() => expect(screen.getAllByText(story.title).length).toBeGreaterThan(0));
    expect(screen.getAllByRole("link", { name: /查看原文/ })[0]).toHaveAttribute("href", story.url);
    expect(localStorage.getItem("awe.news.v06")).toContain(story.title);
    fireEvent.click(screen.getByRole("button", { name: "更新新闻" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("新闻暂不可用"));
    expect(screen.getAllByText(story.title).length).toBeGreaterThan(0);
  });
  it("restores a saved snapshot and changes the requested window", async () => {
    localStorage.setItem("awe.news.v06", JSON.stringify(snapshot));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...snapshot, days: 7 }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MarketNews />);
    expect(screen.getAllByText(story.title).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "7 天" }));
    fireEvent.click(screen.getByRole("button", { name: "更新新闻" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/news?days=7", expect.anything()));
  });
});
