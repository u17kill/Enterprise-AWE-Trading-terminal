import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LatestVoices } from "./latest-voices";

const entries = Array.from({ length: 7 }, (_, index) => ({ id: `gavin-${index}`, groupId: "tech-investors", personId: "gavin-baker", person: "Gavin Baker", role: "Atreides Management · CIO", title: `Gavin Baker says ${index}`, summary: "Gavin Baker said companies were changing their investment plans.", source: "Example News", url: `https://example.com/${index}`, publishedAt: "2026-10-28T10:00:00.000Z" }));

describe("最新风向页面", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("lists Gavin Baker and shows five items before expansion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ asOf: "2026-11-01T00:00:00.000Z", windowStart: "2026-08-01T00:00:00.000Z", items: entries, groupSummaries: [{ groupId: "tech-investors", text: "加文·贝克认为人工智能投资正在变化。", sourceIds: ["gavin-0"], translated: true }], missing: [], searched: 40 }) }));
    render(<LatestVoices />);
    expect(screen.getByText("Gavin Baker")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /更新观点/ }));
    const group = await screen.findByRole("region", { name: "科技投资人" });
    await waitFor(() => expect(within(group).getAllByRole("article")).toHaveLength(5));
    expect(within(group).getByText("加文·贝克认为人工智能投资正在变化。")).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: /展开更多/ }));
    expect(within(group).getAllByRole("article")).toHaveLength(7);
    expect(within(group).getAllByRole("link", { name: /查看来源/ })[0]).toHaveAttribute("href", "https://example.com/0");
  });
});
