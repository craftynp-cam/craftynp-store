import base from "../../eslint.config.mjs";

export default [
  ...base,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
