import type { CheckoutDraft } from "./checkout";

export const NEW_ADDRESS_ID = "new";

export type SavedAddress = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  isDefaultShipping: boolean;
};

export function draftFromSavedAddress(
  address: SavedAddress,
): Partial<CheckoutDraft> {
  return {
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
