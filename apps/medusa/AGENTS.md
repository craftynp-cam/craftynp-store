# AGENTS.md — Medusa backend

Instructions for the Medusa backend. The repo-wide setup, commands, branching
strategy, and shared conventions are in the root [AGENTS.md](../../AGENTS.md) —
read that first; this file only covers what is particular to this app.

## Overview

Medusa 2.18 on port **9000**, with the admin dashboard served at **`/app`**.
Shared zod schemas and types come from `@craftynp/types`.

Layout under `src/`:

- `api/` — custom store (`api/store/*`) and admin (`api/admin/*`) routes, plus
  `api/middlewares.ts` (validation middleware registration). `api/admin-sso/`
  sits outside `/admin/*` on purpose — see [Admin SSO](#admin-sso-cnp-72).
- `admin/` — admin dashboard extensions. `admin/routes/site-content` (CNP-23)
  is the first UI route in the repo; `admin/widgets/google-workspace-login.tsx`
  (CNP-72) is the first widget, see [Admin SSO](#admin-sso-cnp-72).
  `admin/lib/client.ts` is its SDK
  instance, configured per Medusa's own admin pattern (session auth,
  `VITE_BACKEND_URL`). `admin/components/site-content-image-field.tsx`
  (CNP-30) is the control behind the registry's `image` field type: it uploads
  through `sdk.admin.upload.create` (a multipart `files` field on
  `POST /admin/uploads`) and writes the returned URL into the entry, so the
  page's existing Save mutation is otherwise untouched. Two things about it
  are non-obvious — the file lands on disk the instant it's picked, _before_
  Save, so an abandoned edit orphans it with no delete path; and it only
  exists because `medusa-config.ts` now registers the File module explicitly
  (see below), rather than relying on Medusa's implicit default.
- `workflows/`, `modules/` — the `siteContent` module (CNP-23) is the first
  custom module in the repo: a generic key/value store
  (`site_content_entry`) whose readable/writable fields are declared by the
  `SITE_CONTENT_FIELDS` registry in `@craftynp/types`, not by the module
  itself — adding a future entry (about-page copy, seasonal notices) is a
  registry change, not a migration. The registry's field types are `text`,
  `longText`, `boolean`, and, since CNP-30, `image` — the stored value is
  still a plain string (the uploaded file's URL), so adding an image field
  needs no migration either. `workflows/upsert-site-content.ts` is the
  one mutation path; its step validates each entry against the registry and
  keeps prior values for compensation. `modules/auth-google-workspace` and
  `workflows/link-admin-auth-identity.ts` (CNP-72) are covered in
  [Admin SSO](#admin-sso-cnp-72). `subscribers/`, `jobs/`, `links/`
  remain scaffolding only.
- `lib/` — plain helpers such as `validate-customization.ts`.
- `migration-scripts/initial-data-seed.ts` — the initial data seed.
  `migration-scripts/seed-site-content.ts` is a second, independent migration
  script (CNP-23) — see below for why a new file, not an edit to the first.

`medusa-config.ts` holds the module and CORS configuration. It now registers
`@medusajs/medusa/auth` explicitly (CNP-56/57/58) — see [Auth](#auth-cnp-565758)
below for what that changed and why. It also registers `@medusajs/medusa/file`
explicitly (CNP-30), with the `file-local` provider given a `backend_url` built
from `MEDUSA_BACKEND_URL` — left to `defineConfig`'s implicit default, the
provider hardcodes `http://localhost:9000/static`, which silently disagrees
with the storefront's `images.remotePatterns` (derived from
`NEXT_PUBLIC_MEDUSA_BACKEND_URL`) the moment either app's backend URL isn't
that exact value. Production needs a real provider before this ships —
`@medusajs/file-s3` on Cloudflare R2 — which is CNP-16/CNP-17's concern.
Uploaded files land in `apps/medusa/static/`, gitignored.

**`src/admin` typechecks separately from the rest of `src`.** It's the only
`.tsx` under this app and needs DOM lib types that the Node-only backend
doesn't carry, so `apps/medusa/tsconfig.json` excludes it and `typecheck` runs
a second `tsc -p src/admin --noEmit` against `src/admin/tsconfig.json`. Add a
non-admin file needing DOM types to `src/admin`, not elsewhere.

**`@medusajs/framework`'s `validateAndTransformBody` bundles its own zod**
(`@medusajs/deps/zod`), a different instance from this app's own `zod`
dependency and from the one `@craftynp/types` builds its schemas against.
Passing a `@craftynp/types` schema straight into `validateAndTransformBody`
makes TypeScript compare the two schema types structurally, which recurses
deep enough to hit `TS2589` — and can OOM `tsc` outright rather than reporting
it cleanly, which is what made this hard to diagnose the first time. Route the
schema through `unknown` before the call (see
`api/admin/site-content/middlewares.ts`) rather than comparing the two types
directly.

## Auth (CNP-56/57/58)

Customer accounts run through **Auth0**, not Medusa's default `emailpass`.
`src/modules/auth-auth0/` is a custom auth module provider
(`AbstractAuthModuleProvider`, registered under `@medusajs/medusa/auth` in
`medusa-config.ts`) that implements the OAuth authorization-code flow against
Auth0's Universal Login — the same shape as Medusa's own
[Okta/OIDC integration guide](https://docs.medusajs.com/resources/integrations/guides/okta),
adapted from the `user` actor to `customer`. Auth0 owns every credential page:
sign-in, sign-up, "Continue with Google", and password reset. This module only
exchanges the resulting authorization code for a Medusa JWT.

`projectConfig.http.authMethodsPerActor` is now set explicitly —
`{ user: ["google-workspace"], customer: ["auth0"] }` — which closes both
`/auth/customer/emailpass/*` (a customer cannot bypass Auth0) and
`/auth/user/emailpass/*` (an admin cannot bypass Google Workspace SSO; see
[Admin SSO](#admin-sso-cnp-72) below). Neither actor has an `emailpass`
provider registered anymore.

**The auth identity is keyed on the verified email, not the Auth0 `sub`**
(`src/modules/auth-auth0/lib.ts`, `mapUserInfoToIdentity`). A userinfo response
with `email_verified: false` is rejected outright. This is what CNP-57 AC4
means by handling gracefully a customer who registers by email and later signs
in with Google using the same address: `auth0|…` and `google-oauth2|…` both
map to the same lowercased-email `entity_id`, so they resolve to one Medusa
customer with no reliance on an Auth0 Action to link them — nothing needs
deploying to every environment for this to hold. The consequence is that an
email/password signup **must** verify their address before their first
sign-in; the Auth0 database connection has email verification turned on for
exactly this reason. `provider_metadata` stores only `auth0_sub` — not Auth0's
access/refresh/id tokens, since nothing in this flow reads them back and they
are credentials at rest.

**Password policy, Google connection, and Attack Protection are Auth0 tenant
settings, not code** — there is nothing in this repo to point to for CNP-56
AC1 (the documented password policy) or AC6 (rate limiting) beyond this
paragraph:

- Database connection password policy is Auth0's **"Good"** level (the
  tenant's default) — at least 8 characters, containing at least 3 of: lower
  case letters, upper case letters, numbers, special characters. This is what
  CNP-56 AC1 means by "the documented policy."
- Email verification is enforced by Auth0's own **"Require Email
  Verification"** marketplace Action, bound into the tenant's Post Login flow
  (Actions → Flows → Login) — not the deprecated per-connection toggle. It
  blocks an unverified customer's login before Auth0 ever issues a code, ahead
  of and independent of `mapUserInfoToIdentity`'s own `email_verified` check
  above.
- Attack Protection → Brute-force Protection, Suspicious IP Throttling, and
  Breached Password Detection are all enabled, which is the entirety of
  CNP-56 AC6.
- The Google social connection ships on Auth0's shared **dev keys** on a fresh
  tenant — rate-limited and showing Auth0's own consent screen rather than
  ours. Fine for local development; needs real Google Cloud OAuth credentials
  before this goes out with CNP-16/CNP-17.

The provider's `authenticate`/`validateCallback` state (the OAuth `state`
param, used only to remember the `callback_url` across the redirect to Auth0
and back) is stored via `Modules.CACHE`, which this repo does not otherwise
configure — it falls back to Medusa's in-memory default. That's fine for local
development and a single instance; a multi-instance deployment needs the Redis
cache module wired up (`REDIS_URL` is already provisioned but unused —
tracked with the infrastructure work, CNP-16).

**Never delete a test customer from the admin while testing Auth0 sign-in.**
Medusa's own delete-customer flow leaves the linked `auth_identity` poisoned:
it nulls out `app_metadata.customer_id` rather than removing the key, and
`set-auth-app-metadata` (Medusa core, `@medusajs/core-flows`) refuses to write
a new customer id into that slot once the key is present at all — present but
`null` reads the same as "already linked." Every later sign-in for that
address then 404s (`getCustomer()` finds a customer id that no longer
exists) with no error surfaced anywhere the customer can see. Prefer a fresh
email per test run; if you need to reuse one, `pnpm run reset-auth0-account
<email>` (`src/scripts/reset-auth0-test-account.ts`) removes the
`provider_identity`, any now-orphaned `auth_identity`, and the `customer` row
for that address in one step — pass the email as a bare trailing argument,
with no `--` before it (pnpm forwards it automatically; a literal `--` gets
swallowed by Medusa's own CLI parsing and the script sees no argument at
all). It does not touch Auth0 itself — delete the user from the tenant
dashboard too for a fully clean slate.

## Admin SSO (CNP-72)

Admin (`user`) sign-in runs through a custom Google Workspace OAuth provider,
`src/modules/auth-google-workspace/` — the same four-file shape as
`auth-auth0/` (`lib.ts` pure helpers, `service.ts`'s
`AbstractAuthModuleProvider` subclass, `lib.test.ts`, `index.ts`). This is
CNP-72 AC1 only; CNP-72's other acceptance criteria (Cloudflare Access, rate
limiting, R2 credential scoping, secret rotation) need deployed environments
and are tracked separately against CNP-16/CNP-17.

**Not `@medusajs/auth-google`.** That package is a dependency of this app but
is deliberately never registered. Its `verify_` accepts any Google account
with a verified email — it never reads the `hd` (hosted domain) claim — so a
personal Gmail account would authenticate as an admin. It also keys identities
on Google's `sub` rather than email, which cannot be matched to an existing
Medusa `user`, and it puts `client_secret` in the token-exchange query string.
The gaps live in `private`/`protected` internals not meant to be subclassed,
so a sibling module was cheaper and more honest than patching around them.

**The `hd` query param on the authorize URL is a UI hint, not the gate.** A
signed-in Google user can still switch accounts after Google redirects them
there. The real check is `mapUserInfoToIdentity` in
`auth-google-workspace/lib.ts`, run server-side against the verified userinfo
response after the token exchange: it rejects unless `hd` equals
`GOOGLE_ADMIN_ALLOWED_DOMAIN` **and** the email's own domain matches too.

**A successful Google sign-in does not, by itself, grant admin access.** The
auth identity provider service can only write `provider_metadata` and
`user_metadata` — never `app_metadata`, which is what actually associates an
auth identity with a Medusa `user` id. So the first callback produces an
_actorless_ token, and `src/admin/widgets/google-workspace-login.tsx` (the
"Continue with Google Workspace" button on the `login.before` zone — the
first admin widget in this repo) follows it with one authenticated call to
`POST /admin-sso/link`. That route runs `linkAdminAuthIdentityWorkflow`
(`src/workflows/link-admin-auth-identity.ts`), whose step looks up a Medusa
`user` by the auth identity's verified email and links them with
`setAuthAppMetadataStep` (`@medusajs/medusa/core-flows`) — **there is no
auto-provisioning.** A Workspace account with no matching `user` row is
refused outright. Create the admin user first with the Medusa CLI (see the
`medusa-dev:new-user` skill), the same as any other admin — a new team member
gets Google Workspace access by having the owner run the CLI with their
`@<allowed domain>` email, then having them sign in once with Google
themselves to complete the link. That same first link also backfills the
Medusa user's `first_name`/`last_name` from the Google profile's
`given_name`/`family_name` (via `updateUsersStep`, also from
`@medusajs/medusa/core-flows`) if Google returned them — `medusa user` itself
only ever sets `email`, so without this a new admin's name stays blank until
someone edits it by hand. This only runs once, on the linking sign-in; it
will not overwrite a name changed later in the dashboard.

**`medusa user` needs `emailpass` registered even though no admin ever logs in
with it.** The CLI command calls `authService.register("emailpass", …)`
in-process, bypassing the HTTP layer (and therefore `authMethodsPerActor`)
entirely, so `medusa-config.ts` keeps `@medusajs/medusa/auth-emailpass`
registered but leaves it out of `authMethodsPerActor.user` — every
`/auth/user/emailpass/*` route (login, register, callback, reset-password)
stays closed over HTTP, since `validateScopeProviderAssociation` checks that
config on all of them regardless of whether the provider is registered. One
consequence: the dashboard's own "Accept invite" flow calls
`POST /auth/user/emailpass/register` over HTTP and is therefore **not usable**
for admins — `--invite` is not the CLI path to use here; use the plain
`medusa user -e <email>` form instead.

`/admin-sso/link` intentionally sits outside `/admin/*`: that prefix's default
protection requires a _registered_ actor, which is exactly what an actorless
post-Google token isn't yet. Its middleware
(`src/api/admin-sso/link/middlewares.ts`) uses
`authenticate("user", ["session", "bearer"], { allowUnregistered: true })` for
that reason, and the route itself never reads an email or user id from the
request body — only `req.auth_context.auth_identity_id`, so a caller cannot
name who they want to be linked as.

**`setAuthAppMetadataStep` throws if `app_metadata.user_id` is merely
_present_, including present-and-`null`** — the same poisoning this file
already documents for `customer_id` after a customer delete (see
[above](#auth-cnp-565758)). Deleting an admin `user` will strand its Google
auth identity the same way; there is no equivalent reset script for admins
yet.

**MFA is Medusa's built-in TOTP provider, not custom code.** `medusa-config.ts`
sets `mfa.encryption_key` (`MFA_ENCRYPTION_KEY`) and registers the `totp`
provider id, which is enough to light up the dashboard's own enrolment UI
(Profile → MFA: QR setup, recovery codes) — no code here implements
enrolment. MFA is opt-in _per identity_, not enforceable by config: Medusa
only challenges an identity that already has an enabled factor. The actual
enforcement layer is the Google Workspace org's 2-Step Verification policy —
a Google Admin console setting with no in-repo representation, the same
category as the Auth0 tenant-settings paragraph above. Enrol Medusa TOTP as
an independent second factor once signed in.

**Lockout recovery.** With `emailpass` closed for `user`, a misconfigured
Google OAuth client (wrong redirect URI, wrong domain) leaves no way into
`/app`. Recovery is to temporarily restore `user: ["emailpass"]` and the
`@medusajs/medusa/auth-emailpass` provider in `medusa-config.ts` and restart —
one local revert, no data loss — fix the Google Cloud client configuration,
then reapply the Google-only config.

**Manual setup with no in-repo representation:** a Google Cloud OAuth 2.0 Web
application client (`GOOGLE_ADMIN_CLIENT_ID`/`_CLIENT_SECRET`, redirect URI
`http://localhost:9000/app/login` locally) and Workspace org-wide 2-Step
Verification enforcement. Both are prerequisites before the first Google
sign-in will work at all.

## Shipping rates (CNP-51)

Live USPS rates come from ShipStation's V2 API (a separate product from the
ShipStation app — Free tier, its own pricing, `api.shipstation.com/v2`), via a
custom store route rather than a Medusa fulfillment provider.

**Why a store route, not `AbstractFulfillmentProviderService.calculatePrice`.**
That path is only reachable through `listShippingOptionsForCartWorkflow` /
`calculateShippingOptionsPricesWorkflow`, both of which need a `cart_id` and
read `cart.shipping_address`/`cart.items`. The storefront has no Medusa cart
today (see its own AGENTS.md) — creating one is CNP-53. So
`POST /store/shipping-rates` (`src/api/store/shipping-rates/`) takes
`{ destination, items: [{variantId, quantity}] }` directly, resolves every
variant's weight/dimensions server-side via `query.graph` (never trusting a
client-supplied weight), and returns normalized rates. All ShipStation logic
lives in `src/modules/shipstation/` — `lib.ts` (pure: packing, request
building, response normalization, cache key, rate-limit reducers, log tags),
`service.ts` (the module service: cache read, rate-limited `fetch`, retry),
`limiter.ts` (the global coordinator below), `index.ts`
(`Module(SHIPSTATION_MODULE, …)`, registered in `medusa-config.ts`). A future
CNP-53 fulfillment provider calls `ShipStationModuleService.getUspsRates`
verbatim from its own `calculatePrice`, adapting a cart into the same two
arguments — nothing here gets deleted when that lands.

**Units: grams and centimetres, everywhere.** Medusa itself enforces no units
on `weight`/`length`/`width`/`height` — the existing seeded `weight: 400` was
already only _conventionally_ grams. `SHIPSTATION_WEIGHT_UNIT`/
`SHIPSTATION_DIMENSION_UNIT` in `.env` must agree with what every product's
dimensions are actually stored in, or a rate estimate silently quotes the
wrong parcel size with no error from either side.

**The global rate limiter (`limiter.ts`) is a token bucket plus one shared
"blocked" promise, not a per-request retry.** AC10 exists because ShipStation
warns that per-request retry logic causes many concurrent 429s to all retry at
the same instant and re-trigger the limit; `blockFor(ms)` installs at most one
timer that every waiting `acquire()` call awaits together, then lets the
bucket re-stagger them. State lives at **file module scope**, not on the
service instance, so DI lifetime can't hand out one bucket per request. This
is per-process — correct for one Medusa instance, wrong the moment CNP-16
scales horizontally. `REDIS_URL` is already provisioned but unused (the same
gap the Auth0 `state` cache above notes); the Redis swap sits behind the same
`acquire`/`blockFor` interface.

**Caching is two layers doing different jobs.** The backend cache
(`Modules.CACHE`) is keyed on destination + parcel weight/dimensions
(`rateCacheKey` in `lib.ts`), TTL from `SHIPSTATION_RATE_CACHE_TTL_SECONDS`,
and is shared across shoppers — rates aren't personal, and this is what
actually protects the sandbox's 20 req/min ceiling. A failed call is **never**
cached — only a genuine, priced response is. The storefront also keeps its
own `sessionStorage`
cache (`apps/storefront/src/lib/shipping-rates-cache.ts`) — that's where
AC7's "for the checkout session" and back-navigation actually live, since the
backend cache still costs a round trip and a loading flash. Both are needed;
neither is redundant with the other.

**The signed quote token (`src/lib/shipping-quote.ts`) is AC9's reusable
piece.** Every rate returned to the storefront carries a `quoteToken` signing
the rate id, amount, currency, service/carrier code, a cart signature (sha256
over sorted `variantId:quantity` pairs plus destination), and a 30-minute
expiry, under `SHIPPING_QUOTE_SECRET` — a dedicated secret, not `JWT_SECRET`,
since the two have different blast radii. `verifyShippingQuote(token, secret,
{ cartSignature })` is what CNP-53 must call at order placement. **Important:**
ShipStation's `/v2/rates/estimate` response is not purchasable and excludes
fuel/residential surcharges — its `rate_id` cannot simply be looked up again
at placement. AC9 has to mean _re-estimate and compare the fresh amount
against the signed one within a tolerance_, not replay the `rate_id`.

**AC6 is deliberately overridden: there is no flat-rate fallback.** The
ticket's own text ("falls back to a configured flat rate rather than blocking
checkout") was superseded by an explicit product decision — a wrong shipping
charge is worse than a shopper hitting Retry, so `POST /store/shipping-rates`
returns `502 { error: "shipping_unavailable", reason }` on a missing-dimension
parcel or any `ShipStationRateError`, and the storefront shows a real error
with a Retry button and **no price**, blocking the Continue button (there is
no rate for `validateCheckoutDraft`'s `shippingRateId` check to accept). There
is no `buildFallbackRate`, no `isFallback` field anywhere in the contract
(`@craftynp/types`'s `shippingRateSchema` doesn't carry one), and no
`SHIPPING_FALLBACK_*` env var — `SHIPPING_OPTION_DEFAULT_AMOUNT`/`_LABEL`
below is a different thing entirely (see `seed-us-region.ts`). If this
tradeoff is ever revisited, the pieces to resurrect are in the git history of
this module, not something to rebuild from scratch.

**AC11's alerting contract is two literal log-tag strings**, asserted by
`lib.test.ts` so they can't drift silently: `[shipstation:rate-limit]` on
every 429/backoff, `[shipstation:unavailable]` whenever a rate call fails and
checkout is blocked (missing dimensions, timeout, empty response, or
exhausted retries) — grep for either to build an alert.

**AC5 (a product cannot publish without shipping weight/dimensions) is a
workflow hook, not a route middleware** —
`src/workflows/hooks/validate-product-shipping-dimensions.ts` registers on
both `createProductsWorkflow.hooks.productsCreated` and
`updateProductsWorkflow.hooks.productsUpdated`, throwing (and rolling back the
write) via `assertPublishableProducts`
(`src/lib/product-shipping-dimensions.ts`) whenever a `published` product is
missing weight, length, width, or height. A route middleware can't do this:
`POST /admin/products/:id` with `{status: "published"}` carries no dimensions
in its body at all, and products also arrive via `/admin/products/batch`, CSV
import, and custom workflows — all of which bypass HTTP entirely. The hook
covers every path from one file. A rejected publish still emits a
`product.updated` event before the hook's compensation runs; harmless today
since nothing subscribes to it.

**The seeded catalogue needed real dimensions to keep working once the hook
landed.** `initial-data-seed.ts` now sets `length`/`width`/`height` inline on
each of its four products — a rare direct edit to that file, justified because
the hook would otherwise reject the seed's own `PUBLISHED` products on the
very first migration. `seed-product-shipping-dimensions.ts` is a second,
idempotent migration script that backfills the same values onto a database
that ran the seed before this change; it deliberately sorts after
`initial-data-seed.ts` alphabetically (migration scripts run in filename
order), the same reason `seed-site-content.ts` does.

**`seed-us-region.ts`** adds a second, USD `United States` region (countries
`["us"]`), a `US Workshop` stock location whose address comes entirely from
`SHIP_FROM_*` env (never hand-typed into a migration script, so the client's
real address never lands in git), a US service zone on `manual_manual`, and
one flat `Standard Shipping` option priced from `SHIPPING_OPTION_DEFAULT_AMOUNT`/
`_LABEL` so CNP-53 has something to attach a cart to. This is a **Medusa
catalogue price, not a checkout-time fallback** — nothing in the live
checkout flow reads it; a failed live-rate call blocks checkout instead (see
AC6 above). It bails out if a region named "United States" already exists, so
re-running `db:migrate` is safe.

`pnpm run list-carriers` (`src/scripts/list-shipstation-carriers.ts`)
prints every connected carrier's `carrier_id` from `GET /v2/carriers` — use it
to find `SHIPSTATION_USPS_CARRIER_ID` rather than curling by hand.

**Do not point automated tests at the ShipStation sandbox** — its 20 req/min
ceiling causes sporadic, confusing failures under CI. Every test here mocks
`global.fetch` at the `ShipStationModuleService` boundary instead.

## Sales tax (CNP-52)

Sales tax is calculated by Stripe Tax, via a custom store route rather than a
Medusa tax provider — the same reasoning as [Shipping rates](#shipping-rates-cnp-51),
and for the same underlying cause: the storefront has no Medusa cart yet, and a
tax provider is only reachable through cart-based workflows. `POST /store/tax-quote`
(`src/api/store/tax-quote/`) takes `{ destination, items, shippingQuoteToken }`
directly. `src/modules/stripe-tax/` holds the Stripe Tax logic — `lib.ts` (pure:
unit conversion, calculation-params building, response normalization, cache key,
the log tag), `service.ts` (the module service: cache read, `stripe.tax.calculations.create`,
cache write on success only), `index.ts` (`Module(STRIPE_TAX_MODULE, …)`,
registered in `medusa-config.ts`).

**This is the one place the official `stripe` npm package is used, not raw
`fetch`.** ShipStation's API is plain JSON and cheap to hand-roll; Stripe's is
form-encoded with bracket notation for nested arrays (`line_items[0][amount]`),
which is genuinely error-prone by hand, and CNP-53 will need the same client for
PaymentIntents. The SDK's own `timeout`/`maxNetworkRetries` are configured from
options — there is deliberately no ShipStation-style token-bucket limiter here;
Stripe's test-mode rate ceiling is orders of magnitude higher than ShipStation's
sandbox, and the SDK already backs off on its own.

**Decimal dollars everywhere except inside this module.** `@craftynp/types`'
`taxQuoteResponseSchema` and every other amount in this codebase (`ShippingRate.amount`,
`formatMoney`) are decimal major units; Stripe's Tax API is integer minor units.
`toMinorUnits`/`fromMinorUnits` in `stripe-tax/lib.ts` are the only crossing
points, and both are covered directly for rounding drift — nothing outside this
module ever touches cents.

**A state with no obligation is a successful `$0.00` calculation, not an
error.** Stripe still returns a valid `Calculation` object when there's no tax
registration for the shopper's state; `normalizeCalculation` treats
`tax_amount_exclusive: 0` the same as any other amount. This is the opposite of
ShipStation's `"empty"` reason (a genuinely failed rate call) — do not conflate
the two when touching either module.

**Tax depends on the selected shipping rate, not only the address**, since
AC1 requires shipping to be taxed per-state. The route therefore takes a
`shippingQuoteToken` and verifies it with `verifyShippingQuote` from
`src/lib/shipping-quote.ts` before calling Stripe — direct reuse of CNP-51's
work, so the shipping figure feeding the tax calculation is already
tamper-evident rather than trusted from the client.

**The signed tax quote (`src/lib/tax-quote.ts`) is this story's own reusable
piece**, the same shape as `shipping-quote.ts`: a calculation id, tax amount,
currency, and a `taxSignature` (sha256 over destination + shipping amount +
sorted `variantId:quantity` pairs — more than the shipping quote's cart
signature covers, since the tax answer depends on the full address and the
shipping cost, not just postal code and country), under `TAX_QUOTE_SECRET`
with a 30-minute expiry. `verifyTaxQuote(token, secret, { taxSignature })` is
what CNP-53 must call at order placement, alongside `verifyShippingQuote`, and
then call `stripe.tax.transactions.createFromCalculation` against the signed
`calculationId` so the sale is filable in Stripe's own tax reports — recording
that transaction is CNP-53's job, not this one's.

**Variant pricing is resolved server-side, in a pattern new to this app.**
Nothing in `apps/medusa` previously queried `calculated_price` — that
resolution lived only in the storefront's own SDK calls. `POST /store/tax-quote`
introduces it here for the first time: `query.graph` on the `variant` entity
with `context: { region_id, currency_code }`, after resolving a region from
`destination.countryCode` against every seeded region's `countries.iso_2` (the
same match-then-fall-back-to-first shape as the storefront's own
`selectDefaultRegion`, duplicated locally rather than shared, since one is
Node/Medusa and the other is Next/SDK). The request body still carries only
`{ variantId, quantity }` — the client never gets to say what anything costs.

**AC11's alerting contract is one literal log-tag string**, mirroring
ShipStation's pair: `[stripe-tax:unavailable]`, on every failed tax
calculation, an unresolved region, or a variant with no price — grep for it to
build an alert alongside the ShipStation tags.

**Stripe Tax nexus/registration per state is a Stripe dashboard setting, not
code** — same category as the Auth0/Google Workspace tenant settings CNP-56/72
already flag as having no in-repo representation. A state you haven't
registered in returns `$0.00` tax (see above), not an error, so there is
nothing in this repo to configure per state.

**Never point automated tests at the Stripe sandbox** — same reasoning as the
ShipStation sandbox note above. `stripe-tax/service.test.ts` spies on the
Stripe client's `tax.calculations.create` method directly (constructing a real
`Stripe` client with a fake key is safe — it performs no I/O until a method is
called), rather than mocking the whole `stripe` module.

## Payments and order placement (CNP-53)

**This is the first story to reverse CNP-51/52's own reasoning.** Both of
those stories chose a custom store route over Medusa's native
provider/workflow pipeline specifically because there was no Medusa cart to
hang a provider call off of. CNP-53 is where that cart finally gets created,
so the two prior stories' logic is now taught to Medusa's own provider seams
instead of staying in a third bespoke route: `src/modules/shipstation-fulfillment/`
implements `AbstractFulfillmentProviderService.calculatePrice` (registered
alongside `fulfillment-manual` under `@medusajs/medusa/fulfillment` in
`medusa-config.ts`, id `shipstation`), and `src/modules/stripe-tax/tax-provider.ts`
implements `ITaxProvider.getTaxLines` (registered as a sibling provider under
`@medusajs/medusa/tax`, `./tax-provider-module`, id `stripe`) — both live
beside, not instead of, the existing `shipstation`/`stripeTax` custom modules
and their store routes, which CNP-51/52's shipping-rate and tax-quote steps
still use unchanged.

**`cart.total` is the one authoritative number.** Subtotal comes from
Medusa's own `calculated_price`; shipping and tax are resolved by the two
providers above at cart-refresh time, the same way any Medusa store computes
them. The client never gets to name a price — the PaymentIntent amount is
whatever the payment collection was created against, i.e. the cart's own
total.

**AC4 (shipping) works by re-verifying, not by trusting the client.**
`ShipStationFulfillmentProviderService.calculatePrice` recomputes
`cartSignature` from the _provider-context_ cart — never the client-supplied
`data` — and calls `verifyShippingQuote` exactly like the shipping-rates
route does. A valid token charges its signed amount outright. An invalid one
(expired, tampered, or a cart/address mismatch) re-estimates live via
`ShipStationModuleService.getUspsRates` (verbatim reuse, per CNP-51's own
note that a future fulfillment provider would call it this way) and compares
the fresh amount against the client-supplied `data.amount` — the price the
shopper was shown — within a tolerance of `≤ max($0.50, 5%)`
(`withinShippingTolerance` in `shipstation-fulfillment/lib.ts`). Outside
tolerance, or no ShipStation service matching the requested `serviceCode`,
`calculatePrice` throws and Medusa blocks the cart refresh — the same
no-flat-rate-fallback stance CNP-51 already committed to, just enforced one
layer further in. Log tag: `[shipping-quote:mismatch]`.

**AC5 (tax) has one real, accepted tradeoff.** `ITaxProvider.getTaxLines`
returns _rates_ (percentages), not amounts — Medusa's own contract, not a
choice made here. Stripe Tax returns _amounts_. `tax-provider.ts` calls
`stripe.tax.calculations.create` with `expand: ["line_items"]` and converts
each line's `amount_tax`/`amount` into a percentage
(`amountToRate` in `stripe-tax/lib.ts`), then feeds the sale that percentage
back through Medusa's own rate × line-amount arithmetic. Expect up to ~1¢ of
per-line drift between what Medusa's cart shows and what the Stripe Tax
calculation actually said — the recorded transaction (below) reflects the
Stripe calculation, not Medusa's re-derived total, so Stripe's own reports
stay internally consistent regardless. There is deliberately no cache on this
provider (unlike the sibling `StripeTaxModuleService`, still cached for the
tax-quote route) — a cart refresh is infrequent enough that a stale cached
rate is worse than the extra round trip.

**AC1's conversion happens in `POST /store/checkout/prepare-cart`**
(`src/api/store/checkout/prepare-cart/route.ts`), the first place in this
app a Medusa cart gets created. It re-verifies _both_ the shipping and tax
signed tokens up front (the same `verifyShippingQuote`/`verifyTaxQuote` calls
the routes above use — a fast, explicit check ahead of the provider layer,
which is the actual safety net), resolves the region, creates the cart with
one line item per cart line carrying the storefront's display `details`/
`isCustomizable` as `metadata` (AC7 — full structured customization capture,
per `lineItemCustomizationSchema`, is future work; the storefront's `CartLine`
doesn't produce that payload yet), attaches the live-rate shipping method,
and creates a payment collection plus a Stripe payment session. **Idempotent
on `cartId`**: a repeat call with the same id reuses the existing cart and
its payment session rather than minting a second — the server half of AC10.

**Every read that feeds the payment decision must happen after every write
that can move `cart.total`, and the route's ordering exists for exactly that
reason.** `updateCartWorkflow` and `addShippingMethodToCartWorkflow` both run
`refreshCartItemsWorkflow`, which runs `refreshPaymentCollectionForCartWorkflow`,
which — on any change to the total — `parallelize`s
`deletePaymentSessionsWorkflow` with a resync of the payment collection's
amount. Deleting a session calls the Stripe provider's `deleteSession`, which
**cancels the PaymentIntent**. So a cart snapshot taken before those writes
describes a payment session that has since been deleted and an intent that is
now in a terminal state; handing its `client_secret` back to the storefront
produced `This PaymentIntent is in a terminal state and cannot be used to
initialize Elements` the moment a shopper edited their address after the
Payment Element had rendered. The route therefore keeps the pre-update read
down to the `invalid_cart`/`cart_already_completed` guards only, and re-reads
the cart — totals, payment collection, and sessions together — once all
mutations are done. Because the amount resync and the session deletion move
together in that one `when` branch, a collection whose `amount` still equals
`cart.total` is proof its session survived; anything else mints a fresh
session (`createPaymentSessionsWorkflow` deletes any survivor first, so this
cannot leave two).

**The shipping method is re-attached on every prepare call, not only when the
cart has none.** `addShippingMethodToCartWorkflow` runs
`removeShippingMethodFromCartStep` for the incoming shipping profile before
creating the new method, so this replaces rather than duplicates. Skipping it
left the method carrying the _previous_ address's `quoteToken`, which Medusa's
own `refreshCartShippingMethodsWorkflow` then handed back to `calculatePrice`
— a token that can never satisfy the new cart signature, so every ordinary
address edit logged `[shipping-quote:mismatch] reason=cart_mismatch` and took
the re-estimate/tolerance path, which throws and blocks checkout outright when
the address moved far enough for the fresh rate to fall outside tolerance.

**`POST /store/checkout/complete`** runs `completeCartWorkflow` and is
idempotent the same way: it looks up an existing order by `cart_id` first and
returns that instead of erroring, so a resubmitted request cannot double-place
an order.

**AC9 needed no code here.** Medusa core already ships
`/hooks/payment/:provider` with raw-body signature verification, and
`@medusajs/payment-stripe`'s `getWebhookActionAndData` drives
`processPaymentWorkflow`, which calls `completeCartAfterPaymentStep` when a
payment is authorized out-of-band — so an order still gets placed even if the
storefront's own `/checkout/complete` call never lands (browser closed
mid-redirect). The provider only acts on intents carrying its own
`metadata.session_id`, so events from another integration on the same Stripe
account are ignored.

**Recording the Stripe Tax transaction is the app's first subscriber**
(`src/subscribers/record-tax-transaction.ts`, on `order.placed`) — this is
what CNP-52's own notes meant by "recording that transaction is CNP-53's
job." Rather than plumbing a cart-scoped calculation id through Medusa's tax
provider context (which carries no cart id — see the note in
`tax-provider.ts`), it recomputes the calculation from the placed order's own
line items and address via `StripeTaxModuleService.calculateTax`, which
caches on exactly those inputs, so it reuses the checkout-time calculation
rather than paying for a second Stripe call in the common case. The new
`StripeTaxModuleService.recordTransaction` method wraps
`stripe.tax.transactions.createFromCalculation`, passing the order id as
`reference` — Stripe's own uniqueness constraint on that field means a
retried subscriber invocation for the same order fails cleanly rather than
double-recording. A failure logs `[stripe-tax:unavailable] reason=transaction_failed`
and never rolls back the already-paid order.

**`seed-us-region.ts` (CNP-51) already set this story up.** Its own comment —
"so CNP-53 has something to attach a cart to" — is why this story's own
migration script, `seed-us-stripe-payment-provider.ts`, only has to attach
providers rather than build a region from scratch: it adds `pp_stripe_stripe`
to the US region's `payment_providers`, switches the US tax region's
`provider_id` from `tp_system` to `tp_stripe-tax_stripe`, and adds a
`calculated`-price shipping option (`Live USPS Rate`) on the existing US
service zone, backed by the new fulfillment provider. It sorts **after**
`seed-us-region.ts` by filename (`seed-us-region.ts` < `seed-us-stripe-payment-provider.ts`)
since it depends on the region, tax region, and service zone that script
creates — the same filename-ordering discipline `seed-product-shipping-dimensions.ts`
already established. The flat `Standard Shipping` option from
`seed-us-region.ts` is untouched and stays as the catalogue-price row it
always was. Before it can create the `calculated`-price shipping option, the
script also `link.create`s the ShipStation provider onto the `US Workshop`
stock location — the same link `seed-us-region.ts` already makes for
`manual_manual` — because `createShippingOptionsWorkflow` validates a
provider against the stock locations actually linked to the service zone's
fulfillment set, not against `medusa-config.ts`'s provider list.

**Module registration alone does not make anything resolvable inside
another module's own service — not other modules, and not core framework
registrations either.** `ShipStationFulfillmentProviderService`'s
constructor injects `[SHIPSTATION_MODULE]` (`"shipstation"`, to reuse
`ShipStationModuleService.getUspsRates` for its re-estimate fallback) and
`ContainerRegistrationKeys.QUERY` (`"query"`, to re-query authoritative
variant/product dimensions — see below). Each module gets its own Awilix
scope, and a module only sees registrations outside that scope if its own
`medusa-config.ts` entry lists them under `dependencies` — the same
mechanism the `shipstation`/`stripeTax` custom modules already use for
`Modules.CACHE`, and it applies just as much to `query`, which is otherwise
easy to assume is globally available the way `logger` is. The
`@medusajs/medusa/fulfillment` entry therefore needs
`dependencies: [SHIPSTATION_MODULE, ContainerRegistrationKeys.QUERY]` —
omitting either throws `AwilixResolutionError: Could not resolve '...'` the
moment `calculatePrice` (or, at boot, `canCalculate`) runs, not at startup,
so each surfaces the first time a cart actually needs a calculated price
rather than during `medusa develop`. This bit twice in a row while building
this story — once for `shipstation`, once for `query` — precisely because
nothing about it is checkable by `tsc` or a unit test that constructs the
service directly with fake dependencies; only Medusa's own container, wired
up for real, exposes a missing scope declaration.

**`StripeTaxTaxProvider` cannot share `StripeTaxOptions` with the sibling
`StripeTaxModuleService`, even though both wrap the same Stripe Tax
calculation.** The module service is genuinely cached
(`cacheTtlSeconds`), but the tax-line provider is deliberately not (see its
own module-doc comment) and is never given that option in `medusa-config.ts`
— so validating it against the full `StripeTaxOptions` shape throws `Stripe
Tax module requires the following options: cacheTtlSeconds` the first time a
cart actually needs its tax lines calculated. `StripeTaxProviderOptions`
(`lib.ts`) is `Omit<StripeTaxOptions, "cacheTtlSeconds">`, with its own
`validateStripeTaxProviderOptions`, so the two option shapes and their
validators can drift independently.

**`getTaxLines` must never return `code: null`.** Medusa's
`line_item_tax_line`/`shipping_line_tax_line` tables have a non-nullable
`code` column — the DTO type (`@medusajs/framework/types`) allows
`code: string | null` because the built-in "system" provider sources a real
code from a local `tax_rate` row that can genuinely lack one, but a provider
with no such row, like this one, has to supply a real value itself or the
insert throws `ValidationError: Value for LineItemTaxLine.code is required,
'null' found`. `tax-provider.ts` hardcodes `"sales_tax"` for both item and
shipping tax lines.

**`getTaxLines` is called twice per cart refresh, not once — separately for
items and for shipping methods.** `get-item-tax-lines.ts` (Medusa core)
calls `TaxModuleService.getTaxLines` once with only item lines and, in a
separate call, once with only shipping lines (whenever, say, a shipping
method is added without any item changing) — never both at once. Stripe's
Tax Calculation API requires a non-empty `line_items` array even when only
`shipping_cost` is wanted, so a shipping-only call with `line_items: []`
fails with `Missing required param: line_items.` `tax-provider.ts` detects
an empty `itemLines` array and substitutes a single zero-amount placeholder
item for the Stripe _request_ only — it never appears in the returned tax
lines, since those are built by mapping over the real `itemLines`/
`shippingLines` arrays, not whatever was sent to Stripe. `tax-provider.test.ts`
covers both the items-only and shipping-only shapes directly, spying on
`tax.calculations.create` the same way `service.test.ts` does.

**`calculatePrice`'s re-estimate fallback must not trust `context.items[].variant`
for dimensions.** Medusa's own cart-refresh context
(`cartFieldsForCalculateShippingOptionsPrices`, core) fetches
`items.variant.{weight,length,width,height}` and `items.product.weight` — but
never the product's `length`/`width`/`height` at all, regardless of what the
provider needs. A variant that relies on product-level dimensions (the
common case; per-variant overrides are the exception) always looks
incomplete through this particular context, even though `initial-data-seed.ts`
and the CNP-51 publish-guard hook both set dimensions correctly. `calculatePrice`
re-queries `variant`/`product` dimensions directly instead — the same
`variant?.weight ?? variant?.product?.weight` fallback the
`/store/shipping-rates` route already uses — rather than trusting whatever
subset of fields the calling workflow happened to pass in. `service.test.ts`
covers the exact regression: a variant with no dimensions of its own, backed
only by its product's.

All seven of these — the two `AwilixResolutionError`s (`shipstation` and
`query`), the missing `cacheTtlSeconds`, the null `code`, the shipping-only
`line_items` requirement, the incomplete cart-refresh context, and the
cancelled PaymentIntent handed back from a pre-update cart snapshot — are
runtime-only failures. A passing `tsc`/`jest` run exercises none of Medusa's
actual DI container, its own options validation, its entity-level column
constraints, the exact field selection its own core workflows use, or the
side effects those workflows have on rows this app then reads back, so
`pnpm run db:migrate` and a real `pnpm run dev` checkout are what actually
catch them. Each one that has since been pinned down is covered by a unit
test that encodes the _behaviour Medusa was found to have_ —
`prepare-cart/route.test.ts` mocks the core workflows and switches the cart
the `query` mock returns once a mutating workflow has run, which is the only
way to express "the payment session was deleted underneath us" without a
live database.

## React 18 — do not "fix" it

The admin dashboard runs **React 18**, and this app declares `react`,
`react-dom`, `@types/react`, and `@types/react-dom` at 18 for that reason. The
storefront is on React 19. Never move React or its types to the root
`package.json`, and never enable pnpm hoisting — pnpm's non-hoisting default is
the only thing keeping the two majors apart. See the root file's code-style
section.

Admin extensions use `@medusajs/ui` and `@medusajs/admin-sdk`, with
`@tanstack/react-query` for data loading — follow Medusa's own admin patterns
rather than importing storefront components, which are HeroUI/React 19 and will
not work here.

## Environment

Copy `.env.example` to `.env`. It needs `DATABASE_URL`, `REDIS_URL`,
`JWT_SECRET`, `COOKIE_SECRET`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`,
`MEDUSA_BACKEND_URL`, and, for the Auth0 provider above, `AUTH0_DOMAIN`,
`AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_CALLBACK_URL` (the
storefront's own `/auth/callback`, not a Medusa URL). `JWT_SECRET` and
`COOKIE_SECRET` ship as `replace-me-…` placeholders and **must** be
regenerated (`openssl rand -base64 32`). The Auth0 client secret has no
scripted path to a local `.env` — the Management API never returns it in full
— so it's copied from the Auth0 dashboard by hand.

For [Admin SSO](#admin-sso-cnp-72): `GOOGLE_ADMIN_CLIENT_ID`,
`GOOGLE_ADMIN_CLIENT_SECRET`, `GOOGLE_ADMIN_CALLBACK_URL` (the admin
dashboard's own `/app/login`, not a storefront URL), `GOOGLE_ADMIN_ALLOWED_DOMAIN`,
and `MFA_ENCRYPTION_KEY` (`replace-me-…` placeholder, regenerate the same way
as `JWT_SECRET`). Like the Auth0 client secret, the Google client secret has
no scripted path to `.env` and is copied from the Google Cloud console by
hand.

Postgres is on host port **5433**, Redis on 6379 — both from the root
`docker-compose.yml`, started by `pnpm run services:up`.

For [Shipping rates](#shipping-rates-cnp-51): `SHIPSTATION_API_KEY`,
`SHIPSTATION_BASE_URL`, `SHIPSTATION_USPS_CARRIER_ID` (found via
`pnpm run list-carriers`), `SHIPSTATION_RATE_LIMIT_PER_MINUTE`,
`SHIPSTATION_TIMEOUT_MS`, `SHIPSTATION_MAX_RETRIES`, `SHIPSTATION_WEIGHT_UNIT`,
`SHIPSTATION_DIMENSION_UNIT`, `SHIPSTATION_RATE_CACHE_TTL_SECONDS`,
`SHIPPING_OPTION_DEFAULT_AMOUNT`/`_LABEL` (the seeded Medusa shipping option's
price — not a checkout-time fallback, see above), `SHIPPING_QUOTE_SECRET`
(`replace-me-…` placeholder, regenerate the same way as `JWT_SECRET`), and
`SHIP_FROM_ADDRESS_1`/`_CITY`/`_STATE`/`_POSTAL_CODE`/`_COUNTRY_CODE` (the
ship-from address — real values, never committed).

For [Sales tax](#sales-tax-cnp-52): `STRIPE_SECRET_KEY` (sandbox/test mode
locally — get one from the Stripe dashboard, and enable Stripe Tax with an
origin address and at least one state registration there too, since none of
that is scriptable), `STRIPE_TAX_DEFAULT_TAX_CODE`, `STRIPE_TAX_SHIPPING_TAX_CODE`,
`STRIPE_TAX_TIMEOUT_MS`, `STRIPE_TAX_MAX_RETRIES`, `STRIPE_TAX_CACHE_TTL_SECONDS`,
and `TAX_QUOTE_SECRET` (`replace-me-…` placeholder, regenerate the same way as
`JWT_SECRET` — do not reuse `SHIPPING_QUOTE_SECRET` or `JWT_SECRET` here).

For [Payments and order placement](#payments-and-order-placement-cnp-53):
`STRIPE_WEBHOOK_SECRET` — the signing secret for `/hooks/payment/stripe_stripe`,
from the Stripe dashboard's webhook endpoint settings, or printed by
`stripe listen --forward-to localhost:9000/hooks/payment/stripe_stripe` for
local development (see the README's Stripe payments section). `STRIPE_SECRET_KEY`
is reused from Sales tax above — the same Stripe account backs both.

## Database

Run both from the repo root:

- `pnpm run db:migrate` — runs migrations, which includes every migration
  script under `src/migration-scripts/` — the initial data seed,
  `seed-site-content.ts` (CNP-23), `seed-us-region.ts` and
  `seed-product-shipping-dimensions.ts` (both CNP-51, see
  [Shipping rates](#shipping-rates-cnp-51)), and `seed-us-stripe-payment-provider.ts`
  (CNP-53, see [Payments and order placement](#payments-and-order-placement-cnp-53))
  all run this way. Add a new seed
  as a new file here, not an edit to `initial-data-seed.ts`: the ledger tracks
  each script independently, so a new file still runs against a database that
  has already migrated, while editing an already-run script does nothing. Its
  output prints the `pk_…` publishable key the storefront needs in its
  `.env.local`.
- `pnpm run db:seed` — **only** for re-seeding a database you have deliberately
  reset. `db:migrate` already runs the seed and the migration ledger stops it
  repeating; `db:seed` runs it outside the ledger, minting a second publishable
  key and duplicating products.

## Testing

Node environment, `@swc/jest` transform, no jsdom. Tests live **beside the code
they cover** (`src/lib/validate-customization.ts` →
`src/lib/validate-customization.test.ts`); the config sets
`roots: ["<rootDir>/src"]`, so this is the only place they are picked up.

`jest.config.js` maps `@craftynp/types` to the package's `src/index.ts` rather
than its `dist/`, so tests do not depend on a prior build, and rewrites
`.js`-suffixed relative imports back to their TypeScript sources.
`modulePathIgnorePatterns` excludes `dist/` and `.medusa/` — build output that
would otherwise be collected twice.

The lint script is the plain `eslint src`, since tests live under `src`.

This app currently holds **190** of the repo's 1054 tests. The `siteContent`
module's field validation and value resolution are pure functions living in
`@craftynp/types` and are tested there instead — see that package's own test
count. The admin's `.tsx` extensions (including
`site-content-image-field.tsx`) go untested here too — this app's Jest is
node-environment with no jsdom, so nothing under `src/admin` can be rendered.
