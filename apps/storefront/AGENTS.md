# AGENTS.md — storefront

Next.js 16 App Router, React 19, Tailwind CSS 4, on port **8000**. Server
components fetch from Medusa through `@medusajs/js-sdk` (`src/lib/medusa.ts`);
shared schemas come from `@craftynp/types`. Repo-wide setup, commands, and
conventions are in the root [AGENTS.md](../../AGENTS.md).

## Routing

- **`next.config.ts` rewrites `/api/:path*` and `/app/:path*` to Medusa**, so a
  route handler mounted under `/api` is proxied away and never runs. Every
  handler this app owns lives outside it — `src/app/auth/*` and
  `src/app/checkout/*`.
- **Leave `images.dangerouslyAllowLocalIP: true` in `next.config.ts`.** It is
  named to look like a mistake and is load-bearing in development: Next's image
  optimizer blocks any upstream host that resolves to a private or loopback IP
  regardless of `images.remotePatterns`, and fails with the misleading
  `"url" parameter is not allowed` — the real cause, `resolved to private ip`,
  appears only in the server log. Without it every Medusa-uploaded image 400s.
- **There is deliberately no `middleware.ts`.** Guard server-side inside the
  page instead — a broad middleware matcher would intercept those same
  rewrites. `src/app/account/layout.tsx` redirects when `getCustomer()` returns
  null, but each page under `/account` repeats the same guard rather than
  trusting the layout alone, since Next does not guarantee a layout's own data
  fetch runs before a page's.
- Catalog URLs are `/products`, `/{category}`, and `/{category}/{product}`.
  Literal top-level segments in `src/app` — `products`, `about`, `account`,
  `auth`, `checkout`, `design`, `sign-in` — shadow the `/{category}` dynamic
  route, so **a Medusa category cannot use one of those handles**, and each new
  top-level route claims one more.
- Every page's `<main>` must carry `id="main-content"` and `tabIndex={-1}` —
  that is what the navbar's skip link targets.

## Components

- **Build UI from the wrappers in `src/components/ui`**, not from HeroUI
  directly. They translate brand vocabulary into HeroUI's and are where the
  accessibility guarantees are tested.
- **A component a test must cover has to be sync and take its data as props.**
  React Testing Library cannot render an async server component, so the page
  awaits the fetch and passes the result down — `Navbar`, `Footer`,
  `SignInPanel`, `CheckoutView` and the home/about sections all work this way.
- **Import from `@/components` outside the components tree** — never a deep path
  like `@/components/ui/button`. Inside the tree, use a sibling path within a
  directory (`"./address-fields"`) and the other directory's barrel across them
  (`"../ui"`). `src/components/index.ts` re-exports every subdirectory barrel
  except `icons`; export a new component from its own directory's `index.ts` in
  the same change or it is unreachable.
- **Import icons only through `src/components/icons`** — the sole place
  `@phosphor-icons/react` is imported, and from its `/dist/ssr` subpath so
  glyphs render in server components too. Every glyph is decorative:
  `aria-hidden` on the icon, the accessible name on the surrounding control.

## `src/lib`

- **Nothing a client component value-imports may import `medusa.ts`**, directly
  or transitively. It throws at module-eval when the env vars are unset, which
  fails every suite that imports the `@/components` barrel. Keep pure logic in
  medusa-free modules (`saved-address.ts`, `shipping-rates.ts`, `tax-quote.ts`,
  `payment.ts`, `upstream-error.ts`). `import type` is fine.
- **Medusa fetch helpers degrade for a failed _query_ and throw for a failed
  _backend_.** The split is `isBackendFailure()` in `src/lib/medusa-error.ts`: a
  rejection that is not a `FetchError` (DNS, refused, TLS, timeout), or one
  carrying 401/403 (wrong publishable key), 404 on a core store route, or any
  5xx, is a misconfigured or down backend and is rethrown as
  `MedusaUnavailableError` so `app/error.tsx` renders a visible error. Anything
  else — a rejected filter, a 422 — still degrades to an empty or default value.
  New fetchers follow this split.
  Degrading on everything, which is what this used to say, meant a wrong
  `NEXT_PUBLIC_MEDUSA_BACKEND_URL` served an empty catalogue and a 200, and
  404'd every category page, with nothing visible anywhere (CNP-17).
  Three helpers deliberately keep degrading on everything, and should not be
  "fixed": **`getCustomer()`**, because it sends a bearer token so a 401 there
  is an expired session, not a misconfiguration; **`fetchOrderConfirmation`**,
  because it runs after money has been taken and a thank-you beats an error
  page; and the **inner per-category count** in `fetchShowcaseCategories`,
  because one flaky count must not take the homepage down.
- **`medusa-error.ts` must stay free of `medusa.ts`.** Same reason as the rule
  above it — importing it would drag in the module-eval throw.
- **Pass the region's `id` as `region_id` on every product query**, or
  `calculated_price` comes back null with no error from Medusa.
- **Call `sdk.auth.login` / `.callback` / `.refresh` only on a fresh
  `createAuthFlowSdk()` instance**, never the module-scope `sdk` singleton — it
  is shared across concurrent server requests and would leak one customer's
  token into another's render. For an already-signed-in customer, pass an
  `Authorization` header on that one call to the singleton instead.
- **Stores read through `useSyncExternalStore`** — `cart.ts` and
  `checkout-draft.ts` — must cache their snapshot at module scope and return a
  constant, never a fresh literal, as the server snapshot, or they loop or warn
  on hydration.
- **Never add a tsconfig `paths` entry for `@craftynp/types`.** Turbopack
  applies `paths` to runtime resolution, not just typechecking, so aliasing the
  package at its `dist/index.d.ts` silently erased every value import of it from
  the production bundle: `site-content.ts`'s `resolveSiteContent([])` fell out
  as `(void 0)([])` and crashed the render. Nothing caught it — `tsc` was happy,
  and Jest maps the package to its `src/` — because that call sits in a catch
  block that used to run on any Medusa failure, which is exactly the state a CI
  build was in. Since CNP-17 that path is narrower still (only a query-level
  4xx reaches it), so it is even less likely to be exercised by accident.
  Left unmapped, the workspace symlink resolves through the
  package's `exports` map, which serves types and runtime separately. This is
  the only value import of `@craftynp/types` in the app; every other one is
  `import type`, which is why it was the only casualty.

## Design tokens

Declared once in `src/app/globals.css`, which documents its own three-layer
structure, palette rules, and HeroUI bridge in place. Read it before changing a
token.

- **Use the generated utilities — `bg-surface`, `text-foreground-muted`,
  `rounded-lg`, `font-display` — never a raw hex value.** Prefer the semantic
  aliases (`background`, `surface`, `foreground`, `primary`, `danger`): they are
  the only colours that follow the active mode.
- **Change a token in both `globals.css` and its mirror
  `src/lib/design-tokens.ts`.** `design-tokens.test.ts` fails on drift and holds
  every text-bearing pairing to WCAG AA 4.5:1; a pairing below that must be
  marked `decorative` with a note.
- Use `danger-foreground` for error text and `danger` only as a surface — raw
  alert red is not legible enough for text in either mode.
- **The focus ring is `primary`, not brand gold.** Gold is the obvious choice
  and fails WCAG 1.4.11's 3:1 requirement; `focus-ring.test.ts` holds the ring
  to 3:1 on every surface of both modes. The footer stays navy in both modes, so
  its ring is `ring-off-white`.
- **Modes hang off `color-scheme` and `light-dark()`, not a media query.** Do
  not reintroduce a `prefers-color-scheme` block — a test asserts its absence.
- **`themeInitScript` must stay a blocking inline `<script>` in `<head>`** (set
  in `layout.tsx`), and `<html>` must keep `suppressHydrationWarning`. Deferring
  it flashes the OS mode before hydration; dropping the suppression logs a
  hydration error on every page.

## HeroUI

The primitives in `src/components/ui` are thin wrappers over **HeroUI v3**,
built on React Aria Components.

- **Only `@heroui/react/<component>` subpaths resolve under Jest.** The
  `moduleNameMapper` points each at `dist/components/$1/index.js`; a
  non-component subpath such as `@heroui/react/hooks/use-overlay-state` has no
  matching directory and breaks every test that imports it. Use the render-prop
  `close` that a `Dialog`'s children function receives instead.
- **HeroUI reads colours two ways** — some components take the bare variable
  (`var(--accent)`), others the Tailwind utility (`@apply bg-accent`). A bare
  variable and our `--color-*` alias of the same name must agree, or one
  component disagrees with another. Check the rendered page, not just the
  variables.
- `pnpm-workspace.yaml` declares `@types/react` as a `packageExtensions` peer of
  HeroUI and the React Aria packages because both React majors are installed. Do
  not "fix" a resulting type error by hoisting or by adding `@types/react` to
  the root `package.json` — see the root AGENTS.md.
- **`Modal` and `AlertDialog` (`src/components/ui/dialog.tsx`) resolve their own
  `React.ReactNode` against a different `@types/react` copy than the rest of
  the app.** Typing a prop that gets embedded as their children with
  `import type { ReactNode } from "react"` fails with a `ReactPortal` /
  `children` mismatch that only appears once you nest it inside a plain
  `<p>`/`<div>`. Use the ambient `React.ReactNode` instead (no import needed —
  `select.tsx` already relies on the same global), as `card.tsx` and
  `dialog.tsx` do.

## Checkout

`/checkout` is four steps — Contact, Delivery address, Shipping method, Payment
— plus a sticky summary, completing in a real Medusa order. Tax is not a step:
it is not a shopper choice, and its only UI is an inline error-and-retry block
between steps 3 and 4. The backend half is in
[apps/medusa/AGENTS.md](../medusa/AGENTS.md).

- **Steps 1–3 are a client-side draft only.** No Medusa cart exists until the
  payment step POSTs `/checkout/prepare`, which writes `cartId` and
  `paymentClientSecret` onto the draft.
- **Tax is quoted only after a shipping rate has settled**, because shipping
  itself is taxed, and it re-runs when the shopper picks a different rate. Do
  not fire the tax and shipping-rate calls in parallel.
- **Gate each step on the live hook status, never on the draft field.** The
  draft still holds the previous address's signed token for a moment after an
  edit, so gating the tax fetch on `draft.shippingRateId`, or the payment fetch
  on `draft.taxQuoteToken`, fires a request signed against a stale address that
  the server correctly rejects.
- **Every draft field derived from a shipping rate goes through
  `shippingRateDraftPatch`** (`src/lib/shipping-rates.ts`) — both the
  auto-preselect and the shopper's own click. A second hand-written literal
  drifts and sends a blank or mismatched service code to `prepare-cart`.
- **`paymentPrepareKey` must explicitly list every address field the tax quote
  token's signature does not cover** — the street lines, recipient name, and
  phone. Omit one and a street-only edit never re-prepares, so the order keeps
  the previous address.
- **The `/checkout/prepare` and `/checkout/complete` proxies attach the upstream
  reason via `describeUpstreamError`** (`src/lib/upstream-error.ts`) alongside
  their own error code. `sdk.client.fetch` discards every field but the status
  and `message`, so without it a rejected quote, a misconfigured region, and an
  unreachable Medusa are indistinguishable in the browser.
- **Keep `<Elements>` keyed on `` `${clientSecret}:${mode}` ``.** Stripe reads
  `options.clientSecret` only on first mount, so an address edit needs a full
  remount against the freshly minted secret.
- **`PaymentFields` bridges its submit handle through a plain `ref` prop, not
  `forwardRef`** — `ForwardRefExoticComponent` collides with this workspace's
  dual `@types/react` resolution and fails typecheck.
- **The submit button stays a real, always-enabled `<button type="submit">`.**
  Submit is the only event the inline field validation hangs off, so disabling
  it hides every error from a shopper who never focuses a field.
- Guest checkout is the default and is never blocked.

### Order confirmation

`/checkout/confirmation` is a real order view, not just a thank-you, and is
reused as the permanent order link in the confirmation email — which is why no
`/order` or `/orders` segment exists. One would permanently claim that Medusa
category handle for nothing.

- **The page is a pure GET keyed on `?order=`** and performs no mutation, which
  is what makes a refresh safe. The cart and draft are cleared in
  `checkout-view.tsx` _before_ the redirect, never on arrival here — moving
  that would make the ordering silently load-bearing.
- **Its query contract is `order`, `number` and `token`**, built by
  `checkoutConfirmationHref()`. Medusa's `order-email.ts` builds the same URL
  independently for the email, so a change here needs the same change there.
- **The guest account prompt sits below the order content with no dismissal
  state**, so it structurally cannot block someone reading their own order. Do
  not turn it into a modal or an interstitial.
- `fetchOrderConfirmation` passes the guest `?token=` _or_ the session bearer,
  never both, and degrades to `null` like every other fetch helper — the page
  still renders a thank-you when the backend is down.
- **This page is where a customer sees order status and tracking**, because it
  is the permanent order link. `/account/orders` is CNP-60 and does not exist;
  when it does, it reuses `OrderStatusBadge` and `OrderTrackingCard` rather than
  growing its own.
- **`order.status` and `order.fulfilmentStatus` are different things.** The
  first is Medusa's own order status, the second is the owner-facing lifecycle
  the shop actually works to. Only the second is rendered.
- **Customer-facing status wording lives in `src/lib/order-status.ts`**, which
  stays medusa-free so client components can value-import it. Its maps are
  `satisfies Record<OrderStatus, …>`, so a new status is a compile error rather
  than a blank label — that is why they carry no test of their own.
- **`OrderTrackingCard` must never build a tracking URL itself.**
  `carrierTrackingUrl` in `@craftynp/types` returns `null` for a carrier it has
  no template for, and the card falls back to the bare number. Guessing a URL is
  how a dead link reaches a customer.

## Auth

Sign-in, registration, "Continue with Google", and password reset all run
through **Auth0 Universal Login** — this app never renders a credential form.
`/auth/login` asks Medusa's Auth0 provider for a redirect URL; `/auth/callback`
exchanges the code for a Medusa JWT and sets the session cookie.

- **The session cookie must stay `sameSite: "lax"`, not `"strict"`** — with
  strict, a customer arriving on the top-level redirect back from Auth0 looks
  signed out on the very page meant to prove sign-in worked.
- **Auth0 reports every denied login as `error=access_denied`**, with no
  separate machine-readable code, so `classifyAuthCallbackError` switches on
  `error_description` to tell a cancelled sign-in from one blocked by the
  tenant's email-verification Action. The two call for opposite messages.

## Account

`/account` (Account settings) and `/account/addresses` (Addresses) share
`src/app/account/layout.tsx` for the header band and sidebar. Order-history
tabs are not built yet — CNP-60 covers them.

- **This app has zero server actions.** Every account mutation is a route
  handler under `src/app/account/*/route.ts` (never `/api`, same reason as
  checkout) called with a plain client `fetch()`, following the exact shape of
  the pre-existing `src/app/checkout/addresses/route.ts`: cookie guard → `401`,
  a hand-written type guard → `400 invalid_body`, `validateAddressFields` →
  `400` with a `fields` map, upstream failure → `502`.
- **The email field is read-only.** Auth0 keys the auth identity's `entity_id`
  on the lowercased verified email; changing it only in Medusa would desync the
  two and lock the customer out. A full change-email flow (uniqueness check,
  verification, then updating both Auth0 and Medusa) is deliberately deferred
  to its own story.
- **There is no password form**, for the same reason `SignInPanel` has none —
  Auth0 Universal Login owns credentials. `SignInSecurityCard` shows the linked
  provider instead, derived from `authProviderFromUserMetadata` in
  `src/lib/auth.ts`, which reads `auth0_sub` off the decoded JWT's
  `user_metadata` (see `apps/medusa/AGENTS.md` for where that field comes
  from). A JWT minted before that field existed decodes to `"unknown"` — the
  card then shows neither a provider row nor a reset button until the customer
  signs in again.
- **`src/lib/account-preferences.ts` is medusa-free on purpose** (same rule as
  `saved-address.ts`) so `CommunicationPreferencesCard` can value-import it. The
  two marketing toggles persist on `customer.metadata`, merged in — never
  replacing the whole object — by `PATCH /account/preferences`, since Medusa
  customer metadata is not guaranteed to merge on its own.
- **`DELETE /account/close` proxies `DELETE /store/customers/me`** on the
  Medusa side (see `apps/medusa/AGENTS.md`) rather than deleting the customer
  directly from this app, because the safe cleanup order — addresses, then the
  Auth0 identity rows, then the customer — has to run in one place.
- **`AddressFormDialog` resets its form by remounting, not by `useEffect` +
  `setState`.** The parent (`addresses-view.tsx`) keys it on the target
  address's id; calling `setState` synchronously inside an effect trips this
  repo's `react-hooks/set-state-in-effect` lint rule.

## Testing

jsdom via `next/jest`. Tests live in a **separate `test/` tree mirroring
`src/`** (`src/components/ui/button.tsx` → `test/components/button.test.tsx`).
`roots` is `["<rootDir>/test"]`, so a test left under `src/` is silently never
run. Import the code under test through the `@/` alias rather than a relative
path out of `test/`; tests that read source off disk reach back two levels into
`src`.

`eslint src test` lints both trees to the same standard, so a new top-level
directory needs adding there and to `eslint.config.mjs`'s `files` glob.

- **Do not try to render `src/app/page.tsx`** or any other async server
  component.
- **The header search and the drawer's mobile search coexist in the DOM**, one
  hidden by CSS at each breakpoint, and jsdom applies no CSS — scope role
  queries with `within()`.
- **`jest.config.mjs`'s three HeroUI accommodations are load-bearing**, and
  removing any one makes every test that imports a primitive fail to run:
  `moduleNameMapper` onto HeroUI's `dist/`, `transformIgnorePatterns` reduced to
  CSS modules, and `customExportConditions` deliberately left unset.
  `jest.setup.ts`'s Streams/`TextEncoder` polyfills for `@medusajs/js-sdk` are
  the same — leave them in place.
