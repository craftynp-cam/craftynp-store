import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  brandColors,
  modes,
  pairingsFor,
  palette,
  radiusScale,
  semanticTokens,
  surfaceTokens,
  tokenDeclaration,
  tokenHex,
  typeScale,
} from "@/lib/design-tokens";

const srcDir = join(__dirname, "..");

/** Prettier reflows long declarations, so compare everything on one line. */
function normalise(css: string): string {
  return css.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
}

const globalsCss = normalise(
  readFileSync(join(srcDir, "app", "globals.css"), "utf8"),
);

describe("globals.css", () => {
  it("follows the OS by default", () => {
    expect(globalsCss).toContain("color-scheme: light dark;");
  });

  it.each(modes)("lets the toggle pin %s via data-theme", (mode) => {
    expect(globalsCss).toContain(
      `:root[data-theme="${mode}"] { color-scheme: ${mode}; }`,
    );
  });

  it("drives the modes off color-scheme rather than a media query", () => {
    // light-dark() reads color-scheme, which is what makes one data-theme
    // attribute flip both the tokens and the native form controls.
    expect(globalsCss).not.toContain("prefers-color-scheme");
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
  it.each(
    semanticTokens.map((token) => [token.token, tokenDeclaration(token)]),
  )("--t-%s is declared as %s", (token, declaration) => {
    expect(globalsCss).toContain(`--t-${token}: ${declaration};`);
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

describe("layout", () => {
  const layout = readFileSync(join(srcDir, "app", "layout.tsx"), "utf8");

  it.each(["Libre_Baskerville", "Source_Sans_3"])("loads %s", (font) => {
    expect(layout).toContain(font);
  });

  it("sets font-display: swap on both families", () => {
    expect(layout.match(/display: "swap"/g)).toHaveLength(2);
  });

  it("runs the theme script in <head> so a pinned mode lands before paint", () => {
    const head = layout.slice(
      layout.indexOf("<head>"),
      layout.indexOf("</head>"),
    );
    expect(head).toContain("themeInitScript");
  });

  it("suppresses the hydration warning that script necessarily causes", () => {
    // The script sets data-theme on <html> before React hydrates, so the
    // server markup cannot match. Without this, every page logs an error.
    expect(layout).toMatch(/<html[\s\S]*?suppressHydrationWarning[\s\S]*?>/);
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
