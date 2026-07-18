-- Kajabi-account proof, Segment joinability, and remaining coverage gaps.

-- 1. Search relevant Stripe object text for Kajabi account/offer signals.
SELECT
  'product' AS source,
  COUNTIF(REGEXP_CONTAINS(
    LOWER(CONCAT(COALESCE(name, ''), ' ', COALESCE(description, ''), ' ', TO_JSON_STRING(metadata))),
    r'(kajabi|v3wtgzph|learn\.boomingbookkeeping\.com)'
  )) AS matches
FROM `able-folio-499722.stripe.product`
UNION ALL
SELECT
  'charge',
  COUNTIF(REGEXP_CONTAINS(
    LOWER(CONCAT(
      COALESCE(description, ''),
      ' ',
      COALESCE(statement_descriptor, ''),
      ' ',
      COALESCE(calculated_statement_descriptor, ''),
      ' ',
      TO_JSON_STRING(metadata)
    )),
    r'(kajabi|v3wtgzph|learn\.boomingbookkeeping\.com)'
  ))
FROM `able-folio-499722.stripe.charge`
UNION ALL
SELECT
  'payment_intent',
  COUNTIF(REGEXP_CONTAINS(
    LOWER(CONCAT(COALESCE(description, ''), ' ', COALESCE(statement_descriptor, ''), ' ', TO_JSON_STRING(metadata))),
    r'(kajabi|v3wtgzph|learn\.boomingbookkeeping\.com)'
  ))
FROM `able-folio-499722.stripe.payment_intent`
UNION ALL
SELECT
  'invoice',
  COUNTIF(REGEXP_CONTAINS(
    LOWER(CONCAT(COALESCE(description, ''), ' ', COALESCE(statement_descriptor, ''), ' ', TO_JSON_STRING(metadata))),
    r'(kajabi|v3wtgzph|learn\.boomingbookkeeping\.com)'
  ))
FROM `able-folio-499722.stripe.invoice`
UNION ALL
SELECT
  'checkout_session',
  COUNTIF(REGEXP_CONTAINS(
    LOWER(CONCAT(
      COALESCE(success_url, ''),
      ' ',
      COALESCE(cancel_url, ''),
      ' ',
      COALESCE(url, ''),
      ' ',
      TO_JSON_STRING(metadata)
    )),
    r'(kajabi|v3wtgzph|learn\.boomingbookkeeping\.com)'
  ))
FROM `able-folio-499722.stripe.checkout_session`
UNION ALL
SELECT
  'payment_link',
  COUNTIF(REGEXP_CONTAINS(
    LOWER(CONCAT(COALESCE(url, ''), ' ', TO_JSON_STRING(metadata))),
    r'(kajabi|v3wtgzph|learn\.boomingbookkeeping\.com)'
  ))
FROM `able-folio-499722.stripe.payment_link`;

-- 2. The only $199/month plan found is an old non-Kajabi plan.
SELECT
  product.name,
  product.id AS product_id,
  price.id AS price_id,
  price.unit_amount,
  price.currency,
  price.type,
  price.recurring_interval,
  price.created
FROM `able-folio-499722.stripe.price` AS price
JOIN `able-folio-499722.stripe.product` AS product
  ON price.product_id = product.id
WHERE price.unit_amount = 19900 AND price.recurring_interval = 'month'
ORDER BY price.created;

WITH subscription AS (
  SELECT
    subscription_item.subscription_id,
    subscription_item.plan_id,
    subscription_history.status,
    subscription_history.cancel_at,
    subscription_history.canceled_at,
    subscription_history.ended_at,
    subscription_history.created
  FROM `able-folio-499722.stripe.subscription_item` AS subscription_item
  JOIN `able-folio-499722.stripe.subscription_history` AS subscription_history
    ON subscription_item.subscription_id = subscription_history.id
    AND subscription_history._fivetran_active
  WHERE subscription_item.plan_id = '199IP'
),
invoice AS (
  SELECT DISTINCT
    invoice.id,
    invoice.paid,
    invoice.amount_paid,
    invoice.created,
    invoice.charge_id
  FROM `able-folio-499722.stripe.invoice` AS invoice
  JOIN `able-folio-499722.stripe.invoice_line_item` AS line_item
    ON invoice.id = line_item.invoice_id
  WHERE line_item.plan_id = '199IP'
)
SELECT
  'subscriptions' AS metric,
  COUNT(*) AS object_count,
  CAST(NULL AS INT64) AS successful_count,
  CAST(NULL AS FLOAT64) AS gross_usd,
  CAST(NULL AS FLOAT64) AS refunds_usd,
  MIN(created) AS first_created,
  MAX(created) AS last_created
FROM subscription
UNION ALL
SELECT
  'invoices',
  COUNT(*),
  COUNTIF(paid),
  SUM(IF(paid, amount_paid, 0)) / 100,
  NULL,
  MIN(created),
  MAX(created)
FROM invoice
UNION ALL
SELECT
  'charges',
  COUNT(*),
  COUNTIF(charge.paid AND charge.status = 'succeeded'),
  SUM(IF(charge.paid AND charge.status = 'succeeded', charge.amount, 0)) / 100,
  SUM(IF(charge.paid AND charge.status = 'succeeded', charge.amount_refunded, 0)) / 100,
  MIN(charge.created),
  MAX(charge.created)
FROM `able-folio-499722.stripe.charge` AS charge
JOIN invoice
  ON charge.id = invoice.charge_id;

-- 3. Successful payments without any explicit product/line-item signal.
WITH session_signal AS (
  SELECT
    checkout_session.payment_intent_id,
    STRING_AGG(DISTINCT line_item.description, ' | ') AS line_descriptions,
    STRING_AGG(DISTINCT line_item.price_id, ' | ') AS price_ids
  FROM `able-folio-499722.stripe.checkout_session` AS checkout_session
  LEFT JOIN `able-folio-499722.stripe.checkout_session_line_item` AS line_item
    ON checkout_session.id = line_item.checkout_session_id
  WHERE checkout_session.payment_intent_id IS NOT NULL
  GROUP BY checkout_session.payment_intent_id
),
invoice_signal AS (
  SELECT
    invoice.id AS invoice_id,
    STRING_AGG(DISTINCT COALESCE(line_item.description, product.name), ' | ') AS line_descriptions,
    STRING_AGG(DISTINCT COALESCE(line_item.price_id, line_item.plan_id), ' | ') AS price_ids
  FROM `able-folio-499722.stripe.invoice` AS invoice
  LEFT JOIN `able-folio-499722.stripe.invoice_line_item` AS line_item
    ON invoice.id = line_item.invoice_id
  LEFT JOIN `able-folio-499722.stripe.price` AS price
    ON line_item.price_id = price.id
  LEFT JOIN `able-folio-499722.stripe.product` AS product
    ON price.product_id = product.id
  GROUP BY invoice.id
),
base AS (
  SELECT
    charge.*,
    REGEXP_EXTRACT(charge.description, r'(?i)products?:[[:space:]]*(.*)') AS charge_products,
    session_signal.line_descriptions AS session_products,
    session_signal.price_ids AS session_price_ids,
    invoice_signal.line_descriptions AS invoice_products,
    invoice_signal.price_ids AS invoice_price_ids
  FROM `able-folio-499722.stripe.charge` AS charge
  LEFT JOIN session_signal
    ON charge.payment_intent_id = session_signal.payment_intent_id
  LEFT JOIN invoice_signal
    ON charge.invoice_id = invoice_signal.invoice_id
  WHERE charge.paid AND charge.status = 'succeeded'
)
SELECT
  COUNT(*) AS successful_payments,
  COUNTIF(charge_products IS NOT NULL) AS with_charge_product_text,
  COUNTIF(session_products IS NOT NULL) AS with_checkout_product,
  COUNTIF(invoice_products IS NOT NULL) AS with_invoice_product,
  COUNTIF(COALESCE(charge_products, session_products, invoice_products) IS NULL)
    AS without_explicit_product_signal,
  COUNTIF(COALESCE(session_price_ids, invoice_price_ids) IS NOT NULL)
    AS with_price_or_plan_id,
  SUM(IF(
    COALESCE(charge_products, session_products, invoice_products) IS NULL,
    amount,
    0
  )) / 100 AS gross_without_product_signal_usd
FROM base;

-- 4. Email joinability to Segment. This does not imply a purchase event exists.
WITH segment_email AS (
  SELECT DISTINCT LOWER(TRIM(email)) AS email
  FROM (
    SELECT email FROM `able-folio-499722.boom_domains.users`
    UNION ALL
    SELECT email FROM `able-folio-499722.boom_domains.identifies`
    UNION ALL
    SELECT COALESCE(
      email,
      context_traits_email,
      extra_submitted_fields_checkout_offer_member_email
    )
    FROM `able-folio-499722.boom_domains.form_submitted`
  )
  WHERE email IS NOT NULL AND TRIM(email) != ''
),
charge_email AS (
  SELECT
    charge.id,
    charge.created,
    LOWER(TRIM(COALESCE(
      charge.billing_detail_email,
      charge.receipt_email,
      customer.email,
      JSON_VALUE(charge.metadata, '$.email')
    ))) AS email
  FROM `able-folio-499722.stripe.charge` AS charge
  LEFT JOIN `able-folio-499722.stripe.customer` AS customer
    ON charge.customer_id = customer.id
  WHERE charge.paid AND charge.status = 'succeeded'
)
SELECT
  CASE
    WHEN charge_email.created >= TIMESTAMP('2025-07-15') THEN 'recent_12_months'
    ELSE 'older_history'
  END AS period,
  COUNT(*) AS successful_payments,
  COUNTIF(charge_email.email IS NOT NULL AND charge_email.email != '') AS with_joinable_email,
  COUNTIF(segment_email.email IS NOT NULL) AS matched_to_segment_email,
  COUNT(DISTINCT charge_email.email) AS distinct_stripe_emails,
  COUNT(DISTINCT IF(segment_email.email IS NOT NULL, charge_email.email, NULL))
    AS distinct_matched_emails
FROM charge_email
LEFT JOIN segment_email USING (email)
GROUP BY period
ORDER BY period;

-- 5. Confirm that Segment has no purchase/order/payment track events.
SELECT
  event,
  COUNT(*) AS event_count,
  MIN(timestamp) AS first_event,
  MAX(timestamp) AS last_event
FROM `able-folio-499722.boom_domains.tracks`
WHERE REGEXP_CONTAINS(
  LOWER(COALESCE(event, '')),
  r'(purchase|order|checkout|payment|subscription|refund)'
)
GROUP BY event
ORDER BY event_count DESC;

