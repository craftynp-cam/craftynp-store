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
| Monorepo       | npm workspaces + Turborepo                                 |
| Formatting     | Prettier (root), ESLint flat config (extended per app)     |

**Deployment targets — planned, not yet provisioned:** Vercel (storefront),
Railway (Medusa), Cloudflare R2 (customer artwork uploads), Stripe (payments and
tax), ShipStation (shipping rates). CNP-16, CNP-17, and CNP-20 do that work; none
of it exists in the repo today.

## Getting started

### Prerequisites

- **Node 22.** Pinned in `.nvmrc`; `engines` declares `>=22 <23` and the root
  `.npmrc` sets `engine-strict=true`, so a newer default Node is rejected by
  `npm install` rather than merely warned about.
- **npm 10+** (ships with Node 22).
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
npm install
```

Run `npm install` **once at the repo root**, not per app — npm workspaces
installs and links all three packages from there.

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

### First run

```bash
npm run services:up   # Postgres on host port 5433, Redis on 6379
npm run db:migrate    # applies migrations AND seeds the initial data
```

**Do not run `npm run db:seed` after this.** In Medusa 2.18 the seed is itself a
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
npx medusa user -e you@example.com -p yourpassword
```

Flags on the Medusa 2.18 CLI are `-e/--email`, `-p/--password`, `-i/--id`, and
`--invite` (which returns an invite token instead of creating a user — not what
first-time setup wants). There is no `--name` or `--role`. This must be run from
`apps/medusa`; there is no root script for it, and the CLI resolves the project
from the working directory. The database must already be migrated.

### Running locally

```bash
npm run dev
```

| Service    | URL                       |
| ---------- | ------------------------- |
| Storefront | http://localhost:8000     |
| Medusa API | http://localhost:9000     |
| Admin      | http://localhost:9000/app |

The storefront port is fixed at 8000 because Medusa's `STORE_CORS` allows only
that origin.

**Use the root scripts.** Do not run `npm run <task> --workspace=...`. The
storefront's tsconfig aliases `@craftynp/types` to the package's **built**
`dist/index.js` (Turbopack cannot resolve NodeNext `.js` specifiers in source),
and only root invocations go through Turborepo's `dependsOn: ["^build"]`
ordering that produces that `dist`. A workspace-scoped call bypasses turbo and
fails on a clone that has never been built.

For the same reason, run `npm run build` before `npm run typecheck` on a clone
you have never built: `next-env.d.ts` is generated by the build and gitignored,
and it carries the `globals.css` module declaration. It self-heals after any
build.

## Known papercuts

- **`docker-compose.yml` hardcodes `container_name`** (`craftynp-postgres`,
  `craftynp-redis`), so a _second_ checkout of this repo on the same machine
  cannot start its own services — compose fails with a container-name conflict
  and leaves stray `<dir>_default` networks and `<dir>_*_data` volumes behind.
  One checkout per machine is fine.
- **`npm run dev` is `services:up && turbo dev`**, an `&&` chain. Any Docker
  failure — including the one above — aborts the whole command with a raw Docker
  error before either app starts. If that happens and the containers are already
  healthy, `npx turbo dev` runs the second half on its own.
- **Postgres is on host port 5433**, not the default 5432, because an unrelated
  project's container owns 5432 on the machine this was built on. Redis is on 6379.
- `npm install` reports transitive vulnerability advisories, almost all through
  the Medusa dependency tree. Out of scope for the scaffold.

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
turbo.json           Task graph; every task depends on ^build.
```

## Scripts

All are run from the repo root.

| Task             | Command                                         |
| ---------------- | ----------------------------------------------- |
| Install          | `npm install`                                   |
| Dev server       | `npm run dev`                                   |
| Build            | `npm run build`                                 |
| Test             | `npm run test`                                  |
| Lint             | `npm run lint`                                  |
| Typecheck        | `npm run typecheck`                             |
| Format           | `npm run format` / `npm run format:check`       |
| DB migrate       | `npm run db:migrate`                            |
| DB seed          | `npm run db:seed` (re-seed a reset DB only)     |
| Services up/down | `npm run services:up` / `npm run services:down` |

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

Run `npm run lint`, `npm run typecheck`, and `npm run test` before opening a pull
request.

Full details, including the GitHub rulesets that enforce this, are in
[AGENTS.md](AGENTS.md).

## License

Private and proprietary. All rights reserved.
