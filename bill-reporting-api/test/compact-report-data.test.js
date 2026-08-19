import assert from "node:assert/strict";
import test from "node:test";
import { compactReportData } from "../src/compact-report-data.js";

test("compacts shared ad dimensions without losing report rows", () => {
  const result = compactReportData({
    reportWindow: [{ active_week_start_pacific: "2026-08-17T10:00" }],
    metaDeliveryDaily: [],
    liveAcquisition: [
      {
        hour_start_pacific: "2026-08-17T10:00",
        campaign_id: "campaign-1",
        adset_id: "adset-1",
        ad_id: "ad-1",
        campaign_name: "Campaign",
        adset_name: "Ad set",
        ad_name: "Ad",
        spend: 10,
        impressions: 100,
        clicks: 5,
        last_touch_registrations: 2,
        last_touch_immediate_vips: 1,
        first_touch_registrations: 2,
        first_touch_immediate_vips: 1,
        solo_touch_registrations: 1,
        solo_touch_immediate_vips: 0,
      },
    ],
    fiveKPerformance: [
      {
        hour_start_pacific: "2026-08-17T10:00",
        campaign_id: "campaign-1",
        adset_id: "adset-1",
        ad_id: "ad-1",
        last_touch_5k_purchasers: 1,
        last_touch_5k_revenue: 5000,
        first_touch_5k_purchasers: 1,
        first_touch_5k_revenue: 5000,
        solo_touch_5k_purchasers: 0,
        solo_touch_5k_revenue: 0,
      },
    ],
  });

  assert.equal(result.adDimensions.length, 1);
  assert.equal(result.liveRows[0][1], "0");
  assert.equal(result.fiveKRows[0][1], "0");
});
