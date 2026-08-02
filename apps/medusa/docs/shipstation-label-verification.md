# Verifying the fulfilment workspace against a real label

CNP-76 is the first story that produces a real shipping label, so it is also
where CNP-65's two unverifiable acceptance criteria get closed out. Those were
that the `tracking_number` from a label purchase reaches the order with no
retyping, and that a genuine signed ShipStation `track` webhook carries an order
through to `delivered`. Neither could be demonstrated when CNP-65 shipped,
because nothing bought a label.

Automated tests mock ShipStation at the client boundary and deliberately never
touch the sandbox, so this run is the only thing that proves the real API path
works. It costs about one label — roughly $5. **Nothing before step 6 spends
money.**

> **This run cannot be done on the sandbox.** A sandbox label is a sample
> label: it is never handed to a carrier and never scanned, and
> `GET /v2/labels/{id}/track` reports `status_code: "UN"` — "No tracking
> information available" — forever. No `track` webhook is ever emitted for one,
> so AC 13b is unreachable there. It also cannot settle AC 4's _actual_ cost
> the way production does, because sandbox labels report `shipment_cost` of
> $0.00 when `test_label` is true. Use a production API key with a funded
> balance, and check `Settings > Payment & Subscription` in the ShipStation
> dashboard reads `Environment: Production` before starting.
>
> A sandbox account is still worth a dry run for everything up to step 16 —
> see [Sandbox dry run, 1 Aug 2026](#sandbox-dry-run-1-aug-2026) below for what
> that did and did not establish.

Record the results at the bottom of this file when you run it.

## Setup

1. `pnpm run services:up && pnpm run db:migrate`. Confirm the migration log shows
   `shipment_tracking` gaining `carrier_id`, `shipment_cost`,
   `shipment_cost_currency`, `label_file_id`, `void_approved` and
   `void_message`.
2. Fill these in `apps/medusa/.env` and restart:

   ```
   SHIP_FROM_NAME=
   SHIP_FROM_PHONE=
   SHIP_FROM_ADDRESS_1=
   SHIP_FROM_CITY=
   SHIP_FROM_STATE=
   SHIP_FROM_POSTAL_CODE=
   SHIPSTATION_TEST_LABELS=false
   ```

   If the server refuses to boot naming missing ShipStation options, that is the
   validator working. Fill them in — do not comment it out. `/v2/rates` and
   `/v2/labels` both reject a `ship_from` without a name and phone.

   **`SHIPSTATION_TEST_LABELS=false` is what makes this run spend real money.**
   Set it back to `true` afterwards.

3. `pnpm run list-carriers`. Confirm a USPS `carrier_id` and that it matches
   `SHIPSTATION_USPS_CARRIER_ID`. Note the printed balance — you will check it
   against the workspace in step 8.

## Tunnel and webhook

4. `ngrok http 9000`, or `cloudflared tunnel --url http://localhost:9000`. Copy
   the https URL.
5. Set `SHIPSTATION_WEBHOOK_URL=https://<tunnel>/hooks/shipstation/track` and
   `SHIPSTATION_JWKS_URL`, then restart Medusa.
6. `pnpm run register-webhook`. A 409 means one is already registered — delete
   the old subscription in ShipStation first. ShipStation allows one URL per
   event, and a stale one silently swallows every delivery.

## Buy one real label

7. Place a real storefront order to your own address, then move it to `packing`
   from the order detail page.
8. Open `/app/fulfilment`.
   - **AC 1** — the order is listed with its items, quantities, destination city
     and state, a derived weight in grams and a parcel in centimetres.
   - **AC 10** — the balance from step 3 is shown in the header.
9. Select it and press **Get live rates**.
   - **AC 2** — each option shows carrier, service, a dollar cost and a delivery
     window. Cross-check one price against ShipStation's own dashboard. It must
     include surcharges, so it will read slightly higher than the checkout
     estimate for the same service.
10. Change the weight to a clearly different value and re-rate. Prices should
    move. Press **Reset to calculated**. — **AC 3**
11. Pick the cheapest option and buy it. One confirmation prompt, then within a
    few seconds the tracking number, carrier, service and the amount actually
    paid appear on screen.
    - **AC 4** — the cost shown is what ShipStation charged, not the quote.
    - **AC 13a, and CNP-65 AC 5** — **you did not type the tracking number
      anywhere.**
12. Open the order detail page.
    - **AC 9** — status is `shipped`, tracking is shown with a working carrier
      link, and the history has the transition, **with no webhook having fired
      yet**.
13. Check the customer inbox for the shipped email carrying that tracking
    number. This proves `recordShipmentWorkflow` still ends in
    `createOrderShipmentWorkflow`, which is what emits `SHIPMENT_CREATED`.
14. **AC 11** — confirm the PDF is on disk under the Medusa uploads directory
    with a UUID in its filename, that `label_url` in `shipment_tracking` points
    at `/admin/fulfilment/labels/...` and not at `api.shipstation.com`, and that
    opening that URL while signed out returns 401 rather than the label.

## Print

15. Press **Print label**.
    - **AC 5** — the dialog opens on the PDF itself, not an HTML page. Set Scale
      to _Actual size_ and Margins to _None_. Print on plain paper and **measure
      it with a ruler: 4.00 × 6.00 inches**. There must be no URL, date or page
      number anywhere on the sheet.
16. Buy a second label on a second test order. Both now appear under **Labels
    ready to print**. Tick both and press the batch print button.
    - **AC 6** — one print dialog, one two-page job, both pages 4 × 6.

## Webhook through to delivered

17. Leave the tunnel and Medusa running. Watch the logs for
    `[shipstation:track]`.
18. On the first carrier scan, the order page's tracking status moves off
    "Awaiting the first scan" with no action from you.
19. On delivery — **AC 13b, and CNP-65 AC 6** — the order status becomes
    `delivered`, the history carries a `webhook`-actor entry, and Medusa's
    fulfillment is marked delivered. This is a genuine signature-verified
    delivery, not a replay.
20. If nothing arrives, confirm the tunnel URL still matches what step 6
    registered. A restarted free ngrok gets a new URL and ShipStation keeps
    posting at the dead one. A rejected delivery is logged rather than silently
    dropped.

## Void

21. On a third test order, buy a label and immediately void it.
    - **AC 7** — the prompt states plainly that the carrier may refuse and that a
      refund is not guaranteed. Afterwards the carrier's own message is shown
      verbatim, the order returns to `packing`, the tracking link disappears
      from the customer-facing view, and the history records the void.
22. Confirm in ShipStation that the label shows as voided, and watch the balance
    for the refund. **Do not treat a missing refund as a bug** — an unscanned
    label is usually refunded, a scanned one usually is not.

## Afterwards

Set `SHIPSTATION_TEST_LABELS` back to `true`.

## Sandbox dry run, 1 Aug 2026

Everything below was exercised against the **sandbox** while building CNP-76.
It is recorded here so the production run knows what is already load-bearing
and what genuinely remains.

**Verified against the real ShipStation API:**

| Step                             | Result                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue, derived parcel (AC 1)     | Orders listed with weight in grams and parcel in cm                                                                                                                                                                                   |
| Live rates (AC 2)                | 27 options. UPS Ground $24.43 **including $11.58 of surcharges** against USPS $4.39 with none — the carrier-mix cost difference the story exists to surface                                                                           |
| Parcel override (AC 3)           | 400 g quotes Media Mail $4.39; 5000 g drops Media Mail and First Class entirely on weight limits and the cheapest becomes $6.15. Editing a field clears the quote; "Reset to calculated" restores it                                  |
| Label purchase (AC 4)            | `shipment_cost` recorded as a real `6.16`, with carrier id and service code                                                                                                                                                           |
| Label geometry (AC 5)            | The stored PDF measures exactly 288 x 432 pt = 4.00 x 6.00 in                                                                                                                                                                         |
| Batch print (AC 6)               | Two labels merged into one PDF. A third order without a label returned 200 with the others plus `X-Labels-Unavailable` naming it                                                                                                      |
| Void (AC 7)                      | Carrier refusal recorded verbatim, order returned to `packing`, tracking hidden                                                                                                                                                       |
| No half-writes (AC 8)            | Proven by a genuine failure: purchase succeeded, a later step failed, the compensating void was refused, **nothing was written locally**, the order stayed shippable, and a `system` history entry named the orphaned tracking number |
| Shipped without a webhook (AC 9) | Order reached `shipped` with tracking before any webhook existed                                                                                                                                                                      |
| Balance (AC 10)                  | Rendered in the workspace header                                                                                                                                                                                                      |
| Own storage (AC 11)              | 66 KiB PDF in the private bucket; the admin route 401s when signed out and `/static` exposes nothing                                                                                                                                  |

**The webhook receiver was proven with a locally signed delivery.** A keypair
was served from a local JWKS, `SHIPSTATION_JWKS_URL` pointed at it, and a
payload signed exactly as ShipStation documents — `timestamp` + `.` + raw body,
RSA-SHA256, base64 — was POSTed over a public tunnel to the real route:

| Case                     | Result                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Signed `IT`              | 200, tracking status `in_transit`                                                                                 |
| Signed `DE`              | 200, order `delivered`, Medusa's fulfillment stamped `delivered_at`, `webhook` actor in history                   |
| **Raw body fidelity**    | Verified across a real Express request, `preserveRawBody` and a tunnel — the likeliest failure mode, and it holds |
| Tampered body            | 401 `bad_signature`                                                                                               |
| Timestamp 10 minutes old | 401 `stale_timestamp`                                                                                             |
| Replayed `DE`            | 200 with **no duplicate transition**                                                                              |

The signing format, `kid`, header names and payload shape were each checked
against ShipStation's own documentation and their live JWKS at
`https://api.shipengine.com/jwks`, whose key set contains an EC key alongside
the RSA one — the parser selects by `kid` and ignores the rest.

**What the sandbox could not establish, and the production run must:**

1. That ShipStation's own signature bytes match their documentation. Ours match
   the documented format, but only a genuine delivery proves theirs do. A
   mismatch shows up as `[shipstation:track] rejected reason=bad_signature`.
2. That a physical parcel produces carrier scans that reach `delivered`.
3. `shipment_cost` from a genuinely funded purchase.
4. A real carrier void refusal. The sandbox refuses every void with
   "Label could not be found ... or if you are attempting to refund a sample
   label", which is an artefact, not a carrier decision.

## Results

Fill this in when the production run is done.

| Item                              | Value              |
| --------------------------------- | ------------------ |
| Date run                          |                    |
| Run by                            |                    |
| ShipStation environment           |                    |
| Label id (purchase)               |                    |
| Tracking number                   |                    |
| Amount quoted / amount paid       |                    |
| Printed label measured            | ______ × ______ in |
| Batch print pages / dialogs       |                    |
| First `track` webhook received at |                    |
| `delivered` reached at            |                    |
| Label id (void test)              |                    |
| Void approved by carrier          |                    |
| Refund received                   |                    |
| Notes                             |                    |
