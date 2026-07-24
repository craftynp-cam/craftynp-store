# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read
this too — everything here applies to both.

## Project overview

<!-- TODO: fill in. What this store is, who it serves, what it sells. -->

**Stack:** <!-- TODO: framework, language, package manager, database -->

**Key directories:** <!-- TODO: fill in once the app is scaffolded -->

## Setup

<!-- TODO: install steps, required tooling versions -->

```bash
# TODO: install
# TODO: run dev server
```

## Environment

<!-- TODO: required env vars and where to get them. Never commit real secrets;
     document the variable names and point at the secret store. -->

## Commands

<!-- TODO: fill in as the project takes shape. -->

| Task | Command |
| --- | --- |
| Install | `TODO` |
| Dev server | `TODO` |
| Build | `TODO` |
| Test | `TODO` |
| Lint | `TODO` |
| Typecheck | `TODO` |
| DB migrate | `TODO` |

Run lint, typecheck, and tests before opening a pull request.

## Branching strategy

Work flows in one direction only:

```
feature/* ──▶ dev ──▶ qa ──▶ main
```

| Branch | Purpose | Deployed to |
| --- | --- | --- |
| `main` | Production. Always releasable. | <!-- TODO --> |
| `qa` | Release candidate under test. | <!-- TODO --> |
| `dev` | Integration branch. Default branch and PR target. | <!-- TODO --> |
| `feature/*` | Short-lived work branches. | — |

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

| Ruleset | Branches | Rules | Bypass |
| --- | --- | --- | --- |
| `branch-integrity` | `dev`, `qa`, `main` | no deletion, no force-push | none |
| `protected-branches` | `dev` | PR required; **squash only** | repo admin |
| `promotion-branches` | `qa`, `main` | PR required; **merge commit only** | repo admin |

Pull requests require zero approvals, so a solo maintainer can self-merge.
Repository admins can push directly to `dev`, `qa`, and `main`, but should use
pull requests as the normal path — the bypass exists for emergencies, not for
routine work. Nobody, admin included, can delete or force-push the three
permanent branches.

## Conventions

### Commits

<!-- TODO: confirm or replace. Conventional Commits assumed for now. -->

`type(scope): summary` — e.g. `feat(cart): persist line items across sessions`.
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

### Code style

<!-- TODO: formatter, linter config, naming conventions, file layout -->

### Testing

<!-- TODO: framework, where tests live, coverage expectations -->

## Guidance for agents

- Do not commit, push, or open pull requests unless asked.
- Never commit secrets, `.env` files, API keys, or customer data.
- Do not delete or force-push `dev`, `qa`, or `main` — and do not attempt to
  work around the rulesets that prevent it.
- Match the surrounding code's style rather than importing conventions from
  elsewhere.
- When a `TODO` placeholder in this file becomes answerable, fill it in as part
  of the work rather than leaving it stale.
