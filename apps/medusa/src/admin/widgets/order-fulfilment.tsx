import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Hint,
  Text,
  toast,
} from "@medusajs/ui";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import type { OrderStatus, TrackingStatus } from "@craftynp/types";

import { sdk } from "../lib/client";
import {
  describeFailure,
  fetchOrderStatus,
  labelPdfPath,
  orderStatusQueryKey,
  queueQueryKey,
  type OrderStatusResponse,
} from "../lib/fulfilment-api";
import { printPdf } from "../lib/print-pdf";
import { RateAndBuyPanel } from "../components/fulfilment/rate-and-buy-panel";
import { VoidLabelButton } from "../components/fulfilment/void-label-button";

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  packing: "Packing",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<
  OrderStatus,
  "grey" | "blue" | "orange" | "green" | "red"
> = {
  received: "grey",
  packing: "blue",
  in_production: "orange",
  shipped: "blue",
  delivered: "green",
  cancelled: "red",
};

const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  accepted: "Accepted by the carrier",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Delayed — check with the carrier",
  unknown: "Awaiting the first scan",
};

function formatTimestamp(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function formatMoney(amount: number, currencyCode: string | null): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currencyCode ?? "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${(currencyCode ?? "usd").toUpperCase()}`;
  }
}

const OrderFulfilmentWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient();
  const queryKey = orderStatusQueryKey(order.id);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOrderStatus(order.id),
  });

  const transition = useMutation({
    mutationFn: (status: OrderStatus) =>
      sdk.client.fetch<OrderStatusResponse>(
        `/admin/orders/${order.id}/status`,
        { method: "POST", body: { status } },
      ),
    onSuccess: (response: OrderStatusResponse) => {
      queryClient.setQueryData(queryKey, response);
      void queryClient.invalidateQueries({ queryKey: queueQueryKey });
      toast.success("Order status updated.");
    },
    onError: (error: unknown) => toast.error(describeFailure(error)),
  });

  const print = useMutation({
    mutationFn: () => printPdf({ path: labelPdfPath(order.id) }),
    onError: (error: unknown) => toast.error(describeFailure(error)),
  });

  if (isLoading || !data) {
    return (
      <Container className="flex items-center justify-center p-6">
        <Spinner className="animate-spin" />
      </Container>
    );
  }

  const { status, allowedTransitions, tracking, label, history } =
    data.orderStatus;
  const busy = transition.isPending;

  const offeredTransitions = allowedTransitions.filter((next) => {
    if (next === "shipped") return false;
    if (next === "packing" && tracking) return false;
    return true;
  });

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Fulfilment</Heading>
        <Badge color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
      </div>

      {offeredTransitions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {offeredTransitions.map((next) => (
            <Button
              key={next}
              size="small"
              variant={next === "cancelled" ? "danger" : "secondary"}
              disabled={busy}
              onClick={() => transition.mutate(next)}
            >
              Mark {STATUS_LABELS[next].toLowerCase()}
            </Button>
          ))}
        </div>
      )}

      {tracking ? (
        <div className="flex flex-col gap-2 px-6 py-4">
          <Text size="small" weight="plus">
            Tracking
          </Text>
          <Text size="small">
            {tracking.trackingUrl ? (
              <a
                href={tracking.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-ui-fg-interactive"
              >
                {tracking.trackingNumber}
              </a>
            ) : (
              tracking.trackingNumber
            )}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {tracking.statusDescription ??
              TRACKING_STATUS_LABELS[tracking.status]}
          </Text>

          {label?.shipmentCost != null && (
            <Text size="small" className="text-ui-fg-subtle">
              {`Paid ${formatMoney(label.shipmentCost, label.currencyCode)}${label.serviceCode ? ` · ${label.serviceCode}` : ""}`}
            </Text>
          )}

          <div className="flex flex-wrap gap-2">
            {label?.canPrint && (
              <Button
                size="small"
                variant="secondary"
                disabled={print.isPending}
                onClick={() => print.mutate()}
              >
                {print.isPending ? (
                  <Spinner className="animate-spin" />
                ) : (
                  "Print label"
                )}
              </Button>
            )}
            <VoidLabelButton orderId={order.id} disabled={busy} />
          </div>

          {label?.canPrint ? (
            <Hint>Print at 4 × 6 in, Actual size (100%), Margins: None.</Hint>
          ) : (
            label && (
              <Hint variant="error">
                This label is only stored at the carrier and its link stops
                working 90 days after purchase. Print it now.
              </Hint>
            )
          )}

          <Text size="small" className="text-ui-fg-subtle">
            Voiding returns this order to packing and hides the tracking link
            from the customer. It does not recall the shipped email that has
            already gone out, and the carrier does not always refund a voided
            label.
          </Text>
        </div>
      ) : (
        status === "packing" && (
          <div className="px-6 py-4">
            <RateAndBuyPanel
              orderId={order.id}
              derivedParcel={null}
              missingDimensions={[]}
            />
          </div>
        )
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-2 px-6 py-4">
          <Text size="small" weight="plus">
            History
          </Text>
          {history.map((entry) => (
            <div key={entry.id} className="flex justify-between gap-4">
              <Text size="small">
                {entry.fromStatus
                  ? `${STATUS_LABELS[entry.fromStatus]} → ${STATUS_LABELS[entry.toStatus]}`
                  : STATUS_LABELS[entry.toStatus]}
                {entry.reason ? ` · ${entry.reason}` : ""}
              </Text>
              <Text size="small" className="text-ui-fg-subtle">
                {formatTimestamp(entry.createdAt)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
});

export default OrderFulfilmentWidget;
