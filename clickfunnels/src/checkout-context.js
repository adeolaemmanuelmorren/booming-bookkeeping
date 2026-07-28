var CHECKOUT_CONTEXT_KEY = "boom_clickfunnels_checkout_context_v1";
var CHECKOUT_CONTEXT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function getStoredContext() {
  try {
    return JSON.parse(window.sessionStorage.getItem(CHECKOUT_CONTEXT_KEY) || "null");
  } catch (error) {
    return window.__boomClickFunnelsCheckoutContext || null;
  }
}

function removeStoredContext() {
  try {
    window.sessionStorage.removeItem(CHECKOUT_CONTEXT_KEY);
  } catch (error) {
    window.__boomClickFunnelsCheckoutContext = null;
  }
}

export function loadCheckoutContext(now) {
  var context = getStoredContext();
  var observedAt = typeof now === "number" ? now : Date.now();

  if (!context || !context.stored_at) {
    return null;
  }
  if (observedAt - context.stored_at > CHECKOUT_CONTEXT_MAX_AGE_MS) {
    removeStoredContext();
    return null;
  }

  return context;
}

export function saveCheckoutContext(properties, now) {
  var context;

  properties = properties || {};
  if (!properties.email || !properties.payment_method_id) {
    return false;
  }

  context = {
    email: properties.email,
    name: properties.name || "",
    first_name: properties.first_name || "",
    last_name: properties.last_name || "",
    phone: properties.phone || "",
    payment_method_id: properties.payment_method_id,
    stored_at: typeof now === "number" ? now : Date.now(),
  };

  try {
    window.sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    window.__boomClickFunnelsCheckoutContext = context;
  }

  return true;
}
