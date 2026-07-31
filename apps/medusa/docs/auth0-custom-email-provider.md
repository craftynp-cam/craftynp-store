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
const FROM = "The Crafty NP <hello@thecraftynp.org>";

exports.onExecuteCustomEmailProvider = async (event, api) => {
  const { to, subject, html, message_type } = event.notification;

  // Only password reset is redirected to the Resend template. Every other
  // message_type Auth0 can send — verify_email, blocked_account,
  // organization_invitation, and the dashboard's own
  // try_provider_configuration_email test — falls through to Auth0's rendered
  // body, so enabling this provider never silently stops those being sent.
  const isReset =
    message_type === "reset_email" || message_type === "reset_email_by_code";

  const payload = isReset
    ? {
        from: FROM,
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
    : { from: FROM, to: [to], subject, html };

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${event.secrets.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Network-level failure. Auth0 retries up to 5 times over the next few
    // minutes — this is the whole retry story for password-reset mail, since
    // it never touches our notification table.
    return api.notification.retry();
  }

  if (response.ok) return;

  // 4xx fails identically on every attempt (bad key, unknown template,
  // unverified sender), so retrying just burns the quota. 5xx and 429 are
  // worth another go.
  if (response.status >= 500 || response.status === 429) {
    return api.notification.retry();
  }

  return api.notification.drop();
};
```

`api.notification.retry()` marks the send failed-but-recoverable; `drop()`
marks it failed with no further attempts. Neither is the same as throwing —
use them rather than an `Error`.

## Verifying it

Two stages, in this order:

1. **"Send test email"** in Branding → Email Provider. It arrives as
   `message_type: try_provider_configuration_email`, so it takes the
   _fall-through_ branch — it proves the Action is bound, the secret resolves
   and the sender is accepted, but it does **not** exercise the Resend
   template.
2. **A real reset** from Universal Login. That is the only thing that
   exercises the `password-reset` template and the `{{ url }}` extraction.

Then check Resend's logs for the send.

| Symptom                                   | Cause                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Mail arrives looking like Auth0's default | Action not bound to the trigger, or `message_type` did not match                        |
| `RESET_URL` contains markup or extra text | Change Password body is not `{{ url }}` alone                                           |
| Nothing arrives, Auth0 shows retries      | Resend rejected it — check the key's permissions and that the sender domain is verified |

These sends draw on the **same 100-a-day Resend allowance** as order mail.
