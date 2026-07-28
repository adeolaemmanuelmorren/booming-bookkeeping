# Browser and Server Conversion Audit

> **Rerun prompt**
>
> Populate a new audit snapshot from the raw browser events in both Jitsu
> datasets and the server events in the Reverse ETL BigQuery tables.
>
> - Browser forms: use the live raw union behind
>   `booming_data_analytics.stg_form_submissions_client_side`.
> - Browser purchases: use the live raw union behind
>   `booming_data_analytics.stg_order_completed`.
> - Server forms: use
>   `booming_data_analytics.segretl_form_submitted`.
> - Server purchases: use
>   `booming_data_analytics.segretl_order_completed`.
> - Discover additional server products from non-repeat orders in
>   `booming_data_analytics.mart_payments`, because the Reverse ETL Order
>   Completed model intentionally contains only configured main conversions.
> - Use the latest completed audit end below as the next start.
> - Set the new end to the most recent verified common source cutoff:
>   the minimum of the latest browser-form `received_at`, browser-purchase
>   `received_at`, ActiveCampaign `contact_tag._fivetran_synced`, main Stripe
>   `charge._fivetran_synced`, and Kajabi Stripe
>   `charge._fivetran_synced` timestamps.
> - Count distinct conversion event IDs, not warehouse rows.
> - Match browser and server events using the exact event ID.
> - Deduplicated percent is:
>   `matched browser event IDs / distinct browser event IDs`.
> - For matched purchases, compare the normalized, sorted `content_ids` arrays.
> - List only purchase `content_id` values that do not map to a conversion in
>   the main conversion table.
> - Do not repeat main products in either additional-product table.
> - If an order maps to a main conversion, exclude all of that order's line
>   items from the additional-product tables. Shipping, add-ons, and other
>   secondary line items inside a known main order are not additional products.
> - For every additional product, indicate whether that same ID appeared on
>   the other side.
> - Include both form registrations and purchases.
> - Append the new three-table snapshot. Do not replace earlier snapshots.
> - If the common source cutoff is not later than the latest completed audit
>   end, append an inconclusive attempt but do not advance that endpoint.
> - Update the latest completed audit end only after every required source is
>   fresh enough to complete the window.

**Latest completed audit end:** `2026-07-27 08:00:18 PDT`

## Interpretation rules

- A matched event ID is the event Meta can deduplicate.
- Forms use their canonical form-submission event ID.
- Purchases use `purchase_<stripe_charge_id>`.
- `100% (10/10)` means all ten browser events had an exact server match.
- `0% (0/10)` means none of the ten browser events had an exact server match.
- `—` means there were no browser events, so a percentage cannot be calculated.
- Content-ID alignment is only measurable when an exact purchase event ID exists
  on both sides.
- Repeat orders are included. Subscription renewals, later payment-plan
  collections, and other repeat payments are excluded from the server Order
  Completed source.

---

## Snapshot 1 — 2026-07-25 00:24 PDT through 2026-07-26 00:24 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 0 | 1,276 | 0.0% (0/1,276) | N/A — form |
| Form — Webinar registration | 0 | 0 | — | N/A — form |
| Purchase — Keyboard Rich Book | 0 | 3 | 0.0% (0/3) | Not testable — no matched IDs |
| Purchase — Top Tax Loopholes | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — KRC Basic VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 0 | 54 | 0.0% (0/54) | Not testable — no matched IDs |
| Purchase — Mentorship deposit | 0 | 17 | 0.0% (0/17) | Not testable — no matched IDs |
| Purchase — Mentorship full payment | 0 | 17 | 0.0% (0/17) | Not testable — no matched IDs |
| Purchase — Mentorship payment plan | 0 | 2 | 0.0% (0/2) | Not testable — no matched IDs |
| Purchase — Kajabi mentorship | 0 | 3 | 0.0% (0/3) | Not testable — no matched IDs |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| — | 0 | No additional browser products detected | — |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| — | 0 | No additional server products detected | — |

### Snapshot findings

- The raw browser sources contained 1,276 distinct KRC registration IDs and 96
  distinct classified purchase IDs.
- Neither Reverse ETL table contained a conversion timestamp inside this
  24-hour window. This means server capture, deduplication, and cross-side
  content-ID alignment cannot yet be validated for the period.
- All 96 browser purchase event IDs in the window used the older
  non-Charge-ID format. Zero used `purchase_ch_<stripe_charge_id>`.
- No additional products were detected. `Domestic shipping` appeared only as a
  secondary line item inside Keyboard Rich Book orders and is therefore
  excluded.
- The next snapshot should begin at `2026-07-26 00:24:00 PDT`.

---

## Inconclusive attempt 2 — 2026-07-26 00:24 PDT through 2026-07-26 01:20 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 0 | 0 | — | N/A — form |
| Form — Webinar registration | 0 | 0 | — | N/A — form |
| Purchase — Keyboard Rich Book | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Top Tax Loopholes | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — KRC Basic VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Mentorship deposit | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Mentorship full payment | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Mentorship payment plan | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Kajabi mentorship | 0 | 0 | — | Not testable — no matched IDs |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| — | 0 | No additional browser products detected | — |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| — | 0 | No additional server products detected | — |

### Source freshness

| Source | Latest available event or sync |
|---|---|
| Browser forms | 2026-07-25 22:46 PDT |
| Browser purchases | 2026-07-25 21:26 PDT |
| ActiveCampaign server sync | 2026-07-25 20:01 PDT |
| Main Stripe server sync | 2026-07-25 20:00 PDT |
| Kajabi Stripe server sync | 2026-07-25 20:00 PDT |

### Attempt findings

- No conversion was present inside the attempted 56-minute window.
- The server sources had not synced through the start of the window, so the
  zero server totals are inconclusive.
- The latest completed audit end remains `2026-07-26 00:24:00 PDT`. The next
  run must retry from that time rather than skipping this period.

---

## Snapshot 2 — 2026-07-26 00:24 PDT through 2026-07-26 08:00:10 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 414 | 1 | 0.0% (0/1) | N/A — form |
| Form — Webinar registration | 2 | 0 | — | N/A — form |
| Purchase — Keyboard Rich Book | 2 | 2 | 100.0% (2/2) | Yes — 2/2 matched IDs |
| Purchase — Top Tax Loopholes | 1 | 1 | 100.0% (1/1) | Yes — 1/1 matched IDs |
| Purchase — KRC Basic VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 15 | 15 | 100.0% (15/15) | Yes — 15/15 matched IDs |
| Purchase — Mentorship deposit | 4 | 4 | 75.0% (3/4) | Yes — 3/3 matched IDs |
| Purchase — Mentorship full payment | 3 | 3 | 100.0% (3/3) | Yes — 3/3 matched IDs |
| Purchase — Mentorship payment plan | 1 | 1 | 100.0% (1/1) | No — 0/1 matched IDs |
| Purchase — Kajabi mentorship | 0 | 0 | — | Not testable — no matched IDs |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| — | 0 | No additional browser products detected | — |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| `booming bookkeeping installment` | 1 | No main conversion mapping | No |

### Common source cutoff

| Required source | Verified available through |
|---|---|
| Browser forms | 2026-07-26 10:11:32 PDT |
| Browser purchases | 2026-07-26 12:46:00 PDT |
| ActiveCampaign server | 2026-07-26 08:00:21 PDT |
| Main Stripe server | 2026-07-26 08:00:15 PDT |
| Kajabi Stripe server | 2026-07-26 08:00:10 PDT |
| **Most recent common cutoff** | **2026-07-26 08:00:10 PDT** |

### Snapshot findings

- The raw browser union contained 1 distinct registration ID and 26 distinct
  purchase IDs through the common source cutoff.
- Exact event-ID overlap was 0/1 for KRC registrations and 25/26 (96.2%) across
  purchases.
- All 25 browser purchase IDs using the
  `purchase_ch_<stripe_charge_id>` format matched the server. The one older
  hash-format mentorship-deposit ID did not match.
- Purchase content IDs aligned for 24 of the 25 exact-ID matches. The mismatch
  was `purchase_ch_3TxPEaBf6i84vTZE1RQdYCkF`: the browser sent `booming
  bookkeeping mentorship program (payment plan - 3 x $1,997 for a total of
  $5,991)`, while the server sent `booming bookkeeping mentorship program (3
  payments of $1,997)`.
- The server-only `booming bookkeeping installment` came from one non-repeat
  order that did not map to any main conversion and had no browser-side
  additional-product overlap.
- `Domestic shipping` and `keyboard rich audiobook` appeared only inside
  Keyboard Rich Book orders, so all of those secondary line items remain
  excluded from the additional-product tables.
- The latest completed audit end advances to `2026-07-26 08:00:10 PDT`.

---

## Inconclusive attempt 3 — 2026-07-26 00:24 PDT through 2026-07-26 12:03 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 414 | 2 | 0.0% (0/2) | N/A — form |
| Form — Webinar registration | 2 | 0 | — | N/A — form |
| Purchase — Keyboard Rich Book | 2 | 2 | 100.0% (2/2) | Yes — 2/2 matched IDs |
| Purchase — Top Tax Loopholes | 1 | 1 | 100.0% (1/1) | Yes — 1/1 matched IDs |
| Purchase — KRC Basic VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 15 | 31 | 48.4% (15/31) | Yes — 15/15 matched IDs |
| Purchase — Mentorship deposit | 4 | 9 | 33.3% (3/9) | Yes — 3/3 matched IDs |
| Purchase — Mentorship full payment | 3 | 6 | 50.0% (3/6) | Yes — 3/3 matched IDs |
| Purchase — Mentorship payment plan | 1 | 2 | 50.0% (1/2) | No — 0/1 matched IDs |
| Purchase — Kajabi mentorship | 0 | 0 | — | Not testable — no matched IDs |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| — | 0 | No additional browser products detected | — |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| `booming bookkeeping installment` | 1 | No main conversion mapping | No |

### Source freshness

| Source | Latest available event or sync |
|---|---|
| Browser forms | 2026-07-26 10:11 PDT |
| Browser purchases | 2026-07-26 11:42 PDT |
| ActiveCampaign server sync | 2026-07-26 08:00 PDT |
| Main Stripe server sync | 2026-07-26 08:00 PDT |
| Kajabi Stripe server sync | 2026-07-26 08:00 PDT |

### Attempt findings

- None of the five required sources had synced through the attempted 12:03 PDT
  end, so all capture and alignment results above are provisional.
- The raw browser union contained 2 distinct registration IDs and 51 distinct
  purchase IDs. No browser event in the window was missing its conversion
  event ID.
- Exact event-ID overlap was 0/2 for KRC registrations and 25/51 across
  purchases. Of the browser purchase IDs, 49 used the new
  `purchase_ch_<stripe_charge_id>` format and 25 matched the server; the two
  older hash-format IDs did not match.
- Purchase content IDs aligned for 24 of the 25 exact-ID matches. The one
  regression was `purchase_ch_3TxPEaBf6i84vTZE1RQdYCkF`: the browser sent
  `booming bookkeeping mentorship program (payment plan - 3 x $1,997 for a
  total of $5,991)`, while the server sent `booming bookkeeping mentorship
  program (3 payments of $1,997)`.
- The server-only `booming bookkeeping installment` came from one non-repeat
  order that did not map to any main conversion. It had no browser-side
  additional-product overlap.
- `Domestic shipping` and `keyboard rich audiobook` appeared only as secondary
  line items inside Keyboard Rich Book orders and are excluded from both
  additional-product tables.
- The latest completed audit end remains `2026-07-26 00:24:00 PDT`. The next
  run must retry from that time rather than skipping this period.

### Supersession note

- This attempted-current-time window is retained for history but is superseded
  by Snapshot 2, which uses the most recent verified common Jitsu/Fivetran
  cutoff.
- The statement that all five sources were stale was inaccurate. Jitsu was
  available beyond the completed cutoff; the limiting watermark was Kajabi
  Stripe at `2026-07-26 08:00:10 PDT`.
- The authoritative latest completed audit end is
  `2026-07-26 08:00:10 PDT`, and the next run must start there.

### Form-capture diagnostic

- The `Browser captured` form total counts only distinct event IDs in the raw
  Jitsu `Form Submitted` union. It does not count `Identify` calls as form
  conversions.
- All 414 server KRC registrations had a matching Jitsu `Identify` call within
  60 seconds of the ActiveCampaign registration timestamp, typically 7–9
  seconds earlier. All 414 Identify calls had an anonymous ID.
- Zero of those 414 registrants had a Jitsu `Form Submitted` row during the
  prior 90 days. Only one unrelated KRC `Form Submitted` event landed inside
  the completed audit window.
- Of the 414 server registrations, 369 ActiveCampaign contacts were created
  within five minutes of the registration tag. This rules out a purely
  historical-contact bulk retag as the explanation.
- The correct interpretation is a browser `Form Submitted` conversion-event
  capture failure while browser identity capture remained operational. It
  does not mean only one registration occurred.

---

## Inconclusive attempt 4 — 2026-07-26 08:00:10 PDT through 2026-07-27 12:02:48 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 1,324 | 1,341 | 70.2% (941/1,341) | N/A — form |
| Form — Webinar registration | 0 | 1 | 0.0% (0/1) | N/A — form |
| Purchase — Keyboard Rich Book | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Top Tax Loopholes | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — KRC Basic VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 96 | 141 | 65.2% (92/141) | Yes — 92/92 matched IDs |
| Purchase — Mentorship deposit | 28 | 23 | 91.3% (21/23) | Yes — 21/21 matched IDs |
| Purchase — Mentorship full payment | 13 | 14 | 92.9% (13/14) | Yes — 13/13 matched IDs |
| Purchase — Mentorship payment plan | 4 | 3 | 100.0% (3/3) | No — 0/3 matched IDs |
| Purchase — Kajabi mentorship | 2 | 0 | — | Not testable — no matched IDs |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| — | 0 | No additional browser products detected | — |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| `booming bookkeeping installment` | 7 | No main conversion mapping | No |

### Source freshness

| Required source | Latest available event or sync |
|---|---|
| Browser forms | 2026-07-27 11:47:56 PDT |
| Browser purchases | 2026-07-27 11:28:05 PDT |
| ActiveCampaign server | 2026-07-27 08:00:49 PDT |
| Main Stripe server | 2026-07-27 08:00:21 PDT |
| Kajabi Stripe server | 2026-07-27 08:00:18 PDT |
| **Attempted window end** | **2026-07-27 12:02:48 PDT** |

### Attempt findings

- None of the five required sources had synced through the attempted end.
  Counts, overlap, and content alignment in this attempt are provisional.
- The browser form union contained 1,341 distinct canonical KRC event IDs.
  Exact KRC overlap was 941 IDs: 70.2% of browser IDs matched the available
  server source.
- Purchase overlap was 92/141 for Challenge VIP, 21/23 for mentorship
  deposits, 13/14 for mentorship full payments, and 3/3 for mentorship
  payment plans. The visible unmatched IDs may include conversions that had
  not reached the stale server sources by the attempted end.
- All exact-ID purchase matches aligned on content IDs except the three
  mentorship payment-plan matches. The browser used the long
  `Payment Plan - 3 x $1,997` name while the server used
  `3 payments of $1,997`.
- Two available Kajabi initial mentorship conversions had no browser event.
- Seven non-repeat `booming bookkeeping installment` orders did not map to
  any main conversion and had no browser-side additional-product overlap.
  No line item from a main-conversion order was included in either additional
  product table.
- The latest completed audit end remains `2026-07-26 08:00:10 PDT`. The next
  run must retry from that endpoint.

---

## Snapshot 3 — 2026-07-26 08:00:10 PDT through 2026-07-27 08:00:18 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 1,324 | 979 | 96.1% (941/979) | N/A — form |
| Form — Webinar registration | 0 | 1 | 0.0% (0/1) | N/A — form |
| Purchase — Keyboard Rich Book | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Top Tax Loopholes | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — KRC Basic VIP | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 96 | 92 | 100.0% (92/92) | Yes — 92/92 matched IDs |
| Purchase — Mentorship deposit | 28 | 23 | 91.3% (21/23) | Yes — 21/21 matched IDs |
| Purchase — Mentorship full payment | 13 | 13 | 100.0% (13/13) | Yes — 13/13 matched IDs |
| Purchase — Mentorship payment plan | 4 | 3 | 100.0% (3/3) | No — 0/3 matched IDs |
| Purchase — Kajabi mentorship | 2 | 0 | — | Not testable — no matched IDs |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| — | 0 | No additional browser products detected | — |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| `booming bookkeeping installment` | 7 | No main conversion mapping | No |

### Common source cutoff

| Required source | Verified available through |
|---|---|
| Browser forms | 2026-07-27 13:32:16 PDT |
| Browser purchases | 2026-07-27 12:56:59 PDT |
| ActiveCampaign server | 2026-07-27 08:00:49 PDT |
| Main Stripe server | 2026-07-27 08:00:21 PDT |
| Kajabi Stripe server | 2026-07-27 08:00:18 PDT |
| **Most recent common cutoff** | **2026-07-27 08:00:18 PDT** |

### Snapshot findings

- Exact event-ID overlap was 941/979 (96.1%) for browser KRC
  registrations. There were 383 server-only KRC registrations and 38
  browser-only KRC registrations in the verified window.
- Across the 131 browser purchase IDs, 129 (98.5%) had an exact server match.
  The two unmatched browser IDs were older hash-format mentorship-deposit
  IDs.
- Challenge VIP, mentorship full payment, and mentorship payment plan all had
  exact server matches for every browser event. Mentorship deposit matched
  21/23 browser events.
- Content IDs aligned for 126 of 129 matched purchases. The three mismatches
  were all mentorship payment-plan purchases: the browser used the long
  `Payment Plan - 3 x $1,997` name while the server used
  `3 payments of $1,997`.
- Two Kajabi mentorship purchases were present server-side with no browser
  Order Completed event.
- Seven non-repeat `booming bookkeeping installment` orders did not map to a
  main conversion and had no browser-side overlap.
- No line item from a main-conversion order was included in either additional
  product table.

---

## Snapshot 4 — INVALID: mixed-cutoff Dataform comparison

> Do not use this snapshot. It mixed browser data through 21:55 PDT with
> server data synced only through 20:00 PDT, and its counts came from Dataform
> models rather than a direct raw-source comparison. A raw Jitsu,
> ActiveCampaign, and Stripe common-cutoff audit supersedes it.

Window: 2026-07-27 09:55:58 PDT through 2026-07-27 21:55:58 PDT.
Counts are distinct event IDs. Deduplication is exact browser/server event-ID
overlap divided by browser IDs.

### Main conversion capture

| Main conversion | Server captured | Browser captured | Exact ID matches | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | 688 | 783 | 687 | 87.7% | N/A — form |
| Form — Webinar registration | 0 | 0 | 0 | — | N/A — form |
| Purchase — Keyboard Rich Book | 0 | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Top Tax Loopholes | 0 | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — KRC Basic VIP | 1 | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Keyboard Rich Challenge | 0 | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Challenge VIP | 65 | 55 | 49 | 89.1% | Yes — 49/49 matched IDs |
| Purchase — Mentorship deposit | 1 | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Mentorship full payment | 4 | 4 | 3 | 75.0% | Yes — 3/3 matched IDs |
| Purchase — Mentorship payment plan | 0 | 1 | 0 | 0.0% | Not testable — no matched IDs |
| Purchase — Kajabi mentorship | 20 | 0 | 0 | — | Not testable — no matched IDs |
| Purchase — Other main purchases | 0 | 0 | 0 | — | Not testable — no matched IDs |

### Source freshness

| Required source | Latest event | Latest ingestion or sync |
|---|---|---|
| Browser forms | 2026-07-27 21:47:42 PDT | 2026-07-27 21:47:41 PDT |
| Browser purchases | 2026-07-27 21:46:10 PDT | 2026-07-27 21:46:10 PDT |
| ActiveCampaign server | 2026-07-27 19:58:37 PDT | 2026-07-27 20:02:12 PDT |
| Main Stripe server | 2026-07-27 19:42:05 PDT | 2026-07-27 20:00:12 PDT |
| Kajabi Stripe server | 2026-07-27 19:49:38 PDT | 2026-07-27 20:00:17 PDT |
| **Window end** | **2026-07-27 21:55:58 PDT** | — |

### Snapshot findings

- Server sources lagged the browser by about two hours. Through the common
  20:00:12 PDT source cutoff, KRC registration overlap was 687/698 (98.4%)
  and Challenge VIP overlap was 49/49 (100%).
- All 52 exact-ID purchase pairs had aligned content IDs: 49 Challenge VIP
  and 3 mentorship full-payment events.
- The six unmatched browser Challenge VIP events occurred after the Stripe
  sync cutoff. The single unmatched browser payment-plan event also occurred
  after that cutoff.
- One browser mentorship full-payment event used the older hash event-ID
  format and was followed 19 minutes later by the same person's successful,
  charge-ID-based purchase. It is an extra browser event, not a deduplicable
  purchase.
- Main Stripe contained 16 Challenge VIP purchases, one KRC Basic VIP
  purchase, one mentorship deposit, and one mentorship full payment with no
  matching browser event.
- Kajabi Stripe contained 20 initial mentorship purchases and the browser
  contained zero matching Kajabi Order Completed events.
- Browser purchase event IDs were charge-based for 59/60 events. Server
  purchase event IDs were charge-based for 91/91 events.

---

## Snapshot 5 — direct SEGRETL-to-Jitsu rolling 12 hours

Window: 2026-07-27 10:49:49 PDT through 2026-07-27 22:49:49 PDT.

**Invalid comparison:** this snapshot used a rolling browser window after the
SEGRETL form source had stopped at 19:58 PDT. Use Snapshot 6 below.

This snapshot compares `segretl_form_submitted` and
`segretl_order_completed` directly with raw `jitsu_data` events. Counts are
distinct event IDs and deduplication is exact event-ID overlap divided by
browser IDs.

| Conversion | SEGRETL server | Jitsu browser | Exact ID matches | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---:|---|
| KRC registration | 589 | 717 | 588 | 82.0% | N/A — form |
| Webinar registration | 0 | 0 | 0 | — | N/A — form |
| Keyboard Rich Book | 0 | 0 | 0 | — | Not testable |
| Top Tax Loopholes | 0 | 0 | 0 | — | Not testable |
| Keyboard Rich Challenge | 0 | 0 | 0 | — | Not testable |
| VIP — all variants | 50 | 45 | 45 | 100.0% | Yes — 45/45 |
| Mentorship deposit | 1 | 0 | 0 | — | Not testable |
| Mentorship full payment | 3 | 4 | 3 | 75.0% | Yes — 3/3 |
| Mentorship payment plan | 1 | 1 | 1 | 100.0% | No — 0/1 |
| Kajabi mentorship | 14 | 0 | 0 | — | Not testable |
| Other purchases | 0 | 0 | 0 | — | Not testable |
| **All purchases** | **69** | **50** | **49** | **98.0%** | **48/49** |

### Freshness and findings

- Jitsu forms were current through 22:46 PDT. SEGRETL forms stopped at
  19:58 PDT. Through that server cutoff, KRC overlap was 588/602 (97.7%).
- Purchase sources were aligned through 21:46 PDT.
- All 45 browser VIP events matched SEGRETL exactly and aligned on content
  IDs. Five additional server VIP purchases had no browser event: four
  `Keyboard Rich Challenge Basic VIP` and one `KRC - Basic VIP`.
- Three confirmed mentorship full-payment browser events matched and aligned.
  The fourth browser event was the legacy declined, unconfirmed hash event.
- The payment-plan event ID matched exactly, but the content IDs differed:
  browser `Payment Plan - 3 x $1,997 for a total of $5,991`; server
  `3 payments of $1,997`.
- Fourteen initial Kajabi mentorship purchases had no browser event.

---

## Snapshot 6 — direct SEGRETL-to-Jitsu common-cutoff 12 hours

Window: 2026-07-27 07:58:37 PDT through 2026-07-27 19:58:37 PDT.

The end time is the latest timestamp shared by all four sources. Counts are
distinct event IDs. Deduplication is exact event-ID overlap divided by browser
event IDs.

| Conversion | SEGRETL server | Jitsu browser | Exact ID matches | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---:|---|
| KRC registration | 849 | 874 | 846 | 96.8% | N/A — form |
| Webinar registration | 0 | 0 | 0 | — | N/A — form |
| Keyboard Rich Book | 0 | 0 | 0 | — | Not testable |
| Top Tax Loopholes | 0 | 0 | 0 | — | Not testable |
| Keyboard Rich Challenge | 0 | 0 | 0 | — | Not testable |
| VIP — all variants | 101 | 77 | 77 | 100.0% | Yes — 77/77 |
| Mentorship deposit | 1 | 0 | 0 | — | Not testable |
| Mentorship full payment | 4 | 4 | 3 | 75.0% | Yes — 3/3 |
| Mentorship payment plan | 0 | 0 | 0 | — | Not testable |
| Kajabi mentorship | 20 | 0 | 0 | — | Not testable |
| Other purchases | 0 | 0 | 0 | — | Not testable |
| **All purchases** | **126** | **81** | **80** | **98.8%** | **Yes — 80/80 matched** |

### KRC registration gap

- 28 browser event IDs did not match a server event ID inside the window.
- 21 belong to emails with an earlier server-side KRC registration.
- 5 exact event IDs exist server-side before the window started.
- 2 have no KRC server-side registration history.
- 3 server event IDs did not match a browser event ID inside the window: one
  exact browser ID is outside the window and two have no matching Jitsu event.

---

## Inconclusive attempt 5 — 2026-07-27 08:00:18 PDT through 2026-07-28 12:09:12 PDT

### Main conversion capture

| Main conversion | Server captured | Browser captured | Deduplicated | Content IDs aligned? |
|---|---:|---:|---:|---|
| Form — Keyboard Rich Challenge registration | Not calculated | Not calculated | Not calculated | N/A — form |
| Form — Webinar registration | Not calculated | Not calculated | Not calculated | N/A — form |
| Purchase — Keyboard Rich Book | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Top Tax Loopholes | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — KRC Basic VIP | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Keyboard Rich Challenge | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Challenge VIP | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Mentorship deposit | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Mentorship full payment | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Mentorship payment plan | Not calculated | Not calculated | Not calculated | Not calculated |
| Purchase — Kajabi mentorship | Not calculated | Not calculated | Not calculated | Not calculated |

### Additional products detected in the browser

| Browser `content_id` | Browser events | Main conversion mapping | Also detected on server? |
|---|---:|---|---|
| Not calculated | Not calculated | Warehouse query unavailable | Not calculated |

### Additional products detected on the server

| Server `content_id` | Server events | Main conversion mapping | Also detected in browser? |
|---|---:|---|---|
| Not calculated | Not calculated | Warehouse query unavailable | Not calculated |

### Source freshness

| Required source | Verification result |
|---|---|
| Browser forms | Not verified — BigQuery authentication unavailable |
| Browser purchases | Not verified — BigQuery authentication unavailable |
| ActiveCampaign server | Not verified — BigQuery authentication unavailable |
| Main Stripe server | Not verified — BigQuery authentication unavailable |
| Kajabi Stripe server | Not verified — BigQuery authentication unavailable |
| **Attempted window end** | **2026-07-28 12:09:12 PDT** |

### Attempt findings

- BigQuery could not refresh the expired credentials for
  `adeola@datastacklabs.com` in a non-interactive run. An existing alternate
  service-account credential could create a query job in its own project but
  did not have permission to read the Boom warehouse.
- No source watermark, conversion count, exact event-ID overlap, content-ID
  alignment, additional-product classification, or cross-side overlap was
  inferred from older data.
- The additional-product tables intentionally contain no claimed products.
  Without live warehouse access, it was not possible to prove that an order
  was non-repeat, did not map to a main conversion, or was free of secondary
  line items from a main-conversion order.
- This attempt does not establish source freshness through the attempted end.
  The latest completed audit end remains `2026-07-27 08:00:18 PDT`, and the
  next run must retry the full window from that endpoint after Google Cloud
  authentication is restored.
- No warehouse data, tracking code, Dataform logic, or deployment was changed.
