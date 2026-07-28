export function categoryHref(categoryHandle: string): string {
  return `/${categoryHandle}`;
}

export function productHref(
  categoryHandle: string,
  productHandle: string,
): string {
  return `/${categoryHandle}/${productHandle}`;
}
