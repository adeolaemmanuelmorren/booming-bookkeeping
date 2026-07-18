-- Candidate ActiveCampaign redirects: vgo_ee is present but ajs_aid is absent.
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
    path AS destination_path
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
)
SELECT
  source_root,
  destination_root,
  source_path,
  destination_path,
  COUNT(*) AS changed_transitions,
  APPROX_QUANTILES(TIMESTAMP_DIFF(event_at, source_event_at, SECOND), 100)[OFFSET(50)] AS median_gap_seconds
FROM targets
GROUP BY source_root, destination_root, source_path, destination_path
ORDER BY changed_transitions DESC, source_root, source_path, destination_path;
