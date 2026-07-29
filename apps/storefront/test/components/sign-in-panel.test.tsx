import { render, screen } from "@testing-library/react";

import { SignInPanel } from "@/components";

describe("SignInPanel", () => {
  it("renders both sign-in controls with accessible names on the control", () => {
    render(<SignInPanel />);

    const email = screen.getByRole("link", { name: "Continue with email" });
    const google = screen.getByRole("link", { name: "Continue with Google" });

    expect(email).toHaveAttribute("href", "/auth/login");
    expect(google).toHaveAttribute(
      "href",
      "/auth/login?connection=google-oauth2",
    );
  });

  it("carries return_to through to both controls", () => {
    render(<SignInPanel returnTo="/checkout" />);

    expect(
      screen.getByRole("link", { name: "Continue with email" }),
    ).toHaveAttribute("href", "/auth/login?return_to=%2Fcheckout");
    expect(
      screen.getByRole("link", { name: "Continue with Google" }),
    ).toHaveAttribute(
      "href",
      "/auth/login?return_to=%2Fcheckout&connection=google-oauth2",
    );
  });

  it("renders no error region when there is no error", () => {
    render(<SignInPanel />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces a known error and is not colour-only — an icon accompanies the text", () => {
    render(<SignInPanel error="cancelled" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Sign-in was cancelled. No account was created.",
    );
    expect(alert.querySelector("svg")).toBeInTheDocument();
  });

  // `on-danger`/`danger` is the registered, AA-tested pairing for text on a
  // danger-coloured surface (src/lib/design-tokens.ts's onPairs) — the same
  // pattern as on-primary/primary. `danger-foreground` is a different token,
  // meant for standalone error text on the page's normal background, and
  // reads at close to 1:1 contrast when stacked on bg-danger instead.
  it("pairs the danger surface with on-danger text, not danger-foreground", () => {
    render(<SignInPanel error="cancelled" />);

    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-danger");
    expect(alert.className).toContain("text-on-danger");
    expect(alert.className).not.toContain("text-danger-foreground");
  });

  it("tells an unverified customer to check their inbox, not that sign-in was cancelled", () => {
    render(<SignInPanel error="unverified_email" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check your inbox to verify your email address, then sign in again.",
    );
  });

  it("falls back to a generic message for an unrecognised error code", () => {
    render(<SignInPanel error="something_unexpected" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't sign you in. Please try again.",
    );
  });
});
