// Deliberately duplicates the storefront's src/lib/money.ts. That copy lives in
// a Next-only tree this app cannot import, and both sides must format an order
// the same way or the page and its receipt disagree over the same total.
export function formatMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount);
}
