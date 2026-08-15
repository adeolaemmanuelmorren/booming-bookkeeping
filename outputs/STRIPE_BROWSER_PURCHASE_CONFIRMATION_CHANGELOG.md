# Stripe Browser Purchase Confirmation Changelog

## August 11, 2026 — KRC free-registration Meta content type

- Added `content_type = krc-free` to browser and server-side KRC
  `CompleteRegistration` conversions.
- Webinar registrations and all purchase classifications remain unchanged.
- Kept the browser and Dataform classification rules explicitly aligned.
- All 123 Worker and browser tests passed; Dataform compiled all 109 actions.
- Published browser bundle SHA-256
  `c132dcaf2ae89c9ca67626e992a5566e28332d887bdbcaf753eefe4576f7b3c0`
  across all four production asset domains.
- Published Dataform commit `4660bf7` and completed a successful production
  full refresh from that exact commit.
- Warehouse validation returned 874,997 KRC rows with `krc-free` at both the
  top level and inside `payload`, and 51,218 webinar rows with both fields null.

## August 8, 2026 — Google purchase transaction IDs aligned

- Changed the browser GA4 ecommerce `transaction_id` to use the canonical
  purchase `event_id` (`purchase_<stripe_charge_id>`).
- This aligns future Google-tag purchases with the BigQuery additional data
  source, where `event_id` is mapped to Google Ads Transaction ID.
- Left the top-level event ID and every Meta property unchanged.
- All 122 Worker and browser tests passed.
- Published the browser bundle and verified SHA-256
  `d50ae793c51b61e07446e0de952b7cafad1c19f1e1577eea9f629ffe17a37cb5`
  across all four production asset domains.

## August 7, 2026 — High-ticket Meta content type

- Assigned `content_type = bbb-high-ticket` to main-Stripe mentorship deposit,
  full-payment, payment-plan, and exact `$4,997` installment purchases.
- Passed the already-known Stripe payment source through browser confirmation
  so the Kajabi subscription remains `content_type = product`.
- Kept the browser and Dataform classification paths explicitly aligned.
- All 122 Worker and browser tests passed.
- Deployed reverse-proxy Worker version
  `585a3155-f410-48a6-a04d-eac54ca9f0d0` and published browser bundle SHA-256
  `1a37c2061078f3d91660325d3a9852d3d64e9dd265b80e717c0c1319ff0c9a56`
  across all four production asset domains.
- Published Dataform commit `285641d` and completed a full production refresh
  from that exact revision.
- Production validation found 3,479 mentorship orders as `bbb-high-ticket`,
  1,507 Kajabi orders as `product`, 6,821 VIP orders as `krc-paid-vip`, and
  zero payload, event-ID, or missing-content-ID mismatches.

## July 30, 2026 — Fractional browser purchase values restored

- Changed raw Jitsu `Order Completed` columns `value`, `total`, and
  `context_fb_value` from integer-only fields to decimal-safe `NUMERIC` fields.
- Restored 19 affected events from Jitsu's preserved `_unmapped_data` payload.
- Confirmed all nine July 28–29 Keyboard Rich Book events now contain `$7.95`
  in all three value fields.
- The Worker already emitted the authoritative `$7.95`; no Worker logic,
  payment filtering, event-ID construction, or content-ID logic changed.

## July 27, 2026 — Dedicated attribution traits restored

### Implementation

- Ported the established profile-level attribution-event union into
  `int_attribution_traits`.
- Resolved dedicated `attr` events through the existing identifier lookup,
  preserving anonymous-ID-first profile resolution.
- Aggregated the first and last real FBP, FBC, UETSID, and UETVID values by
  each event's actual timestamp.
- Kept first-landing campaign and click attribution unchanged. FBP and FBC are
  not synthesized from `fbclid`.
- Kept IP address, user agent, and geo traits sourced from touchpoints only.
- Did not change browser tracking, Worker tracking, payment filtering, product
  resolution, or content-ID logic.

### Validation and refresh

- Compiled all 96 Dataform actions successfully.
- BigQuery dry-runs passed for `int_attribution_traits`, all four downstream
  SEGRETL tables, and their assertions.
- Fully refreshed `int_attribution_traits`, `segretl_form_submitted`,
  `segretl_first_conversions`, `segretl_repeatable_conversions`, and
  `segretl_order_completed`.
- All eight downstream uniqueness, required-field, product-filter,
  repeat-payment, and content-ID assertions passed.
- Confirmed
  `form_submission_6071a4a92fb5fd256f6aabca0bc937e65808fe15e1b56667157fa61b74bde0b6`
  now receives the real staged FBP
  `fb.1.1785065337096.493452404558837107.AQYCAQMB` and its matching real staged
  FBC from the July 26 11:28:57 attribution event.
- `segretl_form_submitted`: 10,775 rows gained FBP, 8,763 gained FBC, and
  7,998 gained both. All 904,080 event IDs and click-ID payloads were
  unchanged.
- `segretl_first_conversions`: 9,151 rows gained FBP, 8,015 gained FBC, and
  7,387 gained both. All 811,928 event IDs and click-ID payloads were
  unchanged.
- `segretl_repeatable_conversions`: 390 retained rows gained FBP, 422 gained
  FBC, and 203 gained both.
- The purchase refresh retained 11,287 rows with zero repeat-payment,
  product-case, product-ID, content-ID, `fb_content_ids`, or `fb_contents`
  changes. Two VIP events from April 29 aged out through the existing rolling
  90-day filter; no attribution or payment-filter logic removed them.
- Across 846,704 previously existing attribution profiles, zero IP,
  user-agent, or geo values changed.

## July 27, 2026 — SEGRETL product resolution simplified

- Added one generic Stripe product resolver using the browser proxy's priority:
  invoice lines, Checkout lines, `metadata.products`, then marked charge
  descriptions.
- SEGRETL no longer uses the legacy business-specific `product_rule` values.
- Added four small GTM-facing `product_case` values: `book`, `vip`,
  `mentorship`, and `kajabi`.
- Preserved the existing repeat-payment exclusion and charge-ID event IDs.

## July 27, 2026 — Meta product fields aligned

- Added `fb_content_ids` and `fb_contents` to browser `Order Completed`
  properties, so they are available in the `dataLayer.push` payload.
- Added matching `fb_content_ids` and `fb_contents` columns and payload fields
  to SEGRETL purchase conversions.
- Kept the existing `content_ids`, `contents`, and GA4 `ecommerce.items`
  fields unchanged.

This file records the implementation, validation, and deployment history for
`STRIPE_BROWSER_PURCHASE_CONFIRMATION_PLAN.md`.

## 2026-07-27

### Tracking housekeeping reference

- Added the root [`TRACKING_HOUSEKEEPING.md`](../TRACKING_HOUSEKEEPING.md)
  reference covering conversion IDs, browser/server mappings, polling routes,
  GTM triggers, GA4 objects, and enhanced-conversion user data.
- No GTM version was published as part of this documentation change.

### Kajabi data-layer listener follow-up

- Checked Jitsu after the July 27, 13:24 HST listener deployment.
- Jitsu recorded 24 Kajabi checkout page views from 18 visitors.
- Kajabi Stripe recorded five initial mentorship purchases in the same period.
- Four of those buyers had matching Jitsu identifies on the Kajabi checkout
  immediately before payment.
- Jitsu recorded zero `Kajabi Data Layer Purchase` events and zero Kajabi
  `Order Completed` events.
- Current evidence indicates that those real purchases did not produce a
  recognizable `purchase` entry in either monitored data layer.
- A live checkout test was attempted with coupon
  `ADEOLATESTCOUPON203049`, but Kajabi returned `Invalid coupon` and kept the
  total at $199/month, so no transaction was submitted.
- The checkout source does initialize `window.kajabiDataLayer` and sends its
  Kajabi Google tag through that named layer.

## 2026-07-25

### Planning and validation

- Finalized the pending-attempt design around the existing anonymous ID, email,
  Stripe payment method ID, and submission time.
- Removed Stripe customer ID and PaymentIntent ID as matching dependencies.
- Confirmed the browser event will use the Stripe charge ID:
  `event_id = purchase_<stripe_charge_id>`.
- Validated the known post-checkout routes from historical Jitsu events and
  documented the route evidence in the plan.

### Implementation

- Started auditing the existing browser tracking, reverse-proxy Worker, and
  Dataform Stripe classification models before modifying production behavior.
- Added the two centralized browser route lists from the approved plan.
- Replaced checkout-submission `Order Completed` events with small pending
  attempt registrations containing anonymous ID, email, payment method ID, and
  submission time.
- Removed the browser product-map dependency from one-click upsell detection;
  every finalized `upsell=1` submission now reuses the prior checkout identity
  while Stripe remains authoritative for the product.
- Added configured-route polling and confirmed `Order Completed` events using
  `event_id = purchase_<stripe_charge_id>`.
- Added a SQLite Durable Object per anonymous ID for pending attempts, shared
  Stripe polling control, and charge replay prevention.
- Excluded already-delivered Charge IDs before product enrichment and added a
  15-second in-flight Stripe lookup lease so concurrent tabs cannot duplicate
  Stripe reads while the first request is awaiting the API.
- Added time-bounded Stripe charge lookup, local payment-method/email matching,
  main/Kajabi account selection, product enrichment, and initial-vs-repeat
  payment filtering.
- Pinned Stripe requests to API version `2024-06-20` so the Charge, Invoice,
  subscription, and line-item fields used by the warehouse rules remain stable.
- Changed reverse-ETL purchase event IDs to `purchase_<charge_id>` so Meta can
  deduplicate browser and server events.
- Corrected subscription occurrence logic so only Stripe
  `billing_reason = 'subscription_create'` is a new order; cycle, update, later
  installment, and explicit balance payments are repeat payments even when
  earlier subscription history was not synced.

### Validation

- TypeScript compilation passes.
- The ClickFunnels/Kajabi browser bundle builds successfully.
- All 74 Worker and browser tests pass.
- Added coverage for two purchases on one payment method, Kajabi initial
  purchase handling, later-installment exclusion, Durable Object replay
  prevention, route matching, the minimal registration payload, and confirmed
  browser event fields.
- Audited browser purchase submissions from July 21 through July 25 in Pacific
  time against successful Stripe charges.
- Of 709 browser submissions, 522 matched 473 distinct successful Stripe
  charges; 187 had no successful Stripe match within 30 minutes.
- Match timing was one second at the median and 107 seconds at the 95th
  percentile. None of the matched Stripe rows was classified as a repeat
  payment.
- Confirmed the current server-side comma split corrupts the content ID for
  `Booming Bookkeeping Mentorship Program (3 payments of $1,997)` by splitting
  the price into two IDs. The five-day categorization treats the full product
  name as one content ID.

### Deployment

- Deployed the Worker and `PurchaseState` SQLite Durable Object migration.
- Current Cloudflare Worker version:
  `b0248e11-cb7b-4cb4-a9af-4cbccc1eb6ba`.
- Verified all four tracking domains route the new purchase endpoints.
- Verified live validation and credentialed CORS on
  `sg.keyboardrich.com/v1/purchase-attempts`.
- Installed both live Stripe API secrets:
  `STRIPE_SECRET_KEY` and `STRIPE_KAJABI_SECRET_KEY`.
- Verified the main and Kajabi Stripe connections independently with synthetic
  unmatched attempts. Both registrations returned `202`; both Stripe-backed
  polls returned `200` without producing a conversion.
- Published the confirmed-purchase browser bundle to the production
  `assets/cf-sh-seg` object.
- Verified the production asset byte-for-byte against the local build:
  SHA-256 `6a33aa137932f0793ac5261cb5d9636d6924ce618282854e2d204e60f9fb8d9c`.
- Updated 11,283 `segretl_repeatable_conversions` rows and 11,270
  `segretl_order_completed` rows in BigQuery to use the Stripe Charge ID.
- Reclassified 147 incomplete-history subscription rows as repeat payments in
  the Stripe intermediates, unified payment table, canonical payment mart, and
  attribution conversion output.
- Verified zero mismatches between `purchase_<charge_id>` and both the
  top-level and nested Meta payload event IDs in both tables.
- Verified zero subscription cycles treated as new orders, zero
  `subscription_create` charges treated as repeats, zero repeat payments in
  `segretl_order_completed`, and zero repeat payments marked as orders in the
  attribution output.
- The local Dataform project compiles successfully; its application-default
  token needs refreshing before the next CLI-managed run.

### Worker simplification and organization

- Reduced `src/index.ts` to the route overview and request dispatcher.
- Moved the existing Jitsu proxy, identity, attribution, and CORS behavior into
  `src/jitsu-proxy.ts` without changing its logic.
- Moved all Stripe purchase-confirmation code into `src/stripe/`:
  `routes.ts`, `confirmed-purchases.ts`, `purchase-state.ts`, and `types.ts`.
- Removed the hardcoded main-account and Kajabi product-name classifiers.
- Stripe products now come from available line items, then
  `charge.metadata.products`, then an explicitly labeled product description.
- Preserved commas inside prices such as `$1,997`, deduplicated repeated product
  names, and retained multiple products when Stripe supplies them.
- Added `content_ids` and `products` to confirmed browser purchases while
  retaining the existing scalar product fields for compatibility.
- Updated the browser and Meta event builder to use the Worker-confirmed
  `content_ids` unchanged.
- Preserved the Durable Object class, binding, shard key, SQLite schema,
  pending-attempt lifecycle, poll lease, replay protection, alarms, and
  migration history.

### Refactor validation and deployment

- All 77 Worker, Durable Object, and browser tests pass.
- TypeScript compilation, the browser production build, the Worker deployment
  dry run, and whitespace validation pass.
- Reviewed the active `PurchaseState` Durable Object against the required
  constructor and storage rules; its schema initialization remains idempotent
  inside `blockConcurrencyWhile`, and its per-anonymous-ID isolation is
  unchanged.
- Deployed Cloudflare Worker version
  `28e4121a-dfef-4538-a8d1-62d5f6710a9e`.
- Verified all four production tracking domains serve the Jitsu SDK and retain
  the expected route, method, content-type, CORS, and unknown-route behavior.
- Verified both main and Kajabi Stripe paths with synthetic unmatched attempts:
  registration returned `202`, polling returned `200`, and neither created a
  conversion.
- Confirmed the Jitsu and both Stripe secret bindings remain installed after
  deployment without reading their values.
- Published the browser bundle and verified it byte-for-byte against the local
  build: SHA-256
  `8f9ce85351e31abb45bed77227fae66d5589c069e8114a23b230d19adac686df`.
- This Worker-only refactor did not change the Dataform models. The previously
  identified server-side comma-splitting issue remains separate.

### Dataform content ID correction

- Updated `int_all_stripe_payments` so commas between digits are protected
  before a product list is split and restored before product normalization.
- Product names containing prices such as `$1,997`, `$5,991`, `$2,497`, and
  `$1,494` now remain one complete content ID.
- Did not change either Stripe payment-occurrence model or the
  `is_repeat_payment` and `payment_occurrence_type` rules.
- Rebuilt only the four models required to publish the corrected content IDs:
  `int_all_stripe_payments`, `mart_payments`,
  `segretl_repeatable_conversions`, and `segretl_order_completed`.
- Verified all 8,019 payment rows containing numeric commas; zero remain split.
- Verified zero content-ID differences between `int_all_stripe_payments` and
  `mart_payments`.
- The pre- and post-change payment-filter fingerprints match exactly for both
  `int_all_stripe_payments` and `mart_payments`: 314,959 payments, including
  98,405 repeat payments and 216,554 initial or one-time payments.
- Verified `segretl_order_completed` contains zero repeat payments, zero broken
  content IDs, and zero `purchase_<charge_id>` event-ID mismatches.
- Seven reverse-ETL rows naturally passed beyond the model's existing rolling
  90-day cutoff while the tables were rebuilt; no payment was reclassified.
- All focused model assertions pass except raw-source count parity. The raw
  Stripe tables currently contain 229 newly synced successful charges that are
  not yet in the previously built upstream Stripe intermediate tables; this
  pre-existing pipeline freshness gap was outside the scoped parser rebuild.

### Reverse ETL content ID alignment

- Removed the entire hardcoded product-to-content-ID mapping from
  `segretl_repeatable_conversions`.
- Reverse ETL now passes `mart_payments.content_ids` through unchanged to
  `content_ids`, `contents[].id`, and `payload.content_ids`.
- Rebuilt `segretl_repeatable_conversions` and `segretl_order_completed`.
- Verified all 11,276 repeatable-conversion rows: zero mart-to-Reverse-ETL
  content-ID mismatches, zero `contents` mismatches, zero nested payload
  mismatches, and zero event-ID mismatches.
- Verified all 11,263 Order Completed rows still use
  `purchase_<stripe_charge_id>` and contain zero repeat payments.
- All four focused Reverse ETL uniqueness and row-condition assertions pass.

### Browser Form Submitted repair

- Restored the missing `sendTrack` import in `clickfunnels/src/forms.js`.
- This repairs the browser `Form Submitted` call without changing hydration,
  ActiveCampaign submission, purchase confirmation, the Worker, or Dataform.
- All 77 Worker and browser tests pass.
- The browser static check no longer reports an undefined runtime function.
- Published the repaired `assets/cf-sh-seg` browser bundle on
  July 26, 2026 at 10:28 HST.
- Verified all four production asset domains serve the exact tested build:
  SHA-256
  `204d0324f6a0421bcff9a04ef146931ddd93f6602febf56abf6f5edbaeebec4b`.

### ActiveCampaign honeypot repair

- Traced the first contaminated test submission to July 21, 2026 at 20:58 HST,
  after the `formdata` hydration change was deployed at 20:02 HST.
- Confirmed the first real contaminated submission at 22:48 HST that evening.
- Confirmed the anonymous-ID selector was never broadened to `hpcheck`.
- Kept the required ClickFunnels `segment_anonymous_id` staging-field
  population unchanged.
- Added cleanup for browser state contaminated by the earlier deployment.
  `hpcheck` and ActiveCampaign field 31 are cleared only when their value
  exactly matches a current or legacy Segment/Jitsu identity.
- Ordinary honeypot values remain untouched.
- All 80 Worker, Durable Object, and browser tests pass.
- Published the repaired browser bundle on July 26, 2026 at 19:58 HST.
- Verified all four production asset domains serve the exact tested build:
  SHA-256
  `9bc06abcc4f53fee1d7db4375788f5a67772ef68af3b6877e3cd84c85c494fad`.

### Local honeypot investigation reset

- Removed the tracking-ID honeypot cleanup implementation and its focused
  tests locally so the underlying ClickFunnels behavior can be investigated
  without that intervention.
- Kept the earlier removal of submit-time hydration from the `formdata`
  tracking handler.
- All 78 remaining browser, Worker, and Durable Object tests pass.
- This local change has not been published.

### Segment-era investigation snapshot

- Preserved the last locally recoverable Segment browser source from commit
  `1cc776131402662d70e2b349c172c0136b1c4428` dated July 17, 2026 at 21:10 HST.
- Included the complete ClickFunnels source, corresponding Worker entry point,
  R2 publishing code, and a rebuilt reference `cf-sh-seg.js` bundle.
- Recorded the last Worker deployment before the Jitsu migration as version
  `6a05652c-590c-4586-a65f-91807959e69e`, created July 18 at 16:40 HST.
- Documented that the R2 browser object was overwritten in place, so the
  historical production object itself is not available for byte-level
  verification.

### ClickFunnels Garlic honeypot fix

- Changed ActiveCampaign field hydration to update DOM values silently without
  dispatching synthetic `input` or `change` events.
- Added a targeted purge for Garlic's shared
  `garlic:...>input.custom_type` localStorage key while preserving legitimate
  persisted fields such as `input.email`.
- Restored the known-tracking-ID honeypot guard for values Garlic may have
  already placed in the DOM before the browser bundle initializes.
- Kept `hydrateActiveCampaignForms()` out of the `formdata` handler.
- Added focused comments explaining the ClickFunnels/Garlic behavior.
- All 81 browser, Worker, and Durable Object tests pass.
- Built the browser bundle successfully with SHA-256
  `f8af3d4f66e50d1a0757b8527eb27373577704c22ea024856b0a43433e2db6d2`.
- Verified against the live challenge page using the local bundle:
  a seeded stale UUID was removed from `hpcheck` and the shared Garlic key,
  `segment_anonymous_id` received the current Jitsu ID, and the saved email
  Garlic value remained unchanged.
- Published the tested `cf-sh-seg` bundle on July 26, 2026 at approximately
  22:06 HST.
- Verified all four production asset domains serve the exact tested SHA-256
  `f8af3d4f66e50d1a0757b8527eb27373577704c22ea024856b0a43433e2db6d2`.
- Repeated the seeded-state check with the deployed production bundle:
  `hpcheck` was blank, the shared custom-type Garlic key was removed,
  `segment_anonymous_id` contained the current Jitsu ID, and the email Garlic
  value remained intact.
- Inspected the known Kajabi checkout at
  `learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout`. Its only form is
  `new_checkout_offer`; the page contains no ActiveCampaign `field[39]`,
  ClickFunnels `segment_anonymous_id`, or `hpcheck` field. The silent
  ActiveCampaign fill therefore has no target on this Kajabi checkout.
- No form was submitted during either browser verification.

### First post-deployment honeypot monitor

- Checked Jitsu's finalized ActiveCampaign form 20 payloads through July 27,
  2026 at 07:32 HST.
- Observed 718 submission events from 680 distinct email addresses after the
  deployment.
- Found one `hpcheck` value after the deployment. That browser loaded
  `/live-1` at July 26, 10:48 HST—more than eleven hours before the fix was
  deployed—and submitted the already-open page at July 27, 03:11 HST.
- The next 426 form 20 submissions, representing 407 distinct email
  addresses, contained zero `hpcheck` values.
- All 716 payloads containing ActiveCampaign `field[39]` matched the Jitsu
  event anonymous ID.

### Kajabi purchase data-layer diagnostic

- Added a diagnostic listener that runs only on
  `learn.boomingbookkeeping.com`.
- The listener checks both `kajabiDataLayer` and `dataLayer` for existing and
  newly pushed purchase events.
- Captured purchases are sent to Jitsu as `Kajabi Data Layer Purchase` with
  the complete payload in both `payload` and `payload_json`.
- Non-purchase data-layer entries are ignored.
- The listener preserves the original array contents and `push()` return
  behavior. It does not create an `Order Completed` event or change the
  existing Stripe purchase-confirmation logic.
- All 84 browser, Worker, and Durable Object tests pass.
- Published the tested `cf-sh-seg` browser bundle on July 27, 2026 at
  13:24 HST.
- Verified all four production asset domains serve the exact tested SHA-256
  `6b858685958939ac9ff08ea2c0508cc3fba946990fa5e3548b3249b72f5a71e9`.

### GA4 ecommerce data-layer payloads

- Added `ga4_event: "purchase"` and a GA4 ecommerce object to the existing
  browser `Order Completed` data-layer push.
- The GA4 `transaction_id` uses the raw Stripe Charge ID. Purchase items use
  the confirmed Stripe-backed product IDs and names already present on the
  browser event.
- Added `lead_source` to registration form properties and to the GA4 ecommerce
  object on the existing `Form Submitted` data-layer push.
- ActiveCampaign form 20 uses `lead_source: "krc"` and form 15 uses
  `lead_source: "webinar"`.
- No ecommerce-clearing push was added. Each conversion still makes one
  data-layer push.
- All 86 browser, Worker, and Durable Object tests pass.
- Published the tested `cf-sh-seg` browser bundle on July 27, 2026 at
  16:11 HST.
- Verified all four production asset domains serve the exact tested SHA-256
  `33cca4beab9c63cc9d3f001af356f43fdac2e4dc25895aa12b7754fd2a18453d`.

### GA4 payload-type separation

- Changed purchase events to use `ga4_event_type: "ecommerce"` with their
  parameters under the existing `ecommerce` object.
- Changed lead events to use `ga4_event_type: "standard_event"` with
  `lead_source` under a separate `standard_event` object.
- Removed `lead_source` from the lead event's ecommerce payload. Lead events
  no longer contain an `ecommerce` object.
- Kept `properties.lead_source` for the Jitsu event payload.
- No ecommerce-clearing push was added.
- All 86 browser, Worker, and Durable Object tests pass.
- Published the tested `cf-sh-seg` browser bundle on July 27, 2026 at
  17:40 HST.
- Verified all four production asset domains serve the exact tested SHA-256
  `8c24fd4e328a5ba0cd86d8cf94be8911661cfbef888216ee0ce831d6ef7b5650`.

### GA4 properties object correction

- Corrected the non-ecommerce object name from `standard_event` to
  `ga4_properties`.
- `standard_event` and `custom_event` now both use `ga4_properties`.
- `ecommerce` events continue to use the `ecommerce` object.
- All 86 browser, Worker, and Durable Object tests pass.
- Published the corrected `cf-sh-seg` browser bundle on July 27, 2026 at
  17:42 HST.
- Verified all four production asset domains serve the exact tested SHA-256
  `a09d158e895669ba34f80d001d20564eccc4905a10e94f8fcd095689409b485b`.

### Unified Stripe product resolution and full refresh

- Replaced the SEGRETL product-rule dependency with the same Stripe product
  resolution order used by the browser proxy: invoice lines, Checkout lines,
  `metadata.products`, then a marked charge description.
- Combined the main and Kajabi Stripe inputs in one resolver with
  `payment_source`; no parallel Kajabi product-resolution output was created.
- Removed five unnecessary Kajabi staging wrappers for Checkout Sessions,
  Checkout line items, prices, plans, and products. Their raw inputs are read
  inside the unified resolver.
- Added the four small SEGRETL routing cases used by GTM: `book`, `vip`,
  `mentorship`, and `kajabi`.
- Fully rebuilt `int_stripe_browser_product_resolution`,
  `segretl_repeatable_conversions`, and `segretl_order_completed`.
- Validated 11,289 Order Completed rows: unique event IDs, zero repeat
  payments, zero missing content IDs, and zero first-content-ID mismatches.

### Guarded mentorship invoice-description extraction

- Added a narrow condition to both the browser proxy and Dataform: extract text
  after `Product:` only when the line contains
  `Product: Booming Bookkeeping Mentorship Program`.
- Unrelated current and future invoice descriptions remain unchanged.
- The before/after warehouse comparison found 3,092 historical changes, all
  matching the guard, with zero unrelated changes.
- Fully refreshed the unified resolver and both SEGRETL purchase outputs.
- The current Order Completed output now contains 265 payment-plan purchases
  with the stable content ID
  `booming bookkeeping mentorship program (payment plan - 3 x $1,997 for a total of $5,991)`.
- Validated 11,289 orders with zero duplicate event IDs, repeat payments,
  missing content IDs, email-containing IDs, or unextracted mentorship IDs.
- All 88 browser, Worker, and Durable Object tests pass.
- Deployed Worker version `76c489a6-b8b1-475f-afc2-42fa2e8282f5`.

### Reverse ETL debug webhook logging

- Added seven exact `/webhook/debug/*` routes for purchase and form-submission
  Reverse ETL debugging.
- Each request writes one structured Worker log with the debug endpoint,
  receipt time, and posted conversion properties.
- Debug requests are not transformed or added to the webhook queue.
- All 21 marketing Worker tests pass.
- Live verification returned `200` and produced the expected structured log.
- Deployed marketing Worker version
  `9554a7eb-0194-4808-9917-dae6f874e88e`.

### Reverse ETL debug Durable Object storage

- Added the dedicated SQLite-backed `ReverseEtlDebugStore` Durable Object.
- After logging, each debug request is stored in a shard for its endpoint and
  UTC date.
- Stored records contain the endpoint, receipt time, and complete posted
  properties JSON.
- Added an internal paginated read method without exposing customer properties
  through a public HTTP endpoint.
- All 21 marketing Worker tests pass.
- Live verification stored record `1` in the production `purchases-all` shard.
- Deployed marketing Worker version
  `49ceddbb-dc60-4aee-8a2b-decf9b63091d`.

### Daily 12-hour conversion delivery audit

- Added an authenticated, paginated read endpoint for
  `ReverseEtlDebugStore`; unauthenticated reads return `401`.
- Verified the production endpoint can retrieve retained Reverse ETL event IDs.
- Updated the existing daily automation in place to report the six core
  conversions over one rolling 12-hour window ending at a shared BigQuery
  cutoff.
- The audit now appends two tables: Jitsu versus server, and server versus
  Reverse ETL Durable Object delivery, including counts, exact event-ID
  coverage, and content-ID alignment.
- Deployed marketing Worker version
  `26dded97-186a-4249-8876-00dd98e358fd`.

### Browser dataLayer anonymous ID

- Added the existing browser anonymous ID as the top-level `anonymous_id` on
  every dataLayer event generated by the browser bundle, including track,
  identify, and Cookiebot bootstrap events.
- Reused the existing `getAnonymousId()` cookie getter; no new identity
  storage or cookie was introduced.
- All 109 browser and reverse-proxy tests pass.
- Published the tested `cf-sh-seg` browser bundle on July 28, 2026 at
  approximately 14:14 HST.
- Verified all four production asset domains serve the exact tested SHA-256
  `eb213ed2092d0948fbd3606090fc64fa890b469637bd46f57409b00a1849da09`.

### Server conversion anonymous ID

- Added the latest pre-conversion `mart_touchpoints_all.anonymous_id` to the
  top level of the purchase and registration SEGRETL outputs.
- Reused the existing profile, session, touchpoint, and conversion-time
  matching; no new cookie or identity mechanism was added.
- Fully refreshed `segretl_repeatable_conversions`,
  `segretl_order_completed`, `segretl_first_conversions`, and
  `segretl_form_submitted`.
- Validated zero repeat-payment orders, missing purchase content IDs, or
  duplicate purchase/registration event IDs.
- Over the latest seven days, anonymous-ID coverage is 95.54% for purchases
  and 97.49% for registrations.

### Browser Stripe billing address

- Added Stripe `billing_details.address` to the existing confirmed-purchase
  response without adding another Stripe API request.
- Browser `Order Completed` events now include the address in both
  `properties.address` and normalized `traits.address`.
- The identify event fired immediately before the purchase also retains the
  address for subsequent browser events.
- All 109 browser and reverse-proxy tests pass.
- Deployed reverse-proxy Worker version
  `7a302e31-a5b9-4902-8668-c1ef0e862469`.
- Verified all four production asset domains serve browser bundle SHA-256
  `e0b65eee6a094f8d2557da88e587471c38cd50633b906f6378f824402b38b277`.

### Server payment address geographic fallbacks

- Added Stripe billing state as `address.region` for both Stripe accounts.
- Payment address city, region, and country now fall back to the existing
  first-known geographic traits when Stripe does not provide the corresponding
  value.
- Street and postal code remain Stripe-only because the attribution traits do
  not contain equivalent fields.
- Applied the same address contract at the top level and inside
  `payload.address`.
- Fully refreshed the payment chain and both purchase SEGRETL outputs.
- Validated zero repeat payments, missing content IDs, duplicate event IDs, or
  top-level/payload address mismatches.

### Conversion-time Meta FBC fallback

- Added `fbc_fbclid` to `mart_touchpoints_all` using Meta's
  `fb.1.<first-seen-milliseconds>.<fbclid>` format.
- The timestamp is the earliest warehouse observation of the exact fbclid, and
  the case-sensitive fbclid is preserved without modification.
- Added one conversion-ready `pre_conversion_fbc` field to purchase and
  registration SEGRETL outputs.
- It uses the latest real `_fbc` observed at or before the conversion, then
  falls back to the latest formatted `fbc_fbclid` from the same time window.
- Fully refreshed the touchpoint, payment, purchase, and registration outputs.
- Validated 837,453 distinct fbclids with zero format, timestamp, consistency,
  or fbclid-preservation errors.
- Validated zero pre-conversion selection mismatches, duplicate event IDs,
  repeat-payment orders, missing purchase content IDs, or incorrect purchase
  event IDs.

### Conversion-time Meta FBP

- Added `pre_conversion_fbp` to purchase and registration SEGRETL outputs.
- It selects the latest real `_fbp` observed at or before the conversion and
  remains null when no eligible browser `_fbp` exists.
- Fully refreshed the purchase and registration SEGRETL tables.
- Validated zero selection mismatches, malformed selected values, duplicate
  event IDs, repeat-payment orders, missing purchase content IDs, or incorrect
  purchase event IDs.

### Complete pre-conversion Meta attribution history

- Added `int_attribution_events` as the shared timestamped history for both
  website touchpoints and dedicated Jitsu attribution events.
- Purchase and registration `pre_conversion_fbc` and `pre_conversion_fbp`
  now select from that complete history at or before the conversion timestamp.
- Confirmed purchase `purchase_ch_3Ty0xUBf6i84vTZE0w3oMijY` now selects the
  `_fbp` observed at `2026-07-28 02:36:21 UTC`, before its
  `2026-07-28 02:41:32 UTC` conversion.
- Validated zero FBC/FBP selection mismatches, duplicate event IDs,
  repeat-payment orders, missing purchase content IDs, or incorrect purchase
  event IDs.
- Published the tested Dataform changes to `main` at commit `05eb9e7`.
- Moved production release compilation to minute 55 so the top-of-hour
  workflow executes the current release instead of the previous hour's stale
  compilation.

### Full-price custom installment checkout

- Classified an exact `$4,997` successful main-Stripe payment for the
  `booming bookkeeping installment` checkout product as a Mentorship order.
- Smaller custom installment amounts remain excluded from new-order
  conversions.
- Confirmed `ch_3TybfsBf6i84vTZE1O4vhmMw` is included while the `$1,000` and
  `$2,948.05` payments remain excluded.
- Validated zero duplicate event IDs, repeat-payment orders, missing content
  IDs, or incorrect purchase event IDs.
- Published Dataform commit `7890f2e` to production `main`.

### Stripe phone coverage

- Browser purchase confirmation now checks the already-returned Stripe charge
  and expanded customer for phone in this order: billing details, charge
  shipping, customer, then customer shipping.
- This adds no Stripe request and no additional storage.
- Browser data-layer purchase events expose the same normalized value as both
  `traits.phone` and `traits.phone_number`.
- All 58 targeted Stripe and browser tests passed.
- Deployed reverse-proxy Worker version
  `1770e34d-fe6e-4a44-99cd-5091ae4bf5ca` and republished `cf-sh-seg`.

### Browser phone normalization for Google enhanced conversions

- Added one shared E.164 phone normalizer for browser tracking.
- Both `phone` and `phone_number` now emit the same normalized value in
  data-layer, Jitsu track, and Jitsu identify payloads.
- Ten-digit US numbers receive the `+1` country code; international `00`
  prefixes are converted to `+`; spaces, parentheses, and dashes are removed.
- Phone values that cannot produce an 11-to-15-digit E.164 number are omitted
  rather than sent to Google as invalid enhanced-conversion data.
- All 111 reverse-proxy and browser tests pass.
- Published `cf-sh-seg` and verified the same SHA-256
  `94fb6792a7fdf7a8748f238aef0ed7c4da035eaac8f63b78eb9cf2cbd8a16955`
  from all four production asset domains.

### KRC Paid VIP Meta content type

- Added one maintainable product-content rule on both the browser and reverse
  ETL paths for the existing Meta `content_type = krc-paid-vip` conversion.
- The rule recognizes the four observed KRC Paid VIP content-ID families and
  does not depend on the `$47` amount, so coupons remain compatible and an
  unrelated `$47` product is not classified as VIP.
- Both implementations reference each other in code. The comments document
  that this custom `content_type` remains only because Meta already uses it for
  campaign and ad-set optimization; future rules should use `content_ids`.
- All 116 reverse-proxy and browser tests passed, and Dataform compiled all 97
  actions successfully.
- Published the browser bundle to production R2 and verified SHA-256
  `7c4113062f7dc4fd50710799163467f9cdee3dfce378d8579199b08dccf961d4`
  across all four first-party asset domains.
- Published Dataform production commit `7d99cd1`, then fully refreshed
  `segretl_repeatable_conversions` and `segretl_order_completed`.
- Production verification returned 6,587 VIP order rows with
  `content_type = krc-paid-vip`; all other conversion cases remain `product`.
