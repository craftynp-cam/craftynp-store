import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SignInSecurityCard } from "@/components";

describe("SignInSecurityCard", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows a Google customer their provider and no reset button", () => {
    render(<SignInSecurityCard authProvider="google" />);

    expect(screen.getByText("Signed in with Google")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reset link/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an email customer a reset button that requests a reset link", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<SignInSecurityCard authProvider="email" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Email me a reset link" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/account/password-reset",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Check your inbox for a reset link."),
      ).toBeInTheDocument(),
    );
  });

  it("renders neither a provider row nor a reset button for a JWT minted before auth0_sub existed", () => {
    render(<SignInSecurityCard authProvider="unknown" />);

    expect(screen.queryByText(/Signed in with/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reset link/i }),
    ).not.toBeInTheDocument();
  });
});
