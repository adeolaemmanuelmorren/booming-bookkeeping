import { CONFIG } from "./config.js";
import { getReadyAnonymousId } from "./analytics-client.js";
import { getCookie } from "./cookies.js";

var ACTIVE_CAMPAIGN_HONEYPOT_FIELD_NAME = "field[31]";
var CLICKFUNNELS_HONEYPOT_CUSTOM_TYPE = "hpcheck";
var CLICKFUNNELS_CUSTOM_TYPE_GARLIC_KEY_PATTERN = /^garlic:.*>input\.custom_type$/;
var LEGACY_SEGMENT_ANONYMOUS_ID_COOKIE = "ajs_anonymous_id";
var TRACKING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function runSafely(callback) {
  try {
    return callback();
  } catch (error) {
    return null;
  }
}

export function getConfiguredActiveCampaignFieldNames() {
  var names = [];
  var runtimeNames = window.BOOM_CLICKFUNNELS_ACTIVE_CAMPAIGN_ANONYMOUS_ID_FIELDS;
  var configuredNames = CONFIG.activeCampaignAnonymousIdFieldNames || [];

  if (Array.isArray(configuredNames)) {
    names = names.concat(configuredNames);
  }
  if (Array.isArray(runtimeNames)) {
    names = names.concat(runtimeNames);
  }

  return names.filter(Boolean);
}

function getConfiguredClickFunnelsCustomTypes() {
  var customTypes = [];
  var runtimeTypes = window.BOOM_CLICKFUNNELS_ANONYMOUS_ID_CUSTOM_TYPES;
  var configuredTypes = CONFIG.clickFunnelsAnonymousIdCustomTypes || [];

  if (Array.isArray(configuredTypes)) {
    customTypes = customTypes.concat(configuredTypes);
  }
  if (Array.isArray(runtimeTypes)) {
    customTypes = customTypes.concat(runtimeTypes);
  }

  return customTypes.filter(Boolean);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value || "").replace(/"/g, '\\"');
}

function isFormElement(node) {
  return Boolean(node) && node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toLowerCase() === "form";
}

function findActiveCampaignAnonymousFields(form, fieldName) {
  var selector = 'input[name="' + cssEscape(fieldName) + '"], input[id="' + cssEscape(fieldName) + '"]';

  return form.querySelectorAll(selector);
}

function setFieldValue(input, value) {
  if (!input) {
    return;
  }

  if (input.value === value) {
    input.setAttribute("value", value);
    return;
  }

  input.value = value;
  input.setAttribute("value", value);

  // ClickFunnels copies the DOM value during submission. Synthetic input
  // events are unnecessary and make Garlic persist every custom field under
  // its shared input.custom_type key.
}

function fillFields(fields, anonymousId) {
  fields.forEach(function(input) {
    setFieldValue(input, anonymousId);
  });
}

function fillActiveCampaignAnonymousField(form, fieldName, anonymousId) {
  fillFields(findActiveCampaignAnonymousFields(form, fieldName), anonymousId);
}

function findClickFunnelsCustomTypeFields(root, customType) {
  var selector = [
    'input[data-custom-type="' + cssEscape(customType) + '"]',
    'textarea[data-custom-type="' + cssEscape(customType) + '"]',
    'select[data-custom-type="' + cssEscape(customType) + '"]',
  ].join(",");

  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  return root.querySelectorAll(selector);
}

function hydrateClickFunnelsCustomTypeFields(root, anonymousId) {
  root = root || document;

  getConfiguredClickFunnelsCustomTypes().forEach(function(customType) {
    fillFields(findClickFunnelsCustomTypeFields(root, customType), anonymousId);
  });
}

export function purgeClickFunnelsCustomTypeGarlicState() {
  var storage;

  try {
    storage = window.localStorage;

    // Iterate backwards because removeItem changes localStorage indexes.
    for (var i = storage.length - 1; i >= 0; i -= 1) {
      var key = storage.key(i);

      if (!CLICKFUNNELS_CUSTOM_TYPE_GARLIC_KEY_PATTERN.test(key || "")) {
        continue;
      }

      storage.removeItem(key);
    }
  } catch (error) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function normalizeTrackingId(value) {
  value = String(value || "").trim().replace(/^"+|"+$/g, "");

  if (!TRACKING_ID_PATTERN.test(value)) {
    return "";
  }

  return value;
}

function addKnownTrackingId(knownIds, value) {
  value = normalizeTrackingId(value);

  if (!value) {
    return;
  }

  knownIds[value] = true;
}

function addFieldTrackingIds(knownIds, fields) {
  fields.forEach(function(field) {
    addKnownTrackingId(knownIds, field.value);
  });
}

function getKnownTrackingIds(anonymousId) {
  var knownIds = {};

  addKnownTrackingId(knownIds, anonymousId);
  addKnownTrackingId(knownIds, getCookie(LEGACY_SEGMENT_ANONYMOUS_ID_COOKIE));
  addFieldTrackingIds(
    knownIds,
    findClickFunnelsCustomTypeFields(document, "segment_anonymous_id"),
  );

  document.querySelectorAll(
    'input[name="field[39]"], input[id="field[39]"]',
  ).forEach(function(field) {
    addKnownTrackingId(knownIds, field.value);
  });

  return knownIds;
}

function clearFieldWhenItContainsTrackingId(field, knownIds) {
  var value = normalizeTrackingId(field && field.value);

  if (!value || !knownIds[value]) {
    return false;
  }

  setFieldValue(field, "");
  return true;
}

export function clearTrackingIdsFromHoneypot(anonymousId) {
  var knownIds = getKnownTrackingIds(anonymousId);
  var cleared = false;

  // Garlic may restore the shared custom_type value before this bundle runs.
  // Clear only IDs produced by our tracking; leave real bot values intact.
  findClickFunnelsCustomTypeFields(
    document,
    CLICKFUNNELS_HONEYPOT_CUSTOM_TYPE,
  ).forEach(function(field) {
    cleared = clearFieldWhenItContainsTrackingId(field, knownIds) || cleared;
  });

  document.querySelectorAll(
    'input[name="' + ACTIVE_CAMPAIGN_HONEYPOT_FIELD_NAME + '"], ' +
    'input[id="' + ACTIVE_CAMPAIGN_HONEYPOT_FIELD_NAME + '"]',
  ).forEach(function(field) {
    cleared = clearFieldWhenItContainsTrackingId(field, knownIds) || cleared;
  });

  return cleared;
}

function hydrateActiveCampaignForm(form) {
  var anonymousId = getReadyAnonymousId();

  if (!isFormElement(form)) {
    return;
  }
  if (!anonymousId) {
    return;
  }

  clearTrackingIdsFromHoneypot(anonymousId);
  hydrateClickFunnelsCustomTypeFields(document, anonymousId);

  getConfiguredActiveCampaignFieldNames().forEach(function(fieldName) {
    fillActiveCampaignAnonymousField(form, fieldName, anonymousId);
  });
}

export function hydrateActiveCampaignForms(root) {
  root = root || document;

  runSafely(function() {
    var anonymousId = getReadyAnonymousId();

    purgeClickFunnelsCustomTypeGarlicState();

    if (anonymousId) {
      clearTrackingIdsFromHoneypot(anonymousId);
      hydrateClickFunnelsCustomTypeFields(root, anonymousId);
    }

    if (root.matches && root.matches("form")) {
      hydrateActiveCampaignForm(root);
    }

    root.querySelectorAll("form").forEach(function(form) {
      hydrateActiveCampaignForm(form);
    });
  });
}

function nodeIsOrContainsForm(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  if (isFormElement(node)) {
    return true;
  }
  if (typeof node.querySelector !== "function") {
    return false;
  }

  return Boolean(node.querySelector("form"));
}

function nodeIsOrContainsClickFunnelsCustomTypeField(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  if (typeof node.matches === "function") {
    for (var i = 0; i < getConfiguredClickFunnelsCustomTypes().length; i += 1) {
      if (node.matches('[data-custom-type="' + cssEscape(getConfiguredClickFunnelsCustomTypes()[i]) + '"]')) {
        return true;
      }
    }
  }
  if (typeof node.querySelector !== "function") {
    return false;
  }

  for (var j = 0; j < getConfiguredClickFunnelsCustomTypes().length; j += 1) {
    if (node.querySelector('[data-custom-type="' + cssEscape(getConfiguredClickFunnelsCustomTypes()[j]) + '"]')) {
      return true;
    }
  }

  return false;
}

export function observeActiveCampaignForms() {
  if (!document.body) {
    return;
  }
  if (document.__boomClickFunnelsActiveCampaignObserverBound) {
    return;
  }

  document.__boomClickFunnelsActiveCampaignObserverBound = true;

  var observer = new MutationObserver(function(mutations) {
    runSafely(function() {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (!nodeIsOrContainsForm(node) && !nodeIsOrContainsClickFunnelsCustomTypeField(node)) {
            return;
          }

          hydrateActiveCampaignForms(node);
        });
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

export function bindActiveCampaignNativeSubmitHydration() {
  var prototype;
  var nativeSubmit;

  if (!window.HTMLFormElement || !HTMLFormElement.prototype) {
    return;
  }

  prototype = HTMLFormElement.prototype;
  if (prototype.__boomClickFunnelsActiveCampaignSubmitHydrationBound) {
    return;
  }

  nativeSubmit = prototype.submit;
  if (typeof nativeSubmit !== "function") {
    return;
  }

  prototype.__boomClickFunnelsActiveCampaignSubmitHydrationBound = true;
  prototype.__boomClickFunnelsActiveCampaignNativeSubmit = nativeSubmit;

  prototype.submit = function() {
    runSafely(function() {
      hydrateActiveCampaignForms(this);
    }.bind(this));

    return nativeSubmit.apply(this, arguments);
  };
}
