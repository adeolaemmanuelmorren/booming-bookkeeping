# Termly + GTM Consent Plan

## Current Read

The container already has a `Termly` tag. It is firing on GTM Consent Initialization, which is the correct trigger class for the consent manager.

The main thing still needed is consent gating on the actual tags. In GTM terms, that means setting `Additional consent checks` on non-Google tags and deciding where `Termly.consentSaveDone` fallback triggers are needed.

## Recommended Approach

1. Keep the Termly tag on `Consent Initialization - All Pages`.
   - This is where the CMP should establish or update consent state.
   - Normal tracking, base pixels, and conversion tags should not be moved to Consent Initialization.

2. Add or confirm a Termly preference-update trigger.
   - Event: `userPrefUpdate`
   - Use this if Termly requires the tag to update GTM consent state when users change preferences.

3. Add a consent-save trigger for fallback firing.
   - Event: `Termly.consentSaveDone`
   - This is useful because a page-level event such as `funnel_step_ready` can happen before consent is granted. If GTM blocks the tag at that point, the original event is not automatically replayed.

4. Set `Additional consent checks` on the tags.
   - Google tags can generally use built-in consent behavior and be marked as no additional consent required.
   - Non-Google ad pixels and conversion tags should require `ad_storage`.
   - Analytics tools should require `analytics_storage`.
   - Functional/performance widgets should require `functionality_storage`, unless they are strictly essential.

5. Do not blindly add `Termly.consentSaveDone` to every conversion tag.
   - Base/init tags can safely use a consent-save fallback if their code is idempotent.
   - Page conversion tags need duplicate protection before adding consent-save fallback triggers, because `Termly.consentSaveDone` can happen after the original page event and may happen more than once.

## Trigger Pattern

For base/init tags:

- Primary trigger: existing funnel-level trigger.
- Fallback trigger: `Termly.consentSaveDone` filtered to the same funnel where possible.
- Consent check: platform-specific consent type.

For page-level event tags:

- Primary trigger: existing `funnel_step_ready` trigger.
- Optional fallback trigger: `Termly.consentSaveDone` filtered by `funnel_id`, `funnel_step`, and `funnel_step_version` where applicable.
- Required guard: dedupe by event key, tag key, or page-step key before firing purchase/lead/checkout conversions.

## Consent Category Map

| Termly category | GTM consent type | Use for |
| --- | --- | --- |
| Essential | `security_storage` or no additional consent | Security, fraud prevention, required form protection, hCaptcha |
| Analytics | `analytics_storage` | Analytics, attribution, testing analytics, non-ad measurement |
| Performance | `functionality_storage` | Functional widgets, embeds, calendar/video player state |
| Advertising | `ad_storage` | Ad pixels, retargeting, affiliate tracking, ad conversions |
| Google advertising user data | `ad_user_data` | Google Ads enhanced/user-data consent |
| Google ad personalization | `ad_personalization` | Google Ads personalization/remarketing consent |

## Provider Table

| Platform / provider | Cookies or storage items discussed | Termly category | GTM consent check |
| --- | --- | --- | --- |
| ClickFunnels Classic | `cf:name`, `cf:term`, `cf:content`, generated page-view cookies like `12852307_viewed_1`, `cf:NjIxNDIxMDE` | Analytics | `analytics_storage` |
| ClickFunnels Classic / affiliate tracking | `cf:affiliate_id`, `cf:cf_affiliate_id`, `cfcf_affiliate_id` | Advertising | `ad_storage` |
| VWO | `vwoSn` | Analytics | `analytics_storage` |
| AddEvent | `addevent_track_cookie` | Performance | `functionality_storage` |
| TikTok Pixel | `_tt_enable_cookie`, `tt_appInfo` | Advertising | `ad_storage` |
| Vimeo | `player`, `LOCAL_STORAGE_ID_VIMEO_PLAYER` | Performance | `functionality_storage` |
| Vimeo / video interaction tracking | `LOCAL_STORAGE_ID_PICOX_ID`, `PLAYER_PICOX_SAMPLING_SEED` | Analytics | `analytics_storage` |
| hCaptcha | `hmt_id` | Essential | no additional consent or `security_storage` |
| Pinterest Tag | `_pin_unauth` | Advertising | `ad_storage` |
| Microsoft Advertising / Bing UET | `_uetsid`, `_uetvid`, `_uetsid_exp`, `_uetvid_exp` | Advertising | `ad_storage` |
| Own attribution cookie | `_attr_current` | Analytics | `analytics_storage` |
| Google Ads / Google tag | Google ad cookies and conversion linker storage | Advertising | built-in consent checks; no additional consent required, with Consent Mode values configured |
| GA4 / Google Analytics tag | Google analytics cookies | Analytics | built-in consent checks; no additional consent required, with `analytics_storage` controlled by Termly |
| Meta Pixel | `_fbp`, `_fbc`, Meta browser pixel storage | Advertising | `ad_storage` |
| Meta CAPI preparation tags | hashed email, phone, first name, last name, `_fbp`, `_fbc`, `event_id` pushed to dataLayer or sent to CAPI endpoint | Advertising | `ad_storage` |
| Stape / server-side event endpoint | Server-side forwarding for Meta/CAPI-style events | Advertising | `ad_storage` before browser-side collection or dispatch |
| FirstPromoter | Affiliate/referral tracking storage | Advertising | `ad_storage` |
| Proof | Social proof widget/tracking script | Advertising or Analytics, depending on campaign use | likely `ad_storage` if used for persuasion/marketing; otherwise `analytics_storage` |
| ActiveCampaign site tracking | visitor/site tracking cookies from `diffuser-cdn.app-us1.com` | Advertising or Analytics | `ad_storage` if used for marketing automation/retargeting; otherwise `analytics_storage` |
| Boom universal tracking script | first-party tracking script from `t.boomingbookkeeping.com` | Analytics or Advertising | `analytics_storage` for attribution only; `ad_storage` if used for ad attribution/retargeting |
| Trustpilot TrustBox widget | Trustpilot widget/embed storage, if any | Performance | `functionality_storage` |
| Termly CMP | Consent preferences and consent state | Essential | no additional consent; must run on Consent Initialization |

## Platforms Present In The Current GTM Container That Were Not In The Original Base Table

- Google Ads / Google tag
- GA4 / Google Analytics tag
- Meta Pixel
- Meta CAPI preparation tags
- Stape/server-side event endpoint usage
- FirstPromoter
- Proof
- ActiveCampaign
- Boom universal tracking script
- Trustpilot TrustBox widget
- Termly itself

## Container-Specific Notes

- The `Termly` tag exists and is on Consent Initialization.
- Most tags currently show `consentStatus: notSet`, except the Meta base pixel, which already requires `ad_storage`.
- The next cleanup should focus on setting `Additional consent checks` consistently across non-Google tags.
- Google Ads and GA4 tags should be reviewed separately because they use built-in consent behavior.
- Page-level conversion tags need dedupe before adding `Termly.consentSaveDone` fallback triggers.
