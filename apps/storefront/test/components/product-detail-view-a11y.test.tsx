import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { ProductDetailView } from "@/components";
import { resolveProductCustomization } from "@craftynp/types";
import { uploadArtwork } from "@/lib/artwork-upload";
import { clearCart, readCart } from "@/lib/cart";
import { readCartDrawerOpen, setCartDrawerOpen } from "@/lib/cart-drawer";
import type { ProductDetailVariant } from "@/lib/product";
import {
  makeProduct,
  mockPriceQuote,
  processNotes,
  settlePrice,
  stubObjectUrls,
  uploadArtworkOfWidth,
  uploadedReference,
  variants,
} from "../support/product-detail";

let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => searchParams,
}));

jest.mock("../../src/lib/artwork-upload", () => {
  const actual = jest.requireActual("../../src/lib/artwork-upload");
  return { ...actual, uploadArtwork: jest.fn() };
});

jest.mock("../../src/lib/price-quote", () => ({
  ...jest.requireActual("../../src/lib/price-quote"),
  PRICE_QUOTE_DEBOUNCE_MS: 0,
}));

jest.setTimeout(30_000);

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
  ["small", 9],
  ["large", 19],
  ["custom", 29],
].map(([name, amount]) => ({
  id: `var_${name}`,
  sku: String(name).toUpperCase(),
  thumbnail: null,
  optionValueIds: [`val_${name}`],
  availability: "in_stock" as const,
  price: `$${amount}.00`,
  calculatedAmount: Number(amount),
  currencyCode: "usd",
}));

const madeToOrder = resolveProductCustomization({
  customizable: "true",
  customization_artwork: "required",
  customization_text: "required",
  customization_notes: "optional",
  customization_size: "optional",
  customization_size_min_inches: "1",
  customization_size_max_inches: "48",
  customization_size_option: "Size",
  customization_size_option_value: "Custom",
});

function renderMadeToOrder() {
  return render(
    <ProductDetailView
      {...processNotes}
      product={makeProduct({
        options: sizeOptions,
        variants: sizeVariants,
        customization: madeToOrder,
        artworkMinDpi: 300,
      })}
    />,
  );
}

async function tabTo(
  user: ReturnType<typeof userEvent.setup>,
  target: () => HTMLElement,
) {
  const visited: string[] = [];
  for (let step = 0; step < 60; step++) {
    await user.tab();
    const active = document.activeElement;
    if (active === target()) return;
    visited.push(
      `${active?.tagName.toLowerCase()} ${active?.getAttribute("role") ?? ""} "${active?.getAttribute("aria-label") ?? active?.textContent?.trim().slice(0, 30) ?? ""}"`,
    );
  }
  throw new Error(
    `Tab never reached the control. Visited:\n${visited.join("\n")}`,
  );
}

async function expectNoViolations(container: HTMLElement) {
  expect(await axe(container)).toHaveNoViolations();
}

describe("ProductDetailView accessibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCart();
    setCartDrawerOpen(false);
    searchParams = new URLSearchParams();
    mockPriceQuote([...variants, ...sizeVariants]);
    stubObjectUrls();
  });

  it("configures a made-to-order piece and adds it to the cart by keyboard alone", async () => {
    const user = userEvent.setup();
    renderMadeToOrder();

    await tabTo(user, () => screen.getByRole("radio", { name: "Small" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Large" })).toBeChecked();

    await tabTo(user, () =>
      screen.getByRole("button", { name: "Choose a file" }),
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input rendered");
    const openPicker = jest.spyOn(input, "click").mockImplementation(() => {});
    await user.keyboard("{Enter}");
    expect(openPicker).toHaveBeenCalledTimes(1);
    openPicker.mockRestore();

    jest.mocked(uploadArtwork).mockResolvedValue(uploadedReference(4000));
    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [
            new File([new Uint8Array(1)], "screenshot.png", {
              type: "image/png",
            }),
          ],
        },
      });
    });
    expect(
      screen.getByText("Uploaded screenshot.png, 50 KB."),
    ).toBeInTheDocument();

    await tabTo(user, () =>
      screen.getByRole("textbox", { name: /custom text/i }),
    );
    await user.keyboard("The Wrights");
    await settlePrice();

    await tabTo(user, () =>
      screen.getByRole("button", { name: /add to cart/i }),
    );
    await user.keyboard("{Enter}");

    expect(readCart().lines).toHaveLength(1);
    expect(readCart().lines[0]?.id).toBe("var_large");
    expect(readCartDrawerOpen()).toBe(true);
  });

  describe("reports no axe violations", () => {
    it("on a ready-made product with nothing chosen", async () => {
      const { container } = render(
        <ProductDetailView {...processNotes} product={makeProduct()} />,
      );

      await expectNoViolations(container);
    });

    it("on a made-to-order product with nothing chosen", async () => {
      const { container } = renderMadeToOrder();

      await expectNoViolations(container);
    });

    it("once the piece is configured and priced", async () => {
      const { container } = renderMadeToOrder();
      fireEvent.click(screen.getByRole("radio", { name: "Large" }));
      await uploadArtworkOfWidth(4000);
      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "The Wrights" },
      });
      await settlePrice();

      expect(
        screen.getByRole("button", { name: /add to cart/i }),
      ).not.toHaveAttribute("aria-disabled");
      await expectNoViolations(container);
    });

    it("while text, notes and artwork are all in error", async () => {
      const { container } = renderMadeToOrder();
      fireEvent.click(screen.getByRole("radio", { name: "Large" }));
      await uploadArtworkOfWidth(100);
      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "x".repeat(121) },
      });
      fireEvent.change(screen.getByLabelText(/order notes/i), {
        target: { value: "y".repeat(501) },
      });

      expect(screen.getAllByRole("alert")).toHaveLength(3);
      await expectNoViolations(container);
    });

    it("while a custom size cannot be read", async () => {
      const { container } = renderMadeToOrder();
      fireEvent.click(
        screen.getByRole("checkbox", { name: /enter my own size/i }),
      );
      fireEvent.change(screen.getByLabelText(/width/i), {
        target: { value: "wide" },
      });

      expect(screen.getByRole("alert")).toBeInTheDocument();
      await expectNoViolations(container);
    });

    it("when the line cannot be priced", async () => {
      const { container } = render(
        <ProductDetailView {...processNotes} product={makeProduct()} />,
      );
      global.fetch = jest.fn(async () => ({ ok: false }) as Response);
      fireEvent.click(screen.getByRole("radio", { name: "Blush" }));
      await settlePrice();

      expect(
        screen.getByText("We could not price this just now."),
      ).toBeInTheDocument();
      await expectNoViolations(container);
    });

    it("while editing a line already in the cart", async () => {
      const product = makeProduct({
        customization: resolveProductCustomization({
          customizable: "true",
          customization_text: "required",
        }),
      });
      render(<ProductDetailView {...processNotes} product={product} />);
      fireEvent.click(screen.getByRole("radio", { name: "Blush" }));
      fireEvent.change(screen.getByLabelText(/custom text/i), {
        target: { value: "The Wrights" },
      });
      await settlePrice();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
      });
      const line = readCart().lines[0];
      if (!line) throw new Error("nothing was added to the cart");
      cleanup();

      searchParams = new URLSearchParams({ edit: line.lineId });
      const { container } = render(
        <ProductDetailView {...processNotes} product={product} />,
      );
      await settlePrice();

      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).toBeInTheDocument();
      await expectNoViolations(container);
    });
  });
});
