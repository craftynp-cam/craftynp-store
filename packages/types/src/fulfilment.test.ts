import {
  LABEL_FAILURE_REASONS,
  MAX_PARCEL_DIMENSION_CM,
  MAX_PARCEL_WEIGHT_GRAMS,
  describeLabelFailure,
  formatDeliveryWindow,
  formatParcelSummary,
  parcelOverrideSchema,
  type LabelFailureReason,
} from "./fulfilment.js";

const VALID_PARCEL = { weight: 640, length: 30, width: 20, height: 12 };

describe("parcelOverrideSchema", () => {
  it("accepts a parcel with every dimension present and positive", () => {
    expect(parcelOverrideSchema.safeParse(VALID_PARCEL).success).toBe(true);
  });

  it.each([
    ["a zero weight", { ...VALID_PARCEL, weight: 0 }],
    ["a negative weight", { ...VALID_PARCEL, weight: -1 }],
    ["a zero dimension", { ...VALID_PARCEL, height: 0 }],
    ["a negative dimension", { ...VALID_PARCEL, width: -5 }],
    [
      "a weight beyond any carrier's maximum",
      { ...VALID_PARCEL, weight: MAX_PARCEL_WEIGHT_GRAMS + 1 },
    ],
    [
      "a dimension beyond any carrier's maximum",
      { ...VALID_PARCEL, length: MAX_PARCEL_DIMENSION_CM + 1 },
    ],
    ["a non-numeric weight", { ...VALID_PARCEL, weight: "640" }],
    ["a missing dimension", { weight: 640, length: 30, width: 20 }],
  ])("rejects %s", (_label, input) => {
    expect(parcelOverrideSchema.safeParse(input).success).toBe(false);
  });
});

describe("formatDeliveryWindow", () => {
  it("prefers a quoted delivery date, formatted in UTC", () => {
    expect(formatDeliveryWindow(3, "2026-08-04T00:00:00.000Z")).toBe(
      "Arrives Tue 4 Aug",
    );
  });

  it("falls back to a business-day count when no date is quoted", () => {
    expect(formatDeliveryWindow(3, null)).toBe("3 business days");
  });

  it("says a single day in the singular", () => {
    expect(formatDeliveryWindow(1, null)).toBe("1 business day");
  });

  it("says so plainly when the carrier quoted neither", () => {
    expect(formatDeliveryWindow(null, null)).toBe("Delivery window not quoted");
  });

  it("falls back rather than printing an unparseable date", () => {
    expect(formatDeliveryWindow(2, "not-a-date")).toBe("2 business days");
  });
});

describe("formatParcelSummary", () => {
  it("renders grams and centimetres in the order the fields are entered", () => {
    expect(formatParcelSummary(VALID_PARCEL)).toBe("640 g · 30 × 20 × 12 cm");
  });
});

describe("describeLabelFailure", () => {
  it.each(LABEL_FAILURE_REASONS.map((reason) => [reason]))(
    "gives %s its own title and next step",
    (reason: LabelFailureReason) => {
      const copy = describeLabelFailure(reason);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.nextStep.length).toBeGreaterThan(0);
    },
  );

  it("gives every reason a distinct next step", () => {
    const nextSteps = LABEL_FAILURE_REASONS.map(
      (reason) => describeLabelFailure(reason).nextStep,
    );
    expect(new Set(nextSteps).size).toBe(LABEL_FAILURE_REASONS.length);
  });

  it("appends the carrier's own words when there are any", () => {
    const copy = describeLabelFailure("rejected", "Invalid postal code");
    expect(copy.body).toContain("The carrier said: Invalid postal code");
  });

  it("leaves the body alone when the carrier said nothing", () => {
    expect(describeLabelFailure("rejected", null).body).not.toContain(
      "The carrier said",
    );
  });
});
