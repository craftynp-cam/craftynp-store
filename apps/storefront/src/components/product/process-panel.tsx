import type { ProductCustomization } from "@craftynp/types";

import { joinLabels, offeredInputLabels } from "@/lib/product-customization";

const HEADING_ID = "product-process-heading";

export type ProcessPanelProps = {
  customization: ProductCustomization;
  turnaroundNote: string;
  shippingWindowNote: string;
};

type ProcessStep = {
  title: string;
  body: string;
  note: string;
};

function sentence(clause: string): string {
  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`;
}

function processSteps({
  customization,
  turnaroundNote,
  shippingWindowNote,
}: ProcessPanelProps): ProcessStep[] {
  const steps: ProcessStep[] = [];

  const offered = offeredInputLabels(customization);
  if (offered.length > 0) {
    steps.push({
      title: "You tell us what you want",
      body: sentence(joinLabels(offered)),
      // There is no on-product preview of the artwork, so the resolution check
      // in the upload control is the only reassurance a file will print well.
      // Saying so here is what stands in for the mockup this design skips.
      note:
        customization.inputs.artwork === "off"
          ? ""
          : "We check your file is sharp enough to print at the size you pick before anything is made.",
    });
  }

  steps.push({
    title: "We make it by hand",
    body: "Your piece is made to order in the workshop — nothing is pulled off a shelf.",
    note: turnaroundNote,
  });

  steps.push({
    title: "It ships to you",
    body: "We pack it by hand and email you tracking the moment it leaves.",
    note: shippingWindowNote,
  });

  return steps;
}

export function ProcessPanel(props: ProcessPanelProps) {
  const steps = processSteps(props);

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2 id={HEADING_ID} className="font-display text-2xl">
        How your order is made
      </h2>

      <ol className="mt-5 space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-soft font-display text-sm"
            >
              {index + 1}
            </span>

            <div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-foreground-muted">{step.body}</p>
              {step.note ? (
                <p className="mt-1 text-foreground-muted">{step.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
