import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastRatio } from "@/lib/contrast";
import {
  derivedNeutrals,
  pairings,
  palette,
  radiusScale,
  typeScale,
} from "@/lib/design-tokens";

// Prettier reflows long declarations across lines, so compare on a single line.
const globalsCss = readFileSync(
  join(__dirname, "..", "app", "globals.css"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")");

describe("palette", () => {
  it.each(palette.map((token) => [token.name, token.utility, token.hex]))(
    "%s is declared in globals.css",
    (_name, utility, hex) => {
      expect(globalsCss).toContain(`--color-${utility}: ${hex};`);
    },
  );

  it("keeps raw hex out of everything but the token layer", () => {
    const componentSources = [
      join(__dirname, "..", "app", "page.tsx"),
      join(__dirname, "..", "app", "design", "page.tsx"),
      join(__dirname, "..", "components", "product-list-item.tsx"),
    ];

    for (const source of componentSources) {
      expect(readFileSync(source, "utf8")).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });
});

describe("derived neutrals", () => {
  it.each(derivedNeutrals.map((token) => [token.utility, token.inkOpacity]))(
    "%s is mixed from ink navy at %s",
    (utility, opacity) => {
      expect(globalsCss).toContain(
        `--color-${utility}: color-mix(in srgb, var(--color-ink) ${Math.round(
          opacity * 100,
        )}%, var(--color-off-white));`,
      );
    },
  );
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

describe("contrast", () => {
  const textPairings = pairings.filter((pair) => pair.intent === "text");
  const decorativePairings = pairings.filter(
    (pair) => pair.intent === "decorative",
  );

  it.each(textPairings.map((pair) => [pair.foreground, pair.background]))(
    "%s on %s meets 4.5:1",
    (foreground, background) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("documents why every sub-4.5:1 pairing is allowed", () => {
    for (const pair of decorativePairings) {
      expect(pair.note).toBeTruthy();
    }
  });
});

describe("fonts", () => {
  const layout = readFileSync(
    join(__dirname, "..", "app", "layout.tsx"),
    "utf8",
  );

  it.each(["Libre_Baskerville", "Source_Sans_3"])(
    "loads %s with font-display: swap",
    (font) => {
      expect(layout).toContain(font);
    },
  );

  it("sets display swap on both families", () => {
    expect(layout.match(/display: "swap"/g)).toHaveLength(2);
  });
});
