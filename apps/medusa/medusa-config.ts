import {
  ContainerRegistrationKeys,
  defineConfig,
  loadEnv,
  Modules,
} from "@medusajs/framework/utils";

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
