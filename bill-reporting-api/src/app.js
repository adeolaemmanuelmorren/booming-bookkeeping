import { hasValidApiSecret } from "./auth.js";
import {
  parseReportSelection,
  selectCompactReportData,
} from "./report-selection.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const NO_STORE_HEADERS = {
  ...JSON_HEADERS,
  "Cache-Control": "private, no-store",
};

function json(response, status = 200, headers = NO_STORE_HEADERS) {
  return {
    status,
    headers,
    body: JSON.stringify(response),
  };
}

function secondsUntilNextHour(nowMs) {
  const nextHour = (Math.floor(nowMs / 3_600_000) + 1) * 3_600_000;
  return Math.max(1, Math.ceil((nextHour - nowMs) / 1_000));
}

function hourlyCacheHeaders(etag, nowMs) {
  const maxAge = secondsUntilNextHour(nowMs);

  return {
    ...JSON_HEADERS,
    "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=60`,
    ETag: etag,
    Vary: "X-Report-Api-Key",
  };
}

function etagFor(value) {
  return `"${Buffer.from(value).toString("base64url")}"`;
}

export function createRequestHandler({
  loadReportData,
  loadReportWindow,
  expectedToken,
  now = () => Date.now(),
}) {
  let cachedReport = null;
  let reportExpiresAt = 0;
  let pendingReportLoad = null;
  let cachedWindow = null;
  let windowExpiresAt = 0;
  let pendingWindowLoad = null;
  const responseCache = new Map();

  function nextHourMs(nowMs) {
    return (Math.floor(nowMs / 3_600_000) + 1) * 3_600_000;
  }

  async function getReportData() {
    const nowMs = now();
    if (cachedReport && nowMs < reportExpiresAt) return cachedReport;
    if (pendingReportLoad) return pendingReportLoad;

    pendingReportLoad = loadReportData()
      .then((reportData) => {
        cachedReport = reportData;
        reportExpiresAt = nextHourMs(now());
        responseCache.clear();
        return reportData;
      })
      .finally(() => {
        pendingReportLoad = null;
      });

    return pendingReportLoad;
  }

  async function getReportWindow() {
    const nowMs = now();
    if (cachedWindow && nowMs < windowExpiresAt) return cachedWindow;
    if (pendingWindowLoad) return pendingWindowLoad;

    pendingWindowLoad = loadReportWindow()
      .then((reportWindow) => {
        cachedWindow = reportWindow;
        windowExpiresAt = nextHourMs(now());
        return reportWindow;
      })
      .finally(() => {
        pendingWindowLoad = null;
      });

    return pendingWindowLoad;
  }

  function conditionalResponse(request, body, etag) {
    const headers = hourlyCacheHeaders(etag, now());

    if (request.headers["if-none-match"] === etag) {
      return { status: 304, headers, body: "" };
    }

    return { status: 200, headers, body };
  }

  async function serveReportWindow(request) {
    const reportWindow = await getReportWindow();
    const dataThrough = reportWindow[0]?.data_through_pacific ?? "unknown";
    const etag = etagFor(`window:${dataThrough}`);
    return conditionalResponse(
      request,
      JSON.stringify({ reportWindow }),
      etag,
    );
  }

  async function serveSelectedReport(request, url) {
    const hasSelectionParameters = ["mode", "start", "end"].some((name) =>
      url.searchParams.has(name),
    );
    const selection = parseReportSelection(url);

    if (hasSelectionParameters && !selection) {
      return json({ error: "A valid report mode and date range are required." }, 400);
    }

    const reportData = await getReportData();
    const dataThrough =
      reportData.reportWindow[0]?.data_through_pacific ?? "unknown";
    const cacheKey = selection
      ? [selection.mode, selection.start, selection.end, dataThrough].join(":")
      : `full:${dataThrough}`;
    let cachedResponse = responseCache.get(cacheKey);

    if (!cachedResponse) {
      cachedResponse = {
        body: JSON.stringify(
          selection
            ? selectCompactReportData(reportData, selection)
            : reportData,
        ),
        etag: etagFor(cacheKey),
      };
      responseCache.set(cacheKey, cachedResponse);
    }

    return conditionalResponse(
      request,
      cachedResponse.body,
      cachedResponse.etag,
    );
  }

  return async function handleRequest(request) {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true });
    }

    const isReportWindow =
      request.method === "GET" && url.pathname === "/v1/report-window";
    const isReportData =
      request.method === "GET" && url.pathname === "/v1/report-data";

    if (!isReportWindow && !isReportData) {
      return json({ error: "Not found." }, 404);
    }

    if (!hasValidApiSecret(request.headers["x-report-api-key"], expectedToken)) {
      return json({ error: "Unauthorized." }, 401);
    }

    try {
      if (isReportWindow) return await serveReportWindow(request);
      return await serveSelectedReport(request, url);
    } catch (error) {
      console.error("Unable to load BigQuery report data.", error);
      return json({ error: "Report data is temporarily unavailable." }, 503);
    }
  };
}
