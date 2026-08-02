import { model } from "@medusajs/framework/utils";

import OrderStatusRecord from "./order-status-record";

const ShipmentTracking = model.define("shipment_tracking", {
  id: model.id().primaryKey(),
  tracking_number: model.text().unique(),
  fulfillment_id: model.text().nullable(),
  carrier_code: model.text().nullable(),
  carrier_id: model.text().nullable(),
  service_code: model.text().nullable(),
  label_id: model.text().nullable(),
  label_url: model.text().nullable(),
  label_file_id: model.text().nullable(),
  shipment_cost: model.bigNumber().nullable(),
  shipment_cost_currency: model.text().nullable(),
  void_approved: model.boolean().nullable(),
  void_message: model.text().nullable(),
  tracking_status: model.text(),
  tracking_status_description: model.text().nullable(),
  shipped_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  voided_at: model.dateTime().nullable(),
  order_status: model.belongsTo(() => OrderStatusRecord, {
    mappedBy: "shipments",
  }),
});

export default ShipmentTracking;
