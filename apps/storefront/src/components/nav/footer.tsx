import Link from "next/link";

import type { NavCategory } from "@/lib/categories";
import {
  CONTACT_LINKS,
  SITE_NAME,
  SITE_TAGLINE,
  SOCIAL_LINKS,
} from "@/lib/site";

import { FacebookLogo, InstagramLogo, TiktokLogo } from "../icons";
import { Container } from "../ui";
import { BrandLockup } from "./logo";

type FooterProps = { categories: readonly NavCategory[] };

const socialIcons = {
  Instagram: InstagramLogo,
  Facebook: FacebookLogo,
  TikTok: TiktokLogo,
} as const;

const linkClassName =
  "text-off-white/80 transition-colors hover:text-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink rounded-sm";

const headingClassName =
  "font-display text-sm font-bold tracking-widest text-gold uppercase";

export function Footer({ categories }: FooterProps) {
  return (
    <footer className="bg-ink text-off-white">
      <Container className="py-14 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <BrandLockup />
            <p className="mt-4 max-w-sm text-off-white/80">{SITE_TAGLINE}</p>
            <ul className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => {
                const Icon =
                  socialIcons[social.label as keyof typeof socialIcons];
                return (
                  <li key={social.href}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-off-white/10 text-off-white transition-colors hover:bg-off-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                    >
                      <Icon aria-hidden="true" size={20} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <nav aria-label="Shop links">
            <h2 className={headingClassName}>Shop</h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/products" className={linkClassName}>
                  All Products
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.href}>
                  <Link href={category.href} className={linkClassName}>
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Get in touch links">
            <h2 className={headingClassName}>Get in touch</h2>
            <ul className="mt-4 space-y-3">
              {CONTACT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-off-white/20 pt-6 text-sm text-off-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. Made by hand.
          </p>
          <p>Secure checkout · Powered by Stripe</p>
        </div>
      </Container>
    </footer>
  );
}
