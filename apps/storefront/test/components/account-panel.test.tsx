import { render, screen } from "@testing-library/react";

import { AccountPanel } from "@/components";

describe("AccountPanel", () => {
  it("renders the signed-in customer's email", () => {
    render(
      <AccountPanel
        customer={{
          id: "cus_123",
          email: "cam@example.com",
          first_name: null,
          last_name: null,
        }}
      />,
    );

    expect(screen.getByText("cam@example.com")).toBeInTheDocument();
  });

  it("renders the customer's name alongside their email when known", () => {
    render(
      <AccountPanel
        customer={{
          id: "cus_123",
          email: "cam@example.com",
          first_name: "Cam",
          last_name: "Slash",
        }}
      />,
    );

    expect(screen.getByText("Cam Slash · cam@example.com")).toBeInTheDocument();
  });

  it("posts sign-out to /auth/logout", () => {
    render(
      <AccountPanel
        customer={{
          id: "cus_123",
          email: "cam@example.com",
          first_name: null,
          last_name: null,
        }}
      />,
    );

    const form = screen
      .getByRole("button", { name: "Sign out" })
      .closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/auth/logout");
  });
});
