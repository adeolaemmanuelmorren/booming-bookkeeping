# Jitsu and Cookiebot Consent Integration

Status: superseded on July 28, 2026.

The active implementation and rollout plan is
[COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md](../../COOKIEBOT_CROSS_DOMAIN_CONSENT_PLAN.md).

The earlier proposal in this file was retired because it incorrectly required
Jitsu events to wait for or be dropped by consent enforcement. The implemented
design keeps first-party warehouse collection running and attaches the consent
status known when each event reaches the Worker. GTM tag enforcement and
warehouse destination filtering are later rollout work, not Phases 1–3.
