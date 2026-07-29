# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read
this too — everything here applies to both.

This file covers the repository as a whole: what the project is, how to set it
up, the commands, the branching strategy, and the conventions that hold across
every workspace. **Anything specific to one app lives in that app's own
`AGENTS.md`** — read it as well as this one before working there.

## Guidance for agents

- Read the relevant app's `AGENTS.md` before changing anything under `apps/*`.
- Do not commit, push, or open pull requests unless asked.
- Never commit secrets, `.env` files, API keys, or customer data.
- Do not delete or force-push `dev`, `qa`, or `main` — and do not attempt to
  work around the rulesets that prevent it.
- Match the surrounding code's style rather than importing conventions from
  elsewhere.
- Keep these files true. When your change makes a statement wrong — a command,
  a port, a version, a test count — update it as part of the same change rather
  than leaving it stale. Put repo-wide facts here and app-specific facts in the
  app's own file.
- Keep comments to a minimum. Never add comments for the sake of it. Do not add JSDoc comments throughout the code.
- Make commits at logical checkpoints, do not allow changes to build up.

| Workspace         | Instructions                                           |
| ----------------- | ------------------------------------------------------ |
| `apps/storefront` | [apps/storefront/AGENTS.md](apps/storefront/AGENTS.md) |
| `apps/medusa`     | [apps/medusa/AGENTS.md](apps/medusa/AGENTS.md)         |
| `packages/types`  | covered here                                           |

## Project overview

The storefront and backend for The Crafty NP, a maker of custom and ready-made
crafted goods. Shoppers browse and order from the Next.js storefront; the owner
manages products, discounts, and orders from the Medusa admin dashboard.

**Stack:** Next.js 16 / React 19 storefront, Medusa 2.18 backend (React 18
admin), TypeScript 5.9 strict, Tailwind CSS, Postgres 15 and Redis 7 via Docker,
Jest, pnpm workspaces + Turborepo, Prettier + ESLint flat config.

**Key directories:**

- `apps/storefront` — Next.js 16 App Router storefront on port 8000. Server
  components fetch from Medusa through `@medusajs/js-sdk`.
- `apps/medusa` — Medusa 2.18 backend on port 9000, admin at `/app`. API routes,
  workflows, and migration scripts (including the initial data seed).
- `packages/types` — `@craftynp/types`, the zod schemas and TypeScript types
  shared by both apps. Consumed from its built `dist/`.

The workspace set lives in `pnpm-workspace.yaml` (`apps/*`, `packages/*`), not
in the root `package.json`. That file also carries an `onlyBuiltDependencies`
allowlist: pnpm blocks dependency lifecycle scripts by default, and
`@swc/core`, `esbuild`, `msgpackr-extract`, `protobufjs`, `sharp`, and
`unrs-resolver` each ship native binaries or generated code that only exist
after their postinstall runs. `@medusajs/telemetry` is deliberately excluded —
its postinstall only phones home — which is why a fresh install prints
`Ignored build scripts: @medusajs/telemetry@2.18.0` on purpose. If you add a
dependency whose build is silently skipped, add it to that list.

## Setup

Requires **Node 22** (pinned in `.nvmrc`, enforced by `engines: >=22 <23` plus
`engine-strict=true` in the root `.npmrc`, which pnpm also honours), **pnpm
10+**, and Docker Desktop running. pnpm does not ship with Node — install it
separately (`corepack enable && corepack prepare pnpm@10.33.0 --activate`,
`brew install pnpm`, or `npm install -g pnpm`). nvm is not required — any
version manager, or Homebrew's keg-only `node@22`, works as long as `node -v`
reports v22.

```bash
nvm use          # or: export PATH="$(brew --prefix node@22)/bin:$PATH"
pnpm install      # once, at the repo root — never per app
pnpm run dev      # storefront :8000, Medusa :9000, admin :9000/app
```

`pnpm run dev` only works once first-time setup is done: env files copied,
secrets generated, `pnpm run db:migrate` run, the publishable key it prints
pasted into `apps/storefront/.env.local`, and an admin user created. The full
sequence is in [README.md](README.md) — follow it there rather than improvising.

Note that `dev` is `services:up && turbo dev`, so a Docker failure aborts it
before either app starts, surfacing only a raw Docker error. `docker-compose.yml`
sets no `container_name`, so the containers get project-scoped names
(`craftynp-store-postgres-1`, `craftynp-store-redis-1`) — reach them via
`docker compose logs postgres` / `docker compose exec postgres …`, not by
hardcoded name. See the README's "Known papercuts".

**Always use the root scripts.** `pnpm --filter <package> run <task>` bypasses
Turborepo's `dependsOn: ["^build"]` ordering, and the storefront's tsconfig
aliases `@craftynp/types` to its built `dist/`, so a workspace-scoped call fails
on a clone that has never been built.

## Environment

Copy the examples; the target filenames differ between the apps. The
`.env.example` files are the source of truth for what each variable means —
descriptions live there, not here, and no values ever go in this file.

| App               | Example                        | Copy to                      |
| ----------------- | ------------------------------ | ---------------------------- |
| `apps/medusa`     | `apps/medusa/.env.example`     | `apps/medusa/.env`           |
| `apps/storefront` | `apps/storefront/.env.example` | `apps/storefront/.env.local` |

Which variables each app needs, and the traps in them, are documented in that
app's `AGENTS.md`.

Postgres listens on host port **5433** (not 5432 — an unrelated container owns
5432 on the build machine); Redis on 6379.

## Commands

Run every one of these from the repo root.

| Task             | Command                                           |
| ---------------- | ------------------------------------------------- |
| Install          | `pnpm install`                                    |
| Dev server       | `pnpm run dev`                                    |
| Build            | `pnpm run build`                                  |
| Test             | `pnpm run test`                                   |
| Lint             | `pnpm run lint`                                   |
| Typecheck        | `pnpm run typecheck`                              |
| Format           | `pnpm run format`                                 |
| DB migrate       | `pnpm run db:migrate`                             |
| DB seed          | `pnpm run db:seed`                                |
| Services up/down | `pnpm run services:up` / `pnpm run services:down` |

`db:migrate` and `db:seed` are Medusa's — see
[apps/medusa/AGENTS.md](apps/medusa/AGENTS.md) before running either.

On a clone that has never been built, run `pnpm run build` before
`pnpm run typecheck` — `next-env.d.ts` is build-generated and gitignored.

Run lint, typecheck, and tests before opening a pull request.

## Branching strategy

Work flows in one direction only:

```
feature/* ──▶ dev ──▶ qa ──▶ main
```

| Branch      | Purpose                                           | Deployed to            |
| ----------- | ------------------------------------------------- | ---------------------- |
| `main`      | Production. Always releasable.                    | Production _(planned)_ |
| `qa`        | Release candidate under test.                     | Staging _(planned)_    |
| `dev`       | Integration branch. Default branch and PR target. | -                      |
| `feature/*` | Short-lived work branches.                        | —                      |

Every environment above is **planned, not live.** Nothing is deployed yet. The
intended targets are Vercel for the storefront and Railway for Medusa; CNP-16
and CNP-17 provision them.

### Rules

- **`dev`, `qa`, and `main` are permanent.** They are never deleted and never
  force-pushed. This is enforced by the `branch-integrity` ruleset, which has no
  bypass actors — the restriction applies to repository admins as well.
- **`dev` is the default branch.** New pull requests target it automatically.
- **Never merge a feature branch straight into `qa` or `main`.** Changes reach
  those branches only by promoting the branch below.
- **Never merge backwards** (`main` into `qa`, `qa` into `dev`) except to
  propagate a hotfix — see below.

### Feature work

Branch from an up-to-date `dev`:

```bash
git checkout dev && git pull
git checkout -b feature/short-description
```

Naming: `feature/*` for features, `fix/*` for bug fixes, `chore/*` for tooling
and maintenance. Use short, hyphenated, descriptive names.

Open the pull request against `dev`. **Feature PRs must be squash-merged** —
the `protected-branches` ruleset allows only the squash method into `dev`, so
each feature lands as a single commit and `dev` history stays readable.

### Promotion

Promotions are pull requests like any other, but with one hard constraint:

- `dev` → `qa` when a batch of work is ready for testing.
- `qa` → `main` when QA signs off.
- **Promotion PRs must use a merge commit.** Squash and rebase are rejected by
  the `promotion-branches` ruleset. Squashing would rewrite the commit SHAs and
  permanently diverge the branches, producing phantom conflicts on every later
  promotion.

### Hotfixes

For an urgent production fix, branch from `main` as `fix/*`, PR back into
`main`, then merge `main` down into `qa` and `qa` into `dev` so the fix is not
lost on the next promotion.

### Protection rulesets

Configured on GitHub; listed here so the intent is discoverable from the repo.

| Ruleset              | Branches            | Rules                              | Bypass     |
| -------------------- | ------------------- | ---------------------------------- | ---------- |
| `branch-integrity`   | `dev`, `qa`, `main` | no deletion, no force-push         | none       |
| `protected-branches` | `dev`               | PR required; **squash only**       | repo admin |
| `promotion-branches` | `qa`, `main`        | PR required; **merge commit only** | repo admin |

Pull requests require zero approvals, so a solo maintainer can self-merge.
Repository admins can push directly to `dev`, `qa`, and `main`, but should use
pull requests as the normal path — the bypass exists for emergencies, not for
routine work. Nobody, admin included, can delete or force-push the three
permanent branches.

## Conventions

### Commits

`type(scope): summary` — e.g. `feat(cart): persist line items across sessions`.
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

### Code style

- **Prettier** is configured once at the repo root (`.prettierrc`,
  `.prettierignore`) and formats everything. `pnpm run format:check` must be
  clean; `pnpm run format` fixes it. Do not add per-app Prettier configs.
- **ESLint** uses the flat-config format. The root `eslint.config.mjs` holds the
  shared rules; each app extends it in its own `eslint.config.mjs` (the
  storefront adds `eslint-config-next`). Fix the offending source rather than
  weakening the root config.
- **TypeScript is strict**, including `noUncheckedIndexedAccess`, from
  `tsconfig.base.json`. Generated scaffolding is expected to be brought up to
  that standard, not exempted from it.
- **TypeScript is pinned to `~5.9.3`** in every workspace. The patch-range pin
  keeps all three packages on one compiler — a split version produces
  inconsistent diagnostics and breaks the shared base config.
- **Never add React to the root `package.json`.** Medusa's admin dashboard needs
  React 18 and Next 16 needs React 19; each app declares its own. A root-level
  React would put a single copy on both apps' resolution path and break
  whichever one did not want that major. This is a real trap — it looks like
  harmless deduplication. Likewise, do not add `node-linker=hoisted` or
  `public-hoist-pattern` to `.npmrc`: pnpm's non-hoisting default is what keeps
  the two React majors apart.

### Testing

Per-app specifics — jsdom vs node, config accommodations, where a test may
live — are in each app's `AGENTS.md`. What holds everywhere:

- **Jest**, with a **per-workspace config** rather than one root config, because
  the environments genuinely differ:
  - `packages/types` and `apps/medusa` — node environment, `@swc/jest`
    transform.
  - `apps/storefront` — jsdom, via `next/jest`.
- Test files are named `*.test.ts` — or `*.test.tsx` when the test renders JSX
  — and where they live differs by workspace:
  - `packages/types` and `apps/medusa` keep tests **beside the code they
    cover** (`src/lib/validate-customization.ts` →
    `src/lib/validate-customization.test.ts`). Both configs set
    `roots: ["<rootDir>/src"]`.
  - `apps/storefront` keeps tests in a **separate `test/` tree that mirrors
    `src/`**, and its config sets `roots: ["<rootDir>/test"]`, so a test left
    under `src/` is silently never run.
- A test must be able to fail. Write it so you have seen it fail for the right
  reason before you make it pass; a test that passes against a broken
  implementation is worse than no test.
- Current suite: **546 tests** across the three workspaces (types 32, medusa 22,
  storefront 492). A smaller number after your change means something was
  dropped.
