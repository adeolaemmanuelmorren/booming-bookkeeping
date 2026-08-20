import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readQuery(fileName) {
  return readFile(new URL(`../sql/${fileName}`, import.meta.url), "utf8");
}

const reportQueries = [
  "query_report_window.sql",
  "query_live_acquisition.sql",
  "query_5k_performance.sql",
  "query_meta_delivery_daily.sql",
];

test("every freshness boundary comes from hourly Meta delivery", async () => {
  const queries = await Promise.all(reportQueries.map(readQuery));

  for (const query of queries) {
    const boundary = query.match(
      /(?:report_window|hourly_bounds) AS \([\s\S]*?FROM `([^`]+)`[\s\S]*?WHERE source = 'meta'\s*\)/,
    );

    assert.ok(boundary, "Expected a Meta delivery freshness boundary");
    assert.equal(
      boundary[1],
      "able-folio-499722.booming_data_analytics.mart_ad_performance_hourly",
    );
  }
});

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
    assert.match(query, /PARSE_DATETIME\([^)]+@range_start_pacific\)/);
    assert.match(query, /PARSE_DATETIME\([^)]+@range_end_pacific\)/);
  }
});

test("daily delivery excludes the unfinished Pacific date", async () => {
  const query = await readQuery("query_meta_delivery_daily.sql");

  assert.match(
    query,
    /delivery\.date < DATE\(report_window\.data_through, 'America\/Los_Angeles'\)/,
  );
  assert.match(query, /delivery\.date >= DATE\([\s\S]*?@range_start_pacific/);
  assert.match(query, /delivery\.date < DATE\([\s\S]*?@range_end_pacific/);
  assert.doesNotMatch(query, /BETWEEN/);
});

test("hourly report queries read the shared Dataform reporting mart", async () => {
  const queries = await Promise.all([
    readQuery("query_live_acquisition.sql"),
    readQuery("query_5k_performance.sql"),
  ]);

  for (const query of queries) {
    assert.match(query, /mart_meta_krc_reporting_hourly/);
    assert.doesNotMatch(query, /mart_krc_acquisition/);
    assert.doesNotMatch(query, /COUNT\(DISTINCT/);
    assert.doesNotMatch(query, /FULL OUTER JOIN/);
    assert.doesNotMatch(query, /UNION ALL/);
  }
});

test("BBB semantic calculations stay in Dataform", async () => {
  const query = await readQuery("query_5k_performance.sql");

  assert.match(query, /reporting\.last_touch_5k_revenue/);
  assert.match(query, /reporting\.last_touch_immediate_vip_5k_purchasers/);
  assert.doesNotMatch(query, /\* 4997/);
  assert.doesNotMatch(query, /is_immediate_vip/);
});
