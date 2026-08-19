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
  CAST(delivery.date AS STRING) AS date,
  delivery.level,
  delivery.campaign_id,
  delivery.adset_id,
  delivery.ad_id,
  delivery.impressions,
  delivery.reach,
  delivery.frequency
FROM `able-folio-499722.booming_data_analytics.mart_meta_delivery_daily` delivery
CROSS JOIN report_window
WHERE delivery.date >= DATE(report_window.available_start, 'America/Los_Angeles')
  AND delivery.date < DATE(report_window.data_through, 'America/Los_Angeles')
ORDER BY delivery.date, delivery.level, campaign_id, adset_id, ad_id;
