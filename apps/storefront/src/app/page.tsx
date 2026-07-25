import { lineItemCustomizationSchema } from "@craftynp/types";
import { ProductListItem } from "@/components/product-list-item";
import { sdk } from "@/lib/medusa";

export default async function Home() {
  const { products } = await sdk.store.product.list({ limit: 3 });

  // Proves the shared package is importable and executable from the storefront.
  const contractOk = lineItemCustomizationSchema.safeParse({
    customText: { value: "hello" },
  }).success;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">The Crafty NP</h1>
      <p className="mt-2 text-sm text-gray-600">
        Scaffold check. Shared types contract: {contractOk ? "ok" : "failed"}.
      </p>
      <ul className="mt-6 space-y-2">
        {products.map((product) => (
          <ProductListItem key={product.id} title={product.title} />
        ))}
      </ul>
    </main>
  );
}
