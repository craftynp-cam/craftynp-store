import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { ProductDetailView } from "@/components";
import {
  CUSTOM_TEXT_FALLBACK_MAX_LENGTH,
  CUSTOM_TEXT_MAX_LENGTH_METADATA_KEY,
  ORDER_NOTES_MAX_LENGTH,
  resolveProductCustomization,
} from "@craftynp/types";
import type { ProductDetailVariant } from "@/lib/product";
import { clearCart, readCart } from "@/lib/cart";
import { readCartDrawerOpen, setCartDrawerOpen } from "@/lib/cart-drawer";
import {
  AREA_RATE_PER_SQ_INCH,
  chooseBlush,
  clickAddToCart,
  makeProduct,
  mockPriceQuote,
  options,
  processNotes,
  settlePrice,
  stubObjectUrls,
  uploadArtworkOfWidth,
  variants,
} from "../support/product-detail";

const mockRouterReplace = jest.fn();
let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => searchParams,
}));

// The only way artwork reaches the configurator draft is a real upload, so the
// transport is doubled and the file is chosen through the control itself.
// Mocked by its own path rather than the @/ alias: this jest config maps the
// alias for imports but not for jest.mock's own resolution.
jest.mock("../../src/lib/artwork-upload", () => {
  const actual = jest.requireActual("../../src/lib/artwork-upload");
  return { ...actual, uploadArtwork: jest.fn() };
});

// The configurator is priced by the backend now, so the quote is doubled the
// way the artwork transport is. The debounce is flattened because the wait is
// the component's, not the assertion's — leaving it in makes every add-to-cart
// test sleep for no extra coverage.
jest.mock("../../src/lib/price-quote", () => ({
  ...jest.requireActual("../../src/lib/price-quote"),
  PRICE_QUOTE_DEBOUNCE_MS: 0,
}));

describe("ProductDetailView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
    searchParams = new URLSearchParams();
    mockRouterReplace.mockClear();
    mockPriceQuote();
  });

  it("leaves a multi-value option unchosen and prices the product from its cheapest variant (AC 5)", () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    expect(screen.getByRole("radio", { name: "Blush" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Sage" })).not.toBeChecked();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("$9.00")).toBeInTheDocument();
  });

  it("keeps add to cart focusable while blocked, described by what is outstanding", () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    const button = screen.getByRole("button", { name: /add to cart/i });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Choose Color to continue.");
  });

  it("takes a blocked press to the first outstanding option and adds nothing", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    });

    expect(screen.getByRole("radio", { name: "Blush" })).toHaveFocus();
    expect(readCart().lines).toHaveLength(0);
    expect(readCartDrawerOpen()).toBe(false);
  });

  it("takes a blocked press to an empty required input once the options are chosen", async () => {
    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({
          customization: resolveProductCustomization({
            customizable: "true",
            customization_text: "required",
          }),
        })}
      />,
    );
    chooseBlush();
    await clickAddToCart();

    expect(screen.getByLabelText(/custom text/i)).toHaveFocus();
    expect(readCart().lines).toHaveLength(0);
  });

  it("says nothing about a price the shopper did not ask for", async () => {
    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({
          options: [
            {
              id: "opt_color",
              title: "Color",
              values: [options[0]!.values[0]!],
            },
          ],
          variants: [variants[0]!],
        })}
      />,
    );
    await settlePrice();

    expect(screen.getByText("$9.00")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("status")
        .some((region) => region.textContent?.includes("$9.00")),
    ).toBe(false);
  });

  it("announces the settled price politely once the shopper changes the line", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);
    chooseBlush();
    await settlePrice();

    expect(screen.getByText("Price: $9.00")).toHaveAttribute("role", "status");
  });

  it("announces a price that could not be worked out", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);
    global.fetch = jest.fn(async () => ({ ok: false }) as Response);
    chooseBlush();
    await settlePrice();

    expect(
      screen.getByText("We could not price this just now."),
    ).toHaveAttribute("role", "status");
  });

  it("answers a no-choice option itself and draws no group for it", async () => {
    const singleValue = [
      { id: "opt_color", title: "Color", values: [options[0]!.values[0]!] },
    ];

    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({
          options: singleValue,
          variants: [variants[0]!],
        })}
      />,
    );

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();

    await settlePrice();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("still carries a no-choice option through to the cart line", async () => {
    const singleValue = [
      { id: "opt_color", title: "Color", values: [options[0]!.values[0]!] },
    ];

    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({
          options: singleValue,
          variants: [variants[0]!],
        })}
      />,
    );

    await clickAddToCart();

    expect(readCart().lines[0]?.details).toEqual([
      { label: "Color", value: "Blush" },
    ]);
  });

  it("holds add to cart shut until every option is chosen, naming what is left (AC 5)", async () => {
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
        {...processNotes}
        product={makeProduct({ options: twoOptions, variants: sized })}
      />,
    );

    expect(
      screen.getByText("Choose Color and Size to continue."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toHaveAttribute("aria-disabled", "true");

    chooseBlush();

    expect(screen.getByText("Choose Size to continue.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("radio", { name: "Small" }));

    expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();
    await settlePrice();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("strikes through a value no in-stock variant can satisfy (AC 4)", () => {
    const soldOutSage = [
      variants[0]!,
      { ...variants[1]!, availability: "out_of_stock" as const },
    ];

    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({ variants: soldOutSage })}
      />,
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
        {...processNotes}
        product={makeProduct({
          options: singleValue,
          variants: [
            { ...variants[0]!, availability: "out_of_stock" as const },
          ],
        })}
      />,
    );

    expect(screen.getByText(/out of stock/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the ready-to-ship badge", () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    expect(screen.getByText(/ready to ship/i)).toBeInTheDocument();
  });

  it("adds the selected variant to the cart and opens the drawer", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    await clickAddToCart();

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
      <ProductDetailView
        {...processNotes}
        product={makeProduct({ variants: saleVariants })}
      />,
    );

    chooseBlush();

    expect(screen.getByText("Save 25%")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
  });

  it("adds the quantity selected in the stepper", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await clickAddToCart();

    expect(readCart().lines[0]?.quantity).toBe(2);
  });

  it("starts the quantity at the product's minimum (AC 2)", () => {
    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({ minOrderQuantity: 50 })}
      />,
    );

    expect(
      screen.getByRole("spinbutton", {
        name: "Quantity for Wildflower Acrylic Keychain",
      }),
    ).toHaveValue(50);
    expect(
      screen.getByRole("button", { name: "Decrease quantity" }),
    ).toBeDisabled();
  });

  it("names the minimum to the shopper rather than only disabling decrement (AC 2)", () => {
    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({ minOrderQuantity: 50 })}
      />,
    );

    expect(
      screen.getByRole("spinbutton", {
        name: "Quantity for Wildflower Acrylic Keychain",
      }),
    ).toHaveAccessibleDescription("Minimum order: 50");
  });

  it("carries the minimum onto the cart line, so the drawer holds it too", async () => {
    render(
      <ProductDetailView
        {...processNotes}
        product={makeProduct({ minOrderQuantity: 50 })}
      />,
    );

    chooseBlush();
    await clickAddToCart();

    expect(readCart().lines[0]?.quantity).toBe(50);
    expect(readCart().lines[0]?.minOrderQuantity).toBe(50);
  });

  it("shows the quoted price on the add to cart button at quantity 1", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    await settlePrice();

    expect(
      screen.getByRole("button", { name: "Add to cart · $9.00" }),
    ).toBeInTheDocument();
  });

  it("disables add to cart and dims the price while a quote is in flight", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();

    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toHaveAttribute("aria-disabled", "true");
    // The last good price stays on screen rather than blanking, so the panel
    // never reads as broken while it recalculates.
    expect(screen.getByText("$9.00")).toBeInTheDocument();

    await settlePrice();
    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("shows the unit price beside the line total once more than one is ordered", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await settlePrice();

    expect(screen.getByText("$9.00 each")).toBeInTheDocument();
    expect(screen.getByText("2 for $18.00")).toBeInTheDocument();
  });

  it("takes the quantity break the backend quotes rather than multiplying itself", async () => {
    // Half price from two up — a tier the panel could not have worked out on
    // its own, which is the point: the number comes from the backend.
    global.fetch = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
      const body: { quantity: number } = JSON.parse(String(init?.body ?? "{}"));
      const unitAmount = body.quantity > 1 ? 4.5 : 9;
      return {
        ok: true,
        json: () =>
          Promise.resolve({
            unitAmount,
            lineTotal: unitAmount * body.quantity,
            originalUnitAmount: null,
            currencyCode: "usd",
            isAreaPriced: false,
            quoteToken: "tiered",
          }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await clickAddToCart();

    expect(screen.getByText("$4.50 each")).toBeInTheDocument();
    expect(readCart().lines[0]?.unitPrice).toBe(4.5);
  });

  it("keeps add to cart shut when the backend cannot price the line", async () => {
    global.fetch = jest.fn(async () =>
      Promise.resolve({ ok: false } as unknown as Response),
    ) as unknown as typeof fetch;

    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    await settlePrice();

    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText(/try again — we could not price this/i),
    ).toBeInTheDocument();
  });

  it("re-quotes the line total when the quantity changes", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    chooseBlush();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    await settlePrice();

    expect(
      screen.getByRole("button", { name: "Add to cart · $27.00" }),
    ).toBeInTheDocument();
  });

  it("shows the selected variant's image as the main image", () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

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
      <ProductDetailView
        {...processNotes}
        product={makeProduct({ variants: unthumbnailed })}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));

    expect(screen.getByAltText("Keychain, blush")).toBeInTheDocument();
  });

  it("adds the selected variant's image to the cart line", async () => {
    render(<ProductDetailView {...processNotes} product={makeProduct()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Sage" }));
    await clickAddToCart();

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

    beforeEach(() => {
      mockPriceQuote(sizeVariants);
    });

    function renderProduct() {
      render(
        <ProductDetailView
          {...processNotes}
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

    it("groups the custom size under its own name, apart from the preset sizes", () => {
      renderProduct();

      expect(
        screen.getByRole("radiogroup", { name: /^size/i }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("group", { name: "Custom size" })).getByRole(
          "checkbox",
          { name: /enter my own size/i },
        ),
      ).toBeInTheDocument();
    });

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

    it("will not add a custom size the shopper never entered", async () => {
      renderProduct();
      fireEvent.click(screen.getByRole("radio", { name: "Small" }));
      await settlePrice();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");

      fireEvent.click(toggle());

      expect(
        screen.getByText("Add a width and height to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("drops the preset group's availability note while it is disabled", () => {
      renderProduct();
      fireEvent.click(toggle());

      expect(
        screen.queryByText(/struck-through choices/i),
      ).not.toBeInTheDocument();
    });

    it("shows the range on the field and blocks add-to-cart while it is broken", async () => {
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
      ).toHaveAttribute("aria-disabled", "true");

      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "8" },
      });

      expect(
        screen.queryByText("Enter a width between 2 and 48 inches."),
      ).not.toBeInTheDocument();
      await settlePrice();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("names the size once, as the dimensions rather than the Custom value", async () => {
      renderProduct();
      fireEvent.click(toggle());
      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "8" },
      });
      fireEvent.change(screen.getByLabelText(/height/i), {
        target: { value: "10" },
      });
      await clickAddToCart();

      expect(readCart().lines[0]?.details).toEqual([
        { label: "Size", value: "8\u2033 \u00d7 10\u2033" },
      ]);
    });

    it("prices and sells the custom variant when the size is required outright", async () => {
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
          {...processNotes}
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
      await clickAddToCart();

      const line = readCart().lines[0];
      expect(line?.id).toBe("var_custom");
      // The area price the backend quoted for 8 x 10, not the Custom
      // variant's own $12 — that variant price is only the formula's base.
      expect(line?.unitPrice).toBe(12 * AREA_RATE_PER_SQ_INCH * 8 * 10);
      expect(line?.priceQuoteToken).toBe("quote-var_custom-1");
      expect(line?.details).toEqual([
        { label: "Size", value: "8\u2033 \u00d7 10\u2033" },
      ]);
    });

    it("keeps two custom sizes of one variant as two cart lines", async () => {
      renderProduct();
      fireEvent.click(toggle());

      for (const width of ["8", "12"]) {
        fireEvent.change(screen.getByLabelText(/width/i), {
          target: { value: width },
        });
        fireEvent.change(screen.getByLabelText(/height/i), {
          target: { value: "10" },
        });
        await clickAddToCart();
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

    it("names the configurator as a region of the page", () => {
      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: textOnly })}
        />,
      );

      expect(
        within(screen.getByRole("region", { name: "Make it yours" })).getByRole(
          "textbox",
          { name: /custom text/i },
        ),
      ).toBeInTheDocument();
    });

    it("renders only the inputs the product declares", () => {
      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({
            customization: resolveProductCustomization({
              customizable: "true",
              customization_artwork: "optional",
              customization_notes: "optional",
            }),
          })}
        />,
      );

      expect(screen.getByText(/^your artwork/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/order notes/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/custom text/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/width/i)).not.toBeInTheDocument();
    });

    it("renders nothing extra for a product that declares nothing (AC 6)", async () => {
      render(<ProductDetailView {...processNotes} product={makeProduct()} />);
      chooseBlush();

      expect(screen.queryByText(/make it yours/i)).not.toBeInTheDocument();
      await settlePrice();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("names the outstanding option and the missing input in one sentence", async () => {
      render(
        <ProductDetailView
          {...processNotes}
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
      ).toHaveAttribute("aria-disabled", "true");

      chooseBlush();

      expect(
        screen.getByText("Add your custom text to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toHaveAttribute("aria-disabled", "true");

      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "Ellie" },
      });

      expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();
      await settlePrice();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("holds the one gate shut while the custom text runs past its limit", async () => {
      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: textOnly })}
        />,
      );

      chooseBlush();
      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "a".repeat(CUSTOM_TEXT_FALLBACK_MAX_LENGTH + 1) },
      });

      expect(
        screen.getByText("Shorten your custom text to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toHaveAttribute("aria-disabled", "true");

      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "a".repeat(CUSTOM_TEXT_FALLBACK_MAX_LENGTH) },
      });

      expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument();
      await settlePrice();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("counts the custom text against the limit the owner configured", () => {
      const shortLimit = resolveProductCustomization({
        customizable: "true",
        customization_text: "required",
        [CUSTOM_TEXT_MAX_LENGTH_METADATA_KEY]: "20",
      });

      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: shortLimit })}
        />,
      );

      chooseBlush();
      expect(screen.getByText("Up to 20 characters.")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "a".repeat(21) },
      });

      expect(
        screen.getByText("Shorten your custom text to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    // Both configurator fields are one component, so what is worth pinning is
    // that each is wired to its own limit and its own words.
    it("blocks a line break in the custom text, and says what to do", () => {
      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: textOnly })}
        />,
      );

      chooseBlush();
      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "Happy\nBirthday" },
      });

      expect(
        screen.getByText("Keep your custom text to one line to continue."),
      ).toBeInTheDocument();
      expect(screen.getByText("Keep this to one line.")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("gives each text field its own required message", () => {
      const both = resolveProductCustomization({
        customizable: "true",
        customization_text: "required",
        customization_notes: "required",
      });

      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: both })}
        />,
      );

      const notes = screen.getByLabelText(/order notes/i);
      act(() => notes.focus());
      act(() => notes.blur());

      expect(
        screen.getByText(/tell us what you'd like us to know/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/enter the text you'd like/i)).toBeNull();
    });

    it("holds the same gate shut while the order notes run long", async () => {
      const notes = resolveProductCustomization({
        customizable: "true",
        customization_notes: "optional",
      });

      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: notes })}
        />,
      );

      chooseBlush();
      fireEvent.change(screen.getByLabelText(/order notes/i), {
        target: { value: "a".repeat(ORDER_NOTES_MAX_LENGTH + 1) },
      });

      expect(
        screen.getByText("Shorten your order notes to continue."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).toHaveAttribute("aria-disabled", "true");

      fireEvent.change(screen.getByLabelText(/order notes/i), {
        target: { value: "Matte finish" },
      });

      await settlePrice();
      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("carries the shopper's answers onto the cart line", async () => {
      const everything = resolveProductCustomization({
        customizable: "true",
        customization_text: "required",
        customization_notes: "optional",
      });

      render(
        <ProductDetailView
          {...processNotes}
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
      await clickAddToCart();

      expect(readCart().lines[0]).toMatchObject({
        isCustomizable: true,
        details: [
          { label: "Color", value: "Blush" },
          { label: "Custom text", value: "Ellie" },
          { label: "Order notes", value: "Matte finish" },
        ],
      });
    });

    it("carries a multi-line order note through to the cart line", async () => {
      const withNotes = resolveProductCustomization({
        customizable: "true",
        customization_notes: "optional",
      });

      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: withNotes })}
        />,
      );

      chooseBlush();
      fireEvent.change(screen.getByLabelText(/order notes/i), {
        target: {
          value: "Match the sage green.\r\n\r\nNeeded before the 14th.",
        },
      });
      await clickAddToCart();

      expect(readCart().lines[0]?.details).toEqual([
        { label: "Color", value: "Blush" },
        {
          label: "Order notes",
          value: "Match the sage green.\n\nNeeded before the 14th.",
        },
      ]);
    });

    describe("artwork resolution", () => {
      // jsdom implements neither, and ArtworkUpload builds a preview from the
      // chosen file the moment it is accepted.
      beforeEach(() => {
        stubObjectUrls();
      });

      const artworkAndSize = resolveProductCustomization({
        customizable: "true",
        customization_artwork: "required",
        customization_size: "optional",
        customization_size_min_inches: "1",
        customization_size_max_inches: "48",
        customization_size_option: "Size",
        customization_size_option_value: "Custom",
      });

      const sizeOptions = [
        {
          id: "opt_size",
          title: "Size",
          values: [
            { id: "val_small", value: "Small", widthInches: 3 },
            { id: "val_large", value: "Large", widthInches: 12 },
            { id: "val_custom", value: "Custom" },
          ],
        },
      ];

      const sizeVariants: ProductDetailVariant[] = [
        {
          id: "var_small",
          sku: "S",
          thumbnail: null,
          optionValueIds: ["val_small"],
          availability: "in_stock" as const,
          price: "$9.00",
          calculatedAmount: 9,
          currencyCode: "usd",
        },
        {
          id: "var_large",
          sku: "L",
          thumbnail: null,
          optionValueIds: ["val_large"],
          availability: "in_stock" as const,
          price: "$19.00",
          calculatedAmount: 19,
          currencyCode: "usd",
        },
        {
          id: "var_custom",
          sku: "C",
          thumbnail: null,
          optionValueIds: ["val_custom"],
          availability: "in_stock" as const,
          price: "$29.00",
          calculatedAmount: 29,
          currencyCode: "usd",
        },
      ];

      function renderSized() {
        render(
          <ProductDetailView
            {...processNotes}
            product={makeProduct({
              customization: artworkAndSize,
              options: sizeOptions,
              variants: sizeVariants,
              artworkMinDpi: 300,
            })}
          />,
        );
      }

      function chooseSize(name: string) {
        fireEvent.click(screen.getByRole("radio", { name }));
      }

      it("tells the shopper the resolution needed before they upload (AC 9)", () => {
        renderSized();
        chooseSize("Small");

        expect(
          screen.getByRole("button", { name: "Choose a file" }),
        ).toHaveAccessibleDescription(/900 pixels across \(300 DPI\)/);
      });

      it("holds add to cart shut on a file below the floor, and says why (AC 6, AC 7)", async () => {
        renderSized();
        chooseSize("Small");
        await uploadArtworkOfWidth(300);

        expect(screen.getByRole("alert")).toHaveTextContent(/100 DPI/);
        expect(screen.getByRole("alert")).toHaveTextContent(/at least 300 DPI/);
        expect(
          screen.getByText(
            "Replace your artwork with a higher-resolution file to continue.",
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).toHaveAttribute("aria-disabled", "true");
      });

      it("re-blocks a passing file when the ordered size grows (AC 8)", async () => {
        renderSized();
        chooseSize("Small");
        await uploadArtworkOfWidth(900);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await settlePrice();
        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).not.toHaveAttribute("aria-disabled");

        chooseSize("Large");

        expect(screen.getByRole("alert")).toHaveTextContent(/at least 300 DPI/);
        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).toHaveAttribute("aria-disabled", "true");
      });

      it("measures against the size the shopper types once custom is on", async () => {
        renderSized();
        chooseSize("Small");
        await uploadArtworkOfWidth(900);

        fireEvent.click(screen.getByRole("checkbox", { name: /my own size/i }));
        fireEvent.change(screen.getByLabelText(/width/i), {
          target: { value: "9" },
        });
        fireEvent.change(screen.getByLabelText(/height/i), {
          target: { value: "9" },
        });

        expect(screen.getByRole("alert")).toHaveTextContent(/at least 300 DPI/);
        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).toHaveAttribute("aria-disabled", "true");
      });

      it("lets a shopper past an optional file that failed by removing it", async () => {
        // The gate blocks a coarse file whatever the declared mode, so an
        // optional one needs a way out that is not "upload something better".
        render(
          <ProductDetailView
            {...processNotes}
            product={makeProduct({
              customization: resolveProductCustomization({
                customizable: "true",
                customization_artwork: "optional",
              }),
              options: sizeOptions,
              variants: sizeVariants,
              artworkMinDpi: 300,
            })}
          />,
        );
        chooseSize("Small");
        await uploadArtworkOfWidth(300);

        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).toHaveAttribute("aria-disabled", "true");

        fireEvent.click(screen.getByRole("button", { name: /remove file/i }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await settlePrice();
        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).not.toHaveAttribute("aria-disabled");
      });

      it("carries the artwork reference onto the cart line", async () => {
        renderSized();
        chooseSize("Small");
        await uploadArtworkOfWidth(900);
        await clickAddToCart();

        const line = readCart().lines[0];
        expect(line?.customization?.artwork).toEqual({
          storageKey: "staging/upload-1.png",
          fileName: "screenshot.png",
          mimeType: "image/png",
          sizeBytes: 51_200,
          widthPx: 900,
          heightPx: 900,
        });
        expect(line?.details).toContainEqual({
          label: "Artwork",
          value: "screenshot.png",
        });
      });

      it("does not gate a preset the owner has never measured", async () => {
        // Without a physical width there is no DPI to work out, and refusing
        // every upload on a product mid-setup would be worse than not gating.
        render(
          <ProductDetailView
            {...processNotes}
            product={makeProduct({
              customization: resolveProductCustomization({
                customizable: "true",
                customization_artwork: "required",
              }),
              artworkMinDpi: 300,
            })}
          />,
        );
        chooseBlush();
        await uploadArtworkOfWidth(10);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        await settlePrice();
        expect(
          screen.getByRole("button", { name: /add to cart/i }),
        ).not.toHaveAttribute("aria-disabled");
      });
    });

    it("shows the made-to-order badge in place of ready to ship", () => {
      render(
        <ProductDetailView
          {...processNotes}
          product={makeProduct({ customization: textOnly })}
        />,
      );

      expect(screen.getByText("Made to order")).toBeInTheDocument();
      expect(screen.queryByText(/ready to ship/i)).not.toBeInTheDocument();
    });
  });
});

describe("ProductDetailView editing a cart line", () => {
  // jsdom implements neither, and the upload flow reports a failed upload
  // without them.
  beforeAll(() => {
    stubObjectUrls();
  });

  const customizable = resolveProductCustomization({
    customizable: "true",
    customization_text: "required",
  });

  function editableProduct() {
    return makeProduct({ customization: customizable });
  }

  async function seedLine() {
    render(<ProductDetailView {...processNotes} product={editableProduct()} />);
    chooseBlush();
    fireEvent.change(screen.getByLabelText(/custom text/i), {
      target: { value: "The Wrights" },
    });
    await clickAddToCart();

    const line = readCart().lines[0];
    if (!line) throw new Error("nothing was added to the cart");
    return line;
  }

  function openEditor(lineId: string) {
    searchParams = new URLSearchParams({ edit: lineId });
    render(<ProductDetailView {...processNotes} product={editableProduct()} />);
  }

  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
    searchParams = new URLSearchParams();
    mockRouterReplace.mockClear();
    mockPriceQuote();
  });

  it("reopens the configurator on what was saved, and offers to save rather than add", async () => {
    const line = await seedLine();
    cleanup();
    openEditor(line.lineId);

    expect(screen.getByLabelText(/custom text/i)).toHaveValue("The Wrights");
    expect(screen.getByRole("radio", { name: "Blush" })).toBeChecked();
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add to cart/i }),
    ).not.toBeInTheDocument();
  });

  it("updates that line rather than adding a second one, and repriced", async () => {
    const line = await seedLine();
    cleanup();
    openEditor(line.lineId);

    fireEvent.change(screen.getByLabelText(/custom text/i), {
      target: { value: "The Wright Family" },
    });
    await settlePrice();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    const lines = readCart().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.lineId).toBe(line.lineId);
    expect(lines[0]?.details).toContainEqual({
      label: "Custom text",
      value: "The Wright Family",
    });
    expect(lines[0]?.priceQuoteToken).toBeDefined();
    expect(mockRouterReplace).toHaveBeenCalledWith(editableProduct().href);
  });

  it("leaves the line untouched when the edit is cancelled", async () => {
    const line = await seedLine();
    const before = readCart();
    cleanup();
    openEditor(line.lineId);

    fireEvent.change(screen.getByLabelText(/custom text/i), {
      target: { value: "Something else entirely" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    expect(readCart()).toEqual(before);
    expect(mockRouterReplace).toHaveBeenCalledWith(editableProduct().href);
  });

  it("falls back to adding when the line named by the query is gone", async () => {
    openEditor("line-nobody-holds");

    expect(
      screen.getByRole("button", { name: /add to cart/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/custom text/i)).toHaveValue("");
  });

  it("brings a saved artwork file back rather than asking for it again", async () => {
    const withArtwork = resolveProductCustomization({
      customizable: "true",
      customization_artwork: "required",
    });
    const product = makeProduct({ customization: withArtwork });

    render(<ProductDetailView {...processNotes} product={product} />);
    chooseBlush();
    await uploadArtworkOfWidth(3000);
    await clickAddToCart();

    const line = readCart().lines[0];
    if (!line) throw new Error("nothing was added to the cart");
    cleanup();

    searchParams = new URLSearchParams({ edit: line.lineId });
    render(<ProductDetailView {...processNotes} product={product} />);

    expect(screen.getByText(/screenshot\.png/)).toBeInTheDocument();
    await settlePrice();
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).not.toHaveAttribute("aria-disabled");
  });

  describe("a custom size", () => {
    const sizeOptions = [
      {
        id: "opt_size",
        title: "Size",
        values: [
          { id: "val_small", value: "Small" },
          { id: "val_custom", value: "Custom" },
        ],
      },
    ];

    const sizeVariants: ProductDetailVariant[] = ["small", "custom"].map(
      (name, index) => ({
        id: `var_${name}`,
        sku: `SIGN-${name.toUpperCase()}`,
        thumbnail: null,
        optionValueIds: [`val_${name}`],
        availability: "in_stock" as const,
        price: `$${10 + index}.00`,
        originalPrice: undefined,
        calculatedAmount: 10 + index,
        currencyCode: "usd",
      }),
    );

    const sized = resolveProductCustomization({
      customizable: "true",
      customization_size: "optional",
      customization_size_min_inches: "2",
      customization_size_max_inches: "48",
      customization_size_option: "Size",
      customization_size_option_value: "Custom",
    });

    function sizedProduct() {
      return makeProduct({
        options: sizeOptions,
        variants: sizeVariants,
        customization: sized,
      });
    }

    it("reopens on the dimensions the shopper typed, with the custom toggle still on", async () => {
      mockPriceQuote(sizeVariants);
      render(<ProductDetailView {...processNotes} product={sizedProduct()} />);

      fireEvent.click(
        screen.getByRole("checkbox", { name: /enter my own size/i }),
      );
      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "8.5" },
      });
      fireEvent.change(screen.getByLabelText(/height/i), {
        target: { value: "10" },
      });
      await clickAddToCart();

      const line = readCart().lines[0];
      if (!line) throw new Error("nothing was added to the cart");
      expect(line.dimensions).toEqual({ widthInches: 8.5, heightInches: 10 });
      cleanup();

      searchParams = new URLSearchParams({ edit: line.lineId });
      render(<ProductDetailView {...processNotes} product={sizedProduct()} />);

      expect(
        screen.getByRole("checkbox", { name: /enter my own size/i }),
      ).toBeChecked();
      expect(screen.getByLabelText(/width/i)).toHaveValue("8.5");
      expect(screen.getByLabelText(/height/i)).toHaveValue("10");

      fireEvent.change(screen.getByLabelText(/height/i), {
        target: { value: "12" },
      });
      await settlePrice();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      });

      const lines = readCart().lines;
      expect(lines).toHaveLength(1);
      expect(lines[0]?.dimensions).toEqual({
        widthInches: 8.5,
        heightInches: 12,
      });
    });
  });
});
