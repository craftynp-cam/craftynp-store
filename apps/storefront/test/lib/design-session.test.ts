import {
  isAllowedWorkspaceEmail,
  isDesignGateEnabled,
  signDesignSession,
  verifyDesignSession,
} from "@/lib/design-session";

const SECRET = "test-secret-value";
const NOW = 1_700_000_000;

describe("signDesignSession / verifyDesignSession", () => {
  it("round-trips an email that has not expired", () => {
    const token = signDesignSession("cam@example.com", SECRET, NOW + 60);

    expect(verifyDesignSession(token, SECRET, NOW)).toEqual({
      email: "cam@example.com",
      exp: NOW + 60,
    });
  });

  it("rejects a session that has expired", () => {
    const token = signDesignSession("cam@example.com", SECRET, NOW - 1);

    expect(verifyDesignSession(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a session signed with a different secret", () => {
    const token = signDesignSession("cam@example.com", "other", NOW + 60);

    expect(verifyDesignSession(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload carrying the original signature", () => {
    const token = signDesignSession("cam@example.com", SECRET, NOW + 60);
    const signature = token.split(".")[1]!;
    const forged = Buffer.from(
      JSON.stringify({ email: "intruder@evil.com", exp: NOW + 60 }),
      "utf-8",
    ).toString("base64url");

    expect(
      verifyDesignSession(`${forged}.${signature}`, SECRET, NOW),
    ).toBeNull();
  });

  it("rejects a malformed value", () => {
    for (const value of ["", "no-dot", "a.b.c", "...", "!!!.???"]) {
      expect(verifyDesignSession(value, SECRET, NOW)).toBeNull();
    }
  });

  it("rejects every value when no secret is configured", () => {
    const token = signDesignSession("cam@example.com", SECRET, NOW + 60);

    expect(verifyDesignSession(token, undefined, NOW)).toBeNull();
  });
});

describe("isAllowedWorkspaceEmail", () => {
  it("accepts an address in the allowed domain, case-insensitively", () => {
    expect(isAllowedWorkspaceEmail("Cam@Example.com", "example.com")).toBe(
      true,
    );
  });

  it("rejects a lookalike domain rather than matching on a suffix", () => {
    expect(isAllowedWorkspaceEmail("cam@notexample.com", "example.com")).toBe(
      false,
    );
    expect(
      isAllowedWorkspaceEmail("cam@example.com.evil.com", "example.com"),
    ).toBe(false);
  });

  it("rejects when either side is missing or the address has no domain", () => {
    expect(isAllowedWorkspaceEmail(undefined, "example.com")).toBe(false);
    expect(isAllowedWorkspaceEmail("cam@example.com", undefined)).toBe(false);
    expect(isAllowedWorkspaceEmail("cam", "example.com")).toBe(false);
  });
});

describe("isDesignGateEnabled", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env.DESIGN_GATE = original.DESIGN_GATE;
    process.env.NODE_ENV = original.NODE_ENV;
  });

  function setEnv(gate: string | undefined, nodeEnv: string) {
    if (gate === undefined) delete process.env.DESIGN_GATE;
    else process.env.DESIGN_GATE = gate;
    process.env.NODE_ENV = nodeEnv;
  }

  it("lets DESIGN_GATE win outright in either direction", () => {
    setEnv("on", "development");
    expect(isDesignGateEnabled()).toBe(true);

    setEnv("off", "production");
    expect(isDesignGateEnabled()).toBe(false);
  });

  it("defaults to on in production and off elsewhere", () => {
    setEnv(undefined, "production");
    expect(isDesignGateEnabled()).toBe(true);

    setEnv(undefined, "development");
    expect(isDesignGateEnabled()).toBe(false);

    setEnv("", "production");
    expect(isDesignGateEnabled()).toBe(true);
  });
});
