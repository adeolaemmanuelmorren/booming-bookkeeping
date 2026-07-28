# Safari cookie fix + SSL watchdog — quick context

**Paste this into any Claude session to restore full context.**

## What we changed (2026-07-18)
Safari (ITP) was capping our tracking cookies (`__eventn_id` etc., set by the `sg.*` Cloudflare Worker) to **7 days**, because the apex (ClickFunnels' IPs) and `sg.*` (our Cloudflare zone's IPs) resolved to different infrastructure. Fix: flipped the apex DNS records for **thebookkeepingchallenge.com** and **keyboardrichchallenge.com** to **Cloudflare-proxied (orange cloud)**. Now apex and `sg.*` share the same Cloudflare IPs → Safari accepts the full ~5-year cookie lifetime. This works via Cloudflare **orange-to-orange (O2O)**: our zone in front of ClickFunnels' own Cloudflare-for-SaaS setup. ClickFunnels' docs say "DNS only," but that guidance predates O2O; sites, SSL, and split tests verified working proxied.

## The one residual risk we monitor
ClickFunnels' SSL cert for each hostname auto-renews (~90-day certs, renewal fires ~30 days before expiry, HTTP validation). The proxied config hadn't been through a renewal cycle yet — first cycle: **keyboardrichchallenge ~Aug 3, thebookkeepingchallenge ~Aug 16, 2026**. If renewal ever fails, there's ~3 weeks of warning before anything breaks.

## The watchdog
Daily cloud routine ("SSL renewal watchdog — ClickFunnels domains", 9am HST) checks both apexes + both `sg.*` hosts: site up, TLS valid, **days remaining on cert**. Sends a push notification ONLY if a site is down or a cert drops under **21 days** without renewing. Manage at claude.ai/code/routines.

## If it alerts
In Cloudflare DNS, flip the affected apex back to **DNS-only (grey cloud)** — site restores in ~1 minute and renewal completes via the old path. Then investigate before re-proxying.

## Still to do
`keyboardrich.com` and `boomingbookkeeping.com` are still grey-clouded (still have 7-day Safari cookies). When flipping them: zone SSL mode Full (strict), no HTML cache rules, Rocket Loader/minify off → flip → verify site + Safari cookie expiry (~5 years) → add them to the watchdog routine.
