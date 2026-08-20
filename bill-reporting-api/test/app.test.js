import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/app.js";

function request(path, token, extraHeaders = {}) {
  return {
    method: "GET",
    url: path,
    headers: {
      ...(token ? { "x-report-api-key": token } : {}),
      ...extraHeaders,
    },
  };
}

function reportData() {
  return {
    reportWindow: [{ data_through_pacific: "2026-08-19T12:00" }],
    metaDeliveryDaily: [
      { date: "2026-08-17", campaign_id: "campaign-1" },
      { date: "2026-08-18", campaign_id: "campaign-1" },
    ],
    adDimensions: [["campaign-1", "adset-1", "ad-1"]],
    liveRows: [
      ["2026-08-17T10:00", "0", 10],
      ["2026-08-18T10:00", "0", 20],
    ],
    fiveKRows: [["2026-08-18T10:00", "0", 1]],
  };
}

function handler(overrides = {}) {
  return createRequestHandler({
    loadReportData: async () => reportData(),
    loadReportWindow: async () => reportData().reportWindow,
    expectedToken: "secret",
    now: () => Date.parse("2026-08-19T18:30:00Z"),
    ...overrides,
  });
}

test("health check does not require the report secret", async () => {
  const response = await handler()(request("/healthz"));

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});

test("report endpoints require the shared API secret", async () => {
  const handleRequest = handler();
  const path =
    "/v1/report-data?mode=live&start=2026-08-17T00%3A00&end=2026-08-19T00%3A00";

  assert.equal((await handleRequest(request(path))).status, 401);
  assert.equal((await handleRequest(request(path, "wrong"))).status, 401);
  assert.equal((await handleRequest(request(path, "secret"))).status, 200);
  assert.equal(
    (await handleRequest(request("/v1/report-window", "secret"))).status,
    200,
  );
});

test("requires a valid mode and Pacific date range", async () => {
  const handleRequest = handler();

  assert.equal(
    (
      await handleRequest(
        request("/v1/report-data?mode=live", "secret"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handleRequest(
        request(
          "/v1/report-data?mode=other&start=2026-08-17T00%3A00&end=2026-08-19T00%3A00",
          "secret",
        ),
      )
    ).status,
    400,
  );
});

test("keeps the unfiltered response available during the site rollout", async () => {
  const response = await handler()(
    request("/v1/report-data", "secret"),
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.liveRows.length, 2);
  assert.equal(body.fiveKRows.length, 1);
});

test("returns only the selected page and range", async () => {
  const handleRequest = handler();
  const liveResponse = await handleRequest(
    request(
      "/v1/report-data?mode=live&start=2026-08-17T00%3A00&end=2026-08-18T00%3A00",
      "secret",
    ),
  );
  const bbbResponse = await handleRequest(
    request(
      "/v1/report-data?mode=five-k&start=2026-08-18T00%3A00&end=2026-08-19T00%3A00",
      "secret",
    ),
  );
  const live = JSON.parse(liveResponse.body);
  const bbb = JSON.parse(bbbResponse.body);

  assert.equal(live.liveRows.length, 1);
  assert.equal(live.fiveKRows.length, 0);
  assert.equal(live.metaDeliveryDaily.length, 1);
  assert.equal(bbb.liveRows.length, 1);
  assert.equal(bbb.fiveKRows.length, 1);
  assert.deepEqual(bbb.selectedRange, {
    start: "2026-08-18T00:00",
    end: "2026-08-19T00:00",
  });
});

test("concurrent report requests share one full BigQuery load", async () => {
  let loadCount = 0;
  const handleRequest = handler({
    loadReportData: async () => {
      loadCount += 1;
      return reportData();
    },
  });
  const path =
    "/v1/report-data?mode=live&start=2026-08-17T00%3A00&end=2026-08-19T00%3A00";

  await Promise.all([
    handleRequest(request(path, "secret")),
    handleRequest(request(path, "secret")),
  ]);

  assert.equal(loadCount, 1);
});

test("report and range caches expire at the next hour", async () => {
  let nowMs = Date.parse("2026-08-19T18:30:00Z");
  let loadCount = 0;
  const handleRequest = handler({
    now: () => nowMs,
    loadReportData: async () => {
      loadCount += 1;
      return reportData();
    },
  });
  const path =
    "/v1/report-data?mode=live&start=2026-08-17T00%3A00&end=2026-08-19T00%3A00";

  await handleRequest(request(path, "secret"));
  await handleRequest(request(path, "secret"));
  nowMs = Date.parse("2026-08-19T19:00:01Z");
  await handleRequest(request(path, "secret"));

  assert.equal(loadCount, 2);
});

test("supports private browser revalidation with ETags", async () => {
  const handleRequest = handler();
  const path =
    "/v1/report-data?mode=live&start=2026-08-17T00%3A00&end=2026-08-19T00%3A00";
  const first = await handleRequest(request(path, "secret"));
  const second = await handleRequest(
    request(path, "secret", { "if-none-match": first.headers.ETag }),
  );

  assert.equal(first.status, 200);
  assert.match(first.headers["Cache-Control"], /private, max-age=1800/);
  assert.equal(second.status, 304);
  assert.equal(second.body, "");
});
