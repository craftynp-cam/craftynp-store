import { render, screen, within } from "@testing-library/react";

import { ProcessPanel } from "@/components";
import {
  READY_MADE_PRODUCT,
  resolveProductCustomization,
} from "@craftynp/types";
import type { ProductCustomization } from "@craftynp/types";

const notes = {
  turnaroundNote: "Made to order in 3–5 business days.",
  shippingWindowNote: "Delivery takes another 2–5 business days.",
};

function customizable(
  metadata: Record<string, string> = {},
): ProductCustomization {
  return resolveProductCustomization({
    customizable: "true",
    customization_artwork: "required",
    ...metadata,
  });
}

function stepTitles() {
  return screen
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("heading").textContent);
}

describe("ProcessPanel", () => {
  it("walks upload, production and shipping in that order (AC 3)", () => {
    render(<ProcessPanel customization={customizable()} {...notes} />);

    expect(stepTitles()).toEqual([
      "You tell us what you want",
      "We make it by hand",
      "It ships to you",
    ]);
  });

  it("drops the customization step for a ready-made product", () => {
    render(<ProcessPanel customization={READY_MADE_PRODUCT} {...notes} />);

    expect(stepTitles()).toEqual(["We make it by hand", "It ships to you"]);
  });

  it("names every input the product asks for, in the order it asks", () => {
    render(
      <ProcessPanel
        customization={customizable({
          customization_text: "optional",
          customization_notes: "optional",
        })}
        {...notes}
      />,
    );

    expect(
      screen.getByText(
        "Upload your artwork, add the text you want on it and tell us anything else about the piece.",
      ),
    ).toBeInTheDocument();
  });

  it("promises the resolution check only when artwork is asked for", () => {
    const { unmount } = render(
      <ProcessPanel customization={customizable()} {...notes} />,
    );

    expect(screen.getByText(/sharp enough to print/i)).toBeInTheDocument();

    unmount();
    render(
      <ProcessPanel
        customization={customizable({
          customization_artwork: "off",
          customization_text: "required",
        })}
        {...notes}
      />,
    );

    expect(
      screen.queryByText(/sharp enough to print/i),
    ).not.toBeInTheDocument();
  });

  it("carries the owner's turnaround and shipping lines", () => {
    render(<ProcessPanel customization={customizable()} {...notes} />);

    expect(screen.getByText(notes.turnaroundNote)).toBeInTheDocument();
    expect(screen.getByText(notes.shippingWindowNote)).toBeInTheDocument();
  });

  it("still explains production and shipping when the owner clears the notes", () => {
    render(
      <ProcessPanel
        customization={customizable()}
        turnaroundNote=""
        shippingWindowNote=""
      />,
    );

    expect(stepTitles()).toEqual([
      "You tell us what you want",
      "We make it by hand",
      "It ships to you",
    ]);
    expect(
      screen.getByText(/made to order in the workshop/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/email you tracking/i)).toBeInTheDocument();
  });
});
