import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type {
  Logger,
  MedusaContainer,
  NotificationDTO,
  INotificationModuleService,
} from "@medusajs/framework/types";

export const EMAIL_RETRY_LOG_TAG = "[email:retry]";
export const EMAIL_RETRY_EXHAUSTED_LOG_TAG = "[email:retry-exhausted]";

// Resend's own Idempotency-Key expires after 24 hours, so retrying past that
// window would start sending duplicates rather than resuming the same send.
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

// idempotency_key is on the notification model but not on the published DTO.
type FailedNotification = NotificationDTO & {
  idempotency_key?: string | null;
};

export default async function retryFailedNotifications(
  container: MedusaContainer,
) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notification = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION,
  );

  const windowStart = new Date(Date.now() - RETRY_WINDOW_MS);

  const recent = (await notification.listNotifications({
    created_at: { $gte: windowStart.toISOString() },
  })) as FailedNotification[];

  const failed = recent.filter((row) => row.status === "failure");
  if (failed.length === 0) return;

  for (const row of failed) {
    if (!row.idempotency_key) {
      // Without a key the module would send a second copy rather than resume
      // the first, so leave it for a human instead.
      logger.warn(
        `${EMAIL_RETRY_EXHAUSTED_LOG_TAG} reason=no_idempotency_key notification=${row.id}`,
      );
      continue;
    }

    try {
      // The same key is deliberate: createNotifications_ reprocesses a key
      // whose row is FAILURE and skips one that already succeeded.
      await notification.createNotifications({
        to: row.to,
        channel: row.channel,
        template: row.template,
        ...(row.trigger_type ? { trigger_type: row.trigger_type } : {}),
        ...(row.resource_id ? { resource_id: row.resource_id } : {}),
        ...(row.resource_type ? { resource_type: row.resource_type } : {}),
        idempotency_key: row.idempotency_key,
        data: row.data ?? {},
      });

      logger.info(`${EMAIL_RETRY_LOG_TAG} notification=${row.id} outcome=sent`);
    } catch (error) {
      logger.warn(
        `${EMAIL_RETRY_LOG_TAG} notification=${row.id} outcome=still_failing error=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

export const config = {
  name: "retry-failed-notifications",
  schedule: "*/15 * * * *",
};
