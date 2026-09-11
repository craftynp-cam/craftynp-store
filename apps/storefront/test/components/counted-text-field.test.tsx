import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  CUSTOM_TEXT_FALLBACK_MAX_LENGTH,
  resolveProductCustomization,
} from "@craftynp/types";

import { CountedTextField } from "@/components";
import {
  EMPTY_CUSTOMIZATION_DRAFT,
  customTextError,
} from "@/lib/product-customization";

const REQUIRED = resolveProductCustomization({
  customizable: "true",
  customization_text: "required",
});

const AT_LIMIT = "a".repeat(CUSTOM_TEXT_FALLBACK_MAX_LENGTH);
const REQUIRED_MESSAGE = "Enter the text you'd like on this piece.";

// The field is controlled by ProductPurchase, and its length error is derived
// there, so the harness closes that loop rather than freezing a value.
function Harness({ mode = "required" }: { mode?: "optional" | "required" }) {
  const [value, setValue] = useState("");

  return (
    <CountedTextField
      label="Custom text"
      mode={mode}
      value={value}
      onChange={setValue}
      maxLength={REQUIRED.text.maxLength}
      requiredMessage={REQUIRED_MESSAGE}
      errorMessage={customTextError(REQUIRED, {
        ...EMPTY_CUSTOMIZATION_DRAFT,
        customText: value,
      })}
    />
  );
}

function field() {
  return screen.getByLabelText(/custom text/i);
}

function type(text: string) {
  fireEvent.change(field(), { target: { value: text } });
}

function leaveTheField() {
  act(() => field().focus());
  act(() => field().blur());
}

describe("CountedTextField", () => {
  // A single-line input clips a long value out of sight at its right-hand
  // edge, which is what AC 1 rules out. Whether it grows is CSS and invisible
  // to jsdom; that it is a textarea at all is not.
  it("is a textarea, so a long value wraps instead of scrolling away", () => {
    render(<Harness />);
    type(AT_LIMIT);

    expect(field().tagName).toBe("TEXTAREA");
    expect(field()).toHaveValue(AT_LIMIT);
  });

  it("keeps text past the limit instead of refusing the keystrokes", () => {
    render(<Harness />);
    type(`${AT_LIMIT}abc`);

    expect(field()).toHaveValue(`${AT_LIMIT}abc`);
    expect(screen.getByText(/3 characters over/i)).toBeInTheDocument();
  });

  it("stays quiet at exactly the limit", () => {
    render(<Harness />);
    type(AT_LIMIT);

    expect(screen.queryByText(/characters over/i)).toBeNull();
  });

  it("names an empty required field once the shopper leaves it", () => {
    render(<Harness />);

    expect(screen.queryByText(REQUIRED_MESSAGE)).toBeNull();

    leaveTheField();

    expect(screen.getByText(REQUIRED_MESSAGE)).toBeInTheDocument();
  });

  it("does not demand text the product only offers", () => {
    render(<Harness mode="optional" />);
    leaveTheField();

    expect(screen.queryByText(REQUIRED_MESSAGE)).toBeNull();
  });

  it("warns a screen reader before the limit, not only after it", () => {
    render(<Harness />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    type("a".repeat(CUSTOM_TEXT_FALLBACK_MAX_LENGTH - 5));

    expect(status).toHaveTextContent(
      `You are close to the ${CUSTOM_TEXT_FALLBACK_MAX_LENGTH}-character limit.`,
    );
  });
});
