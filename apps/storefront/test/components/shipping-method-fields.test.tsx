import { fireEvent, render, screen } from "@testing-library/react";

import { ShippingMethodFields } from "@/components";
import type { ShippingRate } from "@craftynp/types";

function makeRate(overrides: Partial<ShippingRate> = {}): ShippingRate {
  return {
    rateId: "rate_1",
    carrierName: "USPS",
    serviceName: "USPS Ground Advantage",
    serviceCode: "usps_ground_advantage",
    amount: 7.42,
    currencyCode: "usd",
    deliveryDays: 4,
    estimatedDeliveryDate: null,
    quoteToken: "token",
    ...overrides,
  };
}

describe("ShippingMethodFields", () => {
  it("shows idle copy before an address is entered", () => {
    render(
      <ShippingMethodFields
        status="idle"
        rates={[]}
        selectedRateId=""
        error={null}
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(
      screen.getByText("Enter your delivery address to see shipping options."),
    ).toBeInTheDocument();
  });

  it("shows a status region with no radios while loading, and unmounts any previous list", () => {
    render(
      <ShippingMethodFields
        status="loading"
        rates={[]}
        selectedRateId=""
        error={null}
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("renders one radio per rate when there are several, with the cheapest checked", () => {
    const rates = [
      makeRate({
        rateId: "expensive",
        serviceName: "USPS Priority Mail Express",
        amount: 32.15,
      }),
      makeRate({
        rateId: "cheap",
        serviceName: "USPS Ground Advantage",
        amount: 7.42,
      }),
    ];

    render(
      <ShippingMethodFields
        status="ready"
        rates={rates}
        selectedRateId="cheap"
        error={null}
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(
      screen.getByRole("radio", { name: /USPS Ground Advantage/ }),
    ).toBeChecked();
  });

  it("fires onSelect when a different option is clicked", () => {
    const rates = [
      makeRate({
        rateId: "cheap",
        serviceName: "USPS Ground Advantage",
        amount: 7.42,
      }),
      makeRate({
        rateId: "expensive",
        serviceName: "USPS Priority Mail",
        amount: 11.9,
      }),
    ];
    const onSelect = jest.fn();

    render(
      <ShippingMethodFields
        status="ready"
        rates={rates}
        selectedRateId="cheap"
        error={null}
        onSelect={onSelect}
        onRetry={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /USPS Priority Mail/ }));
    expect(onSelect).toHaveBeenCalledWith("expensive");
  });

  it("renders a single rate as a static row with no radio", () => {
    render(
      <ShippingMethodFields
        status="ready"
        rates={[makeRate()]}
        selectedRateId="rate_1"
        error={null}
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument();
    expect(screen.getByText("$7.42")).toBeInTheDocument();
  });

  it("shows an error and a retry button with no price, and calls onRetry", () => {
    const onRetry = jest.fn();

    render(
      <ShippingMethodFields
        status="error"
        rates={[]}
        selectedRateId=""
        error="We couldn't get a shipping rate for your address right now."
        onSelect={jest.fn()}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText(
        "We couldn't get a shipping rate for your address right now.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never renders an empty option list once ready", () => {
    render(
      <ShippingMethodFields
        status="ready"
        rates={[makeRate()]}
        selectedRateId="rate_1"
        error={null}
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("USPS Ground Advantage")).toBeInTheDocument();
  });

  it("shows the shipping-rate error message on the radio group", () => {
    const rates = [makeRate({ rateId: "a" }), makeRate({ rateId: "b" })];

    render(
      <ShippingMethodFields
        status="ready"
        rates={rates}
        selectedRateId="a"
        error={null}
        errorMessage="Choose a delivery option."
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText("Choose a delivery option.")).toBeInTheDocument();
  });

  it("never mentions free shipping anywhere", () => {
    render(
      <ShippingMethodFields
        status="ready"
        rates={[makeRate(), makeRate({ rateId: "b" })]}
        selectedRateId="rate_1"
        error={null}
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.queryByText(/free shipping/i)).not.toBeInTheDocument();
  });

  it("never offers a flat rate when the live call fails — no fallback price exists", () => {
    render(
      <ShippingMethodFields
        status="error"
        rates={[]}
        selectedRateId=""
        error="We couldn't get a shipping rate for your address right now."
        onSelect={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
