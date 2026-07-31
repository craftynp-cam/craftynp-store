# Auth0 custom email provider

Password reset mail is sent by **Auth0**, not by this app — Universal Login
owns credentials, and this repo never renders a credential form. To make that
mail use the on-brand `password-reset` template in Resend, Auth0's tenant runs
a `custom-email-provider` Action.

**None of this executes in this repo.** The file exists so the Action is
reviewable and restorable after a tenant rebuild; there is deliberately no
copy under `src/`, which would never run.

## Why not Auth0's built-in Resend provider

Auth0 offers Resend natively under Branding → Email Provider. It fixes
deliverability but **Auth0's own Liquid template still renders the body**, so
the Resend-hosted template is never invoked and the reset mail looks nothing
like the order emails. Hence the Action.

## Dashboard prerequisites

1. **Branding → Email Templates → Change Password**: set the message body to
   **exactly** `{{ url }}` and nothing else. The Action recovers a clean reset
   URL by stripping tags from the rendered HTML, which only works because the
   body has nothing else in it. Anything else there ends up inside `RESET_URL`.
2. **Actions → Library → custom-email-provider**: create the Action below.
3. Add the secret `RESEND_API_KEY` to that Action. It is a separate secret from
   this repo's env var, stored in the Auth0 tenant.
4. Deploy the Action and bind it to the Custom Email Provider trigger.

## The Action

```js
exports.onExecuteCustomEmailProvider = async (event, api) => {
  const { to, subject, html, message_type } = event.notification;

  // Only password reset is redirected to the Resend template. Anything else
  // Auth0 sends (verification, blocked account) falls through to its own body
  // rather than silently not being sent at all.
  const isReset = message_type === "reset_email";

  const payload = isReset
    ? {
        from: "The Crafty NP <hello@thecraftynp.org>",
        to: [to],
        template: { id: "password-reset" },
        variables: {
          // The Change Password template body is exactly `{{ url }}`, so
          // stripping tags leaves the reset URL and nothing else.
          RESET_URL: html.replace(/<[^>]*>/g, "").trim(),
          CUSTOMER_NAME: event.user.given_name || "there",
          SHOP_ADDRESS: "The Crafty NP",
        },
      }
    : {
        from: "The Crafty NP <hello@thecraftynp.org>",
        to: [to],
        subject,
        html,
      };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${event.secrets.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Auth0 retries the trigger when the Action fails, which is the retry
    // path for this mail — there is no notification row on our side.
    throw new Error(`Resend rejected the send: ${await response.text()}`);
  }
};
```

## Verifying it

Trigger a reset from Universal Login, then check Resend's logs for a send to
that address using the `password-reset` template. If the mail arrives but
looks like Auth0's default, the Action is not bound to the trigger. If
`RESET_URL` contains markup, the Change Password body is not `{{ url }}` alone.

These sends draw on the **same 100-a-day Resend allowance** as order mail.
