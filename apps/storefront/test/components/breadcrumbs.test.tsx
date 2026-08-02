import { render, screen } from "@testing-library/react";

import { Breadcrumbs } from "@/components";

const mockUsePathname = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("Breadcrumbs", () => {
  it("renders a link for every crumb except the current page", () => {
    mockUsePathname.mockReturnValue("/keychains/wildflower-acrylic-keychain");
    render(<Breadcrumbs />);

    const home = screen.getByRole("link", { name: "Home" });
    const keychains = screen.getByRole("link", { name: "Keychains" });
    expect(home).toHaveAttribute("href", "/");
    expect(keychains).toHaveAttribute("href", "/keychains");
  });

  it("marks the last crumb as the current page, not a link", () => {
    mockUsePathname.mockReturnValue("/keychains/wildflower-acrylic-keychain");
    render(<Breadcrumbs />);

    const current = screen.getByText("Wildflower Acrylic Keychain");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
  });

  it("is labelled as a breadcrumb navigation region", () => {
    mockUsePathname.mockReturnValue("/keychains");
    render(<Breadcrumbs />);

    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeInTheDocument();
  });
});
