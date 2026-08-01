"use client";

import Link from "next/link";

import type { NavCategory } from "@/lib/categories";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

import { Drawer, DrawerCloseButton, DrawerPanel, DrawerTitle } from "../ui";
import { ArrowRight } from "../icons";
import { MenuButton } from "./menu-button";
import { NavSearch } from "./nav-search";

type NavDrawerProps = { categories: readonly NavCategory[] };

export function NavDrawer({ categories }: NavDrawerProps) {
  return (
    <Drawer>
      <MenuButton />
      <DrawerPanel
        placement="left"
        className="h-full w-full max-w-none rounded-none p-0 sm:w-[31.25rem] bg-surface-soft"
      >
        {({ close }) => (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-5">
              <div className="min-w-0">
                <DrawerTitle className="font-brand text-3xl leading-none text-foreground">
                  {SITE_NAME}
                </DrawerTitle>
                <p className="mt-2 text-sm text-foreground-muted">
                  {SITE_TAGLINE}
                </p>
              </div>
              <DrawerCloseButton
                label="Close menu"
                className="static shrink-0 rounded-lg p-2 text-foreground hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>

            <div className="md:hidden border-b border-border bg-surface px-6 py-4">
              <NavSearch />
            </div>

            <nav aria-label="Shop">
              <ul>
                <li>
                  <Link
                    href="/products"
                    onClick={close}
                    className="group flex items-center justify-between gap-4 border-b border-border px-6 py-4 text-lg font-bold text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    All Products
                    <ArrowRight
                      aria-hidden="true"
                      size={20}
                      className="shrink-0 text-accent transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                </li>
                {categories.map((category) => (
                  <li key={category.href}>
                    <Link
                      href={category.href}
                      onClick={close}
                      className="group flex items-center justify-between gap-4 border-b border-border px-6 py-4 text-lg font-bold text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      {category.name}
                      <ArrowRight
                        aria-hidden="true"
                        size={20}
                        className="shrink-0 text-accent transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              {categories.length === 0 ? (
                <p className="px-6 py-8 text-foreground-muted">
                  Categories are on their way. Browse everything in the
                  meantime.
                </p>
              ) : null}
            </nav>
          </>
        )}
      </DrawerPanel>
    </Drawer>
  );
}
