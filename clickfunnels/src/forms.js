import { ATTR_EVENT_COOKIE_FIELDS, COOKIE_FIELDS, URL_FIELDS } from "./config.js";
import { getAnonymousId } from "./analytics-client.js";
import { sendTrack } from "./analytics-track.js";
import { getConfiguredActiveCampaignFieldNames } from "./active-campaign.js";
import { loadCheckoutContext, saveCheckoutContext } from "./checkout-context.js";
import {
  createFormSubmissionEventId,
  getPacificEventDate,
} from "./event-ids.js";
import { identifyFromProperties } from "./identity.js";
import { registerPurchaseAttempt } from "./purchase-confirmation.js";
import { getActiveCampaignFormId, getRegistrationForm } from "./registration-forms.js";
import { createSubmissionBurstGuard } from "./submission-burst.js";
import { mergeObjects } from "./utils.js";

var trackedSubmissionIds = {};
var shouldProcessFormDataSubmission = createSubmissionBurstGuard(1000);

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

function isFacebookTrackingTransportForm(form) {
  var action;
  var actionUrl;

  if (!isFormElement(form)) {
    return false;
  }

  action = form.getAttribute("action") || "";
  if (!action) {
    return false;
  }

  try {
    actionUrl = new URL(action, window.location.href);
  } catch (error) {
    return false;
  }

  if (actionUrl.hostname !== "facebook.com" && actionUrl.hostname.slice(-13) !== ".facebook.com") {
    return false;
  }

  return actionUrl.pathname === "/tr" || actionUrl.pathname.indexOf("/tr/") === 0;
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
    purchase_payment_intent_id: true,
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

function captureSubmittedFormData(output, name, value) {
  name = String(name || "").trim();
  value = getFieldValue(value).trim();

  if (!name) {
    return;
  }
  if (!value) {
    return;
  }

  appendSubmittedField(output.submittedFields, name, value);
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

function getFormFieldProperties(form, submitter, submittedFormData) {
  var output = {
    topLevelFields: {},
    extraFields: {},
    submittedFields: {},
  };
  var passwordNames = getPasswordFieldNames(form);
  var trackingNames = getTrackingFieldNames();
  var formData = submittedFormData;

  if (!formData) {
    try {
      formData = submitter ? new FormData(form, submitter) : new FormData(form);
    } catch (error) {
      formData = new FormData(form);
    }
  }

  formData.forEach(function(value, name) {
    captureSubmittedFormData(output, name, value);
    addFieldToProperties(output, name, value, { passwordNames, trackingNames });
  });

  mergeVisibleClickFunnelsFieldProperties(output, form);

  return output;
}

function getFormDataString(formData, name) {
  var value;

  if (!formData || typeof formData.get !== "function") {
    return "";
  }

  value = formData.get(name);
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function getPaymentMethodId(formData) {
  var paymentMethodId = getFormDataString(formData, "purchase[stripe_customer_token]") ||
    getFormDataString(formData, "purchase[payment_method_id]") ||
    getFormDataString(formData, "checkout_offer[payment_method_id]");

  if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) {
    return "";
  }

  return paymentMethodId;
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

function buildFormSubmissionId(form, submittedAt) {
  var formId = form.getAttribute("id") || "";
  var formName = form.getAttribute("name") || form.getAttribute("data-name") || formId || "";

  return [
    getAnonymousId() || "anon",
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

function buildFormSubmittedProperties(form, submitter, trigger, submittedFormData) {
  var submittedAt = new Date().toISOString();
  var formId = form.getAttribute("id") || "";
  var formName = form.getAttribute("name") || form.getAttribute("data-name") || formId || "";
  var formAction = form.getAttribute("action") || "";
  var formMethod = String(form.getAttribute("method") || "get").toUpperCase();
  var formFields = getFormFieldProperties(form, submitter, submittedFormData);
  var registrationForm = getRegistrationForm(form);
  var registrationType = registrationForm
    ? registrationForm.registrationType
    : "general";
  var eventId = createFormSubmissionEventId({
    email: formFields.topLevelFields.email,
    registrationType: registrationType,
    submissionDate: getPacificEventDate(submittedAt),
  });

  return mergeObjects({
    active_campaign_form_id: getActiveCampaignFormId(form),
    content_name: registrationForm ? registrationForm.contentName : "",
    event_id: eventId,
    form_name: formName,
    form_id: formId,
    form_action: formAction,
    form_method: formMethod,
    lead_source: registrationForm ? registrationType : "",
    submitted_at: submittedAt,
    submit_trigger: trigger || "submit",
    extra_submitted_fields: formFields.extraFields,
    submitted_form_data: JSON.stringify(formFields.submittedFields),
    submitter_name: submitter && submitter.name || "",
    submitter_value: submitter && submitter.value || "",
    registration_type: registrationForm ? registrationType : "",
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

export function isOneClickUpsellSubmission(formData) {
  return getFormDataString(formData, "upsell") === "1";
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

function fillMissingCheckoutIdentity(fields, checkoutContext) {
  ["email", "name", "first_name", "last_name", "phone"].forEach(function(fieldName) {
    if (fields[fieldName]) {
      return;
    }
    if (!checkoutContext || !checkoutContext[fieldName]) {
      return;
    }

    fields[fieldName] = checkoutContext[fieldName];
  });
}

function buildPurchaseAttemptProperties(form, submitter, submittedFormData) {
  var submittedAt = new Date().toISOString();
  var paymentMethodId = getPaymentMethodId(submittedFormData);
  var isOneClickUpsell = isOneClickUpsellSubmission(submittedFormData);
  var checkoutContext = isOneClickUpsell ? loadCheckoutContext() : null;
  var formFields = getFormFieldProperties(form, submitter, submittedFormData);
  var properties;

  fillMissingCheckoutIdentity(formFields.topLevelFields, checkoutContext);
  if (!paymentMethodId && checkoutContext) {
    paymentMethodId = checkoutContext.payment_method_id || "";
  }

  properties = mergeObjects({
    payment_method_id: paymentMethodId,
    submitted_at: submittedAt,
    anonymous_id: getAnonymousId(),
  }, formFields.topLevelFields);

  if (!isOneClickUpsell) {
    saveCheckoutContext(properties);
  }

  return properties;
}

function handleTrackedFormData(event) {
  runSafely(function() {
    var form = event.currentTarget || event.target;
    var properties;

    if (!isFormElement(form)) {
      return;
    }
    if (isFacebookTrackingTransportForm(form)) {
      return;
    }

    if (isPaymentSubmission(form)) {
      properties = buildPurchaseAttemptProperties(form, null, event.formData);
      identifyFromProperties(properties);
      if (!shouldProcessFormDataSubmission(form, "Purchase Attempt", properties)) {
        return;
      }
      void registerPurchaseAttempt(properties);
      return;
    }

    properties = buildFormSubmittedProperties(form, null, "formdata", event.formData);
    identifyFromProperties(properties);
    if (!shouldProcessFormDataSubmission(form, "Form Submitted", properties)) {
      return;
    }
    if (shouldTrackSubmission(properties)) {
      sendTrack("Form Submitted", properties);
    }
  });
}

function bindFormDataTrackingToForm(form) {
  if (!isFormElement(form)) {
    return;
  }
  if (isFacebookTrackingTransportForm(form)) {
    return;
  }
  if (form.getAttribute("data-boom-clickfunnels-formdata-tracking")) {
    return;
  }

  // ClickFunnels and Kajabi use native form.submit() for their finalized submissions.
  form.setAttribute("data-boom-clickfunnels-formdata-tracking", "1");
  form.addEventListener("formdata", handleTrackedFormData);
}

function bindFormDataTracking(root) {
  if (isFormElement(root)) {
    bindFormDataTrackingToForm(root);
  }
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("form").forEach(function(form) {
    bindFormDataTrackingToForm(form);
  });
}

function observeForms() {
  var observer;

  if (!document.body) {
    return;
  }

  observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        bindFormDataTracking(node);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.__boomClickFunnelsFormDataObserver = observer;
}

export function bindFormSubmitTracking() {
  if (document.__boomClickFunnelsFormSubmitTrackingBound) {
    return;
  }

  document.__boomClickFunnelsFormSubmitTrackingBound = true;
  bindFormDataTracking(document);
  observeForms();
}
