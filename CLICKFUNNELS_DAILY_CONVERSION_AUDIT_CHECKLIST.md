# Daily ClickFunnels Conversion Audit Checklist

## Purpose

Run this audit every day before Meta receives these browser conversions. The audit verifies that registrations and checkout attempts are captured once, payments carry the identifiers required for browser/server deduplication, every important product is represented, and the signal remains safe to use for optimization.

The audit is observational. Do not submit a test lead or payment during the daily audit. Use synthetic transactions only after a tracking deployment or when the passive evidence is inconclusive.

## Audit Record

Record the following at the start of every run:

- Audit date and time:
- Auditor:
- Primary window: previous 24 complete hours
- Comparison window: trailing 7 days
- Jitsu workspace: `BBB Workspace` (`cmrodbdxf0017221itkku4a4o`)
- Jitsu incoming stream: `BBB` (`cmrq0k1lw00003b7wngvf3goe`)
- Warehouse dataset: `able-folio-499722.jitsu_data`
- Overall result: Green / Amber / Red
- Incidents or exclusions:

Use completed hours when possible so ingestion latency does not make the most recent hour look incomplete.

## Status Rules

- **Green:** All blocking checks pass. Non-blocking coverage changes are understood and documented.
- **Amber:** The signal is still arriving, but there is a contained quality issue or an unexplained coverage change. Investigate before changing Meta configuration.
- **Red:** Duplicates returned, eligible payments cannot be deduplicated, a core product has no browser coverage despite server-side sales, delivery is failing, or sensitive payment data appears. Do not attach or expand the Meta conversion mapping.

## 1. Jitsu Delivery and Freshness

- [ ] Confirm Jitsu has successful incoming events in the last 24 hours.
- [ ] Confirm `Form Submitted`, `Identify`, and `Order Completed` are present when corresponding business activity occurred.
- [ ] Confirm the latest event time is plausible relative to current traffic.
- [ ] Review Jitsu error and dead-letter records.
- [ ] Confirm the incoming success rate has not materially declined.
- [ ] Compare event volume by hostname with the trailing seven-day pattern:
  - `thebookkeepingchallenge.com`
  - `keyboardrichchallenge.com`
  - `keyboardrich.com`
  - `boomingbookkeeping.com`
- [ ] Investigate a zero-event hostname when the server-side sources show activity there.

**Pass:** No unexplained delivery gap, no sustained errors, and no server-confirmed activity missing entirely from Jitsu.

## 2. Duplicate Form Submissions

- [ ] Review all `Form Submitted` events from the last 24 hours.
- [ ] Group likely duplicates using:
  - the same form ID;
  - the same page path;
  - the same normalized email, phone, or anonymous ID;
  - timestamps within two seconds.
- [ ] Confirm there are no identical event pairs a few milliseconds apart.
- [ ] Spot-check challenge registrations from each active registration page or variation.
- [ ] Confirm one finalized registration produces one `Form Submitted` event.
- [ ] Confirm every submission with an email has a `form_submission_...` event ID.
- [ ] Confirm repeated submissions from the same email on the same Pacific date have the same event ID.
- [ ] Review `Identify` separately; repeated identity updates are allowed and are not covered by the conversion-event burst guard.
- [ ] Record the duplicate count and duplicate rate.

**Pass:** Zero duplicate `Form Submitted` events inside the two-second audit window.

The browser guard suppresses only identical repeats from the same form within one second. The audit uses two seconds to catch regressions or a second duplication source outside that guard.

## 3. Duplicate Checkout Attempts

- [ ] Review ClickFunnels `Order Completed` events where `submit_trigger = formdata`.
- [ ] Group events by `event_id` when present.
- [ ] For events without an event ID, check for the same form, page, product, identity, and timestamps within two seconds.
- [ ] Confirm repeated browser events for one checkout carry the same event ID.
- [ ] Report ClickFunnels and Kajabi separately.

**Pass:** Zero duplicate browser checkout-attempt events.

## 4. Missing Purchase Event IDs

- [ ] Filter ClickFunnels `Order Completed` events to `submit_trigger = formdata`.
- [ ] Count events with an empty or missing `event_id`.
- [ ] Review every missing-ID event by hostname, page path, form ID, product, and timestamp.
- [ ] Confirm the submitted form data contains a `pm_...` value in `purchase[stripe_customer_token]`.
- [ ] Confirm composite IDs use `deduplication_key_basis = email_product_payment_method_pacific_date`.
- [ ] When the composite fields are unavailable but a PaymentIntent is present, confirm the fallback uses:
  - `event_id = purchase_<payment_intent_id>`;
  - `deduplication_key_basis = stripe_payment_intent`.

**Pass:** Zero unexplained missing purchase event IDs on current ClickFunnels Stripe checkouts.

An event without either the composite ID or the PaymentIntent fallback cannot be deduplicated against the server copy.

## 5. Payment Coverage by Product

Compare successful server-side payments with browser `Order Completed` attempts. Report results separately for:

- [ ] VIP upgrade purchased
- [ ] Mentorship deposit paid
- [ ] Final mentorship payment completed
- [ ] Book purchased
- [ ] Any additional active checkout product
- [ ] Kajabi purchases
- [ ] Direct Stripe payment links or staff-assisted payments

For every product, record:

- successful server payments;
- eligible ClickFunnels browser payments;
- browser events with a matching deterministic purchase ID;
- matched coverage percentage;
- browser attempts with no successful payment;
- successful payments with no browser event;
- unknown or unclassified product IDs.

Use this coverage formula:

```text
matched eligible purchase event IDs / eligible successful server purchase event IDs
```

Do not count direct Stripe payment links, staff-entered payments, or other server-only flows as eligible browser misses. Report them separately.

**Daily pass:** No active product with server-side sales has zero eligible browser coverage.

**Pre-pixel gate:** At least 90% matched purchase-ID coverage over the trailing seven days for eligible ClickFunnels payments, every unexplained miss reviewed, and zero unknown product classifications. Low-volume products must also be reviewed over a trailing 30-day window.

## 6. Product Classification and Values

- [ ] Confirm every payment event has a recognized product ID or an explainable product name/page mapping.
- [ ] Confirm VIP events carry the expected price and `USD` currency.
- [ ] Confirm mentorship deposit and final-payment events are not confused with one another.
- [ ] Confirm book orders are not misclassified as challenge registrations or VIP upgrades.
- [ ] Confirm book product names contain every selected product in submitted product-ID order.
- [ ] Confirm book values equal the sum of the selected book, shipping, and audiobook products.
- [ ] Confirm registered one-click upsells contain the registry product, value, carried identity, `payment_method_id`, and deterministic event ID.
- [ ] Confirm product, value, currency, and page path agree with the server-side payment.
- [ ] Confirm no new ClickFunnels product has appeared without a documented conversion mapping.

**Pass:** Zero unknown products and zero incorrect conversion classifications.

## 7. Browser/Server Deduplication Readiness

- [ ] For every matched ClickFunnels payment, normalize email, Stripe product name, PaymentMethod ID, and Pacific purchase date exactly as documented.
- [ ] Reconstruct `purchase_<lowercase_sha256_hex(email|product|payment_method_id|purchase_date)>` from the server record.
- [ ] Confirm the reconstructed server ID exactly equals the browser `event_id`.
- [ ] Confirm the browser and server destinations will use the same Meta event name.
- [ ] Confirm one event ID never represents two different successful charges.
- [ ] Confirm server events are sent promptly enough to fall within Meta's deduplication window.
- [ ] Confirm repeat installment or renewal payments are not incorrectly emitted as new `Order Completed` conversions.

**Pass:** 100% event-ID agreement for matched eligible payments.

Registration currently has no event ID. Until that changes, do not send both browser and server registration copies to Meta under the same conversion event. Choose one source for the Meta registration signal.

## 8. Identity and Match Quality

- [ ] Confirm finalized events contain an email or phone when the form collected one.
- [ ] Confirm payment events retain name, email, and phone when available.
- [ ] Confirm `Identify` runs before the corresponding tracking event.
- [ ] Confirm `userId` becomes the normalized email when a valid email exists.
- [ ] Confirm `anonymousId` is present.
- [ ] Confirm browser user agent and request IP are available to the downstream server destination.
- [ ] Measure `_fbp` coverage.
- [ ] When `fbclid` is present, confirm `_fbc` is also normally present.
- [ ] Spot-check cross-domain journeys to confirm the same anonymous ID continues from registration to VIP checkout.

**Pass:** No unexplained loss of form identity, and cross-domain identity remains stable on sampled journeys.

Do not require `_fbc` for visitors who did not arrive from a Meta click.

## 9. Event Semantics

- [ ] Confirm browser ClickFunnels payments still state:
  - `completion_basis = checkout_form_submission`;
  - `is_payment_confirmed = false`;
  - `payment_status = submitted_unconfirmed`.
- [ ] Confirm the server Stripe event remains the authoritative payment-success record.
- [ ] Confirm the team still intentionally accepts a submitted checkout attempt as the browser-side Meta signal.
- [ ] Review the rate of browser attempts that never become successful payments.
- [ ] Investigate a sudden increase in unmatched attempts because it may indicate declines, checkout errors, or a capture problem.

**Pass:** The downstream Meta mapping matches the documented business meaning of the browser event.

## 10. Privacy and Payload Safety

- [ ] Confirm no card number, CVC/CVV, password, secret, nonce, or Stripe client secret appears in Jitsu properties.
- [ ] Confirm `purchase[stripe_customer_token]` contains only a Stripe `pm_...` PaymentMethod ID—not card data or a client secret.
- [ ] Review any newly appearing submitted fields before allowing them into downstream destinations.

**Pass:** Zero sensitive payment credentials in analytics.

## 11. Daily Summary

Record these figures every day:

| Metric | Last 24 hours | Trailing 7 days | Status |
| --- | ---: | ---: | --- |
| Form Submitted count |  |  |  |
| Duplicate Form Submitted count |  |  |  |
| ClickFunnels Order Completed count |  |  |  |
| Duplicate Order Completed count |  |  |  |
| Missing purchase event-ID count |  |  |  |
| Eligible successful server payments |  |  |  |
| Matched purchase event-ID count |  |  |  |
| Eligible payment coverage |  |  |  |
| Unknown product count |  |  |  |
| Jitsu delivery errors |  |  |  |

Add a product-level table:

| Product | Server successes | Eligible browser events | Matched event IDs | Coverage | Unexplained misses |
| --- | ---: | ---: | ---: | ---: | ---: |
| VIP upgrade |  |  |  |  |  |
| Mentorship deposit |  |  |  |  |  |
| Final payment |  |  |  |  |  |
| Book purchase |  |  |  |  |  |
| Other |  |  |  |  |  |

## 12. Escalation Rules

Mark the audit **Red** and pause new Meta conversion mappings when any of these occur:

- duplicate registrations or payments return;
- current Stripe checkout events lose their deterministic purchase event IDs;
- browser and server event IDs disagree;
- a core product has server sales but no eligible browser events;
- an unknown product is being sent as a conversion;
- Jitsu has a sustained ingestion failure;
- sensitive payment data appears;
- the event meaning no longer matches the Meta conversion mapping.

For every Amber or Red result, record the first affected timestamp, host, page, form, product, sample event identifiers, likely cause, owner, and next review time.

## Pre-Pixel Approval Gate

Do not attach the Meta pixel conversion mapping until all of the following are true:

- [ ] Seven consecutive daily audits completed
- [ ] Zero duplicate form submissions during that period
- [ ] Zero duplicate browser payment events during that period
- [ ] Zero unexplained missing purchase event IDs on current Stripe checkouts
- [ ] At least 90% trailing-seven-day eligible payment coverage overall
- [ ] Every core product observed or explicitly tested successfully
- [ ] 100% browser/server payment event-ID agreement on matched records
- [ ] Zero unknown product mappings
- [ ] Identity and cross-domain continuity spot checks passed
- [ ] No sensitive data detected
- [ ] Registration uses only one Meta delivery source while it has no event ID
- [ ] The team explicitly accepts checkout submission as the browser-side payment signal
