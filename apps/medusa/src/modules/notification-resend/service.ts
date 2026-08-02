import { AbstractNotificationProviderService } from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/framework/types";
import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types";

import {
  isQuotaExceeded,
  readQuotaHeaders,
  RESEND_API_URL,
  RESEND_FREE_TIER_DAILY_CAP,
  RESEND_QUOTA_LOG_TAG,
  RESEND_QUOTA_LOW_LOG_TAG,
  RESEND_SEND_FAILED_LOG_TAG,
  ResendQuotaExceededError,
  ResendSendError,
  validateResendOptions,
  type ResendOptions,
} from "./lib";

type NotificationWithIdempotency = Omit<
  ProviderSendNotificationDTO,
  "template"
> & {
  template?: string;
  idempotency_key?: string | null;
};

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static override identifier = "resend";

  private readonly rawOptions_: unknown;
  private readonly logger_: Logger;
  private resolvedOptions_: ResendOptions | null = null;

  constructor({ logger }: { logger: Logger }, options: unknown) {
    super();
    this.rawOptions_ = options;
    this.logger_ = logger;

    try {
      validateResendOptions(options);
    } catch (error) {
      this.logger_.warn(
        `${RESEND_SEND_FAILED_LOG_TAG} reason=not_configured detail=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private get options_(): ResendOptions {
    this.resolvedOptions_ ??= validateResendOptions(this.rawOptions_);
    return this.resolvedOptions_;
  }

  override async send(
    notification: NotificationWithIdempotency,
  ): Promise<ProviderSendNotificationResultsDTO> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options_.apiKey}`,
      "Content-Type": "application/json",
    };
    if (notification.idempotency_key) {
      headers["Idempotency-Key"] = notification.idempotency_key;
    }

    const from = notification.from?.trim() || this.options_.from;
    const to = [notification.to];
    const replyTo = this.options_.replyTo
      ? { reply_to: this.options_.replyTo }
      : {};

    const body = JSON.stringify(
      notification.content?.html
        ? {
            from,
            to,
            ...replyTo,
            subject: notification.content.subject,
            html: notification.content.html,
            text: notification.content.text,
          }
        : {
            from,
            to,
            ...replyTo,
            template: { id: notification.template },
            variables: notification.data ?? {},
          },
    );

    const response = await this.fetchWithRetry_(headers, body);
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
    };

    return payload.id ? { id: payload.id } : {};
  }

  private async fetchWithRetry_(
    headers: Record<string, string>,
    body: string,
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.options_.maxRetries; attempt += 1) {
      try {
        const response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(this.options_.timeoutMs),
        });

        this.reportQuota_(response);

        if (response.ok) return response;

        const text = await response.text();

        if (isQuotaExceeded(response.status, text)) {
          throw new ResendQuotaExceededError(
            `Resend daily quota exhausted: ${text}`,
          );
        }

        const error = new ResendSendError(
          `Resend rejected the send (${response.status}): ${text}`,
          response.status,
        );

        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof ResendQuotaExceededError) throw error;
        if (error instanceof ResendSendError && error.status < 500) throw error;
        lastError = error;
      }
    }

    const detail =
      lastError instanceof Error ? lastError.message : String(lastError);
    this.logger_.error(`${RESEND_SEND_FAILED_LOG_TAG} error=${detail}`);
    throw lastError instanceof Error ? lastError : new Error(detail);
  }

  private reportQuota_(response: Response): void {
    const { usedToday } = readQuotaHeaders(response.headers);
    if (usedToday == null) return;

    const remaining = RESEND_FREE_TIER_DAILY_CAP - usedToday;
    const line = `remaining=${remaining} used=${usedToday} cap=${RESEND_FREE_TIER_DAILY_CAP}`;

    if (remaining <= this.options_.dailyQuotaAlertThreshold) {
      this.logger_.warn(`${RESEND_QUOTA_LOW_LOG_TAG} ${line}`);
      return;
    }

    this.logger_.info(`${RESEND_QUOTA_LOG_TAG} ${line}`);
  }
}

export default ResendNotificationProviderService;
