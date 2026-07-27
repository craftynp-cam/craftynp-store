import { mixOver, parseHex, toHex } from "@/lib/contrast";

/**
 * A TypeScript mirror of the tokens defined in `src/app/globals.css`, so the
 * reference page can measure and document them. `design-tokens.test.ts` fails
 * if the two ever drift.
 */

export type PaletteToken = {
  name: string;
  utility: string;
  hex: string;
  usage: string;
};

export const palette: readonly PaletteToken[] = [
  {
    name: "Warm gold",
    utility: "gold",
    hex: "#ebb805",
    usage: "Accent surfaces, badges, highlights.",
  },
  {
    name: "Mint",
    utility: "mint",
    hex: "#85dfc3",
    usage: "Success surfaces, secondary accents.",
  },
  {
    name: "Blush cream",
    utility: "blush",
    hex: "#ecdad1",
    usage: "Soft section backgrounds.",
  },
  {
    name: "Ink navy",
    utility: "ink",
    hex: "#04133b",
    usage: "Primary text, primary buttons.",
  },
  {
    name: "Off-white",
    utility: "off-white",
    hex: "#fbfaf7",
    usage: "Page background, text on dark surfaces.",
  },
  {
    name: "Muted black",
    utility: "muted-black",
    hex: "#1f1e1c",
    usage: "Deep neutral surfaces, footer.",
  },
  {
    name: "Alert red",
    utility: "alert",
    hex: "#b4574a",
    usage: "Errors, destructive actions.",
  },
];

const inkHex = "#04133b";
const backgroundHex = "#fbfaf7";

function inkAt(alpha: number): string {
  return toHex(mixOver(parseHex(inkHex), parseHex(backgroundHex), alpha));
}

export type DerivedToken = PaletteToken & { inkOpacity: number };

/** Greys come from ink navy at reduced opacity — never from a new hue. */
export const derivedNeutrals: readonly DerivedToken[] = [
  {
    name: "Ink muted",
    utility: "ink-muted",
    inkOpacity: 0.6,
    hex: inkAt(0.6),
    usage: "Secondary body text.",
  },
  {
    name: "Ink subtle",
    utility: "ink-subtle",
    inkOpacity: 0.4,
    hex: inkAt(0.4),
    usage: "Disabled text, placeholder text (decorative).",
  },
  {
    name: "Border",
    utility: "border",
    inkOpacity: 0.16,
    hex: inkAt(0.16),
    usage: "Default hairline borders and dividers.",
  },
  {
    name: "Border strong",
    utility: "border-strong",
    inkOpacity: 0.32,
    hex: inkAt(0.32),
    usage: "Emphasised borders, input outlines.",
  },
];

export type SemanticToken = {
  token: string;
  resolvesTo: string;
  usage: string;
};

export const semanticTokens: readonly SemanticToken[] = [
  {
    token: "background",
    resolvesTo: "off-white",
    usage: "Page background.",
  },
  { token: "surface", resolvesTo: "#ffffff", usage: "Cards and panels." },
  { token: "foreground", resolvesTo: "ink", usage: "Body text." },
  {
    token: "foreground-muted",
    resolvesTo: "ink-muted",
    usage: "Secondary text.",
  },
  { token: "primary", resolvesTo: "ink", usage: "Primary action surface." },
  { token: "on-primary", resolvesTo: "off-white", usage: "Text on primary." },
  { token: "accent", resolvesTo: "gold", usage: "Accent surface." },
  { token: "on-accent", resolvesTo: "ink", usage: "Text on accent." },
  { token: "success", resolvesTo: "mint", usage: "Success surface." },
  { token: "on-success", resolvesTo: "ink", usage: "Text on success." },
  { token: "danger", resolvesTo: "alert", usage: "Error surface." },
  { token: "on-danger", resolvesTo: "off-white", usage: "Text on danger." },
];

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

export type PairingIntent = "text" | "decorative";

export type Pairing = {
  foreground: string;
  background: string;
  intent: PairingIntent;
  note?: string;
};

/**
 * Every foreground/background combination the design system sanctions.
 * `text` pairings must meet 4.5:1; `decorative` ones are documented as
 * non-text-bearing and are enforced not to carry copy.
 */
export const pairings: readonly Pairing[] = [
  { foreground: "#04133b", background: "#fbfaf7", intent: "text" },
  { foreground: "#04133b", background: "#ffffff", intent: "text" },
  { foreground: "#04133b", background: "#ecdad1", intent: "text" },
  { foreground: "#04133b", background: "#85dfc3", intent: "text" },
  { foreground: "#04133b", background: "#ebb805", intent: "text" },
  { foreground: "#fbfaf7", background: "#04133b", intent: "text" },
  { foreground: "#fbfaf7", background: "#1f1e1c", intent: "text" },
  { foreground: "#fbfaf7", background: "#b4574a", intent: "text" },
  { foreground: "#b4574a", background: "#fbfaf7", intent: "text" },
  { foreground: inkAt(0.6), background: "#fbfaf7", intent: "text" },
  {
    foreground: "#ebb805",
    background: "#fbfaf7",
    intent: "decorative",
    note: "Gold on light backgrounds is decorative only — rules, icons, and fills. Never text.",
  },
  {
    foreground: "#85dfc3",
    background: "#fbfaf7",
    intent: "decorative",
    note: "Mint on light backgrounds is decorative only. Never text.",
  },
  {
    foreground: "#ecdad1",
    background: "#fbfaf7",
    intent: "decorative",
    note: "Blush on off-white is a surface tint, not a text colour.",
  },
  {
    foreground: "#b4574a",
    background: "#ecdad1",
    intent: "decorative",
    note: "Alert on blush reaches 3.5:1 — usable for icons and borders, not body text.",
  },
  {
    foreground: inkAt(0.4),
    background: "#fbfaf7",
    intent: "decorative",
    note: "Ink at 40% is for disabled and placeholder states, which are exempt from 4.5:1.",
  },
  {
    foreground: inkAt(0.16),
    background: "#fbfaf7",
    intent: "decorative",
    note: "Border hairline. Non-text.",
  },
];
