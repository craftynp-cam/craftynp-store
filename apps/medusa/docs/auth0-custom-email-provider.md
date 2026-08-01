# Auth0 custom email provider

Password reset mail is sent by **Auth0**, not by this app — Universal Login
owns credentials, and this repo never renders a credential form. Auth0's
tenant runs a `custom-email-provider` Action that POSTs to Resend directly.

**None of this executes in this repo.** The file exists so the Action is
reviewable and restorable after a tenant rebuild; there is deliberately no
copy under `src/`, which would never run.

## Why not Auth0's built-in Resend provider

**Branding → Email Provider lists `Resend` as its own tile, right next to
`Custom Provider`.** Picking it is the easy mistake — it is a real, working
Auth0 feature, just the wrong one. It relays over SMTP whatever Auth0's own
template renders (with the Change Password body set to `{{ url }}` per below,
that is a bare, unstyled link — Gmail flags exactly this shape as suspicious),
and never touches this repo's branded design at all. The branded email is
only ever sent by the `custom-email-provider` **Action**, configured from the
`Custom Provider` tile.

The send log makes the two unmistakable: the native `Resend` tile's requests
show `"User-Agent": "SMTP v1.0.0"` and no `template`/`html` field bearing our
design. The Action's requests show a `User-Agent` of `node` (a plain `fetch`
call), because it POSTs to `https://api.resend.com/emails` directly.

## Why the Action builds the HTML itself, not a Resend-hosted template

A `password-reset` template still exists in Resend (alias `password-reset`) —
it is the design source of truth and renders correctly in Resend's own
dashboard preview. **The Action does not call it.** Sending through
`template: { id: "password-reset" }` with a `RESET_URL` variable placed inside
an `<a href="{{{RESET_URL}}}">` looked correct — `200` response, template
resolved, `replyTo`/`subject` from the template all came through — but the
delivered link silently rendered as the variable's declared **fallback value**
(the shop's homepage) instead of the real ticket URL. Confirmed by logging
`event.notification.html` at the point the Action reads it: the real
`reset-verify?ticket=...` URL was there, correctly extracted, and still didn't
reach the recipient.

This is a known, unresolved Resend issue: template variables placed inside an
`href` attribute don't reliably substitute when sent via the REST API's
`template.id` + `variables` path —
[resend/react-email#3247](https://github.com/resend/react-email/issues/3247).
Their own stated workaround is to bypass the hosted template for these sends
and build the HTML server-side instead, which is what the Action below does:
it embeds the same design as a literal template string and interpolates
`RESET_URL` directly, so nothing depends on Resend's variable substitution for
a link.

**If order-confirmation or order-shipped mail ever behaves the same way** —
a "Track this order" or "View your order" link that looks right in the
Resend dashboard but opens the wrong page — this is the same bug. Those
templates use `href="{{{ORDER_URL}}}"` / `href="{{{TRACKING_URL}}}"` the
identical way and have not been independently verified against it.

## Brand assets in this email

The header matches `src/lib/order-email.ts`, and the two have to be changed
together — there is no shared constant, because the Action runs in Auth0's
tenant and can read neither `@craftynp/types` nor `STOREFRONT_URL`.

- **The logo is an absolute `https://thecraftynp.org/logo.png`**, hardcoded.
  It has to be a PNG — Gmail and Outlook strip `image/svg+xml` — and it has to
  be absolute, because email resolves no relative paths. **Until the storefront
  is deployed at that host the image renders broken**, so check it after the
  first deploy. If the domain changes, this line is the one to change.
- **Cookie only renders in Apple Mail, iOS Mail, Samsung Mail and
  Thunderbird.** Gmail and Outlook drop the webfont link and fall back to
  `Brush Script MT` / `Segoe Script` / `cursive`. The layout does not depend on
  it, and the logo carries the brand either way.

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
still Auth0's default, so a reset would reach the Action with `RESET_URL` set
to the stripped text of Auth0's entire default email.

## The Action

```js
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function passwordResetHtml(resetUrl, customerName, shopAddress) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reset your password</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cookie&amp;display=swap">
</head>
<body style="margin:0; padding:0; background-color:#ecebe6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ecebe6" style="background-color:#ecebe6;">
<tr>
<td align="center" style="padding-top:32px; padding-bottom:32px; padding-left:12px; padding-right:12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:20px; padding-bottom:20px; padding-left:28px; padding-right:28px; border-top-left-radius:10px; border-top-right-radius:10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="left" valign="middle" width="72" style="width:72px;">
<img src="https://thecraftynp.org/logo.png" width="72" height="64" alt="" style="display:block; border:0;">
</td>
<td align="left" valign="middle" style="padding-left:14px;">
<span style="font-family:'Cookie','Brush Script MT','Segoe Script',cursive; font-size:30px; line-height:32px; color:#04133b;">The Crafty NP</span>
<br>
<span style="font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:0.5px; color:#5a6377;">Elevated Creativity. Custom designs personalized with you in mind!</span>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#04133b" align="center" style="background-color:#04133b; padding-top:40px; padding-bottom:40px; padding-left:28px; padding-right:28px;">
<p style="margin-top:0; margin-bottom:0; font-family:Georgia,'Times New Roman',serif; font-size:30px; line-height:38px; color:#fbfaf7; font-weight:normal;">Reset your password</p>
<p style="margin-top:14px; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:23px; color:#c4cad6;">Hi ${customerName} &mdash; someone asked to reset the password on your Crafty NP account.</p>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding-top:36px; padding-bottom:12px; padding-left:40px; padding-right:40px;">
<p style="margin-top:0; margin-bottom:26px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:23px; color:#5a6377;">If that was you, pick a new one using the button below. The link expires shortly and can only be used once.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr>
<td bgcolor="#04133b" align="center" style="background-color:#04133b; border-radius:6px;">
<a href="${resetUrl}" style="display:block; padding-top:14px; padding-bottom:14px; padding-left:38px; padding-right:38px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:20px; color:#fbfaf7; font-weight:bold; text-decoration:none;">Choose a new password</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff; padding-top:24px; padding-bottom:8px; padding-left:28px; padding-right:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf7f2" style="background-color:#faf7f2; border-radius:8px;">
<tr>
<td style="padding-top:16px; padding-bottom:16px; padding-left:20px; padding-right:20px;">
<p style="margin-top:0; margin-bottom:6px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:16px; letter-spacing:2px; color:#5a6377; font-weight:bold;">BUTTON NOT WORKING?</p>
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#5a6377; word-break:break-all;"><a href="${resetUrl}" style="color:#04133b; text-decoration:underline;">${resetUrl}</a></p>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding-top:20px; padding-bottom:32px; padding-left:40px; padding-right:40px;">
<p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#5a6377;">Didn&rsquo;t ask for this? You can ignore this email &mdash; your password stays as it is and nothing has changed on your account.</p>
</td>
</tr>
<tr>
<td bgcolor="#04133b" style="background-color:#04133b; padding-top:26px; padding-bottom:26px; padding-left:28px; padding-right:28px; border-bottom-left-radius:10px; border-bottom-right-radius:10px;">
<p style="margin-top:0; margin-bottom:8px; font-family:'Cookie','Brush Script MT','Segoe Script',cursive; font-size:26px; line-height:30px; color:#fbfaf7;">The Crafty NP</p>
<p style="margin-top:0; margin-bottom:14px; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:20px; color:#c4cad6;">Handmade &amp; custom stickers, shirts, keychains, cups and banners &mdash; made one order at a time.</p>
<p style="margin-top:0; margin-bottom:4px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#8d97ac;">${shopAddress}</p>
<p style="margin-top:0; margin-bottom:0; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:18px; color:#8d97ac;">You&rsquo;re getting this because a password reset was requested for this address.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function passwordResetText(resetUrl, customerName, shopAddress) {
  return `The Crafty NP — Elevated Creativity. Custom designs personalized with you in mind!

RESET YOUR PASSWORD

Hi ${customerName} — someone asked to reset the password on your Crafty NP account. If that was you, use the link below.

${resetUrl}

This link expires shortly and can only be used once.

If you didn't ask for this, you can ignore this email — your password stays as it is and nothing has changed on your account.

--
${shopAddress}
You're getting this because a password reset was requested for this address.`;
}

exports.onExecuteCustomEmailProvider = async (event, api) => {
  const { to, from, subject, html, message_type } = event.notification;

  const isReset =
    message_type === "reset_email" || message_type === "reset_email_by_code";

  let payload;
  if (isReset) {
    const resetUrl = html.replace(/<[^>]*>/g, "").trim();
    const customerName = escapeHtml(event.user.given_name || "there");
    const shopAddress = "The Crafty NP";

    payload = {
      from,
      to: [to],
      subject: "Reset your Crafty NP password",
      replyTo: "hello@thecraftynp.org",
      html: passwordResetHtml(resetUrl, customerName, shopAddress),
      text: passwordResetText(resetUrl, customerName, shopAddress),
    };
  } else {
    payload = { from, to: [to], subject, html };
  }

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
    return api.notification.retry();
  }

  if (response.ok) return;

  if (response.status >= 500 || response.status === 429) {
    return api.notification.retry();
  }

  return api.notification.drop();
};
```

`api.notification.retry()` marks the send failed-but-recoverable; `drop()`
marks it failed with no further attempts. Neither is the same as throwing —
use them rather than an `Error`.

Keeping the `password-reset` template published in Resend is still worth
doing — it is the design reference for what this HTML should look like, and
Resend's own dashboard preview renders it correctly since that path doesn't
go through the REST API's variable substitution. Just don't wire the Action
back to `template.id` for this send.

## Verifying it

Two stages, in this order:

1. **"Send test email"** in Branding → Email Provider. It arrives as
   `message_type: try_provider_configuration_email`, so it takes the
   _fall-through_ branch — it proves the Action is bound, the secret resolves
   and the sender is accepted, but it does **not** exercise the reset HTML.
2. **A real reset** from Universal Login. That is the only thing that
   exercises `isReset` and the `{{ url }}` extraction.

Then check Resend's logs for the send — every request there has a
**Request body**. Read that before anything else:

| Symptom                                                             | Cause                                                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Request body has `"User-Agent": "SMTP v1.0.0"`                      | The `Resend` tile is selected instead of `Custom Provider` — see above, switch tiles    |
| Mail is a bare, unstyled link and Gmail flags it as suspicious      | Same cause as above — the native tile relays Auth0's raw template output, not ours      |
| Request body has `"template": {"id": ...}` and a mangled/wrong link | The Action was changed back to `template.id` + `variables` — see the Resend bug above   |
| Mail arrives looking like Auth0's default                           | Action not bound to the trigger, or `message_type` did not match                        |
| Reset link opens the homepage instead of a real reset page          | Change Password body is not `{{ url }}` alone, or the fix above wasn't deployed         |
| Nothing arrives, Auth0 shows retries                                | Resend rejected it — check the key's permissions and that the sender domain is verified |

These sends draw on the **same 100-a-day Resend allowance** as order mail.
