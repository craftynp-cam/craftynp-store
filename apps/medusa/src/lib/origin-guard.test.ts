import {
  guardMode,
  headerMatches,
  ORIGIN_BLOCKED_LOG_TAG,
  ORIGIN_SECRET_HEADER,
  originGuard,
} from "./origin-guard";

describe("guardMode", () => {
  it("is off without a secret, whatever the mode says", () => {
    expect(guardMode(undefined, "enforce")).toBe("off");
    expect(guardMode("", "enforce")).toBe("off");
  });

  it.each(["log", "enforce"] as const)("honours %s", (mode) => {
    expect(guardMode("s3cret", mode)).toBe(mode);
  });

  it.each([undefined, "", "ENFORCE", "enforc", "true", "on"])(
    "is off for %p, so a typo cannot refuse every request",
    (mode) => {
      expect(guardMode("s3cret", mode)).toBe("off");
    },
  );
});

describe("headerMatches", () => {
  it("accepts the exact value", () => {
    expect(headerMatches("s3cret", "s3cret")).toBe(true);
  });

  it("takes the first entry when the header is repeated", () => {
    expect(headerMatches(["s3cret", "other"], "s3cret")).toBe(true);
  });

  it.each([
    ["a different value of the same length", "s3creT"],
    ["a shorter value", "s3cre"],
    ["a longer value", "s3cretx"],
    ["an empty value", ""],
  ])("rejects %s", (_label, value) => {
    expect(headerMatches(value, "s3cret")).toBe(false);
  });

  it.each([
    ["missing", undefined],
    ["not a string", 42],
    ["an empty array", []],
  ])("rejects a header that is %s", (_label, value) => {
    expect(headerMatches(value, "s3cret")).toBe(false);
  });
});

describe("originGuard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function call(
    headers: Record<string, unknown>,
    originalUrl = "/store/tax-quote",
  ) {
    const warn = jest.fn();
    const next = jest.fn();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = {
      headers,
      method: "POST",
      // Always "/" in practice: req.path is relative to the mount point.
      path: "/",
      originalUrl,
      scope: { resolve: () => ({ warn }) },
    };

    originGuard()(req as never, { status } as never, next as never);

    return { warn, next, status, json };
  }

  it("passes everything through when no secret is set", () => {
    delete process.env.ORIGIN_SHARED_SECRET;
    process.env.ORIGIN_GUARD_MODE = "enforce";

    const { next, status } = call({});

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("warns but still serves a missing header in log mode", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "log";

    const { warn, next, status } = call({});

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(ORIGIN_BLOCKED_LOG_TAG),
    );
  });

  it("refuses a missing header in enforce mode", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "enforce";

    const { warn, next, status, json } = call({});

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "forbidden" }),
    );
    expect(warn).toHaveBeenCalled();
  });

  it("refuses a forged header in enforce mode", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "enforce";

    const { next, status } = call({ [ORIGIN_SECRET_HEADER]: "guessed" });

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("serves /health with no header, so the platform healthcheck survives enforce", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "enforce";

    const { warn, next, status } = call({}, "/health");

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("still refuses a path that merely starts with /health", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "enforce";

    const { next, status } = call({}, "/healthz");

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("logs the real path rather than the mount-relative one", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "log";

    const { warn } = call({}, "/store/shipping-rates?foo=1");

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("/store/shipping-rates"),
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("?foo=1"));
  });

  it("serves the request when the header matches", () => {
    process.env.ORIGIN_SHARED_SECRET = "s3cret";
    process.env.ORIGIN_GUARD_MODE = "enforce";

    const { warn, next, status } = call({ [ORIGIN_SECRET_HEADER]: "s3cret" });

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
