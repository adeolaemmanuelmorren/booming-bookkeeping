-- Reproduce July MTD cross-root transitions using the original heuristic:
-- the immediately previous page event for the same IP + user agent,
-- a different supported root, and an event-time gap of 0 to 120 seconds.
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
    LAG(root) OVER identity_sequence AS source_root,
    LAG(path) OVER identity_sequence AS source_path,
    LAG(url) OVER identity_sequence AS source_url
  FROM supported_pages
  WINDOW identity_sequence AS (
    PARTITION BY ip, user_agent
    ORDER BY event_at, received_at, id
  )
),
transitions AS (
  SELECT
    *,
    TIMESTAMP_DIFF(event_at, source_event_at, SECOND) AS gap_seconds
  FROM sequenced
  WHERE root != source_root
    AND TIMESTAMP_DIFF(event_at, source_event_at, SECOND) BETWEEN 0 AND 120
)
SELECT
  source_root,
  root AS destination_root,
  COUNTIF(anonymous_id = source_anonymous_id) AS same_anonymous_id,
  COUNTIF(anonymous_id != source_anonymous_id) AS changed_anonymous_id,
  COUNT(*) AS transitions
FROM transitions
GROUP BY source_root, destination_root
ORDER BY transitions DESC;
