-- Exact top user agents and local-hour volume for changed-ID target transitions.
WITH supported_pages AS (
  SELECT
    id,
    anonymous_id,
    timestamp AS event_at,
    received_at,
    context_ip AS ip,
    context_user_agent AS user_agent,
    LOWER(NET.REG_DOMAIN(NET.HOST(context_page_url))) AS root,
    context_page_path AS path
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
    LAG(root) OVER identity_sequence AS source_root
  FROM supported_pages
  WINDOW identity_sequence AS (
    PARTITION BY ip, user_agent
    ORDER BY event_at, received_at, id
  )
),
targets AS (
  SELECT
    *,
    root AS destination_root
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
breakdown AS (
  SELECT
    'local_date_hour_America_Los_Angeles' AS section,
    source_root,
    destination_root,
    FORMAT_TIMESTAMP('%F %H:00', event_at, 'America/Los_Angeles') AS detail,
    COUNT(*) AS transitions
  FROM targets
  GROUP BY source_root, destination_root, detail

  UNION ALL

  SELECT
    'exact_user_agent' AS section,
    source_root,
    destination_root,
    COALESCE(user_agent, '(null)') AS detail,
    COUNT(*) AS transitions
  FROM targets
  GROUP BY source_root, destination_root, detail
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY section, source_root, destination_root
      ORDER BY transitions DESC, detail
    ) AS rank_in_group
  FROM breakdown
)
SELECT * EXCEPT(rank_in_group)
FROM ranked
WHERE rank_in_group <= 12
ORDER BY section, source_root, destination_root, transitions DESC, detail;
