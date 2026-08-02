import type { Metadata } from "next";
import { cookies } from "next/headers";

import { OrderConfirmationView } from "@/components";
import { AUTH_COOKIE_NAME, getCustomer } from "@/lib/auth";
import { fetchOrderConfirmation } from "@/lib/order";
import { checkoutConfirmationHref } from "@/lib/routes";
import { fetchSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Order confirmed",
};

function firstParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

type CheckoutConfirmationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutConfirmationPage({
  searchParams,
}: CheckoutConfirmationPageProps) {
  const params = await searchParams;
  const orderId = firstParam(params.order);
  const displayId = firstParam(params.number);
  const token = firstParam(params.token);

  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  const [order, content, customer] = await Promise.all([
    orderId ? fetchOrderConfirmation(orderId, token, sessionToken) : null,
    fetchSiteContent(),
    getCustomer(),
  ]);

  const returnTo = orderId
    ? checkoutConfirmationHref(
        orderId,
        Number(displayId ?? 0),
        token ?? undefined,
      )
    : "/account";

  return (
    <main id="main-content" tabIndex={-1}>
      <OrderConfirmationView
        order={order}
        fallbackDisplayId={displayId}
        turnaroundNote={content.order_turnaround_note}
        shippingWindowNote={content.order_shipping_window_note}
        isSignedIn={customer != null}
        returnTo={returnTo}
      />
    </main>
  );
}
