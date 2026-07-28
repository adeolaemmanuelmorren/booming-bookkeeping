# Stripe Browser Purchase Confirmation Plan

## Goal

Fire browser-side `Order Completed` only after Stripe confirms a successful new purchase.

Use the Stripe Charge ID for browser and reverse-ETL deduplication:

```text
event_id = purchase_<stripe_charge_id>
```

## Validated data

Jitsu purchase payloads:

| Measurement | Result |
|---|---:|
| Browser purchase submissions inspected | 766 |
| Raw payloads containing a PaymentMethod ID | 504 |
| Top-level PaymentMethod IDs | 240 |

Browser submissions contain:

- `anonymous_id`
- email
- PaymentMethod ID
- submitted time
- checkout host

One observed customer made two purchases four minutes apart using the same PaymentMethod:

| Purchase | Amount |
|---|---:|
| Keyboard Rich Book | $7.95 |
| OTO: Top Tax Loopholes | $47.00 |

Each purchase had its own Stripe Charge ID.

## Route configuration

Maintain two centralized route lists.

### `POLL_ON_LOAD_ROUTES`

```text
boomingbookkeeping.com/confirmation-1
boomingbookkeeping.com/go-1
keyboardrichchallenge.com/vipconfirmation-1
keyboardrichchallenge.com/vipsteps-1
keyboardrichchallenge.com/vip-thanks-1
keyboardrichchallenge.com/vipsuccess-1
keyboardrich.com/oto-1-page-1
keyboardrich.com/oto-2-page-1
keyboardrich.com/receipt-1
keyboardrich.com/free-2
```

### `POLL_AFTER_SUBMIT_ROUTES`

Checkouts that begin polling immediately after finalized submission:

- `keyboardrich.com/yes-1`
- `keyboardrich.com/yes-2`
- `learn.boomingbookkeeping.com/offers/*/checkout`

Route matching supports hostname plus exact path or path pattern.

## Route validation

Immediate means the first page event for the same `anonymous_id` within ten minutes of `Order Completed`.

### Stripe-matched purchase submissions

| Checkout | Product | Immediate next page | Attempts | Share | Median |
|---|---|---|---:|---:|---:|
| `boomingbookkeeping.com/go-1` | Mentorship one-time payment | `boomingbookkeeping.com/confirmation-1` | 91 | 100% | 4 sec |
| `boomingbookkeeping.com/go-1` | Mentorship payment plans | `boomingbookkeeping.com/confirmation-1` | 21 | 100% | 8 sec |
| `keyboardrichchallenge.com/upgrade-1` | VIP | `keyboardrichchallenge.com/vipconfirmation-1` | 30 | 100% | 4 sec |
| `keyboardrichchallenge.com/vipfc-2` | VIP | `keyboardrichchallenge.com/vipsteps-1` | 148 | 100% | 4 sec |
| `keyboardrich.com/free-1` | Keyboard Rich Book | `keyboardrich.com/oto-1-page-1` | 8 | 100% | 4 sec |
| `keyboardrich.com/yes-1` | Mentorship deposit | No next page within ten minutes | 116 | 87.9% | — |
| `keyboardrich.com/yes-1` | Mentorship deposit | `boomingbookkeeping.com/go-1` | 9 | 6.8% | 150 sec |
| `keyboardrich.com/yes-1` | Mentorship deposit | `keyboardrich.com/yes-1` | 7 | 5.3% | 256 sec |
| `learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout` | Kajabi mentorship | No next page within ten minutes | 16 | 94.1% | — |
| `learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout` | Kajabi mentorship | Same checkout page | 1 | 5.9% | 82 sec |

### Additional observed route sequence

Older and OTO submissions without a browser PaymentMethod still showed this immediate sequence:

```text
keyboardrich.com/free-1
  → keyboardrich.com/oto-1-page-1
  → keyboardrich.com/oto-2-page-1
  → keyboardrich.com/receipt-1
```

Older VIP routes showed:

```text
keyboardrichchallenge.com/vip-1
  → keyboardrichchallenge.com/vip-thanks-1

keyboardrichchallenge.com/vipupgrade-1
  → keyboardrichchallenge.com/vipsuccess-1
```

One book submission went from `keyboardrich.com/free-1` to `keyboardrich.com/free-2`.

## Browser registration

After a finalized checkout submission, register:

```json
{
  "anonymous_id": "existing anonymous ID",
  "attempt": {
    "email": "person@example.com",
    "payment_method_id": "pm_123",
    "submitted_at": "2026-07-25T12:34:56Z"
  }
}
```

The Worker derives the Stripe account from the checkout host.

Multiple purchase attempts are appended under the same `anonymous_id`.

## Durable Object

Use one SQLite-backed Durable Object per `anonymous_id`:

```text
PURCHASE_STATE.getByName(anonymous_id)
```

Store:

```text
pending attempts:
  email
  payment_method_id
  submitted_at
  expires_at

delivered charges:
  charge_id
  delivered_at

poll control:
  next_stripe_check_at
```

At registration:

1. Store the pending attempt.
2. Extend the Durable Object expiration to approximately two hours.

Registration performs one Durable Object write.

## Stripe verification

For an active pending attempt:

1. List recent Charges from the correct Stripe account.
2. Restrict the creation window to the checkout attempt.
3. Match Charges by PaymentMethod ID and normalized email.
4. Retain successful new-order Charges.
5. Apply the existing Stripe product and repeat-payment rules.
6. Enrich newly discovered Charges with authoritative product, amount, currency and customer information.
7. Insert each new Charge ID into `delivered charges`.
8. Return only the Charge IDs inserted by this poll.

The lookup returns zero, one or multiple new Charges.

When the poll finds confirmed Charges, the polling cycle ends.

## Replay prevention

`charge_id` is unique in `delivered charges`.

Example:

```text
Stripe returns:
  ch_book
  ch_oto_1
  ch_oto_2

Delivered charges:
  ch_book
  ch_oto_1

Browser receives:
  ch_oto_2
```

The Durable Object inserts Charge IDs before returning them. Concurrent polls for the same `anonymous_id` therefore return each Charge once.

## Browser conversion

For every Charge returned by the Durable Object, fire:

```text
Order Completed
event_id = purchase_<stripe_charge_id>
```

### Event properties

```json
{
  "event_id": "purchase_ch_123",
  "order_id": "ch_123",
  "charge_id": "ch_123",
  "is_payment_confirmed": true,
  "payment_status": "succeeded",
  "completion_basis": "stripe_charge_confirmed",
  "product_id": "canonical product identifier",
  "product_name": "Authoritative Stripe product name",
  "products": [
    {
      "product_id": "canonical product identifier",
      "product_name": "Authoritative Stripe product name",
      "price": 47,
      "quantity": 1,
      "currency": "USD"
    }
  ],
  "value": 47,
  "total": 47,
  "currency": "USD",
  "email": "person@example.com",
  "name": "Customer Name",
  "phone": "+15555555555"
}
```

The confirmed Stripe Charge ID is used in all three places:

```text
event_id = purchase_ch_123
order_id = ch_123
charge_id = ch_123
```

### Event context

The existing browser tracking wrapper adds:

```json
{
  "page": {
    "referrer": "previous page URL or $direct",
    "title": "Current page title",
    "url": "Current page URL",
    "path": "/current-path",
    "search": "?current=query"
  },
  "traits": {
    "email": "person@example.com",
    "phone": "+15555555555",
    "first_name": "First",
    "last_name": "Last"
  },
  "attribution": {
    "utm_source": "source",
    "utm_medium": "medium",
    "utm_campaign": "campaign",
    "utm_term": "term",
    "utm_content": "content",
    "utm_id": "id",
    "gclid": "Google click ID",
    "fbclid": "Meta click ID",
    "fbc": "Meta click cookie",
    "fbp": "Meta browser cookie",
    "ttclid": "TikTok click ID",
    "ttp": "TikTok cookie",
    "msclkid": "Microsoft click ID",
    "uetvid": "Microsoft visitor ID",
    "uetsid": "Microsoft session ID"
  },
  "fb": {
    "content_ids": ["normalized canonical product name"],
    "content_name": "Authoritative Stripe product name",
    "content_type": "product",
    "value": 47,
    "currency": "USD"
  }
}
```

The Jitsu event envelope carries the existing `anonymous_id`, event name and browser timestamp.

The event uses the Stripe-returned:

- product
- amount
- currency
- Charge ID
- customer information

The browser adds its current attribution identifiers.

## Polling and cost controls

- Poll only from configured routes and finalized checkout submissions.
- Use bounded backoff between browser polls.
- Share `next_stripe_check_at` across all tabs and pages using the same `anonymous_id`.
- Request only Charges created within the pending-attempt window.
- Filter the returned Charges by PaymentMethod ID and normalized email.
- Enrich only previously unseen Charge IDs.
- Stop the polling cycle after confirmation or expiration.
- Delete expired Durable Object state with one cleanup alarm.

## Conversion rules

| Stripe result | Browser result |
|---|---|
| Successful new purchase | One `Order Completed` |
| Two successful purchases | Two events with different Charge IDs |
| Failed payment | No purchase event |
| Later installment | No new-order event |
| Subscription renewal | No new-order event |
| Previously delivered Charge | No repeated event |

## Definition of done

- Normal purchases fire once after Stripe confirmation.
- OTO purchases receive their own Charge-based event.
- Purchase 2 or 3 never replays an earlier Charge.
- Concurrent polling cannot return the same Charge twice.
- Browser and reverse ETL use the same `purchase_<stripe_charge_id>` event ID.
- Stripe supplies the authoritative product and payment values.
- Stripe reads remain time-bounded.
