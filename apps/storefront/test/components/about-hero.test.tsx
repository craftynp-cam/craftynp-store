import { render, screen } from "@testing-library/react";

import { AboutHero } from "@/components";
import type { AboutHeroProps } from "@/components";

const props: AboutHeroProps = {
  eyebrow: "The maker",
  heading: "Hi, I'm Katherine",
  body: "The Crafty NP started at my kitchen table.",
  imageUrl: "https://example.com/maker.png",
  imageAlt: "The maker in the workshop",
  ctaLabel: "Shop the work",
};

function gridCells(container: HTMLElement) {
  const grid = container.querySelector("section > div");
  return grid?.children.length ?? 0;
}

describe("AboutHero", () => {
  it("renders the heading as the page's h1", () => {
    render(<AboutHero {...props} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Hi, I'm Katherine" }),
    ).toBeInTheDocument();
  });

  it("renders a CTA link to the shop named by ctaLabel", () => {
    render(<AboutHero {...props} />);
    const link = screen.getByRole("link", { name: "Shop the work" });
    expect(link).toHaveAttribute("href", "/products");
  });

  it("renders the portrait with the supplied alt text", () => {
    const { container } = render(<AboutHero {...props} />);
    expect(
      screen.getByAltText("The maker in the workshop"),
    ).toBeInTheDocument();
    expect(gridCells(container)).toBe(2);
  });

  it("omits the image cell when there is no portrait", () => {
    const { container } = render(<AboutHero {...props} imageUrl="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(gridCells(container)).toBe(1);
  });

  it("omits the CTA link when ctaLabel is empty", () => {
    render(<AboutHero {...props} ctaLabel="" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("returns null when heading and body are both empty", () => {
    const { container } = render(<AboutHero {...props} heading="" body="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the section by its heading", () => {
    render(<AboutHero {...props} />);
    expect(
      screen.getByRole("region", { name: "Hi, I'm Katherine" }),
    ).toBeInTheDocument();
  });
});
