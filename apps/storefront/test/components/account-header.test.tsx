import { render, screen } from "@testing-library/react";

import { AccountHeader } from "@/components";
import type { AuthedCustomer } from "@/lib/auth";

function makeCustomer(overrides: Partial<AuthedCustomer> = {}): AuthedCustomer {
  return {
    id: "cus_123",
    email: "cam@example.com",
    first_name: null,
    last_name: null,
    authProvider: "unknown",
    ...overrides,
  };
}

describe("AccountHeader", () => {
  it("greets the customer by first name and shows their email", () => {
    render(<AccountHeader customer={makeCustomer({ first_name: "Cam" })} />);

    expect(screen.getByText("Hi, Cam")).toBeInTheDocument();
    expect(screen.getByText(/cam@example.com/)).toBeInTheDocument();
  });

  it("adds the member-since year when created_at is known", () => {
    render(
      <AccountHeader
        customer={makeCustomer({ created_at: "2023-05-01T00:00:00Z" })}
      />,
    );

    expect(screen.getByText(/Member since 2023/)).toBeInTheDocument();
  });

  it("posts sign-out to /auth/logout", () => {
    render(<AccountHeader customer={makeCustomer()} />);

    const form = screen
      .getByRole("button", { name: "Sign out" })
      .closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/logout");
  });
});
