export const ACTIVE_CAMPAIGN_SEGMENT_ANONYMOUS_ID_FIELD_NAMES = [
  "field[39]",
];

export const CLICKFUNNELS_SEGMENT_ANONYMOUS_ID_CUSTOM_TYPES = [
  "segment_anonymous_id",
];

export const CONFIG = {
  attributionEndpoint: "",
  attributionMirrorCookie: "_attr_current_js",
  attributionMirrorHours: 4320,
  segmentGlobalName: "analytics",
  segmentProxyRoutePrefix: "route",
  segmentWriteKey: "REDACTED",
  segmentReadyTimeoutMs: 1e4,
  segmentReadyPollMs: 100,
  activeCampaignAnonymousIdFieldNames: ACTIVE_CAMPAIGN_SEGMENT_ANONYMOUS_ID_FIELD_NAMES,
  clickFunnelsAnonymousIdCustomTypes: CLICKFUNNELS_SEGMENT_ANONYMOUS_ID_CUSTOM_TYPES,
};

export const URL_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "gbraid",
  "wbraid",
  "twclid",
  "ttclid",
  "rdt_cid",
  "li_fat_id",
  "msclkid",
];

export const COOKIE_FIELDS = [
  "_fbc",
  "_fbp",
  "_uetvid",
  "_uetsid",
  "_ttp",
  "_ttclid",
  "_rdt_uuid",
  "msclkid",
];

export const ATTR_EVENT_COOKIE_FIELDS = [
  { cookie: "_fbc", property: "fbc" },
  { cookie: "_fbp", property: "fbp" },
  { cookie: "_uetvid", property: "uetvid" },
  { cookie: "_uetsid", property: "uetsid" },
  { cookie: "_ttp", property: "ttp" },
  { cookie: "_ttclid", property: "ttclid" },
  { cookie: "_rdt_uuid", property: "rdt_uuid" },
  { cookie: "msclkid", property: "msclkid" },
  { cookie: "gclid", property: "gclid" },
  { cookie: "gbraid", property: "gbraid" },
  { cookie: "wbraid", property: "wbraid" },
  { cookie: "fbclid", property: "fbclid" },
  { cookie: "twclid", property: "twclid" },
  { cookie: "ttclid", property: "ttclid" },
  { cookie: "rdt_cid", property: "rdt_cid" },
  { cookie: "li_fat_id", property: "li_fat_id" },
];

export const GA4_STANDARD_EVENT_MAP = {
  "Form Submitted": "generate_lead",
};

export const TRACKING_HOSTS = [
  { root: "thebookkeepingchallenge.com", host: "sg.thebookkeepingchallenge.com" },
  { root: "keyboardrichchallenge.com", host: "sg.keyboardrichchallenge.com" },
  { root: "keyboardrich.com", host: "sg.keyboardrich.com" },
  { root: "boomingbookkeeping.com", host: "sg.boomingbookkeeping.com" },
];
