import { hasValidApiSecret } from "./auth.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(response, status = 200) {
  return {
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(response),
  };
}

export function createRequestHandler({
  loadReportData,
  expectedToken,
  cacheSeconds = 120,
  now = () => Date.now(),
}) {
  let cachedReport = null;
  let cacheExpiresAt = 0;
  let pendingLoad = null;

  async function getReportData() {
    if (cachedReport && now() < cacheExpiresAt) return cachedReport;
    if (pendingLoad) return pendingLoad;

    pendingLoad = loadReportData()
      .then((reportData) => {
        cachedReport = reportData;
        cacheExpiresAt = now() + cacheSeconds * 1000;
        return reportData;
      })
      .finally(() => {
        pendingLoad = null;
      });

    return pendingLoad;
  }

  return async function handleRequest(request) {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true });
    }

    if (request.method !== "GET" || url.pathname !== "/v1/report-data") {
      return json({ error: "Not found." }, 404);
    }

    if (!hasValidApiSecret(request.headers["x-report-api-key"], expectedToken)) {
      return json({ error: "Unauthorized." }, 401);
    }

    try {
      return json(await getReportData());
    } catch (error) {
      console.error("Unable to load BigQuery report data.", error);
      return json({ error: "Report data is temporarily unavailable." }, 503);
    }
  };
}
