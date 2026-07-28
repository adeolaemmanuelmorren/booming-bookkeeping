# Cookiebot Phase 0 Behavior Spike

## Purpose

The cross-domain consent plan (`COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md`) assumes Cookiebot behaves a specific way when its banner is suppressed before rendering. Cookiebot's developer documentation does not confirm or deny this behavior, so it must be verified before any Worker or bootstrap code is written.

This spike runs entirely on a local machine with static HTML pages and a Cookiebot trial account. No ClickFunnels page, production domain, or production CBID is used at any point.

Budget: roughly half a day. Deliverable: the results table at the bottom, filled in, with screenshots of the Cookiebot admin consent log for tests 0.2 and 0.3.

## What we are trying to learn

1. When the banner is prevented from rendering, does Cookiebot still write its `CookieConsent` cookie with the US opt-out defaults, so that reloads and later visits behave as if the banner had been shown?
2. Does `Cookiebot.submitCustomConsent()` work when called before the dialog has rendered, and does it produce a consent record in the admin?
3. Do Google Consent Mode signals update correctly in both cases?
4. Does any banner flash appear on slow connections before suppression takes effect?
5. Does a Global Privacy Control signal still apply when the banner never renders?
6. Does the Premium Small tier actually support one Domain Group with four root domains and one CBID?

## One-time setup

### 1. Cookiebot trial account

1. Create a trial at cookiebot.com (no production account, no production CBID).
2. Start the local server and Cloudflare Quick Tunnel described in the next
   section.
3. In the Cookiebot admin, add the generated `*.trycloudflare.com` hostname as
   the trial Domain Group's regular domain.
4. Configure the banner for the US opt-out model (the CCPA/CPRA template):
   optional categories granted by default, "Do Not Sell or Share" style notice.
5. Copy the trial CBID. Every test page below has a `YOUR-CBID-HERE`
   placeholder.

Do not register `localhost` as a regular domain; Cookiebot's current admin
rejects it. Do not use a Domain Alias or Test Domain for this spike either.
Cookiebot disables consent and analytics logging on those test-only domain
types, which would invalidate tests 0.2 and 0.3.

### 2. Local server

From the folder containing the test pages, start the static server:

```bash
python3 -m http.server 8000
```

In a second terminal, expose that server through a temporary Cloudflare Quick
Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate
```

Keep both processes running for the entire spike. Register the generated
`*.trycloudflare.com` hostname as the Cookiebot domain, then open pages at:

```text
https://<generated-hostname>.trycloudflare.com/<page>.html
```

A Quick Tunnel hostname changes when the tunnel is restarted. If that happens,
replace the registered Cookiebot domain before continuing.

### 3. Region

The US opt-out banner only appears for visitors Cookiebot geolocates to the configured US regions. If you are not physically in the US, run every test behind a US VPN, or the banner template under test will be the wrong one and every result is invalid. Confirm the correct template is active with test page A before doing anything else.

### 4. Clean state between tests

Every test must start from a clean profile. Between runs, either use a fresh
incognito/private window or clear cookies and site data for the active
`*.trycloudflare.com` hostname. Cookiebot stores its state in the
`CookieConsent` cookie — if it is still there from a previous run, the test is
meaningless.

## Test pages

Create these four files in one folder. Replace `YOUR-CBID-HERE` in all of them.

### Page A — `baseline.html` (control, run first)

Confirms the trial account, region, and banner template are correct before testing anything unusual.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>A: baseline</title>
  <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"
          data-cbid="YOUR-CBID-HERE" type="text/javascript" async></script>
</head>
<body>
  <h1>Baseline</h1>
  <p>The US opt-out banner should appear normally on this page.</p>
  <button onclick="console.log(JSON.stringify({
    hasResponse: Cookiebot.hasResponse,
    method: Cookiebot.consent.method,
    preferences: Cookiebot.consent.preferences,
    statistics: Cookiebot.consent.statistics,
    marketing: Cookiebot.consent.marketing,
    cookie: document.cookie
  }, null, 2))">Log consent state</button>
</body>
</html>
```

Expected: banner renders, it is the US opt-out template, and after it resolves the `CookieConsent` cookie exists. If the wrong template appears, fix region/VPN before continuing.

### Page B — `suppressed.html` (tests 0.1, 0.2, 0.5, 0.6)

The critical page. Registers the suppression handler before Cookiebot loads, exactly as the production bootstrap would.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>B: suppressed dialog</title>
  <script>
    // Must be registered BEFORE the Cookiebot script tag.
    window.addEventListener('CookiebotOnDialogInit', function () {
      console.log('[spike] CookiebotOnDialogInit fired at', performance.now().toFixed(0), 'ms');
      Cookiebot.hide();
    });
    window.addEventListener('CookiebotOnConsentReady', function () {
      console.log('[spike] CookiebotOnConsentReady at', performance.now().toFixed(0), 'ms');
      console.log('[spike] state:', JSON.stringify({
        hasResponse: Cookiebot.hasResponse,
        method: Cookiebot.consent.method,
        preferences: Cookiebot.consent.preferences,
        statistics: Cookiebot.consent.statistics,
        marketing: Cookiebot.consent.marketing
      }));
      console.log('[spike] CookieConsent cookie present:',
        document.cookie.indexOf('CookieConsent=') !== -1);
    });
  </script>
  <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"
          data-cbid="YOUR-CBID-HERE" type="text/javascript" async></script>
</head>
<body>
  <h1>Suppressed dialog</h1>
  <p>No banner should ever be visible on this page.</p>
  <button onclick="console.log(document.cookie)">Log cookies</button>
</body>
</html>
```

Variant to also try if plain `Cookiebot.hide()` shows a flash: add this CSS in `<head>` as a belt-and-suspenders pre-hide, then call `hide()` as well:

```html
<style id="spike-prehide">#CybotCookiebotDialog { display: none !important; }</style>
```

### Page C — `custom-consent.html` (test 0.3)

Applies a transferred opt-out programmatically before the dialog renders.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>C: submitCustomConsent pre-dialog</title>
  <script>
    window.addEventListener('CookiebotOnDialogInit', function () {
      console.log('[spike] DialogInit — submitting custom opt-out');
      Cookiebot.submitCustomConsent(false, false, false);
    });
    window.addEventListener('CookiebotOnConsentReady', function () {
      console.log('[spike] ConsentReady:', JSON.stringify({
        hasResponse: Cookiebot.hasResponse,
        method: Cookiebot.consent.method,
        preferences: Cookiebot.consent.preferences,
        statistics: Cookiebot.consent.statistics,
        marketing: Cookiebot.consent.marketing
      }));
      console.log('[spike] CookieConsent cookie present:',
        document.cookie.indexOf('CookieConsent=') !== -1);
    });
  </script>
  <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"
          data-cbid="YOUR-CBID-HERE" type="text/javascript" async></script>
</head>
<body>
  <h1>Custom consent before dialog</h1>
  <p>No banner should appear; all optional categories should be false.</p>
</body>
</html>
```

### Page D — `consent-mode.html` (test 0.4)

Same as page B but with a Google Consent Mode default stub, to watch what Cookiebot pushes into the dataLayer. No GTM container is needed.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>D: consent mode</title>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
      wait_for_update: 2000
    });
    // Log every consent update Cookiebot pushes.
    var origPush = dataLayer.push.bind(dataLayer);
    dataLayer.push = function () {
      var args = Array.prototype.slice.call(arguments);
      if (args[0] && (args[0][0] === 'consent' || (args[0].event || '').indexOf('cookie_consent') === 0)) {
        console.log('[spike] dataLayer:', JSON.stringify(args));
      }
      return origPush.apply(null, args);
    };
    window.addEventListener('CookiebotOnDialogInit', function () { Cookiebot.hide(); });
  </script>
  <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js"
          data-cbid="YOUR-CBID-HERE" data-consentmode="auto" type="text/javascript" async></script>
</head>
<body>
  <h1>Consent Mode under suppression</h1>
</body>
</html>
```

## Test procedure and pass criteria

Run in order. Record every result in the table at the bottom.

### 0.1 — Suppressed dialog still stores implied state (page B)

1. Clean profile. Open `suppressed.html`.
2. Confirm no banner appears at any point.
3. In the console, confirm `CookiebotOnConsentReady` fired and note the reported state.
4. Check `document.cookie` for `CookieConsent`.
5. Reload the page. Confirm no banner appears and `CookieConsentReady` reports the same state.
6. Close and reopen the browser (same profile, not incognito), open the page again. Same check.

**Pass:** `CookieConsent` cookie exists after step 4; optional categories reflect the US opt-out defaults (granted); reloads never show a banner. **Fail:** no cookie is written, or reloads show the banner, or categories are all false when the region default says granted.

### 0.2 — What method and records does suppression produce (page B)

1. Immediately after 0.1, note `Cookiebot.consent.method` (expected `implied`, but record whatever it says) and `Cookiebot.hasResponse`.
2. In the Cookiebot admin, open the consent log and check whether the suppressed visit created a consent record.
3. Screenshot both.

**Pass:** there is no pass/fail — this is documentation. Whatever the answers are, they go in the results table because the plan's compliance record-keeping section depends on them.

### 0.3 — submitCustomConsent before dialog render (page C)

1. Clean profile. Open `custom-consent.html`.
2. Confirm no banner appears, `CookiebotOnConsentReady` fires, and all three optional categories report `false`.
3. Confirm the `CookieConsent` cookie exists.
4. Reload: no banner, still all false.
5. Check the Cookiebot admin consent log for a record of this submission. Screenshot.

**Pass:** all of steps 2–4 hold. **Fail:** banner appears, categories are not all false, no cookie is written, or `ConsentReady` never fires.

### 0.4 — Consent Mode updates under suppression (page D)

1. Clean profile. Open `consent-mode.html`.
2. Watch the console for the consent update Cookiebot pushes after the default.

**Pass:** an update arrives within ~2 seconds granting the categories that match the US opt-out defaults. **Fail:** no update arrives (everything stays denied), or the update disagrees with `Cookiebot.consent.*`.

### 0.5 — No banner flash on a slow connection (pages B and C)

1. Clean profile. DevTools → Network → throttling `Slow 3G`, CPU throttle 4x.
2. Open `suppressed.html`. Watch the viewport the entire load. Repeat 3 times.
3. Repeat with `custom-consent.html`.

**Pass:** the banner is never visible, not even for a frame. **Fail:** any visible flash. If it fails, retry with the CSS pre-hide variant from page B and record whether that fixes it — the answer decides whether the production bootstrap needs to gate script injection instead of relying on event-time hiding.

### 0.6 — GPC signal under suppression (page B)

1. Use a GPC-capable browser: Firefox (`about:config` → `globalprivacycontrol.enabled` and `privacy.globalprivacycontrol.enabled` → `true`) or Brave (Shields → GPC on).
2. Clean profile. Open `suppressed.html`.
3. Record the resulting `Cookiebot.consent.*` state and the `CookieConsent` cookie.

**Pass:** the categories affected by GPC under the configured banner resolve to denied even though no banner rendered. **Fail:** GPC visitor still resolves to full default opt-in.

### 0.7 — Tier supports the topology (admin only, no code)

1. In the trial admin (or on a sales/support ticket), confirm: Premium Small supports Domain Groups; one group can contain the four production roots; one CBID and one banner configuration serve all four; note any monthly session or consent-record limits for the tier.

**Pass:** all confirmed in writing (admin UI screenshot or support reply). **Fail:** any of the four is unsupported at Premium Small — that changes the subscription decision in the plan.

### 0.8 — Apply a transferred opt-in (page E)

1. Clear the first-party `CookieConsent` cookie with `reset.html`.
2. Open `custom-consent-opt-in.html`.
3. Confirm all three optional categories are `true`, the method is `explicit`,
   and the `CookieConsent` cookie exists.
4. Reload, then open `baseline.html` on the same domain.
5. Confirm the notice remains hidden.
6. Check Cookiebot Analytics and the same-day consent log.

**Browser pass:** all optional categories remain granted after reload and the
notice does not return. **Reporting pass:** the opt-in appears in Cookiebot's
analytics or downloadable consent log.

## Results

| # | Test | Result (pass/fail) | Observed values | Notes |
| --- | --- | --- | --- | --- |
| 0.1 | Suppressed dialog stores state | fail | cookie present: no / categories: all false, unresolved | plain `hide()` left banner visible; CSS hid it but `ConsentReady` never fired |
| 0.2 | Method + admin record under suppression | n/a | method: null / hasResponse: false / admin record: none expected because no response was submitted | [console evidence](cookiebot-phase0-spike/evidence/console-results.md) |
| 0.3 | submitCustomConsent pre-dialog | partial: browser pass; same-day admin log pending | cookie present: yes / categories: all false / method: explicit / admin analytics: 0 immediately after test | [page screenshot](cookiebot-phase0-spike/evidence/0.3-custom-consent-no-banner.png), [admin screenshot](cookiebot-phase0-spike/evidence/0.2-0.3-admin-analytics-immediate.png) |
| 0.4 | Consent Mode update arrives | fail | update payload: none within 2.6 seconds | banner remained visible; consent never became ready |
| 0.5 | No flash on Slow 3G | fail for B; slow-throttle C pending | flash seen: B: banner remained visible / C: none on normal connection / with CSS pre-hide: none | event-time suppression is not viable |
| 0.6 | GPC applies when suppressed | fail as specified | GPC recognized; hasResponse: false / method: null / no local cookie | [GPC screenshot](cookiebot-phase0-spike/evidence/0.6-gpc-recognized-banner.png) |
| 0.7 | Premium Small supports topology | pass (topology; tier remains scan-dependent) | four domains can share one Domain Group, CBID, and banner configuration; Small requires 4+ domains and fewer than 350 subpages per domain | no traffic limit; consent records retained up to 12 months |
| 0.8 | Apply transferred opt-in | partial: browser pass; same-day admin log pending | cookie present: yes / preferences, statistics, marketing: true / method: explicit / no banner after reload | admin analytics stayed at 0 and same-day consent log said no data immediately after the test; [console evidence](cookiebot-phase0-spike/evidence/console-results.md) |

### Phase 0 execution evidence

- [Baseline CCPA/CPRA banner](cookiebot-phase0-spike/evidence/0.0-baseline-ccpa-banner-viewport.png)
- [Event-time suppression failure](cookiebot-phase0-spike/evidence/0.1-suppressed-banner-visible.png)
- [Custom opt-out with no banner](cookiebot-phase0-spike/evidence/0.3-custom-consent-no-banner.png)
- [Immediate Cookiebot Analytics view](cookiebot-phase0-spike/evidence/0.2-0.3-admin-analytics-immediate.png)
- [GPC recognized by the normal banner](cookiebot-phase0-spike/evidence/0.6-gpc-recognized-banner.png)
- [Console results](cookiebot-phase0-spike/evidence/console-results.md)

### 0.7 evidence

Verified against Cookiebot's official materials on July 23, 2026:

- A Premium Domain Group can contain multiple domains. Every domain in that
  group shares its CBID and banner configuration:
  <https://support.cookiebot.com/hc/en-us/articles/360003725253-What-are-Domain-Groups-and-how-should-I-use-them>
- Premium Small is currently $16 per domain per month, requires an account with
  at least four domains, and supports fewer than 350 scanned subpages per
  domain. Cookiebot reports no traffic limit. Consent record keeping is
  available for up to 12 months:
  <https://www.cookiebot.com/us/pricing/>
- The assigned tier is determined automatically from each domain's scan. If a
  production root reaches 350 scanned subpages, that domain will move to a
  higher tier:
  <https://support.cookiebot.com/hc/en-us/articles/360004162973-What-is-my-subscription-plan>
- The signed-in production account also confirms the four production roots are
  currently in one Premium Domain Group. The July 23, 2026 admin view reports
  12 scanned pages for `boomingbookkeeping.com` and 11 each for the other three
  roots:
  [`cookiebot-phase0-spike/evidence/0.7-production-domain-group.png`](cookiebot-phase0-spike/evidence/0.7-production-domain-group.png)

## If a test fails

- **0.1 fails:** the destination cannot rely on Cookiebot's implicit regional default while suppressed. The alternative is applying the transferred default via `submitCustomConsent()`, but the plan currently forbids recording a fabricated explicit acceptance — that conflict must be decided (accept `submitCustomConsent` with the method documented, or keep a short non-blocking notice on destinations) before Phase 2 of the plan starts.
- **0.3 fails:** transferred explicit opt-outs need a different application path (for example `Cookiebot.withdraw()` after ready), which needs its own mini-spike.
- **0.5 fails even with CSS pre-hide:** the production bootstrap must delay Cookiebot script injection until after the suppression decision instead of hiding at event time.
- **0.7 fails:** revisit the CMP tier or vendor decision in the plan before any build work.
- **0.8 browser test fails:** do not build opt-in transfer with
  `submitCustomConsent()`.
- **0.8 reporting remains empty:** keep the Cookiebot test domain until the
  next-day log check. If the record never appears, the cross-domain service
  must keep its own audit record of the person's original choice.
