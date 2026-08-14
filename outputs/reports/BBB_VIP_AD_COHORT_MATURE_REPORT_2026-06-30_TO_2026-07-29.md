# Mature BBB, VIP, and ad-click cohort report

Fixed cohort window: **June 30–July 29, 2026**, using `America/Los_Angeles` dates.

All cohorts have had at least 14 days to mature. BBB outcomes are observed through the latest warehouse data on August 12, 2026.

Canonical sources only:

- `mart_form_submissions_server_side`
- `mart_payments`
- `mart_touchpoints_all`
- `mart_ad_performance`

## 1. BBB purchase timing

| Linked BBB purchasers | Within 14 days | Within 14 days | After 14 days |
|---:|---:|---:|---:|
| 588 | 579 | 98.47% | 9 (1.53%) |

## 2. Registration-to-BBB lag

| Lag from KRC registration | BBB purchasers | Share |
|---|---:|---:|
| Same Pacific date | 0 | 0.00% |
| 1–7 days | 227 | 38.61% |
| More than 7–13.5 days | 351 | 59.69% |
| More than 13.5–21 days | 8 | 1.36% |
| More than 21 days | 2 | 0.34% |
| **Within 13.5 days** | **578** | **98.30%** |
| **Later than 13.5 days** | **10** | **1.70%** |

## 3. VIP timing versus BBB likelihood

| Registrant group | Registrants | Bought BBB | BBB rate |
|---|---:|---:|---:|
| Same-day VIP | 1,380 | 242 | 17.54% |
| Later VIP | 899 | 176 | 19.58% |
| No VIP | 34,578 | 174 | 0.50% |

Later-VIP registrants had the highest observed BBB rate. Same-day VIP registrants were still approximately 35 times as likely to buy BBB as registrants without VIP.

## 4. Immediate VIP upgrade

| Unique KRC registrants | Same-day VIP registrants | Same-day VIP rate | Subsequently bought BBB | BBB rate among same-day VIP |
|---:|---:|---:|---:|---:|
| 36,857 | 1,380 | 3.74% | 242 | 17.54% |

| Registration-to-BBB lag among those 242 buyers | Buyers | Share |
|---|---:|---:|
| Same Pacific date | 0 | 0.00% |
| 1–7 days | 98 | 40.50% |
| More than 7–13.5 days | 140 | 57.85% |
| More than 13.5–21 days | 2 | 0.83% |
| More than 21 days | 2 | 0.83% |

## 5. Paid-click maturity test

Each registration and its VIP/BBB outcomes are attributed to the registrant's last paid click before registration.

| Paid-click registrations | Unique registrants | VIP purchases | BBB buyers | BBB within 13.5 days of click | BBB later | Share within 13.5 days | BBB revenue |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 33,685 | 33,083 | 2,029 | 518 | 510 | 8 | **98.46%** | $593,218 |

The mature cohort confirms that 13.5 days captures **98.46%** of the eventual observed BBB purchases attributed to a paid click.

### Daily paid-click cohorts

| Click date | Registrations | VIP | BBB buyers | BBB ≤13.5 days | BBB later | BBB revenue | BBB rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Jun 30 | 1,062 | 61 | 13 | 13 | 0 | $15,964 | 1.23% |
| Jul 1 | 1,173 | 74 | 18 | 18 | 0 | $17,946 | 1.54% |
| Jul 2 | 1,002 | 53 | 14 | 13 | 1 | $17,458 | 1.41% |
| Jul 3 | 1,045 | 65 | 19 | 19 | 0 | $20,452 | 1.82% |
| Jul 4 | 960 | 57 | 9 | 8 | 1 | $9,976 | 0.94% |
| Jul 5 | 1,223 | 66 | 14 | 14 | 0 | $13,958 | 1.15% |
| Jul 6 | 1,216 | 61 | 18 | 17 | 1 | $21,952 | 1.49% |
| Jul 7 | 1,193 | 56 | 17 | 17 | 0 | $16,949 | 1.43% |
| Jul 8 | 1,149 | 74 | 20 | 18 | 2 | $21,940 | 1.75% |
| Jul 9 | 932 | 70 | 16 | 16 | 0 | $18,955 | 1.73% |
| Jul 10 | 922 | 57 | 18 | 18 | 0 | $21,946 | 1.96% |
| Jul 11 | 1,005 | 66 | 14 | 14 | 0 | $17,958 | 1.40% |
| Jul 12 | 1,028 | 84 | 22 | 22 | 0 | $24,937 | 2.15% |
| Jul 13 | 958 | 62 | 19 | 18 | 1 | $23,946 | 1.99% |
| Jul 14 | 876 | 59 | 13 | 13 | 0 | $12,961 | 1.49% |
| Jul 15 | 987 | 71 | 17 | 16 | 1 | $20,949 | 1.72% |
| Jul 16 | 1,054 | 65 | 12 | 12 | 0 | $14,167 | 1.14% |
| Jul 17 | 1,100 | 78 | 28 | 28 | 0 | $27,916 | 2.55% |
| Jul 18 | 1,065 | 56 | 14 | 14 | 0 | $19,967 | 1.32% |
| Jul 19 | 1,182 | 74 | 21 | 21 | 0 | $20,937 | 1.78% |
| Jul 20 | 1,286 | 77 | 24 | 24 | 0 | $27,931 | 1.87% |
| Jul 21 | 1,264 | 75 | 12 | 12 | 0 | $11,964 | 0.95% |
| Jul 22 | 1,236 | 64 | 13 | 13 | 0 | $12,961 | 1.06% |
| Jul 23 | 1,292 | 73 | 19 | 18 | 1 | $19,446 | 1.47% |
| Jul 24 | 1,166 | 66 | 20 | 20 | 0 | $23,946 | 1.72% |
| Jul 25 | 1,206 | 79 | 23 | 23 | 0 | $29,934 | 1.91% |
| Jul 26 | 1,186 | 77 | 20 | 20 | 0 | $19,940 | 1.69% |
| Jul 27 | 1,305 | 69 | 24 | 24 | 0 | $23,928 | 1.85% |
| Jul 28 | 1,192 | 66 | 13 | 13 | 0 | $27,976 | 1.09% |
| Jul 29 | 1,420 | 74 | 14 | 14 | 0 | $13,958 | 0.99% |

### Leading ads by BBB buyers

| Platform | Campaign | Ad set | Ad | Registrations | VIP | BBB | BBB revenue |
|---|---|---|---|---:|---:|---:|---:|
| Meta | ABO_SANDBOX_2_LC | Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test) | R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV | 3,775 | 211 | 52 | $55,847 |
| Meta | ABO_SANDBOX_LC | R_ConcSSI_UA_H3_UGC_Shelley1 | R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV | 2,483 | 135 | 33 | $34,901 |
| Meta | ABO_SANDBOX_LC | R_Javier_UGC_Badge3 | R_PMA_FinalCallHook_NewJavi_UGC_SYOBFCK_Leo_Vivien | 1,031 | 109 | 32 | $38,910 |
| Meta | 2025 Keyboard Rich Challenge - VIP | (08/26/25) - SOB_Hero_Recycled | Hero_Recycled_V3 | 1,273 | 99 | 25 | $35,928 |
| Meta | ABO_SANDBOX_LC | New_Recordings_Bill_2 | VSL_Script_6-2_Revised (082425)-bill_v1_ADV | 684 | 44 | 20 | $23,943 |
| Meta | 2025 KRC Retargeting | KRC Retargeting - FB/IG Engagers | MA_JobRed_H2_S1 | 409 | 73 | 19 | $18,946 |
| Meta | ABO_SANDBOX_LC | SOB_PMA_OBJ_H5_SC_IT2 | SOB_PMA_OBJ_H5_SC_S11 | 595 | 55 | 18 | $17,946 |
| Meta | ABO_SANDBOX_LC | SOB_HT6_Reels | SOB_PMA_DES_H5_R1 | 881 | 49 | 16 | $15,955 |
| Meta | Unknown | Unknown | Unknown | 1,021 | 74 | 15 | $17,958 |
| Meta | ABO_SANDBOX_2_LC | Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test) | R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV | 1,124 | 62 | 14 | $17,458 |
| Meta | ABO_SANDBOX_LC | R_SA_ChalEx_H2_UGC_Jo1 | R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV | 847 | 55 | 14 | $16,961 |
| Meta | ABO_SANDBOX_LC | SOB_PMA_H23_R39 | SOB_PMA_H23_R184 | 1,349 | 64 | 13 | $15,964 |
| Meta | ABO_SANDBOX_LC | R_Javier_UGC_Badge1 | R_PMA_BusyWorkingtoStopHook_NewJavi_UGC_RLF_Leo_Abel | 1,295 | 69 | 12 | $14,970 |
| Meta | ABO_SANDBOX_LC | SOB_Codie_SA_PADO_H2_HPASBCA3_Pov | SOB_SA_PADO_H2-HPASBCA3-pov | 796 | 37 | 11 | $14,973 |
| Google | Unknown | Unknown | Unknown | 2,775 | 45 | 11 | $13,970 |

## Exact BigQuery queries

- `BBB_REGISTRATION_REPORTS_MATURE_2026-06-30_TO_2026-07-29.sql`
- `AD_CLICK_COHORT_MATURITY_MATURE_2026-06-30_TO_2026-07-29.sql`

