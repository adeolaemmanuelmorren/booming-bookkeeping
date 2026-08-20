import { createServer } from "node:http";
import { createRequestHandler } from "./app.js";
import { createBigQueryReportLoaders } from "./bigquery-reports.js";

const port = Number(process.env.PORT ?? 8080);
const projectId = process.env.BIGQUERY_PROJECT_ID ?? "able-folio-499722";
const location = process.env.BIGQUERY_LOCATION ?? "US";
const expectedToken = process.env.REPORT_API_SECRET;

if (!expectedToken) {
  throw new Error("REPORT_API_SECRET is required.");
}

const { loadReportData, loadReportWindow } = await createBigQueryReportLoaders({
  projectId,
  location,
});
const handleRequest = createRequestHandler({
  loadReportData,
  loadReportWindow,
  expectedToken,
});

const server = createServer(async (request, response) => {
  const result = await handleRequest(request);

  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Bill reporting API listening on port ${port}.`);
});
