# AGENTS.md

Repo-wide facts. Anything specific to one app lives in that app's own
`AGENTS.md` — read it as well as this one before working there.

| Workspace         | Instructions                                           |
| ----------------- | ------------------------------------------------------ |
| `apps/storefront` | [apps/storefront/AGENTS.md](apps/storefront/AGENTS.md) |
| `apps/medusa`     | [apps/medusa/AGENTS.md](apps/medusa/AGENTS.md)         |
| `packages/types`  | covered here                                           |

## Project

The storefront and backend for The Crafty NP, a maker of custom and ready-made
crafted goods. Shoppers browse and order from the Next.js storefront; the owner
manages products, discounts, and orders from the Medusa admin dashboard.

- `apps/storefront` — Next.js 16 / React 19 App Router, port **8000**.
- `apps/medusa` — Medusa 2.18, port **9000**, admin at `/app`, React **18**.
- `packages/types` — `@craftynp/types`, the zod schemas and types shared by both
  apps, consumed from its built `dist/`.

TypeScript 5.9 strict, Tailwind CSS, Postgres 15 and Redis 7 via Docker, Jest,
pnpm workspaces + Turborepo.

## Commands

Needs Node 22, pnpm 10+, and Docker running. First-time setup — env files,
secrets, migrations, the publishable key, an admin user — is in
[README.md](README.md); follow it there rather than improvising.

Run every command from the repo root. **Never use `pnpm --filter <pkg> run
<task>`:** it bypasses Turborepo's `^build` ordering, and the storefront
resolves `@craftynp/types` from its built `dist/`, so a filtered call fails on a
clone that has never been built.

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
| DB seed          | `pnpm run db:seed`                                |
| Services up/down | `pnpm run services:up` / `pnpm run services:down` |

Run lint, typecheck, and tests before opening a pull request. On a clone that
has never been built, run `pnpm run build` before `pnpm run typecheck` —
`next-env.d.ts` is build-generated.

`db:migrate` and `db:seed` are not interchangeable — read
[apps/medusa/AGENTS.md](apps/medusa/AGENTS.md) before running either.

## Environment

Copy each app's `.env.example`; the target filenames differ. Those files are the
source of truth for what every variable means, so no values or descriptions go
here.

| App               | Example                        | Copy to                      |
| ----------------- | ------------------------------ | ---------------------------- |
| `apps/medusa`     | `apps/medusa/.env.example`     | `apps/medusa/.env`           |
| `apps/storefront` | `apps/storefront/.env.example` | `apps/storefront/.env.local` |

Postgres listens on host port **5433**, not 5432. Redis is on 6379.

## Branching

`feature/* → dev → qa → main`, one direction only. Branch from an up-to-date
`dev`; pull requests target `dev`. Prefixes: `feature/`, `fix/`, `chore/`.

- **Feature PRs into `dev` must be squash-merged.**
- **Promotion PRs (`dev → qa`, `qa → main`) must use a merge commit.** Squashing
  rewrites the commit SHAs and permanently diverges the branches, producing
  phantom conflicts on every later promotion.
- Never merge a feature branch straight into `qa` or `main`, and never merge
  backwards — except a `main` hotfix, which is merged down into `qa`, then
  `dev`.
- `dev`, `qa`, and `main` are never deleted or force-pushed. GitHub rulesets
  enforce this with no bypass actors, repository admins included.

Nothing is deployed yet.

## Conventions

Commits are `type(scope): summary` — `feat`, `fix`, `chore`, `docs`, `refactor`,
`test`, `perf`, `build`, `ci`.

- Prettier and ESLint are configured once at the repo root and each app extends
  the root flat config. Do not add per-app Prettier configs, and fix the
  offending source rather than weakening the root ESLint config.
- TypeScript is strict, including `noUncheckedIndexedAccess`, and pinned to
  `~5.9.3` in every workspace so all three packages share one compiler. Bring
  generated scaffolding up to that standard rather than exempting it.
- **Never add `react` or `@types/react` to the root `package.json`, and never
  enable pnpm hoisting** (`node-linker=hoisted`, `public-hoist-pattern`). The
  Medusa admin needs React 18 and the storefront needs React 19; pnpm's
  non-hoisting default, plus the `packageExtensions` block in
  `pnpm-workspace.yaml`, are the only things keeping the two majors apart. This
  looks like harmless deduplication and is not.
- If a new dependency's build is silently skipped, add it to
  `onlyBuiltDependencies` in `pnpm-workspace.yaml`.

## Testing

Jest, with a per-workspace config because the environments genuinely differ.
**Where a test file lives decides whether it runs at all.**

| Workspace         | Environment        | Tests live                                   |
| ----------------- | ------------------ | -------------------------------------------- |
| `packages/types`  | node, `@swc/jest`  | beside the code they cover (`roots: src`)    |
| `apps/medusa`     | node, `@swc/jest`  | beside the code they cover (`roots: src`)    |
| `apps/storefront` | jsdom, `next/jest` | in `test/`, mirroring `src/` (`roots: test`) |

A storefront test left under `src/` is silently never run. Test files are named
`*.test.ts`, or `*.test.tsx` when they render JSX.

A test must be able to fail. Write it so you have seen it fail for the right
reason before you make it pass.

Suite: **1073 tests** (types 85, medusa 203, storefront 785). A smaller number
after your change means something was dropped.
