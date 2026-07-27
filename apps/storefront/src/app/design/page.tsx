import type { Metadata } from "next";

import { contrastRatio, gradeContrast } from "@/lib/contrast";
import {
  derivedNeutrals,
  pairings,
  palette,
  radiusScale,
  semanticTokens,
  spacingScale,
  typeScale,
} from "@/lib/design-tokens";

export const metadata: Metadata = {
  title: "Design tokens — The Crafty NP",
  description: "Reference page for the brand palette, type, spacing and radii.",
};

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

function Swatch({
  name,
  utility,
  hex,
  usage,
}: {
  name: string;
  utility: string;
  hex: string;
  usage: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-20" style={{ backgroundColor: hex }} />
      <div className="p-4">
        <p className="font-medium">{name}</p>
        <p className="mt-1 font-mono text-sm text-foreground-muted">
          {utility} · {hex}
        </p>
        <p className="mt-2 text-sm text-foreground-muted">{usage}</p>
      </div>
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
        <code className="rounded-xs bg-blush px-1 py-0.5 font-mono text-base">
          src/app/globals.css
        </code>
        ; components reference the generated utilities, never raw hex.
      </p>

      <Section
        title="Palette"
        description="The four official brand colours and three neutrals. The neutrals are proposals pending sign-off."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {palette.map((token) => (
            <Swatch key={token.utility} {...token} />
          ))}
        </div>
      </Section>

      <Section
        title="Derived neutrals"
        description="Greys are ink navy at reduced opacity over the page background, so no new hues enter the system."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {derivedNeutrals.map((token) => (
            <Swatch
              key={token.utility}
              name={`${token.name} (ink ${Math.round(token.inkOpacity * 100)}%)`}
              utility={token.utility}
              hex={token.hex}
              usage={token.usage}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Semantic aliases"
        description="Prefer these over the raw palette names — they carry intent and survive a palette change."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-lg border-collapse text-left text-sm">
            <thead className="bg-blush">
              <tr>
                <th className="p-3 font-medium">Token</th>
                <th className="p-3 font-medium">Resolves to</th>
                <th className="p-3 font-medium">Usage</th>
              </tr>
            </thead>
            <tbody>
              {semanticTokens.map((token) => (
                <tr key={token.token} className="border-t border-border">
                  <td className="p-3 font-mono">{token.token}</td>
                  <td className="p-3 font-mono text-foreground-muted">
                    {token.resolvesTo}
                  </td>
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
                className="h-4 rounded-xs bg-gold"
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
                className="h-24 border border-border-strong bg-mint"
                style={{ borderRadius: step.value }}
              />
              <p className="mt-2 font-mono text-sm text-foreground-muted">
                {step.utility} · {step.value}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Contrast"
        description="Every sanctioned pairing, measured. Text pairings meet WCAG AA at 4.5:1; anything below is decorative-only and says why."
      >
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-2xl border-collapse text-left text-sm">
            <thead className="bg-blush">
              <tr>
                <th className="p-3 font-medium">Sample</th>
                <th className="p-3 font-medium">Ratio</th>
                <th className="p-3 font-medium">Grade</th>
                <th className="p-3 font-medium">Intent</th>
              </tr>
            </thead>
            <tbody>
              {pairings.map((pair) => {
                const ratio = contrastRatio(pair.foreground, pair.background);

                return (
                  <tr
                    key={`${pair.foreground}-${pair.background}`}
                    className="border-t border-border"
                  >
                    <td className="p-3">
                      <span
                        className="inline-block rounded-sm px-3 py-2"
                        style={{
                          backgroundColor: pair.background,
                          color: pair.foreground,
                        }}
                      >
                        Handmade with care
                      </span>
                    </td>
                    <td className="p-3 font-mono">{ratio.toFixed(2)}:1</td>
                    <td className="p-3 font-mono">{gradeContrast(ratio)}</td>
                    <td className="p-3 text-foreground-muted">
                      {pair.intent === "text"
                        ? "Text"
                        : (pair.note ?? "Decorative only.")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
