import type { CheckoutErrors, CountryOption } from "@/lib/checkout";

import { Select, TextInput } from "../ui";

export type AddressFormValues = {
  addressName: string;
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

export type AddressFormFieldsProps = {
  values: AddressFormValues;
  errors: CheckoutErrors;
  onChange: (patch: Partial<AddressFormValues>) => void;
  countryOptions: readonly CountryOption[];
};

export function AddressFormFields({
  values,
  errors,
  onChange,
  countryOptions,
}: AddressFormFieldsProps) {
  return (
    <div className="space-y-4">
      <TextInput
        label="Address name"
        description="e.g. Home, Studio"
        value={values.addressName}
        onChange={(value) => onChange({ addressName: value })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="First name"
          isRequired
          value={values.firstName}
          onChange={(value) => onChange({ firstName: value })}
          isInvalid={Boolean(errors.firstName)}
          errorMessage={errors.firstName}
        />
        <TextInput
          label="Last name"
          isRequired
          value={values.lastName}
          onChange={(value) => onChange({ lastName: value })}
          isInvalid={Boolean(errors.lastName)}
          errorMessage={errors.lastName}
        />
      </div>

      <TextInput
        label="Phone"
        type="tel"
        value={values.phone}
        onChange={(value) => onChange({ phone: value })}
      />

      <TextInput
        label="Street address"
        isRequired
        value={values.address1}
        onChange={(value) => onChange({ address1: value })}
        isInvalid={Boolean(errors.address1)}
        errorMessage={errors.address1}
      />

      <TextInput
        label="Apt, suite, etc. (optional)"
        value={values.address2}
        onChange={(value) => onChange({ address2: value })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="City"
          isRequired
          value={values.city}
          onChange={(value) => onChange({ city: value })}
          isInvalid={Boolean(errors.city)}
          errorMessage={errors.city}
        />
        <TextInput
          label="State"
          isRequired
          value={values.state}
          onChange={(value) => onChange({ state: value })}
          isInvalid={Boolean(errors.state)}
          errorMessage={errors.state}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="ZIP code"
          isRequired
          value={values.postalCode}
          onChange={(value) => onChange({ postalCode: value })}
          isInvalid={Boolean(errors.postalCode)}
          errorMessage={errors.postalCode}
        />
        <Select
          label="Country"
          isRequired
          options={countryOptions}
          selectedKey={values.countryCode}
          onSelectionChange={(key) => onChange({ countryCode: String(key) })}
          isInvalid={Boolean(errors.countryCode)}
          errorMessage={errors.countryCode}
        />
      </div>
    </div>
  );
}
