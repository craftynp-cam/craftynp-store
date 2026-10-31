import { customQuoteFieldErrors } from "./custom-quote.js";

const VALID = {
  name: "Katherine",
  phone: "317.843.1640",
  email: "katherine@example.com",
  neededBy: "2026-12-01",
  product: "Acrylic sign",
  description: "A 12 by 18 sign for a nurse practitioner's office.",
  company: "",
};

describe("customQuoteFieldErrors", () => {
  it("accepts a complete request", () => {
    expect(customQuoteFieldErrors(VALID)).toEqual({});
  });

  it("accepts a request with no date needed", () => {
    expect(customQuoteFieldErrors({ ...VALID, neededBy: "" })).toEqual({});
  });

  it("names every missing required field", () => {
    expect(
      Object.keys(
        customQuoteFieldErrors({
          ...VALID,
          name: " ",
          phone: "",
          email: "",
          product: "",
          description: "",
        }),
      ).sort(),
    ).toEqual(["description", "email", "name", "phone", "product"]);
  });

  it("rejects a phone number with too few digits", () => {
    expect(customQuoteFieldErrors({ ...VALID, phone: "call me" }).phone).toBe(
      "Enter a phone number we can reach you on.",
    );
  });

  it.each(["2026-02-30", "12/01/2026"])(
    "rejects %s as a date needed",
    (neededBy) => {
      expect(customQuoteFieldErrors({ ...VALID, neededBy }).neededBy).toBe(
        "Enter the date as a real calendar date.",
      );
    },
  );

  it("rejects a description past its limit", () => {
    expect(
      customQuoteFieldErrors({ ...VALID, description: "a".repeat(2001) })
        .description,
    ).toBe("Keep your description to 2000 characters.");
  });
});
