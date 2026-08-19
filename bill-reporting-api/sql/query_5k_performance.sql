WITH report_window AS (
  SELECT
    MIN(hour_start) AS available_start,
    LEAST(
      TIMESTAMP_ADD(MAX(hour_start), INTERVAL 1 HOUR),
      TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), HOUR, 'America/Los_Angeles')
    ) AS data_through
  FROM `able-folio-499722.booming_data_analytics.mart_conversions_ad_performance_hourly`
  WHERE source = 'meta'
),

collected_5k_revenue AS (
  SELECT
    acquisition.registration_id,
    SUM(payments.net_amount) AS collected_revenue
  FROM `able-folio-499722.booming_data_analytics.mart_krc_acquisition` acquisition
  JOIN `able-folio-499722.booming_data_analytics.mart_payments` payments
    ON payments.profile_id = acquisition.profile_id
   AND payments.payment_time >= acquisition.registration_timestamp
  WHERE acquisition.is_5k_purchaser
    AND payments.payment_category = 'mentorship'
  GROUP BY acquisition.registration_id
),

acquisition_with_revenue AS (
  SELECT
    acquisition.*,
    COALESCE(revenue.collected_revenue, 0) AS collected_5k_revenue
  FROM `able-folio-499722.booming_data_analytics.mart_krc_acquisition` acquisition
  LEFT JOIN collected_5k_revenue revenue
    USING (registration_id)
),

attribution_rows AS (
  SELECT
    'first' AS attribution_method,
    first_touch_click_hour AS hour_start,
    first_touch_campaign_id AS campaign_id,
    first_touch_adset_id AS adset_id,
    first_touch_ad_id AS ad_id,
    registration_id,
    is_immediate_vip,
    is_5k_purchaser,
    collected_5k_revenue
  FROM acquisition_with_revenue
  WHERE first_touch_click_hour IS NOT NULL

  UNION ALL

  SELECT
    'last' AS attribution_method,
    last_touch_click_hour AS hour_start,
    last_touch_campaign_id AS campaign_id,
    last_touch_adset_id AS adset_id,
    last_touch_ad_id AS ad_id,
    registration_id,
    is_immediate_vip,
    is_5k_purchaser,
    collected_5k_revenue
  FROM acquisition_with_revenue
  WHERE last_touch_click_hour IS NOT NULL

  UNION ALL

  SELECT
    'solo' AS attribution_method,
    first_touch_click_hour AS hour_start,
    first_touch_campaign_id AS campaign_id,
    first_touch_adset_id AS adset_id,
    first_touch_ad_id AS ad_id,
    registration_id,
    is_immediate_vip,
    is_5k_purchaser,
    collected_5k_revenue
  FROM acquisition_with_revenue
  WHERE is_solo_touch
    AND first_touch_click_hour IS NOT NULL
)

SELECT
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(attribution.hour_start, 'America/Los_Angeles')
  ) AS hour_start_pacific,
  attribution.campaign_id,
  attribution.adset_id,
  attribution.ad_id,
  COUNT(DISTINCT IF(
    attribution_method = 'last' AND is_5k_purchaser,
    registration_id,
    NULL
  )) AS last_touch_5k_purchasers,
  SUM(IF(
    attribution_method = 'last' AND is_5k_purchaser,
    collected_5k_revenue,
    0
  )) AS last_touch_5k_revenue,
  COUNT(DISTINCT IF(
    attribution_method = 'last'
      AND is_immediate_vip
      AND is_5k_purchaser,
    registration_id,
    NULL
  )) AS last_touch_immediate_vip_5k_purchasers,
  COUNT(DISTINCT IF(
    attribution_method = 'first' AND is_5k_purchaser,
    registration_id,
    NULL
  )) AS first_touch_5k_purchasers,
  SUM(IF(
    attribution_method = 'first' AND is_5k_purchaser,
    collected_5k_revenue,
    0
  )) AS first_touch_5k_revenue,
  COUNT(DISTINCT IF(
    attribution_method = 'solo' AND is_5k_purchaser,
    registration_id,
    NULL
  )) AS solo_touch_5k_purchasers,
  SUM(IF(
    attribution_method = 'solo' AND is_5k_purchaser,
    collected_5k_revenue,
    0
  )) AS solo_touch_5k_revenue
FROM attribution_rows attribution
CROSS JOIN report_window
WHERE attribution.hour_start >= report_window.available_start
  AND attribution.hour_start < report_window.data_through
GROUP BY
  attribution.hour_start,
  attribution.campaign_id,
  attribution.adset_id,
  attribution.ad_id
HAVING
  last_touch_5k_purchasers > 0
  OR first_touch_5k_purchasers > 0
  OR solo_touch_5k_purchasers > 0
ORDER BY hour_start_pacific, campaign_id, adset_id, ad_id;
