# AGENTS.md — Medusa backend

Instructions for the Medusa backend. The repo-wide setup, commands, branching
strategy, and shared conventions are in the root [AGENTS.md](../../AGENTS.md) —
read that first; this file only covers what is particular to this app.

## Overview

Medusa 2.18 on port **9000**, with the admin dashboard served at **`/app`**.
Shared zod schemas and types come from `@craftynp/types`.

Layout under `src/`:

- `api/` — custom store (`api/store/*`) and admin (`api/admin/*`) routes, plus
  `api/middlewares.ts` (validation middleware registration).
- `admin/` — admin dashboard extensions. `admin/routes/site-content` (CNP-23)
  is the first UI route in the repo; `admin/lib/client.ts` is its SDK
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
  keeps prior values for compensation. `subscribers/`, `jobs/`, `links/`
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
`{ user: ["emailpass"], customer: ["auth0"] }` — which closes
`/auth/customer/emailpass/*` so a customer cannot bypass Auth0, while the admin
dashboard (`user`) keeps its own emailpass sign-in untouched. Registering the
auth module explicitly is also what makes `emailpass` have to be re-declared at
all: before this change it existed only as Medusa's implicit default.

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

Postgres is on host port **5433**, Redis on 6379 — both from the root
`docker-compose.yml`, started by `pnpm run services:up`.

## Database

Run both from the repo root:

- `pnpm run db:migrate` — runs migrations, which includes every migration
  script under `src/migration-scripts/` — the initial data seed and
  `seed-site-content.ts` (CNP-23) both run this way. Add a new seed as a new
  file here, not an edit to `initial-data-seed.ts`: the ledger tracks each
  script independently, so a new file still runs against a database that has
  already migrated, while editing an already-run script does nothing. Its
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

This app currently holds **23** of the repo's 583 tests. The `siteContent`
module's field validation and value resolution are pure functions living in
`@craftynp/types` and are tested there instead — see that package's own test
count. The admin's `.tsx` extensions (including
`site-content-image-field.tsx`) go untested here too — this app's Jest is
node-environment with no jsdom, so nothing under `src/admin` can be rendered.
