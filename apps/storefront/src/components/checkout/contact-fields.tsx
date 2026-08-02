import type { CheckoutDraft, CheckoutErrors } from "@/lib/checkout";
import { signInHref } from "@/lib/routes";

import { TextInput } from "../ui";

export type ContactFieldsProps = {
  values: CheckoutDraft;
  errors: CheckoutErrors;
  onChange: (patch: Partial<CheckoutDraft>) => void;
  isSignedIn: boolean;
  returnTo: string;
};

export function ContactFields({
  values,
  errors,
  onChange,
  isSignedIn,
  returnTo,
}: ContactFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="First name"
          name="given-name"
          autoComplete="given-name"
          isRequired
          value={values.firstName}
          onChange={(value) => onChange({ firstName: value })}
          isInvalid={Boolean(errors.firstName)}
          errorMessage={errors.firstName}
        />
        <TextInput
          label="Last name"
          name="family-name"
          autoComplete="family-name"
          isRequired
          value={values.lastName}
          onChange={(value) => onChange({ lastName: value })}
          isInvalid={Boolean(errors.lastName)}
          errorMessage={errors.lastName}
        />
      </div>

      <TextInput
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        isRequired
        value={values.email}
        onChange={(value) => onChange({ email: value })}
        isInvalid={Boolean(errors.email)}
        errorMessage={errors.email}
      />

      <TextInput
        label="Phone"
        description="For delivery updates."
        name="tel"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        isRequired
        value={values.phone}
        onChange={(value) => onChange({ phone: value })}
        isInvalid={Boolean(errors.phone)}
        errorMessage={errors.phone}
      />

      {!isSignedIn ? (
        <p className="text-sm text-foreground-muted">
          Already have an account?{" "}
          <a
            href={signInHref({ returnTo })}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </a>
        </p>
      ) : null}
    </>
  );
}
