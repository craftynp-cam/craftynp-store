import { randomUUID } from "node:crypto";

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type {
  INotificationModuleService,
  Logger,
} from "@medusajs/framework/types";
import { resolveSiteContent, type CustomQuoteRequest } from "@craftynp/types";

import { SITE_CONTENT_MODULE } from "../../../modules/site-content";
import type SiteContentModuleService from "../../../modules/site-content/service";
import { customQuoteEmailContent } from "../../../lib/custom-quote-email";

export const CUSTOM_QUOTE_FAILED_LOG_TAG = "[custom-quote:failed]";

export async function POST(
  req: MedusaRequest<CustomQuoteRequest>,
  res: MedusaResponse,
) {
  const request = req.validatedBody;

  if (request.company !== "") {
    return res.status(202).json({ received: true });
  }

  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const siteContent =
    req.scope.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);
  const notification = req.scope.resolve<INotificationModuleService>(
    Modules.NOTIFICATION,
  );

  const id = randomUUID();

  try {
    const { custom_quote_email: to } = resolveSiteContent(
      await siteContent.listSiteContentEntries({
        key: ["custom_quote_email"],
      }),
    );

    await notification.createNotifications({
      to,
      channel: "email",
      trigger_type: "custom_quote.requested",
      resource_id: id,
      resource_type: "custom_quote",
      idempotency_key: `custom-quote:${id}`,
      content: customQuoteEmailContent(request),
      data: { reply_to: request.email },
    });
  } catch (error) {
    logger.error(
      `${CUSTOM_QUOTE_FAILED_LOG_TAG} quote=${id} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return res.status(502).json({ error: "custom_quote_unavailable" });
  }

  return res.status(202).json({ received: true });
}
