import { fireEvent, render, screen } from "@testing-library/react";

import { ProductPurchase } from "@/components";
import { clearCart, readCart } from "@/lib/cart";
import { readCartDrawerOpen, setCartDrawerOpen } from "@/lib/cart-drawer";

const options = [
  {
    id: "opt_color",
    title: "Color",
    values: [
      { id: "val_blush", value: "Blush" },
      { id: "val_sage", value: "Sage" },
    ],
  },
];

const variants = [
  {
    id: "var_blush",
    sku: "KEYCHAIN-BLUSH",
    optionValueIds: ["val_blush"],
    availability: "in_stock" as const,
    price: "$9.00",
    originalPrice: undefined,
    calculatedAmount: 9,
    currencyCode: "usd",
  },
  {
    id: "var_sage",
    sku: "KEYCHAIN-SAGE",
    optionValueIds: ["val_sage"],
    availability: "out_of_stock" as const,
    price: "$9.00",
    originalPrice: undefined,
    calculatedAmount: 9,
    currencyCode: "usd",
  },
];

describe("ProductPurchase", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
  });

  it("defaults to the first option value and shows its price", () => {
    render(
      <ProductPurchase
        title="Wildflower Acrylic Keychain"
        href="/keychains/wildflower-acrylic-keychain"
        options={options}
        variants={variants}
      />,
    );

    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
  });

  it("shows the ready-to-ship badge", () => {
    render(
      <ProductPurchase
        title="Wildflower Acrylic Keychain"
        href="/keychains/wildflower-acrylic-keychain"
        options={options}
        variants={variants}
      />,
    );

    expect(screen.getByText(/ready to ship/i)).toBeInTheDocument();
  });

  it("disables add to cart when the selected variant is out of stock (AC 3)", () => {
    render(
      <ProductPurchase
        title="Wildflower Acrylic Keychain"
        href="/keychains/wildflower-acrylic-keychain"
        options={options}
        variants={variants}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toBeDisabled();
  });

  it("adds the selected variant to the cart and opens the drawer", () => {
    render(
      <ProductPurchase
        title="Wildflower Acrylic Keychain"
        href="/keychains/wildflower-acrylic-keychain"
        options={options}
        variants={variants}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    const cart = readCart();
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({
      id: "var_blush",
      title: "Wildflower Acrylic Keychain",
      unitPrice: 9,
      quantity: 1,
    });
    expect(readCartDrawerOpen()).toBe(true);
  });

  it("shows the savings badge for a variant on sale (AC 2)", () => {
    const saleVariants = [
      {
        id: "var_blush",
        sku: "KEYCHAIN-BLUSH",
        optionValueIds: ["val_blush"],
        availability: "in_stock" as const,
        price: "$9.00",
        originalPrice: "$12.00",
        savingsLabel: "Save 25%",
        calculatedAmount: 9,
        currencyCode: "usd",
      },
    ];

    render(
      <ProductPurchase
        title="Wildflower Acrylic Keychain"
        href="/keychains/wildflower-acrylic-keychain"
        options={[options[0]!]}
        variants={saleVariants}
      />,
    );

    expect(screen.getByText("Save 25%")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
  });

  it("adds the quantity selected in the stepper", () => {
    render(
      <ProductPurchase
        title="Wildflower Acrylic Keychain"
        href="/keychains/wildflower-acrylic-keychain"
        options={options}
        variants={variants}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(readCart().lines[0]?.quantity).toBe(2);
  });
});
