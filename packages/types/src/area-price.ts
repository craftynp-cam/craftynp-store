export type AreaPriceInput = {
  variantAmount: number;
  ratePerSquareInch: number | null;
  priceFloor: number | null;
  widthInches: number | null;
  heightInches: number | null;
  tierRatio?: number;
};

function isPositive(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

// The one place the area formula exists, so the storefront's display and the
// backend's authoritative answer cannot drift. Null means "cannot be priced" —
// the server turns that into a refusal, the client into a pending price.
//
// The tier ratio multiplies the rate term and the floor is applied last, so a
// volume discount can never take a custom size below the price the owner set as
// the lowest she will make one for.
export function areaUnitPrice({
  variantAmount,
  ratePerSquareInch,
  priceFloor,
  widthInches,
  heightInches,
  tierRatio = 1,
}: AreaPriceInput): number | null {
  if (!isPositive(ratePerSquareInch) || !isPositive(priceFloor)) return null;
  if (!isPositive(widthInches) || !isPositive(heightInches)) return null;
  if (!Number.isFinite(variantAmount) || variantAmount < 0) return null;
  if (!isPositive(tierRatio)) return null;

  const area = widthInches * heightInches;
  const rated = variantAmount * ratePerSquareInch * area * tierRatio;

  return Math.round(Math.max(rated, priceFloor) * 100) / 100;
}
