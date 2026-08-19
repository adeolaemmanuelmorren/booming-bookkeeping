WITH report_window AS (
  SELECT
    MIN(hour_start) AS available_start,
    LEAST(
      TIMESTAMP_ADD(MAX(hour_start), INTERVAL 1 HOUR),
      TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), HOUR, 'America/Los_Angeles')
    ) AS data_through
  FROM `able-folio-499722.booming_data_analytics.mart_ad_performance_hourly`
  WHERE source = 'meta'
),

hourly_delivery AS (
  SELECT
    performance.hour_start,
    performance.campaign_id,
    performance.adset_id,
    performance.ad_id,
    ANY_VALUE(performance.campaign_name) AS campaign_name,
    ANY_VALUE(performance.adset_name) AS adset_name,
    ANY_VALUE(performance.ad_name) AS ad_name,
    SUM(performance.spend) AS spend,
    SUM(performance.impressions) AS impressions,
    SUM(performance.clicks) AS clicks
  FROM `able-folio-499722.booming_data_analytics.mart_conversions_ad_performance_hourly`
    AS performance
  CROSS JOIN report_window
  WHERE performance.source = 'meta'
    AND performance.hour_start >= report_window.available_start
    AND performance.hour_start < report_window.data_through
  GROUP BY
    performance.hour_start,
    performance.campaign_id,
    performance.adset_id,
    performance.ad_id
),

attribution_rows AS (
  SELECT
    'first' AS attribution_method,
    first_touch_click_hour AS hour_start,
    first_touch_campaign_id AS campaign_id,
    first_touch_adset_id AS adset_id,
    first_touch_ad_id AS ad_id,
    first_touch_campaign_name AS campaign_name,
    first_touch_adset_name AS adset_name,
    first_touch_ad_name AS ad_name,
    registration_id,
    is_immediate_vip
  FROM `able-folio-499722.booming_data_analytics.mart_krc_acquisition`
  WHERE first_touch_click_hour IS NOT NULL

  UNION ALL

  SELECT
    'last' AS attribution_method,
    last_touch_click_hour AS hour_start,
    last_touch_campaign_id AS campaign_id,
    last_touch_adset_id AS adset_id,
    last_touch_ad_id AS ad_id,
    last_touch_campaign_name AS campaign_name,
    last_touch_adset_name AS adset_name,
    last_touch_ad_name AS ad_name,
    registration_id,
    is_immediate_vip
  FROM `able-folio-499722.booming_data_analytics.mart_krc_acquisition`
  WHERE last_touch_click_hour IS NOT NULL

  UNION ALL

  SELECT
    'solo' AS attribution_method,
    first_touch_click_hour AS hour_start,
    first_touch_campaign_id AS campaign_id,
    first_touch_adset_id AS adset_id,
    first_touch_ad_id AS ad_id,
    first_touch_campaign_name AS campaign_name,
    first_touch_adset_name AS adset_name,
    first_touch_ad_name AS ad_name,
    registration_id,
    is_immediate_vip
  FROM `able-folio-499722.booming_data_analytics.mart_krc_acquisition`
  WHERE is_solo_touch
    AND first_touch_click_hour IS NOT NULL
),

hourly_attribution AS (
  SELECT
    attribution.hour_start,
    attribution.campaign_id,
    attribution.adset_id,
    attribution.ad_id,
    ANY_VALUE(attribution.campaign_name) AS campaign_name,
    ANY_VALUE(attribution.adset_name) AS adset_name,
    ANY_VALUE(attribution.ad_name) AS ad_name,
    COUNT(DISTINCT IF(attribution_method = 'last', registration_id, NULL))
      AS last_touch_registrations,
    COUNT(DISTINCT IF(
      attribution_method = 'last' AND is_immediate_vip,
      registration_id,
      NULL
    )) AS last_touch_immediate_vips,
    COUNT(DISTINCT IF(attribution_method = 'first', registration_id, NULL))
      AS first_touch_registrations,
    COUNT(DISTINCT IF(
      attribution_method = 'first' AND is_immediate_vip,
      registration_id,
      NULL
    )) AS first_touch_immediate_vips,
    COUNT(DISTINCT IF(attribution_method = 'solo', registration_id, NULL))
      AS solo_touch_registrations,
    COUNT(DISTINCT IF(
      attribution_method = 'solo' AND is_immediate_vip,
      registration_id,
      NULL
    )) AS solo_touch_immediate_vips
  FROM attribution_rows attribution
  CROSS JOIN report_window
  WHERE attribution.hour_start >= report_window.available_start
    AND attribution.hour_start < report_window.data_through
  GROUP BY
    attribution.hour_start,
    attribution.campaign_id,
    attribution.adset_id,
    attribution.ad_id
)

SELECT
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(COALESCE(delivery.hour_start, attribution.hour_start), 'America/Los_Angeles')
  ) AS hour_start_pacific,
  COALESCE(delivery.campaign_id, attribution.campaign_id) AS campaign_id,
  COALESCE(delivery.adset_id, attribution.adset_id) AS adset_id,
  COALESCE(delivery.ad_id, attribution.ad_id) AS ad_id,
  COALESCE(delivery.campaign_name, attribution.campaign_name, 'Unknown campaign')
    AS campaign_name,
  COALESCE(delivery.adset_name, attribution.adset_name, 'Unknown ad set')
    AS adset_name,
  COALESCE(delivery.ad_name, attribution.ad_name, 'Unknown ad') AS ad_name,
  COALESCE(delivery.spend, 0) AS spend,
  COALESCE(delivery.impressions, 0) AS impressions,
  COALESCE(delivery.clicks, 0) AS clicks,
  COALESCE(attribution.last_touch_registrations, 0) AS last_touch_registrations,
  COALESCE(attribution.last_touch_immediate_vips, 0) AS last_touch_immediate_vips,
  COALESCE(attribution.first_touch_registrations, 0) AS first_touch_registrations,
  COALESCE(attribution.first_touch_immediate_vips, 0) AS first_touch_immediate_vips,
  COALESCE(attribution.solo_touch_registrations, 0) AS solo_touch_registrations,
  COALESCE(attribution.solo_touch_immediate_vips, 0) AS solo_touch_immediate_vips
FROM hourly_delivery delivery
FULL OUTER JOIN hourly_attribution attribution
  ON delivery.hour_start = attribution.hour_start
 AND delivery.campaign_id IS NOT DISTINCT FROM attribution.campaign_id
 AND delivery.adset_id IS NOT DISTINCT FROM attribution.adset_id
 AND delivery.ad_id IS NOT DISTINCT FROM attribution.ad_id
ORDER BY hour_start_pacific, campaign_name, adset_name, ad_name;
