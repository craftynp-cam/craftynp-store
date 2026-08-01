import { model } from "@medusajs/framework/utils";

import OrderStatusHistoryEntry from "./order-status-history-entry";
import ShipmentTracking from "./shipment-tracking";

const OrderStatusRecord = model.define("order_status", {
  id: model.id().primaryKey(),
  order_id: model.text().unique(),
  status: model.text(),
  changed_at: model.dateTime(),
  history: model.hasMany(() => OrderStatusHistoryEntry, {
    mappedBy: "order_status",
  }),
  shipments: model.hasMany(() => ShipmentTracking, {
    mappedBy: "order_status",
  }),
});

export default OrderStatusRecord;
