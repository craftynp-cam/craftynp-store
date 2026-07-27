import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard, ThemeToggle } from "@/components";

export const metadata: Metadata = {
  title: "Components — The Crafty NP",
  description:
    "Reference page for higher-level, product-facing components built on the UI primitives.",
};

/**
 * The reference page for higher-level components — built on the primitives
 * shown at /design/primitives, rather than directly on HeroUI. CNP-28's
 * ProductCard is the first entry.
 */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-foreground-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ComponentsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl">Components</h1>
      <p className="mt-4 max-w-2xl text-lg text-foreground-muted">
        Higher-level components, assembled from the{" "}
        <Link
          href="/design/primitives"
          className="underline underline-offset-4"
        >
          UI primitives
        </Link>{" "}
        and coloured entirely by the{" "}
        <Link href="/design" className="underline underline-offset-4">
          design tokens
        </Link>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ThemeToggle />
        <p className="text-sm text-foreground-muted">
          Tab through the cards to check the focus ring, and hover one to
          compare it with the hover treatment — they are deliberately different.
        </p>
      </div>

      <Section
        title="Product card"
        description="Shows image, category, name and price. Customizable products get a gold badge; ready-made get a mint one. Sale items show both prices and a text 'Sale' indicator, never colour alone."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <ProductCard
            href="/products/custom-die-cut-stickers"
            title="Custom Die-Cut Stickers"
            category="Stickers"
            price="from $0.55"
            isCustomizable
          />
          <ProductCard
            href="/products/wildflower-acrylic-keychain"
            title="Wildflower Acrylic Keychain"
            category="Keychains"
            price="$9.00"
            originalPrice="$12.00"
          />
          <ProductCard
            href="/products/embroidered-tote-bag"
            title="Embroidered Canvas Tote Bag With a Very Long Name"
            category="Bags"
            price="$24.00"
          />
        </div>
      </Section>

      <Section
        title="Missing image"
        description="A tokenised placeholder fills the fixed aspect ratio rather than leaving the card empty."
      >
        <div className="max-w-xs">
          <ProductCard
            href="/products/coming-soon"
            title="Coming Soon"
            category="Seasonal"
            price="from $5.00"
          />
        </div>
      </Section>

      <Section
        title="Loading"
        description="Shown while a product list is still fetching. The skeleton matches the card's shape exactly, so nothing shifts when the real content arrives."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <ProductCard isLoading />
          <ProductCard isLoading />
          <ProductCard isLoading />
        </div>
      </Section>

      <Section
        title="In grid"
        description="Several cards in a responsive grid. Each reserves its image space up front, so nothing shifts as thumbnails load."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ProductCard
            href="/products/custom-die-cut-stickers"
            title="Custom Die-Cut Stickers"
            category="Stickers"
            price="from $0.55"
            isCustomizable
          />
          <ProductCard
            href="/products/wildflower-acrylic-keychain"
            title="Wildflower Acrylic Keychain"
            category="Keychains"
            price="$9.00"
            originalPrice="$12.00"
          />
          <ProductCard
            href="/products/enamel-pin-set"
            title="Enamel Pin Set"
            category="Pins"
            price="$14.00"
          />
          <ProductCard
            href="/products/greeting-card-pack"
            title="Greeting Card Pack"
            category="Cards"
            price="from $3.00"
          />
        </div>
      </Section>
    </main>
  );
}
