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

## Results

Fill this in when the run is done.

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
