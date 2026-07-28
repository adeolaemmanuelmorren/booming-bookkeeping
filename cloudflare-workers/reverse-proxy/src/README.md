# Reverse Proxy Source

## Purpose

This folder contains the runtime code for the Worker that fronts Jitsu Cloud on the Boom-owned `sg.*` hostnames.

[index.ts](index.ts) is the route overview. It validates the public host,
origin, path, and method before dispatching to the focused modules.

Runtime code is organized as:

```text
index.ts                 route overview
jitsu-proxy.ts           identity, attribution, CORS, and Jitsu forwarding
stripe/
  routes.ts              purchase endpoint validation and responses
  confirmed-purchases.ts Stripe lookup and generic product resolution
  purchase-state.ts      pending attempts and replay protection
  types.ts               purchase contracts
```

## Important Runtime Boundaries

- Route constants define the Jitsu `/p.js`, `/api/s/*`, `/v1/batch`, and legacy attribution-ping surfaces.
- Identity helpers resolve cross-root handoffs and the Jitsu cookie pair before generating a UUID.
- Attribution helpers read page URLs, Jitsu event bodies, existing attribution, and browser cookies.
- Cookie helpers preserve the current attribution mirror and duplicate `attr` event signatures.
- The forwarding boundary creates a new upstream request and adds the private Jitsu write key.
- The purchase boundary derives only the Stripe account from the request
  origin. Product resolution is based on available Stripe line items or
  `metadata.products`, not the originating checkout platform.
- One SQLite Durable Object owns pending attempts and delivered Charge IDs for
  each anonymous ID.
- The exported `fetch` handler validates the host, origin, path, and method
  before dispatch. Each handler retains its existing content and body checks.

## Placement Rules

- Keep request-routing decisions easy to scan in the exported `fetch` handler.
- Keep Jitsu behavior in `jitsu-proxy.ts`.
- Keep all Stripe behavior in `stripe/`.
- Add early returns for unsupported or no-op cases.
- Do not put ClickFunnels browser source in this folder.
