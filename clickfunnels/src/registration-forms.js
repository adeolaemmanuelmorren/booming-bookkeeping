export const REGISTRATION_FORMS = [
  {
    activeCampaignFormIds: ["20"],
    contentName: "Keyboard Rich Challenge Registration",
    registrationType: "krc",
  },
  {
    activeCampaignFormIds: ["15"],
    contentName: "Booming Bookkeeping Webinar Registration",
    registrationType: "webinar",
  },
];

function findRegistrationFormByType(registrationType) {
  return REGISTRATION_FORMS.find(function(registrationForm) {
    return registrationForm.registrationType === registrationType;
  }) || null;
}

function findRegistrationFormByActiveCampaignId(activeCampaignFormId) {
  return REGISTRATION_FORMS.find(function(registrationForm) {
    return registrationForm.activeCampaignFormIds.indexOf(activeCampaignFormId) >= 0;
  }) || null;
}

function getHiddenFieldValue(form, fieldName) {
  var field;

  if (!form || typeof form.querySelector !== "function") {
    return "";
  }

  field = form.querySelector('input[name="' + fieldName + '"]');
  return String(field && field.value || "").trim();
}

function getFormIdValue(form) {
  var formId;
  var match;

  if (!form || typeof form.getAttribute !== "function") {
    return "";
  }

  formId = String(form.getAttribute("id") || "").trim();
  match = formId.match(/^_form_(\d+)_$/);

  return match ? match[1] : "";
}

export function getActiveCampaignFormId(form) {
  var configuredFormId;

  if (!form || typeof form.getAttribute !== "function") {
    return "";
  }

  configuredFormId = String(
    form.getAttribute("data-active-campaign-form-id") || "",
  ).trim();

  return configuredFormId
    || getHiddenFieldValue(form, "f")
    || getHiddenFieldValue(form, "u")
    || getFormIdValue(form);
}

export function getRegistrationForm(form) {
  var configuredType;
  var activeCampaignFormId;

  if (!form || typeof form.getAttribute !== "function") {
    return null;
  }

  configuredType = String(
    form.getAttribute("data-registration-type") || "",
  ).trim().toLowerCase();

  if (configuredType) {
    return findRegistrationFormByType(configuredType);
  }

  activeCampaignFormId = getActiveCampaignFormId(form);
  if (!activeCampaignFormId) {
    return null;
  }

  return findRegistrationFormByActiveCampaignId(activeCampaignFormId);
}
