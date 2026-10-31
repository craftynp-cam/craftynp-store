import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { CustomQuoteForm } from "@/components";
import type { CustomQuoteResult } from "@/lib/custom-quote";

function setup(result: CustomQuoteResult = { ok: true }) {
  const submit = jest.fn(async () => result);
  const user = userEvent.setup();
  const view = render(
    <CustomQuoteForm contactEmail="info@thecraftynp.org" submit={submit} />,
  );
  return { submit, user, ...view };
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), "Jamie Rivera");
  await user.type(screen.getByLabelText(/phone/i), "317-555-0100");
  await user.type(screen.getByLabelText(/email/i), "jamie@example.com");
  await user.type(screen.getByLabelText(/^product/i), "Acrylic sign");
  await user.type(
    screen.getByLabelText(/description/i),
    "A 12 by 18 office sign.",
  );
}

describe("CustomQuoteForm", () => {
  it("names every missing field and focuses the first, sending nothing", async () => {
    const { submit, user } = setup();

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/your name/i)).toHaveFocus();
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your description.")).toBeInTheDocument();
    expect(
      screen.queryByText("Enter the date as a real calendar date."),
    ).not.toBeInTheDocument();
  });

  it("sends the request and confirms where the reply will go", async () => {
    const { submit, user } = setup();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(submit).toHaveBeenCalledWith({
      name: "Jamie Rivera",
      phone: "317-555-0100",
      email: "jamie@example.com",
      neededBy: "",
      product: "Acrylic sign",
      description: "A 12 by 18 office sign.",
      company: "",
    });
    const heading = await screen.findByRole("heading", {
      name: /your request is on its way/i,
    });
    expect(screen.getByText("jamie@example.com")).toBeInTheDocument();
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("keeps what was typed and offers the email address when sending fails", async () => {
    const { user } = setup({ ok: false, reason: "unavailable" });

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("couldn't send your request");
    expect(
      screen.getByRole("link", { name: "info@thecraftynp.org" }),
    ).toHaveAttribute("href", "mailto:info@thecraftynp.org");
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Jamie Rivera");
  });

  it("has no axe violations once errors are showing", async () => {
    const { user, container } = setup();

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
