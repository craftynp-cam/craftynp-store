import {
  LabelStorageNotConfiguredError,
  labelObjectKey,
  readLabelStorageOptions,
} from "./label-storage.js";

const COMPLETE = {
  LABEL_STORAGE_ENDPOINT: "http://localhost:9002",
  LABEL_STORAGE_BUCKET: "craftynp-labels",
  LABEL_STORAGE_ACCESS_KEY_ID: "craftynp",
  LABEL_STORAGE_SECRET_ACCESS_KEY: "secret",
} as NodeJS.ProcessEnv;

describe("readLabelStorageOptions", () => {
  it("defaults the region to auto, which is what R2 expects", () => {
    expect(readLabelStorageOptions(COMPLETE).region).toBe("auto");
  });

  it("keeps path-style addressing on unless it is turned off explicitly", () => {
    expect(readLabelStorageOptions(COMPLETE).forcePathStyle).toBe(true);
    expect(
      readLabelStorageOptions({
        ...COMPLETE,
        LABEL_STORAGE_FORCE_PATH_STYLE: "false",
      }).forcePathStyle,
    ).toBe(false);
  });

  it.each([
    "LABEL_STORAGE_ENDPOINT",
    "LABEL_STORAGE_BUCKET",
    "LABEL_STORAGE_ACCESS_KEY_ID",
    "LABEL_STORAGE_SECRET_ACCESS_KEY",
  ])("refuses to run without %s", (key) => {
    const env = { ...COMPLETE };
    delete env[key];

    expect(() => readLabelStorageOptions(env)).toThrow(
      LabelStorageNotConfiguredError,
    );
  });

  it("names what is missing, so the failure is actionable", () => {
    const env = { ...COMPLETE };
    delete env.LABEL_STORAGE_BUCKET;

    expect(() => readLabelStorageOptions(env)).toThrow(/bucket/);
  });
});

describe("labelObjectKey", () => {
  it("scopes the object to its order and keeps the name unguessable", () => {
    const key = labelObjectKey(
      "order_01",
      "f296f482-c27f-49f0-8f43-ab5349db78",
    );
    expect(key).toBe("labels/order_01/f296f482-c27f-49f0-8f43-ab5349db78.pdf");
  });
});
