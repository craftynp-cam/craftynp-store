import { fireEvent, render, screen } from "@testing-library/react";

import { ProductDetailView } from "@/components";
import {
  READY_MADE_PRODUCT,
  resolveProductCustomization,
} from "@craftynp/types";
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
    availability: "out_of_stock" as const,
    price: "$9.00",
    originalPrice: undefined,
    calculatedAmount: 9,
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
    customization: READY_MADE_PRODUCT,
    ...overrides,
  };
}

describe("ProductDetailView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
  });

  it("defaults to the first option value and shows its price", () => {
    render(<ProductDetailView product={makeProduct()} />);

    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
  });

  it("shows the ready-to-ship badge", () => {
    render(<ProductDetailView product={makeProduct()} />);

    expect(screen.getByText(/ready to ship/i)).toBeInTheDocument();
  });

  it("disables add to cart when the selected variant is out of stock (AC 3)", () => {
    render(<ProductDetailView product={makeProduct()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeDisabled();
  });

  it("adds the selected variant to the cart and opens the drawer", () => {
    render(<ProductDetailView product={makeProduct()} />);

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
    const saleVariants: ProductDetailVariant[] = [
      {
        id: "var_blush",
        sku: "KEYCHAIN-BLUSH",
        thumbnail: null,
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
      <ProductDetailView product={makeProduct({ variants: saleVariants })} />,
    );

    expect(screen.getByText("Save 25%")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
  });

  it("adds the quantity selected in the stepper", () => {
    render(<ProductDetailView product={makeProduct()} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(readCart().lines[0]?.quantity).toBe(2);
  });

  it("shows the unit price on the add to cart button at quantity 1", () => {
    render(<ProductDetailView product={makeProduct()} />);

    expect(
      screen.getByRole("button", { name: "Add to cart · $9.00" }),
    ).toBeInTheDocument();
  });

  it("multiplies the add to cart button's price by the selected quantity", () => {
    render(<ProductDetailView product={makeProduct()} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(
      screen.getByRole("button", { name: "Add to cart · $27.00" }),
    ).toBeInTheDocument();
  });

  it("shows the selected variant's image as the main image", () => {
    render(<ProductDetailView product={makeProduct()} />);

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
    const inStock = variants.map((variant) =>
      variant.id === "var_sage"
        ? { ...variant, availability: "in_stock" as const }
        : variant,
    );

    render(<ProductDetailView product={makeProduct({ variants: inStock })} />);

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(readCart().lines[0]?.imageUrl).toBe("https://example.com/sage.png");
  });

  describe("a customizable product", () => {
    const textOnly = resolveProductCustomization({
      customizable: "true",
      customization_text: "required",
    });

    it("renders only the inputs the product declares", () => {
      render(
        <ProductDetailView
          product={makeProduct({
            customization: resolveProductCustomization({
              customizable: "true",
              customization_artwork: "optional",
              customization_notes: "optional",
            }),
          })}
        />,
      );

      expect(screen.getByText(/your artwork/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/order notes/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/custom text/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/width/i)).not.toBeInTheDocument();
    });

    it("renders nothing extra for a product that declares nothing (AC 6)", () => {
      render(<ProductDetailView product={makeProduct()} />);

      expect(screen.queryByText(/make it yours/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeEnabled();
    });

    it("holds add to cart until every required input is satisfied", () => {
      render(
        <ProductDetailView
          product={makeProduct({ customization: textOnly })}
        />,
      );

      const addToCart = screen.getByRole("button", { name: /add to cart/i });
      expect(addToCart).toBeDisabled();
      expect(screen.getByText(/add your custom text/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "Ellie" },
      });

      expect(addToCart).toBeEnabled();
    });

    it("marks the cart line customizable", () => {
      render(
        <ProductDetailView
          product={makeProduct({ customization: textOnly })}
        />,
      );

      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "Ellie" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

      expect(readCart().lines[0]?.isCustomizable).toBe(true);
    });

    it("shows the made-to-order badge in place of ready to ship", () => {
      render(
        <ProductDetailView
          product={makeProduct({ customization: textOnly })}
        />,
      );

      expect(screen.getByText(/made to order/i)).toBeInTheDocument();
      expect(screen.queryByText(/ready to ship/i)).not.toBeInTheDocument();
    });
  });
});
