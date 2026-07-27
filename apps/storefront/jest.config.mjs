import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@craftynp/types$": "<rootDir>/../../packages/types/src/index.ts",
    // The shared package's source uses NodeNext `./foo.js` specifiers that
    // point at `./foo.ts`; strip the extension so Jest can resolve them.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};

export default createJestConfig(config);
