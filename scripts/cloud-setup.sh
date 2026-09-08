#!/usr/bin/env bash
# Setup script for a Claude Code cloud environment.
#
# This file is the source of truth; the cloud environment does NOT read it from
# the repo. Paste its contents into the "Setup script" field of the environment
# dialog at claude.ai/code (the cloud icon above the message box), and re-paste
# it whenever this file changes — editing the field is also what rebuilds the
# environment's cached snapshot.
#
# It runs as root on Ubuntu 24.04 once per environment, before Claude Code
# launches, and its filesystem is snapshotted and reused by later sessions. So
# everything here is disk state: the pnpm store, Docker images, toolchain
# pins. Anything that only runs — a daemon, a database, a compose stack — is
# lost with the snapshot and belongs in cloud-session-start.sh instead.
#
# Two constraints, both from the docs: it must exit zero or the session fails
# to start, and it must finish inside roughly five minutes or the snapshot is
# never built. Hence `|| true` on everything optional.

set -u

# Node 22 is already on PATH in the cloud image and matches .nvmrc. Corepack
# pins pnpm to the exact packageManager version in package.json, so the cloud
# resolves the lockfile the same way CI does.
corepack enable || true
corepack prepare pnpm@10.33.0 --activate || true

# The clone is at /workspace/<repo> in a cloud session, but that path is not
# contractual — find it rather than hardcode it.
REPO="$(find /workspace /home -maxdepth 3 -name pnpm-workspace.yaml -printf '%h\n' 2>/dev/null | head -1)"

if [ -n "$REPO" ]; then
  # Warms the pnpm content-addressable store into the snapshot. The per-session
  # `pnpm install` in cloud-session-start.sh then links from disk instead of
  # refetching every package.
  (cd "$REPO" && pnpm install --frozen-lockfile) || true
fi

# Docker is installed but the daemon is not running. Start it only to pre-pull
# the compose images into the snapshot; the daemon itself does not survive.
if ! docker info >/dev/null 2>&1; then
  (service docker start || dockerd >/tmp/dockerd.log 2>&1 &) || true
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi

if [ -n "$REPO" ] && docker info >/dev/null 2>&1; then
  # Reads docker-compose.yml rather than naming tags here, so the image
  # versions cannot drift out of step with the compose file.
  (cd "$REPO" && docker compose --profile init pull) || true
fi

exit 0
