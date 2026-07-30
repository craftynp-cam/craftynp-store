import { cache } from "react";

import type { CheckoutDraft } from "./checkout";
import { sdk } from "./medusa";

export type CustomerAddressSource = {
  id: string;
  address_name: string | null;
  is_default_shipping: boolean;
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
  created_at?: string;
};

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

export function toSavedAddress(source: CustomerAddressSource): SavedAddress {
  return {
    id: source.id,
    label: savedAddressLabel(source),
    firstName: source.first_name ?? "",
    lastName: source.last_name ?? "",
    address1: source.address_1 ?? "",
    address2: source.address_2 ?? "",
    city: source.city ?? "",
    state: source.province ?? "",
    postalCode: source.postal_code ?? "",
    countryCode: source.country_code ?? "",
    phone: source.phone ?? "",
    isDefaultShipping: source.is_default_shipping,
  };
}

export function savedAddressLabel(source: CustomerAddressSource): string {
  const cityStateZip = [
    source.city,
    [source.province, source.postal_code].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const parts = [source.address_1, cityStateZip].filter(Boolean);
  const address = parts.join(", ");

  return source.address_name ? `${source.address_name} — ${address}` : address;
}

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

export const fetchCustomerAddresses = cache(
  async (token: string | undefined): Promise<readonly SavedAddress[]> => {
    if (!token) return [];

    try {
      const { addresses } = await sdk.store.customer.listAddress(
        { limit: 20 },
        { Authorization: `Bearer ${token}` },
      );

      return [...addresses]
        .sort((a, b) => {
          if (a.is_default_shipping !== b.is_default_shipping) {
            return a.is_default_shipping ? -1 : 1;
          }
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        })
        .map(toSavedAddress);
    } catch (error) {
      console.error("Could not load the customer's saved addresses", error);
      return [];
    }
  },
);
