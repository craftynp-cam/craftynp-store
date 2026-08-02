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
  apps, consumed from its built `dist/`. It builds through
  `tsconfig.build.json`, which excludes `*.test.ts` so tests stay out of the
  published `dist/`; `typecheck` still runs against `tsconfig.json` and so still
  covers them. Do not collapse the two back into one config. The build clears
  `dist/` first, because turbo caches `dist/**` and would otherwise restore
  files a later build no longer emits.

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
| Services up/down | `pnpm run services:up` / `pnpm run services:down` |

Run lint, typecheck, tests, and the build before opening a pull request. On a
clone that has never been built, run `pnpm run build` before `pnpm run
typecheck` — `next-env.d.ts` is build-generated.

`pnpm run build` requires `apps/storefront/.env.local`; the `.env.example`
placeholders are enough, so CI can `cp apps/storefront/.env.example
apps/storefront/.env.local` first. It needs no backend, database, or Redis —
the storefront's fetch helpers degrade and Medusa's build falls back to a fake
Redis.

`db:migrate` runs the seed scripts as well as the migrations, and it needs a
fully filled `apps/medusa/.env` — read
[apps/medusa/AGENTS.md](apps/medusa/AGENTS.md) before running it. There is no
`db:seed`; it seeded Medusa starter demo data and was removed in CNP-79.

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

`feature/* → dev → main`, one direction only. Branch from an up-to-date `dev`;
pull requests target `dev`. Prefixes: `feature/`, `fix/`, `chore/`.

- **Feature PRs into `dev` must be squash-merged.**
- **Promotion PRs (`dev → main`) must use a merge commit.** Squashing rewrites
  the commit SHAs and permanently diverges the branches, producing phantom
  conflicts on every later promotion.
- Never merge a feature branch straight into `main`, and never merge backwards —
  except a `main` hotfix, which is merged down into `dev`.
- `dev` and `main` are never deleted or force-pushed. GitHub rulesets enforce
  this with no bypass actors, repository admins included.

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

### What earns a test

**Test the code, not the library underneath it.** A test earns its place when
the code under test does something of its own — composes, transforms, maps,
branches — or guards a documented invariant, money, a security boundary, or an
error path. It does not when the code just forwards a prop into a dependency
that does the work.

Do not add these, and remove them when you find them:

- **Library behaviour.** A wrapper that spreads `...rest` into HeroUI or React
  Aria and then asserts the outcome is testing React Aria. Assert only what the
  wrapper itself adds: its composition, its mapping, its conditional rendering.
- **Class names and styles.** `toHaveClass("bg-ink")` pins no behaviour and
  breaks on any restyle.
- **Static prop-to-DOM rendering.** "renders the heading", "renders its
  children", "renders the body copy".
- **Tautologies.** Asserting a constant equals its own literal, or walking the
  same registry the implementation walks. An assertion derived from the code
  under test cannot disagree with it.
- **The absence of a feature.** "renders no links here" passes trivially now and
  fails the day someone adds one on purpose.
- **Duplicates.** The same behaviour already asserted at an equal or better
  level elsewhere.

Three things resemble that list and are not it:

- A happy-path case acting as the negative control for a set of rejection cases.
  Drop it and a validator that always throws still passes every sibling.
- Accessibility guarantees, which the storefront tests on purpose — the
  `src/components/ui` wrappers' aria wiring, and the class assertion in
  `skip-link.test.tsx`, because jsdom applies no CSS and a link that reveals
  itself on focus cannot be checked any other way.
- The design-token, focus-ring and contrast guards, which pin token values and
  utility names deliberately and are named as load-bearing in
  [apps/storefront/AGENTS.md](apps/storefront/AGENTS.md).

**A green suite is not evidence the app builds.** Both apps point
`@craftynp/types` at its `src/` under Jest, so nothing in the suite exercises
the `dist/` the build actually resolves — that gap hid a crash-on-render bug
through a fully green suite. Run `pnpm run build` as well.
