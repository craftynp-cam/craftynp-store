import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Spinner, TruckFast } from "@medusajs/icons";
import { Container, Heading, Text } from "@medusajs/ui";

import { fetchQueue, queueQueryKey } from "../../lib/fulfilment-api";
import { QueueTable } from "../../components/fulfilment/queue-table";
import { RateAndBuyPanel } from "../../components/fulfilment/rate-and-buy-panel";

const FulfilmentPage = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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
  const selected =
    orders.find((entry) => entry.orderId === selectedOrderId) ?? null;

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
