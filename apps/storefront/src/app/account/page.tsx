import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountPanel } from "@/components";
import { getCustomer } from "@/lib/auth";
import { accountHref, signInHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Account",
};

// Reads the session cookie through getCustomer(), which Next's static
// analysis doesn't see through the react `cache()` wrapper — force dynamic
// rendering explicitly rather than risk this being prerendered once and
// served to every visitor regardless of who is signed in.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const customer = await getCustomer();

  if (!customer) {
    redirect(signInHref({ returnTo: accountHref() }));
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-16"
    >
      <AccountPanel customer={customer} />
    </main>
  );
}
