# Jitsu Edge Proxy Worker

## Purpose

This Worker is the first-party Jitsu Cloud proxy, anonymous-identity boundary,
cross-domain consent service, attribution-enrichment layer, and browser
purchase-confirmation service for the Boom Bookkeeping funnel.

The approved Jitsu design is documented in
[JITSU_CLOUD_PROXY_MIGRATION.md](JITSU_CLOUD_PROXY_MIGRATION.md). The current
Cookiebot implementation is documented in
[COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md](../../COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md).

It runs on these dedicated tracking subdomains:

```text
sg.thebookkeepingchallenge.com
sg.keyboardrichchallenge.com
sg.keyboardrich.com
sg.boomingbookkeeping.com
```

Each host accepts browser requests only from its matching root domain and subdomains.

## Runtime Responsibilities

- Serve Jitsu `/p.js` through the matching Worker hostname.
- Mint, migrate, renew, and repair the readable and HttpOnly Jitsu identity cookies.
- Receive Jitsu browser events through the standard `/api/s/*` and `/v1/batch` paths.
- Resolve and store explicit Cookiebot choices across the four root domains.
- Attach the best consent status known at receipt time to every Jitsu event.
- Preserve attribution, advertising-cookie enrichment, and deterministic `attr` event suppression.
- Authenticate Worker-to-Jitsu requests with the private server-to-server write key.
- Register short-lived checkout attempts under the existing anonymous ID.
- Confirm successful new purchases against the correct Stripe account.
- Prevent the same Stripe Charge ID from being returned twice.
- Publish ClickFunnels helper assets to R2 through the existing package scripts.

## Public Paths

```text
GET     /p.js
GET     /route/ck
POST    /route/ck
POST    /api/s/page
POST    /api/s/track
POST    /api/s/identify
POST    /api/s/group
POST    /api/s/event
POST    /v1/batch
POST    /consent/bootstrap
POST    /consent/state
POST    /v1/purchase-attempts
POST    /v1/purchase-confirmations
OPTIONS /api/s/*
OPTIONS /v1/batch
OPTIONS /consent/bootstrap
OPTIONS /consent/state
OPTIONS /v1/purchase-attempts
OPTIONS /v1/purchase-confirmations
```

The old Segment `/route/ajs/*` and `/route/evs/*` paths are intentionally unsupported.

## Runtime Configuration

The Worker requires these values at runtime:

| Name | Owner | Required | Purpose |
|---|---|---:|---|
| `JITSU_CLOUD_HOST` | Cloudflare Worker | Yes | HTTPS hostname assigned to the Jitsu Cloud Site; used for `/p.js` and ingestion forwarding |
| `JITSU_WRITE_KEY` | Cloudflare Worker secret | Yes | Private server-to-server key added only to upstream `X-Write-Key` headers |
| `CONSENT_SECRET` | Cloudflare Worker secret | Yes | At least 32 random bytes used for HMAC subject-key derivation and signed consent-state cookies |
| `STRIPE_SECRET_KEY` | Cloudflare Worker secret | Yes | Read-only Stripe API key for the main ClickFunnels Stripe account |
| `STRIPE_KAJABI_SECRET_KEY` | Cloudflare Worker secret | Yes | Read-only Stripe API key for the separate Kajabi Stripe account |
| `CONSENT_SHARD` | Durable Object binding | Yes | 32 deterministically selected SQLite consent shards |
| `PURCHASE_STATE` | Durable Object binding | Yes | SQLite state keyed by the existing browser anonymous ID |

Do not put private keys in `wrangler.jsonc`, the browser helper, HTML, URLs,
payloads, or logs. Local tests use fake values and never contact Jitsu or
Stripe.

## Domains

Source page and tracking host:

```text
https://thebookkeepingchallenge.com
https://sg.thebookkeepingchallenge.com
```

Other tracked roots and matching Worker hosts:

```text
https://keyboardrichchallenge.com  -> https://sg.keyboardrichchallenge.com
https://keyboardrich.com           -> https://sg.keyboardrich.com
https://boomingbookkeeping.com      -> https://sg.boomingbookkeeping.com
```

## R2 Asset Domains

The existing ClickFunnels helper remains available from the asset subdomain matching the current root domain:

```text
assets.thebookkeepingchallenge.com
assets.keyboardrichchallenge.com
assets.keyboardrich.com
assets.boomingbookkeeping.com
```

The existing object key remains `cf-sh-seg` to avoid changing the deployed ClickFunnels asset URL during the vendor migration. The object contents now load Jitsu, not Segment.

## Local Commands

```sh
npm run dev
npm test -- --run
npm run cf-typegen
npm run publish:clickfunnels -- --dry-run
```

The publish script performs an R2 write unless `--dry-run` is supplied. Deployment and publishing are operational actions, not part of local verification.

## Placement Rules

- Keep the route overview in [src/index.ts](src/index.ts).
- Keep Jitsu forwarding, identity, attribution, CORS, and domain configuration
  in [src/jitsu-proxy.ts](src/jitsu-proxy.ts).
- Keep cross-domain consent behavior under [`src/consent/`](src/consent/).
- Keep all purchase confirmation and Stripe behavior under
  [`src/stripe/`](src/stripe/).
- Keep request routing easy to scan with early returns.
- Add Worker regression coverage in [test/index.spec.ts](test/index.spec.ts).
- Keep ClickFunnels browser behavior in [`../../clickfunnels/src/`](../../clickfunnels/src/).
