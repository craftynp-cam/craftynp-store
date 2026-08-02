"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { accountAddressesHref, accountHref } from "@/lib/routes";

const NAV_ITEMS = [
  { href: accountHref(), label: "Account settings" },
  { href: accountAddressesHref(), label: "Addresses" },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              isActive
                ? "bg-primary text-on-primary"
                : "text-foreground hover:bg-surface-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
