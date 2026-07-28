const DEFAULT_BURST_WINDOW_MS = 1000;

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getProductFingerprint(properties) {
  if (!Array.isArray(properties.products)) {
    return "";
  }

  return properties.products.map(function(product) {
    return [
      normalizeValue(product.product_id),
      normalizeValue(product.product_name),
      normalizeValue(product.price),
    ].join(":");
  }).join(",");
}

export function buildSubmissionBurstFingerprint(eventName, properties) {
  properties = properties || {};

  return [
    normalizeValue(eventName),
    normalizeValue(properties.form_id),
    normalizeValue(properties.page_path),
    normalizeValue(properties.email),
    normalizeValue(properties.phone).replace(/[^0-9]+/g, ""),
    normalizeValue(properties.name),
    normalizeValue(properties.first_name),
    normalizeValue(properties.last_name),
    normalizeValue(properties.payment_intent_id),
    normalizeValue(properties.product_id),
    getProductFingerprint(properties),
  ].join("|");
}

export function createSubmissionBurstGuard(windowMs) {
  var burstWindowMs = Number(windowMs) || DEFAULT_BURST_WINDOW_MS;
  var recentSubmissionByForm = new WeakMap();

  return function shouldProcessSubmission(form, eventName, properties, observedAt) {
    var fingerprint;
    var previousSubmission;
    var observedAtMs;
    var elapsedMs;

    if (!form || (typeof form !== "object" && typeof form !== "function")) {
      return true;
    }

    observedAtMs = typeof observedAt === "number" ? observedAt : Date.now();
    fingerprint = buildSubmissionBurstFingerprint(eventName, properties);
    previousSubmission = recentSubmissionByForm.get(form);

    recentSubmissionByForm.set(form, {
      fingerprint: fingerprint,
      observedAtMs: observedAtMs,
    });

    if (!previousSubmission) {
      return true;
    }
    if (previousSubmission.fingerprint !== fingerprint) {
      return true;
    }

    elapsedMs = observedAtMs - previousSubmission.observedAtMs;
    if (elapsedMs < 0) {
      return true;
    }

    return elapsedMs > burstWindowMs;
  };
}
