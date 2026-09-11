"use client";

import { useId, useState } from "react";

// Long enough that a clamped two lines still says something, short enough that
// an order note worth expanding is offered. Whether the value is expandable is
// decided from the value itself rather than from the rendered box: measuring
// needs layout, and there is none under test — a note would then be expandable
// in a browser and not in jsdom, which is the wrong way round for a guarantee
// this one is about.
const EXPANDABLE_LENGTH = 80;

export function isExpandableDetail(value: string): boolean {
  return value.includes("\n") || value.length > EXPANDABLE_LENGTH;
}

export type CartLineDetailValueProps = {
  label: string;
  value: string;
};

export function CartLineDetailValue({
  label,
  value,
}: CartLineDetailValueProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const valueId = useId();

  // A short single-line value has nothing to reveal, so it keeps the plain
  // truncation and the title that goes with it.
  if (!isExpandableDetail(value)) {
    return (
      <dd className="min-w-0 truncate" title={value}>
        {value}
      </dd>
    );
  }

  return (
    <dd className="min-w-0">
      <span
        id={valueId}
        // `line-clamp-2` brings its own `display: -webkit-box`, which a `block`
        // alongside it silently beats — the clamp then does nothing at all. The
        // expanded state is the only one that supplies a display of its own.
        className={`whitespace-pre-line ${isExpanded ? "block" : "line-clamp-2"}`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={valueId}
        onClick={() => setIsExpanded((current) => !current)}
        className="mt-1 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {isExpanded ? "Show less" : `Show full ${label.toLowerCase()}`}
      </button>
    </dd>
  );
}
