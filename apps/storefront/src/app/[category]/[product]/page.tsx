import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Breadcrumbs,
  Container,
  ProductDetailView,
  StoreUnavailable,
} from "@/components";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { fetchProductByHandle } from "@/lib/product";
import { fetchRegion } from "@/lib/region";
import { fetchSiteContent } from "@/lib/site-content";
import { serializeJsonLd, toProductJsonLd } from "@/lib/structured-data";

type ProductPageProps = {
  params: Promise<{ category: string; product: string }>;
};

async function loadProduct(params: ProductPageProps["params"]) {
  const { category, product: productHandle } = await params;
  const region = await fetchRegion();
  const product = await fetchProductByHandle(productHandle, region?.id);

  if (!product || product.categoryHandle !== category) return null;

  return product;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const product = await loadProduct(params).catch(() => null);
  if (!product) return {};

  return {
    title: product.title,
    description: product.description || undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  let product, content;
  try {
    [product, content] = await Promise.all([
      loadProduct(params),
      fetchSiteContent(),
    ]);
  } catch (error) {
    if (error instanceof MedusaUnavailableError) return <StoreUnavailable />;
    throw error;
  }
  if (!product) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(toProductJsonLd(product)),
        }}
      />

      <main id="main-content" tabIndex={-1} className="py-8">
        <Container>
          <Breadcrumbs />

          <ProductDetailView
            product={product}
            turnaroundNote={content.order_turnaround_note}
            shippingWindowNote={content.order_shipping_window_note}
          />
        </Container>
      </main>
    </>
  );
}
