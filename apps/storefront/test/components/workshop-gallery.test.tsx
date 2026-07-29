import { render, screen, within } from "@testing-library/react";

import { WorkshopGallery } from "@/components";
import type { WorkshopTile } from "@/components";

const tiles: WorkshopTile[] = [
  {
    id: "1",
    imageUrl: "https://example.com/tile-1.png",
    caption: "Printed tee",
  },
  {
    id: "2",
    imageUrl: "https://example.com/tile-2.png",
    caption: "Engraved keychain",
  },
  { id: "3", imageUrl: "https://example.com/tile-3.png", caption: "" },
  {
    id: "4",
    imageUrl: "https://example.com/tile-4.png",
    caption: "Event banner",
  },
];

describe("WorkshopGallery", () => {
  it("renders the heading as an h2", () => {
    render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Fresh from the workshop",
      }),
    ).toBeInTheDocument();
  });

  it("renders the intro", () => {
    render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro="Real pieces we've made."
        tiles={tiles}
      />,
    );
    expect(screen.getByText("Real pieces we've made.")).toBeInTheDocument();
  });

  it("renders every tile", () => {
    const { container } = render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(4);
  });

  it("uses the caption as the image's alt text", () => {
    render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    expect(screen.getByAltText("Printed tee")).toBeInTheDocument();
  });

  it("renders a decorative alt and no caption line for a blank caption", () => {
    const { container } = render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    expect(screen.getByAltText("")).toBeInTheDocument();
    // Three of the four tiles have a caption; the blank one gets no <p>.
    const captions = container.querySelectorAll("li > p");
    expect(captions).toHaveLength(3);
  });

  it("returns null when there are no tiles", () => {
    const { container } = render(
      <WorkshopGallery heading="Fresh from the workshop" intro="" tiles={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders no links inside the section", () => {
    const { container } = render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    const section = container.querySelector("section")!;
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
  });

  it("renders on the blush surface", () => {
    const { container } = render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    expect(container.querySelector("section")).toHaveClass("bg-surface-soft");
  });

  it("labels the section by its heading", () => {
    render(
      <WorkshopGallery
        heading="Fresh from the workshop"
        intro=""
        tiles={tiles}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Fresh from the workshop" }),
    ).toBeInTheDocument();
  });
});
