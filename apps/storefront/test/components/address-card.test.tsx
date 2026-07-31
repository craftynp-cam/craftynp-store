import { fireEvent, render, screen } from "@testing-library/react";

import { AddressCard } from "@/components";
import type { SavedAddress } from "@/lib/saved-address";

function makeAddress(overrides: Partial<SavedAddress> = {}): SavedAddress {
  return {
    id: "caddr_1",
    label: "Home — 123 Maple Street, Springfield, IL 62704",
    addressName: "Home",
    firstName: "Jamie",
    lastName: "Rivera",
    address1: "123 Maple Street",
    address2: "",
    city: "Springfield",
    state: "IL",
    postalCode: "62704",
    countryCode: "us",
    phone: "5551234567",
    isDefaultShipping: false,
    ...overrides,
  };
}

describe("AddressCard", () => {
  it("offers Set as default on a non-default address", () => {
    render(
      <AddressCard
        address={makeAddress({ isDefaultShipping: false })}
        onEdit={jest.fn()}
        onSetDefault={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Set as default" }),
    ).toBeInTheDocument();
  });

  it("omits Set as default on the default address", () => {
    render(
      <AddressCard
        address={makeAddress({ isDefaultShipping: true })}
        onEdit={jest.fn()}
        onSetDefault={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Set as default" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("asks the caller to confirm removal rather than deleting directly", () => {
    const onRemove = jest.fn();
    render(
      <AddressCard
        address={makeAddress()}
        onEdit={jest.fn()}
        onSetDefault={jest.fn()}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
