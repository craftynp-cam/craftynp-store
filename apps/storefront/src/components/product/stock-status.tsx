import type { Availability } from "@/lib/variant";

const copy: Record<Availability, { label: string; dotClassName: string }> = {
  in_stock: {
    label: "In stock — ships next business day",
    dotClassName: "bg-success",
  },
  low_stock: {
    label: "Low stock — order soon",
    dotClassName: "bg-accent",
  },
  out_of_stock: {
    label: "Out of stock",
    dotClassName: "bg-danger",
  },
};

export function StockStatus({ availability }: { availability: Availability }) {
  const { label, dotClassName } = copy[availability];
  const textClassName =
    availability === "out_of_stock"
      ? "text-danger-foreground"
      : "text-foreground";

  return (
    <p className={`flex items-center gap-2 text-sm font-medium ${textClassName}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClassName}`} />
      {label}
    </p>
  );
}
