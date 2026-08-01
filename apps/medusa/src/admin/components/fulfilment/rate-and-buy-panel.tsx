import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@medusajs/icons";
import { Alert, Button, Prompt, RadioGroup, Text, toast } from "@medusajs/ui";
import {
  describeLabelFailure,
  formatDeliveryWindow,
  parcelOverrideSchema,
} from "@craftynp/types";
import type {
  LabelFailureReason,
  LiveRate,
  ParcelOverride,
} from "@craftynp/types";

import {
  balanceQueryKey,
  buyLabel,
  fetchRates,
  orderStatusQueryKey,
  queueQueryKey,
  type BuyLabelResponse,
} from "../../lib/fulfilment-api";
import { ParcelFields, toDraft, type ParcelDraft } from "./parcel-fields";

const RATE_STALE_MS = 15 * 60 * 1000;

type FailureBody = {
  reason?: string;
  carrierMessage?: string | null;
  message?: string;
};

function isLabelFailureReason(value: unknown): value is LabelFailureReason {
  return (
    typeof value === "string" &&
    [
      "timeout",
      "timeout_unconfirmed",
      "http_error",
      "rate_limit_exhausted",
      "rejected",
      "insufficient_funds",
      "misconfigured",
    ].includes(value)
  );
}

function failureCopy(error: unknown): { title: string; body: string } {
  const detail = (error ?? {}) as FailureBody;

  if (isLabelFailureReason(detail.reason)) {
    const copy = describeLabelFailure(detail.reason, detail.carrierMessage);
    return { title: copy.title, body: `${copy.body} ${copy.nextStep}` };
  }

  return {
    title: "That did not work",
    body: detail.message ?? "Something went wrong. Please try again.",
  };
}

function parseDraft(draft: ParcelDraft): ParcelOverride | null {
  const parsed = parcelOverrideSchema.safeParse({
    weight: Number(draft.weight),
    length: Number(draft.length),
    width: Number(draft.width),
    height: Number(draft.height),
  });

  return parsed.success ? parsed.data : null;
}

function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode.toUpperCase()}`;
  }
}

type Props = {
  orderId: string;
  derivedParcel: ParcelOverride | null;
  missingDimensions: readonly string[];
  onBought?: (response: BuyLabelResponse) => void;
};

export const RateAndBuyPanel = ({
  orderId,
  derivedParcel,
  missingDimensions,
  onBought,
}: Props) => {
  const queryClient = useQueryClient();

  const [derived, setDerived] = useState<ParcelOverride | null>(derivedParcel);
  const [draft, setDraft] = useState<ParcelDraft>(() => toDraft(derivedParcel));
  const [rates, setRates] = useState<LiveRate[] | null>(null);
  const [quotedAt, setQuotedAt] = useState<number | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    title: string;
    body: string;
  } | null>(null);

  const parcel = parseDraft(draft);

  const rateQuery = useMutation({
    mutationFn: () => fetchRates(orderId, parcel),
    onSuccess: (response) => {
      setRates(response.rates);
      setDerived(response.derivedParcel);
      setDraft(toDraft(response.parcel));
      setQuotedAt(Date.now());
      setSelectedRateId(response.rates[0]?.rateId ?? null);
      setFailure(null);
      if (response.rates.length === 0) {
        setFailure({
          title: "No carrier would quote this parcel",
          body: "Check the weight and size, then try again.",
        });
      }
    },
    onError: (error: unknown) => {
      setRates(null);
      setFailure(failureCopy(error));
    },
  });

  const purchase = useMutation({
    mutationFn: (rate: LiveRate) =>
      buyLabel(orderId, {
        rateId: rate.rateId,
        carrierId: rate.carrierId,
        serviceCode: rate.serviceCode,
        parcel: parcel as ParcelOverride,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(orderStatusQueryKey(orderId), {
        orderStatus: response.orderStatus,
      });
      void queryClient.invalidateQueries({ queryKey: queueQueryKey });
      void queryClient.invalidateQueries({ queryKey: balanceQueryKey });

      setFailure(null);
      toast.success(
        `Label bought — tracking ${response.label.trackingNumber}. The customer has been emailed.`,
      );

      if (!response.label.labelStored) {
        toast.warning(
          "The label could not be saved to this shop, so it is only stored at the carrier and the link stops working after 90 days. Print it now.",
        );
      }

      onBought?.(response);
    },
    onError: (error: unknown) => setFailure(failureCopy(error)),
  });

  const busy = rateQuery.isPending || purchase.isPending;
  const stale = quotedAt != null && Date.now() - quotedAt > RATE_STALE_MS;
  const selectedRate =
    rates?.find((rate) => rate.rateId === selectedRateId) ?? null;

  function onDraftChange(next: ParcelDraft) {
    setDraft(next);
    setRates(null);
    setQuotedAt(null);
    setSelectedRateId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {missingDimensions.length > 0 && (
        <Alert variant="warning">
          {`We could not work out the parcel automatically because ${missingDimensions.join(", ")} ${missingDimensions.length === 1 ? "has" : "have"} no saved weight or size. Enter the parcel below, and add the missing details to the product later so this is filled in next time.`}
        </Alert>
      )}

      <ParcelFields
        idPrefix={`parcel-${orderId}`}
        draft={draft}
        derived={derived}
        disabled={busy}
        onChange={onDraftChange}
      />

      <div>
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onClick={() => rateQuery.mutate()}
        >
          {rateQuery.isPending ? (
            <Spinner className="animate-spin" />
          ) : rates ? (
            "Refresh rates"
          ) : (
            "Get live rates"
          )}
        </Button>
        {!parcel && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-1">
            Leave these blank to use the weight and size saved on the products.
          </Text>
        )}
      </div>

      {failure && (
        <Alert variant="error">
          <Text size="small" weight="plus">
            {failure.title}
          </Text>
          <Text size="small">{failure.body}</Text>
        </Alert>
      )}

      {rates && rates.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text size="small" weight="plus">
            Shipping options
          </Text>

          {stale && (
            <Alert variant="warning">
              These prices are more than 15 minutes old. Refresh them before
              buying.
            </Alert>
          )}

          <RadioGroup
            value={selectedRateId ?? ""}
            onValueChange={setSelectedRateId}
          >
            {rates.map((rate) => (
              <div
                key={rate.rateId}
                className="border-ui-border-base flex items-start gap-3 rounded-md border px-3 py-2"
              >
                <RadioGroup.Item value={rate.rateId} id={rate.rateId} />
                <label htmlFor={rate.rateId} className="flex-1 cursor-pointer">
                  <Text size="small" weight="plus">
                    {`${rate.carrierName} · ${rate.serviceName}`}
                    {rate.packageName ? ` · ${rate.packageName}` : ""}
                  </Text>
                  <Text size="small">
                    {formatMoney(rate.amount, rate.currencyCode)}
                    {rate.surcharges > 0
                      ? ` (includes ${formatMoney(rate.surcharges, rate.currencyCode)} of surcharges)`
                      : ""}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {formatDeliveryWindow(
                      rate.deliveryDays,
                      rate.estimatedDeliveryDate,
                    )}
                  </Text>
                </label>
              </div>
            ))}
          </RadioGroup>

          {quotedAt && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {`Quoted at ${new Date(quotedAt).toLocaleTimeString()}`}
            </Text>
          )}

          <Prompt>
            <Prompt.Trigger asChild>
              <Button
                size="small"
                disabled={busy || !selectedRate || stale || !parcel}
              >
                {purchase.isPending ? (
                  <Spinner className="animate-spin" />
                ) : selectedRate ? (
                  `Buy label — ${formatMoney(selectedRate.amount, selectedRate.currencyCode)}`
                ) : (
                  "Buy label"
                )}
              </Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Buy this shipping label?</Prompt.Title>
                <Prompt.Description>
                  {selectedRate
                    ? `This charges ${formatMoney(selectedRate.amount, selectedRate.currencyCode)} to your ShipStation balance and emails the customer their tracking number. The carrier prices the label at the moment of purchase, so the final amount can differ by a few cents from the quote.`
                    : ""}
                </Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Cancel</Prompt.Cancel>
                <Prompt.Action
                  onClick={() => selectedRate && purchase.mutate(selectedRate)}
                >
                  Buy label
                </Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
        </div>
      )}
    </div>
  );
};
