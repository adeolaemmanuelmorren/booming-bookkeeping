# BBB, VIP, and ad-click cohort report

Report window: **July 14–August 12, 2026**, using Pacific dates. August 12 is partial.

Canonical sources only:

- `mart_form_submissions_server_side`
- `mart_payments`
- `mart_touchpoints_all`
- `mart_ad_performance`

Definitions:

- Registration: KRC registration only.
- VIP: `keyboard_rich_challenge_vip` or `structured_basic_vip`.
- BBB: first successful non-repeat payment over $900 per profile.
- Same day: same `America/Los_Angeles` calendar date.
- Ad attribution: last paid click before KRC registration.

## 1. BBB purchase timing

| Linked BBB purchasers | Within 14 days | Within 14 days | After 14 days |
|---:|---:|---:|---:|
| 405 | 402 | 99.26% | 3 (0.74%) |

## 2. Registration-to-BBB lag

| Lag from KRC registration | BBB purchasers | Share |
|---|---:|---:|
| Same Pacific date | 0 | 0.00% |
| 1–7 days | 188 | 46.42% |
| More than 7–13.5 days | 213 | 52.59% |
| More than 13.5–21 days | 3 | 0.74% |
| More than 21 days | 1 | 0.25% |
| **Within 13.5 days** | **401** | **99.01%** |
| **Later than 13.5 days** | **4** | **0.99%** |

## 3. VIP timing versus observed BBB likelihood

| Registrant group | Registrants | Later bought BBB | Observed BBB rate |
|---|---:|---:|---:|
| Same-day VIP | 1,441 | 175 | 12.14% |
| Later VIP | 930 | 131 | 14.09% |
| No VIP | 37,288 | 99 | 0.27% |

Same-day VIP registrants were **not more likely than later-VIP registrants** to buy BBB in this observed window. Both VIP groups were dramatically more likely to buy BBB than registrants with no VIP.

Recent registrations have had less time to produce a BBB purchase, so these are observed-to-date rates rather than fully matured lifetime rates.

## 4. Immediate VIP upgrade

| All unique KRC registrants | Same-day VIP registrants | Same-day VIP rate | Subsequently bought BBB | BBB rate among same-day VIP |
|---:|---:|---:|---:|---:|
| 39,659 | 1,441 | 3.63% | 175 | 12.14% |

| Registration-to-BBB lag among those 175 buyers | Buyers | Share |
|---|---:|---:|
| Same Pacific date | 0 | 0.00% |
| 1–7 days | 82 | 46.86% |
| More than 7–13.5 days | 91 | 52.00% |
| More than 13.5–21 days | 1 | 0.57% |
| More than 21 days | 1 | 0.57% |

## 5. Paid-click cohort maturity

The maturity test includes only paid-click cohorts whose click occurred at least 13.5 days ago.

| Mature click registrations | Unique registrants | VIP purchases | Eventual BBB buyers observed | BBB within 13.5 days of click | BBB later | Share captured within 13.5 days | BBB revenue |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 19,362 | 19,128 | 1,164 | 291 | 289 | 2 | **99.31%** | $332,869 |

This supports using a 13.5-day maturity window: among observed BBB buyers from fully mature paid-click cohorts, **99.31% purchased within 13.5 days of the paid click**.

### Daily paid-click cohorts

Revenue is attributed to the paid-click date, not the purchase date.

| Click date | Status | Registrations | VIP purchases | BBB buyers observed | BBB revenue | Observed BBB rate |
|---|---|---:|---:|---:|---:|---:|
| Jul 14 | Mature | 885 | 59 | 13 | $12,961 | 1.48% |
| Jul 15 | Mature | 995 | 72 | 17 | $20,949 | 1.72% |
| Jul 16 | Mature | 1,065 | 65 | 12 | $14,167 | 1.14% |
| Jul 17 | Mature | 1,111 | 79 | 28 | $27,916 | 2.53% |
| Jul 18 | Mature | 1,071 | 56 | 14 | $19,967 | 1.32% |
| Jul 19 | Mature | 1,194 | 75 | 21 | $20,937 | 1.78% |
| Jul 20 | Mature | 1,293 | 77 | 24 | $27,931 | 1.87% |
| Jul 21 | Mature | 1,267 | 76 | 12 | $11,964 | 0.95% |
| Jul 22 | Mature | 1,244 | 65 | 13 | $12,961 | 1.05% |
| Jul 23 | Mature | 1,297 | 73 | 19 | $19,446 | 1.47% |
| Jul 24 | Mature | 1,172 | 67 | 20 | $23,946 | 1.71% |
| Jul 25 | Mature | 1,214 | 81 | 24 | $30,931 | 1.99% |
| Jul 26 | Mature | 1,195 | 78 | 20 | $19,940 | 1.68% |
| Jul 27 | Mature | 1,310 | 70 | 24 | $23,928 | 1.84% |
| Jul 28 | Mature | 1,196 | 66 | 13 | $27,976 | 1.09% |
| Jul 29 | Mature | 1,427 | 74 | 14 | $13,958 | 0.98% |
| Jul 30 | Partially mature | 1,076 | 66 | 13 | $16,961 | 1.21% |
| Jul 31 | Immature | 1,385 | 89 | 16 | $21,958 | 1.16% |
| Aug 1 | Immature | 1,175 | 65 | 13 | $12,961 | 1.11% |
| Aug 2 | Immature | 1,300 | 98 | 22 | $24,937 | 1.69% |
| Aug 3 | Immature | 1,362 | 77 | 5 | $11,988 | 0.37% |
| Aug 4 | Immature | 1,518 | 81 | 0 | $0 | 0.00% |
| Aug 5 | Immature | 1,341 | 69 | 0 | $0 | 0.00% |
| Aug 6 | Immature | 1,360 | 78 | 0 | $0 | 0.00% |
| Aug 7 | Immature | 1,126 | 56 | 0 | $0 | 0.00% |
| Aug 8 | Immature | 1,165 | 69 | 0 | $0 | 0.00% |
| Aug 9 | Immature | 1,224 | 73 | 0 | $0 | 0.00% |
| Aug 10 | Immature | 1,171 | 61 | 0 | $0 | 0.00% |
| Aug 11 | Immature | 1,126 | 35 | 0 | $0 | 0.00% |
| Aug 12 | Immature, partial day | 646 | 19 | 0 | $0 | 0.00% |

Zeroes in immature cohorts are not final performance results. The BBB purchase is attributed to the paid click preceding its registration, and recent cohorts have not completed their buying window.

### Leading mature ads by observed BBB buyers

| Platform | Campaign | Ad set | Ad | Registrations | VIP | BBB buyers | BBB revenue |
|---|---|---|---|---:|---:|---:|---:|
| Meta | ABO_SANDBOX_2_LC | Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test) | R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV | 2,354 | 131 | 32 | $35,907 |
| Meta | ABO_SANDBOX_LC | R_Javier_UGC_Badge3 | R_PMA_FinalCallHook_NewJavi_UGC_SYOBFCK_Leo_Vivien | 691 | 76 | 22 | $21,937 |
| Meta | ABO_SANDBOX_LC | R_ConcSSI_UA_H3_UGC_Shelley1 | R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV | 1,712 | 79 | 19 | $18,943 |
| Meta | 2025 KRC Retargeting | KRC Retargeting - FB/IG Engagers | MA_JobRed_H2_S1 | 232 | 48 | 15 | $14,955 |
| Meta | 2025 Keyboard Rich Challenge - VIP | (08/26/25) - SOB_Hero_Recycled | Hero_Recycled_V3 | 738 | 48 | 10 | $16,973 |
| Meta | ABO_SANDBOX_LC | New_Recordings_Bill_2 | VSL_Script_6-2_Revised (082425)-bill_v1_ADV | 369 | 20 | 10 | $9,970 |
| Meta | ABO_SANDBOX_LC | SOB_PMA_OBJ_H5_SC_IT2 | SOB_PMA_OBJ_H5_SC_S11 | 379 | 32 | 9 | $8,973 |
| Meta | ABO_SANDBOX_LC | SOB_PMA_H23_R39 | SOB_PMA_H23_R184 | 945 | 41 | 7 | $9,982 |
| Meta | 2025 Keyboard Rich Challenge - VIP | All Winning Old Ads_NO Post ID_ADV | Pegasus - Duplicate (Restart-Des) | 88 | 15 | 7 | $9,982 |
| Meta | ABO_SANDBOX_LC | Bill_Static_Concept1_IT1 | Bill_Concept1_Static1_IT2 | 452 | 19 | 7 | $6,979 |

The exact query returns the complete ad-level table; this document shows the leading mature rows for readability.

## Exact BigQuery queries

- `BBB_REGISTRATION_REPORTS_LAST_30_DAYS.sql`
- `AD_CLICK_COHORT_MATURITY_LAST_30_DAYS.sql`

