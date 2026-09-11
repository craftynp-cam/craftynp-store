import { MedusaError } from "@medusajs/framework/utils";

import {
  mergedProductUpdate,
  touchesGuardedFields,
  validateProductUpdate,
} from "./middlewares.js";

const STORED = {
  id: "prod_1",
  title: "Personalised Name Sign",
  status: "published",
  metadata: {
    customizable: "true",
    customization_size: "optional",
    customization_size_min_inches: "2",
    customization_size_max_inches: "48",
    customization_size_rate_per_sq_inch: "0.055",
    customization_size_price_floor: "4",
  },
  weight: 900,
  length: 45,
  width: 22,
  height: 4,
};

function runMiddleware(body: Record<string, unknown>, stored = STORED) {
  const graph = jest.fn().mockResolvedValue({ data: [stored] });
  const req = {
    body,
    params: { id: stored.id },
    scope: { resolve: () => ({ graph }) },
  } as never;

  return new Promise<{ error: unknown; graph: jest.Mock }>((resolve) => {
    void validateProductUpdate()(
      req,
      {} as never,
      ((error: unknown) => {
        resolve({ error, graph });
      }) as never,
    );
  });
}

describe("touchesGuardedFields", () => {
  it("recognises the fields the guards actually read", () => {
    expect(touchesGuardedFields({ metadata: {} })).toBe(true);
    expect(touchesGuardedFields({ status: "published" })).toBe(true);
    expect(touchesGuardedFields({ weight: 10 })).toBe(true);
  });

  it("ignores an update that cannot change the answer", () => {
    expect(touchesGuardedFields({ subtitle: "A dev fixture" })).toBe(false);
  });
});

describe("mergedProductUpdate", () => {
  it("merges metadata over what is stored, as Medusa itself does", () => {
    const merged = mergedProductUpdate(STORED, {
      metadata: { customization_size_min_inches: "4" },
    });

    expect(merged.metadata).toEqual({
      ...STORED.metadata,
      customization_size_min_inches: "4",
    });
  });

  it("keeps the stored value for anything the update leaves out", () => {
    const merged = mergedProductUpdate(STORED, { title: "Renamed" });

    expect(merged).toEqual({ ...STORED, title: "Renamed" });
  });

  it("takes the incoming status, which decides the publish-only rules", () => {
    expect(mergedProductUpdate(STORED, { status: "draft" }).status).toBe(
      "draft",
    );
  });
});

describe("validateProductUpdate", () => {
  it("refuses the request before the write when the merged result is invalid", async () => {
    const { error } = await runMiddleware({
      metadata: { customization_size_min_inches: "60" },
    });

    expect(error).toBeInstanceOf(MedusaError);
    expect(String(error)).toMatch(/must be smaller than/);
  });

  it("lets a valid update through", async () => {
    const { error } = await runMiddleware({
      metadata: { customization_size_min_inches: "4" },
    });

    expect(error).toBeUndefined();
  });

  it("refuses to publish a custom size whose pricing was cleared", async () => {
    const { error } = await runMiddleware({
      metadata: { customization_size_rate_per_sq_inch: "" },
    });

    expect(error).toBeInstanceOf(MedusaError);
    expect(String(error)).toMatch(/customization_size_rate_per_sq_inch/);
  });

  it("repairs a product whose stored declaration is already broken", async () => {
    const wedged = {
      ...STORED,
      metadata: { ...STORED.metadata, customization_size_min_inches: "99" },
    };

    const { error } = await runMiddleware(
      { metadata: { customization_size_min_inches: "2" } },
      wedged,
    );

    expect(error).toBeUndefined();
  });

  it("does not query the product for an update the guards do not read", async () => {
    const { error, graph } = await runMiddleware({ subtitle: "A dev fixture" });

    expect(error).toBeUndefined();
    expect(graph).not.toHaveBeenCalled();
  });
});
