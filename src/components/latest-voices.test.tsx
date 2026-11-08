import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LatestVoices } from "./latest-voices";
import { summarizeCuratedVoices, type CuratedVoiceData, type CuratedVoiceSnapshot } from "../lib/voices-curated";

const data: CuratedVoiceData = {
  as_of: "2026-11-08", window: ["2026-08-01", "2026-11-08"], updated: "2026-11-08 22:40",
  brief: { title: "本期主线", items: [{ h: "产业与央行分歧", t: "产业订单仍强，央行关注通胀。" }] },
  cats: [
    { id: "macro", name: "宏观大师", desc: "宏观", groups: [{ id: "buy", name: "买方与媒体" }] },
    { id: "tech_leader", name: "科技与产业", desc: "产业", groups: [{ id: "us", name: "美国科技巨头" }] },
  ],
  people: [
    { id: "alice", name: "Alice Smith", cn: "艾丽斯", role: "基金经理", org: "Alpha Fund", cat: "macro", grp: "buy", tag: "bear", stance: "担忧通胀使长债受压", points: [{ date: "2026-10-05", src: "公开访谈", text: "通胀仍高于目标。" }, { date: "2026-10-06", src: "公开访谈", text: "HBM 需求也会影响债券融资。" }] },
    { id: "bob", name: "Bob Lee", cn: "鲍勃", role: "首席执行官", org: "Beta Corp", cat: "tech_leader", grp: "us", tag: "bull", stance: "订单增长但产能不足", points: [{ date: "2026-11", src: "财报会", text: "订单增长 25%。" }] },
  ],
};
const snapshot: CuratedVoiceSnapshot = { data, summary: summarizeCuratedVoices(data, new Date("2026-11-09T00:00:00Z")), warnings: [] };

describe("V1.10 最新风向", () => {
  beforeEach(() => { vi.restoreAllMocks(); Element.prototype.scrollIntoView = vi.fn(); });

  it("shows curated counts, people, source caveat and a brief separate from cards", () => {
    render(<LatestVoices initialSnapshot={snapshot} />);
    expect(screen.getAllByText(/2 位人物/).length).toBeGreaterThan(0);
    expect(screen.getByText("产业与央行分歧")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /艾丽斯/ })).toHaveTextContent("HBM 需求也会影响债券融资。");
    expect(screen.getAllByText(/原件未逐条核验/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /宏观大师.*多 0 中 0 空 1/ })).toHaveTextContent("0 / 0 / 1");
  });

  it("searches hidden points, filters stance and compresses to one point", () => {
    render(<LatestVoices initialSnapshot={snapshot} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索人物与观点" }), { target: { value: "HBM" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox", { name: "只看结论" }));
    expect(screen.getByRole("article", { name: /艾丽斯/ })).not.toHaveTextContent("HBM 需求也会影响债券融资。");
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索人物与观点" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "偏多" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("article", { name: /鲍勃/ })).toBeInTheDocument();
  });

  it("clears a filter before jumping to a hidden category", async () => {
    render(<LatestVoices initialSnapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: "偏多" }));
    fireEvent.click(screen.getByRole("button", { name: /宏观大师.*1 位/ }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
    expect(screen.getByText("已清除筛选，显示目标分类。")).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("keeps the prior snapshot when refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "source unavailable" }) }));
    render(<LatestVoices initialSnapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: /更新策展数据/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("source unavailable");
    expect(within(screen.getByRole("region", { name: "宏观大师" })).getByRole("article", { name: /艾丽斯/ })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
