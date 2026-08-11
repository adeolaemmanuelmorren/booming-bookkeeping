import { getAnonymousId } from "./analytics-client.js";
import { resolveHandoffIdentity } from "./identity-handoff.js";
import {
  getTrackingHost,
  isConfiguredTrackingDomain,
} from "./tracking-hosts.js";

var CONSENT_POLICY_VERSION = "v1";
var CONSENT_BOOTSTRAP_TIMEOUT_MS = 1000;
var CONSENT_HEADER_NAME = "X-Boom-Consent";

function createUnknownContext() {
  return {
    preferences: null,
    statistics: null,
    marketing: null,
    responseStatus: "unknown",
    revision: 0,
    policyVersion: CONSENT_POLICY_VERSION,
  };
}

function getRuntime() {
  if (!window.__boomConsentRuntime) {
    window.__boomConsentRuntime = {
      context: createUnknownContext(),
      importedChoice: null,
      importedSignature: "",
      lastSavedSignature: "",
      pendingSignature: "",
      listenersRegistered: false,
      started: false,
      promise: null,
    };
  }

  return window.__boomConsentRuntime;
}

function getGlobalPrivacyControl() {
  return Boolean(window.navigator && window.navigator.globalPrivacyControl === true);
}

function getChoiceSignature(choice) {
  return [
    choice.preferences ? "1" : "0",
    choice.statistics ? "1" : "0",
    choice.marketing ? "1" : "0",
    choice.gpcApplied ? "1" : "0",
  ].join("");
}

function isBoolean(value) {
  return value === true || value === false;
}

function readImportedChoice(payload) {
  var consent = payload && payload.consent;

  if (!consent || payload.status !== "explicit") {
    return null;
  }

  if (!isBoolean(consent.preferences) ||
      !isBoolean(consent.statistics) ||
      !isBoolean(consent.marketing)) {
    return null;
  }

  return {
    preferences: consent.preferences,
    statistics: consent.statistics,
    marketing: consent.marketing,
    gpcApplied: Boolean(consent.gpcApplied),
    revision: Number(consent.revision) || 0,
    policyVersion: consent.policyVersion || CONSENT_POLICY_VERSION,
  };
}

function getCookiebotChoice() {
  var cookiebot = window.Cookiebot;

  if (!cookiebot || !cookiebot.consent) {
    return null;
  }

  var hasResponse = Boolean(cookiebot.hasResponse);
  var gpcApplied = getGlobalPrivacyControl() && !cookiebot.consent.marketing;

  return {
    preferences: Boolean(cookiebot.consent.preferences),
    statistics: Boolean(cookiebot.consent.statistics),
    marketing: Boolean(cookiebot.consent.marketing),
    gpcApplied: gpcApplied,
    responseStatus: hasResponse
      ? (gpcApplied ? "gpc" : "explicit")
      : "unanswered",
  };
}

function setContextFromChoice(choice, revision) {
  var runtime = getRuntime();

  runtime.context = {
    preferences: choice.preferences,
    statistics: choice.statistics,
    marketing: choice.marketing,
    responseStatus: choice.responseStatus,
    revision: Number(revision) || 0,
    policyVersion: CONSENT_POLICY_VERSION,
  };
}

function getConsentEndpoint(path) {
  return "https://" + getTrackingHost() + path;
}

function saveConsentChoice(choice, anonymousId) {
  var runtime = getRuntime();
  var signature = getChoiceSignature(choice);

  if (choice.responseStatus === "unanswered") {
    return Promise.resolve();
  }

  if (signature === runtime.importedSignature ||
      signature === runtime.lastSavedSignature ||
      signature === runtime.pendingSignature) {
    return Promise.resolve();
  }

  runtime.pendingSignature = signature;

  return window.fetch(getConsentEndpoint("/consent/state"), {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: anonymousId || undefined,
      preferences: choice.preferences,
      statistics: choice.statistics,
      marketing: choice.marketing,
      gpcApplied: choice.gpcApplied,
      policyVersion: CONSENT_POLICY_VERSION,
    }),
  }).then(function(response) {
    if (!response.ok) {
      throw new Error("consent_state_failed");
    }

    return response.json();
  }).then(function(payload) {
    var revision = payload &&
      payload.consent &&
      Number(payload.consent.revision);

    if (runtime.pendingSignature === signature) {
      runtime.pendingSignature = "";
    }

    runtime.lastSavedSignature = signature;
    setContextFromChoice(choice, revision || 0);
  }).catch(function() {
    if (runtime.pendingSignature === signature) {
      runtime.pendingSignature = "";
    }

    window.console && window.console.warn && window.console.warn("consent_state_failed");
  });
}

function handleCookiebotDialogInit() {
  var runtime = getRuntime();
  var importedChoice = runtime.importedChoice;
  var cookiebot = window.Cookiebot;

  if (!importedChoice ||
      !cookiebot ||
      typeof cookiebot.submitCustomConsent !== "function") {
    return;
  }

  var choice = {
    preferences: importedChoice.preferences,
    statistics: importedChoice.statistics,
    marketing: importedChoice.marketing,
    gpcApplied: importedChoice.gpcApplied,
  };

  if (getGlobalPrivacyControl() && choice.marketing) {
    choice.marketing = false;
    choice.gpcApplied = true;
  }

  runtime.importedSignature = choice.gpcApplied && !importedChoice.gpcApplied
    ? ""
    : getChoiceSignature(choice);

  cookiebot.submitCustomConsent(
    choice.preferences,
    choice.statistics,
    choice.marketing,
  );
}

function handleCookiebotConsentReady() {
  var runtime = getRuntime();
  var choice = getCookiebotChoice();
  if (!choice) return;

  var signature = getChoiceSignature(choice);
  var revision = signature === runtime.importedSignature &&
    runtime.importedChoice
    ? runtime.importedChoice.revision
    : 0;

  setContextFromChoice(choice, revision);
  saveConsentChoice(choice, resolveHandoffIdentity());
}

function registerCookiebotListeners() {
  var runtime = getRuntime();
  if (runtime.listenersRegistered) return;
  if (typeof window.addEventListener !== "function") return;

  runtime.listenersRegistered = true;
  window.addEventListener("CookiebotOnDialogInit", handleCookiebotDialogInit);
  window.addEventListener("CookiebotOnConsentReady", handleCookiebotConsentReady);
  window.addEventListener("CookiebotOnAccept", handleCookiebotConsentReady);
  window.addEventListener("CookiebotOnDecline", handleCookiebotConsentReady);
}

function pushCookiebotReady() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "cookiebot_bootstrap_ready",
    anonymous_id: getAnonymousId(),
  });
}

function fetchBootstrap(anonymousId) {
  var controller = new AbortController();
  var timeoutId = window.setTimeout(function() {
    controller.abort();
  }, CONSENT_BOOTSTRAP_TIMEOUT_MS);

  return window.fetch(getConsentEndpoint("/consent/bootstrap"), {
    method: "POST",
    credentials: "include",
    keepalive: true,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: anonymousId || undefined,
      policyVersion: CONSENT_POLICY_VERSION,
    }),
  }).then(function(response) {
    if (!response.ok) {
      throw new Error("consent_bootstrap_failed");
    }

    return response.json();
  }).then(function(payload) {
    var runtime = getRuntime();
    var importedChoice = readImportedChoice(payload);

    runtime.importedChoice = importedChoice;

    if (importedChoice) {
      runtime.context = {
        preferences: importedChoice.preferences,
        statistics: importedChoice.statistics,
        marketing: importedChoice.marketing,
        responseStatus: importedChoice.gpcApplied ? "gpc" : "explicit",
        revision: importedChoice.revision,
        policyVersion: importedChoice.policyVersion,
      };
    }
  }).catch(function(error) {
    if (!error || error.name !== "AbortError") {
      window.console && window.console.warn && window.console.warn("consent_bootstrap_failed");
    }
  }).finally(function() {
    window.clearTimeout(timeoutId);
    pushCookiebotReady();
  });
}

export function getConsentContext() {
  var context = getRuntime().context;

  return {
    preferences: context.preferences,
    statistics: context.statistics,
    marketing: context.marketing,
    responseStatus: context.responseStatus,
    revision: context.revision,
    policyVersion: context.policyVersion,
  };
}

export function getConsentHeader() {
  return {
    name: CONSENT_HEADER_NAME,
    value: JSON.stringify(getConsentContext()),
  };
}

export function startConsentBootstrap() {
  var runtime = getRuntime();

  if (runtime.started) {
    return runtime.promise;
  }

  runtime.started = true;
  registerCookiebotListeners();

  window.BoomConsent = {
    getContext: getConsentContext,
  };

  if (!isConfiguredTrackingDomain()) {
    pushCookiebotReady();
    runtime.promise = Promise.resolve();
    return runtime.promise;
  }

  runtime.promise = fetchBootstrap(resolveHandoffIdentity());

  return runtime.promise;
}
