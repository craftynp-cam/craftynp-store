import { render, screen } from "@testing-library/react";

import { SkipLink } from "@/components";

describe("SkipLink", () => {
  it("links to the page's main content", () => {
    render(<SkipLink />);

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content");
  });

  it("is visually hidden until it receives focus", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link.className).toContain("sr-only");
    expect(link.className).toContain("focus:not-sr-only");
  });
});
