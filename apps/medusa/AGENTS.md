# AGENTS.md — Medusa backend

Instructions for the Medusa backend. The repo-wide setup, commands, branching
strategy, and shared conventions are in the root [AGENTS.md](../../AGENTS.md) —
read that first; this file only covers what is particular to this app.

## Overview

Medusa 2.18 on port **9000**, with the admin dashboard served at **`/app`**.
Shared zod schemas and types come from `@craftynp/types`.

Layout under `src/`:

- `api/` — custom store (`api/store/*`) and admin (`api/admin/*`) routes.
- `admin/` — admin dashboard extensions (widgets, custom pages, i18n).
- `workflows/`, `subscribers/`, `jobs/`, `links/`, `modules/` — the standard
  Medusa extension points, currently scaffolding only.
- `lib/` — plain helpers such as `validate-customization.ts`.
- `migration-scripts/initial-data-seed.ts` — the initial data seed. It is a
  migration script, not a standalone seeder; see below.

`medusa-config.ts` holds the module and CORS configuration.

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
`JWT_SECRET`, `COOKIE_SECRET`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, and
`MEDUSA_BACKEND_URL`. `JWT_SECRET` and `COOKIE_SECRET` ship as `replace-me-…`
placeholders and **must** be regenerated (`openssl rand -base64 32`).

Postgres is on host port **5433**, Redis on 6379 — both from the root
`docker-compose.yml`, started by `pnpm run services:up`.

## Database

Run both from the repo root:

- `pnpm run db:migrate` — runs migrations, which includes the initial data seed.
  Its output prints the `pk_…` publishable key the storefront needs in its
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

This app currently holds **9** of the repo's 425 tests.
