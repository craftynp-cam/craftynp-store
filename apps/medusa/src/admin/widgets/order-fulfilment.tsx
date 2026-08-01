import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import type { OrderStatus, OrderStatusDetail } from "@craftynp/types";

import { sdk } from "../lib/client";

type OrderStatusResponse = { orderStatus: OrderStatusDetail };

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

const CARRIERS = [
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl_express", label: "DHL Express" },
];

function formatTimestamp(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function describeFailure(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

const OrderFulfilmentWidget = ({
  data: order,
}: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient();
  const queryKey = ["order-status", order.id];

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierCode, setCarrierCode] = useState("usps");

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.client.fetch<OrderStatusResponse>(`/admin/orders/${order.id}/status`),
  });

  function onSettled(message: string) {
    return {
      onSuccess: (response: OrderStatusResponse) => {
        queryClient.setQueryData(queryKey, response);
        toast.success(message);
      },
      onError: (error: unknown) => toast.error(describeFailure(error)),
    };
  }

  const transition = useMutation({
    mutationFn: (status: OrderStatus) =>
      sdk.client.fetch<OrderStatusResponse>(
        `/admin/orders/${order.id}/status`,
        { method: "POST", body: { status } },
      ),
    ...onSettled("Order status updated."),
  });

  const recordShipment = useMutation({
    mutationFn: () =>
      sdk.client.fetch<OrderStatusResponse>(
        `/admin/orders/${order.id}/shipment`,
        { method: "POST", body: { trackingNumber, carrierCode } },
      ),
    ...onSettled("Shipment recorded. The customer has been emailed."),
  });

  const voidShipment = useMutation({
    mutationFn: () =>
      sdk.client.fetch<OrderStatusResponse>(
        `/admin/orders/${order.id}/shipment/void`,
        { method: "POST", body: {} },
      ),
    ...onSettled("Shipment voided and the order returned to packing."),
  });

  if (isLoading || !data) {
    return (
      <Container className="flex items-center justify-center p-6">
        <Spinner className="animate-spin" />
      </Container>
    );
  }

  const { status, allowedTransitions, tracking, history } = data.orderStatus;
  const busy =
    transition.isPending || recordShipment.isPending || voidShipment.isPending;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Fulfilment</Heading>
        <Badge color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
      </div>

      {allowedTransitions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {allowedTransitions
            .filter((next) => next !== "shipped")
            .map((next) => (
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
            {tracking.statusDescription ?? tracking.status.replace(/_/g, " ")}
          </Text>
          <div>
            <Button
              size="small"
              variant="danger"
              disabled={busy}
              onClick={() => voidShipment.mutate()}
            >
              Void label
            </Button>
          </div>
          <Text size="small" className="text-ui-fg-subtle">
            Voiding returns this order to packing and hides the tracking link
            from the customer. It does not recall the shipped email that has
            already gone out, and the carrier does not always refund a voided
            label.
          </Text>
        </div>
      ) : (
        status === "packing" && (
          <div className="flex flex-col gap-3 px-6 py-4">
            <Text size="small" weight="plus">
              Record a shipment
            </Text>
            <div className="flex flex-col gap-1">
              <Label size="small" htmlFor="cnp-carrier">
                Carrier
              </Label>
              <Select value={carrierCode} onValueChange={setCarrierCode}>
                <Select.Trigger id="cnp-carrier">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {CARRIERS.map((carrier) => (
                    <Select.Item key={carrier.value} value={carrier.value}>
                      {carrier.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label size="small" htmlFor="cnp-tracking">
                Tracking number
              </Label>
              <Input
                id="cnp-tracking"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="9400111899223197428490"
              />
            </div>
            <div>
              <Button
                size="small"
                disabled={busy || trackingNumber.trim().length === 0}
                onClick={() => recordShipment.mutate()}
              >
                Mark shipped
              </Button>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Buying a label from inside the admin arrives with the fulfilment
              workspace. Until then, enter the tracking number from the label
              you bought and this will email the customer.
            </Text>
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
