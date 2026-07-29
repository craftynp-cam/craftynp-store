import {
  SITE_CONTENT_FIELDS,
  SITE_CONTENT_KEYS,
  resolveSiteContent,
  siteContentKeySchema,
  siteContentUpdateSchema,
  validateSiteContentValue,
} from "./site-content.js";

describe("resolveSiteContent", () => {
  it("fills registry defaults when no entries are stored", () => {
    const result = resolveSiteContent([]);
    expect(result.banner_enabled).toBe(false);
    expect(result.banner_text).toBe("");
  });

  it("coerces a boolean field from its stored text value", () => {
    const result = resolveSiteContent([
      { key: "banner_enabled", value: "true" },
    ]);
    expect(result.banner_enabled).toBe(true);
  });

  it("passes text fields through unchanged", () => {
    const result = resolveSiteContent([
      { key: "banner_text", value: "Now Selling: GLITTER!" },
    ]);
    expect(result.banner_text).toBe("Now Selling: GLITTER!");
  });

  it("ignores stored entries for unknown keys", () => {
    const result = resolveSiteContent([
      { key: "not_a_real_field", value: "whatever" },
    ]);
    expect(Object.keys(result)).toEqual(
      SITE_CONTENT_FIELDS.map((field) => field.key),
    );
  });
});

describe("validateSiteContentValue", () => {
  it.each(["true", "false"])(
    "accepts %s for a boolean field",
    (value) => {
      const result = validateSiteContentValue("banner_enabled", value);
      expect(result.success).toBe(true);
    },
  );

  it("rejects a non-boolean value for a boolean field", () => {
    const result = validateSiteContentValue("banner_enabled", "yes");
    expect(result.success).toBe(false);
  });

  it("trims a text field's value", () => {
    const result = validateSiteContentValue("banner_text", "  hello  ");
    expect(result).toEqual({ success: true, value: "hello" });
  });

  it("rejects text longer than the field's maxLength", () => {
    const result = validateSiteContentValue("banner_text", "a".repeat(201));
    expect(result.success).toBe(false);
  });

  it("accepts text at exactly maxLength", () => {
    const result = validateSiteContentValue("banner_text", "a".repeat(200));
    expect(result.success).toBe(true);
  });
});

describe("siteContentKeySchema", () => {
  it("accepts every registered key", () => {
    for (const key of SITE_CONTENT_KEYS) {
      expect(siteContentKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it("rejects an unregistered key", () => {
    expect(siteContentKeySchema.safeParse("not_a_real_field").success).toBe(
      false,
    );
  });
});

describe("siteContentUpdateSchema", () => {
  it("accepts a well-formed update", () => {
    const result = siteContentUpdateSchema.safeParse({
      entries: [{ key: "banner_enabled", value: "true" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty entries array", () => {
    const result = siteContentUpdateSchema.safeParse({ entries: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an entry with an unknown key", () => {
    const result = siteContentUpdateSchema.safeParse({
      entries: [{ key: "not_a_real_field", value: "x" }],
    });
    expect(result.success).toBe(false);
  });
});
