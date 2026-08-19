import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readQuery(fileName) {
  return readFile(new URL(`../sql/${fileName}`, import.meta.url), "utf8");
}

test("report cutoff follows the latest completed Meta hour", async () => {
  const query = await readQuery("query_report_window.sql");

  assert.match(query, /TIMESTAMP_ADD\(MAX\(hour_start\), INTERVAL 1 HOUR\)/);
  assert.match(query, /TIMESTAMP_TRUNC\(CURRENT_TIMESTAMP\(\), HOUR/);
  assert.match(query, /LEAST\([\s\S]*TIMESTAMP_ADD[\s\S]*TIMESTAMP_TRUNC/);
  assert.match(query, /DATETIME\(data_through, 'America\/Los_Angeles'\)/);
});

test("hourly reports stop at the completed-hour boundary", async () => {
  const queries = await Promise.all([
    readQuery("query_live_acquisition.sql"),
    readQuery("query_5k_performance.sql"),
  ]);

  for (const query of queries) {
    assert.match(query, /hour_start < report_window\.data_through/);
    assert.match(query, /TIMESTAMP_ADD\(MAX\(hour_start\), INTERVAL 1 HOUR\)/);
  }
});

test("daily delivery excludes the unfinished Pacific date", async () => {
  const query = await readQuery("query_meta_delivery_daily.sql");

  assert.match(
    query,
    /delivery\.date < DATE\(report_window\.data_through, 'America\/Los_Angeles'\)/,
  );
  assert.doesNotMatch(query, /BETWEEN/);
});

test("$5K revenue includes every collected mentorship payment for each buyer", async () => {
  const query = await readQuery("query_5k_performance.sql");

  assert.match(query, /payments\.payment_category = 'mentorship'/);
  assert.match(
    query,
    /payments\.payment_time >= acquisition\.registration_timestamp/,
  );
  assert.match(query, /SUM\(payments\.net_amount\) AS collected_revenue/);
  assert.doesNotMatch(query, /first_5k_revenue/);
});

test("VIP to $5K counts only buyers who were also immediate VIPs", async () => {
  const query = await readQuery("query_5k_performance.sql");

  assert.match(
    query,
    /AND is_immediate_vip\s+AND is_5k_purchaser[\s\S]*AS last_touch_immediate_vip_5k_purchasers/,
  );
});
