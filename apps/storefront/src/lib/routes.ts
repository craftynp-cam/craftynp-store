export function categoryHref(categoryHandle: string): string {
  return `/${categoryHandle}`;
}

export function productHref(
  categoryHandle: string,
  productHandle: string,
): string {
  return `/${categoryHandle}/${productHandle}`;
}

export function accountHref(): string {
  return "/account";
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

/**
 * Only ever redirect within this site. `return_to` round-trips through a
 * query param and a cookie — both attacker-writable — so an unchecked value
 * would let a crafted `/auth/login?return_to=` link send a signed-in
 * customer to an external page.
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return accountHref();
}
