# Changelog

## 2026-08-08

- Added source-aware handling for the alternate Meta URL template: `fbc_id` supplies the ad-set ID, `h_ad_id` supplies the ad ID, and the campaign ID is recovered from the Facebook Ads lookup. Google `h_ad_id` handling is unchanged.

## 2026-08-07

- Aligned browser and server Meta classification for main-Stripe mentorship orders with `content_type = bbb-high-ticket`; Kajabi subscriptions remain `product`.

## 2026-08-06

- Added scalar-only flattened versions of all four `segretl_` models. Nested structs are exposed as columns, and repeated purchase fields are retained as JSON strings without changing row grain.
- Added `pre_conversion_ip_address` to the purchase reverse-ETL output.
- The field uses the matching browser purchase IP first, then the latest IP observed before payment, and finally `127.0.0.1` when no captured IP exists.
