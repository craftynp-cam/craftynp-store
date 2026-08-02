import {
  metadataFromPreferences,
  preferencesFromMetadata,
} from "@/lib/account-preferences";

describe("preferencesFromMetadata", () => {
  it("reads both marketing preferences off the customer's metadata", () => {
    expect(
      preferencesFromMetadata({
        comms_new_drops: true,
        comms_sales_and_bundles: false,
      }),
    ).toEqual({ newDrops: true, salesAndBundles: false });
  });

  it("defaults both preferences to false when metadata is absent", () => {
    expect(preferencesFromMetadata(undefined)).toEqual({
      newDrops: false,
      salesAndBundles: false,
    });
    expect(preferencesFromMetadata(null)).toEqual({
      newDrops: false,
      salesAndBundles: false,
    });
  });

  it("ignores unrelated or non-boolean metadata keys", () => {
    expect(
      preferencesFromMetadata({
        comms_new_drops: "yes",
        unrelated_key: true,
      }),
    ).toEqual({ newDrops: false, salesAndBundles: false });
  });
});

describe("metadataFromPreferences", () => {
  it("round-trips through preferencesFromMetadata", () => {
    const preferences = { newDrops: true, salesAndBundles: false };

    expect(
      preferencesFromMetadata(metadataFromPreferences(preferences)),
    ).toEqual(preferences);
  });
});
