describe("medusa sdk client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws a named error when the backend URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test";

    await expect(import("./medusa")).rejects.toThrow(
      "NEXT_PUBLIC_MEDUSA_BACKEND_URL is not set",
    );
  });

  it("throws a named error when the publishable key is missing", async () => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://localhost:9000";
    delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

    await expect(import("./medusa")).rejects.toThrow(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is not set",
    );
  });

  it("exports a client when both variables are set", async () => {
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://localhost:9000";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test";

    const { sdk } = await import("./medusa");
    expect(sdk.store).toBeDefined();
  });
});
