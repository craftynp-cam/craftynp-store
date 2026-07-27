"use client";

import { useState } from "react";

import { CartCard } from "@/components";
import type { CartLine } from "@/lib/cart";

/**
 * A tiny client-only stand-in for the cart store, so the demo cards on
 * /design/components are actually interactive (stepper, remove) without
 * touching the real `cart.ts` store the header drawer reads from.
 */
export function CartCardDemo({
  initialLines,
}: {
  initialLines: readonly CartLine[];
}) {
  const [lines, setLines] = useState(initialLines);

  if (lines.length === 0) {
    return <p className="text-foreground-muted">Removed — reload to reset.</p>;
  }

  return (
    <ul className="max-w-md space-y-4">
      {lines.map((line) => (
        <CartCard
          key={line.id}
          line={line}
          onQuantityChange={(id, quantity) =>
            setLines((current) =>
              current.map((candidate) =>
                candidate.id === id ? { ...candidate, quantity } : candidate,
              ),
            )
          }
          onRemove={(id) =>
            setLines((current) =>
              current.filter((candidate) => candidate.id !== id),
            )
          }
        />
      ))}
    </ul>
  );
}
