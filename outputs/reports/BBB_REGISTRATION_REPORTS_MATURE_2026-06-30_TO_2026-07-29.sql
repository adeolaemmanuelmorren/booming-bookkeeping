-- BBB registration and purchase reports
-- Canonical sources only: mart_form_submissions_server_side and mart_payments.
-- Time zone: America/Los_Angeles.
-- Fixed fully matured cohort window.

DECLARE report_start_date DATE DEFAULT DATE '2026-06-30';
DECLARE report_end_date DATE DEFAULT DATE '2026-07-29';

CREATE TEMP TABLE all_krc_registrations AS
SELECT
  form_submission_id AS registration_id,
  profile_id,
  submitted_at AS registration_ts,
  DATE(submitted_at, 'America/Los_Angeles') AS registration_date
FROM `able-folio-499722.booming_data_analytics.mart_form_submissions_server_side`
WHERE registration_type = 'krc'
  AND profile_id IS NOT NULL
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY form_submission_id
  ORDER BY submitted_at
) = 1;

CREATE TEMP TABLE registrations_in_window AS
SELECT *
FROM all_krc_registrations
WHERE registration_date BETWEEN report_start_date AND report_end_date;

CREATE TEMP TABLE vip_orders AS
SELECT
  payment_id,
  profile_id,
  payment_time AS vip_ts,
  DATE(payment_time, 'America/Los_Angeles') AS vip_date
FROM `able-folio-499722.booming_data_analytics.mart_payments`
WHERE is_repeat_payment = FALSE
  AND profile_id IS NOT NULL
  AND product_rule IN (
    'keyboard_rich_challenge_vip',
    'structured_basic_vip'
  );

-- A VIP purchase belongs to the latest registration within its 7.5-day upgrade window.
CREATE TEMP TABLE vip_registration_links AS
SELECT
  vip.payment_id,
  vip.profile_id,
  vip.vip_ts,
  vip.vip_date,
  registrations.registration_id,
  registrations.registration_ts,
  registrations.registration_date
FROM vip_orders AS vip
JOIN all_krc_registrations AS registrations
  ON registrations.profile_id = vip.profile_id
 AND registrations.registration_ts <= vip.vip_ts
 AND vip.vip_ts <= TIMESTAMP_ADD(registrations.registration_ts, INTERVAL 180 HOUR)
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY vip.payment_id
  ORDER BY registrations.registration_ts DESC, registrations.registration_id
) = 1;

CREATE TEMP TABLE qualifying_bbb_orders AS
SELECT
  payment_id,
  profile_id,
  payment_time AS bbb_ts,
  DATE(payment_time, 'America/Los_Angeles') AS bbb_date,
  net_amount AS bbb_revenue,
  product_rule,
  product_name
FROM `able-folio-499722.booming_data_analytics.mart_payments`
WHERE is_repeat_payment = FALSE
  AND net_amount > 900
  AND profile_id IS NOT NULL
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY profile_id
  ORDER BY payment_time, payment_id
) = 1;

-- Link each qualifying BBB order to the latest prior KRC registration.
-- Each person already has exactly one BBB order: their first qualifying purchase.
CREATE TEMP TABLE bbb_registration_links AS
WITH linked_orders AS (
  SELECT
    bbb.*,
    registrations.registration_id,
    registrations.registration_ts,
    registrations.registration_date,
    TIMESTAMP_DIFF(bbb.bbb_ts, registrations.registration_ts, HOUR) AS lag_hours
  FROM qualifying_bbb_orders AS bbb
  JOIN all_krc_registrations AS registrations
    ON registrations.profile_id = bbb.profile_id
   AND registrations.registration_ts <= bbb.bbb_ts
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY bbb.payment_id
    ORDER BY registrations.registration_ts DESC, registrations.registration_id
  ) = 1
)
SELECT *
FROM linked_orders
WHERE registration_date BETWEEN report_start_date AND report_end_date;

-- Assign each unique registrant to same-day VIP, later VIP, or no VIP.
-- The reference registration is the registration connected to the selected VIP order.
CREATE TEMP TABLE registrant_cohorts AS
WITH unique_registrants AS (
  SELECT profile_id
  FROM registrations_in_window
  GROUP BY profile_id
),
ranked_vip_links AS (
  SELECT
    vip.*,
    IF(vip.vip_date = vip.registration_date, 'Same-day VIP', 'Later VIP') AS vip_group,
    ROW_NUMBER() OVER (
      PARTITION BY vip.profile_id
      ORDER BY
        IF(vip.vip_date = vip.registration_date, 0, 1),
        vip.vip_ts,
        vip.payment_id
    ) AS vip_rank
  FROM vip_registration_links AS vip
  WHERE vip.registration_date BETWEEN report_start_date AND report_end_date
),
first_registrations AS (
  SELECT *
  FROM registrations_in_window
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY profile_id
    ORDER BY registration_ts, registration_id
  ) = 1
)
SELECT
  people.profile_id,
  COALESCE(vip.vip_group, 'No VIP') AS vip_group,
  COALESCE(vip.registration_id, first_registration.registration_id) AS reference_registration_id,
  COALESCE(vip.registration_ts, first_registration.registration_ts) AS reference_registration_ts,
  COALESCE(vip.registration_date, first_registration.registration_date) AS reference_registration_date,
  vip.vip_ts AS first_linked_vip_ts
FROM unique_registrants AS people
JOIN first_registrations AS first_registration
  USING (profile_id)
LEFT JOIN ranked_vip_links AS vip
  ON vip.profile_id = people.profile_id
 AND vip.vip_rank = 1;

-- Match the person's one qualifying BBB order when it occurred after the reference registration.
CREATE TEMP TABLE registrant_outcomes AS
SELECT
  cohorts.*,
  bbb.payment_id AS bbb_payment_id,
  bbb.bbb_ts,
  bbb.bbb_date,
  bbb.bbb_revenue,
  TIMESTAMP_DIFF(bbb.bbb_ts, cohorts.reference_registration_ts, HOUR) AS registration_to_bbb_hours
FROM registrant_cohorts AS cohorts
LEFT JOIN qualifying_bbb_orders AS bbb
  ON bbb.profile_id = cohorts.profile_id
 AND bbb.bbb_ts >= cohorts.reference_registration_ts;

-- All report results are returned in one table.
WITH
report_1 AS (
  SELECT
    '1. BBB purchase timing' AS report_name,
    'All linked BBB purchasers' AS segment,
    COUNT(*) AS population,
    COUNTIF(lag_hours <= 336) AS outcome_count,
    ROUND(100 * SAFE_DIVIDE(COUNTIF(lag_hours <= 336), COUNT(*)), 2) AS outcome_rate_pct,
    FORMAT(
      '%d purchased after 14 days (%.2f%%)',
      COUNTIF(lag_hours > 336),
      100 * SAFE_DIVIDE(COUNTIF(lag_hours > 336), COUNT(*))
    ) AS details
  FROM bbb_registration_links
),
report_2_buckets AS (
  SELECT
    '2A. Registration-to-BBB lag' AS report_name,
    CASE
      WHEN bbb_date = registration_date THEN 'Same Pacific calendar date'
      WHEN lag_hours <= 168 THEN '1-7 days'
      WHEN lag_hours <= 324 THEN '>7-13.5 days'
      WHEN lag_hours <= 504 THEN '>13.5-21 days'
      ELSE '>21 days'
    END AS segment,
    COUNT(*) AS population,
    COUNT(*) AS outcome_count,
    ROUND(100 * SAFE_DIVIDE(COUNT(*), SUM(COUNT(*)) OVER ()), 2) AS outcome_rate_pct,
    'Share of linked BBB purchasers' AS details
  FROM bbb_registration_links
  GROUP BY segment
),
report_2_split AS (
  SELECT
    '2B. 13.5-day split' AS report_name,
    IF(lag_hours <= 324, 'Within 13.5 days', 'Later than 13.5 days') AS segment,
    COUNT(*) AS population,
    COUNT(*) AS outcome_count,
    ROUND(100 * SAFE_DIVIDE(COUNT(*), SUM(COUNT(*)) OVER ()), 2) AS outcome_rate_pct,
    'Share of linked BBB purchasers' AS details
  FROM bbb_registration_links
  GROUP BY segment
),
report_3 AS (
  SELECT
    '3. VIP timing versus BBB likelihood' AS report_name,
    vip_group AS segment,
    COUNT(*) AS population,
    COUNTIF(bbb_payment_id IS NOT NULL) AS outcome_count,
    ROUND(100 * SAFE_DIVIDE(COUNTIF(bbb_payment_id IS NOT NULL), COUNT(*)), 2) AS outcome_rate_pct,
    'Observed BBB purchase rate through today' AS details
  FROM registrant_outcomes
  GROUP BY vip_group
),
report_4_summary AS (
  SELECT
    '4A. Immediate VIP upgrade' AS report_name,
    'Same-day VIP registrants' AS segment,
    COUNT(*) AS population,
    COUNTIF(vip_group = 'Same-day VIP') AS outcome_count,
    ROUND(100 * SAFE_DIVIDE(COUNTIF(vip_group = 'Same-day VIP'), COUNT(*)), 2) AS outcome_rate_pct,
    FORMAT(
      '%d later bought BBB (%.2f%% of same-day VIP registrants)',
      COUNTIF(vip_group = 'Same-day VIP' AND bbb_ts > first_linked_vip_ts),
      100 * SAFE_DIVIDE(
        COUNTIF(vip_group = 'Same-day VIP' AND bbb_ts > first_linked_vip_ts),
        COUNTIF(vip_group = 'Same-day VIP')
      )
    ) AS details
  FROM registrant_outcomes
),
report_4_timing AS (
  SELECT
    '4B. Same-day VIP to BBB timing' AS report_name,
    CASE
      WHEN bbb_date = reference_registration_date THEN 'Same Pacific calendar date'
      WHEN registration_to_bbb_hours <= 168 THEN '1-7 days'
      WHEN registration_to_bbb_hours <= 324 THEN '>7-13.5 days'
      WHEN registration_to_bbb_hours <= 504 THEN '>13.5-21 days'
      ELSE '>21 days'
    END AS segment,
    COUNT(*) AS population,
    COUNT(*) AS outcome_count,
    ROUND(100 * SAFE_DIVIDE(COUNT(*), SUM(COUNT(*)) OVER ()), 2) AS outcome_rate_pct,
    'Share of subsequent BBB purchasers among same-day VIP registrants' AS details
  FROM registrant_outcomes
  WHERE vip_group = 'Same-day VIP'
    AND bbb_ts > first_linked_vip_ts
  GROUP BY segment
)
SELECT * FROM report_1
UNION ALL SELECT * FROM report_2_buckets
UNION ALL SELECT * FROM report_2_split
UNION ALL SELECT * FROM report_3
UNION ALL SELECT * FROM report_4_summary
UNION ALL SELECT * FROM report_4_timing
ORDER BY report_name, segment;
