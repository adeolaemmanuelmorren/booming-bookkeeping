# Reports requested

Updated: August 13, 2026

## Paid-media performance dashboard

This dashboard reports mature paid-click cohorts for July 1–30, 2026, with outcomes observed through August 13. It supports first-touch, last-touch, and 40/20/40 multi-touch attribution.

The dashboard includes:

- Impressions, clicks, spend, platform cost per lead, KRC registrations, cost per registration, unique BBB buyers, all collected revenue, and ROAS.
- Direct attribution from a prior paid ad touchpoint to the first qualifying BBB purchase per person. A KRC registration is not required for this BBB metric.
- Revenue by VIP, Book, Mentorship, Kajabi, Catalog, and Unknown. Revenue includes all collected payments, including renewals and later installments, so ROAS reflects cash collected.
- Source/medium breakdowns, five-day trends, ad-level performance, BBB purchase timing, immediate VIP behavior, cohort maturity, and payment-plan adoption.

Exact dashboard query:

- `PERFORMANCE_DASHBOARD_MATURE_2026-07-01_TO_2026-07-30.sql`
- `PERFORMANCE_DASHBOARD_SUMMARY_MATURE_2026-07-01_TO_2026-07-30.sql`

The dashboard uses `mart_conversions_ad_performance` for ad performance and the established person-level queries for Bill's registration and timing analyses.

## Bill's registration and purchase analyses

These analyses use KRC registrations only, a $47 VIP purchase, a qualifying BBB order over $900, and Pacific calendar dates:

- BBB purchase timing: percentage of registration-linked BBB buyers purchasing within 14 days and within 13.5 days.
- Same-day VIP versus BBB likelihood: eventual BBB purchase rates for same-day VIP, later VIP, and no-VIP registrants.
- Immediate VIP upgrade: same-day VIP adoption and subsequent BBB timing.
- Payment-plan adoption: percentage of unique high-ticket buyers whose initial qualifying order used the mentorship payment plan.

Exact query:

- `BBB_REGISTRATION_REPORTS_MATURE_2026-07-01_TO_2026-07-30.sql`

## BBB registration-path analysis

This separate analysis connects each qualifying BBB purchase to the purchaser's latest prior KRC registration, then attributes that registration to its first or last paid advertising click. It is intentionally different from the dashboard's direct ad-to-BBB metric because it measures the registration path specifically. The click cohort covers June 30–July 29, 2026 so every cohort has had at least 14 days to mature; purchases are observed through the report run date.

The person-level cohort query is required because `mart_conversions_multi_touch` is already aggregated and cannot directly reconstruct the individual chain:

`ad click → KRC registration → subsequent BBB purchase`

The saved report must be rerun with the established paid-medium condition:

```sql
medium IN ('cpc', 'paid', 'paid_social')
```

This prevents `meta / social / link_in_bio` traffic from being included as paid advertising merely because it contains an `fbclid`.

Files:

- `BBB_REVENUE_BY_AD_FIRST_LAST_TOUCH_MATURE_2026-06-30_TO_2026-07-29.sql`
- `BBB_REVENUE_BY_AD_FIRST_LAST_TOUCH_MATURE_2026-06-30_TO_2026-07-29.md`

## Payment categories

Add one canonical `payment_category` column to `mart_payments`. Keep `product_rule` for detailed Stripe classification.

| Payment category | Existing `mart_payments` rule |
|---|---|
| `kajabi` | `payment_source = 'stripe_kajabi'` |
| `vip` | `product_rule IN ('structured_basic_vip', 'structured_keyboard_rich_challenge', 'keyboard_rich_challenge_vip')` |
| `book` | `product_rule IN ('keyboard_rich_book', 'top_tax_loopholes')` |
| `mentorship` | `product_rule IN ('mentorship_deposit', 'mentorship_full_payment', 'mentorship_3x1997', 'mentorship_balance')` |
| `catalog` | `product_rule = 'catalog_product'` |
| `unknown` | Everything else |

Recommended expression:

```sql
case
  when payment_source = 'stripe_kajabi' then 'kajabi'
  when product_rule in (
    'structured_basic_vip',
    'structured_keyboard_rich_challenge',
    'keyboard_rich_challenge_vip'
  ) then 'vip'
  when product_rule in (
    'keyboard_rich_book',
    'top_tax_loopholes'
  ) then 'book'
  when product_rule in (
    'mentorship_deposit',
    'mentorship_full_payment',
    'mentorship_3x1997',
    'mentorship_balance'
  ) then 'mentorship'
  when product_rule = 'catalog_product' then 'catalog'
  else 'unknown'
end as payment_category
```

### Last 30 Pacific calendar dates

Window: July 15–August 13, 2026, inclusive.

| Category | All payments | Share of payments | New orders | Share of new orders | Repeat payments | All net revenue | New-order net revenue |
|---|---:|---:|---:|---:|---:|---:|---:|
| Kajabi | 3,983 | 47.12% | 495 | 10.23% | 3,488 | $794,323.80 | $102,400.80 |
| VIP | 2,666 | 31.54% | 2,666 | 55.08% | 0 | $121,965.00 | $121,965.00 |
| Mentorship | 1,521 | 18.00% | 1,406 | 29.05% | 115 | $3,273,938.00 | $3,041,250.00 |
| Catalog | 199 | 2.35% | 190 | 3.93% | 9 | $336,970.05 | $329,270.05 |
| Book | 77 | 0.91% | 77 | 1.59% | 0 | $1,341.75 | $1,341.75 |
| Unknown | 6 | 0.07% | 6 | 0.12% | 0 | $4,197.00 | $4,197.00 |
| **Total** | **8,452** | **100.00%** | **4,840** | **100.00%** | **3,612** | **$4,532,735.60** | **$3,600,424.60** |

`New orders` means `is_repeat_payment = FALSE`. The separate all-payment view preserves subscription renewals and later installments without presenting them as new purchases.

### Exact BigQuery query

```sql
with categorized as (
  select
    payment_id,
    net_amount,
    is_repeat_payment,
    payment_source,
    product_rule,
    case
      when payment_source = 'stripe_kajabi' then 'kajabi'
      when product_rule in (
        'structured_basic_vip',
        'structured_keyboard_rich_challenge',
        'keyboard_rich_challenge_vip'
      ) then 'vip'
      when product_rule in (
        'keyboard_rich_book',
        'top_tax_loopholes'
      ) then 'book'
      when product_rule in (
        'mentorship_deposit',
        'mentorship_full_payment',
        'mentorship_3x1997',
        'mentorship_balance'
      ) then 'mentorship'
      when product_rule = 'catalog_product' then 'catalog'
      else 'unknown'
    end as payment_category
  from `able-folio-499722.booming_data_analytics.mart_payments`
  where date(payment_time, 'America/Los_Angeles') between
    date_sub(current_date('America/Los_Angeles'), interval 29 day)
    and current_date('America/Los_Angeles')
),
summarized as (
  select
    payment_category,
    count(*) as all_payments,
    countif(not is_repeat_payment) as new_orders,
    countif(is_repeat_payment) as repeat_payments,
    sum(net_amount) as all_net_revenue,
    sum(if(not is_repeat_payment, net_amount, 0)) as new_order_net_revenue
  from categorized
  group by payment_category
)
select
  payment_category,
  all_payments,
  round(100 * safe_divide(all_payments, sum(all_payments) over ()), 2)
    as all_payment_share_pct,
  new_orders,
  round(100 * safe_divide(new_orders, sum(new_orders) over ()), 2)
    as new_order_share_pct,
  repeat_payments,
  round(all_net_revenue, 2) as all_net_revenue,
  round(new_order_net_revenue, 2) as new_order_net_revenue
from summarized
order by all_payments desc;
```

## Multi-touch category metrics

Once `payment_category` exists in `mart_payments`, `mart_conversions_multi_touch` can expose category-specific order and revenue metrics without repeating product-name rules.

The payment-event layer should create one flag per category, such as `orders_vip`, `orders_book`, `orders_mentorship`, `orders_kajabi`, `orders_catalog`, and `orders_unknown`. The existing first-touch, last-touch, and 40/20/40 weighting can then generate the corresponding `_ft`, `_lt`, and `_mt` columns.

Repeat-payment behavior remains controlled independently by `is_repeat_payment`, so category reporting does not change which payments qualify as `order_completed`.

## High-ticket payment-plan adoption

Measure the percentage of unique BBB/high-ticket buyers who chose the mentorship payment plan. Use the established BBB definition: a server-side mentorship payment over $900, counted once per person. Only the initial payment-plan purchase identifies a payment-plan buyer; later installments do not create additional buyers.

### Last 30 Pacific calendar dates

Window: July 15–August 13, 2026, inclusive.

| High-ticket buyers | Payment-plan buyers | Non-payment-plan buyers | Payment-plan adoption |
|---:|---:|---:|---:|
| 793 | 107 | 686 | **13.49%** |

### Exact BigQuery query

```sql
with qualifying_orders as (
  select
    coalesce(
      profile_id,
      concat('stripe_customer:', customer_id),
      concat('email:', lower(payment_email)),
      concat('payment:', payment_id)
    ) as person_id,
    product_rule
  from `able-folio-499722.booming_data_analytics.mart_payments`
  where payment_category = 'mentorship'
    and not is_repeat_payment
    and net_amount > 900
    and date(payment_time, 'America/Los_Angeles') between
      date_sub(current_date('America/Los_Angeles'), interval 29 day)
      and current_date('America/Los_Angeles')
),

people as (
  select
    person_id,
    logical_or(product_rule = 'mentorship_3x1997') as used_payment_plan
  from qualifying_orders
  group by person_id
)

select
  count(*) as high_ticket_buyers,
  countif(used_payment_plan) as payment_plan_buyers,
  countif(not used_payment_plan) as non_payment_plan_buyers,
  round(
    100 * safe_divide(countif(used_payment_plan), count(*)),
    2
  ) as payment_plan_buyer_pct
from people;
```
