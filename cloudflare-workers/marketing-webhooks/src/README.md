# Marketing Webhooks Source

## Purpose

This folder contains the runtime code for the `marketing-webhooks` Worker.

The Worker has two runtime surfaces:

- `fetch`: validates incoming webhook/admin/test HTTP requests.
- `queue`: processes main queue messages and DLQ queue messages.

## Folder Map

- [index.ts](index.ts): HTTP routes, CORS, webhook validation before queueing, test transform route, admin DLQ routes, and queue dispatch.
- [sources](sources/README.md): source plugin contract and registered Shopify/Webflow/ActiveCampaign sources.
- `consumers`: queue processor and DLQ persistence/replay helpers.
- `clients`: outbound HTTP and Segment HTTP API clients.
- `types`: queue message, Segment event, and shared runtime types.
- `utils`: small formatting, id, casing, and Google attribution helpers.

## Dependency Flow

```text
index.ts
  -> sources for topic validation and transforms
  -> consumers for async queue processing
  -> clients for Segment and external HTTP calls
  -> types/utils for shared contracts
```

## Placement Rules

- Keep source-specific validation and transforms in `sources/<source>`.
- Keep queue side effects in `consumers`.
- Keep outbound API details in `clients`.
- Keep `index.ts` focused on request routing, early validation, and dispatch.
- Add source-level tests when a handler changes payload validation or Segment output.
