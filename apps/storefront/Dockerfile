# syntax=docker/dockerfile:1
#
# Built with the REPO ROOT as its context, for the same reasons as
# apps/medusa/Dockerfile. Locally: `docker build -f apps/storefront/Dockerfile .`

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/medusa/package.json apps/medusa/
COPY apps/storefront/package.json apps/storefront/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile

COPY . .

# Next inlines NEXT_PUBLIC_* into the bundle at build time, and next.config.ts
# reads the backend, media and artwork upload URLs to allow image hosts and to
# write the Content-Security-Policy. Railway only passes a service variable into
# the build when an ARG names it; miss one and the build stays green while the
# value is silently undefined in production. NEXT_PUBLIC_SITE_URL is the
# exception: the build fails without it.
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDIA_BASE_URL
ARG NEXT_PUBLIC_ARTWORK_UPLOAD_ORIGIN
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_DEFAULT_REGION
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL \
    NEXT_PUBLIC_ARTWORK_UPLOAD_ORIGIN=$NEXT_PUBLIC_ARTWORK_UPLOAD_ORIGIN \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

RUN pnpm exec turbo run build --filter=apps-storefront...

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app/apps/storefront

COPY --from=build /app /app

EXPOSE 8000

# PORT is supplied by the platform, and `next start` reads it.
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
