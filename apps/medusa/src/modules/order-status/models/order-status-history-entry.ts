import { model } from "@medusajs/framework/utils";

import OrderStatusRecord from "./order-status-record";

const OrderStatusHistoryEntry = model.define("order_status_history", {
  id: model.id().primaryKey(),
  from_status: model.text().nullable(),
  to_status: model.text(),
  reason: model.text().nullable(),
  actor_type: model.text(),
  actor_id: model.text().nullable(),
  order_status: model.belongsTo(() => OrderStatusRecord, {
    mappedBy: "history",
  }),
});

export default OrderStatusHistoryEntry;
