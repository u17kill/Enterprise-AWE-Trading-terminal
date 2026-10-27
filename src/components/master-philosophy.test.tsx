import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MasterPhilosophy } from "./master-philosophy";

describe("大师哲学页面", () => {
  it("按 PPT 顺序显示三组十二位人物及肖像和简介", () => {
    render(<MasterPhilosophy />);
    expect(screen.getByRole("heading", { name: "大师哲学" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["价值派", "均衡配置派", "交易派"]);
    const buffett = screen.getByRole("article", { name: /沃伦·巴菲特/ });
    expect(within(buffett).getByRole("img", { name: "沃伦·巴菲特肖像" })).toHaveAttribute("src", expect.stringContaining("/master-philosophy/buffett.png"));
    expect(within(buffett).getByText(/长期领导伯克希尔/)).toBeInTheDocument();
    expect(screen.getByText(/摘录来自你的 AWE 学习笔记/)).toBeInTheDocument();
  });

  it("可展开完整名言且侧栏标明当前页面", () => {
    render(<MasterPhilosophy />);
    const buffett = screen.getByRole("article", { name: /沃伦·巴菲特/ });
    const expand = within(buffett).getByText("查看全部 9 条摘录");
    const details = expand.closest("details");
    expect(details?.open).toBe(false);
    fireEvent.click(expand);
    expect(details?.open).toBe(true);
    expect(within(buffett).getByText("最好的对抗通胀的办法，就是投资你自己。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /大师哲学/ })).toHaveAttribute("href", "/philosophy");
    expect(screen.getByRole("link", { name: /大师哲学/ })).toHaveAttribute("aria-current", "page");
  });
});
