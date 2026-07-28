import { CONFIG } from "./config.js";
import { getSegmentAnonymousId } from "./segment-user.js";

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
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

function hydrateActiveCampaignForm(form) {
  var anonymousId = getSegmentAnonymousId();

  if (!isFormElement(form)) {
    return;
  }
  if (!anonymousId) {
    return;
  }

  hydrateClickFunnelsCustomTypeFields(document, anonymousId);

  getConfiguredActiveCampaignFieldNames().forEach(function(fieldName) {
    fillActiveCampaignAnonymousField(form, fieldName, anonymousId);
  });
}

export function hydrateActiveCampaignForms(root) {
  root = root || document;

  runSafely(function() {
    var anonymousId = getSegmentAnonymousId();

    if (anonymousId) {
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
