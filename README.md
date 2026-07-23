# craftynp-store

<!-- TODO: one-line description of the store. -->

<!-- TODO: longer overview — what it does, who it's for, current status. -->

## Status

Early setup. Repository scaffolding and branching strategy are in place; the
application itself is not yet scaffolded.

## Stack

<!-- TODO: framework, language, database, hosting, payment provider -->

## Getting started

### Prerequisites

<!-- TODO: runtime versions, package manager, database, any accounts needed -->

### Installation

```bash
git clone git@github.com:craftynp-cam/craftynp-store.git
cd craftynp-store
# TODO: install dependencies
```

### Configuration

<!-- TODO: copy .env.example to .env and describe required variables -->

### Running locally

```bash
# TODO: dev server command
```

## Project structure

<!-- TODO: annotated tree of the main directories -->

## Scripts

<!-- TODO: table of package scripts / make targets -->

## Deployment

<!-- TODO: how each branch maps to an environment and how deploys are triggered -->

## Contributing

Work flows in one direction: `feature/*` → `dev` → `qa` → `main`.

- Branch from `dev` (the default branch) using `feature/*`, `fix/*`, or `chore/*`.
- Open your pull request against `dev`. Squash merges are fine here.
- Promote `dev` → `qa` for testing, then `qa` → `main` for release. **Promotion
  pull requests must use a merge commit** — squash and rebase are blocked, because
  rewriting SHAs would permanently diverge the branches.
- `dev`, `qa`, and `main` are permanent: they cannot be deleted or force-pushed
  by anyone, including admins.

Full details, including the GitHub rulesets that enforce this, are in
[AGENTS.md](AGENTS.md).

## License

<!-- TODO: choose a license, or state that this is private/proprietary. -->
