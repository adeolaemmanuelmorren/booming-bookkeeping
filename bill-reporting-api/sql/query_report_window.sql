WITH hourly_bounds AS (
  SELECT
    MIN(hour_start) AS available_start,
    LEAST(
      TIMESTAMP_ADD(MAX(hour_start), INTERVAL 1 HOUR),
      TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), HOUR, 'America/Los_Angeles')
    ) AS data_through
  FROM `able-folio-499722.booming_data_analytics.mart_ad_performance_hourly`
  WHERE source = 'meta'
),

pacific_clock AS (
  SELECT
    available_start,
    data_through,
    TIMESTAMP(
      DATETIME(
        DATE_SUB(
          DATE(data_through, 'America/Los_Angeles'),
          INTERVAL MOD(
            EXTRACT(DAYOFWEEK FROM DATE(data_through, 'America/Los_Angeles')) + 5,
            7
          ) DAY
        ),
        TIME '10:00:00'
      ),
      'America/Los_Angeles'
    ) AS monday_at_ten
  FROM hourly_bounds
),

report_window AS (
  SELECT
    available_start,
    data_through,
    IF(
      data_through < monday_at_ten,
      TIMESTAMP_SUB(monday_at_ten, INTERVAL 7 DAY),
      monday_at_ten
    ) AS active_week_start
  FROM pacific_clock
)

SELECT
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(available_start, 'America/Los_Angeles')
  ) AS available_start_pacific,
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(TIMESTAMP_SUB(active_week_start, INTERVAL 7 DAY), 'America/Los_Angeles')
  ) AS previous_week_start_pacific,
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(active_week_start, 'America/Los_Angeles')
  ) AS active_week_start_pacific,
  FORMAT_DATETIME(
    '%Y-%m-%dT%H:%M',
    DATETIME(data_through, 'America/Los_Angeles')
  ) AS data_through_pacific
FROM report_window;
