type ProductListItemProps = {
  title: string;
};

/** A single product in the storefront's product list. */
export function ProductListItem({ title }: ProductListItemProps) {
  return <li className="rounded border p-3">{title}</li>;
}
