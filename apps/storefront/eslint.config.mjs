import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import base from "../../eslint.config.mjs";

const eslintConfig = defineConfig([
  ...base,
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // eslint-plugin-react (vendored by eslint-config-next) cannot auto-detect
    // the React version under ESLint 10 — its detection path uses the removed
    // context.getFilename() API. Pinning the version skips that path entirely.
    settings: { react: { version: "19.2" } },
  },
  {
    files: ["{src,test}/**/*.ts", "{src,test}/**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
]);

export default eslintConfig;
