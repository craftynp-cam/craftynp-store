# Auth0 custom email provider

Password reset mail is sent by **Auth0**, not by this app — Universal Login
owns credentials, and this repo never renders a credential form. To make that
mail use the on-brand `password-reset` template in Resend, Auth0's tenant runs
a `custom-email-provider` Action.

**None of this executes in this repo.** The file exists so the Action is
reviewable and restorable after a tenant rebuild; there is deliberately no
copy under `src/`, which would never run.

## Why not Auth0's built-in Resend provider

**Branding → Email Provider lists `Resend` as its own tile, right next to
`Custom Provider`.** Picking it is the easy mistake — it is a real, working
Auth0 feature, just the wrong one. It relays over SMTP whatever Auth0's own
template renders (with the Change Password body set to `{{ url }}` per below,
that is a bare, unstyled link — Gmail flags exactly this shape as suspicious),
and never touches the `password-reset` Resend template at all. The
Resend-hosted template is only ever invoked by the `custom-email-provider`
**Action**, configured from the `Custom Provider` tile.

The send log makes the two unmistakable: the native `Resend` tile's requests
show `"User-Agent": "SMTP v1.0.0"` and no `template`/`variables` field, only
raw `html`/`text`. The Action's requests show `"template": { "id":
"password-reset" }` and no `SMTP` user-agent, because it POSTs to
`https://api.resend.com/emails` directly.

## Dashboard prerequisites

**Do these in order.** Auth0 ignores every email-template edit until a custom
email provider exists — the template editor shows a warning banner saying so,
and saving the body first simply has no effect.

1. **Branding → Email Provider → toggle "Use my own email provider" → the
   `Custom Provider` tile**, not the `Resend` tile beside it (see above). The
   `custom-email-provider` trigger has no entry in the generic Actions →
   Library → Create Action dropdown — it gets its own built-in code editor
   right on this page. Set **From** to
   `The Crafty NP <hello@thecraftynp.org>` — this is the field
   `event.notification.from` reads in the Action below, so it is the one place
   the sender address is set, not a second hardcoded copy in the code. Paste in
   the Action, add the secret `RESEND_API_KEY` (key icon, left rail — a tenant
   secret, separate from this repo's env var), then **Save**, which deploys it.
   Until this step, Auth0 uses its own built-in provider, which is trial-grade
   and generally only delivers to tenant members — customer-facing reset mail
   does not work at all before this, branding aside.
2. **Branding → Email Templates → Change Password**: set the message body to
   **exactly** `{{ url }}` and nothing else. The Action recovers a clean reset
   URL by stripping tags from the rendered HTML, which only works because the
   body has nothing else in it. Anything else there ends up inside `RESET_URL`.

**Do 1 and 2 back to back.** In between, the provider is live while the body is
still Auth0's default, so a reset would reach the Resend template with
`RESET_URL` set to the stripped text of Auth0's entire default email.

## The Action

```js
exports.onExecuteCustomEmailProvider = async (event, api) => {
  // `from` comes from the Custom Provider tile's own From field, not a
  // hardcoded value here — one place to change the sender, not two that can
  // drift out of sync.
  const { to, from, subject, html, message_type } = event.notification;

  // Only password reset is redirected to the Resend template. Every other
  // message_type Auth0 can send — verify_email, blocked_account,
  // organization_invitation, and the dashboard's own
  // try_provider_configuration_email test — falls through to Auth0's rendered
  // body, so enabling this provider never silently stops those being sent.
  const isReset =
    message_type === "reset_email" || message_type === "reset_email_by_code";

  const payload = isReset
    ? {
        from,
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
    : { from, to: [to], subject, html };

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

Then check Resend's logs for the send — every request there has a
**Request body**. Read that before anything else:

| Symptom                                                        | Cause                                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Request body has `"User-Agent": "SMTP v1.0.0"`, no `template`  | The `Resend` tile is selected instead of `Custom Provider` — see above, switch tiles    |
| Mail is a bare, unstyled link and Gmail flags it as suspicious | Same cause as above — the native tile relays Auth0's raw template output, not ours      |
| Mail arrives looking like Auth0's default                      | Action not bound to the trigger, or `message_type` did not match                        |
| `RESET_URL` contains markup or extra text                      | Change Password body is not `{{ url }}` alone                                           |
| Nothing arrives, Auth0 shows retries                           | Resend rejected it — check the key's permissions and that the sender domain is verified |

These sends draw on the **same 100-a-day Resend allowance** as order mail.
