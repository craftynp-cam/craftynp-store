# AGENTS.md — storefront

Instructions for the Next.js storefront. The repo-wide setup, commands,
branching strategy, and shared conventions are in the root
[AGENTS.md](../../AGENTS.md) — read that first; this file only covers what is
particular to this app.

## Overview

Next.js 16 App Router, React 19, Tailwind CSS 4, on port **8000**. Server
components fetch from the Medusa backend through `@medusajs/js-sdk`
(`src/lib/medusa.ts`). Shared zod schemas and types come from `@craftynp/types`,
resolved through its built `dist/` — which is why storefront tasks must be run
via the root scripts, never `pnpm --filter`.

`tsconfig.json`'s `paths` entry for `@craftynp/types` points at
`dist/index.d.ts`, not the adjacent `dist/index.js` — with `allowJs` on,
mapping to the `.js` file makes TypeScript infer the module's export list from
that file's own re-exports, and value-only `export {...} from "./x.js"` lines
silently swallow every purely type-only `export type {...} from "./x.js"` line
next to them, since the type-only re-export leaves no trace in the compiled
JS. Every type in the package (`SiteContent` included) went missing this way
before the mapping was corrected — the runtime import is unaffected either
way, since `paths` only ever governs type-checking.

Layout — read the directory before changing it; this is not an inventory of
what's inside, just what a reader wouldn't get from the code:

- `src/app` — routes, `layout.tsx`, `globals.css` (the token source of truth),
  and the `/design/tokens` token reference page. Every route's `<main>` carries
  `id="main-content" tabIndex={-1}` — that is what the navbar's skip link
  targets. Add both to any new page's `<main>`. Catalog URLs are
  `/products` (all products), `/{category}` (CNP-31), and
  `/{category}/{product}` (CNP-33). `src/app/products/page.tsx` is a literal
  segment, so it — and `/design`, `/sign-in`, `/account`, and `/auth` (CNP-56)
  — shadow any Medusa category whose handle matches; a category can't use
  those handles. A product 404s if its handle resolves but the URL's category
  segment doesn't match, so it isn't reachable at more than one path; a
  category 404s if its handle doesn't resolve at all. `src/app/auth/*` are
  route handlers, not pages — see [Auth](#auth-cnp-565758) below for why they
  have to live there specifically and not under `/api`.
- `src/components/ui` — the HeroUI-backed primitives.
- `src/components/account` — `/sign-in` and `/account`'s parts (CNP-56/57/58).
  Both are sync components taking props (`SignInPanel`, `AccountPanel`), the
  same reason `Navbar` takes `categories` rather than fetching — the pages
  that render them are async server components RTL cannot render. Neither
  "Continue with…" control is HeroUI's `Button`: it renders a real `<button>`,
  and these navigate to a route handler, so they're styled `Link`s instead.
- `src/components/cards` — higher-level, product-facing components built on
  those primitives.
- `src/components/catalog` — the product listing page's parts (CNP-31):
  sidebar, sort control, toolbar, grid, and the shared `CatalogView` both
  `/products` and `/{category}` render, so "both use the same layout" is
  literal rather than a coincidence of two separate pages. Medusa's store
  product list orders on product fields only — there is no first-class price
  ordering — so `featured` and `newest` are requested via `order`
  (`-created_at` for newest) and the two price sorts are applied in Node, over
  the already-fetched page (`sortCatalogProducts` in `src/lib/product-list.ts`).
  Release 1's catalog is small enough that one `product.list` per view with a
  `limit: 100` and no pagination is the whole fetch.
- `src/components/product` — the product detail page's parts (CNP-33):
  gallery, variant selector, price, stock status, purchase panel, details.
  `Breadcrumbs` (`src/components/nav/breadcrumbs.tsx`) is strictly
  URL-derived — it reads `usePathname()` and title-cases each segment, with no
  per-page override.
- `src/components/home` — the homepage category carousel (CNP-29) and its
  slide. Rendered on a fixed navy surface (`bg-ink`/`text-off-white`), the same
  fixed-in-both-modes treatment the footer uses, so its focus ring is
  `ring-off-white` rather than the mode-following `ring-primary`.
- `src/components/nav` — the global header, footer, and their parts, rendered
  once in `layout.tsx`. There is no horizontal desktop nav — the drawer is the
  site's only navigation at every breakpoint. `Navbar` and `Footer` both take
  `categories` as a required prop rather than fetching it themselves: RTL
  cannot render an async server component, so `layout.tsx` awaits
  `fetchNavCategories()` once and passes the result to both. `AnnouncementBar`
  (CNP-23) is `Navbar`'s `announcement` prop, sourced the same way from
  `fetchSiteContent()`; `Navbar` owns the sticky wrapper around both itself and
  the bar, so `SkipLink` stays the first element in DOM order and the two
  scroll together. Short copy renders centred and static; copy wider than the
  viewport marquees instead of wrapping, so the bar stays exactly one line
  tall — it reuses `reduced-motion.ts` the same way the category carousel
  does, and the marquee is a hard stop, not a slowdown, under
  `prefers-reduced-motion`.
- `src/components/icons` — the only module that imports Phosphor
  (`@phosphor-icons/react`) directly, so the library stays swappable. Pulled
  from the `/dist/ssr` subpath, which has no `"use client"` boundary, so icons
  render in server components too. Every glyph is decorative: callers pass
  `aria-hidden` on the icon and put the accessible name on the surrounding
  control.
- `src/lib` — the Medusa SDK client, the design-token mirror, contrast maths,
  the theme store, category fetching, site constants, and the cart. Two things
  worth knowing before you touch them: `categories.ts` never throws — a Medusa
  outage degrades to an empty state instead of taking the site down — and
  `cart.ts`'s snapshot is cached at module scope because
  `useSyncExternalStore` requires a referentially stable object; `cart-drawer.ts`
  is a separate, unpersisted open/close store so a reload never leaves the
  drawer open. `drawer-open.ts` (CNP-29) tracks whether any drawer is open at
  all, by id, so the carousel can pause while one is; `src/components/ui/drawer.tsx`
  reports into it from every `Drawer` instance. `reduced-motion.ts` mirrors
  `prefers-reduced-motion` the same `useSyncExternalStore` way, guarding for
  jsdom's lack of `matchMedia`. `carousel.ts` is the pure wraparound index
  maths behind the carousel's auto-advance. `routes.ts` is the single place a
  category or product href is built — `categories.ts`, `product-card.ts`, and
  `product.ts` all go through it. `region.ts` (CNP-33) fetches the default
  Medusa region and, like `categories.ts`, never throws; its `id` has to be
  passed as `region_id` to any product query or `calculated_price` comes back
  null. `product.ts` maps a Medusa product to the product page's shape;
  `variant.ts` is the pure availability/selection logic behind it — in vs. low
  vs. out of stock, and which option-value combinations currently resolve to a
  purchasable variant (unavailable ones are flagged for a disabled control, not
  removed). `structured-data.ts` builds the product page's schema.org
  Product JSON-LD from that same `ProductDetail` shape. `sort.ts` (CNP-31) is
  the catalog's sort vocabulary — parsing `?sort=`, falling back to featured
  for anything unrecognised, and mapping a sort to Medusa's `order` param.
  `product-list.ts` fetches and sorts a catalog view's products;
  `categories.ts`'s `fetchCatalogSidebar` builds the sidebar's category list
  and counts from two requests total (one `product.list` read for every
  product's categories, tallied in Node), not the one-request-per-category
  `fetchShowcaseCategories` above makes. `site-content.ts` (CNP-23) fetches the
  Medusa site content module's resolved values, `next: { revalidate: 60 }` so
  an admin edit shows up without a redeploy; like `categories.ts` and
  `region.ts` it never throws — an outage falls back to the registry's
  defaults, which leave the announcement bar off. `auth.ts` (CNP-56/57/58) is
  the session cookie's shape and options, a dependency-free JWT payload
  decoder (the token comes from a trusted server-to-server exchange, so this
  only reads it — it does not verify a signature), and `getCustomer()`, which
  follows the same never-throws convention. `medusa.ts`'s `createAuthFlowSdk`
  is a **fresh** `Medusa` instance per call, used only for `sdk.auth.login` /
  `.callback` / `.refresh` — never call those on the module-scope `sdk`
  singleton, which is shared across concurrent server requests and would leak
  one customer's token into another's render. A call made on behalf of an
  already-signed-in customer doesn't need a scoped client at all: pass an
  `Authorization` header on that one call, on the singleton `sdk`, since a
  per-call header doesn't mutate it.
- `test` — a mirror of `src/`; see [Testing](#testing).

Each directory has its own barrel (`index.ts`); a new component is unreachable
until it's exported there — see [Component imports](#component-imports).

## Environment

Copy `.env.example` to `.env.local`. It needs
`NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, and
`NEXT_PUBLIC_DEFAULT_REGION`. The publishable key does not exist until
`pnpm run db:migrate` has run — the seed is a migration script and prints the
`pk_…` value in that command's output.

For Auth0 (CNP-56/57/58): `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID`, both
server-side only (not `NEXT_PUBLIC_`) — used only to build the sign-out URL,
never sent to the browser — and `NEXT_PUBLIC_SITE_URL`, this site's own base
URL, used to build the absolute `callback_url` sent to Medusa and the
`returnTo` sent to Auth0's logout endpoint. The client secret lives only in
`apps/medusa/.env`; the storefront never holds it.

## Design tokens

The brand palette, type scale, spacing scale, and radii are declared once, in
`src/app/globals.css`, in three layers:

1. `@theme` — the seven fixed brand colours and the type/spacing/radius scales.
2. `@theme inline` — semantic aliases, each pointing at a `--t-*` variable.
3. `:root` — both modes of each `--t-*` variable, on one line, via
   `light-dark()`.

**Components use the generated utilities — `bg-surface`,
`text-foreground-muted`, `rounded-lg`, `font-display` — and never a raw hex
value.** Prefer the semantic aliases (`background`, `surface`, `foreground`,
`primary`, `danger`) over the raw brand names: they carry intent, and they are
the only colours that follow the active mode.

The `inline` on the second layer is load-bearing. It emits `var(--t-*)` into
each utility, so the utility tracks the mode. A plain `@theme` would freeze
every utility at its light value.

**Both modes come from the same seven colours.** Light composites ink navy over
off-white; dark composites off-white over ink navy. Do not introduce a hue that
exists in only one mode, and do not introduce a new grey — greys are the two
extremes composited at reduced opacity. Muted black is unused in dark mode on
purpose: it sits within 1.1:1 of ink navy, so as a layer it would be invisible.

Raw alert red is not legible enough for text in either mode (3.5:1 on the light
blush surface, 3.8:1 on the dark page). Use `danger-foreground` for error text
and `danger` only as a surface.

The drawer's scrim bridges a `--backdrop` variable (in the unlayered HeroUI
bridge block, alongside `--focus`/`--link`) keyed off ink navy rather than
`foreground` — `foreground` inverts with the mode, and a backdrop has to dim
the page in both light and dark, not flip to a light scrim in dark mode.

`src/lib/design-tokens.ts` mirrors those values so the reference page at
**`/design/tokens`** can render and measure every token in both modes;
`design-tokens.test.ts` fails if the mirror and the CSS drift, and asserts that
every text-bearing pairing clears WCAG AA at 4.5:1 on every surface of its
mode. Pairings below that threshold must be marked `decorative` with a note
explaining why. Change a token in both files, or the suite will tell you.

**The modes hang off `color-scheme`, not a media query.** `light-dark()` reads
the used `color-scheme`, so `:root` declares `color-scheme: light dark` (follow
the OS) and `:root[data-theme="light"|"dark"]` pins it. One attribute therefore
switches the tokens _and_ the native form controls, scrollbars, and caret. Do
not reintroduce a `prefers-color-scheme` block — a test asserts its absence,
because a second mechanism would have to be kept in sync with this one.

`ThemeToggle` (`src/components/ui/theme-toggle.tsx`) writes that attribute and
persists to `localStorage`. Two things about it are load-bearing:

- It reads the stored value through `useSyncExternalStore`, not `useState` in
  an effect — the React 19 lint rule rejects the latter, and the store form
  also keeps other tabs in step via the `storage` event.
- `themeInitScript` runs as a **blocking inline script in `<head>`**, set in
  `layout.tsx`. Without it a reader who pinned a mode gets a flash of the OS
  mode before hydration. Do not move it into a component or defer it. Because
  it writes `data-theme` to `<html>` before React hydrates, that element must
  keep `suppressHydrationWarning` — otherwise every page logs a hydration
  error. The suppression is scoped to `<html>`'s own attributes and does not
  reach any child.

`ThemeToggle` takes a `variant` prop: `"group"` (default) is the labelled
three-button control on `/design`; `"compact"` is the single icon button in the
navbar, which cycles system → light → dark and names both the current mode and
what activating it switches to.

## HeroUI

The shared primitives in `src/components/ui` — button, text input, textarea,
select, checkbox, radio group, badge, drawer — are thin wrappers over **HeroUI
v3**, which is built on React Aria Components. Use them rather than reaching
for HeroUI directly; they translate brand vocabulary into HeroUI's and are
where the accessibility guarantees are tested.

Three non-obvious HeroUI facts the drawer wrapper (`ui/drawer.tsx`) exists
because of:

- **`DrawerCloseTrigger` falls back to its own `CloseIcon`, rendered without
  `aria-hidden`, and hardcodes `aria-label="Close"`.** That breaks this repo's
  rule that every glyph is decorative with the name on the surrounding
  control, so `DrawerCloseButton` always supplies its own hidden icon and
  requires a caller-provided `label`.
- **Only `@heroui/react/<component>` subpaths resolve under Jest.** The
  `moduleNameMapper` below points each one at `dist/components/$1/index.js`;
  a non-component subpath like `@heroui/react/hooks/use-overlay-state` has no
  matching directory and breaks every test that imports it. Use the render-prop
  `close` a `Dialog`'s children function receives instead of HeroUI's
  `useOverlayState`.
- **Tailwind's `utilities` layer beats HeroUI's `components` layer.** Plain
  token utilities passed as `className` — `bg-surface-soft`, `w-[31.25rem]` —
  override HeroUI's BEM defaults with no specificity fights and no
  `!important`. That's how the drawer panel gets its brand geometry.

**HeroUI's component CSS is plain BEM** (`.button`, `.button--primary`), not
generated utilities, so Tailwind does not need to `@source`-scan
`node_modules`. `globals.css` bridges HeroUI's variables to the `--t-*` tokens
and that is the whole integration.

**HeroUI reads its colours two different ways, and this matters.** Some
components take the bare variable — `button.css` is `--button-bg:
var(--accent)` — while others take the Tailwind utility, as `radio.css` does
with `@apply bg-accent`. The utility resolves through `--color-accent`, which
our own `@theme inline` block also defines. **The bare variable and our
`--color-*` alias of the same name must therefore agree**, or one component
disagrees with another: bridging `--accent` to `--t-primary` while `bg-accent`
stayed gold produced a navy button beside a gold radio in the same form. It is
not enough to reason about this from the bare variables alone — check the
rendered page.

**So `accent` is gold on both sides**, and HeroUI's primary action is gold on
ink navy, a pairing `design-tokens.test.ts` already holds to AA. The palette's
`primary` (ink navy) still backs `bg-primary` and the focus ring.

**The bridge is what keeps `system` mode working.** HeroUI's own theme has only
two states, keyed off `.light`/`.dark`/`[data-theme]`, with no OS-following
equivalent; left alone it paints light components on a dark page for a dark-OS
reader who has not pinned a mode. Because every `--t-*` is a `light-dark()`,
HeroUI's variables inherit `color-scheme` for free. The bridge block is
**unlayered on purpose** — HeroUI declares its values inside a nested cascade
layer, and unlayered declarations beat every layered one.

**The focus ring is `primary`, not gold.** Gold is the brand's attention colour
and the obvious choice, and it fails: 1.36–1.84:1 against the light-mode
surfaces, well under the 3:1 WCAG 1.4.11 requires. `focus-ring.test.ts` holds
the ring to 3:1 on every surface of both modes and records why gold is
rejected.

**The footer is the one surface that stays navy in both modes.** It uses the
fixed brand utilities (`bg-ink`, `text-off-white`, `text-gold`) rather than the
mode-following semantic aliases, so `ring-primary` — ink navy in light mode —
would be invisible on it. Its focus ring is `ring-off-white` instead.

**`pnpm-workspace.yaml` declares `@types/react` as a peer** of HeroUI and the
React Aria packages. They declare `react` but not its types, so pnpm links no
type package into their subgraphs and their `.d.ts` files resolve `react` by
walking up to pnpm's private hoist directory — which holds **18**, because the
Medusa admin needs it. HeroUI's props then type against React 18 while the
storefront is on 19, and anything crossing the boundary fails to typecheck. Do
not solve this by hoisting (it removes the types entirely) or by adding
`@types/react` to the root `package.json` (it makes React 19's types ambient
for `apps/medusa`, which runs React 18).

## Icons

**Phosphor** (`@phosphor-icons/react`) is the icon library. Import glyphs only
through `src/components/icons` — that barrel is the sole place the package is
imported directly, so swapping icon libraries later touches one file. It
imports from the `/dist/ssr` subpath, not the package root: the SSR build
carries no `"use client"` boundary, so icons render inside server components
(`Logo`, `AccountLink`) as well as client ones. `next.config.ts` sets
`experimental.optimizePackageImports` for the package so its barrel re-export
doesn't pull the whole icon set into the client bundle.

Every glyph is decorative. The icon component gets `aria-hidden="true"`; the
accessible name goes on the surrounding button or link, never the glyph — this
is what CNP-24's navbar tests assert (no `svg` contributes to an accessible
name anywhere in the header).

## Logo

`public/logo.svg` is a placeholder monogram, clearly marked as such in the
file's own comment — swap it for the real artwork and nothing else changes.
`src/components/nav/logo.tsx` references it by path only.

## Auth (CNP-56/57/58)

Customer sign-in, registration, "Continue with Google", and password reset all
run through **Auth0 Universal Login** — this app never renders a credential
form itself. `/sign-in` links to `/auth/login`, a route handler that asks
Medusa's Auth0 provider for a redirect URL and sends the customer there;
Auth0 redirects back to `/auth/callback`, which exchanges the code for a
Medusa JWT, creates the customer on a first sign-in, and sets the session
cookie. See `apps/medusa/AGENTS.md`'s own Auth section for the backend half —
the verified-email identity decision that makes CNP-57 AC4 hold lives there.

**`next.config.ts` rewrites `/api/:path*` to the Medusa backend.** A route
handler mounted under `/api` would be proxied away and never run — this is
why every auth route lives at `/auth/*` instead. There is deliberately no
`middleware.ts`: `/account` guards itself server-side by redirecting when
`getCustomer()` returns null, and a broad middleware matcher would intercept
the same `/api/*` and `/app/*` rewrites.

The session cookie (`src/lib/auth.ts`) is `httpOnly`, `sameSite: "lax"` —
not `"strict"`, or a customer arriving via the top-level redirect from Auth0
would look signed-out on the very page meant to prove sign-in worked —
`secure` only in production, and its `maxAge` is read off the Medusa JWT's
own `exp`. A second, short-lived cookie (`cnp_auth_return_to`, scoped to
`/auth`) carries the post-sign-in destination between `/auth/login` and
`/auth/callback`; it exists because Medusa's own OAuth `state` is opaque
server-side storage the storefront has no way to read back.

**Auth0 reports every denied login as `error=access_denied`**, whether the
customer actually cancelled or a post-login Action blocked them — there's no
separate machine-readable code. `classifyAuthCallbackError` (`src/lib/auth.ts`)
switches on `error_description` instead, specifically so a customer who signs
up but hasn't clicked the verification link yet (blocked by the tenant's
"Require Email Verification" Action) sees "check your inbox," not "sign-in was
cancelled" — the two look identical at the OAuth-error-code level but call for
opposite next steps.

## Component imports

`src/components/index.ts` is the barrel: it re-exports everything under
`src/components/ui`, so the whole component surface is one import object.

- **From outside the components directory** — pages, tests, anywhere — import
  from `@/components`: `import { Button, ThemeToggle } from "@/components";`.
  Do not reach past the barrel to a file path like `@/components/ui/button`.
- **From inside the components directory**, import from `"."`, which resolves
  to the nearest barrel: `import type { FieldProps } from ".";` in
  `ui/textarea.tsx`. Do not use sibling paths like `"./text-input"`.

When you add a component, export it from `src/components/ui/index.ts` in the
same call — an unexported file is unreachable through the barrel and will fail
to import from anywhere else.

## Testing

jsdom, via `next/jest`. Tests live in a **separate `test/` tree that mirrors
`src/`** — a test sits in the same-named parent directory as its production
counterpart (`src/components/ui/button.tsx` →
`test/components/button.test.tsx`, `src/lib/medusa.ts` →
`test/lib/medusa.test.ts`). The config sets `roots: ["<rootDir>/test"]`, so a
test left under `src/` is silently never run.

Import the code under test through the `@/` alias (`@/lib/contrast`,
`@/components`) — a relative path out of `test/` will not resolve. Tests that
read source files off disk (`design-tokens.test.ts`, `focus-ring.test.ts`) must
reach back two levels and into `src` from `__dirname`, not one.

The lint script is `eslint src test`, so tests are linted to the same standard
as production code — including `@typescript-eslint/consistent-type-imports`,
whose `files` glob in `eslint.config.mjs` covers both trees. A new top-level
directory needs adding to both, or its contents go unchecked.

**Component rendering works.** `@testing-library/react` (v16, React
19-compatible) and `@testing-library/jest-dom` are devDependencies, and
`jest.setup.ts` imports the jest-dom matchers above the Streams/`TextEncoder`
polyfills that `@medusajs/js-sdk` needs — leave those polyfills in place.
`test/components/product-list-item.test.tsx` is the worked example.

This was previously blocked: under npm, React 18 hoisted to the root
`node_modules` while the storefront's React 19 stayed nested, so a root-hoisted
RTL rendered React 19 elements through React 18's reconciler and failed with
"Objects are not valid as a React child". pnpm does not hoist — each app
resolves its own React through its own `node_modules` symlink — so the collision
is now structurally impossible. Do not add `node-linker=hoisted` or
`public-hoist-pattern`; both would reintroduce it.

**Do not try to render `src/app/page.tsx`.** It is an async server component
that fetches from a live backend; RTL cannot render it. Cover it with
HTTP-level checks against the running app instead. `Navbar` stays a sync
component with a required `categories` prop for the same reason — see
`src/components/nav` above.

**The header search and the drawer's mobile search coexist in the DOM**, one
hidden by CSS at each breakpoint. jsdom applies no CSS, so both are "visible"
to a role query while the drawer is closed — scope with `within()` (or, once
the drawer is open, query by `document`/`container` directly, since React
Aria also marks the header `aria-hidden` while the drawer is open and its
searchbox becomes unreachable by role). See `test/components/navbar.test.tsx`
and `test/components/nav-drawer.test.tsx`.

**The Jest config carries three HeroUI accommodations** (`jest.config.mjs`).
Each is load-bearing; removing any one makes every test that imports a primitive
fail to run.

- `moduleNameMapper` maps `@heroui/react/*` onto the package's `dist/` files.
  HeroUI's exports map offers only `import` and `types` conditions, so Jest's
  CommonJS resolver finds no candidate at all.
- `transformIgnorePatterns` is reduced to CSS modules, so `node_modules` gets
  transformed. HeroUI and the React Aria packages under it ship untranspiled
  ESM. An allowlist was tried first and does not hold — the transitive tail
  keeps growing.
- `customExportConditions` is deliberately **not** set to include `import`.
  It applies to every package, so any dependency listing `import` before
  `require` (dedent, via tailwind-variants) resolves to an `.mjs` that Jest
  classifies as native ESM and then cannot load.

The storefront currently holds **491** of the repo's 545 tests. A smaller number
after your change means something was dropped.
