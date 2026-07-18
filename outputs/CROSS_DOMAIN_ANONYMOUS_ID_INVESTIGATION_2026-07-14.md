# Cross-domain anonymous-ID investigation

Investigation date: 2026-07-14 HST / 2026-07-15 UTC  
BigQuery project: `able-folio-499722`  
Dataset/table: `boom_domains.pages`  
Target period: 2026-07-01 through the latest target event at 2026-07-14 22:14:04 UTC  
Code changes: none

## Executive finding

The IP + exact user-agent sequence is a useful candidate generator, but the raw changed-transition count is not a duplicate-identity count and is not proof of a direct page-to-page navigation.

At the current data watermark, the three groups contain 615 candidate transitions: 31 with the same ID and 584 with a changed ID. Of the 584 changed rows, only 218 distinct destination IDs were first seen at the candidate transition. The other 366 rows reused a destination ID that already existed, so they are repeat crossings, tab/order effects, or previously split identities rather than new duplicates.

The strongest actionable finding is ActiveCampaign:

- 121 changed rows had `vgo_ee` but no `ajs_aid`.
- Those rows created 44 distinct new destination identities.
- `vgo_ee` is direct evidence of an ActiveCampaign redirect, so this is not merely an IP/user-agent inference.

The cross-domain helper and destination-side handling work when `ajs_aid` is present:

- 23 target rows carried `ajs_aid`.
- In all 23, `ajs_aid` equaled the destination `anonymous_id`.
- Eighteen of the 20 `keyboardrich.com -> keyboardrichchallenge.com` rows with `ajs_aid` also matched the immediately preceding source ID. The remaining five changed-ID rows across all groups carried the destination's already-established ID, showing that the LAG source event was not the handoff that supplied the parameter.

Do not report 584 duplicate identities. The defensible accounting is:

| Bucket | Distinct new destination IDs | Interpretation |
|---|---:|---|
| Confirmed ActiveCampaign break | 44 | Actionable now |
| Referrerless/no-`ajs_aid` or other non-external query | 148 | Plausible discontinuities; navigation mechanism unresolved |
| External, Jotform, or destination-root evidence | 26 | False association or external-flow work, not an anchor-helper defect |
| Absolute sequence-based upper bound | 218 | All new IDs at candidate transitions |

The best evidence-backed statement is therefore **44 confirmed duplicate identities, 148 additional unresolved candidates, and a hard upper bound of 218** for these three July MTD groups.

## Reproduced cohorts

The earlier snapshot has drifted slightly as July data continued to arrive. The first and third changed counts increased by two and one respectively; the reverse group is unchanged.

| Source -> destination | Same ID | Changed ID | Current total | Earlier changed count |
|---|---:|---:|---:|---:|
| `keyboardrichchallenge.com -> keyboardrich.com` | 11 | 240 | 251 | 238 |
| `keyboardrich.com -> keyboardrichchallenge.com` | 20 | 201 | 221 | 201 |
| `boomingbookkeeping.com -> keyboardrichchallenge.com` | 0 | 143 | 143 | 142 |

Sequence definition used for reproduction:

1. Supported-domain page events only.
2. Partition by exact `context_ip, context_user_agent`.
3. Order by `timestamp, received_at, id` for deterministic ties.
4. Select a different-root LAG event with a 0–120 second event-time gap.

Only 1–3 events per group shared the same event second, and no target transition was reversed by `received_at`, so timestamp ordering is not driving the result.

Exact reproduction query: `cross_domain_transition_reproduction.sql`.

## Heuristic quality

Evidence that the cohorts are not dominated by bots or bulk NAT collisions:

| Metric | KRC -> KR | KR -> KRC | BB -> KRC |
|---|---:|---:|---:|
| One target transition for the IP/UA key | 171 / 251 | 129 / 221 | 97 / 143 |
| Exactly one source and one destination ID for the key | 180 / 251 | 150 / 221 | 109 / 143 |
| Key had more than five July anonymous IDs | 10 / 251 | 11 / 221 | 25 / 143 |
| Obvious bot/headless/crawler UA | 0 | 0 | 0 |
| Median July page events per key | 7 | 6 | 7 |
| Median July IDs per key | 2 | 2 | 2 |
| Median gap | 18 s | 32 s | 42 s |
| P90 gap | 76 s | 97 s | 95 s |

The user agents are normal consumer Chrome, Safari, Edge, Samsung Internet, and iOS Chrome strings. The dominant exact strings are generic current-browser UAs, so IP/UA still cannot uniquely identify a person on carrier NAT, shared Wi-Fi, or devices with identical browser versions.

The most important limitation is navigation attribution:

- No target row had a source-root referrer.
- Empty referrers were 194 / 251, 203 / 221, and 128 / 143 by group.
- The live HTTP response exposed `Referrer-Policy: same-origin`, which suppresses the referrer on a genuine cross-origin anchor click. Therefore, an empty referrer neither proves nor disproves navigation.
- Thirty-two KRC -> KR rows had a Jotform referrer. At least those rows did not move directly from the LAG source page to the destination.
- Other search/social/external referrers account for additional false associations.

Conclusion: the heuristic is credible for recognizing same-device activity at the aggregate level, but it must not be used alone to name the source control or count duplicates.

Exact validation queries: `cross_domain_heuristic_validation.sql`, `cross_domain_evidence_classes.sql`, and `cross_domain_user_agent_time.sql`.

## Query parameters and redirect evidence

| Source -> destination | No query | `vgo_ee` without `ajs_aid` | Any `ajs_aid` | Other |
|---|---:|---:|---:|---:|
| KRC -> KR | 226 | 15 | 1 | 9 |
| KR -> KRC | 134 | 56 | 20 | 11 |
| BB -> KRC | 84 | 50 | 2 | 7 |

Other observed parameters included `fbclid`, `gclid`, `wbraid`, `el`, `he`, ClickFunnels preview/debug parameters, declined-payment errors, and Cloudflare challenge tokens.

ActiveCampaign-specific identity result:

| Source -> destination | Changed rows with `vgo_ee`, no `ajs_aid` | Distinct destination IDs | Distinct new destination IDs |
|---|---:|---:|---:|
| KRC -> KR | 15 | 15 | 14 |
| KR -> KRC | 56 | 54 | 11 |
| BB -> KRC | 50 | 49 | 19 |
| **Total** | **121** | — | **44** |

These are genuine broken handoffs at the redirect layer: the ActiveCampaign redirect token arrived, but the Segment handoff parameter did not.

Exact queries: `cross_domain_query_parameters.sql`, `cross_domain_activecampaign_redirects.sql`, and `cross_domain_activecampaign_identity_summary.sql`.

## Highest-volume route pairs

| Source path -> destination path | Group | Changed rows | New destination IDs | Median gap | Evidence |
|---|---|---:|---:|---:|---|
| `/replay-1 -> /more-1` | KRC -> KR | 34 | 24 | 14 s | Empty referrer/query; live source currently has no such link |
| `/breakout-1 -> /replay-1` | KR -> KRC | 25 | 3 | 64 s | 12 rows have `vgo_ee` without `ajs_aid`; many reuse an existing destination ID |
| `/info-1 -> /replay-1` | BB -> KRC | 24 | 9 among the 22 empty-referrer rows | 38 s | Five rows have `vgo_ee`; live `/info-1` has no replay link |
| `/more-1 -> /challengereplay-1` | KR -> KRC | 23 | 1 among the 22 empty-referrer rows | 33 s | Thirteen rows have `vgo_ee`; mostly reuse an existing destination ID |
| `/krc-2 -> /more-1` | KRC -> KR | 23 | 22 | 13 s | Empty referrer/query; live KRC page currently has AC forms but no `/more-1` link |
| `/more-1 -> /replay-1` | KR -> KRC | 22 | 2 | 19 s | Six rows have `vgo_ee`; mostly reuse an existing destination ID |
| `/challengereplay-1 -> /more-1` | KRC -> KR | 21 | 15 | 28 s | Empty referrer/query; live replay page currently has no such link |

The route matrix is strongly patterned, so the sequence is not random noise. However, live content on replay/challenge pages is schedule-dependent, and the currently rendered versions do not expose the historical cross-domain controls. A route pair alone is insufficient to label an anchor as broken.

Exact route queries: `cross_domain_route_diagnostics.sql` and `cross_domain_new_identity_routes.sql`.

## Volume over time

Changed transitions by UTC date:

| UTC date | KRC -> KR | KR -> KRC | BB -> KRC |
|---|---:|---:|---:|
| Jul 1 | 27 | 13 | 6 |
| Jul 2 | 29 | 36 | 9 |
| Jul 3 | 31 | 18 | 7 |
| Jul 4 | 4 | 8 | 11 |
| Jul 5 | 3 | 4 | 15 |
| Jul 6 | 14 | 18 | 14 |
| Jul 7 | 4 | 7 | 13 |
| Jul 8 | 34 | 15 | 6 |
| Jul 9 | 41 | 39 | 6 |
| Jul 10 | 26 | 15 | 6 |
| Jul 11 | 8 | 5 | 9 |
| Jul 12 | 5 | 4 | 13 |
| Jul 13 | 10 | 12 | 19 |
| Jul 14 partial | 4 | 7 | 9 |

The two challenge/Keyboard Rich directions spike on Jul 1–3 and Jul 8–10, consistent with scheduled challenge traffic rather than automation. BB -> KRC is more evenly distributed.

Gap buckets for changed rows:

| Gap | KRC -> KR | KR -> KRC | BB -> KRC |
|---|---:|---:|---:|
| 0–2 s | 15 | 19 | 7 |
| 3–5 s | 30 | 14 | 5 |
| 6–10 s | 35 | 13 | 10 |
| 11–30 s | 78 | 51 | 37 |
| 31–60 s | 45 | 52 | 37 |
| 61–120 s | 37 | 52 | 47 |

The long tail makes the 120-second heuristic useful for discovery but too permissive for direct-navigation attribution.

## Live browser inspection

### Tracking bundle

The first-party Segment loader and ClickFunnels helper were present on every representative page inspected:

- `keyboardrichchallenge.com/replay-1`: `https://sg.keyboardrichchallenge.com/route/ajs/...` and `https://assets.keyboardrichchallenge.com/cf-sh-seg`.
- `keyboardrich.com/more-1`: `https://sg.keyboardrich.com/route/ajs/...` and `https://assets.keyboardrich.com/cf-sh-seg`.
- `boomingbookkeeping.com/info-1`: `https://sg.boomingbookkeeping.com/route/ajs/...` and `https://assets.boomingbookkeeping.com/cf-sh-seg`.
- `keyboardrich.com/calculator-1`: `https://sg.keyboardrich.com/route/ajs/...` and `https://assets.keyboardrich.com/cf-sh-seg`.

Challenge pages currently include the helper twice and logged `Segment snippet included twice.` This did not prevent observed decoration/hydration, but the duplicate inclusion should be removed to reduce race risk and ambiguity.

### Ordinary anchors work

On `boomingbookkeeping.com/info-1`, six ordinary anchors to `https://keyboardrich.com/yes` were decorated in the DOM with the current `ajs_aid`.

On `keyboardrich.com/calculator-1`, the ordinary “Join The FREE 5-Day Keyboard Rich Challenge” anchor was decorated with `ajs_aid`. Following the decorated URL reached `keyboardrichchallenge.com/krc-1` with the parameter intact. The destination's ActiveCampaign `field[39]` contained the exact same ID.

This verifies:

1. The source bundle executes.
2. Supported ordinary anchors receive `ajs_aid`.
3. The destination route preserves the parameter.
4. Destination-side Segment/form hydration consumes the same ID.

Historical BigQuery provides the broader confirmation: all 23 `ajs_aid` target rows used that value as the destination `anonymous_id`.

### Forms and redirects

`keyboardrichchallenge.com/krc-2` currently renders an ActiveCampaign form posting to `https://boomingbookkeeping.activehosted.com/proc.php`. Its `field[39]` was populated with the current anonymous ID, so source-side hydration is working. The server-side ActiveCampaign redirect configuration is the remaining failure point on affected forms: 121 observed redirects carried `vgo_ee` but omitted `ajs_aid`.

`keyboardrich.com/breakout-1` currently posts its ClickFunnels form to the same-domain `/breakout-2`; it does not expose a live direct link to KRC `/replay-1`.

`keyboardrichchallenge.com/replay-1`, `keyboardrichchallenge.com/challengereplay-1`, `keyboardrichchallenge.com/krc-2`, and `keyboardrich.com/more-1` did not currently render the high-volume historical cross-domain links. Those pairs may reflect scheduled/dynamic content, email opens, ActiveCampaign redirects, Jotform returns, or separate tabs.

Thirty-two KRC -> KR rows had `submit.jotform.com` as the destination referrer. Only two distinct destination IDs were first seen in that class. These are not ordinary-anchor helper failures; any fix requires a Jotform hidden-field/redirect handoff and should be scoped separately.

## Route classification

### Confirmed working

- Any observed route carrying `ajs_aid`: destination consumption succeeded 23 / 23.
- Live ordinary supported anchors on `/info-1` and `/calculator-1`.
- The challenge root-to-`/krc-1` route preserved `ajs_aid`.
- ActiveCampaign hidden `field[39]` hydration on live KRC forms.

### Confirmed broken

- ActiveCampaign cross-root redirect destinations with `vgo_ee` and no `ajs_aid`: 121 rows, 44 confirmed new duplicate identities.
- Highest-volume affected destination patterns include `/challengereplay-1`, `/replay-1`, `/more-1`, `/krc-1`, `/breakoutreplay-1`, `/upgrade-1`, and `/vipupgrade-1`. The LAG source path is a lead for locating the form, not proof of the exact form that submitted.

### Expected, external, or non-actionable for the anchor helper

- Jotform returns: 32 rows, two new destination IDs.
- Other external referrers such as Google, Facebook, Gmail Android, Bing, Yahoo, ClickFunnels preview, and Tag Assistant: 41 rows, 22 new IDs. These disprove the inferred direct source-page navigation.
- Destination-root referrers: ten rows, two new IDs; these are internal destination navigations preceded by unrelated supported-domain activity.
- Repeat rows where the destination ID predates the transition: 366 changed rows; do not count them again as newly caused duplicates.

### Unresolved

- Empty referrer/query: 365 changed rows, 143 new destination IDs.
- Other non-external query without `ajs_aid`: ten changed rows, five new destination IDs.

These 148 new IDs are plausible identity discontinuities but cannot be attributed to an anchor, form, JavaScript navigation, or email from the available page-event fields. The live pages currently do not expose the corresponding historical controls.

## Recommended next actions

1. **Fix ActiveCampaign redirect templates first.** For every affected cross-root AC form, make the redirect include `ajs_aid=%SEGMENT_ANON_ID%` (using the real AC personalization tag) and retain `field[39]`. Test each destination family listed above. This addresses 44 confirmed July MTD duplicates.
2. **Inventory AC form IDs and redirect URLs.** Add form ID / redirect-template metadata to the audit. The current page table cannot name the submitting form, and LAG source paths are not reliable enough for configuration edits.
3. **Add navigation telemetry before expanding the helper.** Emit a small first-party event immediately before supported-domain navigation with source URL, destination URL, mechanism (`anchor`, `form`, `location.assign`, `location.replace`), and anonymous ID. On the destination, log whether `ajs_aid` was present and accepted. This removes dependence on IP/UA sequencing.
4. **Handle Jotform separately only if economically justified.** Pass the anonymous ID into a Jotform hidden field and template it into the return URL. The July impact is two new IDs in the target groups, so this is lower priority than AC.
5. **Remove duplicate helper inclusion on challenge pages.** Keep one `cf-sh-seg` include per page/funnel scope and verify the duplicate Segment warning disappears.
6. **Do not rewrite ordinary-anchor logic based on this report.** Live anchor decoration works, and historical `ajs_aid` consumption is 23 / 23.
7. **Re-run using a stricter outcome query.** Report distinct destination IDs first seen at a transition, split by `ajs_aid`, `vgo_ee`, referrer class, and route. Do not report raw changed rows as duplicate identities.

## Exact query index

- `cross_domain_transition_reproduction.sql` — cohort reproduction.
- `cross_domain_transition_breakdowns.sql` — routes, referrers, gaps, dates, query shapes, and exact UAs.
- `cross_domain_route_diagnostics.sql` — route-pair counts and medians.
- `cross_domain_heuristic_validation.sql` — key reuse, automation, ordering, first-seen IDs, and totals.
- `cross_domain_user_agent_time.sql` — exact UA and local-hour volume.
- `cross_domain_query_parameters.sql` — exact destination parameter-name sets.
- `cross_domain_new_identity_routes.sql` — route-level new-ID estimates.
- `cross_domain_activecampaign_redirects.sql` — `vgo_ee` without `ajs_aid` route matrix.
- `cross_domain_activecampaign_identity_summary.sql` — AC duplicate estimate.
- `cross_domain_evidence_classes.sql` — mutually exclusive confirmed/ambiguous/external accounting.
- `cross_domain_live_handoff_verification.sql` — delayed-ingestion lookup for the live browser handoff.

All SQL is read-only. No production or repository code was changed.
