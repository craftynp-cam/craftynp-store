import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";

import { describeError } from "../../../../lib/describe-error";
import { ORDER_STATUS_MODULE } from "../../../../modules/order-status";
import {
  parseTrackingWebhook,
  trackingEventKey,
  TRACKING_WEBHOOK_LOG_TAG,
} from "../../../../modules/order-status/lib";
import type OrderStatusModuleService from "../../../../modules/order-status/service";
import {
  SHIPSTATION_KEY_ID_HEADER,
  SHIPSTATION_SIGNATURE_HEADER,
  SHIPSTATION_TIMESTAMP_HEADER,
  verifyShipStationWebhook,
} from "../../../../modules/shipstation/webhook";
import applyTrackingEventWorkflow from "../../../../workflows/apply-tracking-event";

const DEFAULT_MAX_AGE_SECONDS = 300;

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const rawBody = (req as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? "";

  try {
    await verifyShipStationWebhook({
      headers: {
        keyId: req.headers[SHIPSTATION_KEY_ID_HEADER],
        signature: req.headers[SHIPSTATION_SIGNATURE_HEADER],
        timestamp: req.headers[SHIPSTATION_TIMESTAMP_HEADER],
      },
      rawBody,
      jwksUrl: process.env.SHIPSTATION_JWKS_URL,
      maxAgeSeconds: Number(
        process.env.SHIPSTATION_WEBHOOK_MAX_AGE_SECONDS ??
          DEFAULT_MAX_AGE_SECONDS,
      ),
    });
  } catch (error) {
    const reason =
      error instanceof Error && "reason" in error
        ? (error as { reason: string }).reason
        : "unverified";

    logger.warn(`${TRACKING_WEBHOOK_LOG_TAG} rejected reason=${reason}`);

    return res.status(401).json({
      error: "invalid_signature",
      message: "invalid_signature",
    });
  }

  const payload = parseTrackingWebhook(req.body);

  if (!payload) {
    logger.info(`${TRACKING_WEBHOOK_LOG_TAG} discarded reason=unparseable`);
    return res.status(200).json({ received: true });
  }

  const service =
    req.scope.resolve<OrderStatusModuleService>(ORDER_STATUS_MODULE);
  const eventKey = trackingEventKey(payload, rawBody);

  const claimed = await service.recordWebhookEvent({
    eventKey,
    trackingNumber: payload.trackingNumber,
    statusCode: payload.statusCode,
    occurredAt: payload.occurredAt,
  });

  if (!claimed) {
    logger.info(
      `${TRACKING_WEBHOOK_LOG_TAG} discarded reason=duplicate tracking=${payload.trackingNumber}`,
    );
    return res.status(200).json({ received: true });
  }

  try {
    const context = await service.shipmentContext(payload.trackingNumber);

    if (!context) {
      logger.info(
        `${TRACKING_WEBHOOK_LOG_TAG} discarded reason=unknown_shipment tracking=${payload.trackingNumber}`,
      );
      return res.status(200).json({ received: true });
    }

    if (context.shipment.voided_at) {
      logger.info(
        `${TRACKING_WEBHOOK_LOG_TAG} discarded reason=voided_label order=${context.orderId}`,
      );
      return res.status(200).json({ received: true });
    }

    if (context.status === "cancelled") {
      logger.info(
        `${TRACKING_WEBHOOK_LOG_TAG} discarded reason=order_cancelled order=${context.orderId}`,
      );
      return res.status(200).json({ received: true });
    }

    await applyTrackingEventWorkflow(req.scope).run({
      input: {
        orderId: context.orderId,
        shipmentId: context.shipment.id,
        fulfillmentId: context.shipment.fulfillment_id,
        currentStatus: context.status,
        statusCode: payload.statusCode,
        statusDescription: payload.statusDescription,
        carrierStatusDescription: payload.carrierStatusDescription,
      },
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    await service.releaseWebhookEvent(eventKey);

    const detail = describeError(error);
    logger.error(
      `${TRACKING_WEBHOOK_LOG_TAG} failed tracking=${payload.trackingNumber} error=${detail}`,
    );

    return res.status(500).json({
      error: "tracking_update_failed",
      message: `tracking_update_failed:${detail}`,
    });
  }
}
