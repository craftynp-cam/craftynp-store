import { keyExtension } from "./promote-artwork.js";

describe("keyExtension", () => {
  it("carries the staging key's extension onto the promoted key", () => {
    expect(keyExtension("staging/01JX.png")).toBe("png");
  });

  it("falls back rather than producing a key ending in a bare dot", () => {
    expect(keyExtension("staging/01JX")).toBe("bin");
  });
});
