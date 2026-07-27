import type { NavCategory } from "@/lib/categories";

import { ThemeToggle } from "../ui";
import { AccountLink } from "./account-link";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";
import { NavDrawer } from "./nav-drawer";
import { NavSearch } from "./nav-search";
import { SkipLink } from "./skip-link";

type NavbarProps = { categories: readonly NavCategory[] };

/**
 * The persistent header: nav drawer trigger, logo, search, theme, account,
 * and cart, sticky at the top of every page. Tab order falls out of DOM
 * order — skip link, menu, logo, search, theme, account, cart — so nothing
 * here sets a positive tabIndex.
 *
 * There is no horizontal desktop nav — the drawer (CNP-25) is the site's
 * only navigation at every breakpoint. `categories` is a required prop
 * rather than fetched here, since RTL cannot render an async server
 * component; `layout.tsx` awaits `fetchNavCategories()` and passes it down.
 * The search field is duplicated into the drawer below `md`, so it's hidden
 * here at that breakpoint — see `NavDrawer`.
 *
 * `/search` (CNP-34) and the account/cart destinations themselves are still
 * out of scope; this renders their entry points only.
 */
export function Navbar({ categories }: NavbarProps) {
  return (
    <>
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <NavDrawer categories={categories} />
            <Logo />
          </div>

          <div className="hidden min-w-0 flex-1 justify-center px-2 sm:px-4 md:flex">
            <NavSearch />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle variant="compact" />
            <AccountLink />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}
