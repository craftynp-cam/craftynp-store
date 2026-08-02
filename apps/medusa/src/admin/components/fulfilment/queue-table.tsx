import { Badge, Table, Text } from "@medusajs/ui";
import { formatParcelSummary } from "@craftynp/types";
import type { QueueEntry } from "@craftynp/types";

type Props = {
  orders: readonly QueueEntry[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
};

function itemCount(entry: QueueEntry): number {
  return entry.items.reduce((total, item) => total + item.quantity, 0);
}

function destinationLine(entry: QueueEntry): string {
  if (!entry.destination) return "No delivery address";
  const { city, state, postalCode } = entry.destination;
  return [city, state].filter(Boolean).join(", ") + ` ${postalCode}`;
}

function placedOn(entry: QueueEntry): string {
  const date = new Date(entry.placedAt);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

export const QueueTable = ({ orders, selectedOrderId, onSelect }: Props) => (
  <Table>
    <Table.Header>
      <Table.Row>
        <Table.HeaderCell>Order</Table.HeaderCell>
        <Table.HeaderCell>Placed</Table.HeaderCell>
        <Table.HeaderCell>Deliver to</Table.HeaderCell>
        <Table.HeaderCell>Items</Table.HeaderCell>
        <Table.HeaderCell>Parcel</Table.HeaderCell>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {orders.map((entry) => (
        <Table.Row
          key={entry.orderId}
          onClick={() => onSelect(entry.orderId)}
          className={
            entry.orderId === selectedOrderId
              ? "bg-ui-bg-highlight cursor-pointer"
              : "cursor-pointer"
          }
        >
          <Table.Cell>
            <Text size="small" weight="plus">
              {`#${entry.displayId}`}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {entry.customerName}
            </Text>
          </Table.Cell>
          <Table.Cell>{placedOn(entry)}</Table.Cell>
          <Table.Cell>{destinationLine(entry)}</Table.Cell>
          <Table.Cell>{itemCount(entry)}</Table.Cell>
          <Table.Cell>
            {entry.derivedParcel ? (
              formatParcelSummary(entry.derivedParcel)
            ) : (
              <Badge color="orange">Needs a parcel</Badge>
            )}
          </Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  </Table>
);
