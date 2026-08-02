import { fireEvent, render, screen } from "@testing-library/react";

import { NavSearch } from "@/components";

describe("NavSearch", () => {
  it("has a programmatic label, not just placeholder text", () => {
    render(<NavSearch />);

    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toBeInTheDocument();
  });

  it("carries the query in a real form field named 'q'", () => {
    render(<NavSearch />);

    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("does not navigate on submit, since /search does not exist yet", () => {
    const { container } = render(<NavSearch />);
    const form = container.querySelector("form");
    expect(form).not.toHaveAttribute("action");

    const submitSpy = jest.fn((event: Event) => event.preventDefault());
    form?.addEventListener("submit", submitSpy);

    fireEvent.submit(form!);

    expect(submitSpy).toHaveBeenCalled();
  });

  it("hides the search glyph from assistive technology", () => {
    const { container } = render(<NavSearch />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
