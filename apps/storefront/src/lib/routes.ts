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

export function checkoutHref(): string {
  return "/checkout";
}

export function checkoutConfirmationHref(
  orderId: string,
  displayId: number,
): string {
  const params = new URLSearchParams({
    order: orderId,
    number: String(displayId),
  });
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

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !/^\/[/\\]/.test(value)) {
    return value;
  }
  return accountHref();
}
