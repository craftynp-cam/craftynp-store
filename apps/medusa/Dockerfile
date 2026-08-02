# syntax=docker/dockerfile:1
#
# Built with the REPO ROOT as its context, not apps/medusa — the build has to go
# through Turborepo from the root so `^build` ordering builds packages/types
# first. Locally: `docker build -f apps/medusa/Dockerfile .`
#
# Debian slim rather than alpine: sharp and the admin bundler are built against
# glibc, and musl builds of them are a recurring source of failures that only
# appear at runtime.

FROM node:22-bookworm-slim AS build

# NODE_ENV must NOT be production here, or pnpm install skips devDependencies
# and `medusa build` — which needs the admin bundler and tsc — cannot run.
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH CI=true
RUN corepack enable

WORKDIR /app

# Manifests first so a source-only change reuses the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/medusa/package.json apps/medusa/
COPY apps/storefront/package.json apps/storefront/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# Never `pnpm --filter <pkg> run build` — it bypasses ^build ordering and the
# medusa build would compile against a packages/types that has no dist/ yet.
RUN pnpm exec turbo run build --filter=apps-medusa...

# `medusa build` copies apps/medusa/package.json into .medusa/server, where its
# `"@craftynp/types": "workspace:*"` cannot be installed: there is no lockfile
# and no workspace root beside it, so the `cd .medusa/server && install` step
# from Medusa's own deployment docs cannot work here. Link the workspace's
# node_modules in instead. pnpm's internal links are relative to their real
# path, so they still resolve through the symlink.
RUN ln -s ../../node_modules /app/apps/medusa/.medusa/server/node_modules

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

# medusa start must run from the built output: it resolves medusa-config and the
# admin's index.html relative to the working directory.
WORKDIR /app/apps/medusa/.medusa/server

COPY --from=build /app /app

# No `pnpm prune --prod`: it strips the admin bundler, which some medusa start
# paths still touch.

EXPOSE 9000

# Invoked through node rather than `pnpm exec`, deliberately. corepack is not
# installed in this stage, so pnpm would be downloaded from the registry on
# every container start — a network dependency and a delay on the boot path of
# a production service, for a package manager nothing here needs at runtime.
#
# The CLI's own entry point, not node_modules/.bin/medusa: that is a shell
# wrapper, and node cannot execute it ("SyntaxError: missing ) after argument
# list").
#
# -H 0.0.0.0 is required; the default bind is not reachable from the platform's
# proxy. PORT is supplied by the platform.
CMD ["node", "../../node_modules/@medusajs/cli/cli.js", "start", "-H", "0.0.0.0"]
