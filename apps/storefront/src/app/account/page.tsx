import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountSettingsView } from "@/components";
import { getCustomer } from "@/lib/auth";
import { accountHref, signInHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Account settings",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await getCustomer();

  if (!customer) {
    redirect(signInHref({ returnTo: accountHref() }));
  }

  return <AccountSettingsView customer={customer} />;
}
