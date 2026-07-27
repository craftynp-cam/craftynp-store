import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  Drawer,
  DrawerCloseButton,
  DrawerPanel,
  DrawerTitle,
  DrawerTrigger,
} from "@/components";

function Harness() {
  return (
    <Drawer>
      <DrawerTrigger>Open</DrawerTrigger>
      <DrawerPanel>
        {({ close }) => (
          <>
            <DrawerTitle>Shop</DrawerTitle>
            <DrawerCloseButton label="Close menu" />
            <button type="button" onClick={close}>
              Custom close
            </button>
          </>
        )}
      </DrawerPanel>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("renders nothing until the trigger is pressed", () => {
    render(<Harness />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on press and names the dialog from its title", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog", { name: "Shop" })).toBeInTheDocument();
  });

  it("flips aria-expanded on the trigger", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Escape", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes via the close button, which is labelled by the caller, not HeroUI's default", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    const closeButton = screen.getByRole("button", { name: "Close menu" });
    expect(
      screen.queryByRole("button", { name: "Close" }),
    ).not.toBeInTheDocument();

    fireEvent.click(closeButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to the trigger after closing", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    // React Aria's FocusScope captures whatever was focused right before it
    // mounts as the element to restore to. fireEvent.click alone never
    // focuses the target the way a real pointer or keyboard interaction
    // would, so the trigger has to be focused explicitly first.
    act(() => trigger.focus());
    fireEvent.click(trigger);

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(trigger).toHaveFocus();
  });

  it("locks background scroll while open and restores it after close", () => {
    render(<Harness />);
    expect(document.documentElement.style.overflow).not.toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(document.documentElement.style.overflow).toBe("hidden");

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });

  it("hides content outside the overlay from assistive technology while open", () => {
    render(
      <>
        <p data-testid="outside">Outside content</p>
        <Harness />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    // Proxy for focus containment: jsdom has no sequential focus navigation,
    // so simulating Tab proves nothing. React Aria's ariaHideOutside marks
    // everything outside the overlay aria-hidden while it's open instead —
    // jsdom has no native `inert` reflection, so it falls back to that
    // rather than the `inert` attribute a real browser would get.
    expect(
      screen.getByTestId("outside").closest('[aria-hidden="true"]'),
    ).not.toBeNull();

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(
      screen.getByTestId("outside").closest('[aria-hidden="true"]'),
    ).toBeNull();
  });

  it("hides every icon glyph in the dialog from assistive technology", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    const icons = screen.getByRole("dialog").querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });
});
