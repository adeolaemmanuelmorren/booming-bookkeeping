# Cookiebot Phase 0 test harness

These pages implement the experiments in
[`COOKIEBOT_PHASE0_SPIKE.md`](../COOKIEBOT_PHASE0_SPIKE.md).

They must use a disposable Cookiebot trial CBID. Do not use a production CBID.

## Configure

The current harness is configured with the isolated `Localhost Spike` Domain
Group CBID:

```text
21bb6503-4138-4b7f-a6f8-137252c64eca
```

Replace that value in the HTML files if the harness is reused with another
isolated Domain Group.

## Run

From this folder:

```bash
python3 -m http.server 8000
```

In a second terminal, expose the server through a Cloudflare Quick Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate
```

Add the generated `*.trycloudflare.com` hostname to the isolated Cookiebot
Domain Group as a regular domain. Keep both processes running, then open:

```text
https://<generated-hostname>.trycloudflare.com/baseline.html
```

Do not use a Cookiebot Domain Alias or Test Domain. Cookiebot disables consent
logging on those test-only domain types, which would invalidate tests 0.2 and
0.3.

Use a clean browser profile between tests. The complete test order, clean-state
requirements, pass criteria, and results table are in the parent spike document.

When a separate clean browser profile is not available, visit `reset.html`
between cases. It expires the first-party `CookieConsent` cookie on the active
test hostname and reports whether the reset succeeded.

`custom-consent-opt-in.html` applies an actively transferred opt-in on the
destination site. It is the companion test to the transferred opt-out page.
