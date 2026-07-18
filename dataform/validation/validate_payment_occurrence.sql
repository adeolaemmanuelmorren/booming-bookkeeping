-- Independently recreates subscription sequence from raw Stripe and compares it to the mart.
with checkout_subscription as (
  select
    payment_intent_id,
    array_agg(subscription_id ignore nulls order by id limit 1)[safe_offset(0)] as subscription_id
  from `able-folio-499722.stripe.checkout_session`
  group by payment_intent_id
),

raw_linked as (
  select
    charge.id as payment_id,
    charge.created as payment_time,
    coalesce(invoice.subscription_id, checkout.subscription_id) as subscription_id
  from `able-folio-499722.stripe.charge` as charge
  left join `able-folio-499722.stripe.invoice` as invoice
    on invoice.id = charge.invoice_id
  left join checkout_subscription as checkout
    on checkout.payment_intent_id = charge.payment_intent_id
  where charge.paid is true
    and charge.status = 'succeeded'
),

raw_sequenced as (
  select
    *,
    case
      when subscription_id is null then cast(null as int64)
      else row_number() over (
        partition by subscription_id
        order by payment_time, payment_id
      )
    end as expected_sequence
  from raw_linked
)

select
  countif(raw.subscription_id is not null) as raw_subscription_payments,
  count(distinct raw.subscription_id) as raw_subscriptions,
  countif(raw.subscription_id is not null and raw.expected_sequence = 1) as expected_initial_payments,
  countif(raw.subscription_id is not null and raw.expected_sequence > 1) as expected_repeat_payments,
  countif(
    raw.expected_sequence != mart.payment_sequence_number
    or (raw.expected_sequence = 1 and mart.is_repeat_payment)
    or (raw.expected_sequence > 1 and not mart.is_repeat_payment)
  ) as mismatches
from raw_sequenced as raw
inner join `able-folio-499722.booming_data_analytics.mart_payments` as mart
  using (payment_id)

