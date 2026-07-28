# Cookiebot Phase 0 Spike Results

## Purpose

This document is the plain-language handoff from the Cookiebot Phase 0 test.
Read it before implementing the cross-domain consent plan.

The detailed test procedure and raw results remain in
[`COOKIEBOT_PHASE0_SPIKE.md`](COOKIEBOT_PHASE0_SPIKE.md).

## Bottom line

Cookiebot can silently initialize a destination site with a real choice the
visitor already made.

- A transferred opt-in can be applied before the notice appears.
- A transferred opt-out can be applied before the notice appears.
- Cookiebot saves the transferred choice in its normal first-party cookie.
- The notice stays hidden after the choice is applied.
- The saved choice survives a reload.

Cookiebot cannot silently create its ordinary US default state for someone who
saw the notice but did not respond.

Therefore:

- **No choice made:** show the notice on each new root domain.
- **Opted in:** transfer and apply that exact choice; do not show the notice
  again.
- **Opted out:** transfer and apply that exact choice; do not show the notice
  again.
- **Never turn an unanswered notice into an acceptance.**

An opt-in expires after 12 months and requires a fresh choice. An opt-out does
not automatically expire or become an opt-in. Keep honoring it until the person
explicitly changes the choice, for as long as the person can be recognized.

## Important scope clarification

The spike confirmed Cookiebot's behavior on the receiving page. It did not
build the complete system that retrieves a choice made on one Boom domain and
delivers it to another Boom domain.

The Worker, shared record, and cross-domain handoff still need to be built and
tested end to end.

## Results

| Test | Result | What happened |
| --- | --- | --- |
| Normal US notice | Pass | The CCPA/CPRA notice appeared with the expected opt-out language. |
| Hide an unanswered notice during initialization | Fail | Calling `Cookiebot.hide()` did not prevent the notice from remaining visible. |
| Visually hide an unanswered notice with CSS | Fail | The notice disappeared visually, but Cookiebot created no response and saved no consent cookie. |
| Apply transferred opt-out | Browser pass | Cookiebot saved an explicit response with preferences, statistics, and marketing denied. No notice appeared. |
| Apply transferred opt-in | Browser pass | Cookiebot saved an explicit response with preferences, statistics, and marketing allowed. No notice appeared. |
| Reload after transferred choice | Pass | The first-party Cookiebot state remained and the notice did not return. |
| Consent Mode under unanswered-notice suppression | Fail | No usable consent update arrived because Cookiebot never resolved a response. |
| GPC with an unanswered hidden notice | Fail | Cookiebot recognized GPC but did not create a response or local consent cookie. |
| Four domains in one Cookiebot Domain Group | Pass | One Domain Group, CBID, and banner configuration can cover all four production roots. |
| Cookiebot administrative reporting | Pending | Analytics remained at zero and the same-day consent log reported no data immediately after the imported-choice tests. |

## Required changes to the original plan

### 1. Do not suppress an unanswered notice

Remove the assumption that Cookiebot will silently store its US regional
default when the notice is hidden.

If the visitor has not made a choice, load Cookiebot normally and show the
notice. If that visitor reaches another root domain without responding, show
the notice there as well.

### 2. Only import real choices

Use `Cookiebot.submitCustomConsent()` only when the shared record represents an
actual visitor choice:

```text
Opt-in:
preferences = true
statistics  = true
marketing   = true

Opt-out:
preferences = false
statistics  = false
marketing   = false
```

Do not call `submitCustomConsent(true, true, true)` merely because a visitor saw
the US notice and did nothing.

### 3. Resolve shared state before loading Cookiebot

Do not load Cookiebot and then try to hide its notice during
`CookiebotOnDialogInit`.

The destination must first determine whether it has:

1. A valid local Cookiebot choice.
2. A valid transferred explicit choice.
3. No choice.

Then it should load Cookiebot using the appropriate path.

### 4. GPC must override a transferred acceptance

Check Global Privacy Control before applying a saved opt-in. An active,
applicable GPC signal must keep the affected sale, sharing, advertising, or
marketing purposes denied.

### 5. Keep the shared choice as the record

Cookiebot's browser state worked, but its administrative reporting did not show
the imported choices immediately.

The Boom service already needs a shared record in order to move the choice
between domains. That same record should contain:

- The choice and category values.
- When and where the original choice was made.
- The policy version.
- When each destination domain applied the choice.

Cookiebot's own report is useful supplementary evidence, but the cross-domain
feature must not depend on that report updating immediately.

## Decisions and confirmed infrastructure

| Decision | Result |
| --- | --- |
| Canonical production domains | Use the apex forms of all four roots. |
| Opt-in lifetime | 12 months. |
| Opt-out lifetime | Do not expire into an opt-in. Continue honoring the opt-out until the person explicitly changes it. |
| Initial repository policy version | Use `v1`. This value is stored with the shared choice so the code knows which version produced it. Changing it is a deliberate application configuration change. The business decides outside this repository when a new version is required. |
| Cookiebot native cross-domain sharing | Disabled. Use the first-party Boom service as the source of truth. |

### `www` hostname check

Verified on July 23, 2026:

- `www.thebookkeepingchallenge.com` redirects to
  `thebookkeepingchallenge.com`.
- `www.keyboardrichchallenge.com` redirects to
  `keyboardrichchallenge.com`.
- `www.boomingbookkeeping.com` redirects to `boomingbookkeeping.com`.
- `www.keyboardrich.com` does **not** redirect. It currently returns Cloudflare
  Error 1014, “CNAME Cross-User Banned.”
- The apex `keyboardrich.com` site works and redirects to its active funnel
  page.

Fix `www.keyboardrich.com` before rollout so it redirects to
`keyboardrich.com`.

## Required end-to-end test before rollout

After the Worker and browser bootstrap exist, test two separate real test
domains through the complete handoff:

1. Visitor does nothing on site A, moves to site B, and sees the notice again.
2. Visitor opts in on site A, moves to site B, keeps the granted categories,
   and sees no notice.
3. Visitor opts out on site A, moves to site B, keeps the denied categories,
   and sees no notice.
4. Visitor accepts on site A but has active GPC on site B; the applicable
   purposes remain denied.
5. Reload site B and confirm its local Cookiebot state remains correct.
6. Confirm GTM and all optional tags agree with the applied choice.
7. Confirm the central audit record captures the original choice and the
   destination application.

## Current production status

Nothing from this spike was deployed to the four production websites.

The tests used an isolated Cookiebot Domain Group and temporary Cloudflare
tunnels. The temporary public test server and tunnel were shut down after the
tests.
