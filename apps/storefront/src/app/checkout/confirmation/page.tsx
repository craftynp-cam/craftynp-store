import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Order confirmed",
};

type CheckoutConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutConfirmationPage({
  searchParams,
}: CheckoutConfirmationPageProps) {
  const { order, number } = await searchParams;
  const orderId = typeof order === "string" ? order : null;
  const displayId = typeof number === "string" ? number : null;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-2xl px-4 py-16 text-center"
    >
      <h1 className="font-display text-4xl text-foreground sm:text-5xl">
        Thank you for your order
      </h1>

      {displayId ? (
        <p className="mt-4 text-lg text-foreground-muted">
          Order{" "}
          <span className="font-medium text-foreground">#{displayId}</span> is
          confirmed. We&rsquo;ll email you when it ships.
        </p>
      ) : (
        <p className="mt-4 text-lg text-foreground-muted">
          Your order is confirmed. We&rsquo;ll email you when it ships.
        </p>
      )}

      {orderId ? (
        <p className="mt-2 text-sm text-foreground-muted">
          Confirmation reference: {orderId}
        </p>
      ) : null}

      <Link
        href="/products"
        className="mt-10 inline-block font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Continue shopping
      </Link>
    </main>
  );
}
