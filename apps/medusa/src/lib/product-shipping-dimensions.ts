import { MedusaError } from "@medusajs/framework/utils";

export type ProductShippingDimensionsInput = {
  id: string;
  title: string;
  status?: string | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
};

const REQUIRED_FIELDS = ["weight", "length", "width", "height"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

function isPresent(value: number | null | undefined): boolean {
  return typeof value === "number" && value > 0;
}

export function missingShippingFields(
  product: ProductShippingDimensionsInput,
): readonly RequiredField[] {
  return REQUIRED_FIELDS.filter((field) => !isPresent(product[field]));
}

export function assertPublishableProducts(
  products: readonly ProductShippingDimensionsInput[],
): void {
  const problems = products
    .filter((product) => product.status === "published")
    .map((product) => ({
      product,
      missing: missingShippingFields(product),
    }))
    .filter((entry) => entry.missing.length > 0);

  if (problems.length === 0) return;

  const messages = problems.map(({ product, missing }) => {
    const parts: string[] = [];
    if (missing.includes("weight")) parts.push("weight (grams)");
    const dims = missing.filter(
      (field): field is "length" | "width" | "height" => field !== "weight",
    );
    if (dims.length > 0) parts.push(`${dims.join(", ")} (cm)`);

    return `Cannot publish "${product.title}": ${parts.join(" and ")} ${
      parts.length > 1 ? "are" : "is"
    } required. Missing: ${missing.join(", ")}.`;
  });

  throw new MedusaError(MedusaError.Types.INVALID_DATA, messages.join(" "));
}
