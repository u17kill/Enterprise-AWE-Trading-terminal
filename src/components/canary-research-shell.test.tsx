import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CanaryResearchShell } from "./canary-research-shell";

describe("V1.5 research page frame", () => {
  beforeEach(() => localStorage.clear());
  it("keeps market selection across research pages", () => {
    const first = render(<CanaryResearchShell kind="temperature" />);
    fireEvent.click(screen.getByRole("button", { name: "A 股" }));
    expect(screen.getByRole("button", { name: "A 股" })).toHaveAttribute("aria-pressed", "true");
    first.unmount();
    render(<CanaryResearchShell kind="valuation" />);
    expect(screen.getByRole("button", { name: "A 股" })).toHaveAttribute("aria-pressed", "true");
  });
  it("has distinct pages and no sample quote masquerading as data", () => {
    render(<CanaryResearchShell kind="sentiment" />);
    expect(screen.getByRole("heading", { name: "短线精灵" })).toBeInTheDocument();
    expect(screen.getByText("历史走势尚无已核验数据")).toBeInTheDocument();
  });
});
