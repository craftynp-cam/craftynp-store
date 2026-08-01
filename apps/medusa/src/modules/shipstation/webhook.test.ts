import { generateKeyPairSync, sign } from "node:crypto";

import {
  __resetForTests,
  isTimestampFresh,
  signedPayload,
  verifyShipStationWebhook,
} from "./webhook";

const JWKS_URL = "https://api.shipstation.example/jwks";
const RAW_BODY = '{"resource_type":"API_TRACK","data":{"status_code":"IT"}}';
const NOW = Date.parse("2026-07-31T12:00:00Z");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

function jwks(kid: string, key = publicKey) {
  return { keys: [{ ...key.export({ format: "jwk" }), kid }] };
}

function jwksResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function signWith(timestamp: string, body = RAW_BODY, key = privateKey) {
  return sign(
    "RSA-SHA256",
    Buffer.from(signedPayload(timestamp, body)),
    key,
  ).toString("base64");
}

function headers(timestamp: string, signature: string, keyId = "key-1") {
  return { keyId, signature, timestamp };
}

function verify(
  overrides: Partial<Parameters<typeof verifyShipStationWebhook>[0]> = {},
) {
  const timestamp = String(Math.floor(NOW / 1000));

  return verifyShipStationWebhook({
    headers: headers(timestamp, signWith(timestamp)),
    rawBody: RAW_BODY,
    jwksUrl: JWKS_URL,
    maxAgeSeconds: 300,
    now: NOW,
    ...overrides,
  });
}

beforeEach(() => {
  __resetForTests();
  jest.restoreAllMocks();
});

describe("verifyShipStationWebhook", () => {
  it("accepts a request signed by the advertised key", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jwksResponse(jwks("key-1")));

    await expect(verify()).resolves.toBeUndefined();
  });

  it("rejects a body that was altered after signing", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jwksResponse(jwks("key-1")));

    await expect(
      verify({ rawBody: '{"resource_type":"API_TRACK","data":{}}' }),
    ).rejects.toMatchObject({ reason: "bad_signature" });
  });

  it("rejects a signature made with a different key", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jwksResponse(jwks("key-1")));

    const timestamp = String(Math.floor(NOW / 1000));

    await expect(
      verify({
        headers: headers(
          timestamp,
          signWith(timestamp, RAW_BODY, other.privateKey),
        ),
      }),
    ).rejects.toMatchObject({ reason: "bad_signature" });
  });

  it("rejects a replayed request whose timestamp has gone stale", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jwksResponse(jwks("key-1")));

    const stale = String(Math.floor(NOW / 1000) - 3600);

    await expect(
      verify({ headers: headers(stale, signWith(stale)) }),
    ).rejects.toMatchObject({ reason: "stale_timestamp" });
  });

  it.each([
    ["key id", { keyId: undefined }],
    ["signature", { signature: undefined }],
    ["timestamp", { timestamp: undefined }],
  ])("rejects a request with no %s header", async (_label, missing) => {
    const timestamp = String(Math.floor(NOW / 1000));

    await expect(
      verify({
        headers: { ...headers(timestamp, signWith(timestamp)), ...missing },
      }),
    ).rejects.toMatchObject({ reason: "missing_headers" });
  });

  it("refetches the key set when an unseen key id arrives", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(jwksResponse(jwks("old-key")))
      .mockResolvedValueOnce(jwksResponse(jwks("key-1")));

    await expect(verify()).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up when the refetched key set still lacks the key id", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jwksResponse(jwks("some-other-key")));

    await expect(verify()).rejects.toMatchObject({ reason: "unknown_key" });
  });

  it("caches the key set across requests", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(jwksResponse(jwks("key-1")));

    await verify();
    await verify();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the JWKS endpoint is unreachable", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    await expect(verify()).rejects.toMatchObject({
      reason: "jwks_unavailable",
    });
  });

  it("fails closed when no JWKS url is configured", async () => {
    await expect(verify({ jwksUrl: undefined })).rejects.toMatchObject({
      reason: "not_configured",
    });
  });
});

describe("isTimestampFresh", () => {
  it("accepts unix seconds and ISO timestamps alike", () => {
    expect(isTimestampFresh(String(Math.floor(NOW / 1000)), 300, NOW)).toBe(
      true,
    );
    expect(isTimestampFresh("2026-07-31T12:00:00Z", 300, NOW)).toBe(true);
  });

  it("rejects a timestamp from the future beyond the window", () => {
    expect(
      isTimestampFresh(String(Math.floor(NOW / 1000) + 3600), 300, NOW),
    ).toBe(false);
  });

  it("rejects an unparseable timestamp", () => {
    expect(isTimestampFresh("not a timestamp", 300, NOW)).toBe(false);
  });
});
