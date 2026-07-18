# Reverse Proxy Worker

## Purpose

This Worker is the first-party Segment proxy and attribution enrichment layer for the Boom Bookkeeping funnel.

The approved proxy-based design for replacing Segment with Jitsu Cloud is documented in [JITSU_CLOUD_PROXY_MIGRATION.md](JITSU_CLOUD_PROXY_MIGRATION.md).

It runs on these dedicated tracking subdomains:

```text
sg.thebookkeepingchallenge.com
sg.keyboardrichchallenge.com
sg.keyboardrich.com
sg.boomingbookkeeping.com
```

For CORS, the Worker accepts each configured root domain and any of its subdomains.

## Runtime Responsibilities

- Serve first-party Segment Analytics.js under `/route/ajs/*`.
- Proxy Segment browser events under `/route/evs/*`.
- Enrich Segment event context with attribution parameters and known ad cookies.
- Store current attribution cookies on the matching root domain.
- Publish ClickFunnels helper assets to R2 through the package scripts.

## Important Paths

```text
GET  /route/ck
GET  /route/ajs/*
POST /route/evs/*
```

## Domains

Source page:

```text
https://thebookkeepingchallenge.com
```

Source tracking host:

```text
https://sg.thebookkeepingchallenge.com
```

Destination page:

```text
https://keyboardrichchallenge.com/vipfc-1
```

Destination tracking host:

```text
https://sg.keyboardrichchallenge.com
```

Additional tracked roots:

```text
https://keyboardrich.com
https://www.boomingbookkeeping.com/monthly
```

Additional tracking hosts:

```text
https://sg.keyboardrich.com
https://sg.boomingbookkeeping.com
```

## R2 Asset Domains

Use one R2 bucket, usually:

```text
assets
```

Connect that bucket to these public custom domains:

```text
assets.thebookkeepingchallenge.com
assets.keyboardrichchallenge.com
assets.keyboardrich.com
assets.boomingbookkeeping.com
```

The same object can then be loaded from the asset subdomain matching the current root domain.

Default published ClickFunnels object:

```text
cf-sh-seg
```

Example URLs for the same object:

```text
https://assets.thebookkeepingchallenge.com/cf-sh-seg
https://assets.keyboardrich.com/cf-sh-seg
```

## Commands

Before deploy or R2 publish, replace `REPLACE_WITH_NEW_CLOUDFLARE_ACCOUNT_ID` in [wrangler.jsonc](wrangler.jsonc) with the new Cloudflare account id.

```sh
npm run dev
npm test
npm run publish:clickfunnels -- --dry-run
npm run publish:clickfunnels -- --bucket assets
npm run deploy
npm run cf-typegen
```

## Placement Rules

- Put Segment Edge SDK route behavior, attribution enrichment, and domain config in [src/index.ts](src/index.ts).
- Keep request routing easy to scan with early returns.
- Add tests in [test/](test) for CORS, cookie behavior, redirect rewriting, and event enrichment changes.
