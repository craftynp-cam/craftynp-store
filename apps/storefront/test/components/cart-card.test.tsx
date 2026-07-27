import { fireEvent, render, screen } from "@testing-library/react";

import { CartCard } from "@/components";
import type { CartLine } from "@/lib/cart";

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: "sticker",
    href: "/products/sticker",
    title: "Custom Die-Cut Stickers",
    unitPrice: 0.75,
    currencyCode: "usd",
    quantity: 2,
    ...overrides,
  };
}

describe("CartCard", () => {
  it("shows the ready-to-ship badge for a non-customizable line", () => {
    render(
      <CartCard
        line={makeLine()}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText(/ready to ship/i)).toBeInTheDocument();
    expect(screen.queryByText(/customizable/i)).not.toBeInTheDocument();
  });

  it("shows the customizable badge that matches the product card's", () => {
    render(
      <CartCard
        line={makeLine({ isCustomizable: true })}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText(/customizable/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready to ship/i)).not.toBeInTheDocument();
  });

  it("renders no detail panel when there are no customization details", () => {
    render(
      <CartCard
        line={makeLine()}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.queryByRole("term")).not.toBeInTheDocument();
  });

  it("renders customization details as key/value pairs, truncated with the full value in title", () => {
    const longValue = "a".repeat(200);
    render(
      <CartCard
        line={makeLine({
          isCustomizable: true,
          details: [
            { label: "Size", value: '3" · matte' },
            { label: "File", value: longValue },
          ],
        })}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText("Size:")).toBeInTheDocument();
    expect(screen.getByText('3" · matte')).toBeInTheDocument();
    const truncated = screen.getByText(longValue);
    expect(truncated).toHaveClass("truncate");
    expect(truncated).toHaveAttribute("title", longValue);
  });

  it("shows the line total as unit price times quantity", () => {
    render(
      <CartCard
        line={makeLine({ unitPrice: 0.75, quantity: 4 })}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText("$3.00")).toBeInTheDocument();
  });

  it("calls onQuantityChange when the stepper changes", () => {
    const onQuantityChange = jest.fn();
    render(
      <CartCard
        line={makeLine({ id: "sticker" })}
        onQuantityChange={onQuantityChange}
        onRemove={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(onQuantityChange).toHaveBeenCalledWith("sticker", 3);
  });

  it("names the remove control with the product title and calls onRemove", () => {
    const onRemove = jest.fn();
    render(
      <CartCard
        line={makeLine({ id: "sticker", title: "Custom Die-Cut Stickers" })}
        onQuantityChange={jest.fn()}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Custom Die-Cut Stickers from cart",
      }),
    );

    expect(onRemove).toHaveBeenCalledWith("sticker");
  });

  it("links the title to the product", () => {
    render(
      <CartCard
        line={makeLine()}
        onQuantityChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Custom Die-Cut Stickers" }),
    ).toHaveAttribute("href", "/products/sticker");
  });

  describe("loading state", () => {
    it("renders skeletons instead of a link or product content", () => {
      const { container } = render(<CartCard isLoading />);

      expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("is hidden from assistive technology, since it names no line yet", () => {
      const { container } = render(<CartCard isLoading />);

      expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    });
  });
});
