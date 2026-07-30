import type {
  CheckoutDraft,
  CheckoutErrors,
  CountryOption,
} from "@/lib/checkout";

import { Checkbox, Select, TextInput } from "../ui";

export type AddressFieldsProps = {
  values: CheckoutDraft;
  errors: CheckoutErrors;
  onChange: (patch: Partial<CheckoutDraft>) => void;
  countryOptions: readonly CountryOption[];
};

export function AddressFields({
  values,
  errors,
  onChange,
  countryOptions,
}: AddressFieldsProps) {
  return (
    <>
      <TextInput
        label="Street address"
        name="address-line1"
        autoComplete="address-line1"
        isRequired
        value={values.address1}
        onChange={(value) => onChange({ address1: value })}
        isInvalid={Boolean(errors.address1)}
        errorMessage={errors.address1}
      />

      <TextInput
        label="Apt, suite, etc. (optional)"
        name="address-line2"
        autoComplete="address-line2"
        value={values.address2}
        onChange={(value) => onChange({ address2: value })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="City"
          name="address-level2"
          autoComplete="address-level2"
          isRequired
          value={values.city}
          onChange={(value) => onChange({ city: value })}
          isInvalid={Boolean(errors.city)}
          errorMessage={errors.city}
        />
        <TextInput
          label="State"
          name="address-level1"
          autoComplete="address-level1"
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
          name="postal-code"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          isRequired
          value={values.postalCode}
          onChange={(value) => onChange({ postalCode: value })}
          isInvalid={Boolean(errors.postalCode)}
          errorMessage={errors.postalCode}
        />
        <Select
          label="Country"
          name="country"
          autoComplete="country"
          isRequired
          options={countryOptions}
          selectedKey={values.countryCode}
          onSelectionChange={(key) => onChange({ countryCode: String(key) })}
          isInvalid={Boolean(errors.countryCode)}
          errorMessage={errors.countryCode}
        />
      </div>

      <Checkbox
        isSelected={values.billingSameAsDelivery}
        onChange={(isSelected) =>
          onChange({ billingSameAsDelivery: isSelected })
        }
      >
        Billing address is the same as delivery
      </Checkbox>
    </>
  );
}
