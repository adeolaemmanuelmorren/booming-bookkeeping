# Jitsu Migration — Implementation Review (Working Doc)

Status: review of staged, un-pushed changes
Reviewed: 2026-07-18
Scope: `clickfunnels/src/*`, `cloudflare-workers/reverse-proxy/*`, migration docs, tests
Test state at review time: 41/41 passing (`test/index.spec.ts` 34, `test/clickfunnels.spec.ts` 7)

This is a working checklist. Each item has a checkbox; mark items as resolved, or strike them with a note if the current behavior is accepted deliberately.

Verification notes: the external-contract claims below were checked against the pinned Jitsu source the migration doc cites (`jitsucom/jitsu@aa2c987`, `libs/jitsu-js`) and the Jitsu HTML-snippet docs. Confirmed working as assumed: the SDK derives its event host from the `p.js` script's own origin (events will hit the Worker), `data-*` attributes are generically camelCased so `data-cookie-domain` and `data-init-only` are honored, and `jitsuQ` callbacks receive the client as an argument.

---

## 1. Manual validation runbook — run before cutover

Run on a real funnel page against a deployed (staging) Worker pointed at an isolated Jitsu destination. Do the full pass in **Chrome**. Everything below is DevTools-only — no test code required. The unit suites mock the browser and the SDK, so this pass is the only thing that exercises the real `p.js`; repeat it whenever Jitsu ships a new SDK version, since the Worker proxies upstream's latest automatically.

**Plus one 60-second Safari spot check** (the only ITP question code can't answer, because it's a WebKit runtime heuristic: the apex resolves to ClickFunnels while `sg.*` resolves to Cloudflare, and Safari's CNAME-cloaking/third-party-IP defense may silently cap server-set cookies to ~7 days): load one funnel page in Safari, Web Inspector → Storage → Cookies, read the **expiry** on `__eventn_id` / `__eventn_id_srvr`. ~5 years out = fine, done. ~7 days = the defense fired and return visitors will re-identify weekly — treat as a launch blocker.

### 1.1 The real `window.jitsu` exposes what our adapter relies on
- [ ] Validated.

Load a funnel page, open the Console, and check:

1. `typeof window.jitsu.getState` → must be `"function"`.
2. `typeof window.jitsu.on` → must be `"function"`.
3. `window.jitsu.getState().context.initialized` → must be `true` shortly after load.
4. Network tab: exactly **one** POST to `/api/s/page` per page load (no zero, no duplicates).

**Why it matters:** our readiness gate keys off `getState().context.initialized` and `on('ready')`. If either is missing, the failure is silent — callbacks fire immediately without waiting for init (`analytics-client.js:50-53`), or never fire at all. A missing method here means the gate is being bypassed and you should see it as missing/duplicated page events in step 4.

### 1.2 `__eventn_id` stays a bare UUID
- [ ] Validated after init, after reloads, and after a form identify.

DevTools → Application → Cookies → the root domain:

1. `__eventn_id` value must be a **bare UUID** — no surrounding quotes, no `%22`, no percent-encoding.
2. Reload several times; the value must not change and must not gain quoting.
3. In the Console, `window.BoomClickFunnels.getAnonymousId()` must return the identical bare UUID.
4. Fill an email field (triggers identify), then re-check the cookie.

**Why it matters:** the SDK persists its own state into this same cookie. If it ever rewrites it JSON-quoted, our client reads it raw (`analytics-client.js:69-71`), the quoted value flows into link decoration and ActiveCampaign hydration, and the handoff regex rejects it — silently breaking cross-root continuity.

### 1.3 Legacy quoted-ID links
- [ ] Checked ActiveCampaign templates; behavior decision recorded.

Two things to check:

1. Visit a funnel URL with a legacy-format handoff by hand: `https://<root>/?ajs_aid=%22<any-uuid>%22`. Current expected behavior: the Console logs `anonymous_id_handoff_conflict` and both params are stripped from the URL — i.e. the loader **rejects** the quoted form that the Worker would have accepted, and the identity handoff is lost.
2. Search live ActiveCampaign templates/automations for links carrying `ajs_aid=` and check whether any produce the quoted/encoded form.

**Decision to record:** if quoted-form links are still live, the loader needs to decode/unwrap like the Worker does; if none exist, note that here and move on.

### 1.4 Event transport: credentials, cookies, preflight
- [ ] Validated with a network trace.

Network tab, on a page load with a UTM in the URL (e.g. `?utm_source=manualtest`):

1. Find the POST to `https://sg.<root>/api/s/page`. In its **Cookies sub-tab**: request cookies must include `__eventn_id` and `__eventn_id_srvr`. If they're absent, the credentials wrapper isn't holding on the live `p.js` — stop and investigate.
2. Same request, response headers: `Set-Cookie` for `_attr_current` / `_attr_current_js` present, and Application → Cookies shows them stored with your UTM inside.
3. The OPTIONS preflight before it: status 204, `Access-Control-Allow-Origin` = exact page origin (never `*`), `Access-Control-Allow-Credentials: true`.
4. Request `Content-Type` is `application/json` and the response is not 415.
5. Navigate to a second page (no UTM): the `attr` event POST should come back **204** (Worker suppressed the duplicate). A 200 with a forwarded body on every page means dedup isn't working.
6. Open `https://sg.<root>/p.js` directly and skim the body for anything that looks like an embedded write key.
7. Cross-check in Jitsu Live Events: events arrive with the expected `anonymousId`, real visitor IP and user agent (not Cloudflare egress values), and the UTM under `context.attribution`.

### 1.5 See what a blocked `/p.js` looks like
- [ ] Observed; decided whether current behavior is acceptable.

In DevTools, use request blocking on `*/p.js` and reload:

1. Expected: after ~10s a single `jitsu_ready_timeout` console warning; no page event, no identity, no URL stamping — and **no other visible signal**.
2. Confirm the page itself still behaves (forms submit, no JS errors from our helper).

**Decision to record:** this failure mode is invisible outside DevTools. If a cohort's ad blocker or a slow Jitsu response triggers it in production, nothing will tell you. Decide whether that's acceptable for launch or whether you want a lightweight beacon/Worker-log check first.

---

## 2. What looks good (no action)

- **Clean vendor boundary.** The adapter (`analytics-client.js`) is genuinely vendor-neutral; no Segment internals leak into consumers. File renames (`segment-track.js` → `analytics-track.js`) match the plan.
- **Identity design.** Server-minted UUID, readable + HttpOnly mirror pair, legacy `ajs_anonymous_id` migration, payload fallback for uncredentialed events, and validation/redaction on every path — coherent and consistently implemented on both sides. Conflict handling (strip both params, warn without values) matches between loader and Worker, and tests assert values don't leak into logs.
- **Write-key hygiene:** key only on the upstream hop, browser `writeKey` stripped from batches, config validated with controlled 503s, upstream errors passed through without leaking internals, timeouts via AbortController.
- **Request hardening:** tenant 404s, method checks, Content-Type enforcement, 1 MB body cap checked against both declared and actual size, upstream JSON validation, per-tenant credentialed CORS with `Vary: Origin`.
- **Readiness gating** correctly distinguishes "client object exists" from "initialized," is idempotent across the queue/ready/poll races, and refuses to treat timeout as success — exactly what the design doc demanded.
- **Docs.** The two migration docs are unusually rigorous (source-pinned evidence links, explicit non-goals, validation checklists). The remaining findings are cases where the *code* hasn't caught up to what the *doc* already knows (the pre-cutover validation, the deferred caching).
- **Credentialed event transport.** The `jitsuConfig.fetch` wrapper in `jitsu-loader.js` is minimal and passthrough-correct, the migration doc carries the pinned-source evidence, and the spec covers config preservation + `credentials: "include"`.

---

## 3. Deferred — do at the very end, once cutover is stable

### 3.1 `/p.js` upstream caching
- [ ] Deliberately deferred: while the migration is still being iterated on, no cache means every change is live immediately.

`handleJitsuScriptRequest` (`src/index.ts:978-1001`) fetches the script from Jitsu Cloud on every page view. Once things are stable, cache the upstream body (`caches.default` or an isolate-global with a short TTL, e.g. 5–15 min) to take Jitsu latency/outages out of the bootstrap path. The browser-facing `Cache-Control: private, no-store` must stay regardless (responses carry visitor-specific Set-Cookie). Note: this cache only covers the upstream Jitsu script body — your own Worker and helper deploys are unaffected by it.

---

## Suggested order of work

1. Section 1 runbook in Chrome as one sitting, plus the 60-second Safari cookie-expiry check, against a staging Worker pointed at an isolated Jitsu destination (matches the migration doc's cutover step 5). Record the two decisions (1.3, 1.5) in this doc.
2. 3.1 (`/p.js` caching) — last, after cutover is stable. Re-run the section 1 runbook whenever Jitsu ships a new `p.js`.
