import type { Availability } from "./variant";
import type { ProductDetail } from "./product";

const availabilityToSchema: Record<Availability, string> = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
};

export function toProductJsonLd(
  product: ProductDetail,
): Record<string, unknown> {
  const offers = product.variants
    .filter((variant) => variant.price !== "")
    .map((variant) => ({
      "@type": "Offer",
      sku: variant.sku ?? undefined,
      price: variant.calculatedAmount.toFixed(2),
      priceCurrency: variant.currencyCode.toUpperCase(),
      availability: availabilityToSchema[variant.availability],
      url: product.href,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    image: product.images.map((image) => image.url),
    offers: offers.length === 0 ? undefined : offers,
  };
}
