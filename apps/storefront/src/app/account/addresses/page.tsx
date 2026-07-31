import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AddressesView } from "@/components";
import { fetchCustomerAddresses } from "@/lib/addresses";
import { AUTH_COOKIE_NAME, getCustomer } from "@/lib/auth";
import { countryOptions } from "@/lib/checkout";
import { fetchRegion } from "@/lib/region";
import { accountHref, signInHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Addresses",
};

export const dynamic = "force-dynamic";

export default async function AccountAddressesPage() {
  const customer = await getCustomer();

  if (!customer) {
    redirect(signInHref({ returnTo: accountHref() }));
  }

  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;

  const [addresses, region] = await Promise.all([
    fetchCustomerAddresses(token),
    fetchRegion(),
  ]);

  return (
    <AddressesView
      addresses={addresses}
      countryOptions={countryOptions(region)}
    />
  );
}
