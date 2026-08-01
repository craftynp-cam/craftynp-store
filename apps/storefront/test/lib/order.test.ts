import { fetchOrderConfirmation } from "@/lib/order";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { client: { fetch: jest.fn() } },
}));

function mockSdk() {
  return jest.requireMock<{ sdk: { client: { fetch: jest.Mock } } }>(
    "../../src/lib/medusa",
  ).sdk;
}

describe("fetchOrderConfirmation", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("degrades to null instead of throwing when the backend is unreachable", async () => {
    mockSdk().client.fetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      fetchOrderConfirmation("order_1", "tok", undefined),
    ).resolves.toBeNull();
  });

  it("sends the guest token as a query param rather than an auth header", async () => {
    const sdk = mockSdk();
    sdk.client.fetch.mockResolvedValue({ order: { orderId: "order_2" } });

    await fetchOrderConfirmation("order_2", "tok en/+", "session-token");

    const [path, options] = sdk.client.fetch.mock.calls[0]!;
    expect(path).toBe("/store/order-confirmation/order_2?token=tok%20en%2F%2B");
    expect(options.headers).toBeUndefined();
  });

  it("falls back to the customer session when there is no token", async () => {
    const sdk = mockSdk();
    sdk.client.fetch.mockResolvedValue({ order: { orderId: "order_3" } });

    await fetchOrderConfirmation("order_3", null, "session-token");

    const [path, options] = sdk.client.fetch.mock.calls[0]!;
    expect(path).toBe("/store/order-confirmation/order_3");
    expect(options.headers).toEqual({ Authorization: "Bearer session-token" });
  });
});
