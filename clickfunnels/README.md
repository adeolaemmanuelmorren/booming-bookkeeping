# ClickFunnels Tracking Snippet

## Purpose

This folder contains browser helper snippets for ClickFunnels pages in the Boom Bookkeeping funnel.

The helper loads Jitsu through the matching first-party Worker host and can be hosted from the matching R2 asset domain.

The capture trigger, conversion coverage, event-ID rules, and browser/server deduplication contract are documented in [`../CLICKFUNNELS_CLIENT_SIDE_FORM_AND_PAYMENT_CAPTURE.md`](../CLICKFUNNELS_CLIENT_SIDE_FORM_AND_PAYMENT_CAPTURE.md).

## Folder Structure

```text
clickfunnels/
  src/        Editable JS module sources
  dist/       Generated files only
  scripts/    Build tooling
  reference/  Custom-code reference snippets
```

## Source Files

The entry file is:

```text
clickfunnels/src/index.js
```

Supporting behavior is split across small files in `clickfunnels/src/`:

```text
config.js
cookies.js
attribution.js
analytics-client.js
analytics-track.js
jitsu-loader.js
datalayer.js
forms.js
identity.js
checkout-context.js
purchase-confirmation.js
```

The build script bundles the JS modules and writes:

```text
clickfunnels/dist/combined.min.js
clickfunnels/dist/combined.min.html
```

The default public R2 object key is:

```text
cf-sh-seg
```

## Publish To R2

From the repo root:

```sh
npm run publish:clickfunnels -- --dry-run
npm run publish:clickfunnels -- --bucket assets
```

The publish command:

1. rebuilds the ClickFunnels dist files;
2. uploads `clickfunnels/dist/combined.min.js` to the R2 bucket;
3. stores it at object key `cf-sh-seg`;
4. prints a script tag using the selected public asset domain.

Default printed script tag:

```html
<script src="https://assets.thebookkeepingchallenge.com/cf-sh-seg"></script>
```

Use `--public-url` to print another first-party asset domain:

```sh
npm run publish:clickfunnels -- --bucket assets --public-url=https://assets.keyboardrich.com
```

## Matching Asset Domains

Use the asset host that matches the current root domain:

```html
<script src="https://assets.thebookkeepingchallenge.com/cf-sh-seg"></script>
<script src="https://assets.keyboardrichchallenge.com/cf-sh-seg"></script>
<script src="https://assets.keyboardrich.com/cf-sh-seg"></script>
<script src="https://assets.boomingbookkeeping.com/cf-sh-seg"></script>
```

## Placement Rules

- Keep Worker route logic in `../cloudflare-workers/reverse-proxy`.
- Keep this folder focused on browser snippets that run inside ClickFunnels pages.
- Rebuild before publishing so `dist/` matches `src/`.
