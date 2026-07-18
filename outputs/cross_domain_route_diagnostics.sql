-- Route-level evidence and heuristic diagnostics for the three requested pairs.
WITH supported_pages AS (
  SELECT
    id,
    anonymous_id,
    timestamp AS event_at,
    received_at,
    context_ip AS ip,
    context_user_agent AS user_agent,
    LOWER(NET.REG_DOMAIN(NET.HOST(context_page_url))) AS root,
    context_page_path AS path,
    context_page_url AS url,
    context_page_referrer AS referrer,
    context_page_search AS search
  FROM `able-folio-499722.boom_domains.pages`
  WHERE timestamp >= TIMESTAMP('2026-07-01')
    AND timestamp < TIMESTAMP('2026-08-01')
    AND LOWER(NET.REG_DOMAIN(NET.HOST(context_page_url))) IN (
      'thebookkeepingchallenge.com',
      'keyboardrichchallenge.com',
      'keyboardrich.com',
      'boomingbookkeeping.com'
    )
),
sequenced AS (
  SELECT
    *,
    LAG(id) OVER identity_sequence AS source_id,
    LAG(anonymous_id) OVER identity_sequence AS source_anonymous_id,
    LAG(event_at) OVER identity_sequence AS source_event_at,
    LAG(received_at) OVER identity_sequence AS source_received_at,
    LAG(root) OVER identity_sequence AS source_root,
    LAG(path) OVER identity_sequence AS source_path,
    LAG(url) OVER identity_sequence AS source_url
  FROM supported_pages
  WINDOW identity_sequence AS (
    PARTITION BY ip, user_agent
    ORDER BY event_at, received_at, id
  )
),
targets AS (
  SELECT
    *,
    root AS destination_root,
    path AS destination_path,
    TIMESTAMP_DIFF(event_at, source_event_at, SECOND) AS gap_seconds,
    LOWER(NET.REG_DOMAIN(NET.HOST(referrer))) AS referrer_root,
    REGEXP_EXTRACT(search, r'(?i)(?:^|[?&])ajs_aid=([^&]+)') AS ajs_aid
  FROM sequenced
  WHERE root != source_root
    AND TIMESTAMP_DIFF(event_at, source_event_at, SECOND) BETWEEN 0 AND 120
    AND (
      (source_root = 'keyboardrichchallenge.com' AND root = 'keyboardrich.com')
      OR (source_root = 'keyboardrich.com' AND root = 'keyboardrichchallenge.com')
      OR (source_root = 'boomingbookkeeping.com' AND root = 'keyboardrichchallenge.com')
    )
)
SELECT
  source_root,
  destination_root,
  source_path,
  destination_path,
  COUNT(*) AS transitions,
  COUNTIF(anonymous_id = source_anonymous_id) AS same_id,
  COUNTIF(anonymous_id != source_anonymous_id) AS changed_id,
  COUNTIF(NULLIF(referrer, '') IS NULL) AS empty_referrer,
  COUNTIF(referrer_root = source_root) AS source_root_referrer,
  COUNTIF(referrer_root = destination_root) AS destination_root_referrer,
  COUNTIF(NULLIF(ajs_aid, '') IS NOT NULL) AS has_ajs_aid,
  APPROX_QUANTILES(gap_seconds, 100)[OFFSET(50)] AS median_gap_seconds,
  APPROX_QUANTILES(gap_seconds, 100)[OFFSET(90)] AS p90_gap_seconds
FROM targets
GROUP BY source_root, destination_root, source_path, destination_path
ORDER BY transitions DESC, source_root, destination_root, source_path, destination_path
LIMIT 100;
