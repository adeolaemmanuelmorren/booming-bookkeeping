import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BigQuery } from "@google-cloud/bigquery";
import { compactReportData } from "./compact-report-data.js";

const QUERY_FILES = {
  reportWindow: "query_report_window.sql",
  liveAcquisition: "query_live_acquisition.sql",
  fiveKPerformance: "query_5k_performance.sql",
  metaDeliveryDaily: "query_meta_delivery_daily.sql",
};

const FULL_HISTORY_RANGE = {
  range_start_pacific: "1970-01-01T00:00",
  range_end_pacific: "2100-01-01T00:00",
};

async function readQueries() {
  const entries = await Promise.all(
    Object.entries(QUERY_FILES).map(async ([reportName, fileName]) => {
      const queryUrl = new URL(`../sql/${fileName}`, import.meta.url);
      return [reportName, await readFile(fileURLToPath(queryUrl), "utf8")];
    }),
  );

  return Object.fromEntries(entries);
}

export async function createBigQueryReportLoaders({ projectId, location }) {
  const bigQuery = new BigQuery({ projectId });
  const queries = await readQueries();

  async function loadReportWindow() {
    const [rows] = await bigQuery.query({
      query: queries.reportWindow,
      location,
    });

    return rows;
  }

  async function runReportQuery(reportName, params) {
    const [rows] = await bigQuery.query({
      query: queries[reportName],
      location,
      params,
    });

    return rows;
  }

  async function loadReportData() {
    const [reportWindow, liveAcquisition, fiveKPerformance, metaDeliveryDaily] =
      await Promise.all([
        loadReportWindow(),
        runReportQuery("liveAcquisition", FULL_HISTORY_RANGE),
        runReportQuery("fiveKPerformance", FULL_HISTORY_RANGE),
        runReportQuery("metaDeliveryDaily", FULL_HISTORY_RANGE),
      ]);

    return compactReportData({
      reportWindow,
      liveAcquisition,
      fiveKPerformance,
      metaDeliveryDaily,
    });
  }

  async function loadSelectedReportData(selection, reportWindow) {
    const params = {
      range_start_pacific: selection.start,
      range_end_pacific: selection.end,
    };
    const livePromise = runReportQuery("liveAcquisition", params);
    const dailyPromise = runReportQuery("metaDeliveryDaily", params);
    const fiveKPromise =
      selection.mode === "five-k"
        ? runReportQuery("fiveKPerformance", params)
        : Promise.resolve([]);
    const [liveAcquisition, fiveKPerformance, metaDeliveryDaily] =
      await Promise.all([livePromise, fiveKPromise, dailyPromise]);

    return {
      ...compactReportData({
        reportWindow,
        liveAcquisition,
        fiveKPerformance,
        metaDeliveryDaily,
      }),
      selectedRange: {
        start: selection.start,
        end: selection.end,
      },
    };
  }

  return {
    loadReportData,
    loadReportWindow,
    loadSelectedReportData,
  };
}
