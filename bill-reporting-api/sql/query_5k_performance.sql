-- Semantic metrics are built in Dataform model mart_meta_krc_reporting_hourly.
-- Keep this API query limited to the completed-hour boundary and output shape.
WITH report_window AS (
  SELECT
    MIN(hour_start) AS available_start,
    LEAST(
      TIMESTAMP_ADD(MAX(hour_start), INTERVAL 1 HOUR),
      TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), HOUR, 'America/Los_Angeles')
    ) AS data_through
  FROM `able-folio-499722.booming_data_analytics.mart_ad_performance_hourly`
  WHERE source = 'meta'
)

SELECT
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(reporting.hour_start, 'America/Los_Angeles')
  ) AS hour_start_pacific,
  reporting.campaign_id,
  reporting.adset_id,
  reporting.ad_id,
  reporting.last_touch_5k_purchasers,
  reporting.last_touch_5k_revenue,
  reporting.last_touch_immediate_vip_5k_purchasers,
  reporting.first_touch_5k_purchasers,
  reporting.first_touch_5k_revenue,
  reporting.solo_touch_5k_purchasers,
  reporting.solo_touch_5k_revenue
FROM `able-folio-499722.booming_data_analytics.mart_meta_krc_reporting_hourly`
  AS reporting
CROSS JOIN report_window
WHERE reporting.source = 'meta'
  AND reporting.hour_start >= report_window.available_start
  AND reporting.hour_start >= TIMESTAMP(
    PARSE_DATETIME('%Y-%m-%dT%H:%M', @range_start_pacific),
    'America/Los_Angeles'
  )
  AND reporting.hour_start < TIMESTAMP(
    PARSE_DATETIME('%Y-%m-%dT%H:%M', @range_end_pacific),
    'America/Los_Angeles'
  )
  AND reporting.hour_start < report_window.data_through
  AND (
    reporting.last_touch_5k_purchasers > 0
    OR reporting.first_touch_5k_purchasers > 0
    OR reporting.solo_touch_5k_purchasers > 0
  )
ORDER BY hour_start_pacific, campaign_id, adset_id, ad_id;
