import { describeError } from "./describe-error";

describe("describeError", () => {
  it("uses an Error's message", () => {
    expect(describeError(new Error("Cart is already completed"))).toBe(
      "Cart is already completed",
    );
  });

  it("reads a message off a plain object rather than stringifying it", () => {
    // The exact case that reached the storefront as
    // "order_placement_unavailable:[object Object]": Medusa's workflow engine
    // rejects with errors[0].error, which is not reliably an Error instance.
    expect(
      describeError({ name: "MedusaError", message: "Cart not found" }),
    ).toBe("Cart not found");
  });

  it("unwraps a workflow error entry's nested error", () => {
    expect(
      describeError({
        action: "use-query-graph",
        handlerType: "invoke",
        error: { message: "Cart id not found" },
      }),
    ).toBe("Cart id not found");
  });

  it("joins several workflow errors", () => {
    expect(
      describeError([
        { error: { message: "first" } },
        { error: { message: "second" } },
      ]),
    ).toBe("first; second");
  });

  it("falls back to JSON, never to [object Object]", () => {
    const described = describeError({ code: "unknown", detail: 7 });
    expect(described).toBe('{"code":"unknown","detail":7}');
    expect(described).not.toContain("[object Object]");
  });

  it("survives a circular object without throwing", () => {
    const circular: Record<string, unknown> = { code: "loop" };
    circular.self = circular;
    expect(() => describeError(circular)).not.toThrow();
  });

  it("stringifies primitives", () => {
    expect(describeError(null)).toBe("null");
    expect(describeError(undefined)).toBe("undefined");
    expect(describeError("plain string")).toBe("plain string");
  });
});
