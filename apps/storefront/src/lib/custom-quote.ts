import type { CustomQuoteField, CustomQuoteRequest } from "@craftynp/types";

export type CustomQuoteValues = Record<CustomQuoteField, string>;

export const EMPTY_CUSTOM_QUOTE: CustomQuoteValues = {
  name: "",
  phone: "",
  email: "",
  neededBy: "",
  product: "",
  description: "",
};

export const CUSTOM_QUOTE_FIELD_ORDER: readonly CustomQuoteField[] = [
  "name",
  "phone",
  "email",
  "neededBy",
  "product",
  "description",
];

export type CustomQuoteFailure = "rate_limited" | "unavailable";

export type CustomQuoteResult =
  { ok: true } | { ok: false; reason: CustomQuoteFailure };

export async function submitCustomQuote(
  request: CustomQuoteRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<CustomQuoteResult> {
  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  if (!backendUrl || !publishableKey) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await fetchImpl(
      `${backendUrl.replace(/\/+$/, "")}/store/custom-quotes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify(request),
      },
    );
    if (response.ok) return { ok: true };
    return {
      ok: false,
      reason: response.status === 429 ? "rate_limited" : "unavailable",
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
