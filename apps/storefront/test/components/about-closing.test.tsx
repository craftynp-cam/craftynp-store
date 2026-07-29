import { render, screen } from "@testing-library/react";

import { AboutClosing } from "@/components";
import type { AboutClosingProps } from "@/components";

const props: AboutClosingProps = {
  heading: "Let's make something you'll be proud to hand out",
  body: "Browse what's ready to ship, or shop the full catalog.",
  ctaLabel: "Shop the store",
};

describe("AboutClosing", () => {
  it("renders the heading as an h2", () => {
    render(<AboutClosing {...props} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Let's make something you'll be proud to hand out",
      }),
    ).toBeInTheDocument();
  });

  it("renders the body copy", () => {
    render(<AboutClosing {...props} />);
    expect(
      screen.getByText(
        "Browse what's ready to ship, or shop the full catalog.",
      ),
    ).toBeInTheDocument();
  });

  it("renders a CTA link to the shop named by ctaLabel", () => {
    render(<AboutClosing {...props} />);
    const link = screen.getByRole("link", { name: "Shop the store" });
    expect(link).toHaveAttribute("href", "/products");
  });

  it("omits the CTA link when ctaLabel is empty", () => {
    render(<AboutClosing {...props} ctaLabel="" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("returns null when heading and body are both empty", () => {
    const { container } = render(
      <AboutClosing {...props} heading="" body="" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the section by its heading", () => {
    render(<AboutClosing {...props} />);
    expect(
      screen.getByRole("region", {
        name: "Let's make something you'll be proud to hand out",
      }),
    ).toBeInTheDocument();
  });
});
