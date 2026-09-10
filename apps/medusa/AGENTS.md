# AGENTS.md — Medusa backend

Medusa 2.18 on port **9000**, admin dashboard at **`/app`**. Shared zod schemas
come from `@craftynp/types`. Repo-wide setup, commands, and conventions are in
the root [AGENTS.md](../../AGENTS.md).

Custom modules live in `src/modules` and are registered in `medusa-config.ts`:
`site-content`, `artwork`, `order-status`, `shipstation` and
`shipstation-fulfillment`, `stripe-tax` (which registers both a module and a
tax provider), `notification-resend`, `auth-auth0`, and
`auth-google-workspace`.

## Layout and config

- **Site-content fields are declared by the `SITE_CONTENT_FIELDS` registry in
  `@craftynp/types`, not by the `siteContent` module.** Adding a field —
  including an `image` field, whose stored value is just the URL string — is a
  registry change, never a migration.
- **A category carries two settings of its own, on its `metadata`**: the
  homepage carousel image below, and `artwork_min_dpi`. Each has its own widget
  on `product_category.details.side.after`; both must spread the existing
  metadata into their update, because Medusa replaces the jsonb column
  wholesale and an unspread write destroys the other one.
- **Category imagery is not site content.** The storefront's homepage carousel
  renders one slide per product category and reads each slide's photo from that
  category's own `metadata.image_url` / `metadata.image_alt`, written by the
  `product_category.details.side.after` widget in
  `src/admin/widgets/category-image.tsx`. Fixed site-content slots cannot track
  a category list the client edits freely. **The widget must spread the existing
  metadata into its update** — Medusa replaces the jsonb column wholesale, so an
  unspread write silently destroys every other key on the category.
- **A product's customization declaration lives on `product.metadata`**, in the
  flat keys the `CUSTOMIZATION_INPUTS` registry in `@craftynp/types` names —
  `customizable` plus one `customization_*` key per configurator input, every
  value a string. Flat strings, not a nested object, so a CSV import and the
  admin's raw metadata editor can both write them. The widget in
  `src/admin/widgets/product-customization.tsx` (zone
  `product.details.side.after`) writes them, and **must spread the product's
  existing metadata into its update** for the same reason the category-image
  widget must.
- **The custom size carries four more keys**, written by the same widget and
  the same patch: `customization_size_min_inches` and
  `customization_size_max_inches` are the bounds the shopper is held to, and
  `customization_size_option` / `customization_size_option_value` name the
  preset option group the storefront's custom-size toggle drives and the value
  on it that means "custom". There is no price bound here — area pricing is
  CNP-42. The two halves split the way the rest of the declaration does:
  `resolveProductCustomization` is **tolerant** and falls back to
  `CUSTOM_SIZE_FALLBACK_BOUNDS` on anything it cannot read, while
  `validateProductCustomization` is **strict** and refuses to publish a product
  that asks for a custom size and names no bounds of its own — so the fallback
  is unreachable on a live product and the constant is not a hidden policy.
  `validateCustomization` (`src/lib/validate-customization.ts`) takes those
  bounds as an argument rather than a constant, so the message it throws names
  the same range the shopper was shown. It takes the artwork resolution floor
  and the ordered width the same way, for the same reason. It still has no
  production caller; CNP-45 wires the real `LineItemCustomization` payload
  through.
- **`tsconfig.json` must keep `medusa-config.ts` in `include`, with `rootDir`
  at `./`.** `medusa build` emits exactly `tsConfig.fileNames`, so scoping the
  root to `src` leaves the built `.medusa/server` with no `medusa-config.js` and
  `medusa start` there dies with "Cannot find module …/medusa-config". Nothing
  local catches it: `medusa develop` reads `src/` directly, so only a deployment
  ever runs the built output. The emitted layout is then `medusa-config.js`
  beside a `src/` directory, which is what Medusa's own loaders expect.
- **`src/admin` typechecks separately.** It is the only `.tsx` here and needs
  DOM lib types the Node-only backend doesn't carry, so `tsconfig.json` excludes
  it and `typecheck` runs a second `tsc -p src/admin --noEmit`. Put a file that
  needs DOM types under `src/admin`, and nothing else there.
- **Admin extensions use `@medusajs/ui`, `@medusajs/admin-sdk`, and
  `@tanstack/react-query`.** Never import storefront components — they are
  HeroUI on React 19 and will not run in the React 18 admin bundle.
- **Site-content and product imagery goes to a public S3 bucket, never
  `file-local`.** A deployed container's filesystem is ephemeral, so
  `file-local` would destroy every image the owner uploaded on the next deploy,
  silently and without an error anywhere. The provider is configured from
  `FILE_STORAGE_*`; `FILE_STORAGE_PUBLIC_URL` is the base that ends up in every
  image URL, so the storefront needs the same value as
  `NEXT_PUBLIC_MEDIA_BASE_URL` or its optimizer rejects the host.
  **`acl: false` is load-bearing** — it omits
  the ACL header, where omitting the option sends `public-read`, which R2
  rejects.
- **Route a `@craftynp/types` schema through `unknown` before passing it to
  `validateAndTransformBody`** (see `api/admin/site-content/middlewares.ts`).
  `@medusajs/framework` bundles its own zod instance, and comparing the two
  schema types structurally hits `TS2589` or OOMs `tsc` outright rather than
  reporting anything readable.

## Auth and admin access

Customers sign in through **Auth0**; admins through a custom **Google
Workspace** OAuth provider. `authMethodsPerActor` closes `emailpass` over HTTP
for both actors.

- **Never build credential UI in this repo.** Auth0's Universal Login owns
  sign-in, sign-up, "Continue with Google", and password reset; the module only
  exchanges the authorization code for a Medusa JWT.
- **Both providers key the auth identity's `entity_id` on the lowercased
  verified email, never the provider `sub`**, and reject `email_verified: false`
  outright. Keying on `sub` — the conventional choice — forks one person into
  two identities and can't be matched to an existing Medusa user.
- **Never delete a test customer from the admin while testing sign-in.** Medusa's
  delete flow leaves `app_metadata.customer_id` present-but-`null`, which
  permanently poisons the auth identity and 404s every later sign-in for that
  address, with nothing surfaced to the customer. Use a fresh email per run, or
  `pnpm run reset-auth0-account <email>` — the email is a bare trailing
  argument, with no `--` before it, or the script sees no argument at all. It
  does not touch Auth0 itself. `src/lib/purge-customer-identity.ts` is the
  cleanup that actually avoids the poisoned-identity trap (delete addresses,
  then `provider_identity`, then orphaned `auth_identity`, then the customer
  row, leaving orders untouched) — both the reset script and the storefront's
  self-serve close-account route call it rather than duplicating the sequence.
  That route (`DELETE /store/customers/me`, under
  `src/api/store/customers/me/`) needs no explicit auth middleware: core
  already authenticates `ALL /store/customers/me*` and takes the identity from
  `req.auth_context.actor_id`, never the request body.
- **`auth-auth0/lib.ts` duplicates `auth0_sub` into `user_metadata`** as well as
  `provider_metadata`. Only `user_metadata` reaches the storefront's JWT
  (`provider_metadata` never leaves this module), and the storefront needs the
  sub to tell an email/password customer from a Google one on the account page.
- **Never register `@medusajs/auth-google`.** It is a dependency but is
  deliberately unregistered: it ignores the `hd` claim, so any personal Gmail
  account would authenticate as an admin. The real gate is server-side in
  `auth-google-workspace/lib.ts` and requires both the verified `hd` claim and
  the email's own domain to match — the `hd` param on the authorize URL is only
  a UI hint. Do not collapse that two-part check.
- **`auth-google-workspace` has two callers, and the second is not the admin.**
  The storefront's `/design/*` gate signs in through this same provider (see
  [apps/storefront/AGENTS.md](../storefront/AGENTS.md)), passing its own
  `callback_url` — which `authenticate()` honours per request and stashes in the
  OAuth state for the token exchange, so `GOOGLE_ADMIN_CALLBACK_URL` remains the
  admin's default and that flow is unchanged. **Both callback URLs have to be
  registered on the Google Cloud OAuth client.** The storefront needs no Medusa
  `user` row: it only reads the email off the resulting token, so an actorless
  token is a success there where the admin flow would go on to `/admin-sso/link`.
- **There is no admin auto-provisioning.** Google sign-in produces an actorless
  token; the login widget then calls `POST /admin-sso/link`, which links only an
  existing Medusa `user` matched by verified email. Create the admin with
  `medusa user -e <email>` first.
- **Keep `@medusajs/medusa/auth-emailpass` registered while leaving it out of
  `authMethodsPerActor.user`.** `medusa user` calls
  `authService.register("emailpass", …)` in-process, so removing the
  apparently-unused provider breaks admin user creation entirely. The
  dashboard's "Accept invite" flow goes over HTTP and is therefore unusable —
  use `medusa user -e <email>`, not `--invite`.
- **`/admin-sso/link` must stay outside `/admin/*`**, whose default protection
  requires a registered actor that a post-Google token is not yet, which is why
  its middleware passes `allowUnregistered: true` to `authenticate`. The route
  must take the identity only from `req.auth_context.auth_identity_id`, never
  from the request body, or a caller could name who they link as.
- **The login widget's callback effect must claim its `useRef` guard and clear
  the query string _before_ awaiting `sdk.auth.callback`**, not in the `.then`.
  Google rejects a replayed authorization code, so any re-run of that effect
  inside the ~400ms exchange — a StrictMode double-mount, a changed `navigate`
  identity — fires a second exchange that 400s and renders "Failed to
  authenticate with Google" over a sign-in that actually succeeded.
- **Deleting an admin `user` strands its Google auth identity** the same way a
  deleted customer does — `setAuthAppMetadataStep` throws when
  `app_metadata.user_id` is merely present, including present-and-`null` — and
  there is no reset script for admins.
- **Lockout recovery:** a misconfigured Google OAuth client leaves no way into
  `/app`. Temporarily add `"emailpass"` to `authMethodsPerActor.user` and
  restart (the provider itself is already registered), fix the Google Cloud
  client, then revert.

**No in-repo representation.** These live only in external dashboards, so don't
search the repo for them: Auth0's password policy, its "Require Email
Verification" Post-Login Action, and Attack Protection; the Auth0
`custom-email-provider` Action that sends password-reset mail through Resend —
never add it under `src/`, it would not run there (see
[docs/auth0-custom-email-provider.md](docs/auth0-custom-email-provider.md));
the Google Cloud OAuth Web client whose redirect URI must exactly match
`GOOGLE_ADMIN_CALLBACK_URL`;
the Workspace org's 2-Step Verification policy; and Stripe Tax's nexus and
per-state registrations. Workspace 2SV is the real MFA enforcement — Medusa's
TOTP is config-only and opt-in per identity, so do not implement enrolment.

## Abuse and rate limiting

Four store routes are reachable with no session at all, and two of them spend
money on every call: `/store/tax-quote` bills a Stripe Tax calculation and
`/store/shipping-rates` burns the ShipStation limit. Because there is
deliberately no flat-rate fallback, exhausting ShipStation returns
`502 shipping_unavailable` and **blocks checkout for genuine customers** — so
this is a denial-of-checkout vector, not only a cost one.

- **`rateLimit()` from `src/lib/rate-limit.ts` goes on every new anonymous store
  route that costs money or sends mail.** It is wired in the route's
  `middlewares.ts`, **before** `validateAndTransformBody`, so a flood of
  malformed bodies is rejected without parsing them.
- **It fails open.** A missing or throwing cache calls `next()` rather than
  refusing the request — a broken cache must never take checkout down with it.
  That is the right trade here and the reason this is a second line of defence
  behind Cloudflare, not the only one.
- **It keys on `cf-connecting-ip` first.** Cloudflare strips any client-supplied
  copy of that header, so it is the one value a caller cannot forge;
  `x-forwarded-for` is the fallback for a non-Cloudflare proxy and **is**
  spoofable. **If Medusa is ever reachable directly, bypassing Cloudflare, the
  limiter is trivially defeated by forging that header** — the origin must only
  accept traffic through the proxy. That is what `originGuard()` in
  `src/lib/origin-guard.ts` is for: a Transform Rule sets a shared secret header
  on the API hostname and the guard refuses anything without it, wired first in
  `src/api/middlewares.ts` on `/*`. Its `ORIGIN_GUARD_MODE` is three-state and
  **anything unrecognised disables it**, deliberately — a typo must not refuse
  every request including the platform's healthcheck. Do not exempt the webhook
  routes from it; they come through Cloudflare and carry the header.
  **`/health` is exempt and must stay exempt** — the platform's healthcheck
  reaches the container directly, so it carries no header, and enforcing there
  fails every future deploy. The guard reads `req.originalUrl`, not `req.path`:
  the latter is relative to the mount point and is `"/"` for every request,
  which makes it useless for both matching and logging.
- **The window counter lives in `Modules.CACHE`, which is Redis-backed wherever
  `REDIS_URL` is set** — so the counters are shared across the server, the
  worker and any future replica, and the `RATE_LIMIT_*` values are the real
  global ceiling rather than a per-replica one. Without `REDIS_URL` the cache
  is in-memory and the counters go back to being per-process and reset on
  deploy, which is fine for local development and is what CI runs on. The
  fail-open behaviour above now also covers a Redis outage, which is
  deliberate: a cache blip must never take checkout down.
- Limits are per-IP per-minute and come from `RATE_LIMIT_*` env vars, documented
  in `.env.example`. A non-positive-integer value is ignored rather than
  applied, so a typo cannot lock every caller out.

**Cloudflare is the first line and has no in-repo representation** — like the
Auth0 and Stripe Tax dashboard state above, don't search for it here. The
rate-limiting rule on `/store/tax-quote`, `/store/shipping-rates` and
`/store/checkout/*` lives there and sheds volume long before it reaches this
limiter.

- **Medusa is served from `api.thecraftynp.com`, a different zone from the
  storefront's `thecraftynp.org`, and Bot Fight Mode is deliberately off on
  that zone.** On the Free plan Bot Fight Mode is zone-wide and cannot be
  skipped — Cloudflare documents that Skip, Bypass and Allow "have no effect"
  on it — so in front of this app it would challenge the Stripe and ShipStation
  webhooks and the storefront's server-side fetches. Every one of those fails
  silently: payment succeeds at Stripe and no order appears, tracking never
  updates. The split zone is what keeps the API challenge-free while the
  storefront keeps the protection. The alternative — grey-clouding the API so
  Cloudflare never sees it — was rejected because it leaves the limiter with
  only the forgeable `x-forwarded-for` to key on. See
  [README.md](../../README.md), which also records that the `.com` zone still
  carries the live mail records and is not safe to delete.

## Money, units, and external APIs

- **Weights are grams and dimensions centimetres everywhere.** Medusa enforces
  no units of its own, so `SHIPSTATION_WEIGHT_UNIT` / `_DIMENSION_UNIT` must
  agree with how products are actually stored or a rate silently quotes the
  wrong parcel.
- **Every amount is decimal major units.** `src/modules/stripe-tax` is the only
  place minor units exist, crossed solely by `toMinorUnits` / `fromMinorUnits`
  in its `lib.ts`. Leaking cents outside that module multiplies money by 100.
- **Resolve weight, dimensions, and `calculated_price` server-side via
  `query.graph`.** Store request bodies carry only `{ variantId, quantity }` —
  never accept a client-supplied weight or price on a `/store` route. The one
  exception is the authenticated admin parcel override on
  `/admin/orders/:id/shipment/rates` and `/buy`: the shop owner is looking at
  the packed box and the product defaults are only a guess, so she may correct
  the weight and dimensions. She may never name a **price** — the label is
  always priced by ShipStation and the amount actually charged is what gets
  recorded. The destination is still resolved from the order server-side on
  both routes.
- **There is no flat-rate shipping fallback, deliberately.** A missing-dimension
  parcel or any ShipStation error returns `502 shipping_unavailable` and blocks
  checkout, because a wrong shipping charge is worse than a shopper hitting
  Retry. `SHIPPING_OPTION_DEFAULT_AMOUNT` / `_LABEL` is a seeded catalogue
  price, not a checkout-time fallback. Do not add one.
- **ShipStation's `/v2/rates/estimate` response is not purchasable** and
  excludes surcharges, so its `rate_id` cannot be looked up again later.
  Re-verify a quote by re-estimating and comparing the fresh amount within a
  tolerance, never by replaying the `rate_id`. `/v2/rates` is the separate,
  authoritative call the fulfilment workspace uses, and unlike the estimate it
  is **deliberately uncached** — the owner is choosing what to spend.
- **`purchaseLabel` must never retry a timeout or a network error.** ShipStation
  documents no idempotency key on `POST /v2/labels`, so a retry can buy a second
  label and spend real money twice. Only a 429 — refused before any label
  exists — is safe to retry. An unconfirmed timeout is reconciled by reading
  `GET /v2/labels` and matching on our own `external_shipment_id`, then on
  ship-to name plus postal code plus service within the window.
- **Voiding restores the inventory reservations.** The first fulfillment
  consumes them, and the Medusa fulfillment survives a void because a shipped
  one cannot be cancelled — so without this, `createOrderFulfillmentWorkflow`
  fails the next time with "No stock reservation found" and an order that came
  back to `packing` can never be shipped again. `restoreReservationsStep`
  rebuilds them from the order's managed variants at the existing
  fulfillment's location, skipping any line item that still has one so a retry
  cannot double-reserve. A reservation must carry `line_item_id` or the
  fulfillment workflow will not find it.
- **Voiding calls ShipStation before writing anything, and a refusal is an
  answer.** Both a 200 carrying `approved: false` and a **4xx** are the carrier
  saying no — they record `void_approved: false` plus its message, stamp
  `voided_at`, and return the order to `packing`, because we know the label was
  not voided. Only a timeout or a 5xx is genuinely unknown, and that throws so
  we never stamp `voided_at` on a label whose real state we cannot see.
  Treating a 4xx as unknown strands the order as `shipped` forever — which is
  what happens with a test label, since ShipStation rejects voiding one.
  `void_approved` is tri-state — null means we never asked.
- **Label PDFs do not go through the file module.** They live in their own
  private S3 bucket — Cloudflare R2 in production, the MinIO container in
  `docker-compose.yml` locally — written by `src/lib/label-storage.ts` and
  served only by `GET /admin/fulfilment/labels/:orderId`. Two things force
  this, and both were found the hard way:
  **`file-local` cannot store anything privately.** Its own source says so:
  "there is no way to serve private files through a static server, we simply
  place them in `static`". A label written with `access: "private"` was
  fetchable at `/static/labels/private-….pdf` with no auth at all.
  **The file module has exactly one provider** (`fileProviderService_`, no
  per-call selection), and R2 has no object-level ACLs, so a bucket is public
  or private as a whole. One provider therefore cannot serve public
  site-content images and private labels. Site content gets the public
  `FILE_STORAGE_*` bucket through the file module; labels get their own private
  one, reached only through `label-storage.ts`, and customer artwork gets a
  third private one reached only through `artwork-storage.ts`. The three
  buckets must never be collapsed.
  `label_file_id` holds the object key. `label_url` holds our own route; it
  falls back to ShipStation's 90-day URL only when storage failed, which is
  exactly what a null `label_file_id` marks.
- **Never make the labels or artwork bucket public**, and never point either at
  the bucket that serves site-content images.
- **Storing the label PDF must never throw.** It runs after the purchase, so
  throwing would trigger the compensating void and cancel a perfectly good label
  because our own disk was full. That is a worse outcome than a link that
  expires.
- **`SHIPSTATION_TEST_LABELS` defaults to `true`**, and only the literal
  `"false"` turns it off, so a fresh clone cannot spend money by accident.
- **The ShipStation rate limiter is a token bucket at file module scope in
  `limiter.ts`**, with one shared "blocked" promise every waiter awaits. Do not
  move that state onto the service instance — DI lifetime would hand out one
  bucket per request — and do not replace it with per-request retry, which makes
  concurrent 429s all retry at the same instant.
- **Keep both rate caches.** The backend `Modules.CACHE` one and the
  storefront's `sessionStorage` one are not redundant: the first protects the
  sandbox rate limit, the second covers back-navigation without a loading flash.
  Only a genuinely priced response is ever cached — never cache a failed call.
- **A state with no tax obligation is a successful `$0.00` calculation, not an
  error.** Do not treat a zero tax amount as a failure the way ShipStation's
  empty rate response is treated; that would block checkout for every shopper in
  an unregistered state.
- **Never point automated tests at the ShipStation or Stripe sandboxes.** Mock
  `global.fetch` at the `ShipStationModuleService` boundary, and spy on the
  Stripe client's own methods rather than the `stripe` module.

`pnpm run list-carriers` prints every connected carrier's `carrier_id`, for
finding `SHIPSTATION_USPS_CARRIER_ID`.

## Cart, payments, and order placement

- **The fulfillment and tax providers live beside — not instead of — the
  `shipstation` / `stripeTax` custom modules and their `/store/shipping-rates`
  and `/store/tax-quote` routes.** Both paths are live; the store routes still
  serve the pre-cart checkout steps. Do not consolidate them.
- **The client never names a price.** The PaymentIntent is created against the
  payment collection's amount, i.e. `cart.total`, and `calculatePrice`
  recomputes the cart signature from the provider-context cart, never from
  client-supplied `data`. `calculatePrice` throws and blocks the cart refresh
  when a quote can't be verified or re-estimated within tolerance.
- **In `prepare-cart`, every read that feeds the payment response must happen
  after all writes that can change `cart.total`.** A cart refresh deletes
  payment sessions, which cancels the PaymentIntent, so a pre-write snapshot
  hands the browser a terminal-state `client_secret` that Stripe Elements
  refuses. A payment collection whose `amount` still equals `cart.total` is the
  proof its session survived.
- **`prepare-cart` must fall through to a fresh cart for an unknown or
  already-completed `cartId`** (logging `[checkout:cart-superseded]`), never
  return 400 — the storefront's stored id outlives its cart, and rejecting it
  wedges a shopper out of checkout permanently. Double-order protection lives in
  `/checkout/complete`'s order lookup, not here.
- **`prepare-cart` re-attaches the shipping method on every call.** The workflow
  replaces rather than duplicates; skipping it leaves the previous address's
  `quoteToken` attached, which blocks checkout on the next address edit.
- **Error bodies from these store routes must carry a `message` alongside
  `error`/`reason`.** `@medusajs/js-sdk`'s `FetchError` discards everything
  else, so the storefront proxy otherwise sees only a status.
- **`/checkout/complete`'s catch block must re-run the order lookup before
  reporting a failure.** Stripe's webhook can place the order mid-request,
  making `completeCartWorkflow` throw on an already-completed cart — otherwise a
  paid, placed order is reported to the shopper as a failure.
- **Use `describeError` (`src/lib/describe-error.ts`) in catch blocks around
  Medusa workflows.** The engine rejects with values that aren't reliably
  `Error` instances, so `String(error)` yields `[object Object]` in both the log
  and the browser.
- **Do not build a Stripe webhook route.** Medusa core's
  `/hooks/payment/:provider` with `@medusajs/payment-stripe` already places the
  order out-of-band; only `STRIPE_WEBHOOK_SECRET` is needed.
- **`Order` has no `cart_id` column, and `Fulfillment` has no `order_id`
  one.** Both associations are module link tables: query `entity: "order_cart"`
  filtered on `cart_id`, and `entity: "order_fulfillment"` filtered on
  `fulfillment_id`. Filtering `entity: "order"` by `cart_id` makes MikroORM
  throw at runtime rather than returning nothing.
- **The order confirmation route is `/store/order-confirmation/:id`, not
  `/store/orders/:id`** — core already owns that path behind mandatory customer
  auth, and a file there collides with ambiguous precedence. It takes either a
  signed `?token=` (bound to that one order id, which is what stops a valid
  token being re-pointed at somebody else's) or the session's own
  `customer_id`, and its middleware must keep `allowUnauthenticated: true` or
  the guest branch never runs.
- **Every rejection from that route is a 404, never a 403.** A 403 confirms the
  order exists, which is exactly what URL manipulation is fishing for.
- **`ORDER_ACCESS_SECRET` is its own secret** and its tokens live 90 days,
  unlike the 30-minute quote tokens — a link sitting in a guest's inbox has to
  outlive production and shipping.
- **The `order.placed` tax subscriber must keep passing the order id as the
  Stripe transaction `reference`** — that uniqueness constraint is the only
  guard against double-recording on retry. A failure logs and never rolls back
  the paid order.
- **`getTaxLines` returns rates while Stripe Tax returns amounts**, so the
  cart's tax can drift up to ~1¢ per line from the Stripe calculation. That is
  the accepted tradeoff, not a bug, and the tax provider is deliberately
  uncached unlike the sibling module service.

## Customer artwork

A shopper's artwork lands in a **third private bucket** (`ARTWORK_STORAGE_*`),
reached only through `src/lib/artwork-storage.ts`. It cannot go through the file
module for exactly the reason labels cannot — one provider, no object-level
ACLs. The `artwork` module is the ledger; the bytes are never in Postgres.

- **Uploads are two-phase, and the key is the point.** A shopper uploads before
  a cart exists, so there is no order to key on: the object lands at
  `staging/{uploadId}.{ext}`, and the `order.placed` subscriber copies it to
  `artwork/{orderId}/{lineItemId}/{uploadId}.{ext}` and deletes the staging
  copy. That is what makes every stored file traceable to its order without
  consulting the database.
- **`presignArtworkUpload` binds Content-Length and does not bind
  Content-Type.** The length is in the signature, so a URL can only ever write
  the number of bytes it was minted for — that is the ceiling on what one
  presign call can store. The S3 presigner adds `content-type` to its own
  unsignable set and a `signableHeaders` override does not reach the signer, so
  the declared type is advisory. Do not build a check on it. What contains a
  mislabelled file is that the bucket is private and every read is a signed URL
  forcing an attachment disposition — and the inspect route below, which is the
  only thing that ever reads the bytes.
- **`POST /store/artwork/uploads/:uploadId/inspect` is the gate, and the
  storefront calls it straight after the PUT.** It reads the head of the
  staging object over `Range` (`readArtworkHead`), sniffs the real format from
  its magic bytes, and refuses anything whose bytes contradict the type it was
  presigned as. `src/lib/artwork-inspection.ts` is the pure half — PNG's IHDR,
  a JPEG marker walk past EXIF and Photoshop segments, and all three WebP chunk
  types — and is tested against real encoder output rather than fixtures packed
  the way the reader reads.
  **An unmeasurable raster is rejected, not passed.** No dimensions means no
  DPI check means nothing blocks the file, which is the one hole this exists to
  close. **SVG, PDF and AI always bypass the resolution check**: a raster
  wrapped in a PDF falls to the manual backstop (CNP-68) rather than to a PDF
  parser here. `.ai` is accepted as either a PDF or a PostScript header.
  The measurement is written to `artwork_asset`'s existing `width_px` /
  `height_px` columns before the response, so the resolution the shopper was
  gated on is the one an order can be checked against later. `dpi` is not
  stored: it is a function of the pixel width and the ordered size, and a
  stored copy could disagree with both.
- **The inspect route is anonymous, and that is the considered position, not an
  oversight.** A shopper uploads before any cart or session exists, so there is
  no identity to bind it to — the same reason the presign route is anonymous.
  The `uploadId` is a v4 UUID and is therefore the capability: it cannot be
  guessed, and knowing one buys only that file's pixel dimensions, never its
  bytes or a URL to them. It is rate-limited like every other anonymous store
  route that spends anything. Do not "fix" this by adding a session check that
  the flow cannot satisfy.
- **The resolution decision is only half server-side today.** The pixel count
  is measured here from the stored bytes and cannot be forged by the browser,
  but the comparison against the threshold still happens in the storefront,
  because artwork does not reach any server-side order path yet.
  `validateCustomization` holds the rule and has no caller; **CNP-45 is what
  closes this**, and until it lands the story's "enforced server-side as well
  as client-side" is not fully true. There is no exploit in the meantime — a
  crafted client has nowhere to send an artwork reference.
- **The minimum DPI is `artwork_min_dpi` on product _category_ metadata**,
  written by `src/admin/widgets/category-artwork.tsx` and read through
  `resolveArtworkMinDpi` in `@craftynp/types`, which takes the strictest value
  among a product's categories. Unlike `CUSTOM_SIZE_FALLBACK_BOUNDS`,
  `DEFAULT_ARTWORK_MIN_DPI` (150) **is reachable on a live product** — a
  product need not belong to any category, so nothing can force a threshold to
  be declared. It is deliberate policy, not a hidden one.
  The ordered physical size comes from the size option value's own
  `width_inches` / `height_inches` metadata, or from the shopper's typed
  dimensions; see [apps/storefront/AGENTS.md](../storefront/AGENTS.md).
  **Both axes are measured, and the coarsest one decides.** A 2400x600 file
  ordered at 8" x 40" clears 300 DPI across and prints at 15 DPI down the
  banner — checking the width alone, which is what the story's acceptance
  criterion literally asks for, would call that acceptable.
- **`artwork_min_dpi` is strict on the way in and tolerant on the way out.**
  `resolveArtworkMinDpi` ignores what it cannot read, because a live category
  must never break a product page — which leaves a typo (`3OO`) reading as no
  threshold and quietly dropping the whole category to the default.
  `validateCategoryArtwork` therefore guards the write:
  `src/api/admin/product-categories/middlewares.ts` runs it on category create
  and update, merging the patch over the stored metadata for the same reason
  the product middleware does. There is no workflow-hook half here — Medusa
  exposes no category equivalent — so a category written by a path that never
  touches HTTP is unguarded.
- **`GET /admin/artwork/:id` returns a signed URL where the label route streams
  bytes.** That divergence is deliberate — a print-resolution file is far larger
  than a label PDF and there is no reason to move it through Medusa. Do not
  "unify" the two routes.
- **Promotion must never throw.** It runs on `order.placed`, after payment, and
  the repo rule that nothing after payment rolls back a paid order applies. It
  swallows every failure, which means the event bus never sees one to retry —
  so `promote-pending-artwork` (every 15 minutes) is the only retry there is.
  The row is claimed onto the order _before_ the copy so a failure still leaves
  the sweeper something to find, and a failed staging delete is not a failed
  promotion: the R2 lifecycle rule reaps the leftover, and treating it as a
  failure would send the sweeper back to re-copy an object already in place.
- **`STAGING_WINDOW_DAYS` must equal the bucket's `staging/` lifecycle rule.**
  Past it the staging object is gone, so the sweeper gives up once — marking
  the row `staging_expired` and logging `[artwork:promote-abandoned]` — rather
  than emitting a warn every 15 minutes forever on a tag that is an alerting
  target. The same cutoff retires upload rows that never reached an order
  (`never_ordered`); those rows are otherwise immortal, since a shopper who
  abandons a cart leaves one behind.
- **One upload can belong to two line items** — the same logo on two variants —
  so the subscriber claims an asset only when it is unclaimed. Re-claiming
  would repoint `line_item_id` at an item the stored key does not match.
- **`requestChecksumCalculation: "WHEN_REQUIRED"` on the S3 client is
  load-bearing.** Without it the SDK bakes `x-amz-checksum-crc32=AAAAAA==` —
  the CRC32 of an empty body, because presigning sees no body — into the signed
  query string, where a browser cannot strip it. MinIO ignores the mismatch, so
  this is the shape of bug that passes locally and fails only in production.
- **Retention lives in exactly one file**, `src/lib/artwork-retention.ts`.
  Nothing else reads `ARTWORK_RETENTION_DAYS` or
  `ARTWORK_RETENTION_FALLBACK_DAYS`. A blank value reads as unset rather than as
  zero — set-but-empty is what a half-filled deployment looks like, and zero
  means purge everything on the next run.
- **The window runs from delivery, and the upload fallback is not a ceiling.**
  An order delivered on day 56 still gets its full 30 days and purges on day 86,
  rather than being cut off at the day-61 upload fallback. **This is why R2's own
  lifecycle rules cannot own retention** — they can only age on creation date.
  The native rules cover the `staging/` prefix and a 180-day safety net on
  `artwork/`; that 180 is deliberately far past anything the job can produce and
  is not the policy. See [docs/dns.md](../../docs/dns.md).
- **Delivery has two sources and both count.** `deliveredAtByOrder` takes the
  earlier of the non-voided shipment's `delivered_at` and the `delivered`
  history entry, because the owner can move an order to delivered by hand and
  that leaves the shipment column null. The cross-module join lives in the purge
  job — neither module reaches into the other.
- **The purge job writes `artwork_asset` and nothing else.** That is what makes
  "deleting artwork does not touch the order" structural rather than a promise.
  Keep it that way.
- **Both `@aws-sdk` packages move together.** A version split between
  `client-s3` and `s3-request-presigner` puts two copies of `@smithy/types` in
  the tree and `getSignedUrl` stops accepting the `S3Client`, with a type error
  that names neither package.

## Order status and shipment tracking

`order-status` owns the owner-facing lifecycle — received → packing →
(in_production, unused until custom orders) → shipped → delivered, plus
cancelled — with an append-only history, the tracking record, and the webhook
idempotency ledger. The transition table itself lives in `@craftynp/types` so
the storefront types against the same contract.

- **A shipped fulfillment can never be cancelled.**
  `canCancelFulfillmentOrThrow` rejects anything with `shipped_at` or
  `delivered_at` set, at both the workflow and the module-service level. So
  `voidShipmentWorkflow` does not un-ship anything: it stamps `voided_at` on our
  tracking row and returns the order to `packing`. **Medusa's own
  `order.fulfillment_status` stays `shipped` and deliberately disagrees with our
  status.** Ours is the one the admin and storefront render. Do not "fix" the
  divergence by nulling `shipped_at` — that would also erase the history the
  status model exists to keep.
- **Customer-facing tracking reads our `ShipmentTracking` row filtered on
  `voided_at`, never the Medusa fulfillment labels.** Labels cannot be removed
  from a shipped fulfillment, so reading them directly would keep showing a dead
  tracking link after a void.
- **`recordShipmentWorkflow` must keep ending in `createOrderShipmentWorkflow`
  with `labels`.** That native shipment is what emits
  `FulfillmentWorkflowEvents.SHIPMENT_CREATED`, which is what sends the shipped
  email. Writing fulfilment state directly would silently stop the email.
- **The order is associated by an indexed unique `order_id` column, not a module
  link.** The tracking webhook arrives knowing only a tracking number, so it
  reaches the order in one in-module query. This repo still has no `defineLink`.
- **Never poll ShipStation for delivery progress.** It arrives on the `track`
  webhook. Polling on a timer is the usual way to exhaust the rate limit, and
  CNP-65 rules it out explicitly.
- **`/hooks/shipstation/track` needs `bodyParser: { preserveRawBody: true }`**
  in its `middlewares.ts` — the RSA-SHA256 signature covers
  `` `${timestamp}.${rawBody}` ``, so a reserialised body never verifies. Core's
  own `/hooks/payment/:provider` sets the same option; copy it rather than
  inventing one.
- **Once the signature verifies, the receiver answers 200 for everything it
  cannot act on** — unreadable payload, unknown tracking number, voided label,
  cancelled order. A 4xx to a webhook provider buys a retry storm, and each
  retry that got through would spend one of the 100 daily Resend sends. A
  genuine internal failure is the one case that returns 500, and it releases its
  idempotency claim first so the retry can actually reprocess.
- **`medusa db:generate` takes the module's registration name, not its folder
  name** — `orderStatus`, not `order-status`. The wrong one fails with an
  unhelpful "unknown module" and a list you have to read carefully.

## Email and notifications

Transactional email runs through `@medusajs/notification` with a custom Resend
provider in `src/modules/notification-resend`, fired by subscribers on
`order.placed` and `shipment.created`.

- **The email HTML is built in `order-email.ts`, not sent through a
  Resend-hosted template — this reverses an earlier decision.** Resend's REST
  API does not reliably apply `variables` to a `template.id` send on this
  account: every field, not only ones inside an `href`, silently fell back to
  its declared default in production (`#CNP-0000`, `$0.00`, empty line items —
  a `200` throughout, nothing errored). `order-confirmation` and
  `order-shipped` still exist as published Resend templates and render
  correctly in Resend's own dashboard preview — that is now their only
  purpose, as the design reference. **A brand change therefore has to be made
  in three places**, none of which the others can see: `order-email.ts`, the
  Resend templates, and the Auth0 Action in
  [docs/auth0-custom-email-provider.md](docs/auth0-custom-email-provider.md).
  CNP-79 updated all three; the password-reset Action is the easiest to miss,
  because it is the one live customer email with no code in `src/`. See
  [docs/auth0-custom-email-provider.md](docs/auth0-custom-email-provider.md)
  for where this was first found (in the password-reset Action) and confirmed.
- **`createNotifications({ content: { subject, html, text } })`, not
  `template`/`data`.** `content` is a first-class field on Medusa's own
  `CreateNotificationDTO`, so this needed no shape of our own — the provider's
  `send()` prefers `notification.content` when present and posts raw
  `html`/`text`/`subject` to Resend, falling back to `template.id` +
  `variables` only for a caller that doesn't set it. Do not trust that
  fallback path with anything that has a variable — it is the broken one.
- **A notification _provider_, not a bespoke service.** `INotificationProvider`
  is already the swappable seam, and the module's `notification` table records
  `status`, `external_id` and `idempotency_key` per send — the send log and the
  retry ledger without a migration of our own. It talks to Resend over raw
  `fetch`, like `shipstation`, so the mock-at-the-module-boundary testing rule
  applies unchanged.
- **`order-email-render.ts` still truncates a long order to a "+N more items"
  row**, now purely to keep one email a sane size — the original reason
  (Resend's 2,000-character template-variable cap) no longer applies, since
  nothing here is sent as a template variable.
- **Every interpolated value must go through `escapeHtml`** before landing in
  the HTML body — `order-email.ts` builds the email as a literal JS template
  string, so an unescaped value is a direct injection, not a framework quirk.
  `ORDER_ITEMS_HTML`/`SHIPPING_ADDRESS_HTML` are pre-escaped HTML fragments
  from `order-email-render.ts` and must not be escaped a second time; a
  shopper-supplied field like the customer's first name must be.
- **`shipment.created` carries a _fulfillment_ id, not an order id**, and
  `no_notification: true` means the operator suppressed the customer email.
  `order.fulfillment_created` is the convenient-looking wrong event: it fires
  when a fulfillment is created, not when it ships.
- **Keep the `retry-failed-notifications` job even though the event bus is
  Redis-backed.** The bus retries a subscriber that throws, but a Resend send
  that fails is caught and swallowed by the subscriber (see below), so the bus
  never sees a failure to retry. Without `REDIS_URL` the bus is in-memory and
  does not retry at all, which is the local and CI case. Either way the job is
  the only retry there is. It replays a failure under its original
  `idempotency_key` — which the module reprocesses only while the row is
  `FAILURE` — inside Resend's own 24-hour idempotency window. Retrying past
  that window would start duplicating rather than resuming.
- **A send failure never rolls back a paid order.** Both subscribers log and
  swallow, like the tax subscriber.
- **Monitoring here means stable warn-level log tags**, because nothing is
  deployed and there is no alerting sink until CNP-16. Attach alerts to
  `[email:send-failed]`, `[email:quota]`, `[email:quota-low]`,
  `[email:quota-daily]`, `[email:retry]`, `[email:retry-exhausted]`,
  `[email:order-failed]`, `[artwork:purge]`, `[artwork:purge-failed]`,
  `[artwork:promote]` and `[artwork:promote-failed]` rather than inventing an
  alerting system now.
- **`STOREFRONT_URL` is what builds the tokenized order link.** `order-email.ts`
  constructs `/checkout/confirmation?order=&number=&token=` independently of the
  storefront's own `checkoutConfirmationHref()`; the two drifting is the
  realistic bug, so that query contract is written down in both AGENTS files.
- Password reset is **not** sent from here — Auth0 owns it. See
  [docs/auth0-custom-email-provider.md](docs/auth0-custom-email-provider.md).

## Medusa runtime traps

None of these are caught by `tsc` or a mock-based test — they surface only
against a real container, schema, or workflow.

- **An order's totals _and its line quantities_ only come back when `items.*`
  is requested as a wildcard.** Narrowing either to the few columns you actually
  render makes `total`, `item_subtotal`, `shipping_subtotal` and `tax_total`
  all come back as **0** — no error, no warning, just a free order on the page
  and on the receipt. `ORDER_CONFIRMATION_FIELDS` keeps both wildcards for this
  reason.
- **Money fields come back as `BigNumber` instances, not numbers.** They carry
  `numeric_`/`raw_` and serialize to a plain number through `JSON.stringify`,
  so a `typeof x === "number"` check silently reads every amount as 0 while a
  console log of the same value looks correct. Route them through
  `toAmount()` in `order-confirmation.ts`.
- **A module service resolves registrations outside its own Awilix scope only if
  its `medusa-config.ts` entry lists them under `dependencies`** — other modules
  and core keys like `ContainerRegistrationKeys.QUERY` alike. An omission throws
  `AwilixResolutionError` on first call, not at boot.
- **`getTaxLines` must return a real `code` (`"sales_tax"`), never `null`**, even
  though the DTO type permits null — the tax-line tables' `code` column is
  non-nullable, so null passes typecheck and fails the insert.
- **`getTaxLines` is called separately for items and for shipping methods.**
  Stripe rejects an empty `line_items`, so the shipping-only path substitutes a
  placeholder item in the Stripe request only; it must never appear in the
  returned tax lines. It is not dead code.
- **`StripeTaxTaxProvider` uses `StripeTaxProviderOptions`
  (`Omit<StripeTaxOptions, "cacheTtlSeconds">`) with its own validator.** Do not
  merge the two option shapes — the provider is never given `cacheTtlSeconds`,
  so full-shape validation throws the first time a cart needs tax lines.
- **`calculatePrice` must re-query variant and product dimensions itself**
  rather than trusting `context.items[].variant`. Medusa's cart-refresh context
  never fetches product-level length/width/height, so a variant relying on them
  always looks incomplete.
- **`createShippingOptionsWorkflow` validates a fulfillment provider against the
  stock locations actually linked to the service zone's fulfillment set**, not
  against `medusa-config.ts` — `link.create` the provider onto the stock
  location first.

Verify provider, seed, and checkout-route changes with `pnpm run db:migrate` and
a real `pnpm run dev` checkout, not `tsc`/`jest` alone.

## Migrations and seeds

`pnpm run db:migrate` runs every script in `src/migration-scripts/` and prints
the `pk_…` publishable key the storefront needs (from `seed-defaults.ts`). There
is no `db:seed` — the Medusa starter seed and its demo data were deleted in
CNP-79.

- **Add a new seed as a new file, never an edit to an existing one.** The ledger
  tracks each script independently, so a new file still runs against an
  already-migrated database while an edit to an already-run script does nothing.
- **The `script_migrations` ledger keys on the script's basename, not its
  path.** Renaming a script re-runs it, and deleting one leaves its ledger row
  behind, so a database migrated before a deletion keeps whatever that script
  created. That is why dev databases seeded before CNP-79 still carry the
  Europe region and the four demo products; see the cleanup section in
  [README.md](../../README.md).
- **Scripts run in filename order** — name a new one so it sorts after any seed
  whose data it depends on.
- **`createDefaultsWorkflow` runs at application start, not during
  `db:migrate`.** `medusa db:migrate` forks `db:migrate:scripts`, which loads
  the modules but never calls it, so the default sales channel, store, and
  publishable key do not exist while the seeds run. `seed-defaults.ts` runs it
  itself, which is why that script must keep sorting first: `seed-us-region.ts`
  hard-fails on a missing "Default Sales Channel". It also corrects the store's
  `supported_currencies` to USD-default, because core's `createDefaultStoreStep`
  hardcodes EUR-only.
- **Every environment gets exactly one region, United States.** A second region
  is not a harmless addition — it changes the currency the storefront quotes in
  and which shipping options a cart is offered, both silently.
- **`db:migrate` needs a fully populated `.env`.** `seed-us-region.ts` throws on
  a missing `SHIP_FROM_*` or `SHIPPING_OPTION_DEFAULT_*`, so a partly-filled
  environment fails the migration rather than half-configuring the store.
- **The ship-from address comes from `SHIP_FROM_*` env**, never hard-coded into
  a migration script, so the client's real address stays out of git.
- **Product validation is a workflow hook** on `createProductsWorkflow` /
  `updateProductsWorkflow`, not route middleware — a status-only publish,
  `/admin/products/batch`, CSV import, and custom workflows all bypass HTTP.
  Add any similar guard to `src/workflows/hooks/validate-products.ts`, which is
  where the shipping-dimension and customization guards both run. **It has to be
  that one file:** Medusa throws on a second handler for a hook it has already
  registered, so a new guard is a call added inside the existing handler, never
  a new hook file.
- **That hook rejects the save but cannot undo it, which is why
  `src/api/admin/products/middlewares.ts` exists as well.** The only hooks
  core exposes are `productsCreated` / `productsUpdated`, both of which run
  _after_ the write, so a guard throwing there relies on the workflow
  compensating. `updateProductsStep` compensates only its `products: [{ id }]`
  branch; `POST /admin/products/:id` — the dashboard's own save — calls the
  workflow with `selector` + `update`, whose compensation restores nothing.
  The result was a 400 in the admin with the bad metadata written anyway, and
  a product then wedged: the stored value failed the guard on every later save,
  so it could not be corrected from the UI. Verified against a real container
  in both shapes; the batch shape does roll back.
  The middleware therefore re-runs **the same two `assert*` functions** on the
  incoming update merged over the stored product, before the route reaches the
  workflow. **It duplicates no rules** — the rules stay in `@craftynp/types`
  and the `src/lib` guards — and it must keep merging rather than validating
  the body alone, because Medusa merges product metadata (a patch of one key
  leaves the rest in place). Deleting it does not fail a test that mocks the
  workflow; it fails only against a real save, which is how this was found.
  The hook stays as the catch-all for every path that never touches HTTP.
- **A malformed customization declaration is rejected at any status; an
  incomplete one only on publish.** A contradictory record — the flag off with
  an input still on — or a value outside the registry's vocabulary is wrong
  whatever the status. A product that is customizable but asks for nothing is a
  draft mid-setup, and is refused only when it is published, the same line the
  shipping-dimension guard draws.

## Testing

Node environment, `@swc/jest`, no jsdom. Tests live **beside the code they
cover** (`src/lib/validate-customization.ts` →
`src/lib/validate-customization.test.ts`); `roots` is `["<rootDir>/src"]`, so
that is the only place they are picked up. Nothing under `src/admin` can be
rendered here.

`jest.config.js` maps `@craftynp/types` to the package's `src/` rather than its
`dist/` on purpose, so tests need no prior build — do not "correct" it.
