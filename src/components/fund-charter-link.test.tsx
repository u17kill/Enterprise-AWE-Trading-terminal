import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FundCharterLink } from "./fund-charter-link";

describe("基金宪法顶栏入口", () => {
  it("跳转独立页面并标明当前页面", () => {
    render(<FundCharterLink current />);
    expect(screen.getByRole("link", { name: "基金宪法" })).toHaveAttribute("href", "/charter");
    expect(screen.getByRole("link", { name: "基金宪法" })).toHaveAttribute("aria-current", "page");
  });
});
