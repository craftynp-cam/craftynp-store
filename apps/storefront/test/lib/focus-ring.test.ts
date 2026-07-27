import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastRatio } from "@/lib/contrast";
import { modes, surfaceTokens, tokenHex } from "@/lib/design-tokens";

/**
 * CNP-22 AC 2: every interactive primitive's focus ring must reach 3:1 against
 * the background it appears on. HeroUI paints the ring from its `--focus`
 * variable, which globals.css bridges to one of our tokens — so the guarantee
 * is a property of that one mapping, checked here in both modes.
 */

/** WCAG 1.4.11 Non-text Contrast. */
const MINIMUM_RATIO = 3;

/** The token globals.css assigns to HeroUI's --focus. */
const RING_TOKEN = "primary";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");

describe("focus ring", () => {
  it("is wired to the token this suite measures", () => {
    // Guards against the CSS drifting away from the assertions below.
    expect(css).toMatch(new RegExp(`--focus:\\s*var\\(--t-${RING_TOKEN}\\)`));
  });

  describe.each(modes)("in %s mode", (mode) => {
    it.each(surfaceTokens)("clears 3:1 against %s", (surface) => {
      const ratio = contrastRatio(
        tokenHex(RING_TOKEN, mode),
        tokenHex(surface, mode),
      );

      expect(ratio).toBeGreaterThanOrEqual(MINIMUM_RATIO);
    });
  });

  it("rejects gold, which fails the bar on light surfaces", () => {
    // Recorded because gold is the obvious choice — it is the brand's
    // attention colour — and it is wrong. Should this ever start passing, the
    // palette has changed and the ring choice deserves revisiting.
    const ratios = surfaceTokens.map((surface) =>
      contrastRatio(tokenHex("gold", "light"), tokenHex(surface, "light")),
    );

    expect(Math.max(...ratios)).toBeLessThan(MINIMUM_RATIO);
  });
});
