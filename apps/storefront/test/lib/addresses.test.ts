import {
  draftFromSavedAddress,
  fetchCustomerAddresses,
  savedAddressLabel,
  type CustomerAddressSource,
} from "@/lib/addresses";

jest.mock("../../src/lib/medusa", () => ({
  sdk: { store: { customer: { listAddress: jest.fn() } } },
}));

function makeAddress(
  overrides: Partial<CustomerAddressSource> = {},
): CustomerAddressSource {
  return {
    id: "caddr_1",
    address_name: null,
    is_default_shipping: false,
    first_name: "Jamie",
    last_name: "Rivera",
    address_1: "123 Maple Street",
    address_2: null,
    city: "Springfield",
    province: "IL",
    postal_code: "62704",
    country_code: "us",
    phone: "5551234567",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("fetchCustomerAddresses", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns an empty list without calling the SDK when there is no token", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");

    expect(await fetchCustomerAddresses(undefined)).toEqual([]);
    expect(sdk.store.customer.listAddress).not.toHaveBeenCalled();
  });

  it("passes the bearer token as the request header", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.listAddress.mockResolvedValue({ addresses: [] });

    await fetchCustomerAddresses("token_abc");

    expect(sdk.store.customer.listAddress).toHaveBeenCalledWith(
      { limit: 20 },
      { Authorization: "Bearer token_abc" },
    );
  });

  it("maps province to state and postal_code/country_code through", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.listAddress.mockResolvedValue({
      addresses: [makeAddress()],
    });

    const [address] = await fetchCustomerAddresses("token_abc");

    expect(address).toMatchObject({
      state: "IL",
      postalCode: "62704",
      countryCode: "us",
    });
  });

  it("maps null fields to empty strings", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.listAddress.mockResolvedValue({
      addresses: [makeAddress({ address_2: null, phone: null })],
    });

    const [address] = await fetchCustomerAddresses("token_abc");

    expect(address?.address2).toBe("");
    expect(address?.phone).toBe("");
  });

  it("sorts the default shipping address first", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.listAddress.mockResolvedValue({
      addresses: [
        makeAddress({ id: "caddr_1", is_default_shipping: false }),
        makeAddress({ id: "caddr_2", is_default_shipping: true }),
      ],
    });

    const addresses = await fetchCustomerAddresses("token_abc");

    expect(addresses[0]?.id).toBe("caddr_2");
  });

  it("returns an empty list and logs when the SDK call rejects", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.listAddress.mockRejectedValue(new Error("down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(fetchCustomerAddresses("token_abc")).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});

describe("savedAddressLabel", () => {
  it("composes street, city, state and zip", () => {
    expect(savedAddressLabel(makeAddress())).toBe(
      "123 Maple Street, Springfield, IL 62704",
    );
  });

  it("prefixes the address name when present", () => {
    expect(
      savedAddressLabel(makeAddress({ address_name: "Home" })),
    ).toBe("Home — 123 Maple Street, Springfield, IL 62704");
  });

  it("omits missing parts without leaving stray commas", () => {
    expect(
      savedAddressLabel(
        makeAddress({ city: null, province: null, postal_code: null }),
      ),
    ).toBe("123 Maple Street");
  });
});

describe("draftFromSavedAddress", () => {
  it("returns exactly the address's draft fields", async () => {
    const { sdk } = jest.requireMock<{
      sdk: { store: { customer: { listAddress: jest.Mock } } };
    }>("../../src/lib/medusa");
    sdk.store.customer.listAddress.mockResolvedValue({
      addresses: [makeAddress()],
    });

    const [address] = await fetchCustomerAddresses("token_abc");
    const patch = draftFromSavedAddress(address!);

    expect(patch).toEqual({
      firstName: "Jamie",
      lastName: "Rivera",
      phone: "5551234567",
      address1: "123 Maple Street",
      address2: "",
      city: "Springfield",
      state: "IL",
      postalCode: "62704",
      countryCode: "us",
    });
  });
});
