import { fireEvent, render, screen } from "@testing-library/react";

import { ProductDetailView } from "@/components";
import type { ProductDetail, ProductDetailVariant } from "@/lib/product";
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

const variants: ProductDetailVariant[] = [
  {
    id: "var_blush",
    sku: "KEYCHAIN-BLUSH",
    thumbnail: "https://example.com/blush.png",
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
    thumbnail: "https://example.com/sage.png",
    optionValueIds: ["val_sage"],
    availability: "in_stock" as const,
    price: "$12.00",
    originalPrice: undefined,
    calculatedAmount: 12,
    currencyCode: "usd",
  },
];

function makeProduct(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "prod_keychain",
    href: "/keychains/wildflower-acrylic-keychain",
    title: "Wildflower Acrylic Keychain",
    description: "Pressed wildflowers set in acrylic.",
    categoryName: "Keychains",
    categoryHandle: "keychains",
    images: [
      { url: "https://example.com/blush.png", alt: "Keychain, blush" },
      { url: "https://example.com/sage.png", alt: "Keychain, sage" },
    ],
    options,
    variants,
    ...overrides,
  };
}

function chooseBlush() {
  fireEvent.click(screen.getByRole("radio", { name: "Blush" }));
}

describe("ProductDetailView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
  });

  it("leaves a multi-value option unchosen and prices the product from its cheapest variant (AC 5)", () => {
    render(<ProductDetailView product={makeProduct()} />);

    expect(screen.getByRole("radio", { name: "Blush" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Sage" })).not.toBeChecked();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
  });

  it("chooses for the shopper only where an option has a single value", () => {
    const singleValue = [
      { id: "opt_color", title: "Color", values: [options[0]!.values[0]!] },
    ];

    render(
      <ProductDetailView
        product={makeProduct({
          options: singleValue,
          variants: [variants[0]!],
        })}
      />,
    );

    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  });

  it("holds add to cart shut until every option is chosen, naming what is left (AC 5)", () => {
    const twoOptions = [
      ...options,
      {
        id: "opt_size",
        title: "Size",
        values: [
          { id: "val_small", value: "Small" },
          { id: "val_large", value: "Large" },
        ],
      },
    ];
    const sized: ProductDetailVariant[] = [
      { ...variants[0]!, optionValueIds: ["val_blush", "val_small"] },
      { ...variants[1]!, optionValueIds: ["val_sage", "val_large"] },
    ];

    render(
      <ProductDetailView
        product={makeProduct({ options: twoOptions, variants: sized })}
      />,
    );

    expect(
      screen.getByText("Choose Color and Size to continue."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();

    chooseBlush();

    expect(screen.getByText("Choose Size to continue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Small" }));

    expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  });

  it("strikes through a value no in-stock variant can satisfy (AC 4)", () => {
    const soldOutSage = [
      variants[0]!,
      { ...variants[1]!, availability: "out_of_stock" as const },
    ];

    render(
      <ProductDetailView product={makeProduct({ variants: soldOutSage })} />,
    );

    expect(
      screen.getByRole("radio", { name: "Sage, sold out" }),
    ).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Blush" })).toBeEnabled();
  });

  it("disables add to cart when the only variant is out of stock", () => {
    const singleValue = [
      { id: "opt_color", title: "Color", values: [options[0]!.values[0]!] },
    ];

    render(
      <ProductDetailView
        product={makeProduct({
          options: singleValue,
          variants: [
            { ...variants[0]!, availability: "out_of_stock" as const },
          ],
        })}
      />,
    );

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();
  });

  it("shows the ready-to-ship badge", () => {
    render(<ProductDetailView product={makeProduct()} />);

    expect(screen.getByText(/ready to ship/i)).toBeInTheDocument();
  });

  it("adds the selected variant to the cart and opens the drawer", () => {
    render(<ProductDetailView product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    const cart = readCart();
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({
      id: "var_blush",
      title: "Wildflower Acrylic Keychain",
      unitPrice: 9,
      quantity: 1,
      details: [{ label: "Color", value: "Blush" }],
    });
    expect(readCartDrawerOpen()).toBe(true);
  });

  it("shows the savings badge for a variant on sale (AC 2)", () => {
    const saleVariants: ProductDetailVariant[] = [
      {
        ...variants[0]!,
        originalPrice: "$12.00",
        savingsLabel: "Save 25%",
      },
    ];

    render(
      <ProductDetailView product={makeProduct({ variants: saleVariants })} />,
    );

    chooseBlush();

    expect(screen.getByText("Save 25%")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
  });

  it("adds the quantity selected in the stepper", () => {
    render(<ProductDetailView product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(readCart().lines[0]?.quantity).toBe(2);
  });

  it("shows the unit price on the add to cart button at quantity 1", () => {
    render(<ProductDetailView product={makeProduct()} />);

    chooseBlush();

    expect(
      screen.getByRole("button", { name: "Add to cart · $9.00" }),
    ).toBeInTheDocument();
  });

  it("multiplies the add to cart button's price by the selected quantity", () => {
    render(<ProductDetailView product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(
      screen.getByRole("button", { name: "Add to cart · $27.00" }),
    ).toBeInTheDocument();
  });

  it("shows the selected variant's image as the main image", () => {
    render(<ProductDetailView product={makeProduct()} />);

    chooseBlush();
    expect(screen.getByAltText("Keychain, blush")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));

    expect(screen.getByAltText("Keychain, sage")).toBeInTheDocument();
    expect(screen.queryByAltText("Keychain, blush")).not.toBeInTheDocument();
  });

  it("falls back to the first product image for a variant with no thumbnail", () => {
    const unthumbnailed = variants.map((variant) =>
      variant.id === "var_sage" ? { ...variant, thumbnail: null } : variant,
    );

    render(
      <ProductDetailView product={makeProduct({ variants: unthumbnailed })} />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));

    expect(screen.getByAltText("Keychain, blush")).toBeInTheDocument();
  });

  it("adds the selected variant's image to the cart line", () => {
    render(<ProductDetailView product={makeProduct()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(readCart().lines[0]?.imageUrl).toBe("https://example.com/sage.png");
  });
});
