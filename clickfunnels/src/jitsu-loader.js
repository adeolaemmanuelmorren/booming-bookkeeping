import { CONFIG } from "./config.js";
import { getConsentHeader } from "./consent.js";
import { resolveHandoffIdentity } from "./identity-handoff.js";
import { getTrackingHost, getTrackingRoot } from "./tracking-hosts.js";

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
      var consentHeader = getConsentHeader();
      var headers = new Headers(init && init.headers || {});

      headers.set(consentHeader.name, consentHeader.value);

      var options = Object.assign({}, init, {
        credentials: "include",
        headers: headers,
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
