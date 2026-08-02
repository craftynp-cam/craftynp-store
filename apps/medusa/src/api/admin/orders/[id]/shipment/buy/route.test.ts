import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { BuyLabelRequest } from "@craftynp/types";

import { OrderStatusTransitionError } from "../../../../../../modules/order-status/lib";
import { ShipStationLabelError } from "../../../../../../modules/shipstation/lib";
import buyShippingLabelWorkflow from "../../../../../../workflows/buy-shipping-label";
import { POST } from "./route";

jest.mock("../../../../../../workflows/buy-shipping-label", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../../../../../../lib/order-status-detail", () => ({
  loadOrderStatusDetail: jest.fn(async () => ({
    orderId: "order_1",
    status: "shipped",
    allowedTransitions: [],
    tracking: {
      trackingNumber: "9400100000000000000000",
      trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=94001",
      carrierCode: "usps",
      carrierName: "usps",
      status: "accepted",
      statusDescription: null,
      shippedAt: "2026-08-01T12:00:00.000Z",
      deliveredAt: null,
    },
    label: null,
    history: [],
  })),
}));

const workflowFactory = buyShippingLabelWorkflow as unknown as jest.Mock;
let run: jest.Mock;

const body: BuyLabelRequest = {
  rateId: "se-rate-1",
  carrierId: "se-123",
  serviceCode: "usps_ground_advantage",
  parcel: { weight: 640, length: 30, width: 20, height: 12 },
};

function makeRequest() {
  const logger = { warn: jest.fn(), error: jest.fn() };

  const req = {
    params: { id: "order_1" },
    validatedBody: body,
    auth_context: { actor_id: "user_1" },
    scope: { resolve: () => logger },
  } as unknown as AuthenticatedMedusaRequest<BuyLabelRequest>;

  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res = { json, status } as unknown as MedusaResponse;

  return { req, res, json, status, logger };
}

describe("POST /admin/orders/:id/shipment/buy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    run = jest.fn(async () => ({ result: {} }));
    workflowFactory.mockReturnValue({ run });
  });

  it("returns the fresh tracking so the shipped state needs no webhook round-trip", async () => {
    const { req, res, json } = makeRequest();
    run.mockResolvedValueOnce({
      result: { trackingNumber: "9400100000000000000000", labelStored: true },
    });

    await POST(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        orderStatus: expect.objectContaining({
          status: "shipped",
          tracking: expect.objectContaining({
            trackingNumber: "9400100000000000000000",
          }),
        }),
      }),
    );
  });

  it("maps a refused order state to 409, because the operator can act on it", async () => {
    const { req, res, status, json } = makeRequest();
    run.mockRejectedValueOnce(
      new OrderStatusTransitionError(
        "invalid_transition",
        "This order already has a label.",
      ),
    );

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "invalid_transition",
        message: expect.stringContaining("already has a label"),
      }),
    );
  });

  it("maps a ShipStation failure to 502 and keeps the carrier's own words", async () => {
    const { req, res, status, json } = makeRequest();
    run.mockRejectedValueOnce(
      new ShipStationLabelError(
        "insufficient_funds",
        "ShipStation responded 400",
        "Not enough funds",
      ),
    );

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "insufficient_funds",
        carrierMessage: "Not enough funds",
        message: expect.stringContaining("Add funds in ShipStation"),
      }),
    );
  });

  it("does not blame ShipStation for a failure of our own", async () => {
    const { req, res, status, json } = makeRequest();
    run.mockRejectedValueOnce(new Error("tracking_number already exists"));

    await POST(req, res);

    expect(status).toHaveBeenCalledWith(500);

    const body = json.mock.calls[0]?.[0] as { message: string; reason: string };
    expect(body.reason).toBe("internal_error");
    expect(body.message).not.toContain("ShipStation");
    expect(body.message).toContain("tracking_number already exists");
  });
});
