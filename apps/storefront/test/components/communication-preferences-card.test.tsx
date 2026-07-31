import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommunicationPreferencesCard } from "@/components";

const INITIAL_PREFERENCES = { newDrops: false, salesAndBundles: true };

describe("CommunicationPreferencesCard", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("locks the transactional row on, since order and proof email is required", () => {
    render(
      <CommunicationPreferencesCard
        initialPreferences={INITIAL_PREFERENCES}
      />,
    );

    const transactional = screen.getByRole("switch", {
      name: /Proof approvals & order updates/,
    });
    expect(transactional).toBeChecked();
    expect(transactional).toBeDisabled();
  });

  it("saves a marketing toggle with the rest of the preferences", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <CommunicationPreferencesCard
        initialPreferences={INITIAL_PREFERENCES}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /^New drops/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/account/preferences",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ newDrops: true, salesAndBundles: true }),
        }),
      ),
    );
  });

  it("reverts the toggle and reports an error when the save fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      <CommunicationPreferencesCard
        initialPreferences={INITIAL_PREFERENCES}
      />,
    );

    const salesToggle = screen.getByRole("switch", {
      name: /^Sales & bundle deals/,
    });
    fireEvent.click(salesToggle);

    await waitFor(() => expect(salesToggle).toBeChecked());
    expect(
      screen.getByText("We couldn't save that. Please try again."),
    ).toBeInTheDocument();
  });
});
