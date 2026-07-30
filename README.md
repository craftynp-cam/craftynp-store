# craftynp-store

The storefront and backend for The Crafty NP, a maker of custom and ready-made
crafted goods.

This monorepo holds a Next.js storefront, a Medusa commerce backend that also
serves the admin dashboard, and a shared TypeScript package for the types both
sides agree on. Shoppers browse and order from the storefront; the owner manages
products, discounts, and orders from the Medusa admin.

## Status

Scaffolded and running locally. A clone reaches a working dev environment — the
storefront server-renders products fetched live from Medusa — but no environment
has been provisioned yet, so nothing is deployed. Payments, shipping rates, and
artwork storage are wired in later stories (CNP-16/17/20).

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
pnpm run db:migrate    # applies migrations AND seeds the initial data
```

**Do not run `pnpm run db:seed` after this.** In Medusa 2.18 the seed is itself a
migration script (`apps/medusa/src/migration-scripts/initial-data-seed.ts`), so
`db:migrate` already runs it and the migration ledger keeps it from running
twice. `db:seed` executes that same script _outside_ the ledger against
unguarded workflows: on an already-seeded database it mints a second publishable
key and duplicates the products. It exists for one case only — re-seeding a
database you have deliberately reset.

#### Required one-time manual step: the publishable key

The storefront needs a publishable API key, and that key is created by the seed,
so it cannot exist before you migrate. `db:migrate` prints it in its own output:

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

Neither the migration nor the seed creates one, so the admin dashboard has no
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
shared example file. `db:migrate` seeds a second, USD `United States` region
from these values (`seed-us-region.ts`), plus a flat `Standard Shipping`
option priced from `SHIPPING_OPTION_DEFAULT_AMOUNT`/`SHIPPING_OPTION_DEFAULT_LABEL`
— that price is a Medusa catalogue entry for the future cart-based checkout
(CNP-53), **not** a checkout-time fallback: if ShipStation is unreachable or a
rate can't be calculated, checkout shows an error and blocks Continue rather
than quoting a guessed price. Point `NEXT_PUBLIC_DEFAULT_REGION` at the new
region (its country, `us`) so the storefront quotes in the same currency its
shipping rates come back in — the seed's original EUR `Europe` region is not
a sensible pairing with USPS rates. Do not point automated tests at the
ShipStation sandbox: its 20 requests/minute ceiling causes sporadic failures.

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

**Use the root scripts.** Do not run `pnpm --filter <package> run <task>`. The
storefront's tsconfig aliases `@craftynp/types` to the package's **built**
`dist/index.js` (Turbopack cannot resolve NodeNext `.js` specifiers in source),
and only root invocations go through Turborepo's `dependsOn: ["^build"]`
ordering that produces that `dist`. A workspace-scoped call bypasses turbo and
fails on a clone that has never been built.

For the same reason, run `pnpm run build` before `pnpm run typecheck` on a clone
you have never built: `next-env.d.ts` is generated by the build and gitignored,
and it carries the `globals.css` module declaration. It self-heals after any
build.

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
| DB seed          | `pnpm run db:seed` (re-seed a reset DB only)      |
| Services up/down | `pnpm run services:up` / `pnpm run services:down` |

## Deployment

Nothing is deployed yet. The intended mapping, once CNP-16 and CNP-17 provision
the environments:

| Branch | Environment | Target                                 |
| ------ | ----------- | -------------------------------------- |
| `main` | Production  | Vercel (storefront) + Railway (Medusa) |
| `qa`   | Staging     | Vercel + Railway                       |
| `dev`  | Preview     | Vercel + Railway                       |

## Contributing

Work flows in one direction: `feature/*` → `dev` → `qa` → `main`.

- Branch from `dev` (the default branch) using `feature/*`, `fix/*`, or `chore/*`.
- Open your pull request against `dev`. Feature PRs are squash-merged into `dev`.
- Promote `dev` → `qa` for testing, then `qa` → `main` for release. **Promotion
  pull requests must use a merge commit** — squash and rebase are blocked, because
  rewriting SHAs would permanently diverge the branches.
- `dev`, `qa`, and `main` are permanent: they cannot be deleted or force-pushed
  by anyone, including admins.

Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test` before opening a pull
request.

Full details, including the GitHub rulesets that enforce this, are in
[AGENTS.md](AGENTS.md). Conventions specific to one app live alongside it, in
[apps/storefront/AGENTS.md](apps/storefront/AGENTS.md) and
[apps/medusa/AGENTS.md](apps/medusa/AGENTS.md).

## License

Private and proprietary. All rights reserved.
