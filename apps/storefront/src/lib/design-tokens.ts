import { contrastRatio, mixOver, parseHex, toHex } from "@/lib/contrast";

/**
 * A TypeScript mirror of the tokens defined in `src/app/globals.css`, so the
 * reference page can measure and document them. `design-tokens.test.ts` fails
 * if the two ever drift, and enforces the contrast floor in both modes.
 */

export const brandColors = {
  gold: "#ebb805",
  mint: "#85dfc3",
  blush: "#ecdad1",
  ink: "#04133b",
  "off-white": "#fbfaf7",
  "muted-black": "#1f1e1c",
  alert: "#b4574a",
  // Tailwind's own --color-white. Not a brand colour; the light-mode card surface.
  white: "#ffffff",
} as const;

export type BrandName = keyof typeof brandColors;

export type ColorSpec =
  { brand: BrandName } | { mix: BrandName; percent: number; over: BrandName };

/** The exact CSS the token declares, for the drift check. */
export function cssValue(spec: ColorSpec): string {
  if ("brand" in spec) return `var(--color-${spec.brand})`;
  return `color-mix(in srgb, var(--color-${spec.mix}) ${spec.percent}%, var(--color-${spec.over}))`;
}

export function resolveHex(spec: ColorSpec): string {
  if ("brand" in spec) return brandColors[spec.brand];
  return toHex(
    mixOver(
      parseHex(brandColors[spec.mix]),
      parseHex(brandColors[spec.over]),
      spec.percent / 100,
    ),
  );
}

export const modes = ["light", "dark"] as const;
export type Mode = (typeof modes)[number];

export type PaletteToken = {
  name: string;
  utility: BrandName;
  usage: string;
};

export const palette: readonly PaletteToken[] = [
  { name: "Warm gold", utility: "gold", usage: "Accent surfaces, badges." },
  { name: "Mint", utility: "mint", usage: "Success surfaces." },
  { name: "Blush cream", utility: "blush", usage: "Soft section surfaces." },
  {
    name: "Ink navy",
    utility: "ink",
    usage: "Light-mode text; dark-mode page.",
  },
  {
    name: "Off-white",
    utility: "off-white",
    usage: "Light-mode page; dark-mode text.",
  },
  {
    name: "Muted black",
    utility: "muted-black",
    usage: "Warm near-black for light-mode chrome. Unused in dark mode.",
  },
  { name: "Alert red", utility: "alert", usage: "Error surfaces." },
];

export type SemanticToken = {
  token: string;
  usage: string;
  light: ColorSpec;
  dark: ColorSpec;
};

/**
 * Light composites ink navy over off-white; dark composites off-white over ink
 * navy. Same seven colours, mirrored.
 */
export const semanticTokens: readonly SemanticToken[] = [
  {
    token: "background",
    usage: "Page background.",
    light: { brand: "off-white" },
    dark: { brand: "ink" },
  },
  {
    token: "surface",
    usage: "Cards and panels.",
    light: { brand: "white" },
    dark: { mix: "off-white", percent: 7, over: "ink" },
  },
  {
    token: "surface-soft",
    usage: "Tinted section bands, table headers.",
    light: { brand: "blush" },
    dark: { mix: "blush", percent: 14, over: "ink" },
  },
  {
    token: "foreground",
    usage: "Body text.",
    light: { brand: "ink" },
    dark: { brand: "off-white" },
  },
  {
    token: "foreground-muted",
    usage: "Secondary text. Legible on every surface in its mode.",
    light: { mix: "ink", percent: 68, over: "off-white" },
    dark: { mix: "off-white", percent: 60, over: "ink" },
  },
  {
    token: "foreground-subtle",
    usage: "Placeholder and disabled text.",
    light: { mix: "ink", percent: 40, over: "off-white" },
    dark: { mix: "off-white", percent: 40, over: "ink" },
  },
  {
    token: "border",
    usage: "Hairline borders and dividers.",
    light: { mix: "ink", percent: 16, over: "off-white" },
    dark: { mix: "off-white", percent: 18, over: "ink" },
  },
  {
    token: "border-strong",
    usage: "Emphasised borders, input outlines.",
    light: { mix: "ink", percent: 32, over: "off-white" },
    dark: { mix: "off-white", percent: 36, over: "ink" },
  },
  {
    token: "primary",
    usage: "Primary action surface. Inverts with the mode.",
    light: { brand: "ink" },
    dark: { brand: "off-white" },
  },
  {
    token: "on-primary",
    usage: "Text on primary.",
    light: { brand: "off-white" },
    dark: { brand: "ink" },
  },
  {
    token: "accent",
    usage: "Accent surface.",
    light: { brand: "gold" },
    dark: { brand: "gold" },
  },
  {
    token: "on-accent",
    usage: "Text on accent.",
    light: { brand: "ink" },
    dark: { brand: "ink" },
  },
  {
    token: "success",
    usage: "Success surface.",
    light: { brand: "mint" },
    dark: { brand: "mint" },
  },
  {
    token: "on-success",
    usage: "Text on success.",
    light: { brand: "ink" },
    dark: { brand: "ink" },
  },
  {
    token: "danger",
    usage: "Error surface.",
    light: { brand: "alert" },
    dark: { brand: "alert" },
  },
  {
    token: "on-danger",
    usage: "Text on danger.",
    light: { brand: "off-white" },
    dark: { brand: "off-white" },
  },
  {
    token: "danger-foreground",
    usage: "Error text and icons. Raw alert red is not legible enough.",
    light: { mix: "ink", percent: 20, over: "alert" },
    dark: { mix: "off-white", percent: 35, over: "alert" },
  },
];

const tokensByName = new Map(
  semanticTokens.map((token) => [token.token, token]),
);

export function tokenHex(name: string, mode: Mode): string {
  const semantic = tokensByName.get(name);
  if (semantic) return resolveHex(semantic[mode]);

  const brand = brandColors[name as BrandName];
  if (brand) return brand;

  throw new Error(`Unknown token "${name}"`);
}

/** Every token that paints a background other text sits on. */
export const surfaceTokens = ["background", "surface", "surface-soft"] as const;

type Role = { name: string; note?: string };

/**
 * Which colours may carry text on each mode's surfaces. `text` roles are held
 * to 4.5:1 by the test suite; `decorative` roles are exempt and must say why.
 */
const roles: Record<
  Mode,
  { text: readonly Role[]; decorative: readonly Role[] }
> = {
  light: {
    text: [
      { name: "foreground" },
      { name: "foreground-muted" },
      { name: "danger-foreground" },
    ],
    decorative: [
      {
        name: "foreground-subtle",
        note: "Placeholder and disabled text, which WCAG exempts from 4.5:1.",
      },
      { name: "border", note: "Hairline divider. Non-text." },
      { name: "border-strong", note: "Input outline. Non-text." },
      {
        name: "gold",
        note: "Under 2:1 on light surfaces — fills, rules, and icons only. Never text.",
      },
      {
        name: "mint",
        note: "Under 2:1 on light surfaces — fills and rules only. Never text.",
      },
      {
        name: "blush",
        note: "A surface tint on light backgrounds, not a text colour.",
      },
      {
        name: "alert",
        note: "Raw alert red drops to 3.5:1 on the blush surface. Use danger-foreground for text.",
      },
    ],
  },
  dark: {
    text: [
      { name: "foreground" },
      { name: "foreground-muted" },
      { name: "danger-foreground" },
      {
        name: "gold",
        note: "Inverted: gold clears AA on every dark surface, so it may carry accent text.",
      },
      { name: "mint", note: "Inverted: mint clears AA on every dark surface." },
      {
        name: "blush",
        note: "Inverted: blush clears AA on every dark surface.",
      },
    ],
    decorative: [
      {
        name: "foreground-subtle",
        note: "Placeholder and disabled text, which WCAG exempts from 4.5:1.",
      },
      { name: "border", note: "Hairline divider. Non-text." },
      { name: "border-strong", note: "Input outline. Non-text." },
      {
        name: "alert",
        note: "Raw alert red reaches only 3.8:1 on the dark page. Use danger-foreground for text.",
      },
    ],
  },
};

/** Pairs that must hold whatever surface they sit on. */
const onPairs = [
  ["on-primary", "primary"],
  ["on-accent", "accent"],
  ["on-success", "success"],
  ["on-danger", "danger"],
] as const;

export type PairingIntent = "text" | "decorative";

export type Pairing = {
  foreground: string;
  background: string;
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  intent: PairingIntent;
  note?: string;
};

function pair(
  foreground: string,
  background: string,
  mode: Mode,
  intent: PairingIntent,
  note?: string,
): Pairing {
  const foregroundHex = tokenHex(foreground, mode);
  const backgroundHex = tokenHex(background, mode);

  return {
    foreground,
    background,
    foregroundHex,
    backgroundHex,
    ratio: contrastRatio(foregroundHex, backgroundHex),
    intent,
    ...(note ? { note } : {}),
  };
}

/** Every sanctioned pairing for a mode, measured. */
export function pairingsFor(mode: Mode): readonly Pairing[] {
  const { text, decorative } = roles[mode];

  return [
    ...text.flatMap((role) =>
      surfaceTokens.map((surface) =>
        pair(role.name, surface, mode, "text", role.note),
      ),
    ),
    ...onPairs.map(([foreground, background]) =>
      pair(foreground, background, mode, "text"),
    ),
    ...decorative.flatMap((role) =>
      surfaceTokens.map((surface) =>
        pair(role.name, surface, mode, "decorative", role.note),
      ),
    ),
  ];
}

export type TypeStep = {
  utility: string;
  size: string;
  lineHeight: string;
  usage: string;
};

export const typeScale: readonly TypeStep[] = [
  {
    utility: "text-xs",
    size: "0.75rem",
    lineHeight: "1.5",
    usage: "Legal, captions.",
  },
  {
    utility: "text-sm",
    size: "0.875rem",
    lineHeight: "1.5",
    usage: "Metadata, labels.",
  },
  {
    utility: "text-base",
    size: "1rem",
    lineHeight: "1.6",
    usage: "Body copy.",
  },
  {
    utility: "text-lg",
    size: "1.125rem",
    lineHeight: "1.55",
    usage: "Lead paragraphs.",
  },
  {
    utility: "text-xl",
    size: "1.375rem",
    lineHeight: "1.4",
    usage: "Card titles.",
  },
  {
    utility: "text-2xl",
    size: "1.75rem",
    lineHeight: "1.3",
    usage: "Section headings.",
  },
  {
    utility: "text-3xl",
    size: "2.25rem",
    lineHeight: "1.2",
    usage: "Page headings.",
  },
  {
    utility: "text-4xl",
    size: "2.875rem",
    lineHeight: "1.15",
    usage: "Hero headings.",
  },
  {
    utility: "text-5xl",
    size: "3.75rem",
    lineHeight: "1.05",
    usage: "Display, marketing.",
  },
];

export type ScaleStep = { utility: string; value: string };

/** `--spacing` is 0.25rem; utilities multiply it. These are the sanctioned steps. */
export const spacingScale: readonly ScaleStep[] = [
  { utility: "1", value: "0.25rem" },
  { utility: "2", value: "0.5rem" },
  { utility: "3", value: "0.75rem" },
  { utility: "4", value: "1rem" },
  { utility: "6", value: "1.5rem" },
  { utility: "8", value: "2rem" },
  { utility: "12", value: "3rem" },
  { utility: "16", value: "4rem" },
  { utility: "24", value: "6rem" },
];

export const radiusScale: readonly ScaleStep[] = [
  { utility: "rounded-xs", value: "0.25rem" },
  { utility: "rounded-sm", value: "0.375rem" },
  { utility: "rounded-md", value: "0.625rem" },
  { utility: "rounded-lg", value: "0.875rem" },
  { utility: "rounded-xl", value: "1.25rem" },
  { utility: "rounded-2xl", value: "1.75rem" },
  { utility: "rounded-3xl", value: "2.25rem" },
  { utility: "rounded-full", value: "9999px" },
];
