import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  // Deliberately NOT setting customExportConditions to include "import".
  // Doing so applies to every package, so any dependency whose exports map
  // lists "import" before "require" (dedent, via tailwind-variants) resolves
  // to an .mjs that Jest classifies as native ESM and then fails to load.
  // HeroUI's subpaths are mapped directly below instead.
  // HeroUI, the React Aria packages beneath it, and a long tail of their
  // transitive dependencies are ESM-only and untranspiled, so Jest has to
  // transform node_modules rather than skip it. An allowlist was tried first
  // and does not hold: the tail keeps growing (dedent arrived via
  // tailwind-variants). Transforming everything costs a slower cold run and
  // nothing afterwards, because Jest caches per file.
  transformIgnorePatterns: ["^.+\\.module\\.(css|sass|scss)$"],
  moduleNameMapper: {
    // HeroUI's exports map offers only "import" and "types", so Jest's CJS
    // resolver finds no candidate at all. Point the subpaths at the files
    // directly; transformIgnorePatterns above lets SWC convert them.
    "^@heroui/react/(.*)$":
      "<rootDir>/node_modules/@heroui/react/dist/components/$1/index.js",
    "^@heroui/react$": "<rootDir>/node_modules/@heroui/react/dist/index.js",
    "^@craftynp/types$": "<rootDir>/../../packages/types/src/index.ts",
    // The shared package's source uses NodeNext `./foo.js` specifiers that
    // point at `./foo.ts`; strip the extension so Jest can resolve them.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};

export default async function jestConfig() {
  const nextConfig = await createJestConfig(config)();

  // next/jest replaces transformIgnorePatterns with its own; ours has to win or
  // every HeroUI import arrives as untransformed ESM.
  return {
    ...nextConfig,
    transformIgnorePatterns: config.transformIgnorePatterns,
  };
}
