var ANONYMOUS_ID_PATTERN = /^[A-Za-z0-9._~-]{8,128}$/;

function normalizeAnonymousId(value) {
  value = String(value || "").trim();

  if (!ANONYMOUS_ID_PATTERN.test(value)) {
    return "";
  }

  return value;
}

function replaceCurrentUrl(url) {
  if (!window.history || typeof window.history.replaceState !== "function") {
    return;
  }

  window.history.replaceState(window.history.state, "", url.toString());
}

export function resolveHandoffIdentity() {
  var url = new URL(window.location.href);
  var hasAjsAid = url.searchParams.has("ajs_aid");
  var hasAnAid = url.searchParams.has("an_aid");
  var ajsAid = normalizeAnonymousId(url.searchParams.get("ajs_aid"));
  var anAid = normalizeAnonymousId(url.searchParams.get("an_aid"));
  var anonymousId = "";

  if (hasAjsAid && hasAnAid && ajsAid && ajsAid === anAid) {
    anonymousId = ajsAid;
  } else if (hasAjsAid && !hasAnAid && ajsAid) {
    anonymousId = ajsAid;
  } else if (hasAnAid && !hasAjsAid && anAid) {
    anonymousId = anAid;
  }

  if (!anonymousId && (hasAjsAid || hasAnAid)) {
    window.console && window.console.warn && window.console.warn("anonymous_id_handoff_conflict");
    url.searchParams.delete("ajs_aid");
    url.searchParams.delete("an_aid");
    replaceCurrentUrl(url);
    return "";
  }

  if (anonymousId) {
    url.searchParams.set("ajs_aid", anonymousId);
    url.searchParams.set("an_aid", anonymousId);
    replaceCurrentUrl(url);
  }

  return anonymousId;
}
