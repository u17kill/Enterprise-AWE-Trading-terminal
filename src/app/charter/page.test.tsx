import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FundCharterPage from "./page";

describe("基金宪法页面", () => {
  it("按四大支柱展示完整的十条信条和风险上限", () => {
    render(<FundCharterPage />);
    expect(screen.getByRole("heading", { name: "投资十大信条" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.getAllByRole("article").map((article) => within(article).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "结构的价值：让组合穿越周期", "仓位的纪律：永远保留生存的权利", "识别价值：研究价值，而不是猜测价格", "估值的力量：好资产也必须有好价格", "坚守能力圈：看不懂，就不碰", "逆向思考：身处市场，冷眼旁观", "耐心的奖励：买前等待，买后坚守", "机会永远存在：错过不是损失", "看远一点：大钱来自远见、价格与时间", "相信长期增长：站在价值创造的一边",
    ]);
    expect(screen.getByText(/单一标的买入金额不超过总账户资产的/)).toHaveTextContent("3%");
    expect(screen.getByText(/单一产业共同风险因子暴露不超过总账户资产的/)).toHaveTextContent("25%");
    for (const id of ["survival", "value", "discipline", "compounding", "final-principle"]) {
      expect(screen.getByRole("link", { name: new RegExp(id === "final-principle" ? "最终投资准则" : id === "survival" ? "生存与风险控制" : id === "value" ? "价值与认知" : id === "discipline" ? "纪律与人性" : "远见与长期复利") })).toHaveAttribute("href", `#${id}`);
    }
    expect(screen.getByText("Understand Value. Respect Price. Protect Capital. Stay Invested. Let Time Compound.")).toBeInTheDocument();
  });
});
