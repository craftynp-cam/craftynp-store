import { siteContentDefault } from "@craftynp/types";
import type { ProductCustomization, SiteContentKey } from "@craftynp/types";

import { joinLabels, offeredInputLabels } from "@/lib/product-customization";
import type { OfferedInputLabels } from "@/lib/product-customization";

const HEADING_ID = "product-process-heading";

export type ProcessPanelContent = {
  turnaroundNote: string;
  shippingWindowNote: string;
  readyToShipHeading: string;
  readyToShipStepTitle: string;
  readyToShipStepBody: string;
  readyToShipDispatchNote: string;
};

export type ProcessPanelProps = {
  customization: ProductCustomization;
  content: ProcessPanelContent;
};

type ProcessStep = {
  title: string;
  body: string;
  note: string;
};

function sentence(clause: string): string {
  return `${clause.charAt(0).toUpperCase()}${clause.slice(1)}.`;
}

function customizationBody({ required, optional }: OfferedInputLabels): string {
  const instruction = required.length > 0 ? sentence(joinLabels(required)) : "";
  if (optional.length === 0) return instruction;

  const invitation = `You can ${instruction ? "also " : ""}${joinLabels(optional, "or")}.`;
  return instruction ? `${instruction} ${invitation}` : invitation;
}

function ownerCopy(value: string, key: SiteContentKey): string {
  return value.trim() || siteContentDefault(key);
}

function processSteps({
  customization,
  content,
}: ProcessPanelProps): ProcessStep[] {
  const steps: ProcessStep[] = [];

  const offered = offeredInputLabels(customization);
  const body = customizationBody(offered);
  if (body !== "") {
    steps.push({
      title: "You tell us what you want",
      body,
      note:
        customization.inputs.artwork === "off"
          ? ""
          : "We check your file is sharp enough to print at the size you pick before anything is made.",
    });
  }

  if (customization.isCustomizable) {
    steps.push({
      title: "We make it by hand",
      body: "Your piece is made to order in the workshop — nothing is pulled off a shelf.",
      note: content.turnaroundNote,
    });
  } else {
    steps.push({
      title: ownerCopy(
        content.readyToShipStepTitle,
        "ready_to_ship_step_title",
      ),
      body: ownerCopy(content.readyToShipStepBody, "ready_to_ship_step_body"),
      note: content.readyToShipDispatchNote,
    });
  }

  steps.push({
    title: "It ships to you",
    body: "We pack it by hand and email you tracking the moment it leaves.",
    note: content.shippingWindowNote,
  });

  return steps;
}

export function ProcessPanel(props: ProcessPanelProps) {
  const steps = processSteps(props);
  const heading = props.customization.isCustomizable
    ? "How your order is made"
    : ownerCopy(props.content.readyToShipHeading, "ready_to_ship_heading");

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-xl border border-border bg-surface p-6"
    >
      <h2 id={HEADING_ID} className="font-display text-2xl">
        {heading}
      </h2>

      <ol className="mt-5 space-y-5">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-4">
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
