import { Plus } from "../icons";

export type AddAddressCardProps = {
  onAdd: () => void;
};

export function AddAddressCard({ onAdd }: AddAddressCardProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-foreground-muted transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Plus aria-hidden="true" size={20} />
      <span className="text-sm font-medium">Add a new address</span>
    </button>
  );
}
