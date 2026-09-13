# DNS and infrastructure

A record of what is configured in Cloudflare and Railway, as of the
CNP-16/17/18/73 provisioning, plus the artwork bucket added in CNP-20 and the
storefront's move from Vercel to Railway in CNP-81.

**This is a snapshot, not a source of truth.** The systems below are the
authority; nothing here is applied by any code in this repo. It is written down
because the reasoning is expensive to rediscover and some of it is
counter-intuitive. The same framing as the Auth0 and Stripe Tax state described
in [apps/medusa/AGENTS.md](../apps/medusa/AGENTS.md).

**A dashboard change without a matching change here is the failure mode.** If
you change any of it, change this file in the same pull request.

The _reasoning_ for the two-zone split lives in
[README.md](../README.md#the-two-zones-are-split-on-purpose) and is not repeated
here.

## What serves what

| Hostname                 | Serves                      | Behind    |
| ------------------------ | --------------------------- | --------- |
| `thecraftynp.org`        | storefront                  | Railway   |
| `www.thecraftynp.org`    | 308 redirect to the apex    | —         |
| `api.thecraftynp.com`    | Medusa API and `/app` admin | Railway   |
| `media.thecraftynp.com`  | uploaded imagery            | R2 bucket |
| `thecraftynp.com`, `www` | 301 redirect to `.org`      | —         |

There are no preview or staging hostnames. `dev.thecraftynp.org` was deleted in
CNP-81 along with Vercel preview deployments; see [Vercel](#vercel).

## thecraftynp.org

Zone `8a3677ddd6ac55ed3aeec8b8cca67d5d`.

| Type  | Name                | Content                   | Proxy | Purpose                                |
| ----- | ------------------- | ------------------------- | ----- | -------------------------------------- |
| CNAME | `@`                 | `goo7hsic.up.railway.app` | on    | Railway `storefront`; flattened        |
| A     | `www`               | `192.0.2.1`               | on    | **placeholder** — redirect rule host   |
| TXT   | `_railway-verify`   | `railway-verify=…`        | —     | Railway domain ownership               |
| MX    | `@`                 | Google Workspace (×5)     | —     | **do not delete** — the client's mail  |
| MX    | `send`              | `feedback-smtp…ses`       | —     | Resend bounce handling                 |
| TXT   | `@`                 | SPF, site verification    | —     | **do not delete**                      |
| TXT   | `_dmarc`            | DMARC                     | —     | **do not delete**                      |
| TXT   | `google._domainkey` | DKIM                      | —     | **do not delete** — Workspace mail     |
| TXT   | `resend._domainkey` | DKIM                      | —     | **do not delete** — transactional mail |
| TXT   | `send`              | SPF for Resend            | —     | **do not delete**                      |

`.org` carries the client's Google Workspace mail as well as Resend's signing
records. It is not a storefront-only zone.

## thecraftynp.com

Zone `4a7f1f4a797230ceb53e8006585a7448`.

| Type  | Name                   | Content                   | Proxy | Purpose                       |
| ----- | ---------------------- | ------------------------- | ----- | ----------------------------- |
| CNAME | `api`                  | `o3qdyz3z.up.railway.app` | on    | Medusa                        |
| CNAME | `media`                | `public.r2.dev`           | on    | R2 bucket `craftynp-media`    |
| A     | `@`                    | `192.0.2.1`               | on    | **placeholder** — see below   |
| A     | `www`                  | `192.0.2.1`               | on    | **placeholder** — see below   |
| TXT   | `_railway-verify.api`  | `railway-verify=…`        | —     | Railway domain ownership      |
| MX    | `@`                    | businessidentity.llc      | —     | **do not delete** — live mail |
| TXT   | `@`                    | SPF                       | —     | **do not delete**             |
| TXT   | `_dmarc`               | DMARC                     | —     | **do not delete**             |
| TXT   | `_acme-challenge` (×2) | ACME                      | —     | **do not delete**             |

`192.0.2.1` is the RFC 5737 documentation address and is never connected to. The
two records exist only so the redirect rule has a proxied hostname to attach to;
Cloudflare answers before anything reaches an origin. A wildcard cannot replace
them because wildcards do not match the zone apex.

**This zone carries live mail for businessidentity.llc.** Deleting it, or moving
its nameservers, takes that mail with it.

## Zone settings

| Setting          | `.org`        | `.com`               |
| ---------------- | ------------- | -------------------- |
| SSL/TLS          | Full (strict) | Full (strict)        |
| Always Use HTTPS | on            | on                   |
| Bot Fight Mode   | **on**        | **off — deliberate** |

Bot Fight Mode being off on `.com` is load-bearing, not an oversight. See the
README. Turning it on challenges the Stripe and ShipStation webhooks and the
storefront's server-side fetches, all of which fail silently.

## Rules

### `.com` → `.org` redirect

Dynamic redirect, ruleset `ad0185ba447949a280393b65d5762d1d`.

```
(http.host eq "thecraftynp.com") or (http.host eq "www.thecraftynp.com")
→ concat("https://thecraftynp.org", http.request.uri.path)   301, preserve query string
```

It shipped as a `302` and was only flipped to `301` once `.org` genuinely
served the storefront — a `301` is cached hard, so publishing one at a dead
target durably teaches browsers and crawlers that `.com` is broken.

### `www` → apex redirect

Dynamic redirect on the `.org` zone, ruleset `55836377348741308f4dac9c42dfccda`.

```
(http.host eq "www.thecraftynp.org")
→ concat("https://thecraftynp.org", http.request.uri.path)   308, preserve query string
```

Vercel issued this redirect until CNP-81, and `308` matches what it sent. The
`www` record is the same `192.0.2.1` placeholder as on `.com`, there only so the
rule has a proxied hostname to run on. The rule was created while `www` still
pointed at Vercel, and the record swapped afterwards, so there was no window
without a redirect.

### API rate limiting

On the `http_ratelimit` phase of the `.com` zone.

```
(http.host eq "api.thecraftynp.com") and
((http.request.uri.path in {"/store/tax-quote" "/store/shipping-rates" "/store/price-quote"})
 or (starts_with(http.request.uri.path, "/store/checkout/"))
 or (starts_with(http.request.uri.path, "/store/artwork/")))
```

10 requests per 10 seconds, block for 10 seconds, characteristics `ip.src` and
`cf.colo.id`. `/store/price-quote` and `/store/artwork/*` joined the rule in
CNP-89. It was checked by sending POSTs to `/store/price-quote` one after
another: the eleventh inside ten seconds got Cloudflare's `429`
(`error code: 1015`) instead of the app's own reply.

**This is not quite what the README describes, and the difference is the Free
plan, not a choice.** It asks for 60 requests per minute blocking for one
minute. On this plan:

- the only permitted period is **10 seconds**, so the rate is expressed as 10
  per 10s — the same average, stricter on bursts;
- the only permitted mitigation timeout is **10 seconds**, not 60;
- `cf.colo.id` is a **required** characteristic, so counting is per-datacenter
  rather than global. A single client normally reaches one datacenter, but the
  ceiling is not the global one the README implies;
- only **one** rate-limiting rule is permitted, so every path above shares one
  counter per client. A shopper's price quotes, artwork uploads and checkout
  calls all count against the same 10 per 10 s. Price quotes are debounced in
  the storefront, so an ordinary session stays well inside it, and the app's
  per-route `RATE_LIMIT_*` ceilings stay the finer-grained second line.

Upgrading the plan is what closes those four gaps.

### Origin secret

Transform rule, `http_request_late_transform`, on the `.com` zone.

```
(http.host eq "api.thecraftynp.com")
→ set request header  x-cnp-origin-secret = <ORIGIN_SHARED_SECRET>
```

**Set, not add.** Setting overwrites any client-supplied copy, which is the
entire security property — the same reason the rate limiter trusts
`cf-connecting-ip`. The value must equal `ORIGIN_SHARED_SECRET` on both Railway
services; `src/lib/origin-guard.ts` compares them in constant time.

To check the two match without revealing either, compare SHA-256 digests rather
than the values.

## Railway

Project `craftynp-store`, environment `production`.

| Service         | Role                                         |
| --------------- | -------------------------------------------- |
| `medusa-server` | HTTP, admin, runs `db:migrate` at pre-deploy |
| `medusa-worker` | jobs and subscribers, no admin               |
| `storefront`    | Next.js storefront, `thecraftynp.org`        |
| `Postgres`      | private network only                         |
| `Redis`         | private network only                         |

Postgres and Redis have **no TCP proxy**, so they are unreachable from outside
the project. Both Medusa services reach them by reference variable
(`${{Postgres.DATABASE_URL}}`), never a copied literal.

`PORT` is set explicitly on every HTTP service: `9000` on the Medusa services,
`8000` on the storefront. Left unset the platform injects `8080`, which silently
disagrees with each Dockerfile's `EXPOSE` and with every port reference in this
repo.

`STORE_CORS` and `AUTH_CORS` on both Medusa services are `https://thecraftynp.org`
and nothing else, since there are no preview origins to admit.

### `storefront`

| Setting         | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Source          | `craftynp-cam/craftynp-store`, branch `main`               |
| Dockerfile path | `apps/storefront/Dockerfile`                               |
| Healthcheck     | `/`, default 300 s timeout                                 |
| Restart policy  | `ON_FAILURE`                                               |
| Watch paths     | `apps/storefront/**`, `packages/types/**`, root manifests  |
| Domains         | custom `thecraftynp.org` only — no Railway-provided domain |

The watch paths in full are `apps/storefront/**`, `packages/types/**`,
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `turbo.json`,
`tsconfig.base.json` and `.dockerignore`. They are what stops a Medusa-only
change rebuilding the storefront, which `turbo-ignore` did on Vercel.

**These are service settings, not a `railway.json`.** Railway has deprecated
Config as Code and does not let a new service adopt it; its replacement,
Infrastructure as Code, refuses to manage a project while any service still uses
a config file. `railway.server.json` and `railway.worker.json` stop being read on
**2026-12-01**, so the project needs moving to Infrastructure as Code before
then.

- **Every `NEXT_PUBLIC_*` variable is compiled into the build.** Changing one
  needs a rebuild, not a restart. A variable saved with deploys skipped is not
  built until the next deployment — and switching the service onto a branch
  whose head is identical to what is already deployed produces a `SKIPPED`
  deployment, not a build. `railway redeploy -s storefront` forces one.
- `DESIGN_ALLOWED_DOMAIN` is the reference `${{medusa-server.GOOGLE_ADMIN_ALLOWED_DOMAIN}}`,
  so the two cannot drift. `DESIGN_GATE` is unset, so the gate follows
  `NODE_ENV` and is on.
- The Railway-provided domain used to verify the service before the cutover was
  removed afterwards, so the storefront is reachable only through Cloudflare.

#### The `/design/*` gate

The internal design-system pages are gated at the application level by Google
Workspace sign-in, reusing Medusa's `auth-google-workspace` provider. Three
environment variables on `storefront` drive it — `DESIGN_SESSION_SECRET`,
`DESIGN_ALLOWED_DOMAIN` and `DESIGN_GATE` — and are documented in
[apps/storefront/.env.example](../apps/storefront/.env.example).

**The Google Cloud OAuth Web client needs two authorized redirect URIs**, not
one: the admin's `GOOGLE_ADMIN_CALLBACK_URL` and the storefront's
`https://thecraftynp.org/auth/design/callback`. The provider takes the
storefront's callback URL from the request only when Medusa's
`GOOGLE_ADMIN_ALLOWED_CALLBACK_URLS` lists it exactly; an unlisted URL falls
back to `GOOGLE_ADMIN_CALLBACK_URL`, and a listed but unregistered one fails at
Google, not in our code.

**As of CNP-81 the gate's code is on `dev` but not yet on `main`**, so
`/design/*` on production is public until the next promotion, exactly as it was
on Vercel. The storefront's variables are in place for when it lands, but
**`GOOGLE_ADMIN_ALLOWED_CALLBACK_URLS` must be set on `medusa-server` and
`medusa-worker`, listing `https://thecraftynp.org/auth/design/callback`, before
that promotion.** Unlisted, Google returns the design sign-in to the admin login
page, whose widget redeems the code as an admin sign-in.

**Backups are scheduled on the Postgres volume, daily and monthly**, from the
service's Backups tab. Railway fixes the retention per schedule: daily is kept 6
days, monthly 89 days — roughly three months. Redis is deliberately not backed
up, because it holds no durable state; the R2 buckets age out under their own
lifecycle rules, under [R2](#r2).

- A volume backup restores only into the same service in the same environment,
  never into another environment or project.
- Deleting or wiping the volume deletes its backups with it. A logical dump is
  the only copy that survives that.
- A restore moves the service onto a new volume named after the backup's date
  stamp and leaves the old volume unmounted in the project. Backups newer than
  the restored one stay on the old volume.

### Restoring Postgres

**From a volume backup:** Postgres service → Backups → find the backup by date
stamp → Restore. Railway stages the change rather than applying it; review it
under Details on the project canvas, then Deploy. Postgres redeploys onto the
restored volume, and both Medusa services keep reaching it through the same
reference variable. This path can only run against production itself, so it
has not been exercised.

**From a logical dump:** exercised on 2026-09-12 (CNP-82), restored into a
throwaway local container. Postgres has no TCP proxy, so the dump goes through
the CLI's SSH tunnel, which needs a key registered with `railway ssh keys add`.

```sh
railway connect Postgres --tunnel-only -p <project-id> -e production -P 55432
docker run -d --rm --name restore-drill -e POSTGRES_PASSWORD=drill \
  -p 127.0.0.1:55433:5432 postgres:18
docker exec -e PGPASSWORD=<tunnel password> restore-drill pg_dump \
  -h host.docker.internal -p 55432 -U postgres -d railway \
  --format=custom --no-owner > prod.dump
docker exec restore-drill createdb -U postgres restore_drill
docker exec -i restore-drill pg_restore -U postgres -d restore_drill \
  --no-owner --exit-on-error < prod.dump
```

**Run `pg_dump` and `pg_restore` at the server's major version, which is 18.**
An older client refuses to dump a newer server, which is why both run inside a
`postgres:18` container rather than from a local install. The drill dumped the
20 MB database in 33 seconds over the tunnel, restored it in under a second, and
all 148 tables matched production's exact row counts, 1,114 rows in total. The
dump holds customer data: keep it out of the repo and delete it afterwards.

### The `api` custom domain had to be added unproxied first

Railway issues its own certificate for `api.thecraftynp.com`, and it cannot
complete that while Cloudflare is proxying the record. Add the `CNAME`
**grey-clouded**, wait for the certificate to reach `VALID`, then switch the
proxy on. Doing it in the other order leaves the certificate stuck validating.

The storefront's `thecraftynp.org` (CNP-81) needed the `_railway-verify` TXT
record in place as well: without it Railway answers the domain with a `404`
even once the `CNAME` resolves. Its certificate reached `VALID` within minutes
of the records being created.

## Vercel

The storefront left Vercel in CNP-81, and the project `craftynp-storefront` was
deleted on 2026-09-13, which also removed its Git connection and its checks on
pull requests. The repo's `vercel.json`, the Vercel MCP server and its
permissions went with it.

**There are no preview deployments, by decision.** They were not rebuilt on
Railway: Vercel's were reachable only by the team, called the production API
so checkout could never be exercised on them, and a Railway deploy that fails
its build or healthcheck leaves the previous deployment serving anyway. A
per-pull-request preview would also have needed its own protection, since
Cloudflare Access cannot cover `*.up.railway.app` hostnames.

**Copying variables out of Vercel does not work for Sensitive ones.**
`vercel env pull` writes the literal string `[SENSITIVE]` for any variable marked
Sensitive, and CNP-81 briefly shipped that as the Stripe publishable key and the
design session secret. Sensitive values cannot be read back from Vercel at all;
they have to come from their source.

## R2

| Bucket             | Access      | Used by                                         |
| ------------------ | ----------- | ----------------------------------------------- |
| `craftynp-media`   | **public**  | file module — site content, product images      |
| `craftynp-labels`  | **private** | `src/lib/label-storage.ts` — shipping labels    |
| `craftynp-artwork` | **private** | `src/lib/artwork-storage.ts` — customer artwork |

All three are `ENAM`, `Standard`. Every `r2.dev` managed endpoint is
**disabled**. `craftynp-media` is served only through `media.thecraftynp.com`,
because Cloudflare rate-limits `r2.dev` and documents it as unsuitable for
production. `craftynp-artwork` has no public route at all — no managed
endpoint and no custom domain — which is what makes it non-listable; every read
is a short-lived signed URL minted by Medusa.

**Media is on the `.com` zone, not `.org`, on purpose.** Next's image optimizer
fetches images server-side from the storefront's Railway container, and Bot
Fight Mode — on for `.org` —
challenges server-side fetches, which fail silently. `.com` has it off.

The three buckets must never be merged. R2 has no object-level ACLs and Medusa's
file module takes exactly one provider, which is what forces the split; see
[apps/medusa/AGENTS.md](../apps/medusa/AGENTS.md).

### `craftynp-artwork` lifecycle rules

| Prefix     | Rule                                           | Why                             |
| ---------- | ---------------------------------------------- | ------------------------------- |
| (all)      | abort incomplete multipart uploads after 1 day | housekeeping                    |
| `staging/` | delete after **7 days**                        | reaps abandoned uploads         |
| `artwork/` | delete after **180 days**                      | **safety net only** — see below |

**The 180-day rule is not the retention policy.** Retention is
`ARTWORK_RETENTION_DAYS` (30), enforced by the `purge-artwork` job, and it runs
from the _delivery_ date. R2 lifecycle can only age on the object's creation
date, so it cannot express that window: a rule set at the 60-day upload
fallback would silently delete artwork for an order delivered on day 55, which
must survive to day 85. The 180-day rule exists only to bound storage if the
job stops running, and is deliberately far past any window the job can produce.

The `staging/` rule is the one place a native rule genuinely fits — an
abandoned upload ages purely on upload date and needs no scheduler.

The 7-day staging window must stay comfortably longer than the promotion retry
horizon (`promote-pending-artwork`, every 15 minutes). Shortening it risks
destroying artwork for an order that has already been paid for.

**Changing this 7 means changing `STAGING_WINDOW_DAYS` in
`apps/medusa/src/lib/artwork-retention.ts` to match.** The sweeper uses it to
decide when a promotion is past saving and stops retrying; if the code's value
is longer than the rule, it retries objects that no longer exist.

### `craftynp-artwork` CORS

Needed because the browser PUTs straight to R2 against a presigned URL.

| Field   | Value                                                    |
| ------- | -------------------------------------------------------- |
| Origins | `https://thecraftynp.org`, `https://www.thecraftynp.org` |
| Methods | `PUT`, `GET`, `HEAD`                                     |
| Headers | `content-type`                                           |
| Max age | 3600                                                     |

`http://localhost:8000` was removed in CNP-92. Local development uploads to the
MinIO container, never to this bucket, so production has no reason to admit a
localhost origin.

### R2 credentials

| Buckets                             | Token                                 |
| ----------------------------------- | ------------------------------------- |
| `craftynp-media`, `craftynp-labels` | one shared token                      |
| `craftynp-artwork`                  | its own **Object Read & Write** token |

`FILE_STORAGE_*` and `LABEL_STORAGE_*` carry **identical** access key and
secret — the two buckets have always shared one credential. Artwork does not
join them: it holds customer-supplied personal content on a deliberate 30-day
clock, so a leaked media or labels key must not reach it, and a leaked artwork
key must not reach product imagery or shipping labels.

R2 tokens can only be created from the dashboard, so the values live on the
Railway services and nowhere else. Both `medusa-server` and `medusa-worker`
need them — the purge job runs only under worker duty, and a missing credential
there means the job throws `ArtworkStorageNotConfiguredError` on every run with
only the log tag to show for it.

## GitHub

| Ruleset              | Branches      | Rules                      |
| -------------------- | ------------- | -------------------------- |
| `protected-branches` | `dev`         | pull request required      |
| `promotion-branches` | `main`        | pull request required      |
| `branch-integrity`   | `dev`, `main` | no deletion, no force-push |
| `required-checks`    | `dev`, `main` | `ci` must pass             |

`required-checks` has **no bypass actors**, unlike the two pull-request
rulesets, which repository admins can bypass. Without that, "a failing job
blocks merge" would not be true for an admin. "Require branches to be up to
date" is deliberately off: it forces a rebase before every merge, which fights
the merge-commit rule on promotions.

Only `ci` is required. Railway posts a deploy check for each service a pull
request's base branch deploys; those are not required, because they can fail
for reasons unrelated to the code.
