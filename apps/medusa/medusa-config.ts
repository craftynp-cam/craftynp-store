import {
  ContainerRegistrationKeys,
  defineConfig,
  loadEnv,
  Modules,
} from "@medusajs/framework/utils";

import { SHIPSTATION_MODULE } from "./src/modules/shipstation";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
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
  modules: [
    { resolve: "./src/modules/site-content" },
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
        maxRetries: Number(process.env.SHIPSTATION_MAX_RETRIES ?? 2),
        weightUnit: process.env.SHIPSTATION_WEIGHT_UNIT ?? "gram",
        dimensionUnit: process.env.SHIPSTATION_DIMENSION_UNIT ?? "centimeter",
        cacheTtlSeconds: Number(
          process.env.SHIPSTATION_RATE_CACHE_TTL_SECONDS ?? 900,
        ),
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
      dependencies: [SHIPSTATION_MODULE],
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
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              backend_url: `${process.env.MEDUSA_BACKEND_URL}/static`,
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
