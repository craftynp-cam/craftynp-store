#!/usr/bin/env bash
# SessionStart hook for Claude Code cloud sessions. Wired up in
# .claude/settings.json.
#
# Unlike scripts/cloud-setup.sh this file IS read from the repo, and it runs on
# every cloud session start and resume — so it does the per-session work the
# environment snapshot cannot keep: the gitignored env files, the install, and
# the build that `typecheck` depends on.
#
# It exits immediately outside a cloud session. CLAUDE_CODE_REMOTE is set to
# "true" only on the session VM, so a local `claude` never runs any of this.

set -u

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

secret() { openssl rand -base64 32; }

# `pnpm run build` fails without this file, and CI proves the .env.example
# placeholders are enough — it needs no backend, database or Redis.
if [ ! -f apps/storefront/.env.local ]; then
  cp apps/storefront/.env.example apps/storefront/.env.local
fi

# Medusa's own build does not need this, but `db:migrate` and `medusa develop`
# do, and a session that wants a running backend should not have to hand-write
# it. Every placeholder secret is replaced with a real random one so nothing
# ships the literal from .env.example; the third-party keys (Auth0, Stripe,
# ShipStation, Resend, Google) stay blank, because a cloud session has no
# business holding them.
if [ ! -f apps/medusa/.env ]; then
  cp apps/medusa/.env.example apps/medusa/.env
  while IFS= read -r key; do
    # Not `sed -i`: its in-place flag takes an argument on BSD and none on GNU,
    # and this script is edited on macOS but runs on Ubuntu.
    sed "s|^${key}=.*|${key}=$(secret)|" apps/medusa/.env > apps/medusa/.env.tmp \
      && mv apps/medusa/.env.tmp apps/medusa/.env
  done <<'KEYS'
JWT_SECRET
COOKIE_SECRET
MFA_ENCRYPTION_KEY
SHIPPING_QUOTE_SECRET
TAX_QUOTE_SECRET
ORDER_ACCESS_SECRET
KEYS
fi

corepack prepare pnpm@10.33.0 --activate >/dev/null 2>&1 || true

pnpm install --frozen-lockfile || exit 0

# Build before anything else runs. turbo's typecheck task depends on ^build —
# upstream packages only — so the storefront's build-generated next-env.d.ts
# and @craftynp/types' dist/ would otherwise be missing on this fresh clone.
# Turbo's cache makes this cheap on a resume.
pnpm run build || true

exit 0
