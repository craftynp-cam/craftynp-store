import {
  ContainerRegistrationKeys,
  Modules,
  NotificationStatus,
} from "@medusajs/framework/utils";
import type {
  CreateNotificationDTO,
  FilterableNotificationProps,
  INotificationModuleService,
  Logger,
  MedusaContainer,
  NotificationDTO,
} from "@medusajs/framework/types";

import { describeError } from "../lib/describe-error";
import {
  readReplayLedger,
  withoutReplayContent,
} from "../lib/notification-replay";
import { permanentRejectionStatus } from "../modules/notification-resend/lib";

export const EMAIL_RETRY_LOG_TAG = "[email:retry]";
export const EMAIL_RETRY_EXHAUSTED_LOG_TAG = "[email:retry-exhausted]";

const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPLAY_CONTENT_LOOKBACK_MS = 7 * RETRY_WINDOW_MS;

type StoredNotification = NotificationDTO & {
  idempotency_key?: string | null;
};

type NotificationLedger = INotificationModuleService & {
  updateNotifications(
    data: { id: string; provider_data: Record<string, unknown> }[],
  ): Promise<unknown>;
};

function oneLine(error: unknown): string {
  return describeError(error).replace(/\s+/g, " ").trim();
}

export default async function retryFailedNotifications(
  container: MedusaContainer,
) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notification = container.resolve<NotificationLedger>(
    Modules.NOTIFICATION,
  );

  const now = Date.now();
  const windowStart = now - RETRY_WINDOW_MS;

  const exhaust = async (row: StoredNotification, reason: string) => {
    logger.warn(
      `${EMAIL_RETRY_EXHAUSTED_LOG_TAG} reason=${reason} notification=${row.id}`,
    );
    await notification.updateNotifications([
      {
        id: row.id,
        provider_data: withoutReplayContent(row.provider_data, reason),
      },
    ]);
  };

  const failed = (await notification.listNotifications({
    status: NotificationStatus.FAILURE,
    created_at: { $gte: new Date(windowStart).toISOString() },
  } as FilterableNotificationProps)) as StoredNotification[];

  for (const row of failed) {
    const ledger = readReplayLedger(row.provider_data);
    if (ledger.exhausted) continue;

    if (!row.idempotency_key) {
      await exhaust(row, "no_idempotency_key");
      continue;
    }

    if (!ledger.content) {
      await exhaust(row, "no_stored_content");
      continue;
    }

    const replay: CreateNotificationDTO & { id: string } = {
      id: row.id,
      to: row.to,
      from: row.from ?? null,
      channel: row.channel,
      trigger_type: row.trigger_type ?? null,
      resource_id: row.resource_id ?? null,
      resource_type: row.resource_type ?? null,
      receiver_id: row.receiver_id ?? null,
      idempotency_key: row.idempotency_key,
      content: ledger.content,
      provider_data: row.provider_data ?? null,
    };

    try {
      await notification.createNotifications(replay);
    } catch (error) {
      const message = oneLine(error);
      const status = permanentRejectionStatus(message);

      if (status !== null) {
        await exhaust(row, `rejected status=${status}`);
        continue;
      }

      logger.warn(
        `${EMAIL_RETRY_LOG_TAG} notification=${row.id} outcome=still_failing error=${message}`,
      );
      continue;
    }

    const settled = await notification.retrieveNotification(row.id);

    if (settled.status === "success") {
      logger.info(
        `${EMAIL_RETRY_LOG_TAG} notification=${row.id} outcome=sent external_id=${settled.external_id ?? ""}`,
      );
    } else {
      logger.warn(
        `${EMAIL_RETRY_LOG_TAG} notification=${row.id} outcome=still_failing status=${settled.status}`,
      );
    }
  }

  const recent = (await notification.listNotifications({
    created_at: {
      $gte: new Date(now - REPLAY_CONTENT_LOOKBACK_MS).toISOString(),
    },
  })) as StoredNotification[];

  for (const row of recent) {
    const ledger = readReplayLedger(row.provider_data);

    if (row.status === "success") {
      if (ledger.content) {
        await notification.updateNotifications([
          {
            id: row.id,
            provider_data: withoutReplayContent(row.provider_data),
          },
        ]);
      }
      continue;
    }

    if (
      row.status === "failure" &&
      !ledger.exhausted &&
      new Date(row.created_at).getTime() < windowStart
    ) {
      await exhaust(row, "window_expired");
    }
  }
}

export const config = {
  name: "retry-failed-notifications",
  schedule: "*/15 * * * *",
};
