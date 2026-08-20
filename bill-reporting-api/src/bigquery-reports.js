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

  async function loadReportData() {
    const entries = await Promise.all(
      Object.entries(queries).map(async ([reportName, query]) => {
        const [rows] = await bigQuery.query({ query, location });
        return [reportName, rows];
      }),
    );

    return compactReportData(Object.fromEntries(entries));
  }

  return {
    loadReportData,
    loadReportWindow,
  };
}
