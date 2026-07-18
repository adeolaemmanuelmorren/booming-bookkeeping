-- Direct descriptor and amount rules from STRIPE_PAYMENT_PRODUCT_IDENTIFICATION.md.
with successful_charges as (
  select *
  from `able-folio-499722.stripe.charge`
  where paid is true
    and status = 'succeeded'
),

raw_direct_rules as (
  select
    'keyboard_rich_book' as product_rule,
    count(*) as raw_payments
  from successful_charges
  where regexp_contains(
    lower(concat(
      coalesce(calculated_statement_descriptor, ''),
      ' ',
      coalesce(statement_descriptor, '')
    )),
    r'keyboard rich book'
  )

  union all

  select
    'keyboard_rich_challenge_vip',
    count(*)
  from successful_charges
  where amount = 4700
    and regexp_contains(
      lower(concat(
        coalesce(description, ''),
        ' ',
        coalesce(calculated_statement_descriptor, ''),
        ' ',
        coalesce(statement_descriptor, '')
      )),
      r'(keyboard rich|keyboardrich|krc)'
    )
    and regexp_contains(
      lower(concat(
        coalesce(description, ''),
        ' ',
        coalesce(calculated_statement_descriptor, ''),
        ' ',
        coalesce(statement_descriptor, '')
      )),
      r'(vip|backstage|basic package|platinum)'
    )

  union all

  select
    'mentorship_deposit',
    count(*)
  from successful_charges
  where amount in (99700, 49700)
    and regexp_contains(
      lower(coalesce(description, '')),
      r'mentorship program \(deposit\)'
    )
),

catalog_candidates as (
  select
    charge.id as payment_id,
    price.product_id,
    line.price_id,
    cast(null as string) as plan_id,
    session.payment_link as payment_link_id
  from successful_charges as charge
  inner join `able-folio-499722.stripe.checkout_session` as session
    on session.payment_intent_id = charge.payment_intent_id
  inner join `able-folio-499722.stripe.checkout_session_line_item` as line
    on line.checkout_session_id = session.id
  left join `able-folio-499722.stripe.price` as price
    on price.id = line.price_id

  union all

  select
    charge.id,
    coalesce(price.product_id, plan.product_id),
    line.price_id,
    line.plan_id,
    cast(null as string)
  from successful_charges as charge
  inner join `able-folio-499722.stripe.invoice_line_item` as line
    on line.invoice_id = charge.invoice_id
  left join `able-folio-499722.stripe.price` as price
    on price.id = line.price_id
  left join `able-folio-499722.stripe.plan` as plan
    on plan.id = line.plan_id

  union all

  select
    charge.id,
    coalesce(price.product_id, plan.product_id),
    case when price.id is not null then price.id end,
    item.plan_id,
    cast(null as string)
  from successful_charges as charge
  inner join `able-folio-499722.stripe.invoice` as invoice
    on invoice.id = charge.invoice_id
  inner join `able-folio-499722.stripe.subscription_item` as item
    on item.subscription_id = invoice.subscription_id
  left join `able-folio-499722.stripe.price` as price
    on price.id = item.plan_id
  left join `able-folio-499722.stripe.plan` as plan
    on plan.id = item.plan_id

  union all

  select
    charge.id,
    price.product_id,
    line.price_id,
    cast(null as string),
    session.payment_link
  from successful_charges as charge
  inner join `able-folio-499722.stripe.checkout_session` as session
    on session.payment_intent_id = charge.payment_intent_id
  inner join `able-folio-499722.stripe.payment_link_line_item` as line
    on line.payment_link_id = session.payment_link
  left join `able-folio-499722.stripe.price` as price
    on price.id = line.price_id
),

raw_catalog_rules as (
  select
    product_rule,
    count(distinct payment_id) as raw_payments
  from (
    select
      payment_id,
      case
        when product_id = 'prod_RtWRamfeN5cGXG'
          or price_id = 'price_1QzjOMBf6i84vTZEJziq3pN7'
          or payment_link_id = 'plink_1QzjOqBf6i84vTZEkOOwnbNJ'
          then 'structured_basic_vip'
        when product_id = 'prod_RL2UJfDpmvCvRx'
          or price_id = 'price_1QSMPLBf6i84vTZEbLsCt1b7'
          then 'structured_keyboard_rich_challenge'
        when product_id = 'prod_RlhQH6wdxzjZeZ'
          or price_id = 'price_1QsA1wBf6i84vTZEca307VRJ'
          then 'mentorship_full_payment'
        when product_id = 'prod_PtzEmmHhC1K9Xi'
          or plan_id = 'BBB3X1997'
          or price_id = 'BBB3X1997'
          then 'mentorship_3x1997'
        when product_id = 'prod_RtWNqT9xux5CI7'
          or price_id = 'price_1QzjKMBf6i84vTZE2WPd5Rh7'
          then 'mentorship_balance'
      end as product_rule
    from catalog_candidates
  )
  where product_rule is not null
  group by product_rule
),

raw_rules as (
  select * from raw_direct_rules
  union all
  select * from raw_catalog_rules
),

mart_rules as (
  select
    product_rule,
    count(*) as mart_payments
  from `able-folio-499722.booming_data_analytics.mart_payments`
  where product_rule in (
    'keyboard_rich_book',
    'keyboard_rich_challenge_vip',
    'mentorship_deposit',
    'structured_basic_vip',
    'structured_keyboard_rich_challenge',
    'mentorship_full_payment',
    'mentorship_3x1997',
    'mentorship_balance'
  )
  group by product_rule
),

documented_rules as (
  select product_rule
  from unnest([
    'keyboard_rich_book',
    'keyboard_rich_challenge_vip',
    'mentorship_deposit',
    'structured_basic_vip',
    'structured_keyboard_rich_challenge',
    'mentorship_full_payment',
    'mentorship_3x1997',
    'mentorship_balance'
  ]) as product_rule
)

select
  documented.product_rule,
  coalesce(raw.raw_payments, 0) as raw_payments,
  coalesce(mart.mart_payments, 0) as mart_payments,
  coalesce(raw.raw_payments, 0) - coalesce(mart.mart_payments, 0) as difference
from documented_rules as documented
left join raw_rules as raw
  using (product_rule)
left join mart_rules as mart
  using (product_rule)
order by product_rule
