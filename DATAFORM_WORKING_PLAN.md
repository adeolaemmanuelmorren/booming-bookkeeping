# Boom Bookkeeping Dataform Working Plan

Status: discovery complete. The shared client tracking bundle has been updated and deployed; Dataform models have not been implemented yet.

Last updated: 2026-07-15 (Pacific/Honolulu)

## Original request (verbatim)

> do you see the mymedicalhouse-dataform repo ? as well as the cuetime/dataform repo?
>
> I want you to implement the exact same thing in this repo.
>
> You have permission through gcloud to query this dataset able-folio-499722
>
> There are some differences here;
>
> - this business uses active campaign as the primary server side lead source capture. We use tags to determine a form submission; [KRC] RFC START - 07/20/26, [KRC] RFC START - 05/26/25, [CW] Registered for Webinar START are the primary tags it should be easy to extend this system to include multiple tags.
>   - With that said we do also capture form submissions on the client side from the segment dataset, so I'd like you to create twodifferent marts for form submissions, one for client side and server side so we can compare.
> - As you can see in the stg page view and even downstream in the pipelines in those other repo's there are a specific ad tracking templates for the url's that are depended on... I current;y don't know what the utm structure here is... you should figure that out first by looking at the pageviews...  they run google ads and facebook ads and tiktok ads. and maybe others as well... We currently only can join against google and facebook datasets for enriching for campaign adset ad name and id's... and the google and facebook data may still be syncing...
> - For payments this business uses stripe....
>   - This document breaks down how we can idenitfy the different product purchases. You need to model a clean mart_payments model based on this...
>   - you need to create staging models for each of the api objects that are involved. In staging you shouldnt do complex joins, you should just standardize columns and clean... in the intermediate you can join stripe objects
>   - essentially im asking you to follow the same pattern of modularity and model building we used in the other repo's
> - I believe we may also track order_completed events on the frontend... in the segment dataset... so for those we create a seperate pipeline in dataform and the final mart should be mart_payments_client_side
>
> Is all of this clear to you??
>
> Are there any questions you have before you start or gaps between my explanation and your understanding that without asking me questions you would have to make assumptions? Ideally you dont make assumptions so ideally we can iron this out before you start. Put my initial message in a working planning document, and will go back and forth.
>
> PLEASE PLEASE DO NOT OVERCOMPLICATE THINGS DO EXACTLY AS I SAY.
>
> then also look at the knyc-dataform folder in desktop/knyc    if you need to for modelling principles..
>
> Check out this document for notes and htings that the client said about his business as well.
> /Users/adeola/Boom Bookkeeping/outputs/STRIPE_PAYMENT_PRODUCT_IDENTIFICATION.md

## Reference repositories verified

- `/Users/adeola/mymedicalhouse-dataform`
- `/Users/adeola/cuetime/dataform`
- `/Users/adeola/Desktop/knyc/knyc-dataform`

The shared modeling pattern is:

```text
raw BigQuery sources
  -> definitions/sources/stg_*       clean, standardize, deduplicate, source-specific parsing
  -> definitions/intermediate/int_*  joins and reusable cross-object logic
  -> definitions/output/mart_*       final reporting contracts
```

Output marts should not join raw source objects directly. Shared URL/source helpers belong in `includes/`. Missing or still-syncing sources should use a stable empty-schema guard where necessary, following Cuetime's pattern.

## Requirements already understood and not open to reinterpretation

1. Build a modular Dataform project following the Medical House, Cuetime, and KNYC layer boundaries.
2. Keep server-side and client-side form submissions in separate marts so they can be compared.
3. Use ActiveCampaign tag assignments as the server-side form-submission events. The configured tag list must be easy to extend.
4. Keep server-side Stripe payments and client-side Segment payments in separate marts.
5. Stripe staging models clean one API object at a time. Stripe joins and product-resolution logic belong in intermediate models.
6. `mart_payments` uses successful Stripe charges as the canonical payment grain:
   - `charge.paid = TRUE`
   - `charge.status = 'succeeded'`
   - one row per `charge.id`
7. Do not double-count Payment Intents, invoices, subscriptions, Checkout Sessions, or Payment Links as additional payments.
8. Use product, price, line-item, plan, Payment Link, and description signals in the priority documented in `outputs/STRIPE_PAYMENT_PRODUCT_IDENTIFICATION.md`.
9. Use charge amount only as a supporting product-classification signal except where the documented rule explicitly requires it.
10. Enrich paid traffic only from the Google and Meta datasets currently available. Preserve other platform IDs and source labels without inventing enrichment.
11. Keep the implementation direct and readable. Do not add unrelated features.

## Current workspace state

`/Users/adeola/Boom Bookkeeping` is not currently a Dataform project. It has no `workflow_settings.yaml`, `definitions/`, or `includes/` directory. It also is not currently a Git repository at this directory level.

The location of the new Dataform project inside this workspace still needs confirmation.

## Verified BigQuery source inventory

Project: `able-folio-499722`

Relevant datasets currently visible:

- `boom_domains`: Segment-style `pages`, `identifies`, `tracks`, `form_submitted`, `attr`, and corresponding views.
- `activecampaign`: `contact`, `contact_tag`, `contact_list`, `contact_tracking_log`, `form`, `form_c_field`, and `list`.
- `stripe`: 59 raw Stripe tables, including the charge, customer, Checkout, invoice, subscription, product, price, discount, coupon, promotion, Payment Link, dispute, and credit-note objects.
- `google_ads`: campaign, ad-group, ad, and ad-stat tables.
- `facebook_ads`: campaign, ad-set, ad, creative, and performance tables.

There is currently no TikTok ads dataset.

## Verified paid URL templates

These rules come from the actual `able-folio-499722.boom_domains.pages` rows and were validated against the current Google and Meta entity tables.

### Meta

Observed paid sources include `fb`, `ig`, `facebook`, plus placement-like values such as `an`, `th`, and `msg`. They should normalize to `meta` when the row carries the Meta paid template or `fbclid`.

| URL field | Meaning |
|---|---|
| `utm_campaign` | campaign ID |
| `utm_id` | campaign ID (duplicates `utm_campaign`) |
| `utm_term` | ad set ID |
| `utm_content` | ad ID |
| `utm_medium` | normally `paid`, normalized to `cpc` |
| `fbclid` | Meta click ID |

Evidence:

- 534,678 paid Meta pageviews matched the observed template.
- All 534,678 joined to a current Meta campaign.
- 534,675 joined to a current Meta ad set.
- 534,664 joined to a current Meta ad.

### Google

Google traffic is primarily identified by `gclid`, `gbraid`, or `wbraid`, not by populated UTM fields.

| URL field | Meaning |
|---|---|
| `gc_id` | campaign ID |
| `h_ga_id` | ad group ID |
| `h_ad_id` | ad ID |
| `h_keyword_id` | keyword ID |
| `h_keyword` | keyword text |
| `gclid`, `gbraid`, `wbraid` | Google click IDs |

Evidence from 30,632 `gclid` pageviews:

- 30,022 contained `gc_id`; 30,019 currently join to Google campaign history.
- 6,296 contained `h_ga_id`; all 6,296 currently join to Google ad-group history.
- 6,710 contained `h_ad_id`; 6,401 currently join to Google ad history.
- 6,268 contained `h_keyword_id` and 6,267 contained `h_keyword`.
- Most of the remaining Google rows have campaign-only tracking, consistent with campaign types that do not provide keyword/ad parameters in the same way.

### TikTok and other traffic

- `ttclid` is present but rare in the current pageview history.
- No repeatable TikTok campaign/ad-group/ad UTM ID template is established by the current data.
- There is no TikTok ads dataset to enrich against.
- Taboola and other referral/source values exist and should remain normalized traffic dimensions without ad-entity enrichment.

The staging model should still retain `ttclid` and other known click IDs so later source data can be added without changing the pageview contract.

## Form-submission findings

### Server side: ActiveCampaign

The event source should be `activecampaign.contact_tag`, using:

- `contact_tag.id` as the source association/event ID.
- `contact_tag.contact` to join the contact.
- `contact_tag.tags` as the tag ID.
- `contact_tag.c_date` as the tag-assignment/form-submission timestamp.
- `activecampaign.contact` for normalized email, phone, and name.

The initially supplied tag names were:

- `[KRC] RFC START - 07/20/26`
- `[KRC] RFC START - 05/26/25`
- `[CW] Registered for Webinar START`

These were later found to be downstream automation-stage tags, not the actual
registration tags. See clarification round 6 for the corrected configuration.

Current blocker: the ActiveCampaign dataset has 4,379,904 contact-tag rows and 539 distinct tag IDs, but it does not currently expose the tag-definition table that maps tag IDs to tag names. KNYC's equivalent model relies on three source objects: contacts, contact-tag associations, and tags. The missing object needs to sync, or an explicit ID-to-name mapping must be supplied.

### Client side: Segment

`boom_domains.form_submitted` exists with 506 rows.

- 494 rows are submissions of Kajabi checkout form `new_checkout_offer` at `/offers/v3WtGzPH/checkout`.
- 12 rows are ActiveCampaign form `_form_20_` on `/access-1`, `/live-1`, `/live-2`, and `/krc-1`.

This makes the definition of the client-side form mart important: including every `form_submitted` row would make the mart overwhelmingly a checkout-form mart rather than a lead-form mart.

## Payment findings

### Server side: Stripe

The source document establishes one successful `charge.id` per payment as the grain. The initial object-level staging set implied by the documented product-resolution paths is:

- `stg_stripe_charges`
- `stg_stripe_customers`
- `stg_stripe_checkout_sessions`
- `stg_stripe_checkout_session_line_items`
- `stg_stripe_products`
- `stg_stripe_prices`
- `stg_stripe_invoices`
- `stg_stripe_invoice_line_items`
- `stg_stripe_subscription_items`
- `stg_stripe_subscription_history`
- `stg_stripe_payment_links`
- `stg_stripe_payment_link_line_items`

Discount explanation may additionally require narrow staging models for the relevant Checkout/invoice discount, coupon, and promotion-code associations. These should be added only where they contribute fields required by the agreed `mart_payments` contract.

The intermediate layer will resolve the best available product signal and attach it to the canonical successful charge without changing the charge grain.

### Client side: Segment

There is currently no `order_completed` table and no purchase/order/payment/checkout event in `boom_domains.tracks`.

The only track event names currently present are:

- `attr`
- `form_submitted`

Therefore `mart_payments_client_side` has no confirmed source event today. It must either be created as a guarded, stable empty-schema pipeline until the event appears, or pointed at another source/event location supplied by the owner.

The Kajabi checkout form submissions are not proof of processor-confirmed payment. Per the owner's later decision, they will still be represented as client-side `Order Completed` records with explicit unconfirmed-submission provenance.

## Proposed model boundaries (pending answers below)

```text
definitions/sources/
  segment/
    stg_page_views.sqlx
    stg_identifies.sqlx
    stg_form_submissions_client_side.sqlx
    stg_order_completed.sqlx                 # guarded if source remains absent
  activecampaign/
    stg_activecampaign_contacts.sqlx
    stg_activecampaign_contact_tags.sqlx
    stg_activecampaign_tags.sqlx             # requires source table or explicit mapping
  stripe/
    one stg model per required Stripe API object
  google_ads/
    normalized Google ad entities/performance
  facebook_ads/
    normalized Meta ad entities/performance

definitions/intermediate/
  sessionization and identity models following the reference repos
  int_activecampaign_form_submissions.sqlx
  int_stripe_payment_product_resolution.sqlx

definitions/output/
  funnel/mart_form_submissions_server_side.sqlx
  funnel/mart_form_submissions_client_side.sqlx
  payments/mart_payments.sqlx
  payments/mart_payments_client_side.sqlx
  touchpoint/ad/attribution outputs only to the extent confirmed below
```

Names can be adjusted before implementation, but the server/client separation will remain explicit.

## Questions requiring an answer before implementation

1. **Project location:** Should the Dataform project be created in `/Users/adeola/Boom Bookkeeping/dataform`, or should `workflow_settings.yaml`, `definitions/`, and `includes/` live directly at `/Users/adeola/Boom Bookkeeping`?

2. **Output configuration:** What should the default output dataset and reporting timezone be? A proposed default would be project `able-folio-499722`, dataset `dataform`, but I will not assume either the dataset name or business timezone.

3. **Overall scope:** By “the exact same thing,” do you want the full shared Medical House/Cuetime framework—page staging, identity resolution, sessions, touchpoints, ad performance, landing-page performance, customer marts, and attribution—plus the Boom-specific form/payment differences? Or should this first implementation include only pageviews/ad enrichment, the two form marts, the two payment marts, and their minimum dependencies?

4. **Missing ActiveCampaign tag names:** Will the ActiveCampaign tag-definition object be enabled in Fivetran, or should the first version use a supplied mapping of tag IDs to the three names? The extensible design should be name-based once the tag table exists.

5. **Server-side form event grain:** Should every matching contact-tag association be one form submission at `contact_tag.c_date`, including multiple configured tags applied to the same contact? This is the direct interpretation of the requirement.

6. **Client-side form inclusion:** Should `mart_form_submissions_client_side` include all 506 current Segment `form_submitted` events, or only lead forms? If only leads, should the 494 Kajabi checkout-form submissions be excluded while retaining the 12 ActiveCampaign form submissions?

7. **Absent client payment event:** Should I create the guarded `stg_order_completed` and `mart_payments_client_side` contracts now with zero rows until Segment begins sending the event, or is `order_completed` located in another dataset/source that has not yet been identified?

8. **Stripe mart coverage:** Should `mart_payments` contain every successful charge with unmatched payments labeled `unclassified`, or contain only charges that match one of the documented product rules? The safer financial fact pattern is every successful charge, with classification fields nullable/`unclassified`, but this needs explicit confirmation.

## Implementation hold

Implementation will begin only after the questions above are resolved or explicitly deferred. Discovery queries are read-only; no BigQuery source data has been changed.

## Clarification round 1 — 2026-07-15

Owner answers received:

1. The Dataform project will live at `/Users/adeola/Boom Bookkeeping/dataform`.
2. The requested output dataset name is `booming-data-analytics`, and the requested reporting timezone is Pacific time.
3. Build the entire relevant framework, after identifying which reference-repo components are not relevant to Boom Bookkeeping.
4. The missing ActiveCampaign tag-definition table will be added and will be named `tags`.
5. Each matching ActiveCampaign contact-tag association is one server-side form-submission event at `contact_tag.c_date`.
6. Include all current Segment `form_submitted` events, including the Kajabi checkout-form submissions.
7. The owner requested clarification about the absent `order_completed` event before deciding how to handle it.
8. `mart_payments` will include every successful Stripe charge. Charges not matched by the documented product rules will remain in the mart as `unclassified`.

### Output dataset naming issue to resolve

BigQuery dataset IDs cannot contain hyphens. The requested `booming-data-analytics` therefore cannot be used as the literal dataset ID. The closest valid dataset ID is `booming_data_analytics`.

For timezone-aware BigQuery date logic, the proposed value is `America/Los_Angeles`. This means Pacific Standard Time in winter and Pacific Daylight Time in summer. A fixed `PST`/UTC-8 timezone would produce incorrect local dates during daylight-saving time unless fixed UTC-8 is explicitly intended.

### Relevant full framework to include

The Boom implementation should include the parts of the Medical House/Cuetime framework that have a real Boom source or downstream purpose:

- Source declarations/guards and clean `stg_*` models.
- Segment pageview, attribution-parameter, identify, client form-submission, and future client order-completed staging.
- URL parsing, paid-source normalization, and known click-ID retention.
- Identity resolution across Segment, ActiveCampaign, and Stripe identifiers.
- Pageview sessionization.
- First, all, and last touchpoint marts.
- ActiveCampaign server-side form-submission pipeline.
- Segment client-side form-submission pipeline.
- Stripe server-side payment and product-classification pipeline.
- Segment client-side payment pipeline, once its source contract is settled.
- Google Ads and Meta staging plus a unified ad-performance mart.
- Customer mart based on the identifiers and source systems actually available.
- Stripe product-sales output derived from the classified payment mart.
- Multi-touch attribution and conversion/ad-performance outputs using the two form marts and two payment marts as distinct conversion sources.
- Landing-page performance using the session/touchpoint and conversion models.
- Active reverse-ETL outputs following the Medical House pattern: first-conversion payloads and repeatable payment-conversion payloads.
- Manual Stripe payment attribution, adapted from the Medical House manual-order pattern without any Shopify dependencies.

### Reference-repo components to leave out as not currently relevant

These will not be copied merely because they exist in a reference repo:

- Medical House source systems not used here: Unbounce, CallRail, Pipedrive, and Bing Ads.
- Cuetime source systems not used here: Webflow, LinkedIn Ads, Reddit Ads, and TikTok Ads performance tables.
- Cuetime ecommerce events that do not exist in Boom's Segment data: product viewed, add to cart, checkout started, and payment info submitted.
- KNYC source systems not used here: GoHighLevel, Klaviyo, Calendly, Shopify, and LinkedIn.
- KNYC multi-tenant organization/source registry logic. Boom is a single-company project.
- KNYC Airbyte load-stream loaders. Boom's raw sources already land in dedicated Fivetran/Segment datasets.
- KNYC conversion-delivery outbox and activation queue. No downstream delivery target was requested.
- Dashboard-specific recent-activity outputs that are not required by the attribution, forms, payments, customers, products, or landing-page contracts.

TikTok click IDs and normalized TikTok traffic will still be retained in pageviews/touchpoints. Only TikTok ad-performance staging and name enrichment are omitted until a TikTok ads dataset exists.

### Kajabi client-form evidence

The Kajabi identification is based on the raw Segment form fields, not on an inference from the row count:

- 494 of 506 `boom_domains.form_submitted` rows have host `learn.boomingbookkeeping.com`.
- Their page path is `/offers/v3WtGzPH/checkout`.
- Their `form_id` and `form_name` are both `new_checkout_offer`.
- Their form action is `/offers/v3WtGzPH/checkout` and method is `POST`.
- 467 explicitly record `payment_provider = 'stripe'` and `payment_method_type = 'card'`.
- The remaining 27 record card as the method but have a null payment-provider field.
- They were captured from 2026-06-27 through 2026-07-15 in the currently available data.

These rows prove that the Kajabi checkout form was submitted. They do not prove that Kajabi accepted payment. Per the owner's later decision, the client-side payment mart will include them as historical `Order Completed` records with `completion_basis = 'checkout_form_submission'`, `is_payment_confirmed = false`, and `payment_status = 'submitted_unconfirmed'`. Server-side Stripe remains authoritative for confirmed payment.

### What “absent order_completed” means

The current Segment warehouse dataset `able-folio-499722.boom_domains` contains only these base event tables:

- `attr`
- `form_submitted`
- `identifies`
- `pages`
- `tracks`
- `users`

The generic `tracks` table currently contains only two event names: `attr` and `form_submitted`. There is no `order_completed` table and no order, purchase, checkout, transaction, or payment event in `tracks`.

Therefore, there are currently zero confirmed client-side completed-order events available to model. This could mean the event has not fired, its Segment warehouse schema has not been created yet, or it is being sent to another source/dataset. The remaining decision is whether to create a guarded, zero-row `stg_order_completed` and `mart_payments_client_side` contract now so it begins populating when the source appears, or wait until the real event/table schema exists.

## Remaining confirmations after round 1

1. Confirm `booming_data_analytics` as the valid BigQuery dataset ID replacing `booming-data-analytics`.
2. Confirm `America/Los_Angeles` as the intended Pacific timezone, including normal PST/PDT daylight-saving behavior.
3. For the currently absent Segment `order_completed` source, choose between:
   - create the guarded, zero-row pipeline now and preserve its final schema until data arrives; or
   - omit the client-payment pipeline until the source event exists and can be modeled from its real schema.

## Clarification round 2 — 2026-07-15

Owner answers and corrections received:

1. Use `booming_data_analytics` as the valid BigQuery output dataset ID.
2. Use `America/Los_Angeles` for Pacific local-date logic with normal PST/PDT daylight-saving behavior.
3. Manual Shopify attribution is required and is restored to scope.
4. The active reverse-ETL outputs are required and are restored to scope.
5. Decide the absent `order_completed` handling after distinguishing checkout pageviews, checkout-form submissions, and completed payments.

### Checkout-form classification confirmed in the warehouse

The Segment form payload has explicit, repeatable checkout signals. All 494 Kajabi checkout-form rows have all of the following:

- `form_id = 'new_checkout_offer'`
- `form_name = 'new_checkout_offer'`
- a form action matching `/offers/{offer_id}/checkout`
- a page path matching `/offers/{offer_id}/checkout`
- `extra_submitted_fields_checkout_offer_payment_method_type`
- `extra_submitted_fields_checkout_offer_service_agreement`
- `event_id`

Additional coverage:

- 467 of 494 have `extra_submitted_fields_checkout_offer_payment_provider = 'stripe'`.
- 471 have `extra_submitted_fields_payment_type`.
- 425 have the checkout member email field.
- 423 have the checkout member name field.

The Dataform staging contract can therefore expose a direct `is_checkout_form` boolean and a readable `form_type` such as `checkout` or `lead`. The classification should use the structural form/action/checkout-field signals, not a hardcoded row list.

### What the repository tracking code does

`clickfunnels/src/forms.js` contains a separate ClickFunnels-specific checkout detector:

- It identifies payment forms from `purchase[...]` fields, selected products, and Stripe scripts.
- A detected payment form does not emit `Form Submitted`.
- It stores pending checkout context in browser `sessionStorage` under `boom_clickfunnels_pending_checkout`.
- It does not emit a completed-payment event, by design.

That ClickFunnels behavior is documented in `CLICKFUNNELS_FORM_TRACKING_NOTES.md` and prevents a checkout attempt from being mistaken for a successful payment.

The 494 Kajabi rows are a different form structure. They landed through Segment's form capture as `Form Submitted` with Kajabi's flattened `checkout_offer_*` fields. This is confirmed in BigQuery, so they are reliably distinguishable even though the ClickFunnels detector was not their source.

### Recommended client-side checkout funnel

The available data supports three distinct meanings:

1. **Checkout Started** — derive from the first qualifying checkout-page pageview per session.
2. **Payment Info Submitted / Checkout Submitted** — derive from a `form_submitted` row where `is_checkout_form = true`.
3. **Order Completed / client-side payment** — only from a real completed-order event or authoritative payment source.

For the main Kajabi checkout path, the warehouse currently contains:

- 1,254 checkout pageviews.
- 742 distinct anonymous visitors.
- 494 checkout-form submissions.

This supports a real checkout funnel without pretending that the 494 submission attempts are successful orders.

Proposed outputs:

- `mart_checkout_started_client_side`: one checkout start per session/path/offer, based on the checkout pageview.
- `mart_form_submissions_client_side`: all forms, with `is_checkout_form` and `form_type` retained.
- `mart_payment_info_submitted_client_side`: checkout-form submissions only.
- `mart_payments_client_side`: reserved for real `Order Completed` events; guarded/empty until that source exists unless another authoritative source is identified.

The Medical House reverse-ETL pattern has two active outputs that will be adapted rather than copied blindly:

- `segretl_first_conversions`: first form-submission payloads for resolved profiles. Call payloads will be omitted unless a Boom call source is added.
- `segretl_repeatable_conversions`: event-grain payment payloads from `mart_payments`, enriched with the latest eligible pre-conversion click IDs and attribution traits.

## Clarification round 3 — 2026-07-15

Correction from the owner:

- Boom Bookkeeping does not use Shopify.
- Do not add Shopify staging, Shopify marts, or Shopify-specific manual attribution.
- Manual attribution is required for Stripe payments.
- Reverse-ETL outputs remain in scope.

### Manual Stripe attribution scope

Adapt the Medical House manual-attribution pattern to the canonical Stripe payment grain:

- The corrected entity is a successful Stripe payment identified by `charge.id` / `payment_id`, not a Shopify order.
- Use an append-only manual link event table mapping `payment_id -> profile_id` with link/unlink actions and audit fields.
- Build a latest-active manual payment/profile link intermediate model.
- In `mart_payments`, the manual profile link wins before the automatically identity-resolved profile.
- Build attributed/unattributed Stripe payment status outputs.
- Build profile-search candidates from the relevant Boom sources: Segment identities/forms, ActiveCampaign contacts, and Stripe customers.
- Never merge a bad payment email/phone into the identity graph merely because a manual correction was made.

### Which checkout submissions are actually tracked as `form_submitted`

Current warehouse result:

- **Kajabi:** yes. There are 494 checkout submissions from `learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout`, explicitly marked by `new_checkout_offer` and `checkout_offer_*` fields.
- **ActiveCampaign forms:** 12 `form_submitted` rows exist, but they are lead-registration forms, not checkout forms.
- **Other checkout systems/pages:** no checkout submissions are present in `boom_domains.form_submitted`.

The repository explains the missing non-Kajabi checkout submissions. The ClickFunnels browser helper detects payment forms and intentionally does not send `Form Submitted`. It stores pending checkout context only in browser `sessionStorage`; that context is not sent to Segment and does not land in BigQuery. There is also no separate `Checkout Submitted`, `Payment Info Submitted`, or `Order Completed` event in the current Segment warehouse.

Therefore:

- Kajabi checkout submission attempts can be modeled from `form_submitted`.
- Other checkout starts can only be inferred from checkout-page pageviews today.
- Other checkout submissions cannot be modeled client-side from the current warehouse data.
- Successful client-side orders cannot be modeled until a real completed-order event/source exists.

### Checkout detection versus checkout event delivery

The ClickFunnels browser helper can detect a payment-form submission today, but detection and warehouse tracking are separate steps.

Current code path in `clickfunnels/src/forms.js`:

1. `isPaymentSubmission(form)` detects a checkout from `purchase[...]` fields, selected products, and Stripe scripts.
2. `buildPendingCheckoutProperties(...)` builds a non-payment-completion checkout payload.
3. `storePendingCheckout(...)` writes that payload only to `sessionStorage` under `boom_clickfunnels_pending_checkout`.
4. The handler returns without calling `sendTrack(...)`.

As a result, ClickFunnels checkout submissions are detectable in the browser but are not sent to Segment and do not land in BigQuery. Kajabi is different: its checkout form is being captured by Analytics.js as `Form Submitted`, which is why those 494 rows exist.

Owner decision: emit the detected ClickFunnels checkout submission as `Order Completed`.

The implementation must retain explicit provenance fields so the warehouse does not confuse the browser submission with a server-confirmed Stripe payment:

- `completion_basis = 'checkout_form_submission'`
- `is_payment_confirmed = false`
- `payment_status = 'submitted_unconfirmed'`

The local tracking helper now sends `Order Completed` from an actual checkout form `submit` event using the already-built safe checkout payload. It continues to store the same context in `sessionStorage`. Historical ClickFunnels checkout submissions cannot be reconstructed because those browser-only records were never delivered to the warehouse.

## Clarification round 4 — 2026-07-15

Owner decisions:

- Kajabi checkout submissions must emit `Order Completed`, not `Form Submitted`.
- A valid email entered in the checkout form must identify the Segment user.
- `mart_payments_client_side` must include both the historical Kajabi checkout rows that landed as `form_submitted` and the new native `Order Completed` rows.
- Publish the shared tracking change to the live hosted asset.

### Live tracking implementation

The live Kajabi checkout page was inspected directly. It loads the same shared bundle used by the ClickFunnels pages:

```text
https://assets.boomingbookkeeping.com/cf-sh-seg
```

The prior payment detector only recognized ClickFunnels `purchase[...]` fields. Kajabi uses `checkout_offer[...]`, so its `new_checkout_offer` form fell through to `Form Submitted`.

The shared bundle now:

- recognizes Kajabi `new_checkout_offer`, `.offer-checkout-form`, and `checkout_offer[...]` forms as checkout forms;
- emits `Order Completed` for those forms;
- extracts Kajabi offer ID, product name, displayed amount, and currency from the checkout markup;
- includes safe submitted email, name, phone, and non-sensitive extra fields;
- identifies a valid email on blur/change and guarantees identification again during form submit;
- retains `completion_basis = 'checkout_form_submission'`, `is_payment_confirmed = false`, and `payment_status = 'submitted_unconfirmed'`;
- continues to store the checkout context in session storage for same-tab continuity.

The bundle was built and uploaded to the existing Cloudflare R2 object `assets/cf-sh-seg`. A production fetch through `assets.boomingbookkeeping.com` confirmed that the served asset contains the Kajabi detector, `Order Completed`, the unconfirmed-payment provenance, and submit-time identify logic.

### Client-side payment union contract

`mart_payments_client_side` will union two source branches into one readable contract:

1. Historical Kajabi `form_submitted` rows structurally classified as checkout forms.
2. New Segment `Order Completed` rows produced by the deployed bundle.

Both branches will preserve their original event IDs and source-event names. Historical rows will be labeled `source_event_name = 'Form Submitted'` and `event_source = 'historical_kajabi_form_submitted'`; new rows will be labeled `source_event_name = 'Order Completed'` and `event_source = 'segment_order_completed'`. Both remain explicitly unconfirmed until reconciled to server-side Stripe.

The historical Kajabi rows contain email/name/contact and payment-method-type fields, but they do not contain product name, displayed amount, or revenue. Their checkout URL exposes offer slug `v3WtGzPH`. Owner decision: backfill these historical rows to the verified offer `Booming Bookkeeping Mentorship Program`, `$199 USD`, monthly. Preserve a field showing that this product/amount was inferred from the historical offer slug rather than captured in the original event.

The Segment staging model must retain safe reconciliation identifiers such as Stripe PaymentIntent/PaymentMethod IDs and PayPal payer/payment/order IDs. It must exclude actual credentials and authorization material such as card data, PayPal authorization tokens, authenticity/CSRF tokens, client secrets, passwords, and payment nonces.

## Clarification round 5 — 2026-07-15

Owner decisions and verified source changes:

- Backfill the 494 historical Kajabi checkout submissions to `Booming Bookkeeping Mentorship Program`, `$199 USD`, monthly, based on offer slug `v3WtGzPH`.
- The ActiveCampaign `tags` table is now synced.
- Keep every successful Stripe charge in `mart_payments`, but do not treat subscription renewals, later payment-plan installments, or explicit balance payments as new `Order Completed` conversions.

### Initial ActiveCampaign tag verification

The required tag rows are present and active in `able-folio-499722.activecampaign.tags`:

| Tag ID | Tag name |
|---|---|
| `137` | `[CW] Registered for Webinar START` |
| `416` | `[KRC] RFC START - 05/26/25` |
| `677` | `[KRC] RFC START - 07/20/26` |

The configuration remains name-based so future tags can be added without embedding source IDs in the business logic.

This initial configuration was superseded after the ActiveCampaign assignment
sequence showed that the `Registered` tags occur before the `RFC START`/`START`
tags and contain the actual registration population.

### Stripe repeat-payment flag

`mart_payments` remains one row per successful Stripe `charge.id` and includes all collected payments. Add three payment-occurrence fields:

- `is_repeat_payment`: `TRUE` for subscription renewals, later payment-plan installments, and explicit balance payments; otherwise `FALSE`.
- `payment_sequence_number`: the successful payment number within a real subscription/payment plan; null for independent one-time purchases.
- `payment_occurrence_type`: a readable value such as `one_time`, `initial`, `renewal`, `installment`, or `balance`.

Payment-series matching logic stays in the intermediate layer. Order Completed conversion outputs filter to `is_repeat_payment = FALSE`; a separate `is_order_completed` column is not added because it would duplicate the inverse of the repeat-payment flag.

Rules:

1. The first successful charge tied to a subscription or payment-plan series is the initial order payment and has `is_repeat_payment = FALSE`.
2. Later successful charges in the same subscription/payment-plan series have `is_repeat_payment = TRUE`.
3. For the documented `3 x $1,997` plan, installment one is the initial order; installments two and three are repeat payments.
4. The documented structured `$3,003` balance is a balance payment and is not a new order.
5. The `$997`/historical `$497` mentorship deposit is an initial order payment, not a repeat payment.
6. One-time book, VIP, and structured full-payment purchases remain eligible as new orders.
7. Revenue/payment reporting continues to use every successful charge. Only Order Completed conversion outputs and conversion-focused reverse ETL filter to `is_repeat_payment = FALSE`.

Sequence logic applies only within a real subscription/payment-plan relationship. A later independent one-time purchase by the same customer is a new order, not a repeat payment merely because the customer has purchased before.

## Implementation status — 2026-07-23

The approved Boom framework is implemented in:

```text
/Users/adeola/Boom Bookkeeping/dataform
```

The live BigQuery output dataset is:

```text
able-folio-499722.booming_data_analytics
```

The project uses `America/Los_Angeles` for Pacific-time business dates.

### Implemented model groups

- Segment page views, dedicated attribution events, identifies, forms, and Order Completed staging.
- ActiveCampaign contacts, tags, contact-tag assignments, and server-side form submissions.
- Original Stripe and Kajabi Stripe staging and intermediate payment enrichment.
- Product classification and payment occurrence logic.
- Unified server-side `mart_payments`.
- Separate client-side `mart_payments_client_side`.
- Separate client- and server-side form-submission marts.
- Checkout-start and payment-info-submitted client-side outputs.
- Identity resolution, sessions, first/all/last touchpoints, and attribution traits.
- Google Ads and Meta Ads staging and unified ad performance.
- Customer, product-sales, multi-touch attribution, acquisition-performance, and landing-page outputs.
- Append-only manual Stripe payment attribution and supporting status/search outputs.
- Warehouse reverse-ETL registration and Purchase outputs following `WAREHOUSE_CONVERSION_EVENT_SPEC.md`.

### Live validation results

| Check | Result |
|---|---:|
| Successful server-side payments | 314,664 |
| Original Stripe payments | 239,554 |
| Kajabi Stripe payments | 75,110 |
| Initial/one-time payments | 216,542 |
| Repeat payments | 98,122 |
| ActiveCampaign server form submissions | 67,496 |
| Distinct ActiveCampaign registration contacts | 67,302 |
| Segment client form submissions | 510 |
| Client-side payment events | 507 |
| Historical Kajabi checkout submissions in the client payment mart | 494 |
| Native Segment Order Completed events in the client payment mart | 13 |
| Inferred checkout-start events | 343 |
| Sessions | 733,890 |
| Touchpoints | 733,890 |
| Google/Meta ad-performance rows | 16,790 |
| Registration reverse-ETL events | 67,302 |
| Purchase reverse-ETL events in the 90-day output window | 10,115 |

All payment reconciliation, uniqueness, required-field, and payment-occurrence assertions pass.

An independent recomputation produced:

- zero registration event-ID mismatches;
- zero Purchase event-ID mismatches;
- zero disallowed renewal or later-installment rows in the Purchase output.

The 13 `mentorship_balance` rows remain `is_repeat_payment = TRUE` in `mart_payments` and are not counted as server-side Order Completed events. They are intentionally included as `Purchase` only in the warehouse reverse-ETL output because the later `WAREHOUSE_CONVERSION_EVENT_SPEC.md` explicitly identifies the one-time final balance as a platform Purchase conversion.

All 507 client-side payment records remain explicitly unconfirmed. The 494 historical Kajabi rows and 13 native browser Order Completed rows therefore cannot be mistaken for server-confirmed Stripe revenue.

## Clarification round 6 — 2026-07-23

The owner confirmed that the ActiveCampaign `Registered` tags—not the later
`RFC START`/`START` tags—represent server-side form submissions.

The configured registration tags are now:

| Tag ID | Tag name | Live submission rows |
|---|---|---:|
| `140` | `[CW] Registered for Webinar` | 51,138 |
| `415` | `[KRC] Registered for Challenge - 05/26/25` | 8,261 |
| `676` | `[KRC] Registered - 07/20/26` | 8,097 |

Total server-side ActiveCampaign form submissions: **67,496** across **67,302**
distinct contacts.

The dated July 2026 assignment sequence confirmed the distinction:

- `[KRC] Registered - 07/20/26` has 8,097 assignments.
- `[KRC] RFC START - 07/20/26` has only 415 assignments.
- 374 of those 415 received the dated `Registered` tag first.
- The median delay from the dated `Registered` tag to `RFC START` is about 11 minutes.

The server-side form mart, identity outputs, customer mart, attribution models,
landing-page outputs, and registration reverse-ETL table were rebuilt from the
corrected tags. All affected uniqueness and required-field assertions pass.

## Clarification round 7 — 2026-07-24

The owner approved separating challenge and webinar registrations with one
canonical `registration_type` shared by browser and warehouse events.

### Registration mapping

| Registration type | ActiveCampaign form ID | Server-side tag rules |
|---|---:|---|
| `krc` | `20` | Primary: tags beginning `[KRC] Registered for Challenge -` or `[KRC] Registered -`; fallback: exact tag `[KRC] Registered for Challenge` only when the contact has no primary KRC registration tag |
| `webinar` | `15` | Primary: exact tag `[CW] Registered for Webinar`; no fallback |

The browser reads the hidden ActiveCampaign `f`/`u` field. It does not infer the
registration type from the page URL.

The shared browser/server event ID is:

```text
form_submission_<sha256(lowercase_email|registration_type|Pacific_date)>
```

First conversions are selected per `profile_id + registration_type`, so a KRC
registration cannot suppress the same person's webinar registration.

### Live deployment and validation

- The browser tracking bundle was published to the existing R2 object
  `assets/cf-sh-seg`.
- A production fetch confirmed that the served asset contains both registration
  mappings and the new payload fields.
- The affected Dataform graph was rebuilt in
  `able-folio-499722.booming_data_analytics`.
- Every affected form and reverse-ETL uniqueness/required-field assertion passed.
- Stripe inputs and downstream outputs were refreshed after a sync-timing
  mismatch; all payment reconciliation and occurrence assertions passed.

| Live output | Registration type | Rows |
|---|---|---:|
| Server form mart, primary | `krc` | 845,372 |
| Server form mart, fallback | `krc` | 3,480 |
| Server form mart | `webinar` | 51,138 |
| Registration reverse ETL | `krc` | 756,988 |
| Registration reverse ETL | `webinar` | 51,138 |

All 899,990 server-side registration rows have a canonical event ID.
