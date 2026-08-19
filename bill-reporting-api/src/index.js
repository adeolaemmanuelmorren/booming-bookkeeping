import { createServer } from "node:http";
import { createRequestHandler } from "./app.js";
import { createBigQueryReportLoader } from "./bigquery-reports.js";

const port = Number(process.env.PORT ?? 8080);
const projectId = process.env.BIGQUERY_PROJECT_ID ?? "able-folio-499722";
const location = process.env.BIGQUERY_LOCATION ?? "US";
const expectedToken = process.env.REPORT_API_SECRET;
const cacheSeconds = Number(process.env.REPORT_CACHE_SECONDS ?? 120);

if (!expectedToken) {
  throw new Error("REPORT_API_SECRET is required.");
}

const loadReportData = await createBigQueryReportLoader({ projectId, location });
const handleRequest = createRequestHandler({
  loadReportData,
  expectedToken,
  cacheSeconds,
});

const server = createServer(async (request, response) => {
  const result = await handleRequest(request);

  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Bill reporting API listening on port ${port}.`);
});
