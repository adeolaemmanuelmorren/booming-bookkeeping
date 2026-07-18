# Boom Bookkeeping Cloudflare Workers

## Read First

This folder contains the Worker code used for Boom Bookkeeping tracking and form handoff.

Start with:

- [reverse-proxy/README.md](reverse-proxy/README.md): Segment Edge SDK proxy, attribution enrichment, and ActiveCampaign form passthrough.

## Worker Map

- [reverse-proxy](reverse-proxy/README.md): first-party Segment proxy on the configured `sg.*` tracking subdomains for `thebookkeepingchallenge.com`, `keyboardrichchallenge.com`, `keyboardrich.com`, and `boomingbookkeeping.com`. It serves Analytics.js under `/route/ajs/*`, proxies browser event traffic under `/route/evs/*`, enriches attribution context, maintains current-attribution cookies per root domain, and provides the ActiveCampaign passthrough endpoint at `/forms/activecampaign/20`.

## Runtime Shape

```text
thebookkeepingchallenge.com
  -> sg.thebookkeepingchallenge.com/route/*
  -> Segment Edge SDK / Segment browser collection

keyboardrichchallenge.com
  -> sg.keyboardrichchallenge.com/route/*
  -> Segment Edge SDK / Segment browser collection

keyboardrich.com
  -> sg.keyboardrich.com/route/*
  -> Segment Edge SDK / Segment browser collection

boomingbookkeeping.com
  -> sg.boomingbookkeeping.com/route/*
  -> Segment Edge SDK / Segment browser collection

ClickFunnels popup form
  -> sg.thebookkeepingchallenge.com/forms/activecampaign/20
  -> ActiveCampaign proc.php
  -> Worker rewrites the 302 Location with ajs_aid
```

## Commands

Run from the reverse-proxy folder:

```sh
cd cloudflare-workers/reverse-proxy
npm test
npm run publish:clickfunnels -- --dry-run
npm run deploy
```
