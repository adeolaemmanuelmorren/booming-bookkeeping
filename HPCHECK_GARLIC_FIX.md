# hpcheck Honeypot Fix — Garlic.js localStorage Collision

2026-07-26. Root cause found and verified live on thebookkeepingchallenge.com (form 20, test contact `adeola+test@adeolamorren.com`).

## Root cause

The ClickFunnels popup has two staging inputs that BOTH have `name="custom_type"` and class `garlic-auto-save`:

- `data-custom-type="hpcheck"` (honeypot)
- `data-custom-type="segment_anonymous_id"` (filled by our hydration)

ClickFunnels' vendor.js (Garlic.js) auto-saves fields to localStorage **keyed by input name**, so both share one key: `garlic:<domain>*>input.custom_type`.

Chain: hydration fills the segment input and dispatches `input`/`change` → Garlic persists the anonymous ID under the shared key → next pageview Garlic restores it into **both** inputs, including hpcheck → on submit ClickFunnels copies staging inputs into the hidden AC form (`hpcheck`→`field[31]`, `segment_anonymous_id`→`field[39]`) → AC form 20 receives an ID in the honeypot.

Same ID vs different ID in hpcheck = whether the visitor's anonymous ID rotated since the Garlic save. The Worker is not the cause.

Verified end-to-end: a marker planted in the Garlic key arrived at `proc.php` as `field[31]`.

## Changes (all in `clickfunnels/src/active-campaign.js` + init)

**0. Reconcile local source first.** Local src had the July-26 known-ID clear (`clearTrackingIdsFromHoneypot` + tests) deliberately removed ("local honeypot investigation reset"); the deployed bundle (SHA `9bc06ab…`) has it. Restore it before touching anything, or the next publish removes the live mitigation.

**1. Silent fill.** Delete the two `dispatchEvent` lines from `setFieldValue` (keep value + attribute set and the already-equal guard). Applies everywhere — the events' only real consumer was Garlic. Verified: with zero events, ClickFunnels still copies the staging DOM value into the AC form, and the cross-domain handoff still works. Stops all new poisoning.

**2. Garlic key purge.** On init (safe to repeat in delayed hydration passes): remove every localStorage key matching `/^garlic:.*>input\.custom_type$/`. Do NOT touch other garlic keys (`input.email` etc. are legit prefill UX). Wrap in try/catch. Heals already-poisoned browsers for all future pageviews.

**3. Keep the known-ID clear** (restored in step 0) as-is, running before the fill. Covers the one pageview where Garlic restored the value into the DOM before our script ran — key purge can't reach an already-filled input.

**Guardrail:** `hydrateActiveCampaignForms` must stay OUT of the `formdata` handler.

## Tests

- Fill sets value, fires no events.
- Purge removes seeded `…>input.custom_type` keys, leaves `…>input.email` alone.
- Restored known-ID clear tests pass; hydration still populates staging input + `field[39]`.

## Deploy + verify

- Build `cf-sh-seg`, publish to all four asset domains, confirm identical SHA-256.
- Browser check: plant a stale UUID in a `garlic:…>input.custom_type` key → load page → key deleted, hpcheck empty → submit as `adeola+test@adeolamorren.com` → `proc.php` POST has `field[31]=""`, `field[39]=<anon id>`. Repeat one submission from a Kajabi-hosted page.

## Follow-ups (optional)

- One-time AC cleanup: field 31 values matching UUID shape from the Jul 21–26 window (browser fix doesn't rewrite stored contact values).
- Delete today's three `adeola+test@adeolamorren.com` test submissions (one has marker `GARLIC-RESTORE-PROOF-123` in field 31, one has `00000000-dead-4bee-8f00-000000000001` in field 39).
