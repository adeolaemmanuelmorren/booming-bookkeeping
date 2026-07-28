# ActiveCampaign Source

This source accepts ActiveCampaign's form-encoded provider webhooks at `POST /webhook/activecampaign`.

## Flow

```text
form-encoded webhook
  -> parser.ts
  -> contact_tag_added validation
  -> Cloudflare Queue
  -> ActiveCampaign API contact enrichment
  -> Segment identify + Contact Tag Added
```

## Files

- [index.ts](index.ts): source registration, supported topics, parser, and enricher wiring.
- [parser.ts](parser.ts): bracketed ActiveCampaign POST-field parsing.
- [types.ts](types.ts): webhook and API contact contracts.
- [enricher.ts](enricher.ts): queued API v3 contact lookup.
- [extractors.ts](extractors.ts): identity, tag, and Segment anonymous-ID extraction.
- [handlers](handlers): topic validation and Segment transforms.

## Placement Rules

- Keep HTTP form parsing in `parser.ts`.
- Keep ActiveCampaign API transport in `src/clients/activecampaign.ts`.
- Keep API lookup orchestration in `enricher.ts`; do not call ActiveCampaign during the webhook response.
- Add one focused handler per ActiveCampaign event type.
