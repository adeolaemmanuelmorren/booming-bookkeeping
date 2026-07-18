import { CONFIG, TRACKING_HOSTS } from "./config.js";

export function isRootOrSubdomain(hostname, rootDomain) {
  return hostname === rootDomain || hostname.slice(-(rootDomain.length + 1)) === "." + rootDomain;
}

export function getTrackingHost() {
  var hostname = window.location.hostname || "";

  for (var i = 0; i < TRACKING_HOSTS.length; i += 1) {
    if (isRootOrSubdomain(hostname, TRACKING_HOSTS[i].root)) {
      return TRACKING_HOSTS[i].host;
    }
  }

  return TRACKING_HOSTS[0].host;
}

export function getAttributionEndpoint() {
  if (CONFIG.attributionEndpoint) {
    return CONFIG.attributionEndpoint;
  }

  return "https://" + getTrackingHost() + "/route/ck";
}

export function isConfiguredTrackingDomain() {
  var hostname = window.location.hostname || "";

  for (var i = 0; i < TRACKING_HOSTS.length; i += 1) {
    if (isRootOrSubdomain(hostname, TRACKING_HOSTS[i].root)) {
      return true;
    }
  }

  return false;
}
