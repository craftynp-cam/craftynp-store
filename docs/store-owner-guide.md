# The Crafty NP — Store Owner's Guide

Everything you do day to day happens in one place: the **admin dashboard**.
This guide walks through each job start to finish, and the last section is a
troubleshooting list for when something doesn't behave.

| Where           | Address                           |
| --------------- | --------------------------------- |
| Admin dashboard | <https://api.thecraftynp.com/app> |
| Your live store | <https://thecraftynp.org>         |

**Signing in.** Click _Continue with Google_ and use your Crafty NP Google
Workspace account. There is no password to remember — the Google account is the
login. Only accounts on the business domain can get in, and each person needs to
be set up once by your developer before their first sign-in.

**Contents**

1. [Products](#1-products)
2. [Categories](#2-categories)
3. [Inventory](#3-inventory)
4. [Orders and fulfilment](#4-orders-and-fulfilment)
5. [Promotions and sale pricing](#5-promotions-and-sale-pricing)
6. [Site content](#6-site-content)
7. [What emails your customers get](#7-what-emails-your-customers-get)
8. [Troubleshooting](#8-troubleshooting)
9. [When to call your developer](#9-when-to-call-your-developer)

---

## 1. Products

**Products → Create.**

### The fields that matter

| Field                             | Why it matters                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| **Title**                         | The name shoppers see, and what search engines index.                                    |
| **Handle**                        | The web address. `beach-tumbler` becomes `thecraftynp.org/drinkware/beach-tumbler`.      |
| **Description**                   | Shown on the product page. Write it for the shopper, not for a spec sheet.               |
| **Media / Thumbnail**             | The thumbnail is the picture on listing pages. Media is the gallery on the product page. |
| **Weight, Length, Width, Height** | **Required.** These are what price your shipping labels.                                 |
| **Category**                      | Decides where the product lives on the site — see [Categories](#2-categories).           |
| **Sales channel**                 | Must include the **Default Sales Channel** or the product will not appear on the site.   |
| **Status**                        | _Draft_ is invisible to shoppers. _Published_ is live.                                   |

### Weight and size are required to publish

Enter **weight in grams** and **length, width and height in centimetres**. If
you try to publish a product without all four, the save is refused with a message
naming exactly what's missing, for example:

> Cannot publish "Beach Tumbler": weight (grams) and length, width (cm) are
> required.

This is deliberate. Shipping labels are priced from the real parcel, and there is
no flat-rate fallback — a product with no size would block the order at the point
of buying a label instead of at the point of adding the product.

Give the **packed** measurements, box included, not the bare item. Round up.

### Variants and options

If a product comes in several versions — sizes, colours, scents — add an
**option** (e.g. "Size") with its values ("Small", "Medium", "Large"), then let
the dashboard generate a **variant** for each combination. Each variant carries
its own **price, SKU and stock**.

- Prices are entered in **US dollars**. The store sells in USD only.
- On the storefront, a shopper picks the option values and the matching variant's
  price and stock appear. Combinations you never created, or that are sold out,
  are shown as unavailable.
- If a product has no variations at all, leave it with the single default
  variant and just set its price.

### A good publishing checklist

1. Title, description, handle.
2. Thumbnail plus at least two gallery images.
3. Weight and the three dimensions, packed.
4. Prices on every variant.
5. Category assigned.
6. Default Sales Channel ticked.
7. Stock set (see [Inventory](#3-inventory)).
8. Status → Published.

Then open the product on the live site and check it reads the way you meant.

---

## 2. Categories

**Products → Categories.**

Categories do three jobs on this store:

1. **They are the top navigation.** Every _top-level_ category appears in the
   header menu, in alphabetical order.
2. **They are the homepage carousel.** One slide per top-level category, with the
   photo you give it.
3. **They are the web address.** A category with the handle `drinkware` lives at
   `thecraftynp.org/drinkware`, and its products at
   `thecraftynp.org/drinkware/beach-tumbler`.

### Creating one

Give it a **name** (what shoppers read) and a **handle** (what appears in the
address — lowercase, hyphens, no spaces). Set it **Active** and **Public** so it
shows up.

**Handles you cannot use.** These are already used by pages on the site, and a
category using one will not work: `products`, `about`, `account`, `auth`,
`checkout`, `design`, `sign-in`. Pick anything else.

### The category photo

Open a category and look for the **Image** panel on the right.

- **Upload** a photo — this is the background of that category's slide in the
  homepage carousel. Without one, the slide falls back to a plain pattern.
- **Alt text** describes the photo for shoppers using a screen reader. Leave it
  blank only if the photo is purely decorative.
- Click **Save** in that panel. It saves separately from the rest of the
  category.

### Subcategories

You can nest a category under a parent. Nested categories do **not** appear in
the header or the homepage carousel — only top-level ones do. Use nesting for
organising a large catalogue, not for promoting a range.

### Renaming and deleting

Changing a handle changes the web address, and any old link — a customer's
bookmark, a social post, a Google result — will break. Rename the _name_ freely;
change the _handle_ only when you have a reason.

---

## 3. Inventory

Stock lives on the **variant**, not the product. Open a product, then a variant,
and you'll find the inventory settings.

### The three settings

- **Manage inventory** — off means "always available, never counts down". Right
  for made-to-order pieces. On means the store tracks a number.
- **Quantity** — how many you have. Every completed order reduces it.
- **Allow backorder** — on means shoppers can still buy at zero stock. Off means
  the variant sells out.

### What shoppers see

| Stock                                 | On the product page      | Can they buy? |
| ------------------------------------- | ------------------------ | ------------- |
| More than 5                           | _In stock_               | Yes           |
| 1 to 5                                | _Low stock — order soon_ | Yes           |
| 0                                     | _Out of stock_           | No            |
| Manage inventory off, or backorder on | _In stock_               | Yes           |

Out-of-stock products still appear in listings — the Add to cart button is
simply disabled. To take something off the site entirely, set its status back to
**Draft**.

### Restocking

Edit the variant's quantity to the new total, not the amount you added. If you
had 2 and made 10 more, enter 12.

### A note on reservations

When you buy a shipping label, the stock for that order is consumed. If you then
void the label, the stock is put back and the order returns to _Packing_. You
don't need to adjust anything by hand for a void.

---

## 4. Orders and fulfilment

There are two places to work with orders:

- **Orders** — the full list. Open any order for the customer, items, totals,
  payment, and the **Fulfilment** panel on the right.
- **Fulfilment** — a dedicated workspace listing only the orders that are packed
  and waiting for a label, plus every label you've bought recently.

### The order lifecycle

```
Received ──→ Packing ──→ Shipped ──→ Delivered
                │  ↑
                │  └── (void a label returns it here)
                ↓
          In production
```

Any of _Received_, _Packing_ or _In production_ can also be **Cancelled**.
_Delivered_ and _Cancelled_ are final — nothing moves out of them.

- **Received** — paid, nothing done yet. This is where every new order lands.
- **Packing** — you're making or boxing it. **An order only appears in the
  Fulfilment workspace once you move it to Packing.**
- **In production** — for longer custom work, when you want to distinguish "being
  made" from "being boxed". Optional.
- **Shipped** — set automatically when you buy a label. You never set this by
  hand.
- **Delivered** — set automatically when the carrier reports delivery. You can
  also set it yourself.

Move an order along with the buttons in the **Fulfilment** panel on the order
page. Every change is recorded in the History list underneath, with a timestamp.

### Shipping an order, start to finish

1. **Orders** → open the order → **Mark packing**.
2. Go to **Fulfilment** in the left menu. The order is now in the queue.
3. Click its row. You'll see the delivery address, a **packing list** of what
   goes in the box, and the parcel panel.
4. **Check the parcel.** Weight in grams, size in centimetres. It's calculated
   from the products in the order — correct it if the real box differs. _Reset to
   calculated_ puts the numbers back.
5. **Get live rates.** Real prices come back from the carriers, with delivery
   estimates.
6. Pick a rate and click **Buy label**. You'll be asked to confirm, and told the
   exact amount.
7. **Print the label.** Use **4 × 6 in, Actual size (100%), Margins: None** — any
   other setting and the barcode may not scan.

Buying the label does three things at once: charges your ShipStation balance,
moves the order to **Shipped**, and emails the customer their tracking number.

### Rates go stale

Quotes older than **15 minutes** are refused, with a warning to refresh. Carriers
reprice constantly, and the final charge is set at the moment of purchase — it
can differ from the quote by a few cents. That's normal.

### Printing several labels at once

The Fulfilment page lists **Labels ready to print** — everything bought in the
last two weeks. Tick as many as you like and print them as a single job. Same
print settings: 4 × 6, 100%, no margins.

### Voiding a label

On the order's Fulfilment panel, **Void label**. Read this before you use it:

- It asks the carrier to cancel the label. **The carrier does not always agree**,
  and does not always refund. If they refuse, you'll be told, and the order still
  returns to Packing so you can try again.
- It hides the tracking link from the customer and puts the stock back.
- **It does not un-send the shipped email.** If tracking has already gone out,
  message the customer yourself.

### If buying a label fails

You'll get a plain-English message saying what happened and what to do. The
common ones:

| Message                 | What to do                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Not enough funds        | Top up your ShipStation balance, then buy again.                                                                         |
| The carrier rejected it | Usually a bad address or an impossible parcel. Check both.                                                               |
| Timed out               | **Do not immediately buy again.** Refresh the order first — the label may have gone through. Buying twice charges twice. |
| No carrier would quote  | The weight or size is wrong. Fix the parcel and re-rate.                                                                 |

### Cancelling an order

Use **Mark cancelled** on an order that hasn't shipped. Refunding the customer is
separate — issue that from the order's payment section, or in Stripe.

---

## 5. Promotions and sale pricing

> **Read this first.** The checkout has **no promo-code box**. A discount code
> created under _Promotions_ cannot be typed in by a shopper today, because there
> is nowhere on the site to type it. Adding one is a development change — ask
> your developer if you want it.
>
> The discount mechanism that **is** wired up end to end is a **sale price**, and
> it's described below.

### Running a sale (this works today)

**Pricing → Price lists → Create**, type **Sale**.

1. Give it a name and, optionally, a start and end date. Dates are the easiest
   way to run a weekend sale without having to remember to switch it off.
2. Choose the products or variants it covers.
3. Set the sale price for each.
4. Save.

On the site, every product in the list immediately shows:

- a **Sale** badge on its card in listings,
- the old price **struck through** beside the new one,
- a **"Save 25%"** style label on the product page.

To end a sale early, deactivate or delete the price list. The old price comes
straight back.

### Just changing a price

For a permanent change, edit the variant's price directly. No price list, no
strike-through, no Sale badge — it simply becomes the new price.

### Free shipping and other promotions

The _Promotions_ section of the dashboard exists, but as noted above, shoppers
have no way to enter a code, so a code-based promotion will never be redeemed.
If you want free shipping over a threshold, or a percentage off sitewide, talk to
your developer about how to wire it into checkout rather than creating a
promotion and assuming it applies.

---

## 6. Site content

**Site content** in the left menu. This is where you edit the words and photos on
the site itself — no developer needed.

Everything on this page follows the same rules:

- **Photos upload the moment you choose them**, but they don't appear on the site
  until you press **Save**.
- Images are automatically resized down and must be under **5 MB**.
- **Clear** on an image field removes it. Where a field says "leave empty to hide
  this tile", clearing it removes that piece from the page entirely.
- Character limits are enforced as you type — the field simply stops accepting
  more.
- **Alt text** describes a photo aloud for shoppers using a screen reader. Write
  what's in the picture. Leave it blank only when the photo adds nothing the
  surrounding text doesn't already say.

### What's on the page

**Announcement bar** — the strip above the header.

- _Show the announcement bar_ — the on/off switch.
- _Announcement text_ — one line, up to 200 characters. Good for "Free shipping
  this weekend" or "Orders placed after the 18th ship in January".

**Fresh from the workshop** — the homepage gallery.

- A heading and a one-line intro.
- Four tiles, each with a **square** photo and a caption. The caption doubles as
  the photo's alt text. **Leave a tile's image empty and that tile disappears** —
  so you can run two or three instead of four.

**About the maker** — the homepage introduction block.

- Eyebrow (the small uppercase label), heading, one paragraph of body copy, a
  **portrait** photo — portrait orientation works best — its alt text, and the
  label on the link through to the About page.

**About page** — the full `/about` page.

- Hero: eyebrow, heading, body paragraph, portrait photo and alt text, and the
  button label that sends people to the shop.
- Story: a heading and the longer story. **Separate paragraphs with a blank
  line.**
- Closing band: heading, one line of body copy, and the button label.

**Order confirmation** — two lines shown on the thank-you page _and inside the
confirmation email_.

- _Production turnaround_ — how long you take to make an order.
- _Shipping window_ — how long delivery takes once it's gone.

Keep these honest and current. They set the expectation that decides whether a
customer emails you asking where their order is.

**Get in touch** — your phone number and email address, shown in the footer at
the bottom of every page.

- _Phone number_ — type it however you want it to read (`317.843.1640`). The
  site works out the number to dial from it, so a customer on a phone can tap
  it.
- _Email address_ — tapping it opens a new message to you.

Leave either one empty and that line simply disappears from the footer.

### Saving

Press **Save** and the site updates. If you navigate away without saving, your
edits are lost.

---

## 7. What emails your customers get

Three automatic emails, all branded:

| When                                | Email                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| The order is paid                   | Order confirmation — items, totals, and your turnaround and shipping lines from Site content. |
| You buy a shipping label            | Shipped — the tracking number and a link.                                                     |
| A customer asks to reset a password | Password reset.                                                                               |

You do not send these by hand, and there is no "resend" button. If a customer
says an email never arrived, ask them to check spam, and forward the details
yourself if needed.

---

## 8. Troubleshooting

**"It won't let me publish a product."**
Weight and all three dimensions are required, and the message names which are
missing. Fill them in, then publish.

**"My product isn't on the site."**
In order of likelihood: its status is Draft; it isn't in the Default Sales
Channel; it has no category; it has no price. Check all four.

**"My category isn't in the menu."**
Only top-level categories appear — check it doesn't have a parent. It must also
be Active and Public. And if its handle is one of the reserved words
(`products`, `about`, `account`, `auth`, `checkout`, `design`, `sign-in`), it
will not work; change it.

**"The homepage carousel slide has no photo."**
Open the category and upload one in the **Image** panel on the right, then press
**Save** in that panel specifically.

**"The order isn't in the Fulfilment queue."**
It's still _Received_. Open it and **Mark packing**.

**"It says the parcel needs a weight."**
One or more products in the order has no saved size. Type the parcel in by hand
to get the label out today — then go and fix the product, so it's calculated
automatically next time.

**"The rates are greyed out / it won't let me buy."**
The quote is more than 15 minutes old. Click **Refresh rates**.

**"Buying the label timed out and I don't know if it worked."**
Refresh the order page and look at its Fulfilment panel. If tracking is there,
the label was bought — do not buy another. If not, buy again.

**"The customer says their tracking link is dead."**
If you voided the label, that's expected — the link is removed on purpose. Buy a
new label; a fresh tracking number goes out with it.

**"I edited site content and nothing changed."**
You uploaded but didn't **Save**, or you're looking at a cached page — hard
refresh with Ctrl+Shift+R (Cmd+Shift+R on a Mac).

**"A discount code isn't working."**
There is no promo-code box at checkout. Use a **Sale price list** instead — see
[section 5](#5-promotions-and-sale-pricing).

**"I can't sign in to the dashboard."**
Sign-in is Google Workspace only, on the business domain — a personal Gmail
account will always be refused. If the right account is refused, it hasn't been
set up in the dashboard yet. Contact your developer.

---

## 9. When to call your developer

Some things aren't editable from the dashboard by design. These need a code
change or an account with a third party:

- Page layout, colours, fonts, and any wording not on the **Site content** page.
- Adding a promo-code box to checkout, or free-shipping rules.
- New pages, new form fields, changes to how checkout works.
- Shipping carriers and services, or the address parcels ship from.
- Sales tax registrations and rates.
- The wording of the automatic emails.
- Adding another person to the dashboard.
- Anything that involves a refund you can't complete in the dashboard or Stripe.
