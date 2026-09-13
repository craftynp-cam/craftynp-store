import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

import { mergedCategoryUpdate, validateCategoryUpdate } from "./middlewares";

function request(body: unknown, stored: Record<string, unknown> | null) {
  const graph = jest.fn().mockResolvedValue({
    data: stored === null ? [] : [{ id: "pcat_1", metadata: stored }],
  });

  return {
    req: {
      body,
      params: { id: "pcat_1" },
      scope: { resolve: () => ({ graph }) },
    } as unknown as MedusaRequest,
    res: {} as MedusaResponse,
    graph,
  };
}

describe("mergedCategoryUpdate", () => {
  it("validates the patch over what is stored, as Medusa merges metadata", () => {
    expect(
      mergedCategoryUpdate(
        { id: "pcat_1", metadata: { image_url: "x", artwork_min_dpi: "300" } },
        { metadata: { image_alt: "A sticker" } },
      ).metadata,
    ).toEqual({
      image_url: "x",
      artwork_min_dpi: "300",
      image_alt: "A sticker",
    });
  });
});

describe("validateCategoryUpdate", () => {
  it("passes a readable threshold through", async () => {
    const { req, res } = request({ metadata: { artwork_min_dpi: "300" } }, {});
    const next = jest.fn();

    await validateCategoryUpdate()(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("refuses a threshold the resolver would silently ignore", async () => {
    const { req, res } = request({ metadata: { artwork_min_dpi: "3OO" } }, {});
    const next = jest.fn();

    await validateCategoryUpdate()(req, res, next);

    const [error] = next.mock.calls[0] ?? [];
    expect(error).toBeInstanceOf(MedusaError);
    expect((error as MedusaError).type).toBe(MedusaError.Types.INVALID_DATA);
  });

  it("refuses a bad stored value that a patch of another key leaves in place", async () => {
    // The save looks unrelated, but it is the moment the category is written,
    // and letting it through would keep the broken threshold live.
    const { req, res } = request(
      { metadata: { image_alt: "A sticker" } },
      { artwork_min_dpi: "lots" },
    );
    const next = jest.fn();

    await validateCategoryUpdate()(req, res, next);

    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(MedusaError);
  });

  it("does not query at all for a save that touches no metadata", async () => {
    const { req, res, graph } = request({ name: "Stickers" }, {});
    const next = jest.fn();

    await validateCategoryUpdate()(req, res, next);

    expect(graph).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
