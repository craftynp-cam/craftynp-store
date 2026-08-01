import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

jest.mock("../../../../modules/shipstation/webhook", () => ({
  ...jest.requireActual("../../../../modules/shipstation/webhook"),
  verifyShipStationWebhook: jest.fn(async () => undefined),
}));

jest.mock("../../../../workflows/apply-tracking-event", () => ({
  __esModule: true,
  default: jest.fn(() => ({ run: jest.fn(async () => ({ result: {} })) })),
}));

import { POST } from "./route";
import { verifyShipStationWebhook } from "../../../../modules/shipstation/webhook";
import applyTrackingEventWorkflow from "../../../../workflows/apply-tracking-event";

const TRACKING_NUMBER = "9400111899223197428490";

const BODY = {
  resource_type: "API_TRACK",
  data: {
    tracking_number: TRACKING_NUMBER,
    status_code: "DE",
    status_description: "Delivered",
    carrier_status_description: "Delivered, front porch",
    events: [{ occurred_at: "2026-07-30T18:04:00Z" }],
  },
};

type ServiceOverrides = {
  claimed?: boolean;
  context?: unknown;
  shipmentContextThrows?: boolean;
};

function buildHarness(overrides: ServiceOverrides = {}, body: unknown = BODY) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  const service = {
    recordWebhookEvent: jest.fn(async () => overrides.claimed ?? true),
    releaseWebhookEvent: jest.fn(async () => undefined),
    shipmentContext: jest.fn(async () => {
      if (overrides.shipmentContextThrows) throw new Error("database down");
      return overrides.context === undefined
        ? {
            shipment: { id: "ship_1", fulfillment_id: "ful_1", voided_at: null },
            orderId: "order_1",
            status: "shipped",
          }
        : overrides.context;
    }),
  };

  const req = {
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
    headers: {},
    scope: {
      resolve: (key: string) => (key === "orderStatus" ? service : logger),
    },
  } as unknown as MedusaRequest;

  return {
    req,
    res: { json, status } as unknown as MedusaResponse,
    json,
    status,
    logger,
    service,
  };
}

function runWorkflowMock() {
  return (applyTrackingEventWorkflow as unknown as jest.Mock).mock.results[0]
    ?.value.run as jest.Mock | undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  (verifyShipStationWebhook as jest.Mock).mockResolvedValue(undefined);
});

describe("POST /hooks/shipstation/track", () => {
  it("applies a delivery event for a known shipment", async () => {
    const harness = buildHarness();

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(200);
    expect(applyTrackingEventWorkflow).toHaveBeenCalled();
    expect(runWorkflowMock()).toHaveBeenCalledWith({
      input: expect.objectContaining({
        orderId: "order_1",
        shipmentId: "ship_1",
        statusCode: "DE",
        currentStatus: "shipped",
      }),
    });
  });

  it("rejects a request whose signature does not verify", async () => {
    (verifyShipStationWebhook as jest.Mock).mockRejectedValue(
      Object.assign(new Error("bad"), { reason: "bad_signature" }),
    );
    const harness = buildHarness();

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(401);
    expect(harness.service.recordWebhookEvent).not.toHaveBeenCalled();
    expect(applyTrackingEventWorkflow).not.toHaveBeenCalled();
  });

  it("does nothing the second time the same event is delivered", async () => {
    const harness = buildHarness({ claimed: false });

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(200);
    expect(harness.service.shipmentContext).not.toHaveBeenCalled();
    expect(applyTrackingEventWorkflow).not.toHaveBeenCalled();
  });

  it("discards an event for a tracking number it has never seen", async () => {
    const harness = buildHarness({ context: null });

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(200);
    expect(applyTrackingEventWorkflow).not.toHaveBeenCalled();
    expect(harness.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("unknown_shipment"),
    );
  });

  it("discards an event for a label that has been voided", async () => {
    const harness = buildHarness({
      context: {
        shipment: {
          id: "ship_1",
          fulfillment_id: "ful_1",
          voided_at: new Date(),
        },
        orderId: "order_1",
        status: "packing",
      },
    });

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(200);
    expect(applyTrackingEventWorkflow).not.toHaveBeenCalled();
    expect(harness.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("voided_label"),
    );
  });

  it("discards an event for an order that has been cancelled", async () => {
    const harness = buildHarness({
      context: {
        shipment: { id: "ship_1", fulfillment_id: "ful_1", voided_at: null },
        orderId: "order_1",
        status: "cancelled",
      },
    });

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(200);
    expect(applyTrackingEventWorkflow).not.toHaveBeenCalled();
    expect(harness.logger.info).toHaveBeenCalledWith(
      expect.stringContaining("order_cancelled"),
    );
  });

  it("discards a payload it cannot read without claiming an event", async () => {
    const harness = buildHarness({}, { resource_type: "API_TRACK" });

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(200);
    expect(harness.service.recordWebhookEvent).not.toHaveBeenCalled();
  });

  it("releases its claim so a retry can reprocess after a failure", async () => {
    const harness = buildHarness({ shipmentContextThrows: true });

    await POST(harness.req, harness.res);

    expect(harness.status).toHaveBeenCalledWith(500);
    expect(harness.service.releaseWebhookEvent).toHaveBeenCalled();
  });
});
