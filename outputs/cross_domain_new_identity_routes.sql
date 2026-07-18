-- Route pairs ranked by distinct destination IDs first seen at the transition.
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
    LAG(anonymous_id) OVER identity_sequence AS source_anonymous_id,
    LAG(event_at) OVER identity_sequence AS source_event_at,
    LAG(root) OVER identity_sequence AS source_root,
    LAG(path) OVER identity_sequence AS source_path
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
    anonymous_id AS destination_anonymous_id,
    LOWER(NET.REG_DOMAIN(NET.HOST(referrer))) AS referrer_root,
    REGEXP_EXTRACT(search, r'(?i)(?:^|[?&])ajs_aid=([^&]+)') AS ajs_aid
  FROM sequenced
  WHERE root != source_root
    AND anonymous_id != source_anonymous_id
    AND TIMESTAMP_DIFF(event_at, source_event_at, SECOND) BETWEEN 0 AND 120
    AND (
      (source_root = 'keyboardrichchallenge.com' AND root = 'keyboardrich.com')
      OR (source_root = 'keyboardrich.com' AND root = 'keyboardrichchallenge.com')
      OR (source_root = 'boomingbookkeeping.com' AND root = 'keyboardrichchallenge.com')
    )
),
destination_ids AS (
  SELECT DISTINCT destination_anonymous_id
  FROM targets
),
first_seen AS (
  SELECT
    p.anonymous_id,
    MIN(p.timestamp) AS first_seen_at
  FROM `able-folio-499722.boom_domains.pages` AS p
  INNER JOIN destination_ids AS ids
    ON p.anonymous_id = ids.destination_anonymous_id
  GROUP BY p.anonymous_id
),
enriched AS (
  SELECT
    t.*,
    ABS(TIMESTAMP_DIFF(t.event_at, f.first_seen_at, SECOND)) <= 2 AS destination_id_first_seen_here,
    CASE
      WHEN NULLIF(t.referrer, '') IS NULL THEN '(empty)'
      WHEN t.referrer_root = t.source_root THEN 'source root'
      WHEN t.referrer_root = t.destination_root THEN 'destination root'
      WHEN t.referrer_root = 'jotform.com' THEN 'Jotform'
      ELSE CONCAT('other: ', COALESCE(t.referrer_root, t.referrer))
    END AS referrer_class
  FROM targets AS t
  LEFT JOIN first_seen AS f
    ON t.destination_anonymous_id = f.anonymous_id
)
SELECT
  source_root,
  destination_root,
  source_path,
  destination_path,
  referrer_class,
  COUNT(*) AS changed_transitions,
  COUNTIF(destination_id_first_seen_here) AS new_identity_rows,
  COUNT(DISTINCT IF(destination_id_first_seen_here, destination_anonymous_id, NULL)) AS distinct_new_destination_ids,
  COUNTIF(NOT destination_id_first_seen_here) AS reused_destination_identity_rows,
  COUNTIF(NULLIF(ajs_aid, '') IS NOT NULL) AS rows_with_ajs_aid
FROM enriched
GROUP BY source_root, destination_root, source_path, destination_path, referrer_class
ORDER BY distinct_new_destination_ids DESC, changed_transitions DESC
LIMIT 100;
