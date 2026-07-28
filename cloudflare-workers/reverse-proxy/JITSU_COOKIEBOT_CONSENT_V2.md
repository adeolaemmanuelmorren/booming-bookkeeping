# Jitsu and Cookiebot consent integration (V2)

Status: deferred
Last reviewed: 2026-07-23

This is the deferred consent phase of the [Jitsu Cloud proxy migration](JITSU_CLOUD_PROXY_MIGRATION.md). Nothing in this document is required for the initial Segment-to-Jitsu cutover.

V1 preserves the current collection behavior while changing the vendor boundary. Cookiebot gating, consent-aware routing, opt-out cleanup, and consent-specific endpoints are a separate V2 implementation.

The governing consent model is defined in `COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md` at the repository root: **US opt-out with a GDPR-style category banner**. Visitors in configured US regions are opted in by default; optional categories are granted until the visitor opts out, changes categories, or sends a recognized GPC signal. That model, not a GDPR opt-in model, drives everything below: consent state exists for every visitor from the first pageview (the regional default), so there is no "waiting for consent" phase during which collection must pause.

## Integration decision

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

Jitsu places `consentCategories` on each event as `context.consent.categoryPreferences`. Jitsu documents two pre-consent modes: send nothing, or send limited events without identifiers. Neither pre-consent mode is this project's default posture, because under the US opt-out model there is no pre-consent phase: the regional default (opted in) applies from the first pageview, so Jitsu loads and sends normally unless the resolved state denies statistics.

The anonymous-ID cookies (`__eventn_id`, `__eventn_id_srvr`) are minted by the consent bootstrap and are classified as **Necessary**: they are the continuity key that locates a visitor's consent state, including an opt-out, across the four root domains. Minting them before a banner response is intentional and required — without them, an opt-out made on one domain could not be honored on the others. Their *analytics* use is what consent gates, not their existence.

Enforcement authority is split deliberately: the browser adapter below is a courtesy layer acting on locally known state, and the **Worker is the authoritative enforcement point** — it consults the central consent record on ingest and drops or redacts events even when the sending browser holds stale state.

## Recommended category policy

This table is the technical launch policy. Privacy counsel must approve the final purposes, retention, regional rules, and disclosures.

| Cookiebot state | Browser behavior | Worker behavior | Destination behavior |
|---|---|---|---|
| Default opt-in (US regional default, no response yet) | Load Jitsu and send normally | Mint identity; enforce categories on ingest | Statistics and marketing per the granted defaults |
| Necessary only / opted out | Keep Jitsu disabled (`dontSend`) | Keep the identity cookies solely as the Necessary consent-continuity key; drop all statistics and marketing events on ingest, including stale-state arrivals | No statistics or marketing forwarding |
| Statistics accepted | Enable approved page and product-analytics events | Permit anonymous identity; minimize IP according to policy | Permit statistics and restricted warehouse connections |
| Marketing accepted | Enable approved marketing measurements in addition to any other accepted categories | Permit approved ad-ID enrichment | Permit marketing connections only while `marketing=true` |
| Consent withdrawn | Disable Jitsu immediately and call `POST /consent` | Expire attribution cookies; retain the consent-continuity identity; drop non-necessary events on ingest | Drop future non-necessary events |

Cookiebot categories are independent. The adapter and Worker must evaluate each category rather than treating `Cookiebot.consented` as permission for every purpose.

## Browser adapter

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

## Loading order

The default launch sequence is:

1. Run the consent bootstrap defined in `COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md`: resolve the cross-root handoff identity, establish or repair the Worker cookie pair, and fetch the subject's shared consent state.
2. Register Cookiebot event listeners, then load Cookiebot; it applies the regional default or the transferred state.
3. Load Jitsu through the Worker. Under `default_opt_in` or granted statistics, Jitsu sends normally without waiting for a banner response. If the resolved state is `opted_out` or denies statistics, configure `dontSend` before any event is emitted.
4. Configure Jitsu with the Cookiebot category snapshot so every event carries `context.consent.categoryPreferences`.
5. Emit only the events allowed by those categories; the Worker enforces the same rules on ingest regardless.

Identity cookies exist from step 1 by design — they are the Necessary consent-continuity key, not an analytics grant. The exact serialization between the bootstrap network call, Cookiebot, and Jitsu (fully serial versus parallel with server-side enforcement) is decided in the cross-domain plan, not here.

## Worker enforcement

Browser gating is not sufficient. The Worker should enforce the same policy before forwarding:

1. Read the root-domain `CookieConsent` cookie when present. Cookiebot documents server-side parsing of this cookie for server-set cookies.
2. Accept a normalized consent snapshot from the browser for immediate consent changes.
3. Resolve discrepancies conservatively and never treat missing consent as permission.
4. Write the normalized booleans to `context.consent.categoryPreferences`.
5. Apply an event-purpose allowlist before enrichment and forwarding.
6. Do not collect advertising-cookie values unless `marketing=true`.
7. Consult the central consent record from the cross-domain plan as the source of truth on ingest; the browser's snapshot can be stale for a subject who opted out on another root moments earlier, and the Worker must drop those events regardless of what the browser believed.
8. Apply the configured IP policy before forwarding.

The Worker must not trust a caller-supplied label such as `purpose=necessary` by itself. Necessary operational events must be an explicit allowlist of event names and properties.

## Withdrawal and opt-out

Provide Cookiebot's Privacy Trigger or an equivalent visible control using `Cookiebot.renew()` so visitors can change their choices. Cookiebot also exposes `withdraw()` for withdrawing consent.

When consent is declined or withdrawn:

1. Call Jitsu `configure()` with `dontSend=true`, `disableUserIds=true`, `ipPolicy="remove"`, and the current category map.
2. Send one credentialed `POST /consent` control request to the Worker. This is the only additional request introduced by consent changes; it is not part of ordinary page initialization.
3. Expire the attribution cookies (`_attr_current`, `_attr_current_js`, `_attr_event_sig`); their marketing purpose is no longer allowed.
4. **Retain** `__eventn_id` and `__eventn_id_srvr`. After an opt-out they serve exactly one purpose: locating the shared opt-out record so it can be honored on every root, including through the existing cross-root URL handoff. Deleting them would erase the visitor's link to their own opt-out — on their next visit they would silently revert to the regional default, defeating the opt-out. They must not be used for analytics while the opt-out stands; the Worker's ingest enforcement guarantees that even if a stale browser sends events.
5. Stop advertising-ID extraction and non-necessary forwarding.
6. If an audit record is required, store a minimal no-identity consent-change record. Do not send it through a marketing destination.

If the visitor later grants consent again, the retained identity resumes; the consent-continuity key and the analytics identity are the same value with different allowed purposes, and the change of state is recorded as a new revision in the central record.

## Explicit form submissions and email

Cookie consent and a person's deliberate form submission are separate processing decisions. A submitted email may be required to deliver a requested lead magnet, appointment, account, or service, but that does not automatically authorize analytics profiling, advertising activation, or email marketing.

Recommended separation:

- Keep the submitted email in the system of record that fulfills the request, such as ClickFunnels, ActiveCampaign, or the application backend.
- Keep raw email out of ordinary Jitsu page and behavioral events unless there is a documented need and approved legal basis.
- If Jitsu must carry an operational submission event, use a separately classified event or Site, an explicit property allowlist, a restricted retention policy, and connections that exclude all marketing destinations.
- Record email-marketing permission separately from Cookiebot's `marketing` cookie category. Cookiebot marketing-cookie consent is not, by itself, proof of subscription to marketing email.
- Provide the applicable unsubscribe, consent-change, deletion, and data-subject request mechanisms outside the analytics SDK.

Not using collected information for marketing does not by itself make collection consent-free. Cookie storage, audience measurement, form fulfillment, CRM storage, and email marketing can have different legal bases and notice requirements.

## Jitsu destination enforcement

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

## V2 implementation impact

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

## V2 validation checklist

- Under the US default, Jitsu sends from the first pageview without waiting for a banner response; under a resolved `opted_out` or statistics-denied state, the browser emits nothing.
- The Worker drops statistics and marketing events for centrally opted-out subjects even when the sending browser holds stale granted state.
- Cookiebot's necessary, preferences, statistics, and marketing values appear in `context.consent.categoryPreferences`.
- Statistics events are blocked when statistics consent is false.
- Marketing events and advertising IDs are blocked when marketing consent is false.
- `identify` and group behavior follow the approved identifier policy rather than a generic accepted/declined flag.
- Missing or malformed Cookiebot consent is treated as no permission.
- Decline and withdrawal call `POST /consent`, expire the attribution cookies, and retain the identity cookies as the Necessary consent-continuity key.
- Attribution cookies are removed when their approved purposes are withdrawn.
- After an opt-out, the retained identity produces no statistics or marketing events on any root until the visitor changes their state.
- Every statistics and marketing Jitsu connection has a tested consent-drop Function.
- Device Destinations cannot execute before their Cookiebot category is allowed.
- Explicit form fulfillment still works when analytics consent is denied, without routing the email to marketing destinations.

## Evidence

- [Jitsu Consent Management](https://jitsu.com/docs/sending-data/consent-management): CMP callbacks, `configure()`, `dontSend`, identifier suppression, IP policy, consent categories, and Jitsu's two pre-consent modes.
- [Jitsu Functions](https://jitsu.com/docs/functions): connection-level filtering and the `"drop"` return value that prevents an event from reaching a destination.
- [Jitsu Core Concepts](https://jitsu.com/docs/core-concepts): connections, destination types, and the limitation that Functions do not apply to Device Destinations.
- [Cookiebot Developer Resources](https://www.cookiebot.com/en/developer/): consent category properties, readiness/accept/decline events, `renew()`, `withdraw()`, automatic blocking, and server-side `CookieConsent` parsing.
- [Cookiebot consent-loading events](https://support.cookiebot.com/hc/en-us/articles/360020661139-How-to-find-out-when-the-Cookiebot-script-has-loaded): when Cookiebot's consent events fire and how to register listeners.

Current Jitsu source also shows that [`configure()` resets identifier storage when privacy disables sending or identifiers](https://github.com/jitsucom/jitsu/blob/aa2c987891131cad2664c25af2551d7daf4a9899/libs/jitsu-js/src/index.ts#L217-L228) and that [`consentCategories` are written to event context](https://github.com/jitsucom/jitsu/blob/aa2c987891131cad2664c25af2551d7daf4a9899/libs/jitsu-js/src/analytics-plugin.ts#L559-L570). The V2 Worker must still clear its separate HttpOnly mirror on withdrawal.
