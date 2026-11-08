import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildResearchSnapshot, parseResearchDataset } from "../lib/institutional-research";
import { InstitutionalResearch } from "./institutional-research";

const data = parseResearchDataset({
  as_of: "2026-11-03",
  topics: [{ id: "macro", name: "宏观", desc: "增长", note: "宏观" }, { id: "ai", name: "AI", desc: "算力", note: "产业" }],
  insts: [{ id: "gs", cn: "高盛", en: "Goldman Sachs", grp: "us", kind: "投行" }, { id: "ms", cn: "摩根士丹利", en: "Morgan Stanley", grp: "us", kind: "投行" }],
  reports: [
    { id: "one", inst: "gs", topic: "macro", scope: "美国", date: "2026-11-02", title: "增长观察", thesis: "增长稳健", pts: ["消费支持"], tag: "bull", call: "增长 2%", src: "机构摘要" },
    { id: "two", inst: "ms", topic: "ai", scope: "全球", date: "2026-10-20", title: "算力观察", thesis: "资本开支放缓", pts: ["支出调整"], tag: "bear", call: "先观察", src: "机构摘要" },
  ],
});
const snapshot = buildResearchSnapshot(data, "2026-11-08");

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe("institutional research page", () => {
  it("filters matrix cells and combines institution, topic, and keyword filters", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot }));
    render(<InstitutionalResearch />);
    await screen.findByText("增长观察");
    expect(screen.getByText("算力观察")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /高盛.*宏观.*1 篇/ }));
    expect(screen.getByText("增长观察")).toBeInTheDocument();
    expect(screen.queryByText("算力观察")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索研报" }), { target: { value: "不存在" } });
    expect(screen.getByText(/没有符合筛选条件/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "看全部" }));
    expect(screen.getByText("算力观察")).toBeInTheDocument();
  });

  it("keeps valid data on a failed refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshot }).mockRejectedValueOnce(new Error("network failed"));
    vi.stubGlobal("fetch", fetchMock);
    render(<InstitutionalResearch />);
    await screen.findByText("增长观察");
    fireEvent.click(screen.getByRole("button", { name: /读取最新研报/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network failed"));
    expect(screen.getByText("增长观察")).toBeInTheDocument();
  });
});
