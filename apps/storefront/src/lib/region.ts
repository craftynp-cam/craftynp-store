import { cache } from "react";

import { sdk } from "./medusa";

export type RegionSource = {
  id: string;
  countries?: readonly {
    iso_2?: string | null;
    display_name?: string | null;
    name?: string | null;
  }[] | null;
};

export function selectDefaultRegion<T extends RegionSource>(
  regions: readonly T[],
  defaultCountryCode: string | undefined,
): T | null {
  if (regions.length === 0) return null;

  const wanted = defaultCountryCode?.toLowerCase();
  const match = wanted
    ? regions.find((region) =>
        region.countries?.some(
          (country) => country.iso_2?.toLowerCase() === wanted,
        ),
      )
    : undefined;

  return match ?? regions[0] ?? null;
}

export const fetchRegion = cache(async (): Promise<RegionSource | null> => {
  try {
    const { regions } = await sdk.store.region.list({
      fields: "id,*countries",
      limit: 100,
    });
    return selectDefaultRegion(regions, process.env.NEXT_PUBLIC_DEFAULT_REGION);
  } catch (error) {
    console.error("Could not load the default region", error);
    return null;
  }
});
