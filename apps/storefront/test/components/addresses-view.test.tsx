import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AddressesView } from "@/components";
import type { SavedAddress } from "@/lib/saved-address";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

const COUNTRY_OPTIONS = [{ id: "us", label: "United States" }];

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
    isDefaultShipping: true,
    ...overrides,
  };
}

describe("AddressesView", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows the empty state when there are no saved addresses", () => {
    render(<AddressesView addresses={[]} countryOptions={COUNTRY_OPTIONS} />);

    expect(
      screen.getByText("You haven't saved any addresses yet."),
    ).toBeInTheDocument();
  });

  it("surfaces an inline error when removing an address fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false } as Response) as unknown as typeof fetch;
    render(
      <AddressesView
        addresses={[makeAddress()]}
        countryOptions={COUNTRY_OPTIONS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    const removeButtons = await screen.findAllByRole("button", {
      name: "Remove",
    });
    fireEvent.click(removeButtons[removeButtons.length - 1]!);

    await waitFor(() =>
      expect(
        screen.getByText("Something went wrong. Please try again."),
      ).toBeInTheDocument(),
    );
  });
});
