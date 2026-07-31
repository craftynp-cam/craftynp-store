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
  it("opens on press and names the dialog from its title", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog", { name: "Shop" })).toBeInTheDocument();
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
