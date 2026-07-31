# AGENTS.md — Medusa backend

Medusa 2.18 on port **9000**, admin dashboard at **`/app`**. Shared zod schemas
come from `@craftynp/types`. Repo-wide setup, commands, and conventions are in
the root [AGENTS.md](../../AGENTS.md).

Custom modules live in `src/modules` and are registered in `medusa-config.ts`:
`site-content`, `shipstation` and `shipstation-fulfillment`, `stripe-tax` (which
registers both a module and a tax provider), `auth-auth0`, and
`auth-google-workspace`.

## Layout and config

- **Site-content fields are declared by the `SITE_CONTENT_FIELDS` registry in
  `@craftynp/types`, not by the `siteContent` module.** Adding a field —
  including an `image` field, whose stored value is just the URL string — is a
  registry change, never a migration.
- **`src/admin` typechecks separately.** It is the only `.tsx` here and needs
  DOM lib types the Node-only backend doesn't carry, so `tsconfig.json` excludes
  it and `typecheck` runs a second `tsc -p src/admin --noEmit`. Put a file that
  needs DOM types under `src/admin`, and nothing else there.
- **Admin extensions use `@medusajs/ui`, `@medusajs/admin-sdk`, and
  `@tanstack/react-query`.** Never import storefront components — they are
  HeroUI on React 19 and will not run in the React 18 admin bundle.
- **Keep `@medusajs/medusa/file` registered explicitly**, with the `file-local`
  provider's `backend_url` built from `MEDUSA_BACKEND_URL`. It looks like
  redundant boilerplate, but `defineConfig`'s implicit default hardcodes
  `http://localhost:9000/static`, which silently disagrees with the storefront's
  `images.remotePatterns`.
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
  does not touch Auth0 itself.
- **Never register `@medusajs/auth-google`.** It is a dependency but is
  deliberately unregistered: it ignores the `hd` claim, so any personal Gmail
  account would authenticate as an admin. The real gate is server-side in
  `auth-google-workspace/lib.ts` and requires both the verified `hd` claim and
  the email's own domain to match — the `hd` param on the authorize URL is only
  a UI hint. Do not collapse that two-part check.
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
Verification" Post-Login Action, and Attack Protection; the Google Cloud OAuth
Web client whose redirect URI must exactly match `GOOGLE_ADMIN_CALLBACK_URL`;
the Workspace org's 2-Step Verification policy; and Stripe Tax's nexus and
per-state registrations. Workspace 2SV is the real MFA enforcement — Medusa's
TOTP is config-only and opt-in per identity, so do not implement enrolment.

## Money, units, and external APIs

- **Weights are grams and dimensions centimetres everywhere.** Medusa enforces
  no units of its own, so `SHIPSTATION_WEIGHT_UNIT` / `_DIMENSION_UNIT` must
  agree with how products are actually stored or a rate silently quotes the
  wrong parcel.
- **Every amount is decimal major units.** `src/modules/stripe-tax` is the only
  place minor units exist, crossed solely by `toMinorUnits` / `fromMinorUnits`
  in its `lib.ts`. Leaking cents outside that module multiplies money by 100.
- **Resolve weight, dimensions, and `calculated_price` server-side via
  `query.graph`.** Request bodies carry only `{ variantId, quantity }` — never
  accept a client-supplied weight or price anywhere in this app.
- **There is no flat-rate shipping fallback, deliberately.** A missing-dimension
  parcel or any ShipStation error returns `502 shipping_unavailable` and blocks
  checkout, because a wrong shipping charge is worse than a shopper hitting
  Retry. `SHIPPING_OPTION_DEFAULT_AMOUNT` / `_LABEL` is a seeded catalogue
  price, not a checkout-time fallback. Do not add one.
- **ShipStation's `/v2/rates/estimate` response is not purchasable** and
  excludes surcharges, so its `rate_id` cannot be looked up again later.
  Re-verify a quote by re-estimating and comparing the fresh amount within a
  tolerance, never by replaying the `rate_id`.
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
- **`Order` has no `cart_id` column** — the association is the `order_cart`
  module link table. Query `entity: "order_cart"` filtered on `cart_id`;
  filtering `entity: "order"` by `cart_id` makes MikroORM throw at runtime.
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
- **The `order.placed` tax subscriber must keep passing the order id as the
  Stripe transaction `reference`** — that uniqueness constraint is the only
  guard against double-recording on retry. A failure logs and never rolls back
  the paid order.
- **`getTaxLines` returns rates while Stripe Tax returns amounts**, so the
  cart's tax can drift up to ~1¢ per line from the Stripe calculation. That is
  the accepted tradeoff, not a bug, and the tax provider is deliberately
  uncached unlike the sibling module service.

## Medusa runtime traps

None of these are caught by `tsc` or a mock-based test — they surface only
against a real container, schema, or workflow.

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
the `pk_…` publishable key the storefront needs.

- **Add a new seed as a new file, never an edit to an existing one.** The ledger
  tracks each script independently, so a new file still runs against an
  already-migrated database while an edit to an already-run script does nothing.
- **Scripts run in filename order** — name a new one so it sorts after any seed
  whose data it depends on.
- **The ship-from address comes from `SHIP_FROM_*` env**, never hard-coded into
  a migration script, so the client's real address stays out of git.
- **`pnpm run db:seed` is only for a database you have deliberately reset.**
  `db:migrate` already seeds through the ledger; `db:seed` runs outside it,
  minting a second publishable key and duplicating products.
- **Shipping-dimension validation for publishable products is a workflow hook**
  on `createProductsWorkflow` / `updateProductsWorkflow`, not route middleware —
  a status-only publish, `/admin/products/batch`, CSV import, and custom
  workflows all bypass HTTP. Add any similar guard there.

## Testing

Node environment, `@swc/jest`, no jsdom. Tests live **beside the code they
cover** (`src/lib/validate-customization.ts` →
`src/lib/validate-customization.test.ts`); `roots` is `["<rootDir>/src"]`, so
that is the only place they are picked up. Nothing under `src/admin` can be
rendered here.

`jest.config.js` maps `@craftynp/types` to the package's `src/` rather than its
`dist/` on purpose, so tests need no prior build — do not "correct" it.

This app holds **203** of the repo's 1073 tests.
