import {
  loadEnv,
  defineConfig,
  Modules,
  ContainerRegistrationKeys,
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
      // Customers authenticate through Auth0; emailpass stays registered so
      // the admin dashboard (the `user` actor) keeps its own sign-in.
      authMethodsPerActor: {
        user: ["emailpass"],
        customer: ["auth0"],
      },
    },
  },
  modules: [
    { resolve: "./src/modules/site-content" },
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
        ],
      },
    },
  ],
});
