import { redirect } from "next/navigation";

import { AccountHeader, AccountNav } from "@/components";
import { getCustomer } from "@/lib/auth";
import { accountHref, signInHref } from "@/lib/routes";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <AccountHeader customer={customer} />
      <div className="border-t border-border pt-8 lg:flex lg:gap-8">
        <div className="mb-8 lg:mb-0 lg:w-56 lg:shrink-0">
          <AccountNav />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
