import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { gradeContrast } from "@/lib/contrast";
import {
  brandColors,
  modes,
  pairingsFor,
  palette,
  radiusScale,
  resolveHex,
  semanticTokens,
  spacingScale,
  surfaceTokens,
  tokenHex,
  typeScale,
  type Mode,
} from "@/lib/design-tokens";

export const metadata: Metadata = {
  title: "Design tokens — The Crafty NP",
  description:
    "Reference page for the brand palette, type, spacing, radii, and both colour modes.",
};

const modeLabel: Record<Mode, string> = { light: "Light", dark: "Dark" };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-foreground-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * The page follows the reader's own mode, so the mode it is not currently in
 * has to be shown explicitly. These panes paint themselves from resolved hex
 * rather than from utilities, which is the one place that is legitimate.
 */
function ModePane({
  mode,
  children,
}: {
  mode: Mode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{
        backgroundColor: tokenHex("background", mode),
        color: tokenHex("foreground", mode),
        border: `1px solid ${tokenHex("border-strong", mode)}`,
      }}
    >
      <p
        className="text-sm font-medium"
        style={{ color: tokenHex("foreground-muted", mode) }}
      >
        {modeLabel[mode]}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Swatch({
  label,
  caption,
  hex,
  usage,
  borderHex,
}: {
  label: string;
  caption: string;
  hex: string;
  usage?: string;
  borderHex?: string;
}) {
  return (
    <div>
      {/* Without borderHex the swatch borders itself from the active mode's
          token; the mode panes pass one because they show the other mode. */}
      <div
        className={`h-16 rounded-md border ${borderHex ? "" : "border-border-strong"}`}
        style={{
          backgroundColor: hex,
          ...(borderHex ? { borderColor: borderHex } : {}),
        }}
      />
      <p className="mt-2 text-sm font-medium">{label}</p>
      <p className="font-mono text-xs opacity-70">{caption}</p>
      {usage ? <p className="mt-1 text-xs opacity-70">{usage}</p> : null}
    </div>
  );
}

function ContrastTable({ mode }: { mode: Mode }) {
  const pairings = pairingsFor(mode);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-2xl border-collapse text-left text-sm">
        <thead className="bg-surface-soft">
          <tr>
            <th className="p-3 font-medium">Sample</th>
            <th className="p-3 font-medium">Pairing</th>
            <th className="p-3 font-medium">Ratio</th>
            <th className="p-3 font-medium">Grade</th>
            <th className="p-3 font-medium">Intent</th>
          </tr>
        </thead>
        <tbody>
          {pairings.map((pairing) => (
            <tr
              key={`${pairing.foreground}-on-${pairing.background}`}
              className="border-t border-border"
            >
              <td className="p-3">
                <span
                  className="inline-block rounded-sm px-3 py-2 whitespace-nowrap"
                  style={{
                    backgroundColor: pairing.backgroundHex,
                    color: pairing.foregroundHex,
                  }}
                >
                  Handmade with care
                </span>
              </td>
              <td className="p-3 font-mono text-xs">
                {pairing.foreground} on {pairing.background}
              </td>
              <td className="p-3 font-mono">{pairing.ratio.toFixed(2)}:1</td>
              <td className="p-3 font-mono">{gradeContrast(pairing.ratio)}</td>
              <td className="p-3 text-foreground-muted">
                {pairing.note ?? (pairing.intent === "text" ? "Text." : "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DesignTokensPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-4xl">Design tokens</h1>
      <p className="mt-4 max-w-2xl text-lg text-foreground-muted">
        Every colour, type step, spacing step and radius the storefront is
        allowed to use. Tokens are declared once in{" "}
        <code className="rounded-xs bg-surface-soft px-1 py-0.5 font-mono text-base">
          src/app/globals.css
        </code>
        ; components reference the generated utilities, never raw hex. The{" "}
        <Link
          href="/design/primitives"
          className="underline underline-offset-4"
        >
          UI primitives
        </Link>{" "}
        page shows what these tokens build.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ThemeToggle />
        <p className="text-sm text-foreground-muted">
          Switches the whole page, not just this section — every colour below
          comes from a mode-aware token. <strong>System</strong> follows your
          OS.
        </p>
      </div>

      <Section
        title="Palette"
        description="The four official brand colours and three signed-off neutrals. Both modes are built from these seven."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {palette.map((token) => (
            <Swatch
              key={token.utility}
              label={token.name}
              caption={`${token.utility} · ${brandColors[token.utility]}`}
              hex={brandColors[token.utility]}
              usage={token.usage}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Colour modes"
        description="Light composites ink navy over off-white; dark composites off-white over ink navy. Ink navy is the darkest brand colour, so it becomes the dark page and surfaces lift away from it. Muted black sits within 1.1:1 of ink navy and is deliberately unused in dark mode — as a layer it would be invisible."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {modes.map((mode) => (
            <ModePane key={mode} mode={mode}>
              <div className="grid grid-cols-3 gap-3">
                {surfaceTokens.map((surface) => (
                  <Swatch
                    key={surface}
                    label={surface}
                    caption={tokenHex(surface, mode)}
                    hex={tokenHex(surface, mode)}
                    borderHex={tokenHex("border-strong", mode)}
                  />
                ))}
              </div>
              <div className="mt-5 space-y-1">
                <p>Body text sits at foreground.</p>
                <p style={{ color: tokenHex("foreground-muted", mode) }}>
                  Secondary text sits at foreground-muted.
                </p>
                <p style={{ color: tokenHex("foreground-subtle", mode) }}>
                  Placeholders sit at foreground-subtle.
                </p>
                <p style={{ color: tokenHex("danger-foreground", mode) }}>
                  Errors sit at danger-foreground.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(["primary", "accent", "success", "danger"] as const).map(
                  (token) => (
                    <span
                      key={token}
                      className="rounded-md px-3 py-2 text-sm font-medium"
                      style={{
                        backgroundColor: tokenHex(token, mode),
                        color: tokenHex(
                          token === "primary" ? "on-primary" : `on-${token}`,
                          mode,
                        ),
                      }}
                    >
                      {token}
                    </span>
                  ),
                )}
              </div>
            </ModePane>
          ))}
        </div>
      </Section>

      <Section
        title="Semantic aliases"
        description="Prefer these over the raw palette names — they carry intent, and they are the only colours that follow the active mode."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-2xl border-collapse text-left text-sm">
            <thead className="bg-surface-soft">
              <tr>
                <th className="p-3 font-medium">Token</th>
                <th className="p-3 font-medium">Light</th>
                <th className="p-3 font-medium">Dark</th>
                <th className="p-3 font-medium">Usage</th>
              </tr>
            </thead>
            <tbody>
              {semanticTokens.map((token) => (
                <tr key={token.token} className="border-t border-border">
                  <td className="p-3 font-mono">{token.token}</td>
                  {modes.map((mode) => (
                    <td key={mode} className="p-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-4 shrink-0 rounded-xs border border-border-strong"
                          style={{ backgroundColor: resolveHex(token[mode]) }}
                        />
                        <span className="font-mono text-xs text-foreground-muted">
                          {resolveHex(token[mode])}
                        </span>
                      </span>
                    </td>
                  ))}
                  <td className="p-3 text-foreground-muted">{token.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Typography"
        description="Libre Baskerville sets display copy; Source Sans 3 sets everything else. Both load with font-display: swap."
      >
        <div className="rounded-lg border border-border bg-surface p-6">
          <p className="font-display text-2xl">
            Libre Baskerville — display and headings
          </p>
          <p className="mt-2 text-lg">Source Sans 3 — body and interface</p>
        </div>

        <ul className="mt-6 space-y-6">
          {typeScale.map((step) => (
            <li
              key={step.utility}
              className="border-b border-border pb-6 last:border-b-0"
            >
              <p className="font-mono text-sm text-foreground-muted">
                {step.utility} · {step.size} / {step.lineHeight} · {step.usage}
              </p>
              <p
                className="mt-2"
                style={{ fontSize: step.size, lineHeight: step.lineHeight }}
              >
                Handmade with care
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Spacing"
        description="A 4px base. Utilities multiply it, so p-4 is 1rem."
      >
        <ul className="space-y-3">
          {spacingScale.map((step) => (
            <li key={step.utility} className="flex items-center gap-4">
              <span className="w-24 shrink-0 font-mono text-sm text-foreground-muted">
                {step.utility} · {step.value}
              </span>
              <span
                className="h-4 rounded-xs bg-accent"
                style={{ width: step.value }}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Radii"
        description="The soft (rounded) option, applied consistently from inputs through to hero panels."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {radiusScale.map((step) => (
            <div key={step.utility} className="text-center">
              <div
                className="h-24 border border-border-strong bg-success"
                style={{ borderRadius: step.value }}
              />
              <p className="mt-2 font-mono text-sm text-foreground-muted">
                {step.utility} · {step.value}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {modes.map((mode) => (
        <Section
          key={mode}
          title={`Contrast — ${modeLabel[mode].toLowerCase()} mode`}
          description="Every sanctioned pairing, measured at render time. Text pairings meet WCAG AA at 4.5:1; anything below is decorative-only and says why."
        >
          <ContrastTable mode={mode} />
        </Section>
      ))}
    </main>
  );
}
