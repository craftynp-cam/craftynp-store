import type { Logger } from "@medusajs/framework/types";

import ResendNotificationProviderService from "./service";
import { ResendQuotaExceededError, ResendSendError } from "./lib";

const OPTIONS = {
  channels: ["email"],
  apiKey: "re_test",
  from: "The Crafty NP <orders@thecraftynp.org>",
  replyTo: "hello@thecraftynp.org",
  timeoutMs: 1000,
  maxRetries: 1,
  dailyQuotaAlertThreshold: 20,
};

const NOTIFICATION = {
  to: "jamie@example.com",
  channel: "email",
  template: "order-confirmation",
  data: { ORDER_NUMBER: "#CNP-2853" },
  idempotency_key: "order-confirmation:order_01",
};

const CONTENT_NOTIFICATION = {
  to: "jamie@example.com",
  channel: "email",
  content: {
    subject: "Your Crafty NP order #CNP-2853 is confirmed",
    html: "<p>#CNP-2853</p>",
    text: "#CNP-2853",
  },
  idempotency_key: "order-confirmation:order_01",
};

type MockLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

function buildService() {
  const logger: MockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const service = new ResendNotificationProviderService(
    { logger: logger as unknown as Logger },
    OPTIONS,
  );

  return { service, logger };
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe("ResendNotificationProviderService.send", () => {
  it("sends notification.content as raw html/text/subject, not template.id + variables", async () => {
    // Resend's REST API does not reliably apply `variables` to a template.id
    // send on this account — every field, not just ones inside an href,
    // silently fell back to its declared default. Every real caller in this
    // repo builds the HTML itself and sends it via content instead.
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ id: "re_1" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service } = buildService();
    const result = await service.send(CONTENT_NOTIFICATION);

    expect(result).toEqual({ id: "re_1" });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers["Idempotency-Key"]).toBe("order-confirmation:order_01");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      to: ["jamie@example.com"],
      subject: "Your Crafty NP order #CNP-2853 is confirmed",
      html: "<p>#CNP-2853</p>",
      text: "#CNP-2853",
      reply_to: "hello@thecraftynp.org",
    });
    expect(body).not.toHaveProperty("template");
    expect(body).not.toHaveProperty("variables");
  });

  it("falls back to template.id + variables when no content is provided", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ id: "re_1" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service } = buildService();
    const result = await service.send(NOTIFICATION);

    expect(result).toEqual({ id: "re_1" });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers["Idempotency-Key"]).toBe("order-confirmation:order_01");
    expect(JSON.parse(init.body)).toMatchObject({
      to: ["jamie@example.com"],
      template: { id: "order-confirmation" },
      variables: { ORDER_NUMBER: "#CNP-2853" },
      reply_to: "hello@thecraftynp.org",
    });
  });

  it("throws a typed error when the daily quota is exhausted, so the row lands as a retryable failure", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('{"name":"daily_quota_exceeded"}', { status: 429 }),
      ) as unknown as typeof fetch;

    const { service } = buildService();

    await expect(service.send(NOTIFICATION)).rejects.toBeInstanceOf(
      ResendQuotaExceededError,
    );
  });

  it("warns when the remaining daily allowance drops to the threshold", async () => {
    // x-resend-daily-quota is the *used* count, not remaining — 85 used
    // against the 100 cap leaves 15, under the threshold of 20.
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { id: "re_2" },
          { headers: { "x-resend-daily-quota": "85" } },
        ),
      ) as unknown as typeof fetch;

    const { service, logger } = buildService();
    await service.send(NOTIFICATION);

    expect(logger.warn).toHaveBeenCalledWith(
      "[email:quota-low] remaining=15 used=85 cap=100",
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("logs at info, not warn, while comfortably under the threshold", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { id: "re_2" },
          { headers: { "x-resend-daily-quota": "10" } },
        ),
      ) as unknown as typeof fetch;

    const { service, logger } = buildService();
    await service.send(NOTIFICATION);

    expect(logger.info).toHaveBeenCalledWith(
      "[email:quota] remaining=90 used=10 cap=100",
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("does not confuse the per-request ratelimit-* headers for the daily email quota", async () => {
    // ratelimit-remaining/limit govern API request throttling, a different
    // concept entirely — a low value here must never trip the quota warning.
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { id: "re_2" },
          { headers: { "ratelimit-remaining": "1", "ratelimit-limit": "2" } },
        ),
      ) as unknown as typeof fetch;

    const { service, logger } = buildService();
    await service.send(NOTIFICATION);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("says nothing on a paid plan, which never sends the quota header", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ id: "re_2" }));

    const { service, logger } = buildService();
    await service.send(NOTIFICATION);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("does not retry a 4xx, which would fail identically every time", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response('{"name":"validation_error"}', { status: 422 }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service } = buildService();

    await expect(service.send(NOTIFICATION)).rejects.toBeInstanceOf(
      ResendSendError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("starts up without an api key, and fails on send instead", async () => {
    // Medusa builds every provider at boot, so throwing in the constructor
    // would stop the backend starting over a missing email key.
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const service = new ResendNotificationProviderService(
      { logger: logger as unknown as Logger },
      { ...OPTIONS, apiKey: "" },
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("reason=not_configured"),
    );
    await expect(service.send(NOTIFICATION)).rejects.toThrow(
      "RESEND_API_KEY is required",
    );
  });

  it("retries a 5xx up to maxRetries before giving up", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response("upstream down", { status: 503 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { service } = buildService();

    await expect(service.send(NOTIFICATION)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
