import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Breadcrumbs,
  ProductDetails,
  ProductGallery,
  ProductPurchase,
} from "@/components";
import { fetchProductByHandle } from "@/lib/product";
import { fetchRegion } from "@/lib/region";

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
  const product = await loadProduct(params);
  if (!product) return {};

  return {
    title: product.title,
    description: product.description || undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await loadProduct(params);
  if (!product) notFound();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} productTitle={product.title} />

        <div className="flex flex-col gap-8">
          <ProductPurchase
            title={product.title}
            href={product.href}
            imageUrl={product.images[0]?.url}
            options={product.options}
            variants={product.variants}
          />
          <ProductDetails
            description={product.description}
            crossSellHref={product.crossSellHref}
          />
        </div>
      </div>
    </main>
  );
}
