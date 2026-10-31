import { POST } from "./route";

const REQUEST = {
  name: "Jamie <b>Rivera</b>",
  phone: "317-555-0100",
  email: "jamie@example.com",
  neededBy: "2026-12-01",
  product: "Acrylic sign",
  description: "Line one\nLine two",
  company: "",
};

function run(
  body: Record<string, unknown>,
  options: { storedEmail?: string; sendError?: Error } = {},
) {
  const createNotifications = jest.fn(async () => {
    if (options.sendError) throw options.sendError;
    return {};
  });
  const listSiteContentEntries = jest.fn(async () =>
    options.storedEmail
      ? [{ key: "custom_quote_email", value: options.storedEmail }]
      : [],
  );
  const logger = { error: jest.fn() };
  const services: Record<string, unknown> = {
    logger,
    siteContent: { listSiteContentEntries },
    notification: { createNotifications },
  };
  const req = {
    validatedBody: body,
    scope: { resolve: (key: string) => services[key] },
  } as never;
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));

  return POST(req, { status } as never).then(() => ({
    createNotifications,
    status,
    json,
  }));
}

describe("POST /store/custom-quotes", () => {
  it("emails the request to the owner's address, replying to the shopper", async () => {
    const { createNotifications, status } = await run(REQUEST, {
      storedEmail: "quotes@thecraftynp.org",
    });

    expect(status).toHaveBeenCalledWith(202);
    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "quotes@thecraftynp.org",
        channel: "email",
        data: { reply_to: "jamie@example.com" },
      }),
    );
  });

  it("sends to the default address when the owner has not set one", async () => {
    const { createNotifications } = await run(REQUEST);

    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ to: "info@thecraftynp.org" }),
    );
  });

  it("escapes what the shopper typed in the HTML body", async () => {
    const { createNotifications } = await run(REQUEST);

    const [[sent]] = createNotifications.mock.calls as unknown as [
      [{ content: { html: string; text: string } }],
    ];
    expect(sent.content.html).toContain("Jamie &lt;b&gt;Rivera&lt;/b&gt;");
    expect(sent.content.html).toContain("Line one<br>Line two");
    expect(sent.content.text).toContain("Date needed: Tue, Dec 1, 2026");
  });

  it("drops a request whose hidden field a bot filled in, without sending", async () => {
    const { createNotifications, status } = await run({
      ...REQUEST,
      company: "Spam Inc",
    });

    expect(status).toHaveBeenCalledWith(202);
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("tells the shopper it failed when the email cannot be sent", async () => {
    const { status, json } = await run(REQUEST, {
      sendError: new Error("resend down"),
    });

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({ error: "custom_quote_unavailable" });
  });
});
