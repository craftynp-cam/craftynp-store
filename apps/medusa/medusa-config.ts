import {
  ContainerRegistrationKeys,
  defineConfig,
  loadEnv,
  Modules,
} from "@medusajs/framework/utils";

import { SHIPSTATION_MODULE } from "./src/modules/shipstation";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// Absent REDIS_URL — a clone that has not run `pnpm run services:up`, and every
// CI build — Medusa keeps its in-memory cache, event bus, workflow engine and
// locks, so neither local development nor `pnpm run build` needs Redis at all.
// Set, all four become shared, which is what lets the server and the worker run
// as separate processes.
const redisUrl = process.env.REDIS_URL;

const redisModules = redisUrl
  ? [
      // Modules.CACHE. src/lib/rate-limit.ts keeps its window counters here, so
      // this is what turns them from per-process into a real shared ceiling.
      // Deliberately no per-service namespace: sharing it is the point.
      { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl } },
      { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl } },
      // Nested under `redis`, unlike every other module here. Its published
      // RedisWorkflowsOptions type says the keys are top-level and is wrong:
      // the loader destructures `options.redis`, so a flat `redisUrl` boots
      // with "Cannot destructure property 'url' of '(intermediate value)'".
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { redisUrl } },
      },
      // locking-redis is a provider of the Locking module, not a module —
      // registering it as one fails the build with "No service found in module
      // Locking".
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl },
            },
          ],
        },
      },
    ]
  : [];

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Also what wires express-session's store. Unset, admin sessions live in
    // the per-process MemoryStore and are lost on every redeploy.
    redisUrl,
    // "shared" is one process doing both, which is local development. The two
    // deployed services run this same image with "server" and "worker".
    workerMode: (process.env.MEDUSA_WORKER_MODE ?? "shared") as
      "shared" | "server" | "worker",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
      authMethodsPerActor: {
        user: ["google-workspace"],
        customer: ["auth0"],
      },
    },
  },
  admin: {
    // The worker has no admin worth serving, and building one on a second
    // service is wasted deploy time.
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    // backendUrl is deliberately left unset. It is baked into the admin bundle
    // at build time, and unset bakes "" — relative, same-origin calls — which
    // is the only value that works identically on localhost:9000, the
    // *.up.railway.app hostname and api.thecraftynp.com. It also means the
    // dashboard is never cross-origin, so ADMIN_CORS never has to name it.
  },
  modules: [
    ...redisModules,
    { resolve: "./src/modules/site-content" },
    {
      resolve: "./src/modules/order-status",
      dependencies: [
        ContainerRegistrationKeys.QUERY,
        ContainerRegistrationKeys.LOGGER,
      ],
    },
    {
      resolve: "./src/modules/shipstation",
      dependencies: [Modules.CACHE],
      options: {
        apiKey: process.env.SHIPSTATION_API_KEY,
        baseUrl: process.env.SHIPSTATION_BASE_URL,
        uspsCarrierId: process.env.SHIPSTATION_USPS_CARRIER_ID,
        rateLimitPerMinute: Number(
          process.env.SHIPSTATION_RATE_LIMIT_PER_MINUTE ?? 20,
        ),
        timeoutMs: Number(process.env.SHIPSTATION_TIMEOUT_MS ?? 5000),
        labelTimeoutMs: Number(
          process.env.SHIPSTATION_LABEL_TIMEOUT_MS ?? 30000,
        ),
        maxRetries: Number(process.env.SHIPSTATION_MAX_RETRIES ?? 2),
        weightUnit: process.env.SHIPSTATION_WEIGHT_UNIT ?? "gram",
        dimensionUnit: process.env.SHIPSTATION_DIMENSION_UNIT ?? "centimeter",
        cacheTtlSeconds: Number(
          process.env.SHIPSTATION_RATE_CACHE_TTL_SECONDS ?? 900,
        ),
        testLabels: process.env.SHIPSTATION_TEST_LABELS !== "false",
        fromName: process.env.SHIP_FROM_NAME,
        fromPhone: process.env.SHIP_FROM_PHONE,
        fromCompany: process.env.SHIP_FROM_COMPANY,
        fromAddress1: process.env.SHIP_FROM_ADDRESS_1,
        fromAddress2: process.env.SHIP_FROM_ADDRESS_2,
        fromCity: process.env.SHIP_FROM_CITY,
        fromState: process.env.SHIP_FROM_STATE,
        fromCountryCode: process.env.SHIP_FROM_COUNTRY_CODE,
        fromPostalCode: process.env.SHIP_FROM_POSTAL_CODE,
      },
    },
    {
      resolve: "./src/modules/stripe-tax",
      dependencies: [Modules.CACHE],
      options: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        defaultTaxCode: process.env.STRIPE_TAX_DEFAULT_TAX_CODE,
        shippingTaxCode: process.env.STRIPE_TAX_SHIPPING_TAX_CODE,
        timeoutMs: Number(process.env.STRIPE_TAX_TIMEOUT_MS ?? 5000),
        maxRetries: Number(process.env.STRIPE_TAX_MAX_RETRIES ?? 2),
        cacheTtlSeconds: Number(
          process.env.STRIPE_TAX_CACHE_TTL_SECONDS ?? 900,
        ),
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_SECRET_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              capture: true,
              automaticPaymentMethods: true,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      dependencies: [SHIPSTATION_MODULE, ContainerRegistrationKeys.QUERY],
      options: {
        providers: [
          { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
          {
            resolve: "./src/modules/shipstation-fulfillment",
            id: "shipstation",
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/tax",
      options: {
        providers: [
          {
            resolve: "./src/modules/stripe-tax/tax-provider-module",
            id: "stripe",
            options: {
              secretKey: process.env.STRIPE_SECRET_KEY,
              defaultTaxCode: process.env.STRIPE_TAX_DEFAULT_TAX_CODE,
              shippingTaxCode: process.env.STRIPE_TAX_SHIPPING_TAX_CODE,
              timeoutMs: Number(process.env.STRIPE_TAX_TIMEOUT_MS ?? 5000),
              maxRetries: Number(process.env.STRIPE_TAX_MAX_RETRIES ?? 2),
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/notification-resend",
            id: "resend",
            options: {
              channels: ["email"],
              apiKey: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM_EMAIL,
              replyTo: process.env.RESEND_REPLY_TO,
              timeoutMs: Number(process.env.RESEND_TIMEOUT_MS ?? 5000),
              maxRetries: Number(process.env.RESEND_MAX_RETRIES ?? 2),
              dailyQuotaAlertThreshold: Number(
                process.env.RESEND_DAILY_QUOTA_ALERT_THRESHOLD ?? 20,
              ),
            },
          },
        ],
      },
    },
    {
      // Site-content and product imagery. A deployed container's filesystem is
      // ephemeral, so file-local would destroy every image the owner uploaded
      // on the next deploy. This bucket is public, and is NOT the labels
      // bucket — see src/lib/label-storage.ts and AGENTS.md for why the two
      // cannot be one.
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.FILE_STORAGE_PUBLIC_URL,
              endpoint: process.env.FILE_STORAGE_ENDPOINT,
              region: process.env.FILE_STORAGE_REGION ?? "auto",
              bucket: process.env.FILE_STORAGE_BUCKET,
              access_key_id: process.env.FILE_STORAGE_ACCESS_KEY_ID,
              secret_access_key: process.env.FILE_STORAGE_SECRET_ACCESS_KEY,
              // R2 has no object-level ACLs and rejects the header. `false` is
              // not the same as omitting this: it omits the ACL header, where
              // omitting the option would send `public-read`.
              acl: false,
              additional_client_config: {
                forcePathStyle:
                  process.env.FILE_STORAGE_FORCE_PATH_STYLE !== "false",
              },
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          { resolve: "@medusajs/medusa/auth-emailpass", id: "emailpass" },
          {
            resolve: "./src/modules/auth-auth0",
            id: "auth0",
            options: {
              domain: process.env.AUTH0_DOMAIN,
              clientId: process.env.AUTH0_CLIENT_ID,
              clientSecret: process.env.AUTH0_CLIENT_SECRET,
              callbackUrl: process.env.AUTH0_CALLBACK_URL,
            },
          },
          {
            resolve: "./src/modules/auth-google-workspace",
            id: "google-workspace",
            options: {
              clientId: process.env.GOOGLE_ADMIN_CLIENT_ID,
              clientSecret: process.env.GOOGLE_ADMIN_CLIENT_SECRET,
              callbackUrl: process.env.GOOGLE_ADMIN_CALLBACK_URL,
              allowedDomain: process.env.GOOGLE_ADMIN_ALLOWED_DOMAIN,
            },
          },
        ],
        mfa: {
          encryption_key: process.env.MFA_ENCRYPTION_KEY,
          providers: [{ id: "totp", options: { issuer: "The Crafty NP" } }],
        },
      },
    },
  ],
});
