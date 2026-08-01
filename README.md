# craftynp-store

The storefront and backend for The Crafty NP, a maker of custom and ready-made
crafted goods.

This monorepo holds a Next.js storefront, a Medusa commerce backend that also
serves the admin dashboard, and a shared TypeScript package for the types both
sides agree on. Shoppers browse and order from the storefront; the owner manages
products, discounts, and orders from the Medusa admin.

## Status

Scaffolded and running locally. A clone reaches a working dev environment — the
storefront server-renders products fetched live from Medusa, checkout takes a
real Stripe payment and places a Medusa order — but no environment has been
provisioned yet, so nothing is deployed. Artwork storage is wired in a later
story (CNP-16/17/20).

## Stack

| Layer          | Choice                                                     |
| -------------- | ---------------------------------------------------------- |
| Storefront     | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS |
| Backend        | Medusa 2.18 (also serves the admin dashboard), React 18    |
| Language       | TypeScript 5.9 (strict), pinned `~5.9.3`                   |
| Database       | Postgres 15 (Docker)                                       |
| Cache / events | Redis 7 (Docker; provisioned, not yet wired into Medusa)   |
| Tests          | Jest                                                       |
| Monorepo       | pnpm workspaces + Turborepo                                |
| Formatting     | Prettier (root), ESLint flat config (extended per app)     |

**Deployment targets — planned, not yet provisioned:** Vercel (storefront),
Railway (Medusa), Cloudflare R2 (customer artwork uploads), Stripe (payments and
tax), ShipStation (shipping rates). CNP-16, CNP-17, and CNP-20 do that work; none
of it exists in the repo today.

## Getting started

### Prerequisites

- **Node 22.** Pinned in `.nvmrc`; `engines` declares `>=22 <23` and the root
  `.npmrc` sets `engine-strict=true` — pnpm reads `.npmrc` too, so a newer
  default Node is rejected by `pnpm install` rather than merely warned about.
- **pnpm 10+.** Unlike npm, pnpm does **not** ship with Node, so install it
  separately. `packageManager` pins `pnpm@10.33.0` and `engines.pnpm` requires
  `>=10`.

  ```bash
  corepack enable && corepack prepare pnpm@10.33.0 --activate   # or:
  brew install pnpm                                             # or:
  npm install -g pnpm
  ```

- **Docker Desktop**, running — Postgres and Redis come from
  `docker-compose.yml`.

`.nvmrc` presumes nvm, but nvm is not required. Pick whichever applies:

```bash
# With nvm:
nvm use

# With Homebrew (node@22 is keg-only, so put it on PATH explicitly):
export PATH="$(brew --prefix node@22)/bin:$PATH"

# Any other version manager (asdf, fnm, volta) works too — just land on Node 22.
node -v   # must print v22.x
```

### Installation

```bash
git clone git@github.com:craftynp-cam/craftynp-store.git
cd craftynp-store
pnpm install
```

Run `pnpm install` **once at the repo root**, not per app — pnpm workspaces
installs and links all three packages from there. The workspace set is declared
in `pnpm-workspace.yaml` (`apps/*`, `packages/*`), not in the root
`package.json`. pnpm symlinks every dependency from a content-addressed store
and does **not** hoist to the root `node_modules`, so each app resolves only
what it declares — which is why the storefront's React 19 and the Medusa
admin's React 18 can coexist.

#### `onlyBuiltDependencies`

pnpm refuses to run dependency lifecycle scripts unless a package is
allowlisted. `pnpm-workspace.yaml` lists the six that genuinely need one —
`@swc/core`, `esbuild`, `msgpackr-extract`, `protobufjs`, `sharp`, and
`unrs-resolver` — each of which ships native binaries or generated code that
only exists after its postinstall runs. `@medusajs/telemetry` is deliberately
left out; its postinstall only phones home. A fresh install therefore prints

```
Ignored build scripts: @medusajs/telemetry@2.18.0.
```

**on purpose** — that warning is not a defect. If you add a dependency whose
build is silently skipped, add it to `onlyBuiltDependencies` rather than
disabling the check.

### Configuration

Two apps, two env files, and the target filenames are **not** symmetric:

```bash
cp apps/medusa/.env.example apps/medusa/.env
cp apps/storefront/.env.example apps/storefront/.env.local   # .env.local, not .env
```

Then edit `apps/medusa/.env` and replace the two placeholder secrets — they ship
as literal `replace-me-...` strings:

```bash
openssl rand -base64 32   # → JWT_SECRET
openssl rand -base64 32   # → COOKIE_SECRET
```

Leave `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` as `pk_replace_me` for now — that key
does not exist until the database is migrated. See the next section. The
`.env.example` files are the source of truth for what every variable means.

**Fill `apps/medusa/.env` completely before you migrate.** `seed-us-region.ts`
runs during the very first `db:migrate` and throws on any missing
`SHIP_FROM_ADDRESS_1`, `SHIP_FROM_CITY`, `SHIP_FROM_STATE`,
`SHIP_FROM_POSTAL_CODE`, `SHIP_FROM_COUNTRY_CODE`,
`SHIPPING_OPTION_DEFAULT_AMOUNT`, or `SHIPPING_OPTION_DEFAULT_LABEL`, so the
sections below that describe those variables have to be read before the first
run, not after it.

Customer accounts (CNP-56/57/58) run through Auth0, so `apps/medusa/.env` also
needs `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and
`AUTH0_CALLBACK_URL` from the tenant's application settings, and
`apps/storefront/.env.local` needs `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and
`NEXT_PUBLIC_SITE_URL` — Medusa boots the auth module explicitly now, so it
will not start without its three. See `apps/medusa/AGENTS.md`'s Auth section
for what each does and where they come from.

### First run

```bash
pnpm run services:up   # Postgres on host port 5433, Redis on 6379
pnpm run db:migrate    # applies migrations AND runs the seed scripts
```

`db:migrate` seeds no demo data — no sample products, no sample categories, and
exactly one region. What it does create is the scaffolding an environment cannot
work without: the default sales channel, store, and publishable API key
(`seed-defaults.ts`), the site-content defaults (`seed-site-content.ts`), and the
United States region, workshop stock location and shipping option
(`seed-us-region.ts`). Each script runs once, tracked in the `script_migrations`
ledger, so re-running `db:migrate` is safe.

#### Required one-time manual step: the publishable key

The storefront needs a publishable API key, and that key is created by
`seed-defaults.ts`, so it cannot exist before you migrate. `db:migrate` prints it
in its own output:

```
info:    Publishable API key: pk_01ab23cd45ef67ab89cd01ef23ab45cd...
```

Copy that value into `apps/storefront/.env.local`:

```bash
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...
```

This is manual and unavoidable on a fresh clone — the storefront throws at import
without it. The key can also be read from the admin under **Settings →
Publishable API Keys**, but that needs an admin user, which does not exist yet
(see below).

#### Create an admin user

Neither the migration nor the seeds create one, so the admin dashboard has no
account to log in with until you make it:

```bash
cd apps/medusa
npx medusa user -e you@example.com -p yourpassword   # or: pnpm exec medusa user …
```

Flags on the Medusa 2.18 CLI are `-e/--email`, `-p/--password`, `-i/--id`, and
`--invite` (which returns an invite token instead of creating a user — not what
first-time setup wants). There is no `--name` or `--role`. This must be run from
`apps/medusa`; there is no root script for it, and the CLI resolves the project
from the working directory. The database must already be migrated.

#### Shipping rates (ShipStation)

Live shipping rates at checkout (CNP-51) need a ShipStation V2 API sandbox
key — a separate product from the ShipStation app, Free tier, its own
sandbox at `https://api.shipstation.com/v2`. Set `SHIPSTATION_API_KEY` in
`apps/medusa/.env`, then find your connected USPS carrier's id:

```bash
pnpm run list-carriers
```

Paste the printed `carrier_id` into `SHIPSTATION_USPS_CARRIER_ID`. Also
regenerate `SHIPPING_QUOTE_SECRET` the same way as `JWT_SECRET`
(`openssl rand -base64 32`), and fill in `SHIP_FROM_ADDRESS_1`, `SHIP_FROM_CITY`,
`SHIP_FROM_STATE`, `SHIP_FROM_POSTAL_CODE`, and `SHIP_FROM_COUNTRY_CODE` —
these are the real ship-from address, so never commit real values to a
shared example file. **All of these must be set before the first `db:migrate`**,
which seeds the USD `United States` region from them (`seed-us-region.ts`), plus
a flat `Standard Shipping` option priced from
`SHIPPING_OPTION_DEFAULT_AMOUNT`/`SHIPPING_OPTION_DEFAULT_LABEL` — a Medusa
catalogue entry, **not** a checkout-time fallback: if ShipStation is
unreachable or a rate can't be calculated, checkout shows an error and blocks
Continue rather than quoting a guessed price. A second, live-rate shipping
option is seeded by `seed-us-stripe-payment-provider.ts` once Stripe payments
are configured below. Leave `NEXT_PUBLIC_DEFAULT_REGION` at `us` — United States
is the only region any environment gets. Do not point automated tests at the
ShipStation sandbox: its 20 requests/minute ceiling causes sporadic failures.

#### Shipment tracking webhook (ShipStation)

Delivery progress (CNP-65) arrives on ShipStation's `track` webhook rather than
by polling — polling on a timer is the usual way to exhaust the rate limit.
Set `SHIPSTATION_JWKS_URL` from ShipStation's webhook documentation for your
environment; the receiver **fails closed without it**, since an unverified
tracking endpoint would let anyone mark an order delivered. Then point
`SHIPSTATION_WEBHOOK_URL` at this backend's `/hooks/shipstation/track` and
register it:

```bash
pnpm run register-webhook
```

ShipStation allows one URL per event and answers `409` if one is already
registered, which the script reports rather than treating as a failure. It will
not deliver to `localhost`, so use a tunnel while developing:

```bash
cloudflared tunnel --url http://localhost:9000
```

Until a label is actually bought — the fulfilment workspace is CNP-76 — record
a shipment by hand from the Fulfilment panel on the order in `/app`. That marks
the order shipped, emails the customer, and gives the webhook a tracking number
to match against.

#### Stripe payments

Checkout (CNP-53) needs a Stripe account in test mode. Set `STRIPE_SECRET_KEY`
in `apps/medusa/.env` (shared with Sales tax below if you've already set that
up) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `apps/storefront/.env.local` —
both come from the Stripe dashboard's Developers → API keys page, same
account. `STRIPE_WEBHOOK_SECRET` isn't a value you generate yourself — run
the Stripe CLI locally instead, which prints its own signing secret:

```bash
stripe listen --forward-to localhost:9000/hooks/payment/stripe_stripe
```

Paste the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` and leave the
command running while you test checkout — it's what delivers the webhook
Medusa uses to reconcile an order if the browser closes mid-redirect (AC9).
`db:migrate` runs `seed-us-stripe-payment-provider.ts`, which attaches Stripe
to the seeded US region as its payment provider, switches the region's tax
provider from the system default to Stripe Tax, and adds a live-rate
shipping option backed by ShipStation — all three providers CNP-53 registers
in `medusa-config.ts`. Pay with Stripe's test card `4242 4242 4242 4242` (any
future expiry, any CVC) for a successful charge, or `4000 0000 0000 0002` to
exercise a decline. Never point automated tests at the Stripe sandbox — same
reasoning as the ShipStation sandbox note above.

#### Sales tax (Stripe Tax)

Configured by the same `STRIPE_SECRET_KEY` as Stripe payments above. Enable
Stripe Tax in the dashboard with an origin address and at least one state
registration — neither is scriptable. See `apps/medusa/.env.example` for the
remaining `STRIPE_TAX_*` variables and `apps/medusa/AGENTS.md`'s Sales tax
section for how the calculation itself works.

#### Transactional email (Resend)

Order confirmation and shipped receipts go out through Resend. **The email
bodies are not in this repo** — they are Resend-hosted templates, bound by
alias (`order-confirmation`, `order-shipped`, `password-reset`) so the binding
survives a template being recreated. Medusa supplies the variables; the owner
edits the design in the Resend dashboard.

Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `STOREFRONT_URL` from
`apps/medusa/.env.example`. `STOREFRONT_URL` is what builds the tokenized order
link in the email, so a wrong value produces receipts nobody can open.

**DNS.** `thecraftynp.org` is verified in Resend with these records:

| Type | Name                | Value                                                      | Notes         |
| ---- | ------------------- | ---------------------------------------------------------- | ------------- |
| TXT  | `resend._domainkey` | the DKIM public key from Resend                            | DKIM          |
| MX   | `send`              | `feedback-smtp.us-east-1.amazonses.com`                    | priority 10   |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                        | SPF           |
| TXT  | `_dmarc`            | `v=DMARC1; p=none; rua=mailto:dmarc@thecraftynp.org; fo=1` | added by hand |

**Resend provisions SPF and DKIM but never DMARC** — its dashboard shows the
domain fully verified without one, so it is easy to assume it is handled. The
`_dmarc` record above was added at the registrar for that reason; if you ever
rebuild this domain's DNS from what Resend shows you, it will be missing again.

It sits at `p=none` (monitor only) for now. Read the aggregate reports for a
few weeks, then tighten to `p=quarantine` and eventually `p=reject`.

Two things to know before tightening:

- **Do not add `aspf=s` (strict SPF alignment).** Resend's Return-Path is on
  the `send.` subdomain, so strict alignment fails **every** order email.
  Relaxed is the default and passes on the organizational domain — leave the
  alignment tags off entirely.
- **DMARC applies to the whole domain, not just Resend.** Order mail goes out
  through Resend (`send` SPF + `resend._domainkey`) and everything else through
  Google Workspace (root `include:_spf.google.com` + the `google` DKIM
  selector). Both are aligned today; any future sender has to be too before the
  policy moves past `p=none`.

The free tier allows **100 emails a day** on one custom domain — a daily cap,
not a monthly one, so a burst can exhaust it while the month sits far under
3,000. Every send logs its remaining allowance, and `[email:quota-low]` /
`[email:quota-daily]` are logged at warn as it runs down. See the "Email and
notifications" section of `apps/medusa/AGENTS.md`.

Password reset is **not** sent by this app — Auth0 owns it. See
[apps/medusa/docs/auth0-custom-email-provider.md](apps/medusa/docs/auth0-custom-email-provider.md).

### Running locally

```bash
pnpm run dev
```

| Service    | URL                       |
| ---------- | ------------------------- |
| Storefront | http://localhost:8000     |
| Medusa API | http://localhost:9000     |
| Admin      | http://localhost:9000/app |

The storefront port is fixed at 8000 because Medusa's `STORE_CORS` allows only
that origin.

**Use the root scripts.** Do not run `pnpm --filter <package> run <task>`.
`@craftynp/types` resolves through its own `exports` map to the package's
**built** `dist/`, and only root invocations go through Turborepo's
`dependsOn: ["^build"]` ordering that produces it. A workspace-scoped call
bypasses turbo and fails on a clone that has never been built.

Do not add a tsconfig `paths` entry for `@craftynp/types` to get around that.
Turbopack honours `paths` for runtime resolution as well as typechecking, so
aliasing the package at its `dist/index.d.ts` erases every value import of it
from the bundle — `resolveSiteContent(...)` compiled to `(void 0)(...)` and
crashed the render, while `tsc` and Jest both stayed green.

For the same reason, run `pnpm run build` before `pnpm run typecheck` on a clone
you have never built: `next-env.d.ts` is generated by the build and gitignored,
and it carries the `globals.css` module declaration. It self-heals after any
build.

### Setting up a fresh QA or Production environment

The same path as a fresh local clone, minus Docker — the environment supplies
its own Postgres and Redis. The one thing that will bite you is the ordering:
the seeds read the environment, so a partly-filled `.env` fails the migration
rather than producing a half-configured store.

1. Provision Postgres and Redis, and point `DATABASE_URL` and `REDIS_URL` at
   them.
2. Fill `apps/medusa/.env` **completely** from `apps/medusa/.env.example`, with
   this environment's own `JWT_SECRET`, `COOKIE_SECRET`, `SHIPPING_QUOTE_SECRET`
   and `ORDER_ACCESS_SECRET`, its Auth0 and Google Workspace OAuth clients, its
   Stripe and ShipStation keys, and the real `SHIP_FROM_*` address.
3. `pnpm install && pnpm run build`.
4. `pnpm run db:migrate`. Watch for `seed-defaults` running before
   `seed-us-region`; if it does not, the region seed fails on the missing
   default sales channel.
5. Copy the `Publishable API key: pk_…` it prints into the storefront
   environment's `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, and fill the rest of
   `apps/storefront/.env.local` from `apps/storefront/.env.example`.
6. Create the first admin from `apps/medusa` with
   `npx medusa user -e you@example.com -p yourpassword`. Google sign-in only
   links an admin that already exists.
7. `pnpm run register-webhook` once `SHIPSTATION_WEBHOOK_URL` points at this
   environment's public `/hooks/shipstation/track`.

The result in `/app` is **exactly one region, United States, in USD**, one stock
location (`US Workshop`), no products, and no categories. A second region is not
a harmless addition — it silently changes the currency the storefront quotes in
and which shipping options a cart is offered. The client adds her own products
and categories from the admin.

### Cleaning up a dev database seeded before CNP-79

The `script_migrations` ledger keys on a script's **basename**, so deleting
`initial-data-seed.ts` changes nothing on a database that already ran it. Any
dev database migrated before CNP-79 therefore still carries the Medusa starter
data: a `Europe` region in EUR, seven EU tax regions, a `European Warehouse`
stock location with its EU fulfillment set and EUR shipping options, and four
demo products (`t-shirt`, `sweatshirt`, `sweatpants`, `shorts`) in four
categories.

The clean fix is to reset:

```bash
docker compose down -v && pnpm run services:up
pnpm run db:migrate
```

That mints a **new publishable key**, so copy the printed `pk_…` into
`apps/storefront/.env.local` again and re-create the admin user.

To keep the database instead, delete the following by hand in `/app`, in this
order — Medusa refuses to delete a region or location still referenced:

1. **Products** → the four demo products.
2. **Categories** → the four demo categories.
3. **Settings → Locations & Shipping** → the `European Warehouse` location, its
   fulfillment set and its shipping options.
4. **Settings → Regions** → `Europe`.
5. **Settings → Tax Regions** → the seven EU regions.

Either way, `seed-defaults.ts` is a new basename and so runs against an existing
database too, which **flips the store's default currency from EUR to USD**. That
is intended, not a regression.

## Known papercuts

- **`pnpm run dev` is `services:up && turbo dev`**, an `&&` chain. Any Docker
  failure aborts the whole command with a raw Docker error before either app
  starts. If that happens and the containers are already healthy,
  `pnpm exec turbo dev` runs the second half on its own.
- **Container names are project-scoped** (`craftynp-store-postgres-1`,
  `craftynp-store-redis-1`) because `docker-compose.yml` sets no
  `container_name`. Address them through compose — `docker compose logs postgres`,
  `docker compose exec postgres psql -U medusa -d craftynp_store` — rather than
  by hardcoded name. A second checkout in a differently-named directory gets its
  own containers, but still binds the same host ports, so only one checkout's
  services can run at a time.
- **Postgres is on host port 5433**, not the default 5432, because an unrelated
  project's container owns 5432 on the machine this was built on. Redis is on 6379.
- `pnpm install` prints deprecation warnings for transitive dependencies, and
  `pnpm audit` reports vulnerability advisories — almost all through the Medusa
  dependency tree. (Unlike `npm install`, pnpm does not print an audit summary
  during install.) Out of scope for the scaffold.

## Project structure

```
apps/
  medusa/       Medusa 2.18 backend + admin dashboard. API routes, workflows,
                migration scripts (including the initial data seed).
  storefront/   Next.js 16 storefront. App Router, Tailwind, server components
                that fetch from Medusa via @medusajs/js-sdk.
packages/
  types/        @craftynp/types — zod schemas and TypeScript types shared by
                both apps. Built to dist/ and consumed from there.
docker-compose.yml   Local Postgres 15 and Redis 7.
pnpm-workspace.yaml  Workspace globs, plus the onlyBuiltDependencies allowlist.
turbo.json           Task graph; every task depends on ^build.
```

## Scripts

All are run from the repo root.

| Task             | Command                                           |
| ---------------- | ------------------------------------------------- |
| Install          | `pnpm install`                                    |
| Dev server       | `pnpm run dev`                                    |
| Build            | `pnpm run build`                                  |
| Test             | `pnpm run test`                                   |
| Lint             | `pnpm run lint`                                   |
| Typecheck        | `pnpm run typecheck`                              |
| Format           | `pnpm run format` / `pnpm run format:check`       |
| DB migrate       | `pnpm run db:migrate`                             |
| Services up/down | `pnpm run services:up` / `pnpm run services:down` |

## Deployment

Nothing is deployed yet. The intended mapping, once CNP-16 and CNP-17 provision
the environments:

| Branch | Environment | Target                                 |
| ------ | ----------- | -------------------------------------- |
| `main` | Production  | Vercel (storefront) + Railway (Medusa) |
| `qa`   | Staging     | Vercel + Railway                       |
| `dev`  | Preview     | Vercel + Railway                       |

### Before the first public deploy

Four store routes take no session at all, and two of them spend money on every
call — `/store/tax-quote` bills a Stripe Tax calculation, and
`/store/shipping-rates` burns the ShipStation rate limit, which returns
`502 shipping_unavailable` and blocks checkout for real customers once
exhausted. The app carries per-IP limits on all four (see
`RATE_LIMIT_*` in `apps/medusa/.env.example`), but those are a second line of
defence and the counters are per-process until Redis lands with CNP-16.

**Do these in the Cloudflare dashboard — none of it lives in this repo:**

1. **Put the Medusa origin behind Cloudflare and stop it accepting traffic any
   other way.** The app's limiter keys on `cf-connecting-ip`, which Cloudflare
   strips from inbound requests; reachable directly, that header can be forged
   and the limiter is defeated.
2. **Security → Bots → Bot Fight Mode on.** This is the single highest-value
   setting and takes one click.
3. **Rate-limiting rules** on `/store/tax-quote`, `/store/shipping-rates` and
   `/store/checkout/*`. Set them above the app's own per-minute ceilings so
   Cloudflare sheds the volume and the app limit only catches what slips past.
4. Confirm the storefront is served at the exact hostname hardcoded in the
   order and password-reset emails, or the logo will 404 in every one.

Turnstile was considered and deliberately left out: it is the only measure of
these that adds friction to the conversion path, and it protects the same
surface as 2 and 3. Revisit it if abuse gets through anyway.

## Contributing

Work flows in one direction: `feature/*` → `dev` → `qa` → `main`.

- Branch from `dev` (the default branch) using `feature/*`, `fix/*`, or `chore/*`.
- Open your pull request against `dev`. Feature PRs are squash-merged into `dev`.
- Promote `dev` → `qa` for testing, then `qa` → `main` for release. **Promotion
  pull requests must use a merge commit** — squash and rebase are blocked, because
  rewriting SHAs would permanently diverge the branches.
- `dev`, `qa`, and `main` are permanent: they cannot be deleted or force-pushed
  by anyone, including admins.

Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and `pnpm run build`
before opening a pull request.

`pnpm run build` needs `apps/storefront/.env.local` to exist — Next inlines the
`NEXT_PUBLIC_*` values at build time, and `src/lib/medusa.ts` throws at
module-eval if they are missing. That guard is deliberate: it is what stops a
bundle with `undefined` baked into it from ever being produced. It does **not**
need a running backend or database — the Medusa fetch helpers degrade to empty
values, so the build logs "Could not load ..." and still prerenders every page.

On a fresh checkout with no configuration of its own — CI included — the
placeholder values are enough to build:

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
pnpm run build
```

Full details, including the GitHub rulesets that enforce this, are in
[AGENTS.md](AGENTS.md). Conventions specific to one app live alongside it, in
[apps/storefront/AGENTS.md](apps/storefront/AGENTS.md) and
[apps/medusa/AGENTS.md](apps/medusa/AGENTS.md).

## License

Private and proprietary. All rights reserved.
