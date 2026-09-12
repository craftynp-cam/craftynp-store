import { act, fireEvent, screen } from "@testing-library/react";

import { READY_MADE_PRODUCT } from "@craftynp/types";
import { uploadArtwork } from "@/lib/artwork-upload";
import type { ProductDetail, ProductDetailVariant } from "@/lib/product";

// A test file that uses these must still jest.mock the artwork transport, the
// price-quote debounce and next/navigation itself: jest.mock is hoisted only
// within the file that calls it.

export const options = [
  {
    id: "opt_color",
    title: "Color",
    values: [
      { id: "val_blush", value: "Blush" },
      { id: "val_sage", value: "Sage" },
    ],
  },
];

export const variants: ProductDetailVariant[] = [
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

export function makeProduct(
  overrides: Partial<ProductDetail> = {},
): ProductDetail {
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
    artworkMinDpi: 300,
    minOrderQuantity: 1,
    ...overrides,
  };
}

export const processNotes = {
  turnaroundNote: "Made to order in 3–5 business days.",
  shippingWindowNote: "Delivery takes another 2–5 business days.",
};

// Stands in for Medusa: the variant's own amount, and an area price when the
// line carries dimensions, so a test can tell the two apart.
export const AREA_RATE_PER_SQ_INCH = 0.5;

type QuoteRequest = {
  variantId: string;
  quantity: number;
  dimensions?: { widthInches: number; heightInches: number };
};

// Every variant the rendering test prices, so the double can price the one
// that was actually chosen rather than guessing from the default fixture.
let quotedVariants: ProductDetailVariant[] = [];

function quoteFor(body: QuoteRequest) {
  const priced = quotedVariants.find(
    (candidate) => candidate.id === body.variantId,
  );
  const base = priced?.calculatedAmount ?? 0;
  const unitAmount = body.dimensions
    ? Math.round(
        base *
          AREA_RATE_PER_SQ_INCH *
          body.dimensions.widthInches *
          body.dimensions.heightInches *
          100,
      ) / 100
    : base;

  return {
    unitAmount,
    lineTotal: Math.round(unitAmount * body.quantity * 100) / 100,
    originalUnitAmount: null,
    currencyCode: priced?.currencyCode ?? "usd",
    isAreaPriced: body.dimensions != null,
    quoteToken: `quote-${body.variantId}-${body.quantity}`,
  };
}

export function mockPriceQuote(priced: ProductDetailVariant[] = variants) {
  quotedVariants = priced;
  global.fetch = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const body: QuoteRequest = JSON.parse(String(init?.body ?? "{}"));

    return {
      ok: true,
      json: () => Promise.resolve(quoteFor(body)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

// Lets the debounced quote fire and its answer land. The debounce is a real
// timer even at zero, so a microtask flush alone never reaches it.
export async function settlePrice() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// Add to cart waits on the price quote now, so every click settles it first.
export async function clickAddToCart() {
  await settlePrice();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
  });
}

export function uploadedReference(widthPx: number) {
  return {
    uploadId: "upload-1",
    storageKey: "staging/upload-1.png",
    fileName: "screenshot.png",
    mimeType: "image/png" as const,
    sizeBytes: 51_200,
    kind: "raster" as const,
    widthPx,
    heightPx: widthPx,
  };
}

export async function uploadArtworkOfWidth(widthPx: number) {
  jest.mocked(uploadArtwork).mockResolvedValue(uploadedReference(widthPx));

  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input rendered");

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
}

export function chooseBlush() {
  fireEvent.click(screen.getByRole("radio", { name: "Blush" }));
}

// jsdom implements neither, and ArtworkUpload builds a preview from the chosen
// file the moment it is accepted.
export function stubObjectUrls() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: jest.fn(() => "blob:artwork-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: jest.fn(),
  });
}
