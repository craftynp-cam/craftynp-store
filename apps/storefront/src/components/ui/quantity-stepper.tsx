"use client";

import { Minus, Plus } from "../icons";

type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Names the control for assistive tech, e.g. "Quantity for Wildflower Acrylic Keychain". */
  label: string;
};

const buttonClassName =
  "flex size-9 shrink-0 items-center justify-center bg-surface-soft text-foreground transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset";
const decrementButtonClassName = `${buttonClassName} rounded-l-lg`;
const incrementButtonClassName = `${buttonClassName} rounded-r-lg`;

/**
 * Shared by the cart drawer (CNP-47) and, later, the configurator's own
 * stepper (CNP-43) — built here first so that story reuses it rather than
 * duplicating. Decrementing below `min` is not how a line is removed; that is
 * the card's own remove control.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
}: QuantityStepperProps) {
  const canDecrement = value > min;
  const canIncrement = max == null || value < max;

  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrement}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={decrementButtonClassName}
      >
        <Minus aria-hidden="true" size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(next)) {
            onChange(Math.min(max ?? Infinity, Math.max(min, next)));
          }
        }}
        className="w-12 border-x border-border bg-surface py-1.5 text-center [appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrement}
        onClick={() => onChange(value + 1)}
        className={incrementButtonClassName}
      >
        <Plus aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
