-- New destination identities on vgo_ee redirects that lack ajs_aid.
WITH supported_pages AS (
  SELECT
    id,
    anonymous_id,
    timestamp AS event_at,
    received_at,
    context_ip AS ip,
    context_user_agent AS user_agent,
    LOWER(NET.REG_DOMAIN(NET.HOST(context_page_url))) AS root,
    context_page_search AS search
  FROM `able-folio-499722.boom_domains.pages`
  WHERE timestamp >= TIMESTAMP('2026-07-01')
    AND timestamp < TIMESTAMP('2026-08-01')
    AND LOWER(NET.REG_DOMAIN(NET.HOST(context_page_url))) IN (
      'thebookkeepingchallenge.com', 'keyboardrichchallenge.com',
      'keyboardrich.com', 'boomingbookkeeping.com'
    )
),
sequenced AS (
  SELECT
    *,
    LAG(anonymous_id) OVER w AS source_anonymous_id,
    LAG(event_at) OVER w AS source_event_at,
    LAG(root) OVER w AS source_root
  FROM supported_pages
  WINDOW w AS (PARTITION BY ip, user_agent ORDER BY event_at, received_at, id)
),
targets AS (
  SELECT *, root AS destination_root, anonymous_id AS destination_anonymous_id
  FROM sequenced
  WHERE root != source_root
    AND anonymous_id != source_anonymous_id
    AND TIMESTAMP_DIFF(event_at, source_event_at, SECOND) BETWEEN 0 AND 120
    AND REGEXP_CONTAINS(search, r'(?i)(?:^|[?&])vgo_ee=')
    AND NOT REGEXP_CONTAINS(search, r'(?i)(?:^|[?&])ajs_aid=')
    AND (
      (source_root = 'keyboardrichchallenge.com' AND root = 'keyboardrich.com')
      OR (source_root = 'keyboardrich.com' AND root = 'keyboardrichchallenge.com')
      OR (source_root = 'boomingbookkeeping.com' AND root = 'keyboardrichchallenge.com')
    )
),
ids AS (
  SELECT DISTINCT destination_anonymous_id FROM targets
),
first_seen AS (
  SELECT p.anonymous_id, MIN(p.timestamp) AS first_seen_at
  FROM `able-folio-499722.boom_domains.pages` AS p
  INNER JOIN ids ON p.anonymous_id = ids.destination_anonymous_id
  GROUP BY p.anonymous_id
)
SELECT
  source_root,
  destination_root,
  COUNT(*) AS vgo_without_ajs_changed_rows,
  COUNT(DISTINCT destination_anonymous_id) AS distinct_destination_ids,
  COUNT(DISTINCT IF(ABS(TIMESTAMP_DIFF(event_at, first_seen_at, SECOND)) <= 2, destination_anonymous_id, NULL)) AS distinct_new_destination_ids
FROM targets
LEFT JOIN first_seen ON destination_anonymous_id = first_seen.anonymous_id
GROUP BY source_root, destination_root
ORDER BY source_root, destination_root;
