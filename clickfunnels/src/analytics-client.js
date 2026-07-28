import { CONFIG } from "./config.js";
import { getCookie } from "./cookies.js";
import { mergeObjects } from "./utils.js";

var userTraits = {};

function getJitsuClient() {
  var client = window[CONFIG.jitsuGlobalName];

  if (!client || typeof client.track !== "function") {
    return null;
  }

  return client;
}

function isJitsuInitialized(client) {
  var state;

  if (!client || typeof client.getState !== "function") {
    return false;
  }

  try {
    state = client.getState();
  } catch (_error) {
    return false;
  }

  return Boolean(state && state.context && state.context.initialized);
}

function waitForClientInitialization(client, callback) {
  var finished = false;

  function finish() {
    if (finished) {
      return;
    }

    finished = true;
    callback(client);
  }

  if (isJitsuInitialized(client)) {
    finish();
    return;
  }

  if (typeof client.on !== "function") {
    finish();
    return;
  }

  client.on("ready", finish);

  if (isJitsuInitialized(client)) {
    finish();
  }
}

function queueJitsuCallback(callback) {
  window.jitsuQ = window.jitsuQ || [];
  window.jitsuQ.push(function(client) {
    waitForClientInitialization(client, callback);
  });
}

export function getAnonymousId() {
  return getCookie(CONFIG.anonymousIdCookieName) || "";
}

export function getReadyAnonymousId() {
  var client = getJitsuClient();

  if (!isJitsuInitialized(client)) {
    return "";
  }

  return getAnonymousId();
}

export function getUserTraits() {
  return mergeObjects({}, userTraits);
}

export function setAnonymousId(anonymousId) {
  if (!anonymousId) {
    return false;
  }

  ready(function(client) {
    if (typeof client.setAnonymousId !== "function") {
      return;
    }

    client.setAnonymousId(anonymousId);
  });

  return true;
}

export function ready(callback) {
  var client = getJitsuClient();

  if (client) {
    waitForClientInitialization(client, callback);
    return;
  }

  queueJitsuCallback(callback);
}

export function waitForAnalytics(callback) {
  var finished = false;
  var startedAt = Date.now();
  var intervalId;

  function finish(client) {
    if (finished) {
      return;
    }

    finished = true;
    window.clearInterval(intervalId);
    callback(getAnonymousId(), client);
  }

  intervalId = window.setInterval(function() {
    var didTimeOut = Date.now() - startedAt > CONFIG.jitsuReadyTimeoutMs;
    var client = getJitsuClient();

    if (client && isJitsuInitialized(client)) {
      finish(client);
      return;
    }

    if (!didTimeOut) {
      return;
    }

    finished = true;
    window.clearInterval(intervalId);
    window.console && window.console.warn && window.console.warn("jitsu_ready_timeout");
  }, CONFIG.jitsuReadyPollMs);

  ready(finish);
}

export function page(properties) {
  ready(function(client) {
    if (typeof client.page !== "function") {
      return;
    }

    if (properties) {
      client.page(properties);
      return;
    }

    client.page();
  });
}

export function track(eventName, properties, options) {
  ready(function(client) {
    client.track(eventName, properties || {}, options || {});
  });
}

export function identify(userId, traits, options) {
  traits = traits || {};
  userTraits = mergeObjects(userTraits, traits);

  ready(function(client) {
    if (typeof client.identify !== "function") {
      return;
    }

    if (userId) {
      client.identify(userId, traits, options || {});
      return;
    }

    client.identify(traits, options || {});
  });
}

export function group(groupId, traits, options) {
  ready(function(client) {
    if (typeof client.group !== "function") {
      return;
    }

    client.group(groupId, traits || {}, options || {});
  });
}

export function createEventId(eventName, stableKey) {
  var safeEventName = String(eventName || "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  var safeStableKey = String(stableKey || "").replace(/[^A-Za-z0-9]+/g, "").slice(-120);

  if (!safeEventName || !safeStableKey) {
    return "";
  }

  return ["ajs", safeEventName, safeStableKey].join("_");
}
