import { sendIdentify } from "./analytics-track.js";

var EMAIL_SELECTORS = ['input[type="email"]', 'input[name="email"]', 'input[name="Email"]', 'input[name="email_address"]', 'input[name="emailAddress"]'];
var PHONE_SELECTORS = ['input[type="tel"]', 'input[type="phone"]', 'input[name="phone"]', 'input[name="Phone"]', 'input[name="mobile"]', 'input[name="phone_number"]', 'input[name="phoneNumber"]'];

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizePhone(value) {
  var raw = String(value || "").trim();
  var prefix = raw.charAt(0) === "+" ? "+" : "";
  var digits = raw.replace(/[^0-9]/g, "").replace(/^0+/, "");

  return prefix + digits;
}

function isValidPhone(value) {
  return /^\+?[0-9]{1,15}$/.test(normalizePhone(value));
}

export function identifyFromInput(input, type) {
  var value = String(input.value || "").trim();
  var lastIdentifiedAttribute = "data-boom-clickfunnels-last-identified-" + type;

  if (!value) {
    return;
  }

  if (input.getAttribute(lastIdentifiedAttribute) === value) {
    return;
  }

  if (type === "email" && isValidEmail(value)) {
    sendIdentify(value, { email: value });
    input.setAttribute(lastIdentifiedAttribute, value);
    return;
  }

  if (type === "phone" && isValidPhone(value)) {
    sendIdentify("", { phone: normalizePhone(value) });
    input.setAttribute(lastIdentifiedAttribute, value);
  }
}

function bindEmailInput(input) {
  if (input.getAttribute("data-boom-clickfunnels-identify-email")) {
    return;
  }

  input.setAttribute("data-boom-clickfunnels-identify-email", "1");
  input.addEventListener("blur", function() {
    identifyFromInput(input, "email");
  });
  input.addEventListener("change", function() {
    identifyFromInput(input, "email");
  });
}

function bindPhoneInput(input) {
  if (input.getAttribute("data-boom-clickfunnels-identify-phone")) {
    return;
  }

  input.setAttribute("data-boom-clickfunnels-identify-phone", "1");
  input.addEventListener("blur", function() {
    identifyFromInput(input, "phone");
  });
  input.addEventListener("change", function() {
    identifyFromInput(input, "phone");
  });
}

export function identifyFromForm(form) {
  var emailInput;
  var phoneInput;

  if (!form || typeof form.querySelector !== "function") {
    return;
  }

  emailInput = form.querySelector(EMAIL_SELECTORS.join(","));
  phoneInput = form.querySelector(PHONE_SELECTORS.join(","));

  if (emailInput) {
    identifyFromInput(emailInput, "email");
  }
  if (phoneInput) {
    identifyFromInput(phoneInput, "phone");
  }
}

export function identifyFromProperties(properties) {
  var email = String(properties && properties.email || "").trim();
  var phone = normalizePhone(properties && properties.phone);
  var traits = {};

  if (isValidEmail(email)) {
    traits.email = email;
  }
  if (isValidPhone(phone)) {
    traits.phone = phone;
  }
  if (properties && properties.name) {
    traits.name = properties.name;
  }
  if (properties && properties.first_name) {
    traits.first_name = properties.first_name;
  }
  if (properties && properties.last_name) {
    traits.last_name = properties.last_name;
  }

  if (!traits.email && !traits.phone) {
    return;
  }

  sendIdentify(traits.email || "", traits);
}

export function bindIdentifyInputs(root) {
  root = root || document;

  EMAIL_SELECTORS.forEach(function(selector) {
    if (root.matches && root.matches(selector)) {
      bindEmailInput(root);
    }

    root.querySelectorAll(selector).forEach(function(input) {
      bindEmailInput(input);
    });
  });

  PHONE_SELECTORS.forEach(function(selector) {
    if (root.matches && root.matches(selector)) {
      bindPhoneInput(root);
    }

    root.querySelectorAll(selector).forEach(function(input) {
      bindPhoneInput(input);
    });
  });
}

function nodeMatchesAnySelector(node, selectors) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE || typeof node.matches !== "function") {
    return false;
  }

  return selectors.some(function(selector) {
    return node.matches(selector);
  });
}

function nodeMayContainIdentityInput(node) {
  var selectors = EMAIL_SELECTORS.concat(PHONE_SELECTORS);

  if (nodeMatchesAnySelector(node, selectors)) {
    return true;
  }
  if (!node || node.nodeType !== Node.ELEMENT_NODE || typeof node.querySelector !== "function") {
    return false;
  }

  return selectors.some(function(selector) {
    return Boolean(node.querySelector(selector));
  });
}

export function observeIdentifyInputs() {
  if (!document.body) {
    return;
  }

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (nodeMayContainIdentityInput(node)) {
          bindIdentifyInputs(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
