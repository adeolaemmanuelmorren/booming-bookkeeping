-- Stripe checkout/product coverage audit
-- Project: able-folio-499722
-- All queries are read-only and use UTC timestamps.

-- 1. Every Stripe table and type.
SELECT
  table_name,
  table_type,
  creation_time
FROM `able-folio-499722.stripe.INFORMATION_SCHEMA.TABLES`
ORDER BY table_name;

-- 2. Every Stripe column, aggregated into one readable row per table.
SELECT
  table_name,
  STRING_AGG(
    FORMAT(
      '%s:%s%s',
      column_name,
      data_type,
      IF(is_nullable = 'YES', '?', '')
    ),
    ', '
    ORDER BY ordinal_position
  ) AS schema_columns
FROM `able-folio-499722.stripe.INFORMATION_SCHEMA.COLUMNS`
GROUP BY table_name
ORDER BY table_name;

-- 3. Physical row counts and table modification times.
SELECT
  table_id AS table_name,
  row_count,
  size_bytes,
  TIMESTAMP_MILLIS(last_modified_time) AS last_modified
FROM `able-folio-499722.stripe.__TABLES__`
ORDER BY table_id;

-- 4. Fivetran Stripe connections feeding this warehouse.
SELECT
  connection.connection_id,
  connection.connection_name,
  connector_type.official_connector_name,
  connector_type.type AS connector_type,
  connection.paused,
  connection.sync_frequency,
  connection.signed_up,
  destination_schema_table.name AS destination_schema,
  source_schema_table.name AS source_schema,
  destination.name AS destination_name
FROM `able-folio-499722.fivetran_metadata_edict_cater.connection` AS connection
LEFT JOIN `able-folio-499722.fivetran_metadata_edict_cater.connector_type` AS connector_type
  ON connection.connector_type_id = connector_type.id
LEFT JOIN `able-folio-499722.fivetran_metadata_edict_cater.destination_schema` AS destination_schema_table
  ON connection.connection_id = destination_schema_table.connection_id
LEFT JOIN `able-folio-499722.fivetran_metadata_edict_cater.source_schema` AS source_schema_table
  ON connection.connection_id = source_schema_table.connection_id
LEFT JOIN `able-folio-499722.fivetran_metadata_edict_cater.destination` AS destination
  ON connection.destination_id = destination.id
WHERE
  LOWER(connector_type.official_connector_name) LIKE '%stripe%'
  OR LOWER(connection.connection_name) LIKE '%stripe%'
  OR destination_schema_table.name = 'stripe'
ORDER BY
  connection.connection_name,
  destination_schema_table.name,
  source_schema_table.name;

-- 5. Source-account signals present in Stripe objects.
SELECT
  account_name,
  account_country,
  currency,
  COUNT(*) AS invoice_count,
  COUNTIF(paid) AS paid_invoices,
  MIN(created) AS first_created,
  MAX(created) AS last_created
FROM `able-folio-499722.stripe.invoice`
GROUP BY account_name, account_country, currency
ORDER BY invoice_count DESC;

SELECT
  'charge' AS object_type,
  COUNT(DISTINCT connected_account_id) AS connected_accounts,
  COUNTIF(connected_account_id IS NOT NULL) AS rows_with_connected_account
FROM `able-folio-499722.stripe.charge`
UNION ALL
SELECT
  'payment_intent',
  COUNT(DISTINCT connected_account_id),
  COUNTIF(connected_account_id IS NOT NULL)
FROM `able-folio-499722.stripe.payment_intent`;

-- 6. Canonical payment totals. One successful charge is one customer payment.
SELECT
  CASE
    WHEN created >= TIMESTAMP('2025-07-15') THEN 'recent_12_months'
    ELSE 'older_history'
  END AS period,
  COUNT(*) AS charge_attempts,
  COUNTIF(paid AND status = 'succeeded') AS successful_payments,
  COUNTIF(NOT (paid AND status = 'succeeded')) AS unsuccessful_attempts,
  SUM(IF(paid AND status = 'succeeded', amount, 0)) / 100 AS gross_usd,
  SUM(IF(paid AND status = 'succeeded', amount_refunded, 0)) / 100 AS refunds_usd,
  (
    SUM(IF(paid AND status = 'succeeded', amount, 0))
    - SUM(IF(paid AND status = 'succeeded', amount_refunded, 0))
  ) / 100 AS net_after_refunds_usd,
  MIN(created) AS first_created,
  MAX(created) AS last_created,
  MAX(_fivetran_synced) AS watermark
FROM `able-folio-499722.stripe.charge`
GROUP BY period
ORDER BY period;

-- 7. Verify payment-intent/charge duplication behavior.
WITH successful_charge AS (
  SELECT
    payment_intent_id,
    COUNT(*) AS successful_charges
  FROM `able-folio-499722.stripe.charge`
  WHERE paid AND status = 'succeeded' AND payment_intent_id IS NOT NULL
  GROUP BY payment_intent_id
)
SELECT
  payment_intent.status,
  COUNT(*) AS payment_intents,
  COUNTIF(successful_charge.successful_charges IS NULL) AS without_successful_charge,
  COUNTIF(successful_charge.successful_charges = 1) AS with_one_successful_charge,
  COUNTIF(successful_charge.successful_charges > 1) AS with_multiple_successful_charges
FROM `able-folio-499722.stripe.payment_intent` AS payment_intent
LEFT JOIN successful_charge
  ON payment_intent.id = successful_charge.payment_intent_id
GROUP BY payment_intent.status
ORDER BY payment_intents DESC;

-- 8. Successful-charge join and refund coverage.
SELECT
  COUNT(*) AS row_count,
  COUNT(DISTINCT id) AS distinct_ids,
  COUNTIF(payment_intent_id IS NOT NULL) AS with_payment_intent,
  COUNTIF(invoice_id IS NOT NULL) AS with_invoice,
  COUNTIF(customer_id IS NOT NULL) AS with_customer,
  COUNTIF(COALESCE(billing_detail_email, receipt_email) IS NOT NULL) AS with_charge_email,
  COUNTIF(amount_refunded > 0) AS with_refund,
  COUNTIF(refunded) AS fully_refunded
FROM `able-folio-499722.stripe.charge`
WHERE paid AND status = 'succeeded';

-- 9. Paid Checkout Sessions reconcile to charges at payment-session grain.
WITH direct_session AS (
  SELECT
    checkout_session.id,
    checkout_session.mode,
    checkout_session.payment_status,
    COUNTIF(charge.paid AND charge.status = 'succeeded') AS successful_charges
  FROM `able-folio-499722.stripe.checkout_session` AS checkout_session
  LEFT JOIN `able-folio-499722.stripe.charge` AS charge
    ON checkout_session.payment_intent_id = charge.payment_intent_id
  GROUP BY checkout_session.id, checkout_session.mode, checkout_session.payment_status
)
SELECT
  mode,
  payment_status,
  COUNT(*) AS sessions,
  COUNTIF(successful_charges > 0) AS with_successful_charge,
  COUNTIF(successful_charges = 0) AS without_direct_successful_charge
FROM direct_session
GROUP BY mode, payment_status
ORDER BY mode, payment_status;
