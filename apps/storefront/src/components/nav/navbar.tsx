import { ThemeToggle } from "../ui";
import { AccountLink } from "./account-link";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";
import { MenuButton } from "./menu-button";
import { NavSearch } from "./nav-search";
import { SkipLink } from "./skip-link";

/**
 * The persistent header (CNP-24): menu button, logo, search, theme, account,
 * and cart, sticky at the top of every page. Tab order falls out of DOM
 * order — skip link, menu, logo, search, theme, account, cart — so nothing
 * here sets a positive tabIndex.
 *
 * The nav drawer (CNP-25), `/search` (CNP-34), and the account/cart
 * destinations themselves are out of scope; this renders their entry points
 * only.
 */
export function Navbar() {
  return (
    <>
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <MenuButton />
            <Logo />
          </div>

          <div className="flex min-w-0 flex-1 justify-center px-2 sm:px-4">
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
