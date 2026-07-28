/**
 * The only file in the storefront that imports Phosphor directly — every
 * other module reaches these through this barrel, so the icon library stays
 * swappable. Pulled from the `/dist/ssr` subpath rather than the package
 * root: the SSR build carries no "use client" boundary, so these render
 * inside server components (Logo, AccountLink) as well as client ones.
 *
 * Every glyph here is decorative. Callers set `aria-hidden` on the icon and
 * put the accessible name on the surrounding control (CNP-24 AC 4) — this
 * module does not do it for them, because the name belongs to the button or
 * link, not the glyph.
 */
export {
  ArrowRight,
  FacebookLogo,
  InstagramLogo,
  List,
  MagnifyingGlass,
  Minus,
  UserCircle,
  Plus,
  ShoppingCartSimple,
  Monitor,
  Sun,
  Moon,
  TiktokLogo,
  X,
} from "@phosphor-icons/react/dist/ssr";
