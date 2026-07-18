-- Verify the live browser handoff observed on 2026-07-15 UTC.
SELECT
  timestamp,
  LOWER(NET.REG_DOMAIN(NET.HOST(context_page_url))) AS root,
  context_page_path AS path,
  context_page_search AS search,
  anonymous_id,
  context_page_referrer AS referrer
FROM `able-folio-499722.boom_domains.pages`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
  AND (
    anonymous_id = '80e93d5f-88fe-4218-919a-4832dd05dd22'
    OR context_page_url LIKE '%80e93d5f-88fe-4218-919a-4832dd05dd22%'
  )
ORDER BY timestamp;
