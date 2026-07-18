-- Validate whether the IP + user-agent LAG heuristic is likely to represent a
-- real navigation, and estimate newly-created destination identities.
WITH supported_pages AS (
  SELECT
    id,
    anonymous_id,
    user_id,
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
    LAG(user_id) OVER identity_sequence AS source_user_id,
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
    anonymous_id AS destination_anonymous_id,
    TIMESTAMP_DIFF(event_at, source_event_at, SECOND) AS gap_seconds,
    TIMESTAMP_DIFF(received_at, source_received_at, SECOND) AS received_gap_seconds,
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
),
key_stats AS (
  SELECT
    ip,
    user_agent,
    COUNT(*) AS july_page_events,
    COUNT(DISTINCT anonymous_id) AS july_anonymous_ids,
    COUNT(DISTINCT root) AS july_roots,
    COUNT(DISTINCT DATE(event_at)) AS july_active_days
  FROM supported_pages
  GROUP BY ip, user_agent
),
target_key_stats AS (
  SELECT
    ip,
    user_agent,
    COUNT(*) AS target_transitions_for_key,
    COUNT(DISTINCT source_anonymous_id) AS target_source_ids_for_key,
    COUNT(DISTINCT destination_anonymous_id) AS target_destination_ids_for_key
  FROM targets
  GROUP BY ip, user_agent
),
target_destination_ids AS (
  SELECT DISTINCT destination_anonymous_id
  FROM targets
  WHERE destination_anonymous_id IS NOT NULL
),
destination_first_seen AS (
  SELECT
    p.anonymous_id,
    MIN(p.timestamp) AS first_seen_at
  FROM `able-folio-499722.boom_domains.pages` AS p
  INNER JOIN target_destination_ids AS ids
    ON p.anonymous_id = ids.destination_anonymous_id
  GROUP BY p.anonymous_id
),
enriched AS (
  SELECT
    t.*,
    k.july_page_events,
    k.july_anonymous_ids,
    k.july_roots,
    k.july_active_days,
    tk.target_transitions_for_key,
    tk.target_source_ids_for_key,
    tk.target_destination_ids_for_key,
    f.first_seen_at,
    ABS(TIMESTAMP_DIFF(t.event_at, f.first_seen_at, SECOND)) <= 2 AS destination_id_first_seen_here
  FROM targets AS t
  LEFT JOIN key_stats AS k USING (ip, user_agent)
  LEFT JOIN target_key_stats AS tk USING (ip, user_agent)
  LEFT JOIN destination_first_seen AS f
    ON t.destination_anonymous_id = f.anonymous_id
)
SELECT
  source_root,
  destination_root,
  COUNT(*) AS transitions,
  COUNTIF(destination_anonymous_id = source_anonymous_id) AS same_id,
  COUNTIF(destination_anonymous_id != source_anonymous_id) AS changed_id,
  COUNT(DISTINCT IF(destination_anonymous_id != source_anonymous_id, destination_anonymous_id, NULL)) AS distinct_changed_destination_ids,
  COUNT(DISTINCT IF(destination_anonymous_id != source_anonymous_id, CONCAT(source_anonymous_id, ' -> ', destination_anonymous_id), NULL)) AS distinct_changed_id_pairs,
  COUNTIF(destination_anonymous_id != source_anonymous_id AND destination_id_first_seen_here) AS changed_rows_where_destination_id_is_new,
  COUNT(DISTINCT IF(destination_anonymous_id != source_anonymous_id AND destination_id_first_seen_here, destination_anonymous_id, NULL)) AS distinct_new_destination_ids,
  COUNTIF(destination_anonymous_id != source_anonymous_id AND NOT destination_id_first_seen_here) AS changed_rows_with_preexisting_destination_id,
  COUNTIF(NULLIF(ajs_aid, '') IS NOT NULL) AS rows_with_ajs_aid,
  COUNTIF(ajs_aid = source_anonymous_id) AS ajs_aid_matches_source_id,
  COUNTIF(ajs_aid = destination_anonymous_id) AS ajs_aid_matches_destination_id,
  COUNTIF(NULLIF(referrer, '') IS NULL) AS empty_referrer,
  COUNTIF(referrer_root = source_root) AS source_root_referrer,
  COUNTIF(referrer_root = destination_root) AS destination_root_referrer,
  COUNTIF(NULLIF(user_id, '') IS NOT NULL AND user_id = source_user_id) AS same_nonempty_user_id,
  COUNTIF(received_gap_seconds < 0) AS received_out_of_order,
  COUNTIF(gap_seconds = 0) AS equal_second_timestamp,
  COUNTIF(REGEXP_CONTAINS(LOWER(COALESCE(user_agent, '')), r'bot|spider|crawler|headless|lighthouse|pagespeed|python|curl|wget')) AS obvious_automation_user_agent,
  COUNTIF(target_transitions_for_key = 1) AS one_target_transition_for_key,
  COUNTIF(target_source_ids_for_key = 1 AND target_destination_ids_for_key = 1) AS one_source_and_destination_id_for_key,
  COUNTIF(target_transitions_for_key > 3) AS repeated_target_transition_key,
  COUNTIF(july_anonymous_ids > 5) AS key_has_more_than_five_july_ids,
  COUNTIF(july_active_days > 3) AS key_active_more_than_three_days,
  APPROX_QUANTILES(july_page_events, 100)[OFFSET(50)] AS median_july_events_per_key,
  APPROX_QUANTILES(july_anonymous_ids, 100)[OFFSET(50)] AS median_july_ids_per_key,
  APPROX_QUANTILES(gap_seconds, 100)[OFFSET(50)] AS median_gap_seconds,
  APPROX_QUANTILES(gap_seconds, 100)[OFFSET(90)] AS p90_gap_seconds,
  MAX(event_at) AS data_through_event_at
FROM enriched
GROUP BY source_root, destination_root
ORDER BY source_root, destination_root;
