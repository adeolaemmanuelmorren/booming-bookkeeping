# Stripe checkout and product coverage audit

**Dataset:** `able-folio-499722.stripe`  
**Audit date:** 2026-07-15 (Hawaii)  
**Scope:** Read-only BigQuery investigation. No production, Stripe, Kajabi, ClickFunnels, or tracking changes were made.

## Executive conclusion

The main Booming Bookkeeping Stripe account is connected and its raw payment coverage is strong, but there is no modeled purchase/order fact table.

- The dataset has **one Fivetran Stripe connection**, named `stripe`, connection ID `escalate_armour`, feeding the single `stripe` schema every six hours.
- The connector contains the main account now branded **Booming Bookkeeping Business, LLC**. Older invoices use **Von Fumetti, PC**; the non-overlapping date ranges support an account rename, not two simultaneously connected accounts.
- The dataset does not expose the platform `acct_...` ID. `connected_account_id` is null on every charge and payment intent, so there are no Stripe Connect subaccounts represented.
- The separate Kajabi Stripe account is **not connected**. No second Stripe connector/schema exists, and searches for `Kajabi`, offer `v3WtGzPH`, and `learn.boomingbookkeeping.com` returned zero matches across products, charges, payment intents, invoices, Checkout Sessions, and Payment Links.
- All **238,296 successful Stripe payments** are present as unique successful charge rows. There are no duplicate charge IDs.
- There is **no purchase/order/transaction fact table or view** in `stripe`, no purchase-like Segment track event, and no server-side purchase representation elsewhere in the project datasets inspected. Consequently, all successful payments exist only as raw Stripe objects, not as normalized business purchases.
- Book, Challenge VIP, deposit, balance, full, installment, and custom Payment Link payments are present. However, only a minority have structured Stripe product/price relationships; ClickFunnels often stores product identity only in charge description/metadata.
- A safe model must use **one successful charge as the canonical payment grain** and build a separate order/program-enrollment layer. It must not label every deposit, installment, split-card charge, or custom payment as a complete mentorship purchase.

## Direct answers

| Question | Answer |
|---|---|
| Are book orders covered? | **Yes at payment grain.** 33,387 successful book-order charges are present. They do not have Stripe product or price IDs; identity comes from charge descriptions and `Keyboard Rich Book` statement descriptors. |
| Is the book one-click VIP upsell covered? | **The follow-up charges are present, but the order-to-upsell link is not explicit.** Same-customer payments within 30 minutes of book orders show Challenge VIP Ticket charges, mainly $94 historically and $47 more recently. No ClickFunnels order/funnel-step ID exists in Stripe metadata, so the linkage is evidence-based but probabilistic. |
| Are all $47 VIP variants covered? | **Yes as raw successful charges; no as structured products/prices.** 69,957 successful $47 VIP payments span 142 raw product-text variants. Only 293 connect to a Checkout Session and price ID. |
| Is the $997 deposit covered? | **Yes as raw charges.** 19,381 successful $997 deposit charges are present, plus 1,520 historical $497 deposit charges. None has a Checkout Session or price ID. |
| Are balance/full/installment/nonstandard mentorship payments covered correctly? | **Present, but not modeled correctly as completed program purchases.** Exact $4,997 payments, 3 × $1,997 subscriptions, explicit balances, split cards, and custom Payment Link amounts all exist. They require payment-level reporting plus a separate enrollment/order grouping key. |
| Is the Kajabi $199/month checkout covered? | **No.** The only $199/month price found is a 2019 main-account product, not Kajabi. |
| Is the separate Kajabi Stripe account connected? | **No evidence of any connector or source schema for it.** A second Fivetran Stripe connector/account is missing. |

## Dataset inventory and watermark

The audit inspected all **59 base tables** and all of their columns before choosing transactional queries. There are no views in `stripe`.

| Object | Table | Rows | Notes |
|---|---:|---:|---|
| Products | `product` | 3,247 | Many ClickFunnels/customer-specific products; product names are not a stable business key. |
| Prices | `price` | 3,287 | Includes one-time, recurring, and custom-unit prices. |
| Payment Links | `payment_link` | 14 | Structured link metadata was added to the connector on 2026-07-09. |
| Checkout Sessions | `checkout_session` | 10,780 | 5,419 paid payment-mode sessions; all reconcile to a successful charge. |
| Checkout line items | `checkout_session_line_item` | 10,780 | Product/price detail for Checkout, not for most ClickFunnels charges. |
| Subscription history | `subscription_history` | 10,617 | Fivetran history table; 10,289 current subscriptions through `subscription_item`. |
| Subscription items | `subscription_item` | 10,289 | Uses `plan_id` rather than a direct `price_id` column. |
| Invoices | `invoice` | 50,899 | 46,595 paid under current Booming branding plus 260 under the older name. |
| Invoice payments | `invoice_payment` | 50,337 | Association table, not an additional payment grain. |
| Payment intents | `payment_intent` | 255,851 | 236,912 currently `succeeded`. |
| Charges | `charge` | 285,232 | 238,296 unique successful payments; canonical payment table. |
| Refunds | — | — | No standalone refund table. Only `charge.amount_refunded`, `charge.refunded`, and credit notes are available. |
| Credit notes | `credit_note` | 22 | $4,334 issued, all post-payment, last created 2022-10-21. |
| Disputes | `dispute` | 1,128 | Includes lost, won, warning, and open statuses. |
| Customers | `customer` | 188,741 | Provides email/name/phone and metadata for identity joins. |

All successful charges are USD. The charge history runs from **2019-07-02 11:27:56 UTC** through **2026-07-15 14:53:27 UTC**. The latest charge sync watermark observed was **2026-07-15 15:00:12 UTC**, which is **2026-07-15 05:00:12 HST**.

“Recent” in this report means **2025-07-15 00:00:00 UTC through the watermark**.

## Canonical grain and duplication rules

The canonical financial grain is:

> One row per `charge.id` where `paid = TRUE` and `status = 'succeeded'`.

This choice is supported by the reconciliation:

- 238,296 successful-charge rows and 238,296 distinct charge IDs.
- 236,912 succeeded payment intents each have exactly one successful charge; none has multiple successful charges.
- 1,381 successful charges are legacy or otherwise have no payment intent.
- 5,419 paid payment-mode Checkout Sessions all reconcile to successful charges.
- The three paid subscription-mode Checkout Sessions reconcile through subscriptions → invoices → successful charges; they should not be joined directly as extra purchases.
- Invoice, invoice-payment, subscription, Checkout Session, and Payment Link rows are descriptive/association records. Summing them alongside charges would duplicate money.

Recommended fact design:

1. `payment_fact`: one successful charge, with gross, refunded amount, refund-adjusted net, dispute status, customer/email, payment intent, invoice, subscription, Checkout Session, Payment Link, and best available product signal.
2. `business_order` or `enrollment_fact`: a separate entity that groups deposits, split cards, installments, and balances using an authoritative ClickFunnels/order/contract/CRM identifier.
3. `payment_allocation`: bridge from many payments to one order/enrollment.

## Overall payment totals

“Net” below means gross minus `charge.amount_refunded`. It excludes Stripe fees, taxes, credits outside charge refunds, and dispute losses.

| Period | Attempts | Successful payments | Failed/other attempts | Gross | Refunds | Net after refunds |
|---|---:|---:|---:|---:|---:|---:|
| All history | 285,232 | 238,296 | 46,936 | $124,120,621.05 | $1,321,810.41 | $122,798,810.64 |
| Recent 12 months | 67,977 | 59,407 | 8,570 | $49,378,008.66 | $445,914.95 | $48,932,093.71 |

Refund/dispute details:

- 4,595 successful charges have a nonzero refunded amount.
- 4,324 are marked fully refunded.
- The absence of a refund table means refund IDs, individual refund timestamps, and multiple-refund event detail are unavailable.
- Disputes: 979 lost ($446,904.74), 104 won ($149,264), 35 warning-closed ($35,149), 8 need response ($12,129), and 2 warning-need-response ($1,994).

## Checkout-surface mapping

### 1. Keyboard Rich book funnel

**Account:** Main Booming Bookkeeping Stripe connector  
**Stripe product/price:** No structured product or price ID for these ClickFunnels payments  
**Identity signals:** `charge.description`, `charge.metadata.products`, `statement_descriptor = 'Keyboard Rich Book'`  
**Payment type:** One-time

Two product-text generations are present:

- `Keyboard Rich: How Anyone Can Earn Six Figures from Home with a Simple Bookkeeping Business`
- `Keyboard Rich Book (Plus FREE eBook version)`

| Variant | Charge amount | Successful payments | Gross | Refunds | Recent successes |
|---|---:|---:|---:|---:|---:|
| Book + domestic shipping | $7.95 | 29,803 | $236,933.85 | $1,502.55 | 833 |
| Book + domestic shipping + audiobook | $36.95 | 3,489 | $128,918.55 | $4,559.40 | 104 |
| Book + international shipping | $19.95 | 64 | $1,276.80 | $39.90 | 1 |
| Book + international shipping + audiobook | $48.95 | 8 | $391.60 | $0 | 1 |
| Book + audiobook/no shipping label | $30.00 | 2 | $60.00 | $0 | 0 |
| Book/no shipping label | $1.00 | 21 | $21.00 | $0 | 1 |

Totals: **33,387 successful payments**, **$367,601.80 gross**, **$6,101.85 refunded**.

The apparent one-click follow-up is recorded as a separate charge. Same-customer successful charges within 30 minutes of book orders include:

- 1,962 Challenge VIP payments at $94.
- 46 Challenge VIP payments at $47, concentrated in 2026.
- 8 Challenge VIP payments at $194.

The same temporal method also finds other book-funnel offers (`Top Tax Loopholes for Bookkeeping Business Owners` at $47 and `Done in a Day` at $97). Because charge metadata has only email/name/address/phone/products—not a ClickFunnels order ID or funnel-step ID—these relationships cannot be made deterministic from Stripe alone.

### 2. Challenge VIP checkouts

**Account:** Main Booming Bookkeeping Stripe connector  
**Payment type:** One-time  
**Historical amounts:** Primarily $47, with $94, $97, $100, $147, and $194 VIP-labeled variants also present  
**Refund handling:** `charge.amount_refunded`; no refund event table

Current structured objects:

| Product | Product ID | Price ID | Amount | Payment Link |
|---|---|---|---:|---|
| KRC - Basic VIP | `prod_RtWRamfeN5cGXG` | `price_1QzjOMBf6i84vTZEJziq3pN7` | $47 one-time | `plink_1QzjOqBf6i84vTZEkOOwnbNJ` |
| Keyboard Rich Challenge | `prod_RL2UJfDpmvCvRx` | `price_1QSMPLBf6i84vTZEbLsCt1b7` | $47 one-time | No paid Payment Link sessions found in this dataset |

For $47 VIP specifically:

- 69,957 successful payments.
- $3,287,979 gross; $85,916 refunded; $3,202,063 after refunds.
- 35,692 successful payments in the recent period ($1,677,524 gross).
- 142 distinct raw product-text variants, largely date-stamped versions of Basic VIP/View Q&A/Backstage/legacy Challenge VIP.
- 69,664 have charge-level product text.
- Only 293 have a Checkout Session and price ID—the KRC Basic VIP Payment Link.

Therefore, every relevant $47 payment is represented as a charge, but historical product/price coverage is incomplete by design: most ClickFunnels transactions never created/used a reusable Stripe product/price relationship.

The four URLs supplied (`/vipfc`, `/upgrade`, `/vipupgrade`, `/vip`) cannot be separated reliably inside Stripe. Stripe does not retain the originating ClickFunnels page URL on these direct charges. Product text and statement descriptors establish the VIP family, not the exact route.

### 3. Main mentorship purchase

#### $997 deposit (`keyboardrich.com/yes`)

**Product text:** `Booming Bookkeeping Mentorship Program (Deposit)`  
**Stripe product/price:** None  
**Payment type:** One-time direct ClickFunnels charge

| Amount | Successful payments | Gross | Refunds |
|---|---:|---:|---:|
| $997 | 19,381 | $19,322,857 | $333,418 |
| $497 | 1,520 | $755,440 | $18,243.49 |

All 20,901 successful deposit charges have a customer ID. 20,856 have a payment intent. None has a Checkout Session or price ID.

Split-card behavior is observable: four $497 deposit charges have $500 companion charges for the same normalized email within 24 hours, totaling $997. This proves that a payment row cannot automatically equal a completed deposit/order.

Recent deposits: **9,467 payments**, **$9,438,599 gross**, **$145,869 refunded**, **$9,292,730 after refunds**.

#### Balance, full, installment, and nonstandard payments (`boomingbookkeeping.com/go`)

Structured examples:

| Role | Product | Product ID | Price/plan ID | Terms |
|---|---|---|---|---|
| Full-price reference | Booming Bookkeeping Mentorship Program | `prod_RlhQH6wdxzjZeZ` | `price_1QsA1wBf6i84vTZEca307VRJ` | $4,997 one-time |
| Standard installment | Booming Bookkeeping Mentorship Program (3 payments of $1,997) | `prod_PtzEmmHhC1K9Xi` | `BBB3X1997` | $1,997/month |
| Explicit balance | Booming Bookkeeping Balance payment | `prod_RtWNqT9xux5CI7` | `price_1QzjKMBf6i84vTZE2WPd5Rh7` | $3,003 one-time |
| Custom installment | Booming Bookkeeping installment | `prod_RtWTQcXFL5PCoP` | `price_1QzjQSBf6i84vTZEHPfW7AFx` | Customer-entered/custom one-time amount |
| Generic custom payment | Booming Bookkeeping Mentorship Program | `prod_OqlZWYdT7Ej01J` | `price_1O342KBf6i84vTZEBviCboHK` | Customer-entered/custom one-time amount |

Important coverage evidence:

- **3 × $1,997 plan:** 4,060 subscriptions, 8,546 invoices, 7,050 successful paid invoices/charges, $11,041,988 gross, $159,793 refunded.
- Current `BBB3X1997` statuses: 3,251 canceled, 609 incomplete-expired, 103 active, 83 trialing, 14 past due.
- **Exact $4,997 amount:** 372 program-related successful charges totaling $1,858,884. Most flowed through custom Payment Links; the exact amount alone does not prove a full-program purchase.
- **Explicit balance classification:** 104 successful payments across six amounts from $1,003 to $4,000, $309,773 gross, $3,503 refunded.
- **$3,003 balance Payment Link:** 88 successful payments, $264,264 gross, $3,503 refunded.
- **Custom installment Payment Link:** 2,610 successful payments across 288 distinct amounts from $1 to $5,157, $5,189,126.56 gross, $31,616.90 refunded.
- **Generic mentorship Payment Link:** 2,147 successful payments across 274 distinct amounts from $3 to $5,403, $4,379,824.89 gross, $62,704 refunded.
- Additional generic mentorship links contain fixed and custom $3,000, $4,500, $5,997, and $6,000 configurations, plus newer payment-plan payoff links.

This data covers the money, but a “mentorship purchase” fact built only from Stripe would overcount:

- A $997 deposit is not a $4,997 completed enrollment.
- Each $1,997 subscription invoice is an installment, not another program purchase.
- Two cards used for one deposit are two payments but one deposit/order.
- A custom Payment Link charge can be a deposit, balance, payoff, or negotiated installment.
- A $4,997 amount on a custom installment link may be a full payment, but Stripe alone cannot prove the contract state.

An authoritative external order/enrollment key from ClickFunnels, DocuSign, CRM/customer notes, or an internal enrollment system is required.

### 4. Kajabi $199/month fallback

The Kajabi checkout is absent.

No object in the connected Stripe dataset contains:

- `Kajabi`
- `v3WtGzPH`
- `learn.boomingbookkeeping.com`

The only $199/month plan is:

| Product | Product ID | Price/plan ID | Dates | Result |
|---|---|---|---|---|
| Booming Bookkeeping Training - Installment Plan | `prod_FOT2JF4dmbE1ri` | `199IP` | Subscriptions created 2019-07-08 to 2019-08-28 | 12 subscriptions, all canceled; 132 successful charges through 2020-07-18 |

This historical main-account plan is not the Kajabi fallback. It should not be relabeled as Kajabi based on amount alone.

The missing source is the **separate Stripe account connected to Kajabi**. The warehouse needs a second Stripe connector (ideally a distinct schema such as `stripe_kajabi`) whose account identity is documented. The exact Kajabi `acct_...` ID cannot be recovered from the current dataset.

## Existing purchase representation and Segment joinability

No purchase fact exists:

- All 59 `stripe` objects are base tables.
- Project datasets contain no purchase/order/transaction fact table.
- `boom_domains.tracks` has zero events whose names contain purchase, order, checkout, payment, subscription, or refund.
- The local ClickFunnels tracking documentation explicitly says checkout forms do not emit browser payment-completion events; server-side completion was intended.

Identity fields available for a future Stripe-to-Segment join:

- `charge.billing_detail_email`
- `charge.receipt_email`
- `charge.metadata.email`
- `charge.customer_id` → `customer.email`
- `payment_intent.receipt_email`
- `invoice.customer_id`
- `checkout_session.customer_id`

Email coverage is excellent at payment grain:

- 178,887 of 178,889 older successful payments have a joinable normalized email.
- All 59,407 recent successful payments have one.
- 2,957 recent payment rows / 2,203 distinct emails currently match an email present in Segment tables. This is not a purchase-event match; it is only identity overlap.

## Payments lacking reliable product/funnel mapping

- 185,190 successful charges have explicit product text in the charge description.
- 5,419 have Checkout product detail.
- 46,637 have invoice-line product detail.
- 52,056 have an invoice/Checkout price or plan ID.
- **1,050 successful payments totaling $1,152,572 have no explicit charge, Checkout, or invoice product signal.**

The largest unmapped clusters use the generic `Bookkeeping Training` statement descriptor and amounts such as $400, $197, $6,000, $1,997, $1,000, and many custom values. Some are likely historical training or mentorship arrangements, but amount plus generic descriptor is insufficient for a confident funnel mapping.

## Coverage gaps, prioritized

1. **Connect the separate Kajabi Stripe account.** Create a second Fivetran Stripe connector/schema, record its `acct_...` identity, and backfill products, prices, subscriptions, invoices, charges/payment intents, refunds, cancellations, disputes, and customers.
2. **Create a canonical `payment_fact` at successful-charge grain.** Include refund-adjusted net, disputes, invoice/subscription/session/link associations, and a documented `product_mapping_method` (`price_id`, invoice line, Checkout line, charge product text, descriptor, or unknown).
3. **Create an order/enrollment key outside Stripe.** Capture ClickFunnels order/purchase ID and DocuSign/CRM enrollment ID, then bridge multiple charges to one mentorship enrollment. This is required for deposits, installments, split cards, and custom amounts.
4. **Backfill a maintained product/funnel mapping table.** Normalize the 142 date-stamped $47 VIP names, book/shipping/audio variants, historical mentorship names, statement descriptors, and Payment Link IDs. Never classify on amount alone.
5. **Add server-side purchase events to Segment from the canonical payment/order model.** The existing browser helper intentionally does not infer payment completion. Use stable charge/order IDs for deduplication.
6. **Add refund-event ingestion.** `amount_refunded` is sufficient for a balance but not for refund timing, reason, or multiple refund events. Enable the Stripe refund table/object if the connector supports it.
7. **Resolve the 1,050 no-product-signal payments.** Start with high-gross generic `Bookkeeping Training` clusters and reconcile them against historical CRM/customer notes.
8. **Document account identity and watermark monitoring.** Store the main and Kajabi Stripe `acct_...` IDs and alert when either connector falls behind.

## Reproducible SQL

- [`01_inventory_accounts_and_grain.sql`](sql/stripe_checkout_product_coverage/01_inventory_accounts_and_grain.sql)
- [`02_funnel_and_mentorship_coverage.sql`](sql/stripe_checkout_product_coverage/02_funnel_and_mentorship_coverage.sql)
- [`03_kajabi_segment_and_gaps.sql`](sql/stripe_checkout_product_coverage/03_kajabi_segment_and_gaps.sql)

