import { fireEvent, render, screen } from "@testing-library/react";

import { ContactFields } from "@/components";
import { EMPTY_CHECKOUT_DRAFT } from "@/lib/checkout";

function renderFields(
  overrides: Partial<Parameters<typeof ContactFields>[0]> = {},
) {
  const onChange = jest.fn();
  render(
    <ContactFields
      values={EMPTY_CHECKOUT_DRAFT}
      errors={{}}
      onChange={onChange}
      isSignedIn={false}
      returnTo="/checkout"
      {...overrides}
    />,
  );
  return { onChange };
}

describe("ContactFields", () => {
  it("renders labels for first name, last name, email, and phone", () => {
    renderFields();

    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
  });

  it("sets autocomplete, type, and inputMode on each field", () => {
    renderFields();

    expect(screen.getByLabelText("First name")).toHaveAttribute(
      "autocomplete",
      "given-name",
    );
    expect(screen.getByLabelText("Last name")).toHaveAttribute(
      "autocomplete",
      "family-name",
    );

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("inputmode", "email");

    const phone = screen.getByLabelText("Phone");
    expect(phone).toHaveAttribute("autocomplete", "tel");
    expect(phone).toHaveAttribute("type", "tel");
    expect(phone).toHaveAttribute("inputmode", "tel");
  });

  it("describes the phone field with the delivery-updates hint", () => {
    renderFields();

    const phone = screen.getByLabelText("Phone");
    const describedBy = phone.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "For delivery updates.",
    );
  });

  it("calls onChange with the typed patch", () => {
    const { onChange } = renderFields();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jamie@example.com" },
    });

    expect(onChange).toHaveBeenCalledWith({ email: "jamie@example.com" });
  });

  it("marks a field invalid and shows its error message", () => {
    renderFields({ errors: { firstName: "Enter your first name." } });

    const firstName = screen.getByLabelText("First name");
    expect(firstName).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter your first name.")).toBeInTheDocument();
  });

  it("shows a sign-in link for a guest", () => {
    renderFields({ isSignedIn: false });
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("hides the sign-in link for a signed-in customer", () => {
    renderFields({ isSignedIn: true });
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("never renders a password field", () => {
    renderFields();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});
