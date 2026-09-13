export function categoryHref(categoryHandle: string): string {
  return `/${categoryHandle}`;
}

export function productHref(
  categoryHandle: string,
  productHandle: string,
): string {
  return `/${categoryHandle}/${productHandle}`;
}

export const EDIT_LINE_PARAM = "edit";

export function productEditHref(productHref: string, lineId: string): string {
  const params = new URLSearchParams({ [EDIT_LINE_PARAM]: lineId });
  return `${productHref}?${params.toString()}`;
}

export function accountHref(): string {
  return "/account";
}

export function accountAddressesHref(): string {
  return "/account/addresses";
}

export function checkoutHref(): string {
  return "/checkout";
}

export function checkoutConfirmationHref(
  orderId: string,
  displayId: number,
  token?: string,
): string {
  const params = new URLSearchParams({
    order: orderId,
    number: String(displayId),
  });
  if (token) params.set("token", token);
  return `/checkout/confirmation?${params.toString()}`;
}

export function signInHref(options?: {
  returnTo?: string;
  error?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return_to", options.returnTo);
  if (options?.error) params.set("error", options.error);
  const query = params.toString();
  return query ? `/sign-in?${query}` : "/sign-in";
}

export function authLoginHref(options?: {
  returnTo?: string;
  connection?: string;
  screenHint?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return_to", options.returnTo);
  if (options?.connection) params.set("connection", options.connection);
  if (options?.screenHint) params.set("screen_hint", options.screenHint);
  const query = params.toString();
  return query ? `/auth/login?${query}` : "/auth/login";
}

export function authLogoutHref(): string {
  return "/auth/logout";
}

const LOCAL_SITE_ORIGIN = "http://localhost:8000";

function configuredSiteOrigin(): string | null {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function siteOrigin(): string {
  return configuredSiteOrigin() ?? LOCAL_SITE_ORIGIN;
}

export function absoluteUrl(
  path: string,
  origin: string = siteOrigin(),
): string {
  return new URL(path, origin).toString();
}

export function siteUrl(requestUrl: string): string {
  return configuredSiteOrigin() ?? new URL(requestUrl).origin;
}

export const DISALLOWED_PATHS = [
  "/account",
  "/checkout",
  "/sign-in",
  "/auth",
  "/design",
] as const;

export function disallowRules(): string[] {
  return DISALLOWED_PATHS.flatMap((path) => [
    `${path}$`,
    `${path}/`,
    `${path}?`,
  ]);
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !/^\/[/\\]/.test(value)) {
    return value;
  }
  return accountHref();
}

export function designHref(): string {
  return "/design/tokens";
}

export function designLoginHref(options?: { returnTo?: string }): string {
  const params = new URLSearchParams();
  if (options?.returnTo) params.set("return_to", options.returnTo);
  const query = params.toString();
  return query ? `/auth/design/login?${query}` : "/auth/design/login";
}

export function designLogoutHref(): string {
  return "/auth/design/logout";
}

export function sanitizeDesignReturnTo(
  value: string | null | undefined,
): string {
  if (value && value.startsWith("/design/") && !value.includes("..")) {
    return value;
  }
  return designHref();
}
