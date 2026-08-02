import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Spinner, TruckFast } from "@medusajs/icons";
import { Checkbox, Container, Heading, Table, Text } from "@medusajs/ui";

import { fetchQueue, queueQueryKey } from "../../lib/fulfilment-api";
import { BalanceBadge } from "../../components/fulfilment/balance-badge";
import { BatchPrintBar } from "../../components/fulfilment/batch-print-bar";
import { QueueTable } from "../../components/fulfilment/queue-table";
import { RateAndBuyPanel } from "../../components/fulfilment/rate-and-buy-panel";

const FulfilmentPage = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  function toggleChecked(orderId: string) {
    setChecked((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: queueQueryKey,
    queryFn: fetchQueue,
  });

  if (isLoading || !data) {
    return (
      <Container className="flex items-center justify-center p-6">
        <Spinner className="animate-spin" />
      </Container>
    );
  }

  const orders = data.orders;
  const printable = data.printable;
  const selected =
    orders.find((entry) => entry.orderId === selectedOrderId) ?? null;
  const displayIdByOrderId = new Map(
    printable.map((label) => [label.orderId, label.displayId]),
  );

  return (
    <div className="flex flex-col gap-4">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">Fulfilment</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Orders that are packed and ready for a shipping label.
            </Text>
          </div>
          <BalanceBadge />
        </div>

        {orders.length === 0 ? (
          <div className="px-6 py-8">
            <Text size="small" className="text-ui-fg-subtle">
              Nothing is waiting to ship. Orders appear here once you move them
              to packing.
            </Text>
          </div>
        ) : (
          <QueueTable
            orders={orders}
            selectedOrderId={selectedOrderId}
            onSelect={setSelectedOrderId}
          />
        )}
      </Container>

      {printable.length > 0 && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">Labels ready to print</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Bought in the last two weeks. Tick several and print them as one
              job.
            </Text>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell />
                <Table.HeaderCell>Order</Table.HeaderCell>
                <Table.HeaderCell>Tracking</Table.HeaderCell>
                <Table.HeaderCell>Bought</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {printable.map((label) => (
                <Table.Row key={label.orderId}>
                  <Table.Cell>
                    <Checkbox
                      checked={checked.includes(label.orderId)}
                      onCheckedChange={() => toggleChecked(label.orderId)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {`#${label.displayId}`}
                    </Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {label.customerName}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{label.trackingNumber}</Table.Cell>
                  <Table.Cell>
                    {label.shippedAt
                      ? new Date(label.shippedAt).toLocaleDateString()
                      : ""}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          <div className="px-6 py-4">
            <BatchPrintBar
              orderIds={checked}
              displayIdByOrderId={displayIdByOrderId}
              onClear={() => setChecked([])}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              Print at 4 × 6 in, Actual size (100%), Margins: None.
            </Text>
          </div>
        </Container>
      )}

      {selected && (
        <Container className="divide-y p-0">
          <div className="px-6 py-4">
            <Heading level="h2">{`Order #${selected.displayId}`}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {selected.destination
                ? [
                    selected.destination.name,
                    selected.destination.addressLine1,
                    selected.destination.addressLine2,
                    `${selected.destination.city}, ${selected.destination.state} ${selected.destination.postalCode}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "This order has no delivery address."}
            </Text>
          </div>

          <div className="flex flex-col gap-1 px-6 py-4">
            <Text size="small" weight="plus">
              Packing list
            </Text>
            {selected.items.map((item, index) => (
              <Text key={`${item.sku ?? item.title}-${index}`} size="small">
                {`${item.quantity} × ${item.title}${item.variantTitle ? ` (${item.variantTitle})` : ""}`}
              </Text>
            ))}
          </div>

          <div className="px-6 py-4">
            <RateAndBuyPanel
              key={selected.orderId}
              orderId={selected.orderId}
              derivedParcel={selected.derivedParcel}
              missingDimensions={selected.missingDimensions}
              onBought={() => setSelectedOrderId(null)}
            />
          </div>
        </Container>
      )}
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Fulfilment",
  icon: TruckFast,
});

export default FulfilmentPage;
