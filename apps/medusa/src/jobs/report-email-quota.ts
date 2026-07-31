import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type {
  Logger,
  MedusaContainer,
  INotificationModuleService,
} from "@medusajs/framework/types";

import { RESEND_FREE_TIER_DAILY_CAP } from "../modules/notification-resend/lib";

export const EMAIL_QUOTA_DAILY_LOG_TAG = "[email:quota-daily]";

export default async function reportEmailQuota(container: MedusaContainer) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notification = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION,
  );

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const sent = await notification.listNotifications({
    created_at: { $gte: startOfDay.toISOString() },
  });

  const threshold = Number(
    process.env.RESEND_DAILY_QUOTA_ALERT_THRESHOLD ?? 20,
  );
  const remaining = RESEND_FREE_TIER_DAILY_CAP - sent.length;
  const line = `${EMAIL_QUOTA_DAILY_LOG_TAG} sent=${sent.length} cap=${RESEND_FREE_TIER_DAILY_CAP} remaining=${remaining}`;

  // Warn rather than info once the day's allowance is nearly gone. There is no
  // alerting sink in this project yet, so a stable log tag is what a log-based
  // alert will be attached to.
  if (remaining <= threshold) {
    logger.warn(line);
    return;
  }

  logger.info(line);
}

export const config = {
  name: "report-email-quota",
  schedule: "0 23 * * *",
};
