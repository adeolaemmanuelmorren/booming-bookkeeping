# Jitsu Cloud migration through the controlled edge proxy

Status: approved migration design  
Last reviewed: 2026-07-17

## Decision

Replace Segment browser collection and Segment Edge SDK forwarding with Jitsu while keeping the existing Cloudflare Worker as the browser-facing collection, identity, cookie, and enrichment boundary.

```text
Browser on a Boom funnel domain
  -> matching sg.<root-domain> Worker
  -> existing cookie, attribution, deduplication, and enrichment logic
  -> Jitsu Cloud ingestion
  -> Jitsu destinations
```

This design uses Jitsu Cloud only. Self-hosting Jitsu is out of scope.

The browser will still use a vendor SDK: the Jitsu browser SDK. Funnel code will continue calling methods such as `page`, `track`, `identify`, and `group`; it will not construct an individual HTTP request for every event. Jitsu documents these Analytics.js-compatible browser methods and documents the HTTP endpoints to which the Worker can forward them.

The Boom Worker remains the public tracking origin. The Jitsu write key and Jitsu Cloud hostname remain server-side. A direct CNAME to Jitsu is not part of this design because it would bypass the Worker.

## Constraints

- Jitsu must be Jitsu Cloud.
- ClickFunnels hostnames cannot be changed.
- The ClickFunnels apex records must remain DNS-only.
- ClickFunnels cannot be changed to proxy one of its paths through the Worker.
- The existing `sg.*` Worker custom domains remain the browser-facing tracking hosts.
- Existing identity continuity, attribution, enrichment, CORS, and event semantics must be preserved.

The result is same-site, cross-origin collection:

```text
Page:       https://keyboardrichchallenge.com
Collector:  https://sg.keyboardrichchallenge.com
```

These hosts are not same-origin, but they share the same registrable domain. The Worker response can therefore set parent-domain cookies using `Domain=keyboardrichchallenge.com`. Exact same-origin collection is neither available nor required to preserve the current Worker behavior.

## Target architecture

```mermaid
flowchart LR
    Page["ClickFunnels page"]
    Worker["Boom Worker on sg.<root-domain>"]
    Jitsu["Jitsu Cloud ingestion"]
    Destinations["Jitsu destinations"]

    Page -->|"GET /p.js"| Worker
    Worker -->|"Jitsu SDK + identity cookies"| Page
    Page -->|"page / track / identify / group"| Worker
    Worker -->|"enriched event + private write key"| Jitsu
    Jitsu --> Destinations
```

The Worker continues to run on:

```text
sg.thebookkeepingchallenge.com
sg.keyboardrichchallenge.com
sg.keyboardrich.com
sg.boomingbookkeeping.com
```

## Preservation contract

The migration is a vendor-boundary change, not a rewrite of the tracking system. Existing behavior should be moved only where Segment-specific APIs require it.

| Functionality | Current responsibility | Migration requirement |
|---|---|---|
| Tenant routing | Map each `sg.*` hostname to its trusted root domain and allowed origins | Preserve unchanged |
| Browser SDK delivery | Serve the collection SDK through the Worker | Serve Jitsu `/p.js` through the same Worker |
| Browser event transport | Receive browser events at the Worker | Change the public event paths to Jitsu's standard paths |
| Server-managed anonymous identity | Establish and renew an anonymous ID before events are forwarded | Preserve with a readable Jitsu cookie plus an authoritative HttpOnly mirror |
| Existing visitor continuity | Reuse the current Segment anonymous ID | Migrate `ajs_anonymous_id` before generating a new ID |
| Cross-root continuity | Decorate approved links and hydrate ActiveCampaign with `ajs_aid` | Continue `ajs_aid`, add Jitsu's `an_aid`, and keep both values identical |
| Credentialed CORS | Allow only configured tenant roots and subdomains | Preserve unchanged |
| Attribution extraction | Read page URLs, event fields, stored attribution, and ad cookies | Preserve unchanged |
| Attribution persistence | Maintain `_attr_current` and `_attr_current_js` | Preserve unchanged |
| Payload enrichment | Merge attribution and visitor context before ingestion | Preserve unchanged |
| Advertising IDs | Capture the supported Facebook, Google, Microsoft, TikTok, Reddit, and LinkedIn values | Preserve unchanged |
| `attr` event deduplication | Generate deterministic `event_id` values and suppress repeats with `_attr_event_sig` | Preserve unchanged |
| Form and order tracking | Track the existing ClickFunnels and checkout event contract | Preserve event names and properties |
| ActiveCampaign hydration | Carry the anonymous identity through the existing field and link flows | Preserve behavior; change only the identity source behind its adapter |
| Data-layer integration | Convert existing data-layer activity into analytics calls | Preserve behavior; change only the SDK adapter |
| R2 asset helper | Load the existing browser helper from R2 | Preserve unchanged |
| Upstream forwarding | Authenticate and send through `@segment/edge-sdk` | Replace with authenticated Jitsu Cloud HTTP forwarding |
| Error boundary and observability | Return controlled errors and log safely | Preserve with Jitsu-specific upstream status handling |

## Minimal required changes

| Boundary | Current Segment implementation | Jitsu implementation |
|---|---|---|
| SDK asset | Segment Analytics.js under `/route/ajs/*` | Worker-served Jitsu `/p.js` |
| Browser SDK calls | Segment globals and `analytics.user()` internals | Small Jitsu-backed, vendor-neutral adapter |
| Event routes | `/route/evs/*` | Jitsu standard `/api/s/*` and `/v1/batch` paths |
| Identity cookies | Segment `ajs_anonymous_id` plus current cross-domain behavior | Jitsu cookie pair, seeded from the existing Segment ID |
| Cross-root query parameters | Segment `ajs_aid` | Emit both `ajs_aid` and `an_aid` with the same canonical ID |
| Upstream client | `@segment/edge-sdk` | Jitsu Cloud HTTP API |
| Upstream credentials | Segment write key | Private `JITSU_WRITE_KEY` and `JITSU_CLOUD_HOST` Worker configuration |
| Dependency cleanup | Segment package and configuration | Remove only after the comparison and rollback window |

Everything else in the Worker should be treated as preserved logic. Existing helpers for tenant resolution, CORS, attribution, cookie parsing, advertising IDs, event enrichment, deterministic IDs, and duplicate suppression should be reused unless a Jitsu payload-shape difference forces a narrow adapter.

The same rule applies to the ClickFunnels browser code. Form tracking, order tracking, attribution triggers, link decoration, ActiveCampaign hydration, and data-layer behavior should not be redesigned. Segment-specific loading and identity access should move behind a small adapter.

## Public Worker endpoints

The Jitsu browser SDK should send to the Worker using Jitsu's standard paths:

```text
GET     /p.js
POST    /api/s/page
POST    /api/s/track
POST    /api/s/identify
POST    /api/s/group
POST    /api/s/event
POST    /v1/batch
OPTIONS /api/s/*
OPTIONS /v1/batch
```

The Worker forwards those requests to the corresponding Jitsu Cloud endpoints after applying the existing controls and enrichment.

## Browser SDK behavior

The browser continues to use the Jitsu SDK:

```javascript
jitsu.page();
jitsu.track("Form Submitted", properties);
jitsu.identify(userId, traits);
jitsu.group(groupId, traits);
```

Jitsu's JavaScript reference describes its API as based on and compatible with Analytics.js. That supports the existing high-level method model. It does not mean every undocumented Segment object is present.

The client adapter should provide only the capabilities the existing helper needs:

```text
ready(callback)
page(properties?)
track(name, properties, context?)
identify(userId?, traits?, context?)
getAnonymousId()
setAnonymousId(id)
getTraits()
```

The main Segment-specific incompatibility is code such as `analytics.user().anonymousId()` and `analytics.user().traits()`. The adapter should obtain the anonymous ID from the readable Worker-managed cookie or its initialized state. Existing consumers should call the adapter rather than accessing Jitsu or Segment internals.

Jitsu initialization should not emit a page event until the Worker-managed identity is available. Jitsu documents initialization-only loading and an onload hook for this sequencing.

## Server-managed anonymous identity

### The Worker should mint the ID

Yes: the Worker should generate the anonymous ID on the server when it receives the first eligible request and no usable identity already exists.

The incoming `Cookie` header includes both readable cookies and HttpOnly cookies for that request. `HttpOnly` prevents browser JavaScript from reading a cookie; it does not hide the cookie from the server receiving the request. The Worker therefore knows whether an authoritative anonymous ID exists before returning `/p.js` or forwarding an event.

No additional browser identity request is required. The first `/p.js` request is the bootstrap:

1. The browser adapter reads and validates `ajs_aid` and `an_aid` on the page URL.
2. When a valid handoff exists, the adapter makes both page parameters equal to that value.
3. The adapter requests `https://sg.<root-domain>/p.js?ajs_aid=<id>&an_aid=<id>`.
4. The Worker resolves the tenant, handoff parameters, and request cookies.
5. The Worker reuses, accepts, or generates the authoritative anonymous ID.
6. The Worker returns the Jitsu script with both identity `Set-Cookie` headers.
7. The browser stores those cookies before executing the returned script.
8. Jitsu reads the non-HttpOnly cookie and the matching `an_aid`, then uses that ID for its first event.

The page query string is not automatically copied onto the cross-origin `/p.js` request. The adapter must explicitly copy the two handoff parameters onto the script URL so the Worker can resolve the same identity before Jitsu executes.

The `/p.js` browser response must be `Cache-Control: private, no-store` because its headers are visitor-specific. The unmodified upstream Jitsu script body may be cached separately inside the Worker; each browser response must still be newly wrapped with the correct cookie headers.

The same identity resolver should run on every accepted event request. That lets the Worker repair a missing readable cookie from the HttpOnly mirror, renew expiry, and prevent a payload from silently switching identities.

### Identity precedence and Segment migration

Use this order:

1. A valid cross-root handoff represented by matching `an_aid` and `ajs_aid` values, or by either single valid parameter during migration.
2. Valid `__eventn_id_srvr` from the destination root domain.
3. Valid `__eventn_id` from the destination root domain.
4. Valid existing `ajs_anonymous_id`, normalized if legacy encoding requires it.
5. A new ID from `crypto.randomUUID()`.

The handoff wins because its purpose is to carry the source root's identity onto the destination root. This also matches Jitsu's current native `an_aid` behavior: its browser dependency reads `an_aid` from the page URL, gives it precedence over persisted browser state, and writes it into Jitsu's readable anonymous-ID storage.

When no valid handoff exists, the HttpOnly value wins over a conflicting readable Jitsu cookie and the Worker repairs the readable cookie. The existing Segment cookie is used before generating a new ID so cutover does not create an artificial identity break.

If both query parameters are present but differ, the adapter and Worker must reject the handoff, remove or neutralize `an_aid` before Jitsu initializes, retain an existing local identity when available, and record a redacted conflict metric. Otherwise Jitsu would automatically accept `an_aid` while the Worker accepted a different value.

Validate all accepted IDs for length and allowed characters. Redact identity query parameters and cookie values from logs.

### Cookie pair

Use Jitsu's documented cookie names:

```text
__eventn_id
__eventn_id_srvr
```

`__eventn_id` is readable by the Jitsu SDK. `__eventn_id_srvr` is the authoritative HttpOnly mirror.

```text
__eventn_id=<id>;
Domain=keyboardrichchallenge.com;
Path=/;
Max-Age=157680000;
SameSite=Lax;
Secure
```

```text
__eventn_id_srvr=<id>;
Domain=keyboardrichchallenge.com;
Path=/;
Max-Age=157680000;
SameSite=Lax;
Secure;
HttpOnly
```

The root cookie domain must come from the Worker's trusted hostname configuration. It must never come from a caller-supplied value.

### UUID uniqueness

The installed Segment Edge SDK generates a new anonymous ID with UUID v4 when the incoming context does not already provide one. The replacement should call Cloudflare's standards-based `crypto.randomUUID()`, which also produces UUID v4.

UUID v4 contains 122 random bits after its version and variant bits. It therefore provides the same practical uniqueness class as the existing Segment implementation. The approximate probability of at least one collision is:

```text
1 billion generated IDs:   9.4 × 10^-20
1 trillion generated IDs:  9.4 × 10^-14
```

Uniqueness should come from a cryptographically secure UUID generator. Do not derive the ID from time, IP address, user agent, email, or a counter.

### Cross-root-domain continuity

Cookies cannot be shared directly across separate registrable domains such as `keyboardrichchallenge.com` and `keyboardrich.com`. Preserve the existing handoff:

- Decorate approved cross-root links with both `ajs_aid` and `an_aid`.
- Write the same canonical anonymous ID into both parameters.
- Continue ActiveCampaign hidden-field hydration.
- Preserve the existing ActiveCampaign `ajs_aid` field and redirect template while adding `an_aid` to supported URLs.
- Let a valid handoff replace the destination root's prior anonymous ID.
- Copy the handoff onto the `/p.js` request so the Worker sees it before minting.
- Set the accepted value into both Jitsu cookies before the first page event.
- Keep `ajs_aid` for Segment-era compatibility; do not rely on Jitsu to interpret it.

Jitsu automatically recognizes `an_aid` in its current SDK implementation. This behavior comes from Jitsu's pinned `analytics@0.8.9` browser dependency rather than from the public Jitsu JavaScript reference. Treat it as a tested compatibility contract: retain the Worker implementation even though Jitsu also reads the parameter, and add an end-to-end browser test so an upstream SDK change cannot silently break continuity.

## Cookie durability and same-origin qualification

The expected result is durable, server-managed, first-party-domain cookies, subject to normal browser and user controls.

The browser request terminates at the Boom-controlled Worker. Jitsu Cloud receives a server-to-server request and is not the CNAME target serving the browser. This avoids the direct third-party CNAME-cloaking topology described by WebKit.

Jitsu's ITP guide describes its strongest topology as an ID endpoint on the website hostname, or on a subdomain resolving to the same IP as the website. The immutable ClickFunnels apex and the Worker do not satisfy that exact same-host/same-IP recipe. Exact same-origin is impossible under the stated DNS and ClickFunnels constraints.

That does not prevent the current functionality from being preserved:

- The Worker sets the cookie for the funnel's parent domain.
- The identity is server-minted and protected by an HttpOnly mirror.
- Every event request can renew or repair the cookie pair.
- Jitsu is not exposed as a third-party browser-facing CNAME target.

No cookie can be promised to be permanent. Users can clear storage, private browsing is ephemeral, and browser policies can change. Safari return-visitor tests remain a required launch check.

## Worker event pipeline

For each Jitsu event request, preserve the current pipeline and change only the vendor-facing boundary:

1. Resolve the tenant from the `sg.*` hostname.
2. Validate `Origin` against that tenant.
3. Handle `OPTIONS` with an early return.
4. Reject unsupported paths, methods, content types, and oversized bodies.
5. Parse the single event or batch.
6. Resolve, migrate, mint, repair, or renew the anonymous identity.
7. Ensure the forwarded event uses the authoritative identity.
8. Apply the existing attribution extraction and persistence.
9. Apply the existing advertising-cookie enrichment.
10. Apply the existing deterministic `attr` event ID and duplicate suppression.
11. Preserve visitor context before the server-to-server hop.
12. Add the private Jitsu authentication header.
13. Forward to the corresponding Jitsu Cloud endpoint.
14. Return the controlled status, credentialed CORS headers, and any renewed cookies.

## Jitsu Cloud forwarding boundary

Jitsu documents these server-facing endpoints:

```text
POST https://<jitsu-cloud-site>/api/s/{event-type}
POST https://<jitsu-cloud-site>/v1/batch
```

Documented event types include `page`, `track`, `identify`, `group`, and `event`. Jitsu also documents `/v1/batch` as Segment-compatible, which provides a supported path for compatible batch payloads.

Store the upstream configuration in the Worker:

```text
JITSU_CLOUD_HOST
JITSU_WRITE_KEY
```

Add the write key only on the Worker-to-Jitsu request:

```http
X-Write-Key: <JITSU_WRITE_KEY>
Content-Type: application/json
```

The key must not appear in the browser helper, HTML, script URL, event payload, query string, or logs.

Because the Worker creates a new upstream request, explicitly preserve the visitor values Jitsu should receive:

```text
context.ip
context.userAgent
context.page
context.locale
context.screen
context.campaign / context.attribution
```

Use `CF-Connecting-IP` only after the request has terminated at Cloudflare and only under the chosen privacy policy. Do not trust a caller-supplied IP header.

## Credentialed CORS

The existing per-tenant CORS contract remains required:

```http
Access-Control-Allow-Origin: https://keyboardrichchallenge.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

Preflight handling should continue to allow only the methods and headers the SDK actually uses. Unknown origins must not be echoed, and credentialed responses must never use `Access-Control-Allow-Origin: *`.

## V2: Cookiebot consent integration

Status: deferred. Nothing in this section is required for the initial Segment-to-Jitsu cutover.

V1 preserves the current collection behavior while changing the vendor boundary. Cookiebot gating, consent-aware routing, opt-out cleanup, and consent-specific endpoints are a separate V2 implementation.

### Integration decision

Jitsu does not automatically understand Cookiebot. A small browser adapter must read Cookiebot and call Jitsu's documented consent controls.

Cookiebot exposes:

```text
Cookiebot.consent.necessary
Cookiebot.consent.preferences
Cookiebot.consent.statistics
Cookiebot.consent.marketing
Cookiebot.consent.method
Cookiebot.hasResponse
Cookiebot.doNotTrack
```

Cookiebot also emits `CookiebotOnConsentReady`, `CookiebotOnAccept`, and `CookiebotOnDecline`. `CookiebotOnConsentReady` fires when consent is available from either a new response or the existing CookieConsent cookie.

Jitsu supports runtime `configure()` calls with:

```text
privacy.dontSend
privacy.disableUserIds
privacy.ipPolicy
privacy.consentCategories
```

Jitsu places `consentCategories` on each event as `context.consent.categoryPreferences`. Jitsu documents two pre-consent modes: send nothing, or send limited events without identifiers. This project should begin with **send nothing before consent** because the Worker otherwise sets a persistent anonymous-ID cookie on `/p.js` before the user's decision.

### Recommended category policy

This table is the technical launch policy. Privacy counsel must approve the final purposes, retention, regional rules, and disclosures.

| Cookiebot state | Browser behavior | Worker behavior | Destination behavior |
|---|---|---|---|
| Consent not ready | Do not request `/p.js`; queue no analytics calls | Do not mint tracking identity | No Jitsu event |
| Necessary only / declined | Keep Jitsu disabled | Allow only consent control and explicitly approved operational requests; do not create a persistent analytics ID | No statistics or marketing destination |
| Statistics accepted | Enable approved page and product-analytics events | Permit anonymous identity; minimize IP according to policy | Permit statistics and restricted warehouse connections |
| Marketing accepted | Enable approved marketing measurements in addition to any other accepted categories | Permit approved ad-ID enrichment | Permit marketing connections only while `marketing=true` |
| Consent withdrawn | Disable Jitsu immediately and call `POST /consent` | Expire Worker-managed identity and attribution cookies and stop minting | Drop future non-necessary events |

Cookiebot categories are independent. The adapter and Worker must evaluate each category rather than treating `Cookiebot.consented` as permission for every purpose.

### Browser adapter

Register Cookiebot listeners before the Cookiebot script can emit them. Use one idempotent handler for initial state and subsequent changes:

```javascript
function readCookiebotConsent() {
  return {
    necessary: Boolean(Cookiebot.consent.necessary),
    preferences: Boolean(Cookiebot.consent.preferences),
    statistics: Boolean(Cookiebot.consent.statistics),
    marketing: Boolean(Cookiebot.consent.marketing),
  };
}

function applyCookiebotConsent() {
  var categories = readCookiebotConsent();
  var maySendAnalytics = categories.statistics || categories.marketing;

  if (!window.jitsu || typeof window.jitsu.configure !== "function") {
    return categories;
  }

  jitsu.configure({
    privacy: {
      dontSend: !maySendAnalytics,
      disableUserIds: !maySendAnalytics,
      ipPolicy: maySendAnalytics ? "stripLastOctet" : "remove",
      consentCategories: categories,
    },
  });

  return categories;
}
```

On the initial `CookiebotOnConsentReady` call, the returned category map decides whether Jitsu should be loaded. After Jitsu's onload callback, call the same handler again to apply the privacy configuration before emitting the first event.

The production adapter must also gate calls by purpose:

- `page` and ordinary behavioral `track` calls require `statistics=true`.
- Marketing measurements, ad-cookie enrichment, and marketing destination activation require `marketing=true`.
- `identify` with email or another direct identifier must follow the approved form purpose and destination policy; it must not be enabled merely because statistics consent exists.
- Preference-only behavior requires `preferences=true`.

Jitsu's global privacy flags cannot express all those event-purpose distinctions by themselves. The browser adapter and Worker event allowlist must enforce them.

### Loading order

The default launch sequence is:

1. Register Cookiebot event listeners.
2. Load Cookiebot.
3. Wait for `CookiebotOnConsentReady`.
4. Read the four category booleans.
5. If neither statistics nor marketing is allowed, do not request Jitsu `/p.js`.
6. If an allowed purpose exists, load Jitsu in initialization-only mode through the Worker.
7. Resolve the cross-root handoff and Worker cookie pair.
8. Configure Jitsu with the Cookiebot category snapshot.
9. Emit only the events allowed by those categories.

This avoids creating Jitsu cookies before Cookiebot has resolved the visitor's choice. It also preserves the no-extra-identity-request design: `/p.js` still performs identity bootstrap when Jitsu is allowed to load.

### Worker enforcement

Browser gating is not sufficient. The Worker should enforce the same policy before forwarding:

1. Read the root-domain `CookieConsent` cookie when present. Cookiebot documents server-side parsing of this cookie for server-set cookies.
2. Accept a normalized consent snapshot from the browser for immediate consent changes.
3. Resolve discrepancies conservatively and never treat missing consent as permission.
4. Write the normalized booleans to `context.consent.categoryPreferences`.
5. Apply an event-purpose allowlist before enrichment and forwarding.
6. Do not collect advertising-cookie values unless `marketing=true`.
7. Do not mint or renew a persistent Jitsu identity unless the approved policy permits it.
8. Apply the configured IP policy before forwarding.

The Worker must not trust a caller-supplied label such as `purpose=necessary` by itself. Necessary operational events must be an explicit allowlist of event names and properties.

### Withdrawal and opt-out

Provide Cookiebot's Privacy Trigger or an equivalent visible control using `Cookiebot.renew()` so visitors can change their choices. Cookiebot also exposes `withdraw()` for withdrawing consent.

When consent is declined or withdrawn:

1. Call Jitsu `configure()` with `dontSend=true`, `disableUserIds=true`, `ipPolicy="remove"`, and the current category map.
2. Send one credentialed `POST /consent` control request to the Worker. This is the only additional request introduced by consent changes; it is not part of ordinary page initialization.
3. Expire `__eventn_id`, `__eventn_id_srvr`, `_attr_current`, `_attr_current_js`, and `_attr_event_sig` when their purposes are no longer allowed.
4. Stop advertising-ID extraction and non-necessary forwarding.
5. If an audit record is required, store a minimal no-identity consent-change record. Do not send it through a marketing destination.

The HttpOnly cookie must be cleared by the Worker. Clearing only Jitsu's readable cookie would leave `__eventn_id_srvr`, allowing the Worker to restore the identity on a later request.

If the visitor later grants consent again, create a new anonymous ID unless the approved privacy policy explicitly allows restoring the old one. Jitsu's runtime implementation also generates a new anonymous ID when identifiers are re-enabled after being disabled.

### Explicit form submissions and email

Cookie consent and a person's deliberate form submission are separate processing decisions. A submitted email may be required to deliver a requested lead magnet, appointment, account, or service, but that does not automatically authorize analytics profiling, advertising activation, or email marketing.

Recommended separation:

- Keep the submitted email in the system of record that fulfills the request, such as ClickFunnels, ActiveCampaign, or the application backend.
- Keep raw email out of ordinary Jitsu page and behavioral events unless there is a documented need and approved legal basis.
- If Jitsu must carry an operational submission event, use a separately classified event or Site, an explicit property allowlist, a restricted retention policy, and connections that exclude all marketing destinations.
- Record email-marketing permission separately from Cookiebot's `marketing` cookie category. Cookiebot marketing-cookie consent is not, by itself, proof of subscription to marketing email.
- Provide the applicable unsubscribe, consent-change, deletion, and data-subject request mechanisms outside the analytics SDK.

Not using collected information for marketing does not by itself make collection consent-free. Cookie storage, audience measurement, form fulfillment, CRM storage, and email marketing can have different legal bases and notice requirements.

### Jitsu destination enforcement

Attach a Jitsu Function to every statistics and marketing connection. Jitsu Cloud Functions can return `"drop"` to prevent an event from reaching that destination.

Marketing connection example:

```javascript
export default async function transform(event) {
  var consent = event.context?.consent?.categoryPreferences;

  if (!consent?.marketing) {
    return "drop";
  }

  return event;
}
```

Use an equivalent `statistics` check for statistics connections. Operational connections should allow only approved operational event names and strip all properties that are not required for that purpose.

Jitsu Functions apply to warehouse and Cloud Destinations, not Device Destinations. Do not rely on a Jitsu Function to protect a browser-executed Device Destination. Gate device scripts with Cookiebot before execution or leave them disconnected during the first migration.

### V2 implementation impact

Worker changes:

- Add `POST /consent` and its credentialed `OPTIONS` response.
- Parse and normalize Cookiebot state.
- Enforce event purposes and consent-specific property allowlists.
- Stop identity minting and enrichment when the applicable purpose is not allowed.
- Expire Worker-managed identity and attribution cookies on withdrawal.

ClickFunnels helper changes:

- Add a Cookiebot consent adapter.
- Delay or configure Jitsu according to Cookiebot state.
- Purpose-gate `page`, `track`, `identify`, and marketing measurements.
- Call `POST /consent` when consent is declined or withdrawn.

Jitsu Cloud changes:

- Attach tested consent-drop Functions to statistics and marketing connections.
- Keep Device Destinations disabled until their scripts are gated directly by Cookiebot.
- Separate operational form-submission flows from statistics and marketing connections.

### V2 validation checklist

- Jitsu `/p.js` is not requested before `CookiebotOnConsentReady` under the default no-pre-consent policy.
- Cookiebot's necessary, preferences, statistics, and marketing values appear in `context.consent.categoryPreferences`.
- Statistics events are blocked when statistics consent is false.
- Marketing events and advertising IDs are blocked when marketing consent is false.
- `identify` and group behavior follow the approved identifier policy rather than a generic accepted/declined flag.
- Missing or malformed Cookiebot consent is treated as no permission.
- Decline and withdrawal call `POST /consent` and expire the readable and HttpOnly identity cookies.
- Attribution cookies are removed when their approved purposes are withdrawn.
- Jitsu does not recreate an identity after withdrawal until an allowed consent state is established.
- Re-consent creates a new identity unless the approved policy says otherwise.
- Every statistics and marketing Jitsu connection has a tested consent-drop Function.
- Device Destinations cannot execute before their Cookiebot category is allowed.
- Explicit form fulfillment still works when analytics consent is denied, without routing the email to marketing destinations.

### V2 evidence

- [Jitsu Consent Management](https://jitsu.com/docs/sending-data/consent-management): CMP callbacks, `configure()`, `dontSend`, identifier suppression, IP policy, consent categories, and Jitsu's two pre-consent modes.
- [Jitsu Functions](https://jitsu.com/docs/functions): connection-level filtering and the `"drop"` return value that prevents an event from reaching a destination.
- [Jitsu Core Concepts](https://jitsu.com/docs/core-concepts): connections, destination types, and the limitation that Functions do not apply to Device Destinations.
- [Cookiebot Developer Resources](https://www.cookiebot.com/en/developer/): consent category properties, readiness/accept/decline events, `renew()`, `withdraw()`, automatic blocking, and server-side `CookieConsent` parsing.
- [Cookiebot consent-loading events](https://support.cookiebot.com/hc/en-us/articles/360020661139-How-to-find-out-when-the-Cookiebot-script-has-loaded): when Cookiebot's consent events fire and how to register listeners.

Current Jitsu source also shows that [`configure()` resets identifier storage when privacy disables sending or identifiers](https://github.com/jitsucom/jitsu/blob/aa2c987891131cad2664c25af2551d7daf4a9899/libs/jitsu-js/src/index.ts#L217-L228) and that [`consentCategories` are written to event context](https://github.com/jitsucom/jitsu/blob/aa2c987891131cad2664c25af2551d7daf4a9899/libs/jitsu-js/src/analytics-plugin.ts#L559-L570). The V2 Worker must still clear its separate HttpOnly mirror on withdrawal.

## Code impact

### Worker

Primary files:

```text
cloudflare-workers/reverse-proxy/src/index.ts
cloudflare-workers/reverse-proxy/test/index.spec.ts
cloudflare-workers/reverse-proxy/package.json
cloudflare-workers/reverse-proxy/wrangler.jsonc
```

Expected changes:

- Add Jitsu standard route dispatch and `/p.js` delivery.
- Replace the Segment forwarding call with Jitsu Cloud HTTP forwarding.
- Add the Jitsu identity cookie pair and migrate `ajs_anonymous_id`.
- Resolve matching `ajs_aid` and `an_aid` before local cookies.
- Add Jitsu configuration and secrets.
- Remove `@segment/edge-sdk` only after cutover validation.

Expected to remain behaviorally unchanged:

- Tenant and root-domain mapping.
- Origin validation and credentialed CORS.
- Attribution parsing, persistence, and merge rules.
- Advertising-cookie capture.
- `attr` event enrichment, deterministic IDs, and suppression.
- Event names and property semantics.
- Safe logging and controlled errors.

### ClickFunnels helper

Primary files:

```text
clickfunnels/src/config.js
clickfunnels/src/tracking-hosts.js
clickfunnels/src/segment-loader.js
clickfunnels/src/segment-user.js
clickfunnels/src/segment-track.js
clickfunnels/src/attr-tracking.js
clickfunnels/src/links.js
clickfunnels/src/index.js
```

Expected changes:

- Load the Jitsu SDK from the matching `sg.*` Worker.
- Replace Segment-specific global and `analytics.user()` access with the adapter.
- Point high-level `page`, `track`, `identify`, and `group` calls at Jitsu.
- Read the Worker-managed readable identity through the adapter.
- Emit matching `ajs_aid` and `an_aid` parameters on supported cross-root URLs and the `/p.js` request.

Expected to remain behaviorally unchanged:

- Form and order event triggers.
- Event names and business properties.
- Attribution refresh triggers.
- Cross-root link decoration.
- ActiveCampaign field hydration.
- Data-layer integration.
- R2 helper delivery.

File renames are optional cleanup, not a migration requirement.

## Validation checklist

### Identity and cookies

- A new visitor receives matching `__eventn_id` and `__eventn_id_srvr` values on `/p.js` without another identity request.
- `crypto.randomUUID()` is used only when no existing or transferable identity exists.
- An existing `ajs_anonymous_id` becomes the Jitsu ID without changing value.
- The HttpOnly value wins when the Jitsu cookies conflict.
- A deleted readable cookie is repaired from the HttpOnly mirror.
- Both cookies use the configured root domain, `/`, five-year max age, `Secure`, and `SameSite=Lax`.
- Matching `ajs_aid` and `an_aid` handoffs replace an existing destination identity.
- A legacy URL containing only `ajs_aid` still establishes the Jitsu identity.
- A Jitsu URL containing only `an_aid` still establishes the identity.
- Conflicting handoff values are rejected before Jitsu initialization and do not create split browser and Worker identities.
- The first page event contains the resolved identity.

### Preserved Worker behavior

- Every configured `sg.*` hostname maps to the correct tenant and cookie domain.
- Known origins receive credentialed CORS responses; unknown origins do not.
- Page URL, referrer, UTM values, click IDs, and supported advertising cookies match the current output.
- `_attr_current` and `_attr_current_js` retain their existing behavior.
- `attr` events retain deterministic event IDs and duplicate suppression.
- Form, order, identify, group, page, and custom event contracts remain stable.
- Visitor IP and user agent are not replaced with Worker egress values.

### Jitsu boundary

- Jitsu Live Events receives each supported event type through the Worker.
- Single-event and batch routes forward to the corresponding documented Jitsu endpoints.
- `X-Write-Key` is present upstream and absent from all browser-visible traffic.
- Jitsu authentication failures, rate limits, timeouts, and malformed responses produce controlled, redacted errors.
- Segment and Jitsu do not write duplicate production conversions during comparison.

### Browser flows

- First and return visits work in current Chrome and Safari.
- Cross-root links keep the anonymous identity.
- ActiveCampaign receives the expected anonymous ID.
- ClickFunnels forms and applicable checkout flows retain their existing events.
- Advertising IDs that appear after initial page load still trigger the existing refresh behavior.
- Ad blockers are tested against the Boom-owned `sg.*` hostnames.

## Cutover and rollback

1. Freeze regression fixtures for the current Segment output.
2. Add Jitsu forwarding and the Jitsu identity resolver behind the Worker.
3. Add matching `ajs_aid` and `an_aid` handoff behavior.
4. Add the Jitsu-backed browser adapter.
5. Send test traffic to isolated Jitsu destinations.
6. Compare event counts, identities, attribution, payloads, duplicates, and Safari return visits.
7. Cut the browser helper over to Jitsu through the Worker.
8. Keep the prior Worker and helper builds deployable during the monitoring window.
9. Remove Segment code, dependency, key, and runtime configuration only after acceptance.

Rollback consists of restoring the previous Worker deployment and browser helper, then confirming `/route/ajs/*` and `/route/evs/*` health. Do not delete the Segment implementation until that rollback window closes.

## Evidence

- [Jitsu JavaScript Reference](https://jitsu.com/docs/sending-data/js-reference): Analytics.js-compatible browser API, Jitsu cookie names, cookie-domain configuration, and `page`, `track`, `identify`, `group`, and `setAnonymousId` behavior.
- [Jitsu HTML snippet](https://jitsu.com/docs/sending-data/html): Jitsu Cloud script loading, initialization-only mode, onload sequencing, and the processing queue.
- [Jitsu HTTP API](https://jitsu.com/docs/sending-data/http): `X-Write-Key`, `/api/s/{event-type}`, supported event types, and Segment-compatible `/v1/batch` ingestion.
- [Jitsu ITP mitigation](https://jitsu.com/docs/sending-data/js-reference/itp): the readable and HttpOnly cookie pair, UUID identity, five-year max age, and Jitsu's same-domain/same-IP guidance.
- [Jitsu Cloud custom domains](https://jitsu.com/docs/features/custom-domains): Jitsu Cloud's direct CNAME topology. This confirms custom-domain support but is intentionally not the selected browser path because it bypasses the Worker.
- [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/): Worker Routes require a proxied hostname.
- [Cloudflare Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/): a Worker becomes the hostname's origin, and an existing CNAME conflicts with that setup.
- [WebKit CNAME Cloaking and Bounce Tracking Defense](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/): Safari's distinction between ordinary first-party subdomains and third-party CNAME-cloaked response cookies.

Repository evidence for the current uniqueness behavior is in the installed `@segment/edge-sdk`: it calls UUID v4 when no anonymous ID is supplied. The replacement's `crypto.randomUUID()` preserves that identity-generation model.

Current source evidence for `an_aid` is [Jitsu's pinned `analytics@0.8.9` dependency](https://github.com/jitsucom/jitsu/blob/aa2c987891131cad2664c25af2551d7daf4a9899/libs/jitsu-js/package.json#L57-L59), the dependency's [`an_aid` parsing and precedence](https://github.com/DavidWells/analytics/blob/analytics%400.8.9/packages/analytics-core/src/index.js#L162-L175), and its [anonymous-ID persistence](https://github.com/DavidWells/analytics/blob/analytics%400.8.9/packages/analytics-core/src/middleware/initialize.js#L14-L20). Because this behavior is source-backed rather than documented in Jitsu's public JavaScript reference, it requires an end-to-end contract test.
