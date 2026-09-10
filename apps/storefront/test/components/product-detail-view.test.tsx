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
    customization: READY_MADE_PRODUCT,
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

  it("answers a no-choice option itself and draws no group for it", () => {
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

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to cart/i })).toBeEnabled();
  });

  it("still carries a no-choice option through to the cart line", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(readCart().lines[0]?.details).toEqual([
      { label: "Color", value: "Blush" },
    ]);
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

  describe("a custom size", () => {
    const sizeOptions = [
      {
        id: "opt_size",
        title: "Size",
        values: [
          { id: "val_small", value: "Small" },
          { id: "val_large", value: "Large" },
          { id: "val_custom", value: "Custom" },
        ],
      },
    ];

    const sizeVariants: ProductDetailVariant[] = [
      "small",
      "large",
      "custom",
    ].map((name, index) => ({
      id: `var_${name}`,
      sku: `SIGN-${name.toUpperCase()}`,
      thumbnail: null,
      optionValueIds: [`val_${name}`],
      availability: "in_stock" as const,
      price: `$${10 + index}.00`,
      originalPrice: undefined,
      calculatedAmount: 10 + index,
      currencyCode: "usd",
    }));

    const customizable = resolveProductCustomization({
      customizable: "true",
      customization_size: "optional",
      customization_size_min_inches: "2",
      customization_size_max_inches: "48",
      customization_size_option: "Size",
      customization_size_option_value: "Custom",
    });

    function renderProduct() {
      render(
        <ProductDetailView
          product={makeProduct({
            options: sizeOptions,
            variants: sizeVariants,
            customization: customizable,
          })}
        />,
      );
    }

    function toggle() {
      return screen.getByRole("checkbox", { name: /enter my own size/i });
    }

    it("keeps the preset sizes pickable and the custom value out of them", () => {
      renderProduct();

      expect(screen.getByRole("radio", { name: "Small" })).toBeInTheDocument();
      expect(
        screen.queryByRole("radio", { name: "Custom" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/width/i)).not.toBeInTheDocument();
    });

    it("reveals the inputs and prices the custom variant once checked", () => {
      renderProduct();
      fireEvent.click(toggle());

      expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/height/i)).toBeInTheDocument();
      expect(screen.getByText("$12.00")).toBeInTheDocument();
    });

    it("restores the preset the shopper had chosen when unchecked", () => {
      renderProduct();
      fireEvent.click(screen.getByRole("radio", { name: "Large" }));

      fireEvent.click(toggle());
      expect(screen.getByRole("radio", { name: "Large" })).not.toBeChecked();

      fireEvent.click(toggle());
      expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();
      expect(screen.getByText("$11.00")).toBeInTheDocument();
    });

    it("will not add a custom size the shopper never entered", () => {
      renderProduct();
      fireEvent.click(screen.getByRole("radio", { name: "Small" }));
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeEnabled();

      fireEvent.click(toggle());

      expect(
        screen.getByText("Add a width and height to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeDisabled();
    });

    it("drops the preset group's availability note while it is disabled", () => {
      renderProduct();
      fireEvent.click(toggle());

      expect(
        screen.queryByText(/struck-through choices/i),
      ).not.toBeInTheDocument();
    });

    it("shows the range on the field and blocks add-to-cart while it is broken", () => {
      renderProduct();
      fireEvent.click(toggle());

      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "60" },
      });
      fireEvent.change(screen.getByLabelText(/height/i), {
        target: { value: "10" },
      });

      expect(
        screen.getByText("Enter a width between 2 and 48 inches."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "8" },
      });

      expect(
        screen.queryByText("Enter a width between 2 and 48 inches."),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeEnabled();
    });

    it("names the size once, as the dimensions rather than the Custom value", () => {
      renderProduct();
      fireEvent.click(toggle());
      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "8" },
      });
      fireEvent.change(screen.getByLabelText(/height/i), {
        target: { value: "10" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

      expect(readCart().lines[0]?.details).toEqual([
        { label: "Size", value: "8\u2033 \u00d7 10\u2033" },
      ]);
    });

    it("prices and sells the custom variant when the size is required outright", () => {
      const required = resolveProductCustomization({
        customizable: "true",
        customization_size: "required",
        customization_size_min_inches: "2",
        customization_size_max_inches: "48",
        customization_size_option: "Size",
        customization_size_option_value: "Custom",
      });

      render(
        <ProductDetailView
          product={makeProduct({
            options: sizeOptions,
            variants: sizeVariants,
            customization: required,
          })}
        />,
      );

      expect(
        screen.queryByRole("checkbox", { name: /enter my own size/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText(/width/i)).toBeInTheDocument();
      expect(screen.getByText("$12.00")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "8" },
      });
      fireEvent.change(screen.getByLabelText(/height/i), {
        target: { value: "10" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

      const line = readCart().lines[0];
      expect(line?.id).toBe("var_custom");
      expect(line?.unitPrice).toBe(12);
      expect(line?.details).toEqual([
        { label: "Size", value: "8\u2033 \u00d7 10\u2033" },
      ]);
    });

    it("keeps two custom sizes of one variant as two cart lines", () => {
      renderProduct();
      fireEvent.click(toggle());

      for (const width of ["8", "12"]) {
        fireEvent.change(screen.getByLabelText(/width/i), {
          target: { value: width },
        });
        fireEvent.change(screen.getByLabelText(/height/i), {
          target: { value: "10" },
        });
        fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
      }

      expect(readCart().lines).toHaveLength(2);
      expect(
        readCart().lines.map((line) => line.details?.at(-1)?.value),
      ).toEqual(["8\u2033 \u00d7 10\u2033", "12\u2033 \u00d7 10\u2033"]);
    });
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
      chooseBlush();

      expect(screen.queryByText(/make it yours/i)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeEnabled();
    });

    it("names the outstanding option and the missing input in one sentence", () => {
      render(
        <ProductDetailView
          product={makeProduct({ customization: textOnly })}
        />,
      );

      expect(
        screen.getByText(
          "Choose Color, then add your custom text to continue.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeDisabled();

      chooseBlush();

      expect(
        screen.getByText("Add your custom text to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeDisabled();

      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "Ellie" },
      });

      expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toBeEnabled();
    });

    it("carries the shopper's answers onto the cart line", () => {
      const everything = resolveProductCustomization({
        customizable: "true",
        customization_text: "required",
        customization_notes: "optional",
      });

      render(
        <ProductDetailView
          product={makeProduct({ customization: everything })}
        />,
      );

      chooseBlush();
      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "Ellie" },
      });
      fireEvent.change(screen.getByLabelText(/order notes/i), {
        target: { value: "Matte finish" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

      expect(readCart().lines[0]).toMatchObject({
        isCustomizable: true,
        details: [
          { label: "Color", value: "Blush" },
          { label: "Custom text", value: "Ellie" },
          { label: "Order notes", value: "Matte finish" },
        ],
      });
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
