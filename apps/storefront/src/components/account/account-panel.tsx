import type { AuthedCustomer } from "@/lib/auth";
import { authLogoutHref } from "@/lib/routes";

import { Button } from "../ui";

export type AccountPanelProps = {
  customer: AuthedCustomer;
};

export function AccountPanel({ customer }: AccountPanelProps) {
  const name = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-foreground">Account</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {name ? `${name} · ${customer.email}` : customer.email}
        </p>
      </div>

      <form method="post" action={authLogoutHref()}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
