-- BBB revenue attributed back to paid ad clicks.
--
-- Cohort window:
--   The 30 paid-click dates ending 14 days before today in America/Los_Angeles.
--   On 2026-08-12, this is 2026-06-30 through 2026-07-29, inclusive.
--
-- Attribution views:
--   first_paid_touch = earliest observed paid click before KRC registration.
--   last_paid_touch  = latest observed paid click before KRC registration.
--
-- Revenue:
--   The first successful, non-repeat payment over $900 per profile, observed
--   through the latest available warehouse data, is attributed to the KRC
--   registration immediately preceding that payment. That registration then
--   inherits its first-paid-touch and last-paid-touch ad.

DECLARE cohort_end_date DATE DEFAULT DATE_SUB(
  CURRENT_DATE('America/Los_Angeles'),
  INTERVAL 14 DAY
);
DECLARE cohort_start_date DATE DEFAULT DATE_SUB(cohort_end_date, INTERVAL 29 DAY);

CREATE TEMP TABLE all_krc_registrations AS
SELECT
  form_submission_id AS registration_id,
  profile_id,
  submitted_at AS registration_ts
FROM `able-folio-499722.booming_data_analytics.mart_form_submissions_server_side`
WHERE registration_type = 'krc'
  AND profile_id IS NOT NULL
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY form_submission_id
  ORDER BY submitted_at
) = 1;

CREATE TEMP TABLE all_paid_clicks AS
SELECT
  touchpoint_id,
  profile_id,
  touchpoint_time AS click_ts,
  DATE(touchpoint_time, 'America/Los_Angeles') AS click_date,
  CASE
    WHEN LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''))) IN (
      'facebook', 'fb', 'instagram', 'meta'
    ) THEN 'meta'
    WHEN LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''))) IN (
      'google', 'googleads', 'google_ads'
    ) THEN 'google'
    WHEN LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''))) IN (
      'tiktok', 'tik_tok'
    ) THEN 'tiktok'
    WHEN fbclid IS NOT NULL THEN 'meta'
    WHEN gclid IS NOT NULL OR gbraid IS NOT NULL OR wbraid IS NOT NULL THEN 'google'
    WHEN ttclid IS NOT NULL THEN 'tiktok'
    ELSE LOWER(COALESCE(NULLIF(utm_source, ''), NULLIF(channel_source, ''), 'unknown'))
  END AS ad_platform,
  campaign_id,
  adset_id,
  ad_id,
  utm_campaign,
  utm_content
FROM `able-folio-499722.booming_data_analytics.mart_touchpoints_all`
WHERE profile_id IS NOT NULL
  AND (
    click_id IS NOT NULL
    OR gclid IS NOT NULL
    OR gbraid IS NOT NULL
    OR wbraid IS NOT NULL
    OR fbclid IS NOT NULL
    OR ttclid IS NOT NULL
  );

CREATE TEMP TABLE registration_paid_touches AS
SELECT
  'first_paid_touch' AS attribution_model,
  registrations.registration_id,
  registrations.profile_id,
  registrations.registration_ts,
  clicks.* EXCEPT (profile_id)
FROM all_krc_registrations AS registrations
JOIN all_paid_clicks AS clicks
  ON clicks.profile_id = registrations.profile_id
 AND clicks.click_ts <= registrations.registration_ts
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY registrations.registration_id
  ORDER BY clicks.click_ts, clicks.touchpoint_id
) = 1

UNION ALL

SELECT
  'last_paid_touch' AS attribution_model,
  registrations.registration_id,
  registrations.profile_id,
  registrations.registration_ts,
  clicks.* EXCEPT (profile_id)
FROM all_krc_registrations AS registrations
JOIN all_paid_clicks AS clicks
  ON clicks.profile_id = registrations.profile_id
 AND clicks.click_ts <= registrations.registration_ts
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY registrations.registration_id
  ORDER BY clicks.click_ts DESC, clicks.touchpoint_id DESC
) = 1;

CREATE TEMP TABLE cohort_registration_touches AS
SELECT *
FROM registration_paid_touches
WHERE click_date BETWEEN cohort_start_date AND cohort_end_date;

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

CREATE TEMP TABLE bbb_registration_links AS
SELECT
  bbb.*,
  registrations.registration_id
FROM first_bbb_orders AS bbb
JOIN all_krc_registrations AS registrations
  ON registrations.profile_id = bbb.profile_id
 AND registrations.registration_ts <= bbb.bbb_ts
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY bbb.profile_id
  ORDER BY registrations.registration_ts DESC, registrations.registration_id
) = 1;

CREATE TEMP TABLE attributed_rows AS
SELECT
  touches.attribution_model,
  touches.registration_id,
  touches.profile_id,
  touches.registration_ts,
  touches.click_ts,
  touches.click_date,
  touches.ad_platform,
  touches.campaign_id,
  touches.adset_id,
  touches.ad_id,
  COALESCE(names.campaign_name, touches.utm_campaign, 'unknown') AS campaign_name,
  COALESCE(names.adset_name, 'unknown') AS adset_name,
  COALESCE(names.ad_name, touches.utm_content, 'unknown') AS ad_name,
  bbb.payment_id,
  bbb.bbb_ts,
  bbb.bbb_revenue
FROM cohort_registration_touches AS touches
LEFT JOIN ad_names AS names
  ON names.ad_platform = touches.ad_platform
 AND names.campaign_id IS NOT DISTINCT FROM touches.campaign_id
 AND names.adset_id IS NOT DISTINCT FROM touches.adset_id
 AND names.ad_id IS NOT DISTINCT FROM touches.ad_id
LEFT JOIN bbb_registration_links AS bbb
  USING (registration_id);

WITH summary AS (
  SELECT
    'summary' AS report_level,
    attribution_model,
    CAST(cohort_start_date AS STRING) AS cohort_start_date,
    CAST(cohort_end_date AS STRING) AS cohort_end_date,
    CAST(NULL AS STRING) AS ad_platform,
    CAST(NULL AS STRING) AS campaign_id,
    CAST(NULL AS STRING) AS campaign_name,
    CAST(NULL AS STRING) AS adset_id,
    CAST(NULL AS STRING) AS adset_name,
    CAST(NULL AS STRING) AS ad_id,
    CAST(NULL AS STRING) AS ad_name,
    COUNT(DISTINCT registration_id) AS registrations,
    COUNT(DISTINCT profile_id) AS registrants,
    COUNT(DISTINCT payment_id) AS bbb_buyers,
    SUM(bbb_revenue) AS bbb_revenue
  FROM attributed_rows
  GROUP BY attribution_model
),
by_ad AS (
  SELECT
    'ad' AS report_level,
    attribution_model,
    CAST(cohort_start_date AS STRING) AS cohort_start_date,
    CAST(cohort_end_date AS STRING) AS cohort_end_date,
    ad_platform,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name,
    COUNT(DISTINCT registration_id) AS registrations,
    COUNT(DISTINCT profile_id) AS registrants,
    COUNT(DISTINCT payment_id) AS bbb_buyers,
    SUM(bbb_revenue) AS bbb_revenue
  FROM attributed_rows
  GROUP BY
    attribution_model,
    ad_platform,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name
)
SELECT * FROM summary
UNION ALL
SELECT * FROM by_ad
ORDER BY
  attribution_model,
  report_level DESC,
  bbb_revenue DESC,
  registrations DESC;
