-- Funnel-level Stripe coverage.
-- All amount fields in Stripe source tables are integer cents.

-- 1. Keyboard Rich book order variants.
WITH book_charge AS (
  SELECT
    amount,
    amount_refunded,
    created,
    status,
    paid,
    REGEXP_EXTRACT(description, r'(?i)products?:[[:space:]]*(.*)') AS product_text
  FROM `able-folio-499722.stripe.charge`
  WHERE REGEXP_CONTAINS(
    LOWER(CONCAT(
      COALESCE(calculated_statement_descriptor, ''),
      ' ',
      COALESCE(statement_descriptor, '')
    )),
    r'keyboard rich book'
  )
),
book_variant AS (
  SELECT
    *,
    CASE
      WHEN LOWER(COALESCE(product_text, '')) LIKE '%international shipping%'
        AND LOWER(product_text) LIKE '%audiobook%'
        THEN 'book + international shipping + audiobook'
      WHEN LOWER(COALESCE(product_text, '')) LIKE '%domestic shipping%'
        AND LOWER(product_text) LIKE '%audiobook%'
        THEN 'book + domestic shipping + audiobook'
      WHEN LOWER(COALESCE(product_text, '')) LIKE '%international shipping%'
        THEN 'book + international shipping'
      WHEN LOWER(COALESCE(product_text, '')) LIKE '%domestic shipping%'
        THEN 'book + domestic shipping'
      WHEN LOWER(COALESCE(product_text, '')) LIKE '%audiobook%'
        THEN 'book + audiobook/no shipping label'
      ELSE 'book/no shipping label'
    END AS variant
  FROM book_charge
)
SELECT
  variant,
  amount,
  COUNT(*) AS attempts,
  COUNTIF(paid AND status = 'succeeded') AS successes,
  SUM(IF(paid AND status = 'succeeded', amount, 0)) / 100 AS gross_usd,
  SUM(IF(paid AND status = 'succeeded', amount_refunded, 0)) / 100 AS refunds_usd,
  COUNTIF(
    paid
    AND status = 'succeeded'
    AND created >= TIMESTAMP('2025-07-15')
  ) AS recent_successes,
  MIN(created) AS first_created,
  MAX(created) AS last_created
FROM book_variant
GROUP BY variant, amount
ORDER BY variant, amount;

-- 2. Successful $47 VIP payments and structured-product coverage.
WITH session_signal AS (
  SELECT
    checkout_session.payment_intent_id,
    COUNT(DISTINCT checkout_session.id) AS sessions,
    STRING_AGG(DISTINCT line_item.description, ' | ') AS line_descriptions,
    STRING_AGG(DISTINCT line_item.price_id, ' | ') AS price_ids
  FROM `able-folio-499722.stripe.checkout_session` AS checkout_session
  LEFT JOIN `able-folio-499722.stripe.checkout_session_line_item` AS line_item
    ON checkout_session.id = line_item.checkout_session_id
  WHERE checkout_session.payment_intent_id IS NOT NULL
  GROUP BY checkout_session.payment_intent_id
),
base AS (
  SELECT
    charge.id,
    charge.created,
    charge.amount,
    charge.amount_refunded,
    REGEXP_EXTRACT(charge.description, r'(?i)products?:[[:space:]]*(.*)') AS product_text,
    session_signal.sessions,
    session_signal.line_descriptions,
    session_signal.price_ids,
    LOWER(CONCAT(
      COALESCE(REGEXP_EXTRACT(charge.description, r'(?i)products?:[[:space:]]*(.*)'), ''),
      ' ',
      COALESCE(charge.calculated_statement_descriptor, ''),
      ' ',
      COALESCE(charge.statement_descriptor, ''),
      ' ',
      COALESCE(session_signal.line_descriptions, '')
    )) AS signal
  FROM `able-folio-499722.stripe.charge` AS charge
  LEFT JOIN session_signal
    ON charge.payment_intent_id = session_signal.payment_intent_id
  WHERE charge.paid AND charge.status = 'succeeded' AND charge.amount = 4700
),
vip AS (
  SELECT *
  FROM base
  WHERE REGEXP_CONTAINS(
    signal,
    r'(keyboard rich|keyboardrich|krc).*(vip|backstage|basic package|platinum)|(vip|backstage|basic package|platinum).*(keyboard rich|keyboardrich|krc)|keyboard rich vip'
  )
)
SELECT
  COUNT(*) AS successful_47_vip_payments,
  SUM(amount) / 100 AS gross_usd,
  SUM(amount_refunded) / 100 AS refunds_usd,
  COUNTIF(product_text IS NOT NULL) AS with_charge_product_text,
  COUNTIF(sessions IS NOT NULL) AS with_checkout_session,
  COUNTIF(price_ids IS NOT NULL) AS with_price_id,
  COUNT(DISTINCT product_text) AS distinct_raw_product_texts,
  COUNTIF(created >= TIMESTAMP('2025-07-15')) AS recent_successful_payments,
  MIN(created) AS first_created,
  MAX(created) AS last_created
FROM vip;

-- 3. Current structured Keyboard Rich Challenge products/prices.
SELECT
  product.name,
  product.id AS product_id,
  price.id AS price_id,
  price.unit_amount,
  price.currency,
  price.type,
  price.recurring_interval,
  product.created
FROM `able-folio-499722.stripe.product` AS product
LEFT JOIN `able-folio-499722.stripe.price` AS price
  ON product.id = price.product_id
WHERE REGEXP_CONTAINS(
  LOWER(CONCAT(
    COALESCE(product.name, ''),
    ' ',
    COALESCE(product.description, ''),
    ' ',
    COALESCE(product.statement_descriptor, '')
  )),
  r'(keyboard rich|vip|challenge)'
)
ORDER BY product.created, product.name, price.unit_amount;

-- 4. Mentorship deposit amount variants.
SELECT
  amount,
  COUNT(*) AS attempts,
  COUNTIF(paid AND status = 'succeeded') AS successes,
  SUM(IF(paid AND status = 'succeeded', amount, 0)) / 100 AS gross_usd,
  SUM(IF(paid AND status = 'succeeded', amount_refunded, 0)) / 100 AS refunds_usd,
  MIN(created) AS first_created,
  MAX(created) AS last_created
FROM `able-folio-499722.stripe.charge`
WHERE REGEXP_CONTAINS(
  LOWER(COALESCE(description, '')),
  r'mentorship program \(deposit\)'
)
GROUP BY amount
ORDER BY successes DESC, amount;

-- 5. Evidence of split-card deposits: deposit plus companion charge totals $997.
WITH deposit AS (
  SELECT
    id,
    LOWER(COALESCE(
      billing_detail_email,
      receipt_email,
      JSON_VALUE(metadata, '$.email')
    )) AS email,
    created,
    amount
  FROM `able-folio-499722.stripe.charge`
  WHERE
    paid
    AND status = 'succeeded'
    AND REGEXP_CONTAINS(
      LOWER(COALESCE(description, '')),
      r'mentorship program \(deposit\)'
    )
),
pairs AS (
  SELECT
    deposit.id AS deposit_charge_id,
    deposit.amount AS deposit_amount,
    companion.id AS companion_charge_id,
    companion.amount AS companion_amount,
    TIMESTAMP_DIFF(companion.created, deposit.created, MINUTE) AS minute_gap
  FROM deposit
  JOIN `able-folio-499722.stripe.charge` AS companion
    ON companion.id != deposit.id
    AND companion.paid
    AND companion.status = 'succeeded'
    AND deposit.email IS NOT NULL
    AND LOWER(COALESCE(
      companion.billing_detail_email,
      companion.receipt_email,
      JSON_VALUE(companion.metadata, '$.email')
    )) = deposit.email
    AND ABS(TIMESTAMP_DIFF(companion.created, deposit.created, MINUTE)) <= 1440
  WHERE deposit.amount + companion.amount = 99700
)
SELECT
  deposit_amount,
  companion_amount,
  COUNT(DISTINCT deposit_charge_id) AS deposit_charges,
  COUNT(DISTINCT companion_charge_id) AS companion_charges,
  MIN(ABS(minute_gap)) AS min_gap_minutes,
  MAX(ABS(minute_gap)) AS max_gap_minutes
FROM pairs
GROUP BY deposit_amount, companion_amount
ORDER BY deposit_charges DESC;

-- 6. Payment Link inventory and actual successful-charge behavior.
WITH session_signal AS (
  SELECT
    checkout_session.payment_intent_id,
    checkout_session.payment_link,
    ANY_VALUE(payment_link.url) AS url,
    STRING_AGG(DISTINCT line_item.description, ' | ') AS line_descriptions
  FROM `able-folio-499722.stripe.checkout_session` AS checkout_session
  LEFT JOIN `able-folio-499722.stripe.checkout_session_line_item` AS line_item
    ON checkout_session.id = line_item.checkout_session_id
  LEFT JOIN `able-folio-499722.stripe.payment_link` AS payment_link
    ON checkout_session.payment_link = payment_link.id
  WHERE checkout_session.payment_intent_id IS NOT NULL
  GROUP BY checkout_session.payment_intent_id, checkout_session.payment_link
),
joined AS (
  SELECT
    charge.id,
    charge.amount,
    charge.amount_refunded,
    charge.created,
    session_signal.payment_link,
    session_signal.url,
    session_signal.line_descriptions
  FROM `able-folio-499722.stripe.charge` AS charge
  JOIN session_signal
    ON charge.payment_intent_id = session_signal.payment_intent_id
  WHERE charge.paid AND charge.status = 'succeeded'
)
SELECT
  payment_link,
  url,
  line_descriptions,
  COUNT(DISTINCT id) AS successful_payments,
  SUM(amount) / 100 AS gross_usd,
  SUM(amount_refunded) / 100 AS refunds_usd,
  MIN(amount) / 100 AS min_payment_usd,
  MAX(amount) / 100 AS max_payment_usd,
  COUNT(DISTINCT amount) AS distinct_amounts,
  MIN(created) AS first_created,
  MAX(created) AS last_created
FROM joined
GROUP BY payment_link, url, line_descriptions
ORDER BY successful_payments DESC;

-- 7. Three-payment mentorship plan (3 x $1,997).
WITH subscription AS (
  SELECT DISTINCT subscription_id
  FROM `able-folio-499722.stripe.subscription_item`
  WHERE plan_id = 'BBB3X1997'
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
  WHERE line_item.plan_id = 'BBB3X1997' OR line_item.price_id = 'BBB3X1997'
)
SELECT
  'subscriptions' AS metric,
  COUNT(*) AS object_count,
  CAST(NULL AS INT64) AS successful_count,
  CAST(NULL AS FLOAT64) AS gross_usd,
  CAST(NULL AS FLOAT64) AS refunds_usd,
  CAST(NULL AS TIMESTAMP) AS first_created,
  CAST(NULL AS TIMESTAMP) AS last_created
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

