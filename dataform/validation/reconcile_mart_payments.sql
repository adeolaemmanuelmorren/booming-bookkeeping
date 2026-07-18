-- Proves mart_payments has the same charge grain and financial totals as raw Stripe.
with raw as (
  select
    count(*) as payment_count,
    count(distinct id) as distinct_payment_count,
    sum(cast(amount as numeric) / 100) as amount_paid,
    sum(cast(amount_refunded as numeric) / 100) as refund_amount,
    sum(cast(amount - amount_refunded as numeric) / 100) as net_amount
  from `able-folio-499722.stripe.charge`
  where paid is true
    and status = 'succeeded'
),

mart as (
  select
    count(*) as payment_count,
    count(distinct payment_id) as distinct_payment_count,
    sum(amount_paid) as amount_paid,
    sum(refund_amount) as refund_amount,
    sum(net_amount) as net_amount
  from `able-folio-499722.booming_data_analytics.mart_payments`
),

missing as (
  select count(*) as missing_count
  from `able-folio-499722.stripe.charge` as raw
  left join `able-folio-499722.booming_data_analytics.mart_payments` as mart
    on mart.payment_id = raw.id
  where raw.paid is true
    and raw.status = 'succeeded'
    and mart.payment_id is null
),

extra as (
  select count(*) as extra_count
  from `able-folio-499722.booming_data_analytics.mart_payments` as mart
  left join `able-folio-499722.stripe.charge` as raw
    on raw.id = mart.payment_id
    and raw.paid is true
    and raw.status = 'succeeded'
  where raw.id is null
)

select
  raw.payment_count as raw_payment_count,
  mart.payment_count as mart_payment_count,
  raw.distinct_payment_count as raw_distinct_payment_count,
  mart.distinct_payment_count as mart_distinct_payment_count,
  raw.amount_paid as raw_amount_paid,
  mart.amount_paid as mart_amount_paid,
  raw.refund_amount as raw_refund_amount,
  mart.refund_amount as mart_refund_amount,
  raw.net_amount as raw_net_amount,
  mart.net_amount as mart_net_amount,
  missing.missing_count,
  extra.extra_count
from raw
cross join mart
cross join missing
cross join extra

