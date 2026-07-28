# Marketing Webhooks Runtime Configuration

The Cloudflare Worker owns every variable, secret, and binding listed here. Secret values must not be committed.

## Wrangler Vars

| Name | Required | Purpose | Failure behavior |
| --- | --- | --- | --- |
| `SEGMENT_API_URL` | Yes | Segment HTTP Tracking API base URL. | Segment delivery fails. |
| `ACTIVE_CAMPAIGN_SEGMENT_ANONYMOUS_ID_FIELD_IDS` | Yes for cross-domain identity | Comma-separated ActiveCampaign custom-field IDs containing the Segment anonymous ID. Production currently uses field `39`. | ActiveCampaign events still send, but cannot join the browser anonymous profile. |
| `ENABLE_TEST_ENDPOINTS` | No | Enables production `POST /__test/*` diagnostics when set to `true`. Localhost is always allowed. | Production diagnostic routes return `404`. |

## Wrangler Secrets

| Name | Required | Purpose | Failure behavior |
| --- | --- | --- | --- |
| `SEGMENT_WRITE_KEY` | Yes | Authenticates server-side Segment batches. | Queue messages retry and eventually reach the DLQ. |
| `ACTIVE_CAMPAIGN_API_URL` | Required for ActiveCampaign enrichment | Account-specific API URL from ActiveCampaign Settings -> Developer. It is stored as a Worker secret to keep account configuration out of the repository. | ActiveCampaign events fall back to webhook contact fields. |
| `ACTIVE_CAMPAIGN_API_TOKEN` | Required for ActiveCampaign enrichment | ActiveCampaign API v3 credential sent in the `Api-Token` header. | ActiveCampaign events fall back to webhook contact fields. |
| `SHOPIFY_STORE_DOMAIN` | Required for Shopify enrichment | Shopify store host used for OAuth and Admin API requests. | Shopify enrichment is unavailable. |
| `SHOPIFY_CLIENT_ID` | Required for Shopify enrichment | Shopify client-credentials identifier. | Shopify enrichment is unavailable. |
| `SHOPIFY_CLIENT_SECRET` | Required for Shopify enrichment | Shopify client-credentials secret. | Shopify enrichment is unavailable. |
| `TEST_ENDPOINT_TOKEN` | No | Bearer token protecting production `POST /__test/*` diagnostics. | If omitted while diagnostics are enabled, those diagnostic routes do not require a token. |

Set secrets with `wrangler secret put <NAME>` or the approved production secret-sync command. Do not place them in `wrangler.jsonc`.

## Cloudflare Bindings

| Binding | Resource | Purpose |
| --- | --- | --- |
| `WEBHOOK_QUEUE` | `marketing-webhooks-queue` | Buffers accepted provider webhooks for enrichment and Segment delivery. |
| `DLQ_QUEUE` | `marketing-webhooks-dlq` | Receives permanently failed or exhausted messages. |
| `DLQ_KV` | KV namespace | Stores failed messages for admin inspection and replay. |

Queue retry, batch, and dead-letter settings are defined in [`../wrangler.jsonc`](../wrangler.jsonc).
