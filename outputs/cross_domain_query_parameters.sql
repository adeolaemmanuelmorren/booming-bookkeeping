-- Query-parameter name sets on destination events for the three target pairs.
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
    root AS destination_root,
    ARRAY_TO_STRING(
      ARRAY(
        SELECT SPLIT(part, '=')[SAFE_OFFSET(0)]
        FROM UNNEST(SPLIT(TRIM(COALESCE(search, ''), '?'), '&')) AS part
        WHERE part != ''
        ORDER BY SPLIT(part, '=')[SAFE_OFFSET(0)]
      ),
      '&'
    ) AS parameter_names
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
  IF(parameter_names = '', '(none)', parameter_names) AS parameter_names,
  COUNT(*) AS transitions,
  COUNTIF(anonymous_id = source_anonymous_id) AS same_id,
  COUNTIF(anonymous_id != source_anonymous_id) AS changed_id
FROM targets
GROUP BY source_root, destination_root, parameter_names
ORDER BY source_root, destination_root, transitions DESC, parameter_names;
