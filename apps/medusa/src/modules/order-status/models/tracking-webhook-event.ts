import { model } from "@medusajs/framework/utils";

const TrackingWebhookEvent = model.define("tracking_webhook_event", {
  id: model.id().primaryKey(),
  event_key: model.text().unique(),
  tracking_number: model.text(),
  status_code: model.text(),
  occurred_at: model.dateTime().nullable(),
});

export default TrackingWebhookEvent;
