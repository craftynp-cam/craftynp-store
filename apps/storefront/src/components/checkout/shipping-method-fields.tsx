import type { ShippingRate } from "@craftynp/types";

import { formatDeliveryWindow } from "@/lib/shipping-rates";
import { formatMoney } from "@/lib/money";
import type { ShippingRatesStatus } from "./use-shipping-rates";

import { RadioCardGroup } from "../ui";
import { displayLabel, shippingRateToOption } from "./shipping-rate-option";

export type ShippingMethodFieldsProps = {
  status: ShippingRatesStatus;
  rates: readonly ShippingRate[];
  selectedRateId: string;
  error: string | null;
  errorMessage?: string;
  onSelect: (rateId: string) => void;
  onRetry: () => void;
};

export function ShippingMethodFields({
  status,
  rates,
  selectedRateId,
  error,
  errorMessage,
  onSelect,
  onRetry,
}: ShippingMethodFieldsProps) {
  if (status === "idle") {
    return (
      <p className="text-sm text-foreground-muted">
        Enter your delivery address to see shipping options.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <span className="sr-only">Loading shipping options…</span>
        <div className="h-16 animate-pulse rounded-xl bg-surface-soft" />
        <div className="h-16 animate-pulse rounded-xl bg-surface-soft" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger-foreground">
          {error ?? "We couldn't load shipping options."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  const rate = rates[0];

  if (rates.length === 1 && rate) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {displayLabel(rate)}
          </span>
          <span className="text-sm text-foreground-muted">
            {formatDeliveryWindow(rate)}
          </span>
        </div>
        <span className="font-display text-foreground">
          {formatMoney(rate.amount, rate.currencyCode)}
        </span>
      </div>
    );
  }

  return (
    <RadioCardGroup
      label="Choose a shipping method"
      value={selectedRateId}
      onChange={onSelect}
      options={rates.map(shippingRateToOption)}
      isInvalid={errorMessage != null}
      errorMessage={errorMessage}
    />
  );
}
