# Cloud environment

How a Claude Code cloud session — `claude --cloud`, claude.ai/code, the mobile
app, a routine — gets a working checkout of this repo without the first-time
setup in [README.md](../README.md).

A cloud session is a fresh Ubuntu 24.04 VM (4 vCPU, 16 GB RAM, 30 GB disk) with
this repo cloned and Node 20/21/22, pnpm, Docker, Postgres 16 and Redis 7
pre-installed. Nothing from your own machine reaches it — only what is
committed here, plus what the environment itself is configured with.

Two files do the work, and the split between them matters:

| File                             | Runs                                                     | Read from                             |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| `scripts/cloud-setup.sh`         | once per environment, before Claude Code starts          | the environment dialog, pasted by you |
| `scripts/cloud-session-start.sh` | every session start and resume, after Claude Code starts | this repo                             |

The setup script's filesystem is snapshotted and reused, so it holds only disk
state — the pnpm store, the pulled Docker images, the pinned pnpm version. The
snapshot keeps files, never running processes, so anything that has to be
_running_ belongs in the session-start hook or in a prompt.

## One-time configuration

At [claude.ai/code](https://claude.ai/code), select the cloud icon in the row
above the message box, then **Add cloud environment** (or the gear on an
existing one). There is no settings page or direct URL for it.

| Field          | Value                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| Name           | `craftynp-store`                                                           |
| Network access | **Trusted**                                                                |
| Env variables  | none needed                                                                |
| Setup script   | the full contents of [`scripts/cloud-setup.sh`](../scripts/cloud-setup.sh) |

**Trusted** is enough and **None** is not. The default allowlist already covers
the npm registry, Docker Hub, and `fonts.googleapis.com` / `fonts.gstatic.com`,
which `next/font/google` in `apps/storefront/src/app/layout.tsx` fetches at
build time. No custom domain list is required.

Re-paste the setup script whenever `scripts/cloud-setup.sh` changes. Editing
that field is also what rebuilds the cached snapshot; it otherwise rebuilds
itself about every seven days.

Do not put secrets in the environment's variables — anyone who can use the
environment can read them.

## What a session starts with

`scripts/cloud-session-start.sh` runs on every start and resume, and exits
immediately when `CLAUDE_CODE_REMOTE` is not `true`, so it never runs on your
laptop. It leaves the session with:

- `apps/storefront/.env.local`, copied from `.env.example`. `pnpm run build`
  fails without the file and the placeholders are enough for it.
- `apps/medusa/.env`, copied from `.env.example` with `JWT_SECRET`,
  `COOKIE_SECRET`, `MFA_ENCRYPTION_KEY`, `SHIPPING_QUOTE_SECRET`,
  `TAX_QUOTE_SECRET` and `ORDER_ACCESS_SECRET` replaced by generated random
  values. Both files are gitignored.
- `pnpm install --frozen-lockfile`, then `pnpm run build`. The build is not
  optional: turbo's `typecheck` task depends on `^build` — upstream packages
  only — so on a fresh clone the storefront's build-generated `next-env.d.ts`
  and `@craftynp/types`' `dist/` would be missing.

So `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` and `pnpm run build`
all work in a cloud session with no further setup, exactly as CI runs them.

## What is deliberately missing

- **Third-party credentials.** Auth0, Stripe, ShipStation, Resend and Google
  are left blank in the generated `apps/medusa/.env`. A cloud session has no
  business holding them, and nothing in lint, typecheck, test or build needs
  them.
- **Running services.** Postgres, Redis and MinIO are not started. Ask Claude
  to run `pnpm run services:up` if a task genuinely needs them — the images are
  already on disk from the setup script, and the Docker daemon may need
  starting first (`service docker start`). `pnpm run db:migrate` needs those
  services up.
- **The publishable key.** `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` stays at its
  `pk_replace_me` placeholder, because the real one is created by
  `pnpm run db:migrate` against a database the session does not have. The
  storefront's fetch helpers degrade rather than fail, which is what the build
  needs.

## Jira

Cloud sessions do not inherit the OAuth for the `atlassian-mcp-server` entry in
`.mcp.json` — interactive sign-in cannot run on the VM. Use the Atlassian
connector enabled on your claude.ai account instead; connector traffic goes
through Anthropic's servers rather than the session's network, so it works at
any access level. Its tools appear as `mcp__claude_ai_Atlassian_Rovo__*` and
are already scoped in `.claude/settings.json`.
