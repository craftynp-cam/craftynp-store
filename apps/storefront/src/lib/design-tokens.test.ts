import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  brandColors,
  cssValue,
  modes,
  pairingsFor,
  palette,
  radiusScale,
  semanticTokens,
  surfaceTokens,
  tokenHex,
  typeScale,
  type Mode,
} from "@/lib/design-tokens";

const srcDir = join(__dirname, "..");

/** Prettier reflows long declarations, so compare everything on one line. */
function normalise(css: string): string {
  return css.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
}

const globalsCss = normalise(
  readFileSync(join(srcDir, "app", "globals.css"), "utf8"),
);

/**
 * The light values live in `:root`, the dark ones inside the
 * prefers-color-scheme block. Slicing them apart stops a token that is only
 * declared for one mode from passing the drift check for both.
 */
const darkBlockStart = globalsCss.indexOf(
  "@media (prefers-color-scheme: dark)",
);

const cssByMode: Record<Mode, string> = {
  light: globalsCss.slice(0, darkBlockStart),
  dark: globalsCss.slice(darkBlockStart),
};

describe("globals.css", () => {
  it("declares a dark block", () => {
    expect(darkBlockStart).toBeGreaterThan(-1);
  });

  it("sets color-scheme for both modes", () => {
    expect(cssByMode.light).toContain("color-scheme: light;");
    expect(cssByMode.dark).toContain("color-scheme: dark;");
  });
});

describe("palette", () => {
  it.each(palette.map((token) => [token.name, token.utility]))(
    "%s is declared once, in the theme block",
    (_name, utility) => {
      expect(globalsCss).toContain(
        `--color-${utility}: ${brandColors[utility]};`,
      );
    },
  );

  it("keeps raw hex out of component code", () => {
    const componentSources = [
      join(srcDir, "app", "page.tsx"),
      join(srcDir, "app", "design", "page.tsx"),
      join(srcDir, "components", "product-list-item.tsx"),
    ];

    for (const source of componentSources) {
      expect(readFileSync(source, "utf8")).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });
});

describe("semantic tokens", () => {
  const cases = modes.flatMap((mode) =>
    semanticTokens.map((token) => [mode, token.token, cssValue(token[mode])]),
  );

  it.each(cases)("%s: --t-%s is declared as %s", (mode, token, value) => {
    expect(cssByMode[mode as Mode]).toContain(`--t-${token}: ${value};`);
  });

  it.each(semanticTokens.map((token) => [token.token]))(
    "%s is aliased into the theme so utilities follow the mode",
    (token) => {
      expect(globalsCss).toContain(`--color-${token}: var(--t-${token});`);
    },
  );

  it("gives light and dark a distinct page and text colour", () => {
    for (const token of ["background", "foreground"]) {
      expect(tokenHex(token, "light")).not.toBe(tokenHex(token, "dark"));
    }
  });
});

describe("scales", () => {
  it.each(typeScale.map((step) => [step.utility, step.size, step.lineHeight]))(
    "%s is declared at %s",
    (utility, size, lineHeight) => {
      const name = utility.replace("text-", "");
      expect(globalsCss).toContain(`--text-${name}: ${size};`);
      expect(globalsCss).toContain(
        `--text-${name}--line-height: ${lineHeight};`,
      );
    },
  );

  it("declares the soft radius scale", () => {
    for (const step of radiusScale) {
      if (step.utility === "rounded-full") continue;
      const name = step.utility.replace("rounded-", "");
      expect(globalsCss).toContain(`--radius-${name}: ${step.value};`);
    }
  });

  it("uses a 4px spacing base", () => {
    expect(globalsCss).toContain("--spacing: 0.25rem;");
  });
});

describe.each(modes)("contrast in %s mode", (mode) => {
  const pairings = pairingsFor(mode);

  const textCases = pairings
    .filter((pairing) => pairing.intent === "text")
    .map((pairing) => [pairing.foreground, pairing.background, pairing.ratio]);

  it.each(textCases)(
    "%s on %s meets 4.5:1",
    (_foreground, _background, ratio) =>
      expect(ratio).toBeGreaterThanOrEqual(4.5),
  );

  it("documents every pairing that falls below 4.5:1", () => {
    for (const pairing of pairings) {
      if (pairing.ratio >= 4.5) continue;
      expect(pairing.intent).toBe("decorative");
      expect(pairing.note).toBeTruthy();
    }
  });

  it("keeps every surface distinguishable from the page", () => {
    for (const surface of surfaceTokens) {
      if (surface === "background") continue;
      expect(tokenHex(surface, mode)).not.toBe(tokenHex("background", mode));
    }
  });
});
