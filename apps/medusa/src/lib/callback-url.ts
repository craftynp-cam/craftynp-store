export const CALLBACK_URL_IGNORED_LOG_TAG = "[auth:callback-url-ignored]";

export type CallbackUrlOptions = {
  callbackUrl: string;
  allowedCallbackUrls?: string[];
};

export function parseCallbackUrlList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function allowedCallbackUrl(
  requested: unknown,
  { callbackUrl, allowedCallbackUrls = [] }: CallbackUrlOptions,
): string {
  if (typeof requested !== "string") return callbackUrl;

  return allowedCallbackUrls.includes(requested) ? requested : callbackUrl;
}
