# Stripe payment model validation

Validated: 2026-07-15 Pacific/Honolulu

## Dataform execution

The complete project compiled and ran successfully with a full refresh. The run created 17 Stripe staging views, five intermediate tables, and `able-folio-499722.booming_data_analytics.mart_payments`.

All four generated assertions passed:

- raw successful-charge grain and financial totals;
- unique `payment_id`;
- payment occurrence/repeat logic;
- non-null and financial row conditions.

## Raw charge reconciliation

| Metric | Raw Stripe | `mart_payments` | Difference |
|---|---:|---:|---:|
| Successful payments | 238,336 | 238,336 | 0 |
| Distinct payment IDs | 238,336 | 238,336 | 0 |
| Gross amount | $124,132,268.00 | $124,132,268.00 | $0.00 |
| Refund amount | $1,322,045.41 | $1,322,045.41 | $0.00 |
| Net amount | $122,810,222.59 | $122,810,222.59 | $0.00 |
| Missing raw payment IDs | 0 | — | 0 |
| Extra mart payment IDs | — | 0 | 0 |

Rerun with `validation/reconcile_mart_payments.sql`.

## Documented product rules

| Product rule | Payments |
|---|---:|
| Keyboard Rich book | 33,388 |
| $47 Keyboard Rich Challenge VIP | 69,720 |
| Structured Basic VIP | 296 |
| Structured Keyboard Rich Challenge | 2 |
| Mentorship deposit ($997/current or $497/historical) | 20,901 |
| Structured $4,997 full payment | 0 |
| 3 × $1,997 mentorship plan | 7,052 |
| Structured $3,003 balance | 88 |

The $4,997 rule is implemented, but the raw Stripe data currently has no successful charge linked to the documented product or price ID through Checkout, invoice, subscription, or Payment Link line items.

There are 372 successful charges whose collected amount is exactly $4,997. None are labeled as the documented structured full-payment offer because none carries its required product/price relationship. They retain their actual catalog product or remain `unclassified`; amount alone is not used as product proof.

The historical `199IP` plan appears on 132 payments as `Booming Bookkeeping Training - Installment Plan`. The model produces zero Kajabi classifications, so the unrelated plan is not mislabeled as Kajabi.

The exact raw identifier and descriptor comparisons are in `validation/validate_documented_product_rules.sql`.

## Product coverage

- Classified payments: 176,071 (73.88%).
- Unclassified payments: 62,265.
- Unmatched successful charges remain in the mart with `product_name = 'unclassified'`, as required.
- Catalog products not covered by a named business rule retain their actual Stripe product name.

## Repeat payments

Raw Stripe contains 46,549 successful subscription payments across 9,009 subscriptions:

- Initial subscription/payment-plan payments: 9,009.
- Later subscription/payment-plan payments: 37,540.
- Sequence mismatches between raw Stripe and the mart: 0.
- Structured balance payments correctly flagged repeat: 88 of 88.

For the documented 3 × $1,997 plan:

- First payments (`is_repeat_payment = FALSE`): 3,324.
- Later installments (`is_repeat_payment = TRUE`): 3,728.

The raw source includes a small over-three-payment anomaly: 22 fourth payments, two fifth payments, one sixth payment, and one seventh payment. These are retained as collected revenue and correctly remain repeat payments rather than new Order Completed conversions.

Rerun the independent sequence reconciliation with `validation/validate_payment_occurrence.sql`.

## Discounts and refunds

- Refunds remain separate from discounts.
- 4,600 payments have a refund.
- The currently synced Stripe discount relationships identify one discounted payment ($200 discount on a $1,797 successful charge).
- The discount does not appear as a refund.
