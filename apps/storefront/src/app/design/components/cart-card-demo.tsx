"use client";

import { useState } from "react";

import { CartCard } from "@/components";
import type { CartLine } from "@/lib/cart";

export function CartCardDemo({
  initialLines,
}: {
  initialLines: readonly CartLine[];
}) {
  const [lines, setLines] = useState(initialLines);
  const [editing, setEditing] = useState<string | null>(null);

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
          editHref={`${line.href}?edit=${line.lineId}`}
          onEdit={() => setEditing(line.lineId)}
        />
      ))}
      {editing ? (
        <p className="text-foreground-muted">
          Edit would open the product page for {editing}.
        </p>
      ) : null}
    </ul>
  );
}
