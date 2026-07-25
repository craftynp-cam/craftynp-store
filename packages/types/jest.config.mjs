/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": ["@swc/jest", { jsc: { target: "es2022" } }],
  },
  // The source uses NodeNext-style ".js" specifiers that point at emitted files.
  // Jest resolves against the TypeScript sources, so strip the extension.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
