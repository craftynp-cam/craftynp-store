import { FetchError } from "@medusajs/js-sdk";

import { isBackendFailure } from "@/lib/medusa-error";

const fetchError = (status?: number) =>
  new FetchError("upstream said no", "Whatever", status);

describe("isBackendFailure", () => {
  it("treats a rejection that is not a FetchError as a backend failure", () => {
    expect(isBackendFailure(new TypeError("fetch failed"))).toBe(true);
  });

  it("treats a FetchError carrying no status as a backend failure", () => {
    expect(isBackendFailure(fetchError(undefined))).toBe(true);
  });

  it.each([401, 403, 404, 500, 502, 503])(
    "treats %i as a backend failure",
    (status) => {
      expect(isBackendFailure(fetchError(status))).toBe(true);
    },
  );

  it.each([400, 409, 422, 429])(
    "treats %i as a problem with the request, not the backend",
    (status) => {
      expect(isBackendFailure(fetchError(status))).toBe(false);
    },
  );
});
