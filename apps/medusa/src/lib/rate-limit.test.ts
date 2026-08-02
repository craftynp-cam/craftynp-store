import {
  clientIp,
  retryAfterSeconds,
  ruleFromEnv,
  windowKey,
} from "./rate-limit";

const RULE = { name: "tax-quote", limit: 30, windowSeconds: 60 };

describe("clientIp", () => {
  it("prefers cf-connecting-ip, the one header a caller cannot forge behind Cloudflare", () => {
    expect(
      clientIp(
        {
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1",
        },
        "127.0.0.1",
      ),
    ).toBe("203.0.113.7");
  });

  it("takes the client entry from a forwarded chain, not the nearest proxy", () => {
    expect(
      clientIp(
        { "x-forwarded-for": "203.0.113.7, 198.51.100.1, 10.0.0.1" },
        "127.0.0.1",
      ),
    ).toBe("203.0.113.7");
  });

  it("reads the first entry when a header arrives repeated as an array", () => {
    expect(
      clientIp(
        { "x-forwarded-for": ["203.0.113.7", "198.51.100.1"] },
        "127.0.0.1",
      ),
    ).toBe("203.0.113.7");
  });

  it("falls back to the socket address when no proxy header is present", () => {
    expect(clientIp({}, "127.0.0.1")).toBe("127.0.0.1");
  });

  it("falls back rather than keying every caller under one blank bucket", () => {
    expect(
      clientIp(
        { "cf-connecting-ip": "   ", "x-forwarded-for": "" },
        "127.0.0.1",
      ),
    ).toBe("127.0.0.1");
  });
});

describe("windowKey", () => {
  it("holds one key for the whole window", () => {
    const start = 1_800_000_000_000;
    expect(windowKey(RULE, "203.0.113.7", start)).toBe(
      windowKey(RULE, "203.0.113.7", start + 59_999),
    );
  });

  it("rolls to a new key at the window boundary", () => {
    const start = 1_800_000_000_000;
    expect(windowKey(RULE, "203.0.113.7", start)).not.toBe(
      windowKey(RULE, "203.0.113.7", start + 60_000),
    );
  });

  it("keeps callers and rules in separate buckets", () => {
    const now = 1_800_000_000_000;
    expect(windowKey(RULE, "203.0.113.7", now)).not.toBe(
      windowKey(RULE, "198.51.100.1", now),
    );
    expect(windowKey(RULE, "203.0.113.7", now)).not.toBe(
      windowKey({ ...RULE, name: "shipping-rates" }, "203.0.113.7", now),
    );
  });
});

describe("retryAfterSeconds", () => {
  it("counts down the remainder of the window", () => {
    expect(retryAfterSeconds(RULE, 1_800_000_000_000 + 15_000)).toBe(45);
  });

  it("stays within the window at either edge", () => {
    expect(retryAfterSeconds(RULE, 1_800_000_000_000 + 59_999)).toBe(1);
    expect(retryAfterSeconds(RULE, 1_800_000_000_000)).toBe(60);
  });
});

describe("ruleFromEnv", () => {
  afterEach(() => {
    delete process.env.TEST_RATE_LIMIT;
  });

  it("reads the configured limit", () => {
    process.env.TEST_RATE_LIMIT = "5";
    expect(ruleFromEnv("tax-quote", "TEST_RATE_LIMIT", 30).limit).toBe(5);
  });

  it("falls back when unset", () => {
    expect(ruleFromEnv("tax-quote", "TEST_RATE_LIMIT", 30).limit).toBe(30);
  });

  it.each(["0", "-1", "abc", "2.5", ""])(
    "ignores %p rather than locking every caller out",
    (value) => {
      process.env.TEST_RATE_LIMIT = value;
      expect(ruleFromEnv("tax-quote", "TEST_RATE_LIMIT", 30).limit).toBe(30);
    },
  );
});
