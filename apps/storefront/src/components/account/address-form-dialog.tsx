"use client";

import { useState } from "react";

import {
  validateAddressFields,
  type CheckoutErrors,
  type CountryOption,
} from "@/lib/checkout";
import type { SavedAddress } from "@/lib/saved-address";

import { Button, Dialog } from "../ui";
import {
  AddressFormFields,
  type AddressFormValues,
} from "./address-form-fields";

const EMPTY_VALUES: AddressFormValues = {
  addressName: "",
  firstName: "",
  lastName: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "us",
};

function valuesFromAddress(address: SavedAddress): AddressFormValues {
  return {
    addressName: address.addressName,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
  };
}

export type AddressFormDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  address: SavedAddress | null;
  countryOptions: readonly CountryOption[];
  onSaved: () => void;
};

export function AddressFormDialog({
  isOpen,
  onOpenChange,
  address,
  countryOptions,
  onSaved,
}: AddressFormDialogProps) {
  const [values, setValues] = useState<AddressFormValues>(
    address ? valuesFromAddress(address) : EMPTY_VALUES,
  );
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function handleSave() {
    const nextErrors = validateAddressFields(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSaveError(false);

    try {
      const response = address
        ? await fetch(`/account/addresses/${address.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          })
        : await fetch("/checkout/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          });

      if (!response.ok) {
        setSaveError(true);
        setSaving(false);
        return;
      }

      setSaving(false);
      onSaved();
      onOpenChange(false);
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={address ? "Edit address" : "Add address"}
    >
      <div className="space-y-4">
        <AddressFormFields
          values={values}
          errors={errors}
          onChange={(patch) => setValues({ ...values, ...patch })}
          countryOptions={countryOptions}
        />
        {saveError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            We couldn&apos;t save this address. Please try again.
          </p>
        ) : null}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onPress={handleSave}
            isLoading={isSaving}
            loadingLabel="Saving"
          >
            Save address
          </Button>
          <Button variant="ghost" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
