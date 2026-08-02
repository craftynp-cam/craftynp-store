import type { NavCategory } from "@/lib/categories";

import { Container, ThemeToggle } from "../ui";
import { AccountLink } from "./account-link";
import { AnnouncementBar } from "./announcement-bar";
import { CartDrawer } from "./cart-drawer";
import { Logo } from "./logo";
import { NavDrawer } from "./nav-drawer";
import { NavSearch } from "./nav-search";
import { SkipLink } from "./skip-link";

type NavbarProps = {
  categories: readonly NavCategory[];
  announcement?: string | null;
};

export function Navbar({ categories, announcement }: NavbarProps) {
  return (
    <>
      <SkipLink />
      <div className="sticky top-0 z-40">
        {announcement ? <AnnouncementBar text={announcement} /> : null}
        <header className="border-b border-border bg-surface">
          <Container className="flex h-(--header-height) items-center justify-between gap-2 sm:gap-4">
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
              <CartDrawer />
            </div>
          </Container>
        </header>
      </div>
    </>
  );
}
