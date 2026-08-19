import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/app.js";

function request(path, token) {
  return {
    method: "GET",
    url: path,
    headers: token ? { "x-report-api-key": token } : {},
  };
}

test("health check does not require the report secret", async () => {
  const handleRequest = createRequestHandler({
    loadReportData: async () => ({ reportWindow: [] }),
    expectedToken: "secret",
  });

  const response = await handleRequest(request("/healthz"));

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});

test("report data requires the shared API secret", async () => {
  const handleRequest = createRequestHandler({
    loadReportData: async () => ({ reportWindow: [] }),
    expectedToken: "secret",
  });

  assert.equal((await handleRequest(request("/v1/report-data"))).status, 401);
  assert.equal(
    (await handleRequest(request("/v1/report-data", "wrong"))).status,
    401,
  );
  assert.equal(
    (await handleRequest(request("/v1/report-data", "secret"))).status,
    200,
  );
});

test("concurrent report requests share one BigQuery load", async () => {
  let loadCount = 0;
  const handleRequest = createRequestHandler({
    loadReportData: async () => {
      loadCount += 1;
      return { reportWindow: [] };
    },
    expectedToken: "secret",
  });

  await Promise.all([
    handleRequest(request("/v1/report-data", "secret")),
    handleRequest(request("/v1/report-data", "secret")),
  ]);

  assert.equal(loadCount, 1);
});
