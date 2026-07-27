import type { Metadata } from "next";
import Link from "next/link";

import { CartCard, ProductCard, ThemeToggle } from "@/components";

import { CartCardDemo } from "./cart-card-demo";

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

/**
 * One entry per component demoed below, in the order they appear. Add to
 * this list — and wrap the new demo in a `<div id={…}>` — as components join
 * the page; the nav needs no other changes.
 */
const componentNavEntries = [
  { id: "product-card", label: "Product Card" },
  { id: "cart-card", label: "Cart Card" },
];

function ComponentNav() {
  return (
    <nav aria-label="Components" className="hidden lg:block">
      <ul className="sticky top-16 space-y-1">
        {componentNavEntries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="block rounded-md px-3 py-2 text-sm text-foreground-muted transition hover:bg-surface-soft hover:text-foreground"
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function ComponentsPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-6 py-16"
    >
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
        <Link href="/design/tokens" className="underline underline-offset-4">
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

      <div className="mt-12 lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
        <ComponentNav />

        {/* A single grid child, holding every section — the grid above
            defines exactly two columns, so a second and third top-level
            child here would cycle back into the 180px nav column instead
            of staying in the content column. */}
        <div>
          <div id="product-card">
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
          </div>

          <div id="cart-card">
            <Section
              title="Cart card"
              description="The cart drawer's line item (CNP-47). The badge always matches the product card it came from. Custom detail rows are dormant until the configurator ships in Release 3, but render here to prove the layout."
            >
              <CartCardDemo
                initialLines={[
                  {
                    id: "ready-made",
                    href: "/products/wildflower-acrylic-keychain",
                    title: "Wildflower Acrylic Keychain",
                    unitPrice: 9,
                    currencyCode: "usd",
                    quantity: 2,
                  },
                  {
                    id: "customizable",
                    href: "/products/custom-die-cut-stickers",
                    title: "Custom Die-Cut Stickers",
                    unitPrice: 0.75,
                    currencyCode: "usd",
                    quantity: 50,
                    isCustomizable: true,
                    details: [
                      { label: "Size", value: '3" · matte' },
                      { label: "Text", value: "Sarah's Sweet Shop" },
                      { label: "File", value: "logo-final.png" },
                    ],
                  },
                ]}
              />
            </Section>

            <Section
              title="Long detail values"
              description="A custom text or filename far longer than the panel truncates with an ellipsis rather than widening the card (AC 3)."
            >
              <CartCardDemo
                initialLines={[
                  {
                    id: "long-details",
                    href: "/products/custom-die-cut-stickers",
                    title: "Custom Die-Cut Stickers",
                    unitPrice: 0.75,
                    currencyCode: "usd",
                    quantity: 25,
                    isCustomizable: true,
                    details: [
                      {
                        label: "Text",
                        value:
                          "Please make sure the logo is centered and the drop shadow matches our brand guide exactly — see attached PDF for reference",
                      },
                      {
                        label: "File",
                        value:
                          "sarahs-sweet-shop-final-logo-v3-approved-for-print-2026.png",
                      },
                    ],
                  },
                ]}
              />
            </Section>

            <Section
              title="Missing image"
              description="Uses the same diagonal placeholder as the product card, so a cart line without a thumbnail still reads as part of the same family."
            >
              <CartCardDemo
                initialLines={[
                  {
                    id: "missing-image",
                    href: "/products/coming-soon",
                    title: "Coming Soon",
                    unitPrice: 5,
                    currencyCode: "usd",
                    quantity: 1,
                  },
                ]}
              />
            </Section>

            <Section
              title="Loading"
              description="Shown while the cart is still resolving. The skeleton matches the card's shape exactly, so nothing shifts when the real line arrives."
            >
              <ul className="max-w-md space-y-4">
                <CartCard isLoading />
                <CartCard isLoading />
              </ul>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
