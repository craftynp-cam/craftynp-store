import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  CUSTOM_TEXT_FALLBACK_MAX_LENGTH,
  resolveProductCustomization,
} from "@craftynp/types";

import { CustomTextField } from "@/components";
import {
  EMPTY_CUSTOMIZATION_DRAFT,
  customTextError,
} from "@/lib/product-customization";

const REQUIRED = resolveProductCustomization({
  customizable: "true",
  customization_text: "required",
});

const AT_LIMIT = "a".repeat(CUSTOM_TEXT_FALLBACK_MAX_LENGTH);

// The field is controlled by ProductPurchase, and its length error is derived
// there, so the harness closes that loop rather than freezing a value.
function Harness({ mode = "required" }: { mode?: "optional" | "required" }) {
  const [value, setValue] = useState("");

  return (
    <CustomTextField
      mode={mode}
      value={value}
      onChange={setValue}
      maxLength={REQUIRED.text.maxLength}
      errorMessage={customTextError(REQUIRED, {
        ...EMPTY_CUSTOMIZATION_DRAFT,
        customText: value,
      })}
    />
  );
}

function type(text: string) {
  fireEvent.change(screen.getByLabelText(/custom text/i), {
    target: { value: text },
  });
}

function leaveTheField() {
  const input = screen.getByLabelText(/custom text/i);
  act(() => input.focus());
  act(() => input.blur());
}

describe("CustomTextField", () => {
  it("echoes back the text that will be made, trimmed as the cart will carry it", () => {
    render(<Harness />);
    type("  For Grandma  ");

    expect(
      screen.getByRole("group", { name: /what we.ll make/i }),
    ).toHaveTextContent("For Grandma");
  });

  it("shows nothing to check before there is text to check", () => {
    render(<Harness />);

    expect(
      screen.queryByRole("group", { name: /what we.ll make/i }),
    ).toBeNull();
  });

  it("keeps text past the limit instead of refusing the keystrokes", () => {
    render(<Harness />);
    type(`${AT_LIMIT}abc`);

    expect(screen.getByLabelText(/custom text/i)).toHaveValue(`${AT_LIMIT}abc`);
    expect(screen.getByText(/3 characters over/i)).toBeInTheDocument();
  });

  it("stays quiet at exactly the limit", () => {
    render(<Harness />);
    type(AT_LIMIT);

    expect(screen.queryByText(/characters over/i)).toBeNull();
  });

  it("names an empty required field once the shopper leaves it", () => {
    render(<Harness />);

    expect(screen.queryByText(/enter the text you'd like/i)).toBeNull();

    leaveTheField();

    expect(
      screen.getByText(/enter the text you'd like on this piece/i),
    ).toBeInTheDocument();
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

  it("does not demand text the product only offers", () => {
    render(<Harness mode="optional" />);
    leaveTheField();

    expect(screen.queryByText(/enter the text you'd like/i)).toBeNull();
  });
});
