import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Breadcrumbs,
  Container,
  ProductDetails,
  ProductGallery,
  ProductPurchase,
  StoreUnavailable,
} from "@/components";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { fetchProductByHandle } from "@/lib/product";
import { fetchRegion } from "@/lib/region";
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
  // See the note in src/app/[category]/page.tsx on swallowing here.
  const product = await loadProduct(params).catch(() => null);
  if (!product) return {};

  return {
    title: product.title,
    description: product.description || undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  let product;
  try {
    product = await loadProduct(params);
  } catch (error) {
    // See the note in src/app/products/page.tsx.
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

          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <ProductGallery
              images={product.images}
              productTitle={product.title}
            />

            <div className="flex flex-col gap-8">
              <ProductPurchase
                title={product.title}
                href={product.href}
                imageUrl={product.images[0]?.url}
                options={product.options}
                variants={product.variants}
              />
              <ProductDetails description={product.description} />
            </div>
          </div>
        </Container>
      </main>
    </>
  );
}
