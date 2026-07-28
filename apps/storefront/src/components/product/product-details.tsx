type ProductDetailsProps = {
  description: string;
};

export function ProductDetails({ description }: ProductDetailsProps) {
  return (
    <div className="border-t border-border pt-6">
      <h2 className="font-display text-2xl">Details</h2>
      <p className="mt-3 text-foreground-muted">{description}</p>
    </div>
  );
}
