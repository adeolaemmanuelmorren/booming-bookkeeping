# Reverse Proxy Source

## Purpose

This folder contains the runtime code for the `boom-bookkeeping-segment-proxy` Worker.

[index.ts](index.ts) is intentionally a single-file Worker right now. It owns routing, domain config, attribution enrichment, CORS, cookie handling, Segment Edge SDK configuration, and error handling.

## Important Runtime Boundaries

- Route constants define the public Worker surface under `/route`.
- Attribution helpers read URL parameters, Segment event bodies, and browser cookies.
- Cookie helpers write the current attribution mirror and duplicate `attr` event signatures.
- CORS helpers allow the configured Boom Bookkeeping source and destination domains for credentialed route requests.
- The exported `fetch` handler decides whether to handle preflight, `/route/ck`, event enrichment, or Segment Edge SDK proxying.

## Placement Rules

- Keep request-routing decisions easy to scan in the exported `fetch` handler.
- Keep pure parsing and normalization helpers above the fetch handler.
- Add early returns for unsupported or no-op cases.
- Do not put unrelated browser source in this folder.
