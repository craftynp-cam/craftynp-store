# DNS and infrastructure

A record of what is configured in Cloudflare, Railway and Vercel, as of the
CNP-16/17/18/73 provisioning.

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

| Hostname                 | Serves                        | Behind    |
| ------------------------ | ----------------------------- | --------- |
| `thecraftynp.org`        | storefront                    | Vercel    |
| `www.thecraftynp.org`    | 308 redirect to the apex      | Vercel    |
| `dev.thecraftynp.org`    | storefront, `dev` branch, SSO | Vercel    |
| `api.thecraftynp.com`    | Medusa API and `/app` admin   | Railway   |
| `media.thecraftynp.com`  | uploaded imagery              | R2 bucket |
| `thecraftynp.com`, `www` | 301 redirect to `.org`        | —         |

## thecraftynp.org

Zone `8a3677ddd6ac55ed3aeec8b8cca67d5d`.

| Type  | Name                | Content                | Proxy | Purpose                                |
| ----- | ------------------- | ---------------------- | ----- | -------------------------------------- |
| A     | `@`                 | `76.76.21.21`          | on    | Vercel apex                            |
| CNAME | `www`               | `cname.vercel-dns.com` | on    | Vercel; redirects to the apex          |
| CNAME | `dev`               | `cname.vercel-dns.com` | on    | Vercel, pinned to the `dev` branch     |
| MX    | `@`                 | Google Workspace (×5)  | —     | **do not delete** — the client's mail  |
| MX    | `send`              | `feedback-smtp…ses`    | —     | Resend bounce handling                 |
| TXT   | `@`                 | SPF, site verification | —     | **do not delete**                      |
| TXT   | `_dmarc`            | DMARC                  | —     | **do not delete**                      |
| TXT   | `google._domainkey` | DKIM                   | —     | **do not delete** — Workspace mail     |
| TXT   | `resend._domainkey` | DKIM                   | —     | **do not delete** — transactional mail |
| TXT   | `send`              | SPF for Resend         | —     | **do not delete**                      |

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

### API rate limiting

On the `http_ratelimit` phase of the `.com` zone.

```
(http.host eq "api.thecraftynp.com") and
((http.request.uri.path in {"/store/tax-quote" "/store/shipping-rates"})
 or (starts_with(http.request.uri.path, "/store/checkout/")))
```

10 requests per 10 seconds, block for 10 seconds, characteristics `ip.src` and
`cf.colo.id`.

**This is not quite what the README describes, and the difference is the Free
plan, not a choice.** It asks for 60 requests per minute blocking for one
minute. On this plan:

- the only permitted period is **10 seconds**, so the rate is expressed as 10
  per 10s — the same average, stricter on bursts;
- the only permitted mitigation timeout is **10 seconds**, not 60;
- `cf.colo.id` is a **required** characteristic, so counting is per-datacenter
  rather than global. A single client normally reaches one datacenter, but the
  ceiling is not the global one the README implies.

Upgrading the plan is what closes those three gaps.

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
| `Postgres`      | private network only                         |
| `Redis`         | private network only                         |

Postgres and Redis have **no TCP proxy**, so they are unreachable from outside
the project. Both Medusa services reach them by reference variable
(`${{Postgres.DATABASE_URL}}`), never a copied literal.

`PORT` is set to `9000` explicitly. Left unset the platform injects `8080`,
which silently disagrees with the Dockerfile's `EXPOSE` and with every port
reference in this repo.

**Backups are not enabled.** Railway's scheduled volume backups need a paid
plan, so CNP-16's "daily backups with the retention documented" is **not met**.
When the plan is upgraded, enable daily and monthly on the Postgres volume —
daily retains 6 days, monthly 3 months — and record it here.

### The custom domain had to be added unproxied first

Railway issues its own certificate for `api.thecraftynp.com`, and it cannot
complete that while Cloudflare is proxying the record. Add the `CNAME`
**grey-clouded**, wait for the certificate to reach `VALID`, then switch the
proxy on. Doing it in the other order leaves the certificate stuck validating.

Vercel needed no such dance — its apex `A` record works proxied immediately.

## Vercel

Project `craftynp-storefront`.

| Setting           | Value             | Why                                                       |
| ----------------- | ----------------- | --------------------------------------------------------- |
| Root directory    | `apps/storefront` | keeps framework detection and output location working     |
| Production branch | `main`            | defaults to the repo default, which is `dev`              |
| Node              | **22.x**          | defaults to 24, which fails `engine-strict` on `>=22 <23` |

The install and build commands come from
[apps/storefront/vercel.json](../apps/storefront/vercel.json) so they are
reviewable in the repo rather than dashboard state.

Deployment protection is `all_except_custom_domains`, and the exception is
narrower than it sounds: it exempts **production** custom domains only.
`thecraftynp.org` and `www` are public; `*.vercel.app` **and
`dev.thecraftynp.org`** answer `302` to Vercel SSO, because `dev` is a preview
deployment. That is the right outcome for a staging alias — it is reachable by
the team and nobody else — but it does mean `dev.thecraftynp.org` cannot be used
to demo anything to the client. Use `vercel curl` to fetch a protected
deployment from a script.

Fork protection is on, which matters because the repo is public and
`STORE_CORS` admits preview origins.

### Never deploy this repo with `vercel` from the command line

`vercel --prod` from the repo root packages the whole working tree — it reached
**30 GB** before failing — and, worse, silently creates a _second_ project named
after the directory, links it to the repo, and adds a failing check to every
pull request. One had to be deleted.

Production deploys come from git. To deploy a specific commit without pushing,
create the deployment through the API with a `gitSource` body.

## R2

| Bucket            | Access      | Used by                                      |
| ----------------- | ----------- | -------------------------------------------- |
| `craftynp-media`  | **public**  | file module — site content, product images   |
| `craftynp-labels` | **private** | `src/lib/label-storage.ts` — shipping labels |

Both `r2.dev` managed endpoints are **disabled**. `craftynp-media` is served
only through `media.thecraftynp.com`, because Cloudflare rate-limits `r2.dev`
and documents it as unsuitable for production.

**Media is on the `.com` zone, not `.org`, on purpose.** Next's image optimizer
fetches images server-side from Vercel, and Bot Fight Mode — on for `.org` —
challenges server-side fetches, which fail silently. `.com` has it off.

The two buckets must never be merged. R2 has no object-level ACLs and Medusa's
file module takes exactly one provider, which is what forces the split; see
[apps/medusa/AGENTS.md](../apps/medusa/AGENTS.md).

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

Only `ci` is required. The Vercel checks are not, because they fail for reasons
unrelated to the code.
