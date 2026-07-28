# Purchase / thank-you page warehouse audit

**Audit completed:** 2026-07-28 05:55:44 UTC
**Raw browser window:** 2026-06-22 17:17:51 through 2026-07-28 05:48:18 UTC
**Project:** `able-folio-499722`
**Code comparison:** `clickfunnels/src/purchase-confirmation.js` as read during the audit
**Scope:** Read-only BigQuery investigation. No Dataform, tracking, or production code was edited or deployed.

## Executive result

Four routes are confirmed omissions from `POLL_ON_LOAD_ROUTES`:

1. `keyboardrichchallenge.com/vip-thanks-2`
2. `keyboardrichchallenge.com/vipsteps-2`
3. `keyboardrich.com/oto-1-page-2`
4. `boomingbookkeeping.com/monthly-1`

Three lower-volume routes should be validated before being added:

1. `boomingbookkeeping.com/subscribe-1`
2. `boomingbookkeeping.com/register-2`
3. `boomingbookkeeping.com/info-2`

The supplied `/vip-thanks-2` example is valid. Exactly **23 of 23** successful `Keyboard Rich Challenge Basic VIP (View-only access to Q&A sessions)` charges on **2026-07-27 UTC** had `keyboardrichchallenge.com/vip-thanks-2` as the first browser page within 10 minutes. The broader raw-history result is larger: **177 of 408 charges (43.38%)** for that exact product reached `/vip-thanks-2` within 10 minutes; another **222 (54.41%)** reached the already-covered `/vip-thanks-1`.

The strongest newly discovered gap is `/vipsteps-2`: **535 successful charges** reached it within 10 minutes. The current polling array only contains `/vipsteps-1`.

## Source coverage

Only raw tables were queried. Dataform staging, marts, outputs, assertions, and reverse-ETL tables were not used.

| Raw source | Rows inspected | Actual event coverage | Purchase relevance |
|---|---:|---|---|
| `jitsu_data.Order Completed` | 1,012 | 2026-07-19 13:36:16–2026-07-28 04:46:10 | 771 `checkout_form_submission` signals and 241 one-to-one confirmed Stripe charge events |
| `jitsu_data.Form Submitted` | 7,688 | 2026-07-21 18:56:11–2026-07-28 05:32:25 | Zero purchase-class rows; all observed forms were lead/registration forms |
| `jitsu_data.pages` | 381,498 valid-window rows | 2026-07-19 02:50:16–2026-07-28 05:48:18 | Current page continuity; 10 timestamp anomalies were excluded |
| `jitsu_data.identifies` | 48,480 | 2026-07-19 02:50:16–2026-07-28 05:33:19 | Exact email-to-`anonymous_id` bridge when charge corroboration was needed |
| `jitsu_data.tracks` | 657,493 | Raw table history | Its only purchase-like name was `Order Completed`; the 1,012 rows duplicate the named event table and were not double-counted |
| `boom_domains.form_submitted` | 510 | 2026-06-22 17:36:57–2026-07-18 10:08:41 | 494 Kajabi checkout submissions for offer `v3WtGzPH`; 16 unrelated lead forms |
| `boom_domains.order_completed` | 13 | 2026-07-16 17:48:23–2026-07-18 22:35:57 | 13 unconfirmed Kajabi mentorship checkout signals |
| `boom_domains.pages` | 854,367 | 2026-06-22 17:17:51–2026-07-19 02:40:47 | Legacy page continuity |
| `boom_domains.identifies` | 954,753 | 2026-06-22 17:17:51–2026-07-19 02:40:47 | Legacy identity bridge |
| `boom_domains.tracks` | 1,381,885 | Raw table history | Its only purchase-like name was `order_completed`; the 13 rows duplicate the named event table |
| `stripe.charge` + `stripe.customer` | 4,214 successful ClickFunnels product charges | 2026-06-22–2026-07-28 | Raw success corroboration only; 4,129 (97.98%) mapped to an exact browser identity and 4,030 (95.63%) had a page within 24 hours |
| `stripe_kajabi.charge` and raw invoice/product tables | 594 successful subscription-creation charges | 2026-06-22–2026-07-28 | Raw Kajabi success corroboration; all resolved to `Booming Bookkeeping Mentorship Program`, 466 mapped to a browser identity, and 51 had a page within 24 hours |

The legacy page stream ended at 02:40:47 UTC on July 19 and Jitsu began at 02:50:16, a 9 minute 29 second cutover gap. There are **13,286 exact `anonymous_id` values present in both page sources**, which independently confirms migration continuity. Cross-domain transitions below also remain exact because the same `anonymous_id` appears on both hosts.

## Event interpretation

- The canonical browser audit contains **1,519 raw purchase-related event anchors**: 1,012 Jitsu `Order Completed`, 494 legacy checkout `form_submitted`, and 13 legacy `order_completed`.
- The 771 Jitsu and 507 legacy checkout signals are **submissions, not proven payments**. They remain useful for route discovery but are not called purchases unless a raw successful charge corroborates them.
- The 241 Jitsu rows with `completion_basis = 'stripe_charge_confirmed'`, `is_payment_confirmed = TRUE`, `payment_status = 'succeeded'`, and a unique `ch_...` ID are exact confirmed purchases.
- `tracks` copies were excluded from the event grain. Including them would double-count named event-table rows.
- “No page within 24 hours” means no instrumented page joined under the stated identity rule. It does **not** prove that no redirect occurred; tab closure, consent blocking, an uninstrumented destination, or an identity break can all produce the same result.

## Browser purchase page coverage

Coverage is cumulative: `10m` is the first page within 10 minutes, `30m` includes `10m`, and `24h` includes both. All joins in this section are exact `anonymous_id` joins.

### Checkout-submission signals

| Product / variant | Purchase-event page | Events | First page ≤10m | ≤30m | ≤24h | No page ≤24h |
|---|---|---:|---:|---:|---:|---:|
| Kajabi offer `v3WtGzPH`, current Jitsu | `learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout` | 229 | 48 (20.96%) | 48 (20.96%) | 67 (29.26%) | 162 (70.74%) |
| Kajabi offer `v3WtGzPH`, legacy form | same | 494 | 89 (18.02%) | 99 (20.04%) | 123 (24.90%) | 371 (75.10%) |
| Kajabi mentorship, legacy `order_completed` | same | 13 | 1 (7.69%) | 1 (7.69%) | 2 (15.38%) | 11 (84.62%) |
| Mentorship deposit, `4601807` | `keyboardrich.com/yes-1` | 139 | 20 (14.39%) | 25 (17.99%) | 41 (29.50%) | 98 (70.50%) |
| Mentorship deposit, `4916162` | `keyboardrich.com/onetime-1` | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 0 |
| Mentorship one-time, `4602782` | `boomingbookkeeping.com/go-1` | 117 | 117 (100%) | 117 (100%) | 117 (100%) | 0 |
| Mentorship 3 × $1,997, `4703813` | `boomingbookkeeping.com/go-1` | 15 | 15 (100%) | 15 (100%) | 15 (100%) | 0 |
| Mentorship 3 × $1,997 duplicate-name variant, `4602783` | `boomingbookkeeping.com/go-1` | 11 | 11 (100%) | 11 (100%) | 11 (100%) | 0 |
| Keyboard Rich Book, `4458112` | `keyboardrich.com/free-1` | 5 | 5 (100%) | 5 (100%) | 5 (100%) | 0 |
| Keyboard Rich Book + domestic shipping, `4458112` | `keyboardrich.com/free-1` | 4 | 4 (100%) | 4 (100%) | 4 (100%) | 0 |
| Challenge Basic VIP, `4707653` | `keyboardrichchallenge.com/vip-1` | 7 | 7 (100%) | 7 (100%) | 7 (100%) | 0 |
| VIP July 20, `4731256` | `keyboardrichchallenge.com/vipupgrade-1` | 9 | 9 (100%) | 9 (100%) | 9 (100%) | 0 |
| VIP July 27, `4723480` | `keyboardrichchallenge.com/upgrade-1` | 40 | 40 (100%) | 40 (100%) | 40 (100%) | 0 |
| VIP July 27, `5100523` | `keyboardrichchallenge.com/vipfc-2` | 189 | 189 (100%) | 189 (100%) | 189 (100%) | 0 |
| Product unavailable | `keyboardrich.com/oto-1-page-1` | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 0 |
| Product unavailable, `4470885` | `keyboardrich.com/oto-2-page-1` | 2 | 2 (100%) | 2 (100%) | 2 (100%) | 0 |
| Product unavailable | `keyboardrich.com/secondchance-2` | 2 | 2 (100%) | 2 (100%) | 2 (100%) | 0 |

### Confirmed Jitsu charge events

These events fire on the destination page itself. The “next page” statistics describe subsequent browsing, not the purchase redirect.

| Confirmed product | Event-fired page | Charges | Next page ≤10m | ≤30m | ≤24h | No page ≤24h |
|---|---|---:|---:|---:|---:|---:|
| Mentorship deposit | `boomingbookkeeping.com/go-1` | 24 | 16 (66.67%) | 16 (66.67%) | 19 (79.17%) | 5 (20.83%) |
| Mentorship one-time | `boomingbookkeeping.com/confirmation-1` | 19 | 0 | 3 (15.79%) | 6 (31.58%) | 13 (68.42%) |
| Mentorship 3 × $1,997 | `boomingbookkeeping.com/confirmation-1` | 5 | 0 | 0 | 1 (20.00%) | 4 (80.00%) |
| VIP July 27 | `keyboardrichchallenge.com/vipconfirmation-1` | 99 | 17 (17.17%) | 20 (20.20%) | 64 (64.65%) | 35 (35.35%) |
| VIP July 27 | `keyboardrichchallenge.com/vipsteps-1` | 61 | 9 (14.75%) | 10 (16.39%) | 32 (52.46%) | 29 (47.54%) |
| VIP August 3 | `keyboardrichchallenge.com/vipsteps-1` | 23 | 4 (17.39%) | 4 (17.39%) | 5 (21.74%) | 18 (78.26%) |
| VIP August 3 | `keyboardrichchallenge.com/vipsuccess-1` | 6 | 1 (16.67%) | 2 (33.33%) | 2 (33.33%) | 4 (66.67%) |
| Book + domestic shipping | `keyboardrich.com/oto-1-page-1` | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 0 |
| Book + shipping + audiobook | `keyboardrich.com/oto-1-page-1` | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 0 |
| 5-Day Challenge VIP Ticket | `keyboardrich.com/oto-2-page-1` | 1 | 1 (100%) | 1 (100%) | 1 (100%) | 0 |
| Top Tax Loopholes | `keyboardrich.com/receipt-1` | 1 | 0 | 1 (100%) | 1 (100%) | 0 |

## Immediate purchase-page → next-page transitions

This table shows every first-page transition within 10 minutes from a checkout-submission event. Same-page results are retained because they can represent a reload, validation failure, retry, or delayed redirect; they are not treated as successful purchases.

| Product / purchase page | First next page ≤10m | Count | % of that purchase page |
|---|---|---:|---:|
| Current Kajabi checkout | same checkout | 34 | 14.85% |
| Current Kajabi checkout | `boomingbookkeeping.com/monthly-1` | 14 | 6.11% |
| Legacy Kajabi checkout form | same checkout | 65 | 13.16% |
| Legacy Kajabi checkout form | `boomingbookkeeping.com/monthly-1` | 21 | 4.25% |
| Legacy Kajabi checkout form | `boomingbookkeeping.com/subscribe-1` | 2 | 0.40% |
| Legacy Kajabi checkout form | `boomingbookkeeping.com/register-2` | 1 | 0.20% |
| Legacy Kajabi `order_completed` | `boomingbookkeeping.com/subscribe-1` | 1 | 7.69% |
| Deposit / `keyboardrich.com/yes-1` | same page | 11 | 7.91% |
| Deposit / `keyboardrich.com/yes-1` | `boomingbookkeeping.com/go-1` | 9 | 6.47% |
| Deposit / `keyboardrich.com/onetime-1` | `boomingbookkeeping.com/go-1` | 1 | 100% |
| One-time / `boomingbookkeeping.com/go-1` | `boomingbookkeeping.com/confirmation-1` | 93 | 79.49% |
| One-time / `boomingbookkeeping.com/go-1` | same page | 24 | 20.51% |
| 3 × $1,997, `4703813` / `go-1` | `boomingbookkeeping.com/confirmation-1` | 15 | 100% |
| 3 × $1,997, `4602783` / `go-1` | `boomingbookkeeping.com/confirmation-1` | 6 | 54.55% |
| 3 × $1,997, `4602783` / `go-1` | same page | 5 | 45.45% |
| Book / `keyboardrich.com/free-1` | `keyboardrich.com/oto-1-page-1` | 5 | 100% |
| Book + shipping / `free-1` | `keyboardrich.com/oto-1-page-1` | 3 | 75.00% |
| Book + shipping / `free-1` | `keyboardrich.com/free-2` | 1 | 25.00% |
| Challenge Basic VIP / `vip-1` | `keyboardrichchallenge.com/vip-thanks-1` | 5 | 71.43% |
| Challenge Basic VIP / `vip-1` | same page | 2 | 28.57% |
| VIP July 20 / `vipupgrade-1` | `keyboardrichchallenge.com/vipsuccess-1` | 6 | 66.67% |
| VIP July 20 / `vipupgrade-1` | same page | 3 | 33.33% |
| VIP July 27 / `upgrade-1` | `keyboardrichchallenge.com/vipconfirmation-1` | 36 | 90.00% |
| VIP July 27 / `upgrade-1` | same page | 4 | 10.00% |
| VIP July 27 / `vipfc-2` | `keyboardrichchallenge.com/vipsteps-1` | 173 | 91.53% |
| VIP July 27 / `vipfc-2` | same page | 16 | 8.47% |
| Unknown / `oto-1-page-1` | `keyboardrich.com/oto-2-page-1` | 1 | 100% |
| Unknown `4470885` / `oto-2-page-1` | `keyboardrich.com/receipt-1` | 2 | 100% |
| Unknown / `secondchance-2` | same page | 2 | 100% |

Slow first pages were kept separate from redirects. The largest late-only groups were Kajabi checkout returns to the checkout or `/monthly-1`, and later browsing to webinar/challenge pages. They contribute to the 30-minute and 24-hour coverage table above but are not used to label a route a redirect unless successful-charge timing independently corroborates it.

## Successful-charge destination coverage

The raw main-account Stripe corroboration covered **4,214 successful ClickFunnels product charges**:

| Product variant | Charges | Page ≤10m | ≤30m | ≤24h | No page ≤24h |
|---|---:|---:|---:|---:|---:|
| Mentorship deposit | 729 | 526 (72.15%) | 611 (83.81%) | 650 (89.16%) | 79 (10.84%) |
| Mentorship one-time | 538 | 521 (96.84%) | 521 (96.84%) | 521 (96.84%) | 17 (3.16%) |
| Book + domestic shipping | 53 | 51 (96.23%) | 51 (96.23%) | 51 (96.23%) | 2 (3.77%) |
| Book + shipping + audiobook | 13 | 13 (100%) | 13 (100%) | 13 (100%) | 0 |
| Challenge Basic VIP | 408 | 399 (97.79%) | 399 (97.79%) | 399 (97.79%) | 9 (2.21%) |
| Top Tax Loopholes | 8 | 8 (100%) | 8 (100%) | 8 (100%) | 0 |
| 5-Day Challenge VIP Ticket variants | 8 | 8 (100%) | 8 (100%) | 8 (100%) | 0 |
| VIP June 22 | 129 | 62 (48.06%) | 62 (48.06%) | 62 (48.06%) | 67 (51.94%) |
| VIP June 29 | 348 | 345 (99.14%) | 345 (99.14%) | 347 (99.71%) | 1 (0.29%) |
| VIP July 6 | 488 | 486 (99.59%) | 486 (99.59%) | 486 (99.59%) | 2 (0.41%) |
| VIP July 13 | 494 | 491 (99.39%) | 491 (99.39%) | 492 (99.60%) | 2 (0.40%) |
| VIP July 20 | 513 | 507 (98.83%) | 507 (98.83%) | 509 (99.22%) | 4 (0.78%) |
| VIP July 27 | 456 | 453 (99.34%) | 453 (99.34%) | 455 (99.78%) | 1 (0.22%) |
| VIP August 3 | 29 | 29 (100%) | 29 (100%) | 29 (100%) | 0 |

The separate raw Kajabi account contributed 594 successful subscription-creation charges. Only 51 had an instrumented page within 24 hours: 10 within 10 minutes, 5 more by 30 minutes, and 36 more by 24 hours. This lower browser coverage is why Kajabi low-volume routes are classified conservatively.

## Confirmed missing polling routes

| Missing route | Exact evidence | Why confirmed |
|---|---|---|
| `keyboardrichchallenge.com/vip-thanks-2` | 177/408 Challenge Basic VIP charges (43.38%) reached it in 1–24 seconds; title was `Welcome to the Keyboard Rich Challenge!` | High-volume, exact normalized-email identity, charge-to-page timing, and purchase-like referrers. Includes the exact 23/23 July 27 example. |
| `keyboardrichchallenge.com/vipsteps-2` | 535 confirmed VIP charges within 10 minutes: 306/494 July 13 (61.94%), 227/348 June 29 (65.23%), and 2/488 July 6 (0.41%) | High-volume alternate VIP success route with the same `Welcome to the Keyboard Rich Challenge!` title. |
| `keyboardrich.com/oto-1-page-2` | 22 confirmed book charges within 10 minutes: 20/53 domestic-shipping orders (37.74%) and 2/13 audiobook bundles (15.38%) | Exact charge timing plus purchase-like referrers; title was `SPECIAL INVITATION`, identifying it as an alternate OTO page. |
| `boomingbookkeeping.com/monthly-1` | 21/494 legacy and 14/229 current Kajabi checkout signals reached it within 10 minutes; 5/594 raw successful Kajabi subscription-creation charges independently reached it within 10 minutes | Observed in both browser eras and independently corroborated by successful charges. The checkout wildcard only polls after submit on the checkout page; `/monthly-1` is not covered on load. |

## Likely missing routes requiring validation

| Route | Evidence | Reason not promoted to confirmed |
|---|---|---|
| `boomingbookkeeping.com/subscribe-1` | Two legacy checkout-form transitions and one legacy `order_completed` transition within 10 minutes; two successful Kajabi charges reached it within 10 minutes | Small sample; generic `Join Booming Bookkeeping Business` title. Confirm Kajabi success/redirect configuration. |
| `boomingbookkeeping.com/register-2` | One legacy checkout transition and one successful Kajabi charge within 10 minutes | Small sample and 406–409 second latency; title is a training registration page, so intentional later navigation is plausible. |
| `boomingbookkeeping.com/info-2` | Two successful mentorship deposit charges had it as the first page within 10 minutes, at 226–232 seconds | No corresponding checkout-event transition; it is a high-traffic sales page titled `Join Booming Bookkeeping Business`, so coincidence is plausible. |

`keyboardrichchallenge.com/vipfc-2`, `keyboardrichchallenge.com/upgrade-1`, `keyboardrichchallenge.com/vipupgrade-1`, `keyboardrichchallenge.com/vip-1`, `keyboardrich.com/free-1`, and `keyboardrich.com/yes-*` were observed as purchase-entry pages, not uncovered post-purchase destinations. They should not be added to `POLL_ON_LOAD_ROUTES` based on this audit alone.

## Current polling-route usage

Every current `POLL_ON_LOAD_ROUTES` entry was observed in a purchase flow:

| Current on-load route | Evidence of use |
|---|---|
| `boomingbookkeeping.com/confirmation-1` | 520 confirmed one-time charges within 10 minutes, plus payment-plan and raw form transitions |
| `boomingbookkeeping.com/go-1` | 506 confirmed deposit charges within 10 minutes, plus deposit and mentorship transitions |
| `keyboardrichchallenge.com/vipconfirmation-1` | 449 confirmed VIP charge destinations across June 29, July 13, and July 27, plus current transitions |
| `keyboardrichchallenge.com/vipsteps-1` | 999 confirmed VIP charge destinations across July 6, July 20, July 27, and August 3 variants |
| `keyboardrichchallenge.com/vip-thanks-1` | 222 confirmed Challenge Basic VIP charge destinations and five raw checkout transitions |
| `keyboardrichchallenge.com/vipsuccess-1` | 387 confirmed VIP charge destinations plus current raw checkout transitions |
| `keyboardrich.com/oto-1-page-1` | 42 confirmed book destinations plus eight raw book transitions |
| `keyboardrich.com/oto-2-page-1` | Eight confirmed 5-Day Challenge VIP ticket destinations and one raw OTO transition |
| `keyboardrich.com/receipt-1` | Eight confirmed Top Tax Loopholes destinations plus two raw OTO transitions |
| `keyboardrich.com/free-2` | One exact raw book checkout transition; low volume but not unused |

For `POLL_AFTER_SUBMIT_ROUTES`:

- `keyboardrich.com/yes-1` is active: 139 raw checkout signals.
- `learn.boomingbookkeeping.com/offers/*/checkout` is active: 723 raw form-submit signals plus 13 legacy `order_completed` signals on `v3WtGzPH`.
- `keyboardrich.com/yes-2` had **zero captured checkout-submit signals** in the raw browser window. It appears unused as a submit trigger, although three deposit charges had `/yes-2` as their first page by 30 minutes. The observation window is too short to justify removal.

## Identity and confidence rules

1. Browser event → page transitions use exact `anonymous_id` only.
2. The page union spans both raw page tables, so an event before the migration can resolve to a Jitsu page after the migration if and only if the exact ID persists.
3. Stripe corroboration uses a normalized exact email from the raw charge/customer record to an exact email in raw identifies or purchase events, then an exact `anonymous_id` to pages.
4. No name similarity, approximate email, IP address, device fingerprint, or fuzzy match is used.
5. Email-bridged charge results are strong evidence of sequence, but they are labeled separately from exact anonymous-ID redirects because an email may map to more than one browser ID.
6. Query strings were used in the warehouse joins but are omitted from this report because they contain browser identifiers. Reported URLs preserve the exact scheme/host/path relevant to the polling matcher.

## Reproducible SQL methodology

The canonical browser transition query was:

```sql
WITH purchase_events AS (
  SELECT
    CONCAT('jitsu:', message_id) AS event_id,
    'jitsu_order_completed' AS source,
    completion_basis AS signal_type,
    COALESCE(NULLIF(product_name, ''), '(product unavailable)') AS product,
    COALESCE(NULLIF(product_id, ''), '(variant unavailable)') AS variant,
    anonymous_id,
    timestamp AS event_ts,
    COALESCE(NULLIF(page_url, ''), context_page_url) AS event_url
  FROM `able-folio-499722.jitsu_data.Order Completed`
  WHERE timestamp >= TIMESTAMP '2026-07-19'
    AND timestamp < TIMESTAMP '2026-07-29'

  UNION ALL

  SELECT
    CONCAT('segment-form:', id),
    'legacy_form_submitted',
    'checkout_form_submission',
    'Kajabi offer v3WtGzPH (product variant unavailable)',
    'v3WtGzPH',
    anonymous_id,
    timestamp,
    COALESCE(NULLIF(page_url, ''), context_page_url)
  FROM `able-folio-499722.boom_domains.form_submitted`
  WHERE _PARTITIONTIME >= TIMESTAMP '2026-06-22'
    AND _PARTITIONTIME < TIMESTAMP '2026-07-19'
    AND form_name = 'new_checkout_offer'
    AND (
      form_action = '/offers/v3WtGzPH/checkout'
      OR COALESCE(NULLIF(page_path, ''), context_page_path)
         = '/offers/v3WtGzPH/checkout'
    )

  UNION ALL

  SELECT
    CONCAT('segment-order:', event_id),
    'legacy_order_completed',
    'checkout_form_submission',
    COALESCE(NULLIF(product_name, ''), '(product unavailable)'),
    COALESCE(NULLIF(product_id, ''), '(variant unavailable)'),
    anonymous_id,
    timestamp,
    COALESCE(NULLIF(page_url, ''), context_page_url)
  FROM `able-folio-499722.boom_domains.order_completed`
  WHERE _PARTITIONTIME >= TIMESTAMP '2026-07-16'
    AND _PARTITIONTIME < TIMESTAMP '2026-07-19'
),
pageviews AS (
  SELECT
    CONCAT('jitsu:', message_id) AS page_id,
    anonymous_id,
    timestamp AS page_ts,
    url AS page_url
  FROM `able-folio-499722.jitsu_data.pages`
  WHERE timestamp >= TIMESTAMP '2026-06-22'
    AND timestamp < TIMESTAMP '2026-07-30'

  UNION ALL

  SELECT
    CONCAT('segment:', id),
    anonymous_id,
    timestamp,
    COALESCE(NULLIF(url, ''), context_page_url)
  FROM `able-folio-499722.boom_domains.pages`
  WHERE _PARTITIONTIME >= TIMESTAMP '2026-06-22'
    AND _PARTITIONTIME < TIMESTAMP '2026-07-20'
    AND timestamp >= TIMESTAMP '2026-06-22'
    AND timestamp < TIMESTAMP '2026-07-30'
),
first_next_page AS (
  SELECT
    events.*,
    ARRAY_AGG(
      IF(
        pages.page_id IS NULL,
        NULL,
        STRUCT(pages.page_ts, pages.page_url)
      )
      IGNORE NULLS
      ORDER BY pages.page_ts, pages.page_id
      LIMIT 1
    )[SAFE_OFFSET(0)] AS next_page
  FROM purchase_events AS events
  LEFT JOIN pageviews AS pages
    ON pages.anonymous_id = events.anonymous_id
   AND pages.page_ts > events.event_ts
   AND pages.page_ts <= TIMESTAMP_ADD(events.event_ts, INTERVAL 24 HOUR)
  GROUP BY ALL
)
SELECT
  source,
  signal_type,
  product,
  variant,
  LOWER(CONCAT(
    NET.HOST(event_url),
    COALESCE(
      NULLIF(REGEXP_EXTRACT(event_url, r'(?i)^https?://[^/]+([^?#]*)'), ''),
      '/'
    )
  )) AS purchase_route,
  LOWER(CONCAT(
    COALESCE(NET.HOST(next_page.page_url), '(no-next-page)'),
    CASE
      WHEN next_page.page_url IS NULL THEN ''
      ELSE COALESCE(
        NULLIF(
          REGEXP_EXTRACT(next_page.page_url, r'(?i)^https?://[^/]+([^?#]*)'),
          ''
        ),
        '/'
      )
    END
  )) AS next_route,
  CASE
    WHEN next_page.page_ts IS NULL THEN 'no page within 24h'
    WHEN TIMESTAMP_DIFF(next_page.page_ts, event_ts, SECOND) <= 600 THEN '0-10m'
    WHEN TIMESTAMP_DIFF(next_page.page_ts, event_ts, SECOND) <= 1800 THEN '10-30m'
    ELSE '30m-24h'
  END AS latency_bucket,
  COUNT(*) AS event_count
FROM first_next_page
GROUP BY ALL;
```

Successful-charge corroboration used the same `pageviews` CTE and:

```sql
WITH charges AS (
  SELECT
    charge.id AS charge_id,
    charge.created AS charge_ts,
    LOWER(TRIM(COALESCE(
      NULLIF(charge.billing_detail_email, ''),
      NULLIF(charge.receipt_email, ''),
      NULLIF(customer.email, ''),
      NULLIF(
        REGEXP_EXTRACT(
          charge.description,
          r'(?i)\|\s*([^| ]+@[^| ]+)\s*\|'
        ),
        ''
      )
    ))) AS email,
    REGEXP_EXTRACT(charge.description, r'(?i)Products?: (.*)$') AS product
  FROM `able-folio-499722.stripe.charge` AS charge
  LEFT JOIN `able-folio-499722.stripe.customer` AS customer
    ON customer.id = charge.customer_id
  WHERE charge.created >= TIMESTAMP '2026-06-22'
    AND charge.created < TIMESTAMP '2026-07-29'
    AND charge.paid IS TRUE
    AND charge.status = 'succeeded'
    AND REGEXP_CONTAINS(charge.description, r'(?i)Products?: ')
),
identity_map AS (
  SELECT DISTINCT LOWER(TRIM(email)) AS email, anonymous_id
  FROM `able-folio-499722.jitsu_data.identifies`
  WHERE timestamp >= TIMESTAMP '2026-07-19'
    AND timestamp < TIMESTAMP '2026-07-29'
    AND NULLIF(email, '') IS NOT NULL
    AND NULLIF(anonymous_id, '') IS NOT NULL

  UNION DISTINCT

  SELECT DISTINCT LOWER(TRIM(email)), anonymous_id
  FROM `able-folio-499722.jitsu_data.Order Completed`
  WHERE timestamp >= TIMESTAMP '2026-07-19'
    AND timestamp < TIMESTAMP '2026-07-29'
    AND NULLIF(email, '') IS NOT NULL
    AND NULLIF(anonymous_id, '') IS NOT NULL

  UNION DISTINCT

  SELECT DISTINCT LOWER(TRIM(context_traits_email)), anonymous_id
  FROM `able-folio-499722.jitsu_data.Order Completed`
  WHERE timestamp >= TIMESTAMP '2026-07-19'
    AND timestamp < TIMESTAMP '2026-07-29'
    AND NULLIF(context_traits_email, '') IS NOT NULL
    AND NULLIF(anonymous_id, '') IS NOT NULL

  UNION DISTINCT

  SELECT DISTINCT LOWER(TRIM(email)), anonymous_id
  FROM `able-folio-499722.boom_domains.identifies`
  WHERE _PARTITIONTIME >= TIMESTAMP '2026-06-22'
    AND _PARTITIONTIME < TIMESTAMP '2026-07-20'
    AND NULLIF(email, '') IS NOT NULL
    AND NULLIF(anonymous_id, '') IS NOT NULL

  UNION DISTINCT

  SELECT DISTINCT
    LOWER(TRIM(COALESCE(
      NULLIF(email, ''),
      NULLIF(extra_submitted_fields_checkout_offer_member_email, ''),
      NULLIF(context_traits_email, '')
    ))),
    anonymous_id
  FROM `able-folio-499722.boom_domains.form_submitted`
  WHERE _PARTITIONTIME >= TIMESTAMP '2026-06-22'
    AND _PARTITIONTIME < TIMESTAMP '2026-07-19'
    AND NULLIF(anonymous_id, '') IS NOT NULL
)
SELECT
  charges.product,
  pages.page_url,
  TIMESTAMP_DIFF(pages.page_ts, charges.charge_ts, SECOND) AS seconds_after_charge
FROM charges
JOIN identity_map USING (email)
JOIN pageviews AS pages
  ON pages.anonymous_id = identity_map.anonymous_id
 AND pages.page_ts > charges.charge_ts
 AND pages.page_ts <= TIMESTAMP_ADD(charges.charge_ts, INTERVAL 24 HOUR)
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY charges.charge_id
  ORDER BY pages.page_ts
) = 1;
```

For Kajabi, the charge CTE was changed to `stripe_kajabi.charge`, `stripe_kajabi.customer`, `description = 'Subscription creation'`, and product identity was verified through `invoice → invoice_line_item → price → product`. All 594 initial charges resolved to `Booming Bookkeeping Mentorship Program`.

All large browser-table reads used explicit timestamp or `_PARTITIONTIME` bounds and narrow column projections. Schema discovery and partition coverage used `INFORMATION_SCHEMA.COLUMNS` and `INFORMATION_SCHEMA.PARTITIONS`.
