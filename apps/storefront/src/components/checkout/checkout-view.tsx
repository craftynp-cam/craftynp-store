"use client";

import { flushSync } from "react-dom";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  draftFromSavedAddress,
  NEW_ADDRESS_ID,
  type SavedAddress,
} from "@/lib/saved-address";
import type { AuthedCustomer } from "@/lib/auth";
import {
  type CheckoutDraft,
  type CheckoutErrors,
  type CountryOption,
  EMPTY_CHECKOUT_DRAFT,
  prefillCheckoutDraft,
  validateCheckoutDraft,
} from "@/lib/checkout";
import {
  patchCheckoutDraft,
  readCheckoutDraft,
  readServerCheckoutDraft,
  subscribeToCheckoutDraft,
} from "@/lib/checkout-draft";
import { openCartDrawer } from "@/lib/cart-drawer";
import { checkoutHref } from "@/lib/routes";

import { Breadcrumbs } from "../nav";
import { Button, Checkbox } from "../ui";
import { AddressFields } from "./address-fields";
import { CheckoutSection } from "./checkout-section";
import { CheckoutSummary } from "./checkout-summary";
import { ContactFields } from "./contact-fields";
import { SavedAddressPicker } from "./saved-address-picker";

export type CheckoutViewProps = {
  customer: AuthedCustomer | null;
  savedAddresses: readonly SavedAddress[];
  countryOptions: readonly CountryOption[];
};

type SubmitStatus = "idle" | "submitted";

function summaryMessage(errors: CheckoutErrors): string | null {
  const count = Object.keys(errors).length;
  if (count === 0) return null;
  return count === 1 ? "Check 1 field below." : `Check ${count} fields below.`;
}

export function CheckoutView({
  customer,
  savedAddresses,
  countryOptions,
}: CheckoutViewProps) {
  const draft = useSyncExternalStore(
    subscribeToCheckoutDraft,
    readCheckoutDraft,
    readServerCheckoutDraft,
  );
  const values = prefillCheckoutDraft(draft, customer);
  const isSignedIn = customer != null;

  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isSignedIn || draft.savedAddressId !== "") return;
    const defaultAddress = savedAddresses[0];
    if (!defaultAddress) return;

    patchCheckoutDraft({
      savedAddressId: defaultAddress.id,
      ...draftFromSavedAddress(defaultAddress),
    });
  }, [isSignedIn, savedAddresses, draft.savedAddressId]);

  function handleChange(patch: Partial<CheckoutDraft>) {
    patchCheckoutDraft(patch);

    if (patch.billingSameAsDelivery === true) {
      setErrors((current) => {
        const {
          billingAddress1: _billingAddress1,
          billingCity: _billingCity,
          billingState: _billingState,
          billingPostalCode: _billingPostalCode,
          billingCountryCode: _billingCountryCode,
          ...rest
        } = current;
        return rest;
      });
    }
  }

  async function saveAddressIfRequested(current: CheckoutDraft) {
    if (!isSignedIn || !current.saveAddress) return;

    try {
      const response = await fetch("/checkout/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: current.firstName,
          lastName: current.lastName,
          address1: current.address1,
          address2: current.address2,
          city: current.city,
          state: current.state,
          postalCode: current.postalCode,
          countryCode: current.countryCode,
          phone: current.phone,
        }),
      });

      if (!response.ok) {
        setSaveNotice(
          "We couldn't save this address to your account, but your details are kept on this device.",
        );
      }
    } catch {
      setSaveNotice(
        "We couldn't save this address to your account, but your details are kept on this device.",
      );
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateCheckoutDraft(values);

    flushSync(() => {
      setErrors(nextErrors);
    });

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]',
      );
      firstInvalid?.focus();
      return;
    }

    void saveAddressIfRequested(values);
    setStatus("submitted");
  }

  return (
    <>
      <Breadcrumbs labels={{ "/checkout": "Checkout" }} />
      <h1 className="mt-2 font-display text-4xl text-foreground sm:text-5xl">
        Checkout
      </h1>

      <div className="mt-8 lg:flex lg:items-start lg:gap-10">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="min-w-0 flex-1 space-y-6"
        >
          <CheckoutSection step={1} title="Contact">
            <ContactFields
              values={values}
              errors={errors}
              onChange={handleChange}
              isSignedIn={isSignedIn}
              returnTo={checkoutHref()}
            />
          </CheckoutSection>

          <CheckoutSection step={2} title="Delivery address">
            {isSignedIn ? (
              <SavedAddressPicker
                addresses={savedAddresses}
                selectedId={values.savedAddressId}
                onSelect={(id) => {
                  const selected = savedAddresses.find(
                    (address) => address.id === id,
                  );
                  if (selected) {
                    patchCheckoutDraft({
                      savedAddressId: id,
                      ...draftFromSavedAddress(selected),
                    });
                  } else {
                    patchCheckoutDraft({
                      savedAddressId: NEW_ADDRESS_ID,
                      address1: EMPTY_CHECKOUT_DRAFT.address1,
                      address2: EMPTY_CHECKOUT_DRAFT.address2,
                      city: EMPTY_CHECKOUT_DRAFT.city,
                      state: EMPTY_CHECKOUT_DRAFT.state,
                      postalCode: EMPTY_CHECKOUT_DRAFT.postalCode,
                      countryCode: EMPTY_CHECKOUT_DRAFT.countryCode,
                    });
                  }
                }}
              />
            ) : null}

            <AddressFields
              values={values}
              errors={errors}
              onChange={handleChange}
              countryOptions={countryOptions}
            />

            {isSignedIn ? (
              <Checkbox
                isSelected={values.saveAddress}
                onChange={(isSelected) =>
                  handleChange({ saveAddress: isSelected })
                }
              >
                Save this address to my account
              </Checkbox>
            ) : null}

            {saveNotice ? (
              <p className="text-sm text-foreground-muted">{saveNotice}</p>
            ) : null}
          </CheckoutSection>

          <div
            aria-live="polite"
            aria-atomic="true"
            className="text-sm text-danger-foreground"
          >
            {summaryMessage(errors)}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full rounded-full"
            aria-describedby="checkout-payment-note"
          >
            {status === "submitted" ? "Details saved" : "Continue"}
          </Button>

          <p
            id="checkout-payment-note"
            className="text-sm text-foreground-muted"
          >
            {status === "submitted"
              ? "Your details are saved on this device. Payment isn't available yet — checkout completes in an upcoming release."
              : "Payment isn't available yet — your details are saved on this device and checkout completes in an upcoming release."}
          </p>
        </form>

        <CheckoutSummary onEditCart={openCartDrawer} />
      </div>
    </>
  );
}
