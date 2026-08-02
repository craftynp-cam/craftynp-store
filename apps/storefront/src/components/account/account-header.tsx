import type { AuthedCustomer } from "@/lib/auth";
import { authLogoutHref } from "@/lib/routes";

import { Button } from "../ui";

export type AccountHeaderProps = {
  customer: AuthedCustomer;
};

function initials(customer: AuthedCustomer): string {
  const first = customer.first_name?.trim().charAt(0) ?? "";
  const last = customer.last_name?.trim().charAt(0) ?? "";
  const combined = `${first}${last}`.toUpperCase();
  return combined || customer.email.charAt(0).toUpperCase();
}

function memberSinceYear(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const year = new Date(createdAt).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

export function AccountHeader({ customer }: AccountHeaderProps) {
  const year = memberSinceYear(customer.created_at);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg text-on-primary"
        >
          {initials(customer)}
        </span>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Hi, {customer.first_name || "there"}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {customer.email}
            {year ? ` · Member since ${year}` : null}
          </p>
        </div>
      </div>

      <form method="post" action={authLogoutHref()}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
