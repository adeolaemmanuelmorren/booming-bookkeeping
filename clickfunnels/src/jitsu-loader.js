import { CONFIG } from "./config.js";
import { getTrackingHost, getTrackingRoot } from "./tracking-hosts.js";

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

function resolveHandoffIdentity() {
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

function buildJitsuScriptUrl(anonymousId) {
  var scriptUrl = new URL("https://" + getTrackingHost() + "/p.js");

  if (anonymousId) {
    scriptUrl.searchParams.set("ajs_aid", anonymousId);
    scriptUrl.searchParams.set("an_aid", anonymousId);
  }

  return scriptUrl.toString();
}

function configureCredentialedJitsuFetch() {
  var existingConfig = window.jitsuConfig || {};

  window.jitsuConfig = Object.assign({}, existingConfig, {
    fetch: function(input, init) {
      var options = Object.assign({}, init, {
        credentials: "include",
        keepalive: true,
      });
      return window.fetch(input, options);
    },
  });
}

export function loadJitsuAnalytics() {
  var existingScript = document.querySelector('script[data-boom-jitsu="1"]');
  if (existingScript) {
    return window[CONFIG.jitsuGlobalName] || null;
  }

  var anonymousId = resolveHandoffIdentity();
  var script = document.createElement("script");

  window.jitsuQ = window.jitsuQ || [];
  configureCredentialedJitsuFetch();

  script.async = true;
  script.src = buildJitsuScriptUrl(anonymousId);
  script.setAttribute("data-boom-jitsu", "1");
  script.setAttribute("data-init-only", "true");
  script.setAttribute("data-cookie-domain", getTrackingRoot());

  var firstScript = document.getElementsByTagName("script")[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  return window[CONFIG.jitsuGlobalName] || null;
}
