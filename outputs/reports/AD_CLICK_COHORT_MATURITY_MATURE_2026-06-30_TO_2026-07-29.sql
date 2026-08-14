-- Ad-click cohort and maturity report
-- Attributes outcomes to the last paid click before KRC registration.
-- Time zone: America/Los_Angeles

DECLARE report_start_date DATE DEFAULT DATE '2026-06-30';
DECLARE report_end_date DATE DEFAULT DATE '2026-07-29';
DECLARE maturity_cutoff_ts TIMESTAMP DEFAULT TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 324 HOUR);

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

CREATE TEMP TABLE registrations_for_click_cohorts AS
SELECT *
FROM all_krc_registrations
WHERE registration_date BETWEEN report_start_date AND report_end_date;

CREATE TEMP TABLE paid_clicks_in_window AS
SELECT
  touchpoint_id,
  profile_id,
  touchpoint_time AS click_ts,
  DATE(touchpoint_time, 'America/Los_Angeles') AS click_date,
  CASE
    WHEN LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''))) IN ('facebook', 'fb', 'instagram', 'meta') THEN 'meta'
    WHEN LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''))) IN ('google', 'googleads', 'google_ads') THEN 'google'
    WHEN LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''))) IN ('tiktok', 'tik_tok') THEN 'tiktok'
    WHEN fbclid IS NOT NULL THEN 'meta'
    WHEN gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL THEN 'google'
    WHEN ttclid IS NOT NULL THEN 'tiktok'
    ELSE LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''), 'unknown'))
  END AS ad_platform,
  campaign_id,
  adset_id,
  ad_id,
  utm_campaign,
  utm_content,
  click_id,
  click_id_type
FROM `able-folio-499722.booming_data_analytics.mart_touchpoints_all`
WHERE profile_id IS NOT NULL
  AND DATE(touchpoint_time, 'America/Los_Angeles') BETWEEN report_start_date AND report_end_date
  AND (
    click_id IS NOT NULL
    OR gclid IS NOT NULL
    OR gbraid IS NOT NULL
    OR wbraid IS NOT NULL
    OR fbclid IS NOT NULL
    OR ttclid IS NOT NULL
  );

-- Last paid click before each registration.
CREATE TEMP TABLE registration_clicks AS
SELECT
  registrations.*,
  clicks.touchpoint_id,
  clicks.click_ts,
  clicks.click_date,
  clicks.ad_platform,
  clicks.campaign_id,
  clicks.adset_id,
  clicks.ad_id,
  clicks.utm_campaign,
  clicks.utm_content,
  clicks.click_id,
  clicks.click_id_type,
  clicks.click_ts <= maturity_cutoff_ts AS is_mature_13_5_days
FROM registrations_for_click_cohorts AS registrations
JOIN paid_clicks_in_window AS clicks
  ON clicks.profile_id = registrations.profile_id
 AND clicks.click_ts <= registrations.registration_ts
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY registrations.registration_id
  ORDER BY clicks.click_ts DESC, clicks.touchpoint_id DESC
) = 1;

CREATE TEMP TABLE ad_names AS
SELECT
  source AS ad_platform,
  campaign_id,
  adset_id,
  ad_id,
  ARRAY_AGG(campaign_name IGNORE NULLS ORDER BY time DESC LIMIT 1)[SAFE_OFFSET(0)] AS campaign_name,
  ARRAY_AGG(adset_name IGNORE NULLS ORDER BY time DESC LIMIT 1)[SAFE_OFFSET(0)] AS adset_name,
  ARRAY_AGG(ad_name IGNORE NULLS ORDER BY time DESC LIMIT 1)[SAFE_OFFSET(0)] AS ad_name
FROM `able-folio-499722.booming_data_analytics.mart_ad_performance`
GROUP BY ad_platform, campaign_id, adset_id, ad_id;

CREATE TEMP TABLE vip_orders AS
SELECT
  payment_id,
  profile_id,
  payment_time AS vip_ts,
  net_amount AS vip_revenue
FROM `able-folio-499722.booming_data_analytics.mart_payments`
WHERE is_repeat_payment = FALSE
  AND profile_id IS NOT NULL
  AND product_rule IN (
    'keyboard_rich_challenge_vip',
    'structured_basic_vip'
  );

-- Attribute every VIP order to the latest registration inside its 7.5-day window.
CREATE TEMP TABLE vip_registration_links AS
SELECT
  vip.*,
  registrations.registration_id
FROM vip_orders AS vip
JOIN all_krc_registrations AS registrations
  ON registrations.profile_id = vip.profile_id
 AND registrations.registration_ts <= vip.vip_ts
 AND vip.vip_ts <= TIMESTAMP_ADD(registrations.registration_ts, INTERVAL 180 HOUR)
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY vip.payment_id
  ORDER BY registrations.registration_ts DESC, registrations.registration_id
) = 1;

-- First successful, non-repeat BBB payment over $900 per person.
CREATE TEMP TABLE first_bbb_orders AS
SELECT
  payment_id,
  profile_id,
  payment_time AS bbb_ts,
  net_amount AS bbb_revenue
FROM `able-folio-499722.booming_data_analytics.mart_payments`
WHERE is_repeat_payment = FALSE
  AND net_amount > 900
  AND profile_id IS NOT NULL
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY profile_id
  ORDER BY payment_time, payment_id
) = 1;

-- Attribute each person's first BBB order to their latest prior KRC registration.
CREATE TEMP TABLE bbb_registration_links AS
SELECT
  bbb.*,
  registrations.registration_id,
  registrations.registration_ts,
  TIMESTAMP_DIFF(bbb.bbb_ts, registrations.registration_ts, HOUR) AS registration_to_bbb_hours
FROM first_bbb_orders AS bbb
JOIN all_krc_registrations AS registrations
  ON registrations.profile_id = bbb.profile_id
 AND registrations.registration_ts <= bbb.bbb_ts
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY bbb.profile_id
  ORDER BY registrations.registration_ts DESC, registrations.registration_id
) = 1;

CREATE TEMP TABLE cohort_rows AS
SELECT
  registrations.registration_id,
  registrations.profile_id,
  registrations.registration_ts,
  registrations.click_ts,
  registrations.click_date,
  registrations.is_mature_13_5_days,
  registrations.ad_platform,
  registrations.campaign_id,
  registrations.adset_id,
  registrations.ad_id,
  COALESCE(names.campaign_name, registrations.utm_campaign, 'unknown') AS campaign_name,
  COALESCE(names.adset_name, 'unknown') AS adset_name,
  COALESCE(names.ad_name, registrations.utm_content, 'unknown') AS ad_name,
  registrations.click_id,
  registrations.click_id_type,
  COUNT(DISTINCT vip.payment_id) AS vip_purchases,
  COUNT(DISTINCT bbb.payment_id) AS bbb_purchasers,
  MAX(bbb.bbb_ts) AS bbb_ts,
  MAX(bbb.bbb_revenue) AS bbb_revenue,
  MAX(TIMESTAMP_DIFF(bbb.bbb_ts, registrations.click_ts, HOUR)) AS click_to_bbb_hours
FROM registration_clicks AS registrations
LEFT JOIN ad_names AS names
  ON names.ad_platform = registrations.ad_platform
 AND names.campaign_id IS NOT DISTINCT FROM registrations.campaign_id
 AND names.adset_id IS NOT DISTINCT FROM registrations.adset_id
 AND names.ad_id IS NOT DISTINCT FROM registrations.ad_id
LEFT JOIN vip_registration_links AS vip
  USING (registration_id)
LEFT JOIN bbb_registration_links AS bbb
  USING (registration_id)
GROUP BY
  registrations.registration_id,
  registrations.profile_id,
  registrations.registration_ts,
  registrations.click_ts,
  registrations.click_date,
  registrations.is_mature_13_5_days,
  registrations.ad_platform,
  registrations.campaign_id,
  registrations.adset_id,
  registrations.ad_id,
  campaign_name,
  adset_name,
  ad_name,
  registrations.click_id,
  registrations.click_id_type;

-- All three report levels are returned in one result table.
WITH
report_5a AS (
  SELECT
    '5A. Maturity summary' AS report_name,
    CAST(report_start_date AS STRING) AS click_date,
    'Mature cohorts only' AS cohort_status,
    CAST(NULL AS STRING) AS ad_platform,
    CAST(NULL AS STRING) AS campaign_id,
    CAST(NULL AS STRING) AS campaign_name,
    CAST(NULL AS STRING) AS adset_id,
    CAST(NULL AS STRING) AS adset_name,
    CAST(NULL AS STRING) AS ad_id,
    CAST(NULL AS STRING) AS ad_name,
    COUNT(*) AS registrations,
    COUNT(DISTINCT profile_id) AS unique_registrants,
    SUM(vip_purchases) AS vip_purchases,
    SUM(bbb_purchasers) AS eventual_bbb_purchasers_observed,
    COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours <= 324) AS bbb_within_13_5_days_of_click,
    COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours > 324) AS bbb_later_than_13_5_days_of_click,
    ROUND(
      100 * SAFE_DIVIDE(
        COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours <= 324),
        SUM(bbb_purchasers)
      ),
      2
    ) AS pct_of_eventual_bbb_within_13_5_days,
    SUM(bbb_revenue) AS eventual_bbb_revenue_observed,
    ROUND(100 * SAFE_DIVIDE(SUM(bbb_purchasers), COUNT(DISTINCT profile_id)), 2) AS observed_bbb_rate_pct
  FROM cohort_rows
  WHERE is_mature_13_5_days
),
report_5b AS (
  SELECT
    '5B. Daily click cohort' AS report_name,
    CAST(click_date AS STRING) AS click_date,
    CASE
      WHEN COUNTIF(is_mature_13_5_days) = COUNT(*) THEN 'Mature'
      WHEN COUNTIF(is_mature_13_5_days) = 0 THEN 'Immature'
      ELSE 'Partially mature'
    END AS cohort_status,
    CAST(NULL AS STRING) AS ad_platform,
    CAST(NULL AS STRING) AS campaign_id,
    CAST(NULL AS STRING) AS campaign_name,
    CAST(NULL AS STRING) AS adset_id,
    CAST(NULL AS STRING) AS adset_name,
    CAST(NULL AS STRING) AS ad_id,
    CAST(NULL AS STRING) AS ad_name,
    COUNT(*) AS registrations,
    COUNT(DISTINCT profile_id) AS unique_registrants,
    SUM(vip_purchases) AS vip_purchases,
    SUM(bbb_purchasers) AS eventual_bbb_purchasers_observed,
    COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours <= 324) AS bbb_within_13_5_days_of_click,
    COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours > 324) AS bbb_later_than_13_5_days_of_click,
    ROUND(
      100 * SAFE_DIVIDE(
        COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours <= 324),
        SUM(bbb_purchasers)
      ),
      2
    ) AS pct_of_eventual_bbb_within_13_5_days,
    SUM(bbb_revenue) AS eventual_bbb_revenue_observed,
    ROUND(100 * SAFE_DIVIDE(SUM(bbb_purchasers), COUNT(DISTINCT profile_id)), 2) AS observed_bbb_rate_pct
  FROM cohort_rows
  GROUP BY cohort_rows.click_date
),
report_5c AS (
  SELECT
    '5C. Ad-level click cohort' AS report_name,
    CAST(click_date AS STRING) AS click_date,
    CASE
      WHEN COUNTIF(is_mature_13_5_days) = COUNT(*) THEN 'Mature'
      WHEN COUNTIF(is_mature_13_5_days) = 0 THEN 'Immature'
      ELSE 'Partially mature'
    END AS cohort_status,
    ad_platform,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name,
    COUNT(*) AS registrations,
    COUNT(DISTINCT profile_id) AS unique_registrants,
    SUM(vip_purchases) AS vip_purchases,
    SUM(bbb_purchasers) AS eventual_bbb_purchasers_observed,
    COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours <= 324) AS bbb_within_13_5_days_of_click,
    COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours > 324) AS bbb_later_than_13_5_days_of_click,
    ROUND(
      100 * SAFE_DIVIDE(
        COUNTIF(bbb_purchasers = 1 AND click_to_bbb_hours <= 324),
        SUM(bbb_purchasers)
      ),
      2
    ) AS pct_of_eventual_bbb_within_13_5_days,
    SUM(bbb_revenue) AS eventual_bbb_revenue_observed,
    ROUND(100 * SAFE_DIVIDE(SUM(bbb_purchasers), COUNT(DISTINCT profile_id)), 2) AS observed_bbb_rate_pct
  FROM cohort_rows
  GROUP BY
    click_date,
    ad_platform,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name
)
SELECT * FROM report_5a
UNION ALL SELECT * FROM report_5b
UNION ALL SELECT * FROM report_5c
ORDER BY report_name, click_date, ad_platform, campaign_name, adset_name, ad_name;
