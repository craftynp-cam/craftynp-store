# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read
this too — everything here applies to both.

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

- **`apps/medusa/.env`:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
  `COOKIE_SECRET`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`,
  `MEDUSA_BACKEND_URL`. `JWT_SECRET` and `COOKIE_SECRET` ship as `replace-me-…`
  placeholders and must be regenerated (`openssl rand -base64 32`).
- **`apps/storefront/.env.local`:** `NEXT_PUBLIC_MEDUSA_BACKEND_URL`,
  `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_DEFAULT_REGION`. The
  publishable key does not exist until `pnpm run db:migrate` has run — the seed
  is a migration script and prints the `pk_…` value in that command's output.

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

`db:seed` is **only** for re-seeding a database you have deliberately reset.
`db:migrate` already runs the seed (it is a migration script) and the ledger
stops it repeating; `db:seed` runs it outside the ledger, minting a second
publishable key and duplicating products.

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

### Design tokens

The brand palette, type scale, spacing scale, and radii are declared once, in
`apps/storefront/src/app/globals.css`, in three layers:

1. `@theme` — the seven fixed brand colours and the type/spacing/radius scales.
2. `@theme inline` — semantic aliases, each pointing at a `--t-*` variable.
3. `:root` — both modes of each `--t-*` variable, on one line, via
   `light-dark()`.

**Components use the generated utilities — `bg-surface`,
`text-foreground-muted`, `rounded-lg`, `font-display` — and never a raw hex
value.** Prefer the semantic aliases (`background`, `surface`, `foreground`,
`primary`, `danger`) over the raw brand names: they carry intent, and they are
the only colours that follow the active mode.

The `inline` on the second layer is load-bearing. It emits `var(--t-*)` into
each utility, so the utility tracks the mode. A plain `@theme` would freeze
every utility at its light value.

**Both modes come from the same seven colours.** Light composites ink navy over
off-white; dark composites off-white over ink navy. Do not introduce a hue that
exists in only one mode, and do not introduce a new grey — greys are the two
extremes composited at reduced opacity. Muted black is unused in dark mode on
purpose: it sits within 1.1:1 of ink navy, so as a layer it would be invisible.

Raw alert red is not legible enough for text in either mode (3.5:1 on the light
blush surface, 3.8:1 on the dark page). Use `danger-foreground` for error text
and `danger` only as a surface.

`src/lib/design-tokens.ts` mirrors those values so the reference page at
**`/design`** can render and measure every token in both modes;
`design-tokens.test.ts` fails if the mirror and the CSS drift, and asserts that
every text-bearing pairing clears WCAG AA at 4.5:1 on every surface of its
mode. Pairings below that threshold must be marked `decorative` with a note
explaining why. Change a token in both files, or the suite will tell you.

**The modes hang off `color-scheme`, not a media query.** `light-dark()` reads
the used `color-scheme`, so `:root` declares `color-scheme: light dark` (follow
the OS) and `:root[data-theme="light"|"dark"]` pins it. One attribute therefore
switches the tokens _and_ the native form controls, scrollbars, and caret. Do
not reintroduce a `prefers-color-scheme` block — a test asserts its absence,
because a second mechanism would have to be kept in sync with this one.

`ThemeToggle` (`src/components/ui/theme-toggle.tsx`) writes that attribute and
persists to `localStorage`. Two things about it are load-bearing:

- It reads the stored value through `useSyncExternalStore`, not `useState` in
  an effect — the React 19 lint rule rejects the latter, and the store form
  also keeps other tabs in step via the `storage` event.
- `themeInitScript` runs as a **blocking inline script in `<head>`**, set in
  `layout.tsx`. Without it a reader who pinned a mode gets a flash of the OS
  mode before hydration. Do not move it into a component or defer it. Because
  it writes `data-theme` to `<html>` before React hydrates, that element must
  keep `suppressHydrationWarning` — otherwise every page logs a hydration
  error. The suppression is scoped to `<html>`'s own attributes and does not
  reach any child.

The toggle currently only appears on `/design`. Putting it in the global header
is a matter of rendering it there — the layout wiring is already done.

### HeroUI

The shared primitives in `apps/storefront/src/components/ui` — button, text
input, textarea, select, checkbox, radio group, badge — are thin wrappers over
**HeroUI v3**, which is built on React Aria Components. Use them rather than
reaching for HeroUI directly; they translate brand vocabulary into HeroUI's and
are where the accessibility guarantees are tested.

### Component imports

`src/components/index.ts` is the barrel: it re-exports everything under
`src/components/ui`, so the whole component surface is one import object.

- **From outside the components directory** — pages, tests, anywhere — import
  from `@/components`: `import { Button, ThemeToggle } from "@/components";`.
  Do not reach past the barrel to a file path like
  `@/components/ui/button`.
- **From inside the components directory**, import from `"."`, which resolves
  to the nearest barrel: `import type { FieldProps } from ".";` in
  `ui/textarea.tsx`. Do not use sibling paths like `"./text-input"`.

When you add a component, export it from `src/components/ui/index.ts` in the
same call — an unexported file is unreachable through the barrel and will fail
to import from anywhere else.

**HeroUI's component CSS is plain BEM** (`.button`, `.button--primary`), not
generated utilities, so Tailwind does not need to `@source`-scan
`node_modules`. `globals.css` bridges HeroUI's variables to the `--t-*` tokens
and that is the whole integration.

**HeroUI reads its colours two different ways, and this matters.** Some
components take the bare variable — `button.css` is `--button-bg:
var(--accent)` — while others take the Tailwind utility, as `radio.css` does
with `@apply bg-accent`. The utility resolves through `--color-accent`, which
our own `@theme inline` block also defines. **The bare variable and our
`--color-*` alias of the same name must therefore agree**, or one component
disagrees with another: bridging `--accent` to `--t-primary` while `bg-accent`
stayed gold produced a navy button beside a gold radio in the same form. It is
not enough to reason about this from the bare variables alone — check the
rendered page.

**So `accent` is gold on both sides**, and HeroUI's primary action is gold on
ink navy, a pairing `design-tokens.test.ts` already holds to AA. The palette's
`primary` (ink navy) still backs `bg-primary` and the focus ring.

**The bridge is what keeps `system` mode working.** HeroUI's own theme has only
two states, keyed off `.light`/`.dark`/`[data-theme]`, with no OS-following
equivalent; left alone it paints light components on a dark page for a dark-OS
reader who has not pinned a mode. Because every `--t-*` is a `light-dark()`,
HeroUI's variables inherit `color-scheme` for free. The bridge block is
**unlayered on purpose** — HeroUI declares its values inside a nested cascade
layer, and unlayered declarations beat every layered one.

**The focus ring is `primary`, not gold.** Gold is the brand's attention colour
and the obvious choice, and it fails: 1.36–1.84:1 against the light-mode
surfaces, well under the 3:1 WCAG 1.4.11 requires. `focus-ring.test.ts` holds
the ring to 3:1 on every surface of both modes and records why gold is
rejected.

**`pnpm-workspace.yaml` declares `@types/react` as a peer** of HeroUI and the
React Aria packages. They declare `react` but not its types, so pnpm links no
type package into their subgraphs and their `.d.ts` files resolve `react` by
walking up to pnpm's private hoist directory — which holds **18**, because the
Medusa admin needs it. HeroUI's props then type against React 18 while the
storefront is on 19, and anything crossing the boundary fails to typecheck. Do
not solve this by hoisting (it removes the types entirely) or by adding
`@types/react` to the root `package.json` (it makes React 19's types ambient
for `apps/medusa`, which runs React 18).

### Testing

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
    `src/`** — a test sits in the same-named parent directory as its
    production counterpart (`src/components/ui/button.tsx` →
    `test/components/button.test.tsx`, `src/lib/medusa.ts` →
    `test/lib/medusa.test.ts`). Its config sets `roots: ["<rootDir>/test"]`,
    so a test left under `src/` is silently never run.

  In the storefront, import the code under test through the `@/` alias
  (`@/lib/contrast`, `@/components`) — a relative path out of `test/` will not
  resolve. Tests that read source files off disk (`design-tokens.test.ts`,
  `focus-ring.test.ts`) must reach back two levels and into `src` from
  `__dirname`, not one.

  Note that `pnpm run lint` runs `eslint src` in the storefront, so the
  `test/` tree is typechecked but not linted.

- A test must be able to fail. Write it so you have seen it fail for the right
  reason before you make it pass; a test that passes against a broken
  implementation is worse than no test.
- **Component rendering works.** `@testing-library/react` (v16, React
  19-compatible) and `@testing-library/jest-dom` are storefront devDependencies,
  and `apps/storefront/jest.setup.ts` imports the jest-dom matchers above the
  Streams/`TextEncoder` polyfills that `@medusajs/js-sdk` needs — leave those
  polyfills in place. `test/components/product-list-item.test.tsx` is the worked
  example.

  This was previously blocked: under npm, React 18 hoisted to the root
  `node_modules` while the storefront's React 19 stayed nested, so a
  root-hoisted RTL rendered React 19 elements through React 18's reconciler and
  failed with "Objects are not valid as a React child". pnpm does not hoist —
  each app resolves its own React through its own `node_modules` symlink — so
  the collision is now structurally impossible. Do not add
  `node-linker=hoisted` or `public-hoist-pattern`; both would reintroduce it.

- **Do not try to render `src/app/page.tsx`.** It is an async server component
  that fetches from a live backend; RTL cannot render it. Cover it with
  HTTP-level checks against the running app instead.
- **The storefront's Jest config carries three HeroUI accommodations**
  (`apps/storefront/jest.config.mjs`). Each is load-bearing; removing any one
  makes every test that imports a primitive fail to run.
  - `moduleNameMapper` maps `@heroui/react/*` onto the package's `dist/` files.
    HeroUI's exports map offers only `import` and `types` conditions, so Jest's
    CommonJS resolver finds no candidate at all.
  - `transformIgnorePatterns` is reduced to CSS modules, so `node_modules` gets
    transformed. HeroUI and the React Aria packages under it ship untranspiled
    ESM. An allowlist was tried first and does not hold — the transitive tail
    keeps growing.
  - `customExportConditions` is deliberately **not** set to include `import`.
    It applies to every package, so any dependency listing `import` before
    `require` (dedent, via tailwind-variants) resolves to an `.mjs` that Jest
    classifies as native ESM and then cannot load.
- Current suite: **202 tests** across the three workspaces (types 17, medusa 9,
  storefront 176). A smaller number after your change means something was
  dropped.

## Guidance for agents

- Do not commit, push, or open pull requests unless asked.
- Never commit secrets, `.env` files, API keys, or customer data.
- Do not delete or force-push `dev`, `qa`, or `main` — and do not attempt to
  work around the rulesets that prevent it.
- Match the surrounding code's style rather than importing conventions from
  elsewhere.
- Keep this file true. When your change makes a statement here wrong — a command,
  a port, a version, a test count — update it as part of the same change rather
  than leaving it stale.
- Keep comments to a minimum. Never add comments for the sake of it. Do not add JSDoc comments throughout the code.
