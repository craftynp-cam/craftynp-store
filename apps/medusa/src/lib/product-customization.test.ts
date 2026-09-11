import { assertDeclaredCustomization } from "./product-customization";

const READY_MADE = {
  id: "prod_1",
  title: "Cutting board",
  status: "published",
  metadata: null,
};

describe("assertDeclaredCustomization", () => {
  it("passes a product that declares nothing", () => {
    expect(() => assertDeclaredCustomization([READY_MADE])).not.toThrow();
  });

  it("passes a complete declaration", () => {
    expect(() =>
      assertDeclaredCustomization([
        {
          ...READY_MADE,
          metadata: { customizable: "true", customization_artwork: "required" },
        },
      ]),
    ).not.toThrow();
  });

  it("names the product it rejected", () => {
    expect(() =>
      assertDeclaredCustomization([
        { ...READY_MADE, metadata: { customizable: "sometimes" } },
      ]),
    ).toThrow(/Cutting board/);
  });

  it("rejects a status-only publish of a customizable product asking for nothing", () => {
    const metadata = { customizable: "true" };

    expect(() =>
      assertDeclaredCustomization([
        { ...READY_MADE, status: "draft", metadata },
      ]),
    ).not.toThrow();

    expect(() =>
      assertDeclaredCustomization([
        { ...READY_MADE, status: "published", metadata },
      ]),
    ).toThrow(/at least one input/);
  });

  it("guards the order minimum on a product that is not customizable at all", () => {
    expect(() =>
      assertDeclaredCustomization([
        { ...READY_MADE, metadata: { min_order_quantity: "half a dozen" } },
      ]),
    ).toThrow(/min_order_quantity/);
  });

  it("reports every bad product in one batch, not just the first", () => {
    expect(() =>
      assertDeclaredCustomization([
        {
          ...READY_MADE,
          title: "Board",
          metadata: { customizable: "sometimes" },
        },
        {
          ...READY_MADE,
          title: "Sign",
          metadata: { customizable: "true", customization_text: "maybe" },
        },
      ]),
    ).toThrow(/Board.*Sign/s);
  });
});
