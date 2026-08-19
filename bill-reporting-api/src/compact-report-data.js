function adKey(row) {
  return [row.campaign_id, row.adset_id, row.ad_id].join(":");
}

export function compactReportData(reportData) {
  const adDimensions = [];
  const adIndexes = new Map();

  function getAdIndex(row) {
    const key = adKey(row);
    const existingIndex = adIndexes.get(key);

    if (existingIndex !== undefined) return existingIndex;

    const nextIndex = adDimensions.length;
    adDimensions.push([
      row.campaign_id,
      row.adset_id,
      row.ad_id,
      row.campaign_name ?? "Unknown campaign",
      row.adset_name ?? "Unknown ad set",
      row.ad_name ?? "Unknown ad",
    ]);
    adIndexes.set(key, nextIndex);

    return nextIndex;
  }

  const liveRows = reportData.liveAcquisition.map((row) => [
    row.hour_start_pacific,
    String(getAdIndex(row)),
    row.spend,
    row.impressions,
    row.clicks,
    row.last_touch_registrations,
    row.last_touch_immediate_vips,
    row.first_touch_registrations,
    row.first_touch_immediate_vips,
    row.solo_touch_registrations,
    row.solo_touch_immediate_vips,
  ]);

  const fiveKRows = reportData.fiveKPerformance.map((row) => [
    row.hour_start_pacific,
    String(getAdIndex(row)),
    row.last_touch_5k_purchasers,
    row.last_touch_5k_revenue,
    row.first_touch_5k_purchasers,
    row.first_touch_5k_revenue,
    row.solo_touch_5k_purchasers,
    row.solo_touch_5k_revenue,
  ]);

  return {
    reportWindow: reportData.reportWindow,
    metaDeliveryDaily: reportData.metaDeliveryDaily,
    adDimensions,
    liveRows,
    fiveKRows,
  };
}
