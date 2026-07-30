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

## Database

Run both from the repo root:

- `pnpm run db:migrate` — runs migrations, which includes every migration
  script under `src/migration-scripts/` — the initial data seed,
  `seed-site-content.ts` (CNP-23), `seed-us-region.ts`, and
  `seed-product-shipping-dimensions.ts` (both CNP-51, see
  [Shipping rates](#shipping-rates-cnp-51)) all run this way. Add a new seed
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

This app currently holds **116** of the repo's 898 tests. The `siteContent`
module's field validation and value resolution are pure functions living in
`@craftynp/types` and are tested there instead — see that package's own test
count. The admin's `.tsx` extensions (including
`site-content-image-field.tsx`) go untested here too — this app's Jest is
node-environment with no jsdom, so nothing under `src/admin` can be rendered.
