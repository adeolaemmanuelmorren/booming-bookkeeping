-- July 2026 MTD breakdown for the three requested root pairs.
CREATE TEMP TABLE target_transitions AS
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
)
SELECT
  *,
  root AS destination_root,
  path AS destination_path,
  url AS destination_url,
  anonymous_id AS destination_anonymous_id,
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
  );

WITH breakdown AS (
  SELECT
    'route_pair' AS section,
    source_root,
    destination_root,
    CONCAT(COALESCE(source_path, '(null)'), ' -> ', COALESCE(destination_path, '(null)')) AS detail,
    COUNT(*) AS total,
    COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
    COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id
  FROM target_transitions
  GROUP BY source_root, destination_root, detail

  UNION ALL

  SELECT
    'referrer' AS section,
    source_root,
    destination_root,
    CASE
      WHEN NULLIF(referrer, '') IS NULL THEN '(empty)'
      WHEN referrer_root = source_root THEN CONCAT('source-root: ', referrer)
      WHEN referrer_root = destination_root THEN CONCAT('destination-root: ', referrer)
      WHEN referrer_root IN (
        'thebookkeepingchallenge.com', 'keyboardrichchallenge.com',
        'keyboardrich.com', 'boomingbookkeeping.com'
      ) THEN CONCAT('other-supported-root: ', referrer)
      ELSE CONCAT('external/other: ', referrer)
    END AS detail,
    COUNT(*) AS total,
    COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
    COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id
  FROM target_transitions
  GROUP BY source_root, destination_root, detail

  UNION ALL

  SELECT
    'gap_bucket_seconds' AS section,
    source_root,
    destination_root,
    CASE
      WHEN gap_seconds <= 2 THEN '0-2'
      WHEN gap_seconds <= 5 THEN '3-5'
      WHEN gap_seconds <= 10 THEN '6-10'
      WHEN gap_seconds <= 30 THEN '11-30'
      WHEN gap_seconds <= 60 THEN '31-60'
      ELSE '61-120'
    END AS detail,
    COUNT(*) AS total,
    COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
    COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id
  FROM target_transitions
  GROUP BY source_root, destination_root, detail

  UNION ALL

  SELECT
    'event_date_utc' AS section,
    source_root,
    destination_root,
    CAST(DATE(event_at) AS STRING) AS detail,
    COUNT(*) AS total,
    COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
    COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id
  FROM target_transitions
  GROUP BY source_root, destination_root, detail

  UNION ALL

  SELECT
    'query_shape' AS section,
    source_root,
    destination_root,
    CASE
      WHEN NULLIF(search, '') IS NULL THEN '(empty)'
      WHEN ajs_aid IS NOT NULL THEN 'contains ajs_aid'
      ELSE REGEXP_REPLACE(
        REGEXP_REPLACE(search, r'=[^&]*', '=<value>'),
        r'([?&])[^=&]+', r'\1<key>'
      )
    END AS detail,
    COUNT(*) AS total,
    COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
    COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id
  FROM target_transitions
  GROUP BY source_root, destination_root, detail

  UNION ALL

  SELECT
    'user_agent' AS section,
    source_root,
    destination_root,
    COALESCE(user_agent, '(null)') AS detail,
    COUNT(*) AS total,
    COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
    COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id
  FROM target_transitions
  GROUP BY source_root, destination_root, detail
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY section, source_root, destination_root
      ORDER BY total DESC, detail
    ) AS rank_in_section
  FROM breakdown
)
SELECT * EXCEPT(rank_in_section)
FROM ranked
WHERE rank_in_section <= CASE WHEN section = 'user_agent' THEN 12 ELSE 30 END
ORDER BY section, source_root, destination_root, total DESC, detail;
