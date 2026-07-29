import { render, screen } from "@testing-library/react";

import { MakerIntro } from "@/components";
import type { MakerIntroProps } from "@/components";

const props: MakerIntroProps = {
  eyebrow: "About the maker",
  heading: "Hi, I'm the one behind every order",
  body: "The Crafty NP started as a kitchen-table hobby.",
  imageUrl: "https://example.com/maker.png",
  imageAlt: "The maker at her workbench",
  linkLabel: "Read the full story",
};

describe("MakerIntro", () => {
  it("renders the eyebrow", () => {
    render(<MakerIntro {...props} />);
    expect(screen.getByText("About the maker")).toBeInTheDocument();
  });

  it("renders the heading as an h2", () => {
    render(<MakerIntro {...props} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Hi, I'm the one behind every order",
      }),
    ).toBeInTheDocument();
  });

  it("renders the body copy", () => {
    render(<MakerIntro {...props} />);
    expect(
      screen.getByText("The Crafty NP started as a kitchen-table hobby."),
    ).toBeInTheDocument();
  });

  it("renders a link to the about page named by linkLabel", () => {
    render(<MakerIntro {...props} />);
    const link = screen.getByRole("link", { name: "Read the full story" });
    expect(link).toHaveAttribute("href", "/about");
  });

  it("renders the portrait with the supplied alt text", () => {
    render(<MakerIntro {...props} />);
    expect(
      screen.getByAltText("The maker at her workbench"),
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder when there is no portrait", () => {
    const { container } = render(<MakerIntro {...props} imageUrl="" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("returns null when heading and body are both empty", () => {
    const { container } = render(<MakerIntro {...props} heading="" body="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the section by its heading", () => {
    render(<MakerIntro {...props} />);
    expect(
      screen.getByRole("region", {
        name: "Hi, I'm the one behind every order",
      }),
    ).toBeInTheDocument();
  });
});
