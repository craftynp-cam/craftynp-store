import type { SubscriberArgs } from "@medusajs/framework";
import type {
  InternalModuleDeclaration,
  Logger,
  MedusaContainer,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import NotificationModuleService from "@medusajs/notification/dist/services/notification-module-service";

import ResendNotificationProviderService from "../modules/notification-resend/service";
import { ORDER_STATUS_MODULE } from "../modules/order-status";
import { SITE_CONTENT_MODULE } from "../modules/site-content";
import sendOrderConfirmationEmail from "../subscribers/send-order-confirmation-email";
import retryFailedNotifications from "./retry-failed-notifications";

const HOUR_MS = 60 * 60 * 1000;

const COLUMNS = [
  "id",
  "to",
  "from",
  "channel",
  "template",
  "data",
  "provider_data",
  "trigger_type",
  "resource_id",
  "resource_type",
  "receiver_id",
  "original_notification_id",
  "idempotency_key",
  "external_id",
  "status",
  "provider_id",
] as const;

type StoredRow = Record<string, unknown> & {
  id: string;
  status: string;
  created_at: Date;
  provider_data: Record<string, unknown> | null;
};

const ORDER_ROW = {
  id: "order_01",
  display_id: 2853,
  email: "jamie@example.com",
  created_at: "2026-09-13T12:00:00.000Z",
  status: "pending",
  currency_code: "usd",
  customer_id: null,
  item_subtotal: 40,
  shipping_subtotal: 6,
  tax_total: 3.2,
  total: 49.2,
  items: [],
  shipping_address: null,
  shipping_methods: [],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inMemoryNotificationTable() {
  const rows = new Map<string, StoredRow>();

  const matches = (row: StoredRow, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([key, condition]) => {
      if (key === "created_at") {
        const { $gte, $lt, ...rest } = condition as Record<string, string>;
        if (Object.keys(rest).length > 0) {
          throw new Error(
            `unsupported created_at filter ${JSON.stringify(rest)}`,
          );
        }
        const time = row.created_at.getTime();
        return (
          ($gte === undefined || time >= Date.parse($gte)) &&
          ($lt === undefined || time < Date.parse($lt))
        );
      }
      if (Array.isArray(condition)) return condition.includes(row[key]);
      if (isPlainObject(condition)) {
        throw new Error(`unsupported filter on ${key}`);
      }
      return row[key] === condition;
    });

  const service = {
    async list(filters: Record<string, unknown> = {}) {
      return [...rows.values()]
        .filter((row) => matches(row, filters))
        .map((row) => structuredClone(row));
    },
    async retrieve(id: string) {
      const row = rows.get(id);
      if (!row) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Notification with id: ${id} was not found`,
        );
      }
      return structuredClone(row);
    },
    async create(data: Record<string, unknown>[]) {
      return data.map((entry) => {
        const row: StoredRow = {
          ...Object.fromEntries(COLUMNS.map((column) => [column, null])),
          ...Object.fromEntries(
            COLUMNS.filter((column) => entry[column] !== undefined).map(
              (column) => [column, entry[column]],
            ),
          ),
          id: String(entry.id),
          status: typeof entry.status === "string" ? entry.status : "pending",
          provider_data: isPlainObject(entry.provider_data)
            ? entry.provider_data
            : null,
          created_at: new Date(),
        };
        rows.set(row.id, row);
        return structuredClone(row);
      });
    },
    async update(data: Record<string, unknown>[]) {
      const missing = data
        .map((entry) => String(entry.id))
        .filter((id) => !rows.has(id));
      if (missing.length > 0) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Notification with id "${missing.join(", ")}" not found`,
        );
      }

      return data.map((entry) => {
        const row = rows.get(String(entry.id))!;
        const columns: Record<string, unknown> = row;
        for (const column of COLUMNS) {
          if (!(column in entry)) continue;
          const current = columns[column];
          const next = entry[column];
          columns[column] =
            isPlainObject(current) && isPlainObject(next)
              ? { ...current, ...next }
              : next;
        }
        return structuredClone(row);
      });
    },
  };

  return { rows, service };
}

type MockLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

function buildHarness() {
  const logger: MockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const resend = new ResendNotificationProviderService(
    { logger: logger as unknown as Logger },
    {
      channels: ["email"],
      apiKey: "re_test",
      from: "The Crafty NP <orders@thecraftynp.org>",
      replyTo: "hello@thecraftynp.org",
      timeoutMs: 1000,
      maxRetries: 0,
      dailyQuotaAlertThreshold: 20,
    },
  );

  const table = inMemoryNotificationTable();

  const module = new NotificationModuleService(
    {
      baseRepository: {
        getFreshManager: () => ({}),
        getActiveManager: () => ({}),
        transaction: async (task: (manager: unknown) => Promise<unknown>) =>
          task({}),
        serialize: async (data: unknown) => structuredClone(data),
      },
      notificationService: table.service,
      notificationProviderService: {
        getProviderForChannels: async (channels: string[]) =>
          channels.map(() => ({
            id: "resend",
            channels: ["email"],
            is_enabled: true,
          })),
        send: (_provider: unknown, notification: Record<string, unknown>) =>
          resend.send(notification as never),
      },
    } as unknown as ConstructorParameters<typeof NotificationModuleService>[0],
    {} as InternalModuleDeclaration,
  );

  const registrations: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: logger,
    [ContainerRegistrationKeys.QUERY]: {
      graph: async () => ({ data: [ORDER_ROW] }),
    },
    [Modules.NOTIFICATION]: module,
    [ORDER_STATUS_MODULE]: {
      currentStatus: async () => "received",
      activeShipment: async () => null,
    },
    [SITE_CONTENT_MODULE]: { listSiteContentEntries: async () => [] },
  };

  const container = {
    resolve: (key: string) => {
      if (!(key in registrations)) throw new Error(`unregistered ${key}`);
      return registrations[key];
    },
  } as unknown as MedusaContainer;

  const placeOrder = () =>
    sendOrderConfirmationEmail({
      event: { name: "order.placed", data: { id: ORDER_ROW.id } },
      container,
    } as unknown as SubscriberArgs<{ id: string }>);

  const onlyRow = () => {
    const all = [...table.rows.values()];
    expect(all).toHaveLength(1);
    return all[0]!;
  };

  return { logger, table, container, placeOrder, onlyRow };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unavailable() {
  return new Response('{"name":"service_unavailable"}', { status: 503 });
}

function mockFetch(...responses: Response[]) {
  const fetchMock = jest.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function linesContaining(mock: jest.Mock, fragment: string): string[] {
  return mock.mock.calls
    .map(([line]) => String(line))
    .filter((line) => line.includes(fragment));
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe("retryFailedNotifications", () => {
  it("replays the email exactly as first sent, under its original key, and marks that same row sent", async () => {
    const fetchMock = mockFetch(unavailable(), jsonResponse({ id: "re_1" }));
    const harness = buildHarness();

    await harness.placeOrder();
    const failed = harness.onlyRow();
    expect(failed.status).toBe("failure");

    await retryFailedNotifications(harness.container);

    expect(harness.onlyRow()).toMatchObject({
      id: failed.id,
      status: "success",
      external_id: "re_1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [original, replay] = fetchMock.mock.calls.map(([, init]) => init);
    expect(replay.headers["Idempotency-Key"]).toBe(
      "order-confirmation:order_01",
    );
    expect(replay.headers["Idempotency-Key"]).toBe(
      original.headers["Idempotency-Key"],
    );
    expect(replay.body).toBe(original.body);

    expect(harness.logger.info).toHaveBeenCalledWith(
      `[email:retry] notification=${failed.id} outcome=sent external_id=re_1`,
    );
    expect(harness.onlyRow().provider_data?.replay_content).toBeNull();
  });

  it("keeps the row failed and logs Resend's own error, not a not-found from Medusa", async () => {
    mockFetch(unavailable(), unavailable());
    const harness = buildHarness();

    await harness.placeOrder();
    await retryFailedNotifications(harness.container);

    const row = harness.onlyRow();
    expect(row.status).toBe("failure");
    expect(row.provider_data?.replay_content).toMatchObject({
      subject: expect.any(String),
    });

    const [line, ...rest] = linesContaining(
      harness.logger.warn,
      "[email:retry]",
    );
    expect(rest).toHaveLength(0);
    expect(line).toContain(`notification=${row.id} outcome=still_failing`);
    expect(line).toContain("Resend rejected the send (503)");
    expect(line).not.toMatch(/not found/i);
  });

  it("does not replay a failure older than Resend's 24-hour idempotency window, and reports it once", async () => {
    const fetchMock = mockFetch(unavailable());
    const harness = buildHarness();

    await harness.placeOrder();
    const stored = harness.table.rows.values().next().value!;
    stored.created_at = new Date(Date.now() - 25 * HOUR_MS);

    await retryFailedNotifications(harness.container);
    await retryFailedNotifications(harness.container);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      linesContaining(harness.logger.warn, "[email:retry-exhausted]"),
    ).toEqual([
      `[email:retry-exhausted] reason=window_expired notification=${stored.id}`,
    ]);
    expect(harness.onlyRow().provider_data?.replay_content).toBeNull();
  });

  it("reports a failed row with no stored email as exhausted, once, instead of sending an empty template", async () => {
    const fetchMock = mockFetch();
    const harness = buildHarness();

    harness.table.rows.set("noti_legacy", {
      id: "noti_legacy",
      to: "jamie@example.com",
      from: null,
      channel: "email",
      template: null,
      data: null,
      provider_data: null,
      trigger_type: "order.placed",
      resource_id: "order_01",
      resource_type: "order",
      receiver_id: null,
      original_notification_id: null,
      idempotency_key: "order-confirmation:order_01",
      external_id: null,
      status: "failure",
      provider_id: "resend",
      created_at: new Date(Date.now() - HOUR_MS),
    });

    await retryFailedNotifications(harness.container);
    await retryFailedNotifications(harness.container);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      linesContaining(harness.logger.warn, "[email:retry-exhausted]"),
    ).toEqual([
      "[email:retry-exhausted] reason=no_stored_content notification=noti_legacy",
    ]);
  });

  it("clears the stored copy of an email stuck pending past the retry window, and reports it once", async () => {
    const fetchMock = mockFetch();
    const harness = buildHarness();

    harness.table.rows.set("noti_stuck", {
      id: "noti_stuck",
      to: "jamie@example.com",
      from: null,
      channel: "email",
      template: null,
      data: null,
      provider_data: {
        replay_content: { subject: "s", html: "h", text: "t" },
      },
      trigger_type: "order.placed",
      resource_id: "order_01",
      resource_type: "order",
      receiver_id: null,
      original_notification_id: null,
      idempotency_key: "order-confirmation:order_01",
      external_id: null,
      status: "pending",
      provider_id: "resend",
      created_at: new Date(Date.now() - 25 * HOUR_MS),
    });

    await retryFailedNotifications(harness.container);
    await retryFailedNotifications(harness.container);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.onlyRow().provider_data?.replay_content).toBeNull();
    expect(
      linesContaining(harness.logger.warn, "[email:retry-exhausted]"),
    ).toEqual([
      "[email:retry-exhausted] reason=stuck_pending notification=noti_stuck",
    ]);
  });

  it("stops replaying an email Resend refused outright", async () => {
    const fetchMock = mockFetch(
      unavailable(),
      new Response('{"name":"validation_error"}', { status: 422 }),
    );
    const harness = buildHarness();

    await harness.placeOrder();
    const row = harness.onlyRow();

    await retryFailedNotifications(harness.container);
    await retryFailedNotifications(harness.container);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      linesContaining(harness.logger.warn, "[email:retry-exhausted]"),
    ).toEqual([
      `[email:retry-exhausted] reason=rejected status=422 notification=${row.id}`,
    ]);
    expect(harness.onlyRow()).toMatchObject({ status: "failure" });
    expect(harness.onlyRow().provider_data?.replay_content).toBeNull();
  });

  it("never replays an email that was sent first time, and drops its stored copy", async () => {
    const fetchMock = mockFetch(jsonResponse({ id: "re_1" }));
    const harness = buildHarness();

    await harness.placeOrder();
    expect(harness.onlyRow()).toMatchObject({ status: "success" });
    expect(harness.onlyRow().provider_data?.replay_content).toMatchObject({
      subject: expect.any(String),
    });

    await retryFailedNotifications(harness.container);
    await retryFailedNotifications(harness.container);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.onlyRow()).toMatchObject({
      status: "success",
      external_id: "re_1",
    });
    expect(harness.onlyRow().provider_data?.replay_content).toBeNull();
    expect(linesContaining(harness.logger.info, "[email:retry")).toEqual([]);
    expect(linesContaining(harness.logger.warn, "[email:retry")).toEqual([]);
  });
});
