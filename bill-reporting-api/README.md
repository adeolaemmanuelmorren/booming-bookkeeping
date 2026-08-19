# Bill Reporting API

Private Cloud Run service used by the Bill ad reports site.

The service runs the fixed reporting queries against BigQuery and returns the
compact JSON payload expected by the site. BigQuery authentication comes from
the Cloud Run service account. The only shared credential is the report API
secret used by the site when it calls this service.

The SQL files in `sql/` are the only production query source. Keep report SQL
in this service rather than copying it into the frontend repository.

## Endpoints

- `GET /healthz` — unauthenticated health check
- `GET /v1/report-data` — live report data; requires `X-Report-Api-Key`

## Required environment

See `.env.example`. Never commit the real `REPORT_API_SECRET`.
