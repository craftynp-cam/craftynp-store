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

type AddressBlockValues = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

type AddressBlockErrors = Partial<Record<keyof AddressBlockValues, string>>;

type AddressBlockProps = AddressBlockValues & {
  idPrefix: string;
  labelPrefix: string;
  autoCompleteScope: "shipping" | "billing";
  errors: AddressBlockErrors;
  onChange: (patch: Partial<AddressBlockValues>) => void;
  countryOptions: readonly CountryOption[];
};

function AddressBlock({
  idPrefix,
  labelPrefix,
  autoCompleteScope,
  address1,
  address2,
  city,
  state,
  postalCode,
  countryCode,
  errors,
  onChange,
  countryOptions,
}: AddressBlockProps) {
  return (
    <>
      <TextInput
        label={`${labelPrefix}Street address`}
        name={`${idPrefix}address-line1`}
        autoComplete={`${autoCompleteScope} address-line1`}
        isRequired
        value={address1}
        onChange={(value) => onChange({ address1: value })}
        isInvalid={Boolean(errors.address1)}
        errorMessage={errors.address1}
      />

      <TextInput
        label={`${labelPrefix}Apt, suite, etc. (optional)`}
        name={`${idPrefix}address-line2`}
        autoComplete={`${autoCompleteScope} address-line2`}
        value={address2}
        onChange={(value) => onChange({ address2: value })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label={`${labelPrefix}City`}
          name={`${idPrefix}address-level2`}
          autoComplete={`${autoCompleteScope} address-level2`}
          isRequired
          value={city}
          onChange={(value) => onChange({ city: value })}
          isInvalid={Boolean(errors.city)}
          errorMessage={errors.city}
        />
        <TextInput
          label={`${labelPrefix}State`}
          name={`${idPrefix}address-level1`}
          autoComplete={`${autoCompleteScope} address-level1`}
          isRequired
          value={state}
          onChange={(value) => onChange({ state: value })}
          isInvalid={Boolean(errors.state)}
          errorMessage={errors.state}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label={`${labelPrefix}ZIP code`}
          name={`${idPrefix}postal-code`}
          type="text"
          inputMode="numeric"
          autoComplete={`${autoCompleteScope} postal-code`}
          isRequired
          value={postalCode}
          onChange={(value) => onChange({ postalCode: value })}
          isInvalid={Boolean(errors.postalCode)}
          errorMessage={errors.postalCode}
        />
        <Select
          label={`${labelPrefix}Country`}
          name={`${idPrefix}country`}
          autoComplete={`${autoCompleteScope} country`}
          isRequired
          options={countryOptions}
          selectedKey={countryCode}
          onSelectionChange={(key) => onChange({ countryCode: String(key) })}
          isInvalid={Boolean(errors.countryCode)}
          errorMessage={errors.countryCode}
        />
      </div>
    </>
  );
}

export function AddressFields({
  values,
  errors,
  onChange,
  countryOptions,
}: AddressFieldsProps) {
  return (
    <>
      <AddressBlock
        idPrefix=""
        labelPrefix=""
        autoCompleteScope="shipping"
        address1={values.address1}
        address2={values.address2}
        city={values.city}
        state={values.state}
        postalCode={values.postalCode}
        countryCode={values.countryCode}
        errors={{
          address1: errors.address1,
          city: errors.city,
          state: errors.state,
          postalCode: errors.postalCode,
          countryCode: errors.countryCode,
        }}
        onChange={onChange}
        countryOptions={countryOptions}
      />

      <Checkbox
        isSelected={values.billingSameAsDelivery}
        onChange={(isSelected) =>
          onChange({ billingSameAsDelivery: isSelected })
        }
      >
        Billing address is the same as delivery
      </Checkbox>

      {!values.billingSameAsDelivery ? (
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="font-display text-lg text-foreground">
            Billing address
          </h3>
          <AddressBlock
            idPrefix="billing-"
            labelPrefix="Billing "
            autoCompleteScope="billing"
            address1={values.billingAddress1}
            address2={values.billingAddress2}
            city={values.billingCity}
            state={values.billingState}
            postalCode={values.billingPostalCode}
            countryCode={values.billingCountryCode}
            errors={{
              address1: errors.billingAddress1,
              city: errors.billingCity,
              state: errors.billingState,
              postalCode: errors.billingPostalCode,
              countryCode: errors.billingCountryCode,
            }}
            onChange={(patch) =>
              onChange({
                ...(patch.address1 !== undefined && {
                  billingAddress1: patch.address1,
                }),
                ...(patch.address2 !== undefined && {
                  billingAddress2: patch.address2,
                }),
                ...(patch.city !== undefined && { billingCity: patch.city }),
                ...(patch.state !== undefined && {
                  billingState: patch.state,
                }),
                ...(patch.postalCode !== undefined && {
                  billingPostalCode: patch.postalCode,
                }),
                ...(patch.countryCode !== undefined && {
                  billingCountryCode: patch.countryCode,
                }),
              })
            }
            countryOptions={countryOptions}
          />
        </div>
      ) : null}
    </>
  );
}
