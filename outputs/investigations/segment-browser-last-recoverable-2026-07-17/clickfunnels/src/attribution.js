import { ATTR_EVENT_COOKIE_FIELDS, CONFIG, URL_FIELDS } from "./config.js";
import { getCookie, parseJsonCookie, setCookie } from "./cookies.js";
import { logClickFunnels } from "./logger.js";
import { getAttributionEndpoint, isConfiguredTrackingDomain } from "./tracking-hosts.js";
import { mergeObjects, stableStringify } from "./utils.js";

export function getSearchParams() {
  return new URLSearchParams(window.location.search || "");
}

export function getAttrUrlProperties() {
  var searchParams = getSearchParams();
  var properties = {};

  URL_FIELDS.forEach(function(name) {
    var value = searchParams.get(name) || "";
    if (!value) {
      return;
    }

    properties[name] = value;
  });

  return properties;
}

export function getAttrCookieProperties() {
  var properties = {};

  ATTR_EVENT_COOKIE_FIELDS.forEach(function(field) {
    var value = getCookie(field.cookie);
    if (!value) {
      return;
    }

    properties[field.property] = value;
  });

  return properties;
}

export function getAttrEventProperties() {
  return mergeObjects(getAttrUrlProperties(), getAttrCookieProperties());
}

export function cleanAttributionProperties(source) {
  var properties = {};
  var key;

  source = source || {};

  for (key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    if (source[key] === null || source[key] === void 0 || source[key] === "") {
      continue;
    }

    properties[key] = String(source[key]);
  }

  return properties;
}

export function mergeAttributionProperties(currentProperties, candidateProperties) {
  return cleanAttributionProperties(mergeObjects(
    cleanAttributionProperties(currentProperties),
    cleanAttributionProperties(candidateProperties),
  ));
}

export function writeLocalAttributionMirror(reason) {
  if (isConfiguredTrackingDomain()) {
    return false;
  }

  var currentProperties = parseJsonCookie(CONFIG.attributionMirrorCookie);
  var candidateProperties = getAttrEventProperties();
  var nextProperties = mergeAttributionProperties(currentProperties, candidateProperties);
  var keys = Object.keys(nextProperties).sort();

  if (!keys.length) {
    return false;
  }

  var currentSignature = stableStringify(cleanAttributionProperties(currentProperties));
  var nextSignature = stableStringify(nextProperties);
  if (currentSignature === nextSignature) {
    return false;
  }

  setCookie(CONFIG.attributionMirrorCookie, JSON.stringify(nextProperties), CONFIG.attributionMirrorHours);
  logClickFunnels("local attribution mirror written", {
    reason,
    hostname: window.location.hostname || "",
    keys,
    properties: nextProperties,
  });

  return true;
}

export function pingAttributionEndpoint() {
  return fetch(getAttributionEndpoint(), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: window.location.href }),
  }).catch(function() {
    return null;
  });
}
