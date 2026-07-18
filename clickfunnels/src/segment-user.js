import { CONFIG } from "./config.js";

export function getSegmentAnonymousId() {
  try {
    if (!window.analytics || typeof window.analytics.user !== "function") {
      return "";
    }

    var user = window.analytics.user();
    if (!user || typeof user.anonymousId !== "function") {
      return "";
    }

    return user.anonymousId() || "";
  } catch (error) {
    return "";
  }
}

export function getSegmentUserTraits() {
  try {
    if (!window.analytics || typeof window.analytics.user !== "function") {
      return {};
    }

    var user = window.analytics.user();
    if (!user || typeof user.traits !== "function") {
      return {};
    }

    return user.traits() || {};
  } catch (error) {
    return {};
  }
}

export function waitForSegment(callback) {
  if (window.analytics && typeof window.analytics.ready === "function" && typeof window.analytics.user === "function") {
    window.analytics.ready(function() {
      callback(getSegmentAnonymousId());
    });
    return;
  }

  var startedAt = Date.now();
  var intervalId = window.setInterval(function() {
    var didTimeOut = Date.now() - startedAt > CONFIG.segmentReadyTimeoutMs;
    var isReady = window.analytics && typeof window.analytics.user === "function" && typeof window.analytics.track === "function";
    if (!isReady && !didTimeOut) {
      return;
    }

    window.clearInterval(intervalId);
    callback(getSegmentAnonymousId());
  }, CONFIG.segmentReadyPollMs);
}

export function createEventId(eventName, stableKey) {
  var safeEventName = String(eventName || "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  var safeStableKey = String(stableKey || "").replace(/[^A-Za-z0-9]+/g, "").slice(-120);

  if (!safeEventName || !safeStableKey) {
    return "";
  }

  return ["ajs", safeEventName, safeStableKey].join("_");
}
