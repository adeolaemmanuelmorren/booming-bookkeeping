export type Attribution = "first" | "last" | "multi";

export type AdRow = {
  attribution: Attribution;
  platform: "Meta" | "Google";
  campaign: string;
  adSet: string;
  ad: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  registrations: number;
  bbbBuyers: number;
  bbbRevenue: number;
  revenue: number;
};

export const reportMeta = {
  startDate: "Jul 1",
  endDate: "Jul 30, 2026",
  observedThrough: "Aug 13, 2026",
  timezone: "America/Los_Angeles",
};

export const summaryByAttribution = {
  first: {
    impressions: 45180893,
    clicks: 653003,
    spend: 2208250.32,
    leads: 2835,
    registrations: 34757,
    bbbBuyers: 516,
    bbbRevenue: 544497,
    revenue: 2501646.4,
  },
  last: {
    impressions: 45180893,
    clicks: 653003,
    spend: 2208250.32,
    leads: 2835,
    registrations: 33349,
    bbbBuyers: 11,
    bbbRevenue: 10967,
    revenue: 134278.55,
  },
  multi: {
    impressions: 45180893,
    clicks: 653003,
    spend: 2208250.32,
    leads: 2835,
    registrations: 34081.71,
    bbbBuyers: 252.78,
    bbbRevenue: 267559.92,
    revenue: 1231002.02,
  },
} satisfies Record<Attribution, {
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  registrations: number;
  bbbBuyers: number;
  bbbRevenue: number;
  revenue: number;
}>;

export const productRevenue = {
  first: [
    { label: "Mentorship", value: 2124964 },
    { label: "Catalog", value: 209540 },
    { label: "VIP", value: 103964 },
    { label: "Kajabi", value: 62287 },
    { label: "Book", value: 891.4 },
    { label: "Unknown", value: 0 },
  ],
  last: [
    { label: "VIP", value: 59784 },
    { label: "Catalog", value: 38570 },
    { label: "Mentorship", value: 28964 },
    { label: "Kajabi", value: 6368 },
    { label: "Book", value: 592.55 },
    { label: "Unknown", value: 0 },
  ],
  multi: [
    { label: "Mentorship", value: 999025.39 },
    { label: "Catalog", value: 116891.12 },
    { label: "VIP", value: 81452.21 },
    { label: "Kajabi", value: 32878.43 },
    { label: "Book", value: 754.87 },
    { label: "Unknown", value: 0 },
  ],
} satisfies Record<Attribution, Array<{ label: string; value: number }>>;

export const sourceBreakdown = {
  first: [
    { source: "Meta", spend: 2165100.19, registrations: 31705, revenue: 2425016.5 },
    { source: "Google", spend: 43150.13, registrations: 3052, revenue: 76629.9 },
  ],
  last: [
    { source: "Meta", spend: 2165100.19, registrations: 30300, revenue: 131881.55 },
    { source: "Google", spend: 43150.13, registrations: 3049, revenue: 2397 },
  ],
  multi: [
    { source: "Meta", spend: 2165100.19, registrations: 31033.87, revenue: 1197110.16 },
    { source: "Google", spend: 43150.13, registrations: 3047.84, revenue: 33891.86 },
  ],
} satisfies Record<Attribution, Array<{ source: string; spend: number; registrations: number; revenue: number }>>;

export const trend = {
  first: [
  {
    "label": "Jul 1–5",
    "spend": 350111.87,
    "revenue": 433923.75,
    "registrations": 5866
  },
  {
    "label": "Jul 6–10",
    "spend": 351700.5,
    "revenue": 427584.3,
    "registrations": 5653
  },
  {
    "label": "Jul 11–15",
    "spend": 374444.87,
    "revenue": 388270.7,
    "registrations": 4986
  },
  {
    "label": "Jul 16–20",
    "spend": 398214.93,
    "revenue": 486488.65,
    "registrations": 5959
  },
  {
    "label": "Jul 21–25",
    "spend": 418098.21,
    "revenue": 422212.5,
    "registrations": 6276
  },
  {
    "label": "Jul 26–30",
    "spend": 315679.94,
    "revenue": 343166.5,
    "registrations": 6017
  }
],
  last: [
  {
    "label": "Jul 1–5",
    "spend": 350111.87,
    "revenue": 19874.8,
    "registrations": 5337
  },
  {
    "label": "Jul 6–10",
    "spend": 351700.5,
    "revenue": 19664.85,
    "registrations": 5348
  },
  {
    "label": "Jul 11–15",
    "spend": 374444.87,
    "revenue": 27017.85,
    "registrations": 4801
  },
  {
    "label": "Jul 16–20",
    "spend": 398214.93,
    "revenue": 27625.7,
    "registrations": 5622
  },
  {
    "label": "Jul 21–25",
    "spend": 418098.21,
    "revenue": 17811.6,
    "registrations": 6093
  },
  {
    "label": "Jul 26–30",
    "spend": 315679.94,
    "revenue": 22283.75,
    "registrations": 6148
  }
],
  multi: [
  {
    "label": "Jul 1–5",
    "spend": 350111.87,
    "revenue": 197380.89,
    "registrations": 5600.12
  },
  {
    "label": "Jul 6–10",
    "spend": 351700.5,
    "revenue": 212644.81,
    "registrations": 5502.85
  },
  {
    "label": "Jul 11–15",
    "spend": 374444.87,
    "revenue": 204379.24,
    "registrations": 4897.86
  },
  {
    "label": "Jul 16–20",
    "spend": 398214.93,
    "revenue": 240006.83,
    "registrations": 5800.03
  },
  {
    "label": "Jul 21–25",
    "spend": 418098.21,
    "revenue": 197573.82,
    "registrations": 6190.48
  },
  {
    "label": "Jul 26–30",
    "spend": 315679.94,
    "revenue": 179016.43,
    "registrations": 6090.37
  }
],
} satisfies Record<Attribution, Array<{ label: string; spend: number; revenue: number; registrations: number }>>;

export const timing = [
  { label: "Same day", count: 0, pct: 0 },
  { label: "1–7 days", count: 230, pct: 39.05 },
  { label: "7–13.5 days", count: 349, pct: 59.25 },
  { label: "13.5–21 days", count: 8, pct: 1.36 },
  { label: "Over 21 days", count: 2, pct: 0.34 },
];

export const vipGroups = [
  { label: "Same-day VIP", people: 1385, buyers: 244, rate: 17.62 },
  { label: "Later VIP", people: 909, buyers: 180, rate: 19.8 },
  { label: "No VIP", people: 34671, buyers: 171, rate: 0.49 },
];

export const billMetrics = {
  bbbBuyersLinkedToRegistration: 589,
  bbbWithin14Days: 580,
  bbbWithin14DaysRate: 98.47,
  bbbWithin13Point5Days: 579,
  bbbWithin13Point5DaysRate: 98.3,
  registrants: 36965,
  sameDayVip: 1385,
  sameDayVipRate: 3.75,
  sameDayVipToBbb: 244,
  sameDayVipToBbbRate: 17.62,
  paymentPlanBuyers: 107,
  highTicketBuyers: 793,
  paymentPlanRate: 13.49,
};

export const ads: AdRow[] = [
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_2_LC",
    "adSet": "Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test)",
    "ad": "R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV",
    "impressions": 3630578,
    "clicks": 64427,
    "spend": 255599.1,
    "leads": 201,
    "registrations": 4358,
    "bbbBuyers": 68,
    "bbbRevenue": 76808,
    "revenue": 325300.85
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_ConcSSI_UA_H3_UGC_Shelley1",
    "ad": "R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV",
    "impressions": 1794802,
    "clicks": 50947,
    "spend": 164210.67,
    "leads": 153,
    "registrations": 2751,
    "bbbBuyers": 40,
    "bbbRevenue": 39880,
    "revenue": 187688.75
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "2025 Keyboard Rich Challenge - VIP",
    "adSet": "(08/26/25) - SOB_Hero_Recycled",
    "ad": "Hero_Recycled_V3",
    "impressions": 1479727,
    "clicks": 18209,
    "spend": 102915.37,
    "leads": 110,
    "registrations": 1321,
    "bbbBuyers": 26,
    "bbbRevenue": 25922,
    "revenue": 141207.9
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_Javier_UGC_Badge3",
    "ad": "R_PMA_FinalCallHook_NewJavi_UGC_SYOBFCK_Leo_Vivien",
    "impressions": 802317,
    "clicks": 9296,
    "spend": 68538.34,
    "leads": 108,
    "registrations": 873,
    "bbbBuyers": 27,
    "bbbRevenue": 32925,
    "revenue": 134387.95
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "unknown",
    "adSet": "unknown",
    "ad": "unknown",
    "impressions": 0,
    "clicks": 0,
    "spend": 0,
    "leads": 0,
    "registrations": 1117,
    "bbbBuyers": 20,
    "bbbRevenue": 19940,
    "revenue": 106570.1
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_2_LC",
    "adSet": "Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test)",
    "ad": "R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV",
    "impressions": 490953,
    "clicks": 12729,
    "spend": 72253.19,
    "leads": 75,
    "registrations": 1257,
    "bbbBuyers": 18,
    "bbbRevenue": 17946,
    "revenue": 89396.8
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_SA_ChalEx_H2_UGC_Jo1",
    "ad": "R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV",
    "impressions": 1365401,
    "clicks": 29892,
    "spend": 63559.82,
    "leads": 45,
    "registrations": 904,
    "bbbBuyers": 19,
    "bbbRevenue": 21946,
    "revenue": 87223.95
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_PMA_OBJ_H5_SC_IT2",
    "ad": "SOB_PMA_OBJ_H5_SC_S11",
    "impressions": 2104154,
    "clicks": 19175,
    "spend": 80589.68,
    "leads": 82,
    "registrations": 658,
    "bbbBuyers": 19,
    "bbbRevenue": 18943,
    "revenue": 86547
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "New_Recordings_Bill_2",
    "ad": "VSL_Script_6-2_Revised (082425)-bill_v1_ADV",
    "impressions": 1221856,
    "clicks": 11352,
    "spend": 61008.8,
    "leads": 70,
    "registrations": 658,
    "bbbBuyers": 18,
    "bbbRevenue": 17949,
    "revenue": 84158.95
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "2025 KRC Retargeting",
    "adSet": "KRC Retargeting - FB/IG Engagers",
    "ad": "MA_JobRed_H2_S1",
    "impressions": 1101434,
    "clicks": 7284,
    "spend": 58334.52,
    "leads": 223,
    "registrations": 282,
    "bbbBuyers": 15,
    "bbbRevenue": 14958,
    "revenue": 76998.95
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_PMA_H23_R39",
    "ad": "SOB_PMA_H23_R184",
    "impressions": 765330,
    "clicks": 22089,
    "spend": 63041.17,
    "leads": 70,
    "registrations": 1561,
    "bbbBuyers": 17,
    "bbbRevenue": 19952,
    "revenue": 70604.95
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_HT6_Reels",
    "ad": "SOB_PMA_DES_H5_R1",
    "impressions": 1862689,
    "clicks": 15261,
    "spend": 52775.32,
    "leads": 53,
    "registrations": 935,
    "bbbBuyers": 14,
    "bbbRevenue": 13958,
    "revenue": 63044
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_Javier_UGC_Badge1",
    "ad": "R_PMA_BusyWorkingtoStopHook_NewJavi_UGC_RLF_Leo_Abel",
    "impressions": 900302,
    "clicks": 17857,
    "spend": 67485.97,
    "leads": 61,
    "registrations": 1383,
    "bbbBuyers": 11,
    "bbbRevenue": 13973,
    "revenue": 51161.95
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "CBO_VIP_VIDEOS_RESTART",
    "adSet": "(R) QJ_VSL_158k",
    "ad": "VSL_Script_4_Revised_1-bill_v1_ADV - Copy",
    "impressions": 788220,
    "clicks": 7820,
    "spend": 46458.28,
    "leads": 28,
    "registrations": 481,
    "bbbBuyers": 10,
    "bbbRevenue": 9970,
    "revenue": 50039
  },
  {
    "attribution": "first",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_Codie_SA_PADO_H2_HPASBCA3_Pov",
    "ad": "SOB_SA_PADO_H2-HPASBCA3-pov",
    "impressions": 603307,
    "clicks": 7356,
    "spend": 52107.42,
    "leads": 59,
    "registrations": 771,
    "bbbBuyers": 8,
    "bbbRevenue": 7976,
    "revenue": 44392
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "unknown",
    "adSet": "unknown",
    "ad": "unknown",
    "impressions": 0,
    "clicks": 0,
    "spend": 0,
    "leads": 0,
    "registrations": 1032,
    "bbbBuyers": 5,
    "bbbRevenue": 4985,
    "revenue": 35712.6
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_2_LC",
    "adSet": "Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test)",
    "ad": "R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV",
    "impressions": 3630578,
    "clicks": 64427,
    "spend": 255599.1,
    "leads": 201,
    "registrations": 3827,
    "bbbBuyers": 1,
    "bbbRevenue": 997,
    "revenue": 12540
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "2025 Keyboard Rich Challenge - VIP",
    "adSet": "(08/26/25) - SOB_Hero_Recycled",
    "ad": "Hero_Recycled_V3",
    "impressions": 1479727,
    "clicks": 18209,
    "spend": 102915.37,
    "leads": 110,
    "registrations": 1271,
    "bbbBuyers": 1,
    "bbbRevenue": 997,
    "revenue": 8800
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_PMA_OBJ_H5_SC_IT2",
    "ad": "SOB_PMA_OBJ_H5_SC_S11",
    "impressions": 2104154,
    "clicks": 19175,
    "spend": 80589.68,
    "leads": 82,
    "registrations": 601,
    "bbbBuyers": 1,
    "bbbRevenue": 997,
    "revenue": 6841
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "2025 KRC Retargeting",
    "adSet": "KRC Retargeting - FB/IG Engagers",
    "ad": "SOB_Script16_ADV",
    "impressions": 532257,
    "clicks": 4215,
    "spend": 30004.24,
    "leads": 85,
    "registrations": 298,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 6346
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_ConcSSI_UA_H3_UGC_Shelley1",
    "ad": "R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV",
    "impressions": 1794802,
    "clicks": 50947,
    "spend": 164210.67,
    "leads": 153,
    "registrations": 2514,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 5663
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "CBO_VIP_VIDEOS_RESTART",
    "adSet": "(R) 158k - NEW",
    "ad": "158K_V3_2-Sub",
    "impressions": 409140,
    "clicks": 3548,
    "spend": 14711.73,
    "leads": 18,
    "registrations": 207,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 5514
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "Bill_Static_Concept1_IT1",
    "ad": "Bill_Concept1_Static1_IT2",
    "impressions": 1730069,
    "clicks": 15680,
    "spend": 26723.05,
    "leads": 22,
    "registrations": 493,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 4904
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_Javier_UGC_Badge3",
    "ad": "R_PMA_FinalCallHook_NewJavi_UGC_SYOBFCK_Leo_Vivien",
    "impressions": 802317,
    "clicks": 9296,
    "spend": 68538.34,
    "leads": 108,
    "registrations": 1065,
    "bbbBuyers": 1,
    "bbbRevenue": 997,
    "revenue": 4875
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "2025 Keyboard Rich Challenge - VIP",
    "adSet": "All Winning Old Ads_NO Post ID_ADV",
    "ad": "Pegasus - Duplicate (Restart-Des)",
    "impressions": 168002,
    "clicks": 2455,
    "spend": 18063.46,
    "leads": 31,
    "registrations": 153,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 2608
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "2025 KRC Retargeting",
    "adSet": "KRC Retargeting - FB/IG Engagers",
    "ad": "MA_JobRed_H2_S1",
    "impressions": 1101434,
    "clicks": 7284,
    "spend": 58334.52,
    "leads": 223,
    "registrations": 409,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 2325
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "2025 KRC Retargeting",
    "adSet": "KRC Retargeting - FB/IG Engagers",
    "ad": "Rachelle",
    "impressions": 471066,
    "clicks": 4337,
    "spend": 25720.05,
    "leads": 102,
    "registrations": 165,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 2279
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_2_LC",
    "adSet": "Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test)",
    "ad": "R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV",
    "impressions": 490953,
    "clicks": 12729,
    "spend": 72253.19,
    "leads": 75,
    "registrations": 1074,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 1833
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_Javier_UGC_Badge1",
    "ad": "R_PMA_BusyWorkingtoStopHook_NewJavi_UGC_RLF_Leo_Abel",
    "impressions": 900302,
    "clicks": 17857,
    "spend": 67485.97,
    "leads": 61,
    "registrations": 1374,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 1786
  },
  {
    "attribution": "last",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_PMA_H23_R39",
    "ad": "SOB_PMA_H23_R184",
    "impressions": 765330,
    "clicks": 22089,
    "spend": 63041.17,
    "leads": 70,
    "registrations": 1377,
    "bbbBuyers": 0,
    "bbbRevenue": 0,
    "revenue": 1750
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_2_LC",
    "adSet": "Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test)",
    "ad": "R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV",
    "impressions": 3630578,
    "clicks": 64427,
    "spend": 255599.1,
    "leads": 201,
    "registrations": 4083.32,
    "bbbBuyers": 28.6,
    "bbbRevenue": 32122.85,
    "revenue": 140357.53
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "unknown",
    "adSet": "unknown",
    "ad": "unknown",
    "impressions": 0,
    "clicks": 0,
    "spend": 0,
    "leads": 0,
    "registrations": 1078.75,
    "bbbBuyers": 24.95,
    "bbbRevenue": 26424.22,
    "revenue": 116718.41
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_ConcSSI_UA_H3_UGC_Shelley1",
    "ad": "R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV",
    "impressions": 1794802,
    "clicks": 50947,
    "spend": 164210.67,
    "leads": 153,
    "registrations": 2630.33,
    "bbbBuyers": 17.13,
    "bbbRevenue": 17138.41,
    "revenue": 83181.01
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "2025 Keyboard Rich Challenge - VIP",
    "adSet": "(08/26/25) - SOB_Hero_Recycled",
    "ad": "Hero_Recycled_V3",
    "impressions": 1479727,
    "clicks": 18209,
    "spend": 102915.37,
    "leads": 110,
    "registrations": 1299.49,
    "bbbBuyers": 11.98,
    "bbbRevenue": 12147.3,
    "revenue": 64264.99
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_Javier_UGC_Badge3",
    "ad": "R_PMA_FinalCallHook_NewJavi_UGC_SYOBFCK_Leo_Vivien",
    "impressions": 802317,
    "clicks": 9296,
    "spend": 68538.34,
    "leads": 108,
    "registrations": 969.09,
    "bbbBuyers": 12.46,
    "bbbRevenue": 14829.66,
    "revenue": 61283.65
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_PMA_OBJ_H5_SC_IT2",
    "ad": "SOB_PMA_OBJ_H5_SC_S11",
    "impressions": 2104154,
    "clicks": 19175,
    "spend": 80589.68,
    "leads": 82,
    "registrations": 633.19,
    "bbbBuyers": 9.38,
    "bbbRevenue": 9419.28,
    "revenue": 42999.39
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "2025 KRC Retargeting",
    "adSet": "KRC Retargeting - FB/IG Engagers",
    "ad": "MA_JobRed_H2_S1",
    "impressions": 1101434,
    "clicks": 7284,
    "spend": 58334.52,
    "leads": 223,
    "registrations": 348.84,
    "bbbBuyers": 7.62,
    "bbbRevenue": 7599.16,
    "revenue": 38092.64
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_2_LC",
    "adSet": "Lookalike (US, 10%) - BBB Customers - CSV - All Time (Excl. Test)",
    "ad": "R_ConcSSI_UA_H3_UGC_RSFR_Shelley1b_ADV",
    "impressions": 490953,
    "clicks": 12729,
    "spend": 72253.19,
    "leads": 75,
    "registrations": 1163.21,
    "bbbBuyers": 7.41,
    "bbbRevenue": 7384.45,
    "revenue": 37948.93
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_SA_ChalEx_H2_UGC_Jo1",
    "ad": "R_SA_ChalEx_H2_UGC_RTMP_Jo2_ADV",
    "impressions": 1365401,
    "clicks": 29892,
    "spend": 63559.82,
    "leads": 45,
    "registrations": 876.53,
    "bbbBuyers": 8.31,
    "bbbRevenue": 9548.7,
    "revenue": 37888.34
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "New_Recordings_Bill_2",
    "ad": "VSL_Script_6-2_Revised (082425)-bill_v1_ADV",
    "impressions": 1221856,
    "clicks": 11352,
    "spend": 61008.8,
    "leads": 70,
    "registrations": 659.63,
    "bbbBuyers": 8.14,
    "bbbRevenue": 8121.61,
    "revenue": 37660.1
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_PMA_H23_R39",
    "ad": "SOB_PMA_H23_R184",
    "impressions": 765330,
    "clicks": 22089,
    "spend": 63041.17,
    "leads": 70,
    "registrations": 1465.63,
    "bbbBuyers": 6.9,
    "bbbRevenue": 8380.8,
    "revenue": 29823.56
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_HT6_Reels",
    "ad": "SOB_PMA_DES_H5_R1",
    "impressions": 1862689,
    "clicks": 15261,
    "spend": 52775.32,
    "leads": 53,
    "registrations": 896.63,
    "bbbBuyers": 6.15,
    "bbbRevenue": 6131.85,
    "revenue": 27620.44
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "R_Javier_UGC_Badge1",
    "ad": "R_PMA_BusyWorkingtoStopHook_NewJavi_UGC_RLF_Leo_Abel",
    "impressions": 900302,
    "clicks": 17857,
    "spend": 67485.97,
    "leads": 61,
    "registrations": 1379.13,
    "bbbBuyers": 4.66,
    "bbbRevenue": 5847.92,
    "revenue": 22630.11
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "CBO_VIP_VIDEOS_RESTART",
    "adSet": "(R) QJ_VSL_158k",
    "ad": "VSL_Script_4_Revised_1-bill_v1_ADV - Copy",
    "impressions": 788220,
    "clicks": 7820,
    "spend": 46458.28,
    "leads": 28,
    "registrations": 464.11,
    "bbbBuyers": 4.22,
    "bbbRevenue": 4212.33,
    "revenue": 20925.05
  },
  {
    "attribution": "multi",
    "platform": "Meta",
    "campaign": "ABO_SANDBOX_LC",
    "adSet": "SOB_Codie_SA_PADO_H2_HPASBCA3_Pov",
    "ad": "SOB_SA_PADO_H2-HPASBCA3-pov",
    "impressions": 603307,
    "clicks": 7356,
    "spend": 52107.42,
    "leads": 59,
    "registrations": 764.35,
    "bbbBuyers": 3.95,
    "bbbRevenue": 4121.97,
    "revenue": 20733.94
  }
];
