import { ATTR_EVENT_COOKIE_FIELDS, CONFIG, COOKIE_FIELDS, URL_FIELDS } from "./config.js";
import { getConfiguredActiveCampaignFieldNames, hydrateActiveCampaignForms } from "./active-campaign.js";
import { identifyFromForm } from "./identity.js";
import { createEventId, getSegmentAnonymousId } from "./segment-user.js";
import { sendTrack } from "./segment-track.js";
import { mergeObjects } from "./utils.js";

var PENDING_CHECKOUT_KEY = "boom_clickfunnels_pending_checkout";
var trackedSubmissionIds = {};

function runSafely(callback) {
  try {
    return callback();
  } catch (error) {
    return null;
  }
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

function getFieldValue(value) {
  if (typeof File !== "undefined" && value instanceof File) {
    return value.name || "";
  }

  return String(value || "");
}

function normalizeFormFieldName(name) {
  return String(name || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function isSensitiveFieldName(name) {
  var normalizedName = normalizeFormFieldName(name);

  if (!normalizedName) {
    return false;
  }

  return [
    "authenticity_token",
    "card",
    "card_number",
    "cc",
    "client_secret",
    "csrf",
    "cvc",
    "cvv",
    "nonce",
    "password",
    "payment_method_nonce",
    "secret",
    "token",
  ].some(function(token) {
    return normalizedName.indexOf(token) >= 0;
  });
}

function getPasswordFieldNames(form) {
  var names = {};

  form.querySelectorAll('input[type="password"][name]').forEach(function(input) {
    names[input.name] = true;
  });

  return names;
}

function getTrackingFieldNames() {
  var names = {
    ajs_anonymous_id: true,
    ct_form_submission_id: true,
    attribution_first: true,
    attribution_last: true,
    attribution_current: true,
    custom_type: true,
  };

  URL_FIELDS.forEach(function(name) {
    names[name] = true;
  });
  COOKIE_FIELDS.forEach(function(name) {
    names[name] = true;
  });
  ATTR_EVENT_COOKIE_FIELDS.forEach(function(field) {
    names[field.cookie] = true;
    names[field.property] = true;
  });
  getConfiguredActiveCampaignFieldNames().forEach(function(name) {
    names[name] = true;
    names[normalizeFormFieldName(name)] = true;
  });

  return names;
}

function getTopLevelFormFieldMap() {
  return {
    contact_email: "email",
    contact_first_name: "first_name",
    contact_last_name: "last_name",
    contact_name: "name",
    contact_phone: "phone",
    checkout_offer_extra_contact_information_phone_number: "phone",
    checkout_offer_member_email: "email",
    checkout_offer_member_name: "name",
    e_mail: "email",
    email: "email",
    first_name: "first_name",
    firstname: "first_name",
    full_name: "name",
    fullname: "name",
    last_name: "last_name",
    lastname: "last_name",
    mobile: "phone",
    name: "name",
    phone: "phone",
    phone_number: "phone",
  };
}

function appendSubmittedField(fields, name, value) {
  if (!name) {
    return;
  }
  if (!value) {
    return;
  }

  if (fields[name] === void 0) {
    fields[name] = value;
    return;
  }

  if (!Array.isArray(fields[name])) {
    fields[name] = [fields[name]];
  }

  fields[name].push(value);
}

function addFieldToProperties(output, name, value, options) {
  var normalizedName = normalizeFormFieldName(name);
  var topLevelName;

  options = options || {};

  if (!normalizedName) {
    return;
  }
  if (options.passwordNames && options.passwordNames[name]) {
    return;
  }
  if (options.trackingNames && (options.trackingNames[name] || options.trackingNames[normalizedName])) {
    return;
  }
  if (isSensitiveFieldName(name)) {
    return;
  }

  value = getFieldValue(value).trim();
  if (!value) {
    return;
  }

  topLevelName = getTopLevelFormFieldMap()[normalizedName];
  if (topLevelName) {
    if (output.topLevelFields[topLevelName] === void 0) {
      output.topLevelFields[topLevelName] = value;
    }
    return;
  }

  appendSubmittedField(output.extraFields, normalizedName, value);
}

function getFormFieldProperties(form, submitter) {
  var output = { topLevelFields: {}, extraFields: {} };
  var passwordNames = getPasswordFieldNames(form);
  var trackingNames = getTrackingFieldNames();
  var formData;

  try {
    formData = submitter ? new FormData(form, submitter) : new FormData(form);
  } catch (error) {
    formData = new FormData(form);
  }

  formData.forEach(function(value, name) {
    addFieldToProperties(output, name, value, { passwordNames, trackingNames });
  });

  mergeVisibleClickFunnelsFieldProperties(output, form);

  return output;
}

function isVisibleElement(element) {
  var rect;

  if (!element || typeof element.getBoundingClientRect !== "function") {
    return false;
  }
  if (element.type === "hidden") {
    return false;
  }

  rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    return false;
  }

  return true;
}

function getControlName(control) {
  return control.name ||
    control.getAttribute("data-custom-type") ||
    control.getAttribute("data-type") ||
    control.getAttribute("placeholder") ||
    control.getAttribute("aria-label") ||
    control.id ||
    "";
}

function mergeVisibleClickFunnelsFieldProperties(output, form) {
  var controls = document.querySelectorAll("input.elInput, textarea.elInput, select.elInput");

  controls.forEach(function(control) {
    var name;

    if (!isVisibleElement(control)) {
      return;
    }
    if (form && form.contains(control)) {
      return;
    }
    if (control.type === "checkbox" || control.type === "radio") {
      if (!control.checked) {
        return;
      }
    }

    name = getControlName(control);
    addFieldToProperties(output, name, control.value, { trackingNames: getTrackingFieldNames() });
  });
}

function getSubmitter(event, form) {
  var activeElement;
  var tagName;
  var type;

  if (event && event.submitter) {
    return event.submitter;
  }

  activeElement = document.activeElement;
  if (!activeElement || !form.contains(activeElement)) {
    return null;
  }

  tagName = String(activeElement.tagName || "").toLowerCase();
  type = String(activeElement.type || "").toLowerCase();
  if (tagName === "button") {
    return activeElement;
  }
  if (tagName === "input" && (type === "submit" || type === "image")) {
    return activeElement;
  }

  return null;
}

function buildFormSubmissionId(form, submittedAt) {
  var formId = form.getAttribute("id") || "";
  var formName = form.getAttribute("name") || form.getAttribute("data-name") || formId || "";

  return [
    getSegmentAnonymousId() || "anon",
    formId,
    formName,
    window.location.pathname || "",
    submittedAt,
  ].join(":");
}

function getFormSubmissionId(form, submittedAt) {
  return buildFormSubmissionId(form, submittedAt);
}

function getPageFallbackContext() {
  return {
    page_url: window.location.href,
    page_path: window.location.pathname || "",
    page_title: document.title || "",
  };
}

function buildFormSubmittedProperties(form, submitter, trigger) {
  var submittedAt = new Date().toISOString();
  var formSubmissionId = getFormSubmissionId(form, submittedAt);
  var formId = form.getAttribute("id") || "";
  var formName = form.getAttribute("name") || form.getAttribute("data-name") || formId || "";
  var formAction = form.getAttribute("action") || "";
  var formMethod = String(form.getAttribute("method") || "get").toUpperCase();
  var formFields = getFormFieldProperties(form, submitter);
  var eventId = createEventId("Form Submitted", formSubmissionId);

  return mergeObjects({
    form_name: formName,
    form_id: formId,
    form_action: formAction,
    form_method: formMethod,
    submitted_at: submittedAt,
    submit_trigger: trigger || "submit",
    extra_submitted_fields: formFields.extraFields,
    submitter_name: submitter && submitter.name || "",
    submitter_value: submitter && submitter.value || "",
    event_id: eventId,
  }, mergeObjects(getPageFallbackContext(), formFields.topLevelFields));
}

function shouldTrackSubmission(properties) {
  if (!properties.event_id) {
    return true;
  }
  if (trackedSubmissionIds[properties.event_id]) {
    return false;
  }

  trackedSubmissionIds[properties.event_id] = true;
  return true;
}

function hasLeadIdentity(properties) {
  if (properties.email) {
    return true;
  }
  if (properties.phone) {
    return true;
  }
  if (properties.name) {
    return true;
  }
  if (properties.first_name) {
    return true;
  }

  return false;
}

function getDataAttribute(element, name) {
  if (!element || !element.getAttribute) {
    return "";
  }

  return element.getAttribute(name) || "";
}

function parseMoneyAmount(value) {
  var normalizedValue = String(value || "").replace(/[^0-9.]+/g, "");
  var amount;

  if (!normalizedValue) {
    return null;
  }

  amount = Number(normalizedValue);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return amount;
}

function readProductFromInput(input) {
  var label = "";
  var id = input.value || "";
  var name = getDataAttribute(input, "data-product-name");
  var amount = parseMoneyAmount(getDataAttribute(input, "data-product-amount"));

  if (input.id) {
    label = document.querySelector('label[for="' + cssEscape(input.id) + '"]');
    label = label && label.textContent || "";
  }

  if (!name) {
    name = label.trim();
  }

  return {
    product_id: id,
    product_name: name,
    price: amount,
    currency: "USD",
  };
}

function dedupeProducts(products) {
  var seen = {};
  var output = [];

  products.forEach(function(product) {
    var key = [product.product_id, product.product_name, product.price].join(":");
    if (seen[key]) {
      return;
    }

    seen[key] = true;
    output.push(product);
  });

  return output;
}

export function getSelectedCheckoutProducts() {
  var products = [];

  document.querySelectorAll([
    'input[name="purchase[product_id]"]:checked',
    'input[name="purchase[product_ids][]"]:checked',
    "input[data-product-name]:checked",
  ].join(",")).forEach(function(input) {
    products.push(readProductFromInput(input));
  });

  return dedupeProducts(products);
}

function isKajabiCheckoutForm(form) {
  if (!isFormElement(form)) {
    return false;
  }
  if (form.id === "new_checkout_offer") {
    return true;
  }
  if (form.classList.contains("offer-checkout-form")) {
    return true;
  }

  return Boolean(form.querySelector('[name^="checkout_offer["]'));
}

function getKajabiCheckoutProduct(form) {
  var bodyClass = document.body && document.body.className || "";
  var offerIdMatch = bodyClass.match(/offer-checkout-offer-([0-9]+)/);
  var titleElement = form.querySelector(".checkout-content-title");
  var priceElement = form.querySelector(".js-checkout-panel-price-discountable");

  return {
    product_id: offerIdMatch && offerIdMatch[1] || "",
    product_name: titleElement && titleElement.textContent.trim() || "",
    price: parseMoneyAmount(priceElement && priceElement.textContent),
    currency: "USD",
  };
}

function getCheckoutProducts(form) {
  var products = getSelectedCheckoutProducts();

  if (isKajabiCheckoutForm(form)) {
    products.push(getKajabiCheckoutProduct(form));
  }

  return dedupeProducts(products);
}

function hasPaymentFields(form) {
  if (!isFormElement(form)) {
    return false;
  }
  if (form.querySelector('input[name="purchase[payment_method_nonce]"]')) {
    return true;
  }
  if (form.querySelector('[name^="purchase["]')) {
    return true;
  }

  return false;
}

function hasStripeScript() {
  return Boolean(document.querySelector('script[src*="stripe.com"], script[src*="cf_stripe_orders"]'));
}

function isPaymentSubmission(form) {
  if (isKajabiCheckoutForm(form)) {
    return true;
  }
  if (!hasPaymentFields(form)) {
    return false;
  }
  if (getSelectedCheckoutProducts().length) {
    return true;
  }
  if (hasStripeScript()) {
    return true;
  }

  return false;
}

function buildPendingCheckoutProperties(form, submitter, trigger) {
  var submittedAt = new Date().toISOString();
  var submissionId = getFormSubmissionId(form, submittedAt);
  var products = getCheckoutProducts(form);
  var firstProduct = products[0] || {};
  var eventId = createEventId("Order Completed", submissionId);
  var formFields = getFormFieldProperties(form, submitter);

  return mergeObjects({
    order_id: submissionId,
    checkout_id: submissionId,
    checkout_submission_id: submissionId,
    event_id: eventId,
    completion_basis: "checkout_form_submission",
    is_payment_confirmed: false,
    payment_status: "submitted_unconfirmed",
    form_id: form.getAttribute("id") || "",
    form_name: form.getAttribute("name") || form.getAttribute("data-name") || "",
    form_action: form.getAttribute("action") || "",
    form_method: String(form.getAttribute("method") || "get").toUpperCase(),
    submitted_at: submittedAt,
    submit_trigger: trigger || "submit",
    products: products,
    product_id: firstProduct.product_id || "",
    product_name: firstProduct.product_name || "",
    value: firstProduct.price || null,
    currency: firstProduct.currency || "USD",
    anonymous_id: getSegmentAnonymousId(),
    page_url: window.location.href,
    page_path: window.location.pathname || "",
    page_title: document.title || "",
    extra_submitted_fields: formFields.extraFields,
  }, formFields.topLevelFields);
}

function storePendingCheckout(form, submitter, trigger) {
  var properties = buildPendingCheckoutProperties(form, submitter, trigger);

  try {
    window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(properties));
  } catch (error) {
    window.__boomClickFunnelsPendingCheckout = properties;
  }

  return properties;
}

function getPendingCheckout() {
  try {
    return JSON.parse(window.sessionStorage.getItem(PENDING_CHECKOUT_KEY) || "null");
  } catch (error) {
    return window.__boomClickFunnelsPendingCheckout || null;
  }
}

function clearPendingCheckout() {
  try {
    window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch (error) {
    window.__boomClickFunnelsPendingCheckout = null;
  }
}

function trackLeadFormSubmission(form, submitter, trigger) {
  var properties = buildFormSubmittedProperties(form, submitter, trigger);

  if (trigger !== "submit" && !hasLeadIdentity(properties)) {
    return properties;
  }

  if (!shouldTrackSubmission(properties)) {
    return properties;
  }

  runSafely(function() {
    sendTrack("Form Submitted", properties);
  });
  return properties;
}

function handleFormSubmit(event) {
  runSafely(function() {
    var form = event.target;
    var properties;
    var submitter;

    if (!isFormElement(form)) {
      return;
    }

    hydrateActiveCampaignForms();
    submitter = getSubmitter(event, form);
    identifyFromForm(form);

    if (isPaymentSubmission(form)) {
      properties = storePendingCheckout(form, submitter, "submit");
      if (shouldTrackSubmission(properties)) {
        sendTrack("Order Completed", properties);
      }
      return;
    }

    trackLeadFormSubmission(form, submitter, "submit");
  });
}

function isSubmitFormLink(element) {
  var link = element && element.closest && element.closest('a[href="#submit-form"], button, input[type="submit"]');

  if (!link) {
    return false;
  }
  if (link.matches('a[href="#submit-form"]')) {
    return true;
  }
  if (link.matches('button, input[type="submit"]')) {
    return true;
  }

  return false;
}

function findLikelySubmitForm(element) {
  var form = element && element.closest && element.closest("form");

  if (isFormElement(form)) {
    return form;
  }

  form = document.querySelector("form#cfAR");
  if (isFormElement(form)) {
    return form;
  }

  form = document.querySelector('form[action*="activehosted.com"], form[action*="proc.php"]');
  if (isFormElement(form)) {
    return form;
  }

  form = document.querySelector("form");
  if (isFormElement(form)) {
    return form;
  }

  return null;
}

function handlePotentialSubmitStart(event) {
  runSafely(function() {
    var form;

    hydrateActiveCampaignForms();

    if (!isSubmitFormLink(event.target)) {
      return;
    }

    form = findLikelySubmitForm(event.target);
    if (!form) {
      return;
    }

    if (isPaymentSubmission(form)) {
      storePendingCheckout(form, null, "click");
    }
  });
}

function handlePotentialEnterSubmit(event) {
  runSafely(function() {
    var form;

    if (event.key !== "Enter") {
      return;
    }

    hydrateActiveCampaignForms();

    form = findLikelySubmitForm(event.target);
    if (!form) {
      return;
    }

    if (isPaymentSubmission(form)) {
      storePendingCheckout(form, null, "enter_key");
    }
  });
}

export function bindFormSubmitTracking() {
  if (document.__boomClickFunnelsFormSubmitTrackingBound) {
    return;
  }

  document.__boomClickFunnelsFormSubmitTrackingBound = true;
  document.addEventListener("submit", handleFormSubmit, true);
  document.addEventListener("mousedown", handlePotentialSubmitStart, true);
  document.addEventListener("touchstart", handlePotentialSubmitStart, true);
  document.addEventListener("click", handlePotentialSubmitStart, true);
  document.addEventListener("keydown", handlePotentialEnterSubmit, true);
}
