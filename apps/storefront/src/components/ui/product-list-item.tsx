type ProductListItemProps = {
  title: string;
};

export function ProductListItem({ title }: ProductListItemProps) {
  return (
    <li className="rounded-md border border-border bg-surface p-3">{title}</li>
  );
}
