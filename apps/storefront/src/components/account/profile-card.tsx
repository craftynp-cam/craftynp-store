"use client";

import { useState } from "react";

import type { AuthedCustomer } from "@/lib/auth";

import { WarningCircle } from "../icons";
import { Button, Card, TextInput } from "../ui";

export type ProfileCardProps = {
  customer: AuthedCustomer;
};

type ProfileFields = {
  firstName: string;
  lastName: string;
  phone: string;
};

function fieldsFromCustomer(customer: AuthedCustomer): ProfileFields {
  return {
    firstName: customer.first_name ?? "",
    lastName: customer.last_name ?? "",
    phone: customer.phone ?? "",
  };
}

export function ProfileCard({ customer }: ProfileCardProps) {
  const initial = fieldsFromCustomer(customer);
  const [fields, setFields] = useState<ProfileFields>(initial);
  const [errors, setErrors] = useState<Partial<ProfileFields>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle",
  );

  async function handleSave() {
    const nextErrors: Partial<ProfileFields> = {};
    if (fields.firstName.trim().length === 0) {
      nextErrors.firstName = "Enter your first name.";
    }
    if (fields.lastName.trim().length === 0) {
      nextErrors.lastName = "Enter your last name.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("saving");
    try {
      const response = await fetch("/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      setStatus(response.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  function handleCancel() {
    setFields(initial);
    setErrors({});
    setStatus("idle");
  }

  return (
    <Card title="Profile">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="First name"
          value={fields.firstName}
          onChange={(value) => setFields({ ...fields, firstName: value })}
          isInvalid={Boolean(errors.firstName)}
          errorMessage={errors.firstName}
        />
        <TextInput
          label="Last name"
          value={fields.lastName}
          onChange={(value) => setFields({ ...fields, lastName: value })}
          isInvalid={Boolean(errors.lastName)}
          errorMessage={errors.lastName}
        />
      </div>

      <div className="mt-4">
        <span className="text-sm font-medium text-foreground">Email</span>
        <p className="mt-1 text-foreground">{customer.email}</p>
        <p className="mt-1 text-sm text-foreground-muted">
          This is how you sign in. Contact us to change it.
        </p>
      </div>

      <div className="mt-4">
        <TextInput
          label="Phone (for order texts)"
          value={fields.phone}
          onChange={(value) => setFields({ ...fields, phone: value })}
        />
      </div>

      <div aria-live="polite" className="mt-4 flex items-center gap-3">
        <Button
          onPress={handleSave}
          isLoading={status === "saving"}
          loadingLabel="Saving"
        >
          Save changes
        </Button>
        <Button variant="ghost" onPress={handleCancel}>
          Cancel
        </Button>
        {status === "success" ? (
          <p className="text-sm text-foreground-muted">Saved.</p>
        ) : null}
        {status === "error" ? (
          <p className="flex items-center gap-1.5 text-sm text-danger-foreground">
            <WarningCircle aria-hidden="true" size={16} />
            We couldn&apos;t save your changes. Please try again.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
