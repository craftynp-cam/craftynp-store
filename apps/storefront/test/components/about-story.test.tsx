import { render, screen } from "@testing-library/react";

import { AboutStory } from "@/components";
import type { AboutStoryProps } from "@/components";

const props: AboutStoryProps = {
  heading: "How it started",
  paragraphs: [
    "What began as making stickers for friends.",
    "Six years later.",
  ],
};

describe("AboutStory", () => {
  it("renders the heading as an h2", () => {
    render(<AboutStory {...props} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "How it started" }),
    ).toBeInTheDocument();
  });

  it("renders every paragraph", () => {
    render(<AboutStory {...props} />);
    expect(
      screen.getByText("What began as making stickers for friends."),
    ).toBeInTheDocument();
    expect(screen.getByText("Six years later.")).toBeInTheDocument();
  });

  it("returns null when there is no heading and no paragraphs", () => {
    const { container } = render(<AboutStory heading="" paragraphs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the section by its heading", () => {
    render(<AboutStory {...props} />);
    expect(
      screen.getByRole("region", { name: "How it started" }),
    ).toBeInTheDocument();
  });
});
