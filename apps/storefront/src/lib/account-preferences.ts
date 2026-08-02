export type MarketingPreferenceKey = "newDrops" | "salesAndBundles";

export type MarketingPreferences = Record<MarketingPreferenceKey, boolean>;

const METADATA_KEYS: Record<MarketingPreferenceKey, string> = {
  newDrops: "comms_new_drops",
  salesAndBundles: "comms_sales_and_bundles",
};

export const DEFAULT_MARKETING_PREFERENCES: MarketingPreferences = {
  newDrops: false,
  salesAndBundles: false,
};

export function preferencesFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): MarketingPreferences {
  const preferences = { ...DEFAULT_MARKETING_PREFERENCES };

  for (const key of Object.keys(METADATA_KEYS) as MarketingPreferenceKey[]) {
    const value = metadata?.[METADATA_KEYS[key]];
    if (typeof value === "boolean") preferences[key] = value;
  }

  return preferences;
}

export function metadataFromPreferences(
  preferences: MarketingPreferences,
): Record<string, boolean> {
  const metadata: Record<string, boolean> = {};

  for (const key of Object.keys(METADATA_KEYS) as MarketingPreferenceKey[]) {
    metadata[METADATA_KEYS[key]] = preferences[key];
  }

  return metadata;
}
