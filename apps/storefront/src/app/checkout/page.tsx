import type { Metadata } from "next";
import { cookies } from "next/headers";

import { CheckoutView } from "@/components";
import { fetchCustomerAddresses } from "@/lib/addresses";
import { AUTH_COOKIE_NAME, getCustomer } from "@/lib/auth";
import { countryOptions } from "@/lib/checkout";
import { fetchRegion } from "@/lib/region";

export const metadata: Metadata = {
  title: "Checkout",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;

  const [customer, region] = await Promise.all([getCustomer(), fetchRegion()]);
  const savedAddresses = customer ? await fetchCustomerAddresses(token) : [];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <CheckoutView
        customer={customer}
        savedAddresses={savedAddresses}
        countryOptions={countryOptions(region)}
      />
    </main>
  );
}
