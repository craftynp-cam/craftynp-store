"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CountryOption } from "@/lib/checkout";
import type { SavedAddress } from "@/lib/saved-address";

import { Button, ConfirmDialog } from "../ui";
import { AddAddressCard } from "./add-address-card";
import { AddressCard } from "./address-card";
import { AddressFormDialog } from "./address-form-dialog";

export type AddressesViewProps = {
  addresses: readonly SavedAddress[];
  countryOptions: readonly CountryOption[];
};

export function AddressesView({
  addresses,
  countryOptions,
}: AddressesViewProps) {
  const router = useRouter();
  const [formTarget, setFormTarget] = useState<SavedAddress | "new" | null>(
    null,
  );
  const [removeTarget, setRemoveTarget] = useState<SavedAddress | null>(null);
  const [isRemoving, setRemoving] = useState(false);
  const [error, setError] = useState(false);

  function handleSaved() {
    router.refresh();
  }

  async function handleSetDefault(address: SavedAddress) {
    setError(false);
    try {
      const response = await fetch("/account/addresses/default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: address.id }),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleRemoveConfirmed() {
    if (!removeTarget) return;
    setRemoving(true);
    setError(false);
    try {
      const response = await fetch(`/account/addresses/${removeTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(true);
        setRemoving(false);
        return;
      }
      setRemoving(false);
      setRemoveTarget(null);
      router.refresh();
    } catch {
      setError(true);
      setRemoving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-foreground">
            Saved addresses
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Pick a default so checkout fills itself in.
          </p>
        </div>
        <Button onPress={() => setFormTarget("new")}>+ Add address</Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger-foreground">
          Something went wrong. Please try again.
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <p className="mt-6 text-sm text-foreground-muted">
          You haven&apos;t saved any addresses yet.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            onEdit={() => setFormTarget(address)}
            onSetDefault={() => handleSetDefault(address)}
            onRemove={() => setRemoveTarget(address)}
          />
        ))}
        <AddAddressCard onAdd={() => setFormTarget("new")} />
      </div>

      <AddressFormDialog
        key={formTarget === "new" ? "new" : (formTarget?.id ?? "closed")}
        isOpen={formTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setFormTarget(null);
        }}
        address={formTarget === "new" ? null : formTarget}
        countryOptions={countryOptions}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        isOpen={removeTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoveTarget(null);
        }}
        title="Remove this address?"
        description={
          removeTarget
            ? `${removeTarget.addressName || "This address"} will be deleted from your saved addresses. Past orders are unaffected.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={handleRemoveConfirmed}
        isConfirming={isRemoving}
      />
    </div>
  );
}
