import { render, screen, within } from "@testing-library/react";

import { ProcessPanel } from "@/components";
import type { ProcessPanelContent } from "@/components";
import {
  READY_MADE_PRODUCT,
  resolveProductCustomization,
  siteContentDefault,
} from "@craftynp/types";
import type { ProductCustomization } from "@craftynp/types";

const content: ProcessPanelContent = {
  turnaroundNote: "Made to order in 3–5 business days.",
  shippingWindowNote: "Delivery takes another 2–5 business days.",
  readyToShipHeading: "Straight from our shelf",
  readyToShipStepTitle: "Finished and waiting",
  readyToShipStepBody: "Finished in the workshop before you ordered.",
  readyToShipDispatchNote: "Leaves within 2 business days.",
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
    render(<ProcessPanel customization={customizable()} content={content} />);

    expect(stepTitles()).toEqual([
      "You tell us what you want",
      "We make it by hand",
      "It ships to you",
    ]);
  });

  it("tells a ready-to-ship product's story in the owner's words, never as made to order", () => {
    render(
      <ProcessPanel customization={READY_MADE_PRODUCT} content={content} />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: content.readyToShipHeading,
      }),
    ).toBeInTheDocument();
    expect(stepTitles()).toEqual([
      content.readyToShipStepTitle,
      "It ships to you",
    ]);
    expect(screen.getByText(content.readyToShipStepBody)).toBeInTheDocument();
    expect(
      screen.getByText(content.readyToShipDispatchNote),
    ).toBeInTheDocument();
    expect(screen.getByText(content.shippingWindowNote)).toBeInTheDocument();
    expect(screen.queryByText(content.turnaroundNote)).not.toBeInTheDocument();
    expect(screen.getByRole("region")).not.toHaveTextContent(/made to order/i);
  });

  it("falls back to the default wording when the owner blanks a ready-to-ship field", () => {
    render(
      <ProcessPanel
        customization={READY_MADE_PRODUCT}
        content={{
          ...content,
          readyToShipHeading: "",
          readyToShipStepTitle: "",
          readyToShipStepBody: "",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: siteContentDefault("ready_to_ship_heading"),
      }),
    ).toBeInTheDocument();
    expect(stepTitles()).toEqual([
      siteContentDefault("ready_to_ship_step_title"),
      "It ships to you",
    ]);
    expect(
      screen.getByText(siteContentDefault("ready_to_ship_step_body")),
    ).toBeInTheDocument();
  });

  it("still explains a ready-to-ship product when the owner clears the dispatch note", () => {
    render(
      <ProcessPanel
        customization={READY_MADE_PRODUCT}
        content={{ ...content, readyToShipDispatchNote: "" }}
      />,
    );

    expect(stepTitles()).toEqual([
      content.readyToShipStepTitle,
      "It ships to you",
    ]);
    expect(screen.getByText(content.readyToShipStepBody)).toBeInTheDocument();
    expect(
      screen.queryByText(siteContentDefault("ready_to_ship_dispatch_note")),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(content.turnaroundNote)).not.toBeInTheDocument();
    expect(screen.getByRole("region")).not.toHaveTextContent(/made to order/i);
  });

  it("keeps the ready-to-ship wording off a made-to-order product (AC 2)", () => {
    render(<ProcessPanel customization={customizable()} content={content} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "How your order is made" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(content.readyToShipStepBody),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(content.readyToShipDispatchNote),
    ).not.toBeInTheDocument();
  });

  it("names every required input in the order the configurator asks", () => {
    render(
      <ProcessPanel
        customization={customizable({
          customization_text: "required",
          customization_notes: "required",
        })}
        content={content}
      />,
    );

    expect(
      screen.getByText(
        "Upload your artwork, add the text you want on it and tell us anything else about the piece.",
      ),
    ).toBeInTheDocument();
  });

  it("invites the optional inputs rather than instructing them", () => {
    render(
      <ProcessPanel
        customization={customizable({
          customization_text: "optional",
          customization_notes: "optional",
        })}
        content={content}
      />,
    );

    expect(
      screen.getByText(
        "Upload your artwork. You can also add the text you want on it or tell us anything else about the piece.",
      ),
    ).toBeInTheDocument();
  });

  it("drops the “also” when nothing is required", () => {
    render(
      <ProcessPanel
        customization={customizable({
          customization_artwork: "optional",
          customization_size: "optional",
        })}
        content={content}
      />,
    );

    expect(
      screen.getByText("You can upload your artwork or set a custom size."),
    ).toBeInTheDocument();
  });

  it("promises the resolution check only when artwork is asked for", () => {
    const { unmount } = render(
      <ProcessPanel customization={customizable()} content={content} />,
    );

    expect(screen.getByText(/sharp enough to print/i)).toBeInTheDocument();

    unmount();
    render(
      <ProcessPanel
        customization={customizable({
          customization_artwork: "off",
          customization_text: "required",
        })}
        content={content}
      />,
    );

    expect(
      screen.queryByText(/sharp enough to print/i),
    ).not.toBeInTheDocument();
  });

  it("carries the owner's turnaround and shipping lines", () => {
    render(<ProcessPanel customization={customizable()} content={content} />);

    expect(screen.getByText(content.turnaroundNote)).toBeInTheDocument();
    expect(screen.getByText(content.shippingWindowNote)).toBeInTheDocument();
  });

  it("still explains production and shipping when the owner clears the notes", () => {
    render(
      <ProcessPanel
        customization={customizable()}
        content={{ ...content, turnaroundNote: "", shippingWindowNote: "" }}
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
