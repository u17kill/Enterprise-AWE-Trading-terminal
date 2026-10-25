import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OptionsCalculator } from "./options-calculator";

describe("V0.8 options calculator", () => {
  it("shows twelve example diagrams and a live expiration calculator", () => {
    render(<OptionsCalculator />);
    expect(screen.getByRole("heading", { name: "期权计算" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^选择策略：/ })).toHaveLength(12);
    expect(screen.getAllByRole("img", { name: /示例盈亏图/ })).toHaveLength(12);
    expect(screen.getByRole("img", { name: /到期盈亏图/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /策略教育来源/ })).toHaveAttribute("href", expect.stringContaining("optionseducation.org"));
    expect(screen.getByText("$105.00")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "买入 Call · 权利金（每股）" }), { target: { value: "10" } });
    expect(screen.getByText("$110.00")).toBeInTheDocument();
    expect(screen.getByText(/曲线向右延续/)).toBeInTheDocument();
  });

  it("uses the collar stock cost independently of spot", () => {
    render(<OptionsCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /选择策略：衣领式/ }));
    expect(screen.getByRole("spinbutton", { name: "股票成本价" })).toHaveValue(100);
    fireEvent.change(screen.getByRole("spinbutton", { name: "股票成本价" }), { target: { value: "95" } });
    expect(screen.getByText("$94.00")).toBeInTheDocument();
    expect(screen.getByText("+$600")).toBeInTheDocument();
    expect(screen.getByText("+$1,600")).toBeInTheDocument();
  });

  it("shows separate left and right risks for an unequal-wing iron condor", () => {
    render(<OptionsCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /选择策略：铁鹰式/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "买入外侧 Put · 执行价" }), { target: { value: "75" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "卖出内侧 Put · 权利金（每股）" }), { target: { value: "5" } });
    const workspace = screen.getByRole("region", { name: "当前策略计算结果" });
    expect(within(workspace).getByText(/两翼不等宽/)).toBeInTheDocument();
    expect(within(workspace).getByText("$83.00")).toBeInTheDocument();
    expect(within(workspace).getByText("$117.00")).toBeInTheDocument();
    expect(within(workspace).getByText("-$800")).toBeInTheDocument();
    expect(within(workspace).getByText("-$300")).toBeInTheDocument();
  });

  it("stops showing a misleading result when strike order is invalid", () => {
    render(<OptionsCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /选择策略：铁鹰式/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "买入外侧 Put · 执行价" }), { target: { value: "95" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/执行价顺序/);
    expect(screen.getByRole("spinbutton", { name: "买入外侧 Put · 执行价" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("img", { name: /到期盈亏图/ })).not.toBeInTheDocument();
  });

  it("keeps cents visible when the contract multiplier is one", () => {
    render(<OptionsCalculator />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "每张对应股数" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "买入 Call · 权利金（每股）" }), { target: { value: "0.25" } });
    expect(screen.getAllByText("-$0.25").length).toBeGreaterThan(0);
  });
});
