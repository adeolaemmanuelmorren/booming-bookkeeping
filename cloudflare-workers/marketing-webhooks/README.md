# Marketing Webhooks Worker

## Read First

This Cloudflare Worker receives backend marketing webhooks, queues valid payloads, transforms them into Segment HTTP API events, and keeps failed messages available for inspection and replay.

It currently supports Shopify, Webflow form-submission, and ActiveCampaign contact-tag webhooks. Shopify payloads can be enriched with Shopify Admin API data. ActiveCampaign tag events are enriched with the authoritative ActiveCampaign contact before Segment delivery.

Runtime entrypoints:

- [src/index.ts](src/index.ts) for HTTP ingestion, admin routes, test routes, and queue dispatch.
- [src/sources](src/sources/README.md) for source-specific webhook contracts and transforms.
- [src/consumers](src/consumers) for queue processing and dead-letter persistence.
- [wrangler.jsonc](wrangler.jsonc) for queue, KV, and environment configuration.
- [docs/environment-variables.md](docs/environment-variables.md) for Worker vars, secrets, and Cloudflare bindings.

Related docs:

- [../README.md](../README.md) for the Cloudflare Workers map.
- [../../webflow/README.md](../../webflow/README.md) for the browser-side Webflow/Shopyflow helper.
- [../../shopify/README.md](../../shopify/README.md) for the Shopify Customer Events pixel.
- [../../dataform/README.md](../../dataform/README.md) for the warehouse models that consume Segment events.

## Repo Type

Cloudflare backend Worker.

Signals:

- [wrangler.jsonc](wrangler.jsonc) points `main` at [src/index.ts](src/index.ts).
- [src/index.ts](src/index.ts) exports both `fetch` and `queue` handlers.
- The Worker uses Cloudflare Queues for async processing and KV for dead-letter storage.
- [package.json](package.json) contains Wrangler dev/deploy/typegen scripts and Vitest tests.

## Flow

```text
Shopify webhook / Webflow webhook / ActiveCampaign webhook
  -> Worker fetch handler
  -> Cloudflare Queue
  -> source-specific validation, enrichment, and transform
  -> Segment /v1/batch

Permanent failure
  -> DLQ Queue
  -> KV
  -> admin replay endpoint
```

## Folder Map

- [src/](src/README.md): Worker runtime, source registry, clients, consumers, types, and utilities.
- [src/sources](src/sources/README.md): source plugin boundary for Shopify, Webflow, and ActiveCampaign webhook topics.
- [test/](test): Cloudflare Worker tests and manual payload fixtures.
- [wrangler.jsonc](wrangler.jsonc): queue producers, queue consumers, DLQ KV namespace, Segment API URL, account id, and observability settings.

## Endpoints

- `POST /webhook/shopify` ingests Shopify webhooks. Topic is read from `X-Shopify-Topic`.
- `POST /webhook/webflow` ingests Webflow webhook payloads. Topic is read from `payload.triggerType`.
- `POST /webhook/activecampaign` ingests ActiveCampaign form-encoded webhooks after custom-header authentication. Topic is read from the `type` POST field.
- `POST /webhook` is the legacy Shopify-only endpoint.
- `GET /health` and `GET /` return health and registered sources.
- `GET /admin/dlq` lists failed messages persisted to KV.
- `POST /admin/dlq/replay` requeues a failed message by KV key.
- `POST /__test/transform/shopify/:topic` transforms a payload without queueing when `ENABLE_TEST_ENDPOINTS=true` or when running on localhost.

## Supported Shopify Topics

- `checkouts/create` -> `identify`, `Checkout Started`
- `orders/paid` -> `identify`, `Order Completed`
- `orders/fulfilled` -> `identify`, `Order Fulfilled`
- `customers/create` -> `identify`
- `customers/update` -> `identify`

## Supported Webflow Topics

- `form_submission` -> optional `identify`, `Form Submitted`

## Supported ActiveCampaign Topics

- `contact_tag_added` -> optional `identify`, `Contact Tag Added`

The ActiveCampaign handler uses `contact[id]` to fetch `GET /api/3/contacts/:id` in the queue consumer. If the API lookup fails, it falls back to the contact fields delivered in the webhook. ActiveCampaign custom field `39` is treated as the Segment anonymous ID by default so the server-side identify call can join the anonymous browser profile to the contact email.

All event `properties` and `traits` are normalized to `underscore_case` before sending to Segment.

Every event also includes source metadata in `context.marketingSource`:

```json
{
  "source": "shopify",
  "sourcePlatform": "Shopify",
  "topic": "orders/paid",
  "messageId": "abc123",
  "receivedAt": "2026-04-25T00:00:00.000Z"
}
```

## Key System Model

The Worker keeps HTTP ingestion light and moves the expensive work to a queue:

- The fetch handler validates source, topic, source-specific body encoding, and payload requirements before queueing.
- The main queue consumer validates again, enriches when a source has an enricher, transforms payloads to Segment events, and sends a batch to Segment.
- Retryable Segment failures are retried by the queue.
- Permanent validation or transform failures are sent to the DLQ queue.
- The DLQ consumer persists failed messages to KV for 30 days by default.
- Admin DLQ routes list failed keys and replay selected messages back onto the main queue.

## Adding A Source

Use [src/sources/base.ts](src/sources/base.ts) as the contract.

New sources should provide:

- a source name used in `/webhook/:source`
- a provider-specific request parser when the provider does not send JSON
- topic extraction from headers or payload
- one handler per supported topic
- validation before queueing
- transform output as Segment events
- an optional fail-safe enricher when external API data is needed

Register the source in [src/sources/registry.ts](src/sources/registry.ts).

## Configuration

`wrangler.jsonc` sets `SEGMENT_API_URL` to `https://api.segment.io`. For an EU Segment source, use `https://events.eu1.segmentapis.com`.

Required secrets:

```bash
wrangler secret put SEGMENT_WRITE_KEY
wrangler secret put ACTIVE_CAMPAIGN_API_URL
wrangler secret put ACTIVE_CAMPAIGN_API_TOKEN
wrangler secret put ACTIVE_CAMPAIGN_WEBHOOK_SECRET
wrangler secret put SHOPIFY_STORE_DOMAIN
wrangler secret put SHOPIFY_CLIENT_ID
wrangler secret put SHOPIFY_CLIENT_SECRET
```

`ACTIVE_CAMPAIGN_API_URL` is the account API URL shown under ActiveCampaign Settings -> Developer. `ACTIVE_CAMPAIGN_API_TOKEN` is sent only in the server-side `Api-Token` header. The API lookup runs after queue ingestion, not in the webhook response path.

Configure the same `ACTIVE_CAMPAIGN_WEBHOOK_SECRET` value on the ActiveCampaign webhook as a standard custom header named `X-ActiveCampaign-Webhook-Secret`. The deployed endpoint fails closed with `401` when the Worker secret or matching header is missing. Localhost bypasses this check for local development.

The Shopify enricher uses the client credentials grant to request a short-lived
Admin API access token from Shopify, then sends that token in the
`X-Shopify-Access-Token` header for product and customer enrichment calls.

Optional diagnostic protection:

```bash
wrangler secret put TEST_ENDPOINT_TOKEN
```

When `TEST_ENDPOINT_TOKEN` is set, production `__test` endpoints require:

```bash
Authorization: Bearer <TEST_ENDPOINT_TOKEN>
```

Create Cloudflare resources before deploying:

```bash
wrangler queues create marketing-webhooks-queue
wrangler queues create marketing-webhooks-dlq
wrangler kv namespace create DLQ_KV
```

After creating `DLQ_KV`, replace the placeholder KV namespace id in `wrangler.jsonc`.

## Verification

```bash
npm test
npx tsc --noEmit
```

## Placement Rules

- Put route handling and queue dispatch in [src/index.ts](src/index.ts).
- Put webhook source contracts under [src/sources](src/sources/README.md).
- Put outbound API clients under `src/clients`.
- Put queue consumers under `src/consumers`.
- Put shared queue, Segment, and source types under `src/types`.
- Keep exact endpoint behavior in code; this README should stay a navigation map.
