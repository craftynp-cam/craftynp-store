"use client";

import { useId, useState } from "react";

import { Minus, Plus } from "../icons";

type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label: string;
  description?: string;
};

const buttonClassName =
  "flex size-9 shrink-0 items-center justify-center bg-surface-soft text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset";
const decrementButtonClassName = `${buttonClassName} rounded-l-lg`;
const incrementButtonClassName = `${buttonClassName} rounded-r-lg`;

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  description,
}: QuantityStepperProps) {
  // Held while the shopper types, so a part-typed number is never clamped:
  // with a minimum of 50, clamping each keystroke turns the 1 of 100 into 50
  // and puts 100 out of reach.
  const [draft, setDraft] = useState<string | null>(null);
  const descriptionId = useId();

  const canDecrement = value > min;
  const canIncrement = max == null || value < max;

  function step(next: number) {
    setDraft(null);
    onChange(next);
  }

  function commit() {
    const parsed = Number.parseInt(draft ?? "", 10);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.min(max ?? Infinity, Math.max(min, parsed)));
  }

  // Silent while a draft is open, for the reason nearLimitAnnouncement does not
  // change per keystroke: a live region wired to the field reads every digit.
  const announcement =
    draft !== null
      ? ""
      : min > 1 && value === min
        ? `Quantity ${value}, the fewest you can order.`
        : `Quantity ${value}.`;

  return (
    <div className="inline-flex flex-col gap-1.5">
      <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={!canDecrement}
          onClick={() => step(Math.max(min, value - 1))}
          className={decrementButtonClassName}
        >
          <Minus aria-hidden="true" size={16} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          aria-describedby={description ? descriptionId : undefined}
          value={draft ?? value}
          min={min}
          max={max}
          onChange={(event) => {
            const raw = event.target.value;
            if (!/^\d*$/.test(raw)) return;

            setDraft(raw);

            const parsed = Number.parseInt(raw, 10);
            if (!Number.isFinite(parsed)) return;
            if (parsed < min || (max != null && parsed > max)) return;
            onChange(parsed);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
          }}
          className="w-12 border-x border-border bg-surface py-1.5 text-center [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={!canIncrement}
          onClick={() => step(value + 1)}
          className={incrementButtonClassName}
        >
          <Plus aria-hidden="true" size={16} />
        </button>
      </div>

      {description ? (
        <p id={descriptionId} className="text-sm text-foreground-muted">
          {description}
        </p>
      ) : null}

      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
