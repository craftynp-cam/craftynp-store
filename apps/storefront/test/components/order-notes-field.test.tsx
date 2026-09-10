import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  ORDER_NOTES_MAX_LENGTH,
  resolveProductCustomization,
} from "@craftynp/types";

import { OrderNotesField } from "@/components";
import {
  EMPTY_CUSTOMIZATION_DRAFT,
  orderNotesError,
} from "@/lib/product-customization";

const REQUIRED = resolveProductCustomization({
  customizable: "true",
  customization_notes: "required",
});

// The counter, the blur timing and the near-limit warning are the shared
// useCountedField and are covered on CustomTextField; what is asserted here is
// what notes do differently — their own limit, their own message.
function Harness() {
  const [value, setValue] = useState("");

  return (
    <OrderNotesField
      mode="required"
      value={value}
      onChange={setValue}
      maxLength={ORDER_NOTES_MAX_LENGTH}
      errorMessage={orderNotesError(REQUIRED, {
        ...EMPTY_CUSTOMIZATION_DRAFT,
        orderNotes: value,
      })}
    />
  );
}

describe("OrderNotesField", () => {
  it("keeps notes past the limit instead of refusing the keystrokes", () => {
    render(<Harness />);

    const notes = "a".repeat(ORDER_NOTES_MAX_LENGTH + 2);
    fireEvent.change(screen.getByLabelText(/order notes/i), {
      target: { value: notes },
    });

    expect(screen.getByLabelText(/order notes/i)).toHaveValue(notes);
    expect(screen.getByText(/2 characters over/i)).toBeInTheDocument();
  });

  it("names an empty required field in its own words once left", () => {
    render(<Harness />);

    const notes = screen.getByLabelText(/order notes/i);
    act(() => notes.focus());
    act(() => notes.blur());

    expect(
      screen.getByText(/tell us what you'd like us to know/i),
    ).toBeInTheDocument();
  });
});
