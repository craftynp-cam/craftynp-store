import {
  CHECKOUT_STORAGE_KEY,
  clearCheckoutDraft,
  patchCheckoutDraft,
  readCheckoutDraft,
  readServerCheckoutDraft,
  subscribeToCheckoutDraft,
} from "@/lib/checkout-draft";
import { EMPTY_CHECKOUT_DRAFT } from "@/lib/checkout";

describe("checkout draft", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCheckoutDraft();
  });

  it("reads the empty draft when nothing is stored", () => {
    window.localStorage.clear();
    expect(readCheckoutDraft()).toEqual(EMPTY_CHECKOUT_DRAFT);
  });

  it("persists a patch and merges it onto the existing draft", () => {
    patchCheckoutDraft({ email: "jamie@example.com" });
    patchCheckoutDraft({ firstName: "Jamie" });

    const draft = readCheckoutDraft();
    expect(draft.email).toBe("jamie@example.com");
    expect(draft.firstName).toBe("Jamie");
  });

  it("returns the same object reference across reads", () => {
    patchCheckoutDraft({ email: "jamie@example.com" });
    expect(readCheckoutDraft()).toBe(readCheckoutDraft());
  });

  it("returns the same server snapshot on every call", () => {
    expect(readServerCheckoutDraft()).toBe(readServerCheckoutDraft());
  });

  it("notifies subscribers on patch", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToCheckoutDraft(listener);

    patchCheckoutDraft({ email: "jamie@example.com" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    patchCheckoutDraft({ email: "someone@example.com" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("invalidates the cache on a storage event", () => {
    const listener = jest.fn();
    subscribeToCheckoutDraft(listener);

    window.localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        ...EMPTY_CHECKOUT_DRAFT,
        email: "external@example.com",
      }),
    );
    window.dispatchEvent(new Event("storage"));

    expect(readCheckoutDraft().email).toBe("external@example.com");
  });

  // These three read a value written straight to localStorage, bypassing
  // patchCheckoutDraft — so the module's cache has to be reset first, or a
  // stale in-memory snapshot from an earlier test would be returned instead
  // of what was actually parsed.
  it("falls back to the empty draft on malformed JSON", async () => {
    window.localStorage.setItem(CHECKOUT_STORAGE_KEY, "{not json");

    jest.resetModules();
    const fresh = await import("@/lib/checkout-draft");
    expect(fresh.readCheckoutDraft()).toEqual(EMPTY_CHECKOUT_DRAFT);
  });

  it("drops a wrong-typed field but keeps its valid siblings", async () => {
    window.localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        email: 42,
        firstName: "Jamie",
        billingSameAsDelivery: "yes",
      }),
    );

    jest.resetModules();
    const fresh = await import("@/lib/checkout-draft");
    const draft = fresh.readCheckoutDraft();
    expect(draft.email).toBe(EMPTY_CHECKOUT_DRAFT.email);
    expect(draft.firstName).toBe("Jamie");
    expect(draft.billingSameAsDelivery).toBe(
      EMPTY_CHECKOUT_DRAFT.billingSameAsDelivery,
    );
  });

  it("ignores unknown extra keys", async () => {
    window.localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({ ...EMPTY_CHECKOUT_DRAFT, notARealField: "x" }),
    );

    jest.resetModules();
    const fresh = await import("@/lib/checkout-draft");
    expect(fresh.readCheckoutDraft()).not.toHaveProperty("notARealField");
  });

  it("clears the stored draft and notifies", () => {
    patchCheckoutDraft({ email: "jamie@example.com" });
    const listener = jest.fn();
    subscribeToCheckoutDraft(listener);

    clearCheckoutDraft();

    expect(readCheckoutDraft()).toEqual(EMPTY_CHECKOUT_DRAFT);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("persists the shipping rate fields, including the numeric amount", () => {
    patchCheckoutDraft({
      shippingRateId: "rate_standard",
      shippingRateLabel: "USPS Ground Advantage",
      shippingRateAmount: 7.42,
      shippingRateCurrency: "usd",
      shippingQuoteToken: "token.signature",
    });

    const draft = readCheckoutDraft();
    expect(draft.shippingRateId).toBe("rate_standard");
    expect(draft.shippingRateAmount).toBe(7.42);
  });

  it("persists the tax fields, including the numeric amount", () => {
    patchCheckoutDraft({
      taxAmount: 0.68,
      taxCurrency: "usd",
      taxQuoteToken: "token.signature",
    });

    const draft = readCheckoutDraft();
    expect(draft.taxAmount).toBe(0.68);
    expect(draft.taxQuoteToken).toBe("token.signature");
  });

  it("falls back to zero when the stored amount is not a number", async () => {
    window.localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({ ...EMPTY_CHECKOUT_DRAFT, shippingRateAmount: "7.42" }),
    );

    jest.resetModules();
    const fresh = await import("@/lib/checkout-draft");
    expect(fresh.readCheckoutDraft().shippingRateAmount).toBe(0);
  });

  it("rejects a NaN or non-finite stored amount", async () => {
    window.localStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({ ...EMPTY_CHECKOUT_DRAFT, shippingRateAmount: NaN }),
    );

    jest.resetModules();
    const fresh = await import("@/lib/checkout-draft");
    expect(fresh.readCheckoutDraft().shippingRateAmount).toBe(0);
  });

  it("does not throw when localStorage.setItem throws", () => {
    const setItem = jest
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(() =>
      patchCheckoutDraft({ email: "jamie@example.com" }),
    ).not.toThrow();

    setItem.mockRestore();
  });
});
