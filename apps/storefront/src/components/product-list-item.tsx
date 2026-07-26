type ProductListItemProps = {
  title: string;
};

export function ProductListItem({ title }: ProductListItemProps) {
  return <li className="rounded border p-3">{title}</li>;
}
