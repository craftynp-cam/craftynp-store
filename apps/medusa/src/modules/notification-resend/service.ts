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

// The module service hands the whole notification row to send(), so the
// idempotency key is there at runtime even though the published DTO omits it.
// `template` is typed as required on ProviderSendNotificationDTO, but a
// content-based send (the path every real caller here uses) never sets it.
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

    // Deliberately not validated here. Medusa builds every provider at boot, so
    // throwing on a missing key would stop the whole backend starting over
    // email — which is explicitly not on the critical path anywhere else.
    // Fail on the first send instead, where it lands in the notification row.
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

    // Resend's REST API does not reliably apply `variables` to a template.id
    // send — every field, not only ones used inside an href, silently fell
    // back to its declared default in testing against this account (see
    // apps/medusa/docs/auth0-custom-email-provider.md for where this was
    // first found). notification.content carries fully-rendered html/text
    // built server-side instead, which every caller in this repo now uses;
    // the template.id path stays only as a fallback for a caller that hasn't
    // been migrated, and is not to be trusted for anything with a variable.
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
          // Thrown, not swallowed: the module records the row as FAILURE so the
          // retry job picks it up instead of the mail vanishing.
          throw new ResendQuotaExceededError(
            `Resend daily quota exhausted: ${text}`,
          );
        }

        const error = new ResendSendError(
          `Resend rejected the send (${response.status}): ${text}`,
          response.status,
        );

        // 4xx other than 429 will fail identically on every retry.
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
    // Not present on a paid plan, per Resend's own docs — nothing to report.
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
