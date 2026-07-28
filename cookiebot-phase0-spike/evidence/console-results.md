# Cookiebot Phase 0 console evidence

Tested July 23, 2026 (Hawaii time) through:

```text
https://dance-metadata-fisheries-reflects.trycloudflare.com
```

Cookiebot Domain Group:

```text
21bb6503-4138-4b7f-a6f8-137252c64eca
```

The isolated group used the CCPA/CPRA preset, displayed the banner, and
temporarily targeted all visitors so the Hawaii test location received the
California-style banner.

## Baseline

The normal banner rendered with:

```text
This website uses cookies
OK
Do not sell or share my personal information
```

## 0.1 and 0.2: suppressed default state

Plain event-time suppression:

```text
[spike] CookiebotOnDialogInit fired at 445 ms
```

The banner remained visible. `CookiebotOnConsentReady` did not fire.

CSS pre-hide plus `Cookiebot.hide()`:

```text
[spike] CookiebotOnDialogInit fired at 422 ms
[spike] current state: {
  "hasResponse": false,
  "method": null,
  "preferences": false,
  "statistics": false,
  "marketing": false
}
```

The banner was not visible, but `document.cookie` was empty and
`CookiebotOnConsentReady` did not fire.

## 0.3: submitCustomConsent before dialog render

First load:

```text
[spike] DialogInit — submitting custom opt-out
[spike] ConsentReady: {
  "hasResponse": true,
  "method": "explicit",
  "preferences": false,
  "statistics": false,
  "marketing": false
}
[spike] CookieConsent cookie present: true
```

Reload:

```text
[spike] ConsentReady: {
  "hasResponse": true,
  "method": "explicit",
  "preferences": false,
  "statistics": false,
  "marketing": false
}
[spike] CookieConsent cookie present: true
```

No banner appeared on either load.

The Cookiebot Analytics view still reported zero opt-ins and zero opt-outs
immediately after the test. Same-day consent-log confirmation remains pending.

## 0.4: Consent Mode under suppression

No consent update was pushed within 2.6 seconds. The banner remained visible
because event-time `Cookiebot.hide()` did not suppress it.

## 0.5: banner visibility

- Page B with event-time `Cookiebot.hide()`: banner remained visible.
- Page B with CSS pre-hide plus `Cookiebot.hide()`: banner was not visible.
- Page C with `submitCustomConsent(false, false, false)`: banner was not
  visible on the normal connection.
- Slow 3G and 4x CPU throttling were not available in the in-app test browser.
  This does not change the Page B failure because the banner remained visible
  without throttling.

## 0.6: GPC

The test set `navigator.globalPrivacyControl` to `true` before Cookiebot loaded.
The normal banner displayed:

```text
The GPC signal is honored
```

Under CSS suppression:

```text
[spike] navigator.globalPrivacyControl: true
[spike] DialogInit under emulated GPC
[spike] current state: {
  "hasResponse": false,
  "method": null,
  "preferences": false,
  "statistics": false,
  "marketing": false,
  "gpc": true
}
```

Cookiebot recognized GPC but did not create a consent response or local
CookieConsent cookie while the banner was suppressed.

## 0.8: transferred opt-in

After resetting the first-party cookie, page E applied the transferred opt-in:

```text
[spike] DialogInit — applying transferred opt-in
[spike] ConsentReady: {"hasResponse":true,"method":"explicit","preferences":true,"statistics":true,"marketing":true}
[spike] CookieConsent cookie present: true
```

No notice appeared. After reloading and then opening the normal baseline page,
the notice remained hidden.

Cookiebot Analytics still showed zero opt-ins for the new test domain
immediately after the test. The downloadable consent log for July 23, 2026
reported that no data was available. This may be a reporting delay, so the
server-side record remains pending rather than confirmed.
