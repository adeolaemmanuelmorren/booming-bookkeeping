# Marketing Webhook Sources

## Purpose

This folder defines the plugin boundary for webhook sources handled by the `marketing-webhooks` Worker.

Each source owns how to:

- identify supported topics
- validate payloads
- transform validated payloads into Segment events
- optionally enrich payloads with source API data

## Source Map

- [shopify](shopify): Shopify webhook topics such as `checkouts/create`, `orders/paid`, `orders/fulfilled`, `customers/create`, and `customers/update`. Shopify has an Admin API enricher for product catalog and customer-order context.
- [webflow](webflow): Webflow webhook payloads with `triggerType: "form_submission"`. Webflow transforms form submissions into Segment `identify` and `Form Submitted` events when identity fields are present.
- [activecampaign](activecampaign): ActiveCampaign form-encoded `contact_tag_added` webhooks. The source parses bracketed contact fields, fetches the API v3 contact during queue processing, and emits Segment `identify` plus `Contact Tag Added`.
- [base.ts](base.ts): shared TypeScript interfaces for source plugins, topic handlers, validation, enrichment, and default topic extraction.
- [registry.ts](registry.ts): central source registry used by ingestion and queue processing.

## Adding Or Changing A Source

Use early validation. Reject malformed payloads before queueing whenever possible.

For a new source:

1. Add a folder under `sources/<source_name>`.
2. Implement one handler per topic.
3. Export a `MarketingSource` with a stable `name`.
4. Add a source request parser when the provider does not send JSON.
5. Register it in [registry.ts](registry.ts).
6. Add tests for parsing, validation, enrichment, and transformed Segment events.

## Placement Rules

- Put source API enrichment in the source folder when it is source-specific.
- Put generic outbound HTTP behavior in `../clients`.
- Put reusable event id, casing, and attribution helpers in `../utils`.
- Do not add route branches here; HTTP routing belongs in `../index.ts`.
