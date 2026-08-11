import { getAnonymousId } from "./analytics-client.js";
import { sendTrack } from "./analytics-track.js";
import { identifyFromProperties } from "./identity.js";
import { getTrackingHost } from "./tracking-hosts.js";

export const POLL_ON_LOAD_ROUTES = [
  "boomingbookkeeping.com/confirmation-1",
  "boomingbookkeeping.com/go-1",
  "boomingbookkeeping.com/info-2",
  "boomingbookkeeping.com/monthly-1",
  "boomingbookkeeping.com/register-2",
  "boomingbookkeeping.com/subscribe-1",
  "keyboardrichchallenge.com/vipconfirmation-1",
  "keyboardrichchallenge.com/vipsteps-1",
  "keyboardrichchallenge.com/vipsteps-2",
  "keyboardrichchallenge.com/vip-thanks-1",
  "keyboardrichchallenge.com/vip-thanks-2",
  "keyboardrichchallenge.com/vipsuccess-1",
  "keyboardrich.com/oto-1-page-1",
  "keyboardrich.com/oto-1-page-2",
  "keyboardrich.com/oto-2-page-1",
  "keyboardrich.com/receipt-1",
  "keyboardrich.com/free-2",
  "learn.boomingbookkeeping.com/library",
  "learn.boomingbookkeeping.com/welcome",
];

export const POLL_AFTER_SUBMIT_ROUTES = [
  "keyboardrich.com/yes-1",
  "keyboardrich.com/yes-2",
  "learn.boomingbookkeeping.com/offers/*/checkout",
  "learn.boomingbookkeeping.com/checkout/*",
];

var POLL_DELAYS_MS = [0, 1500, 3000, 5000, 8000, 13000, 21000];
var firedChargeIds = {};

function normalizePath(pathname) {
  var path = String(pathname || "/").replace(/\/+$/, "");
  return path || "/";
}

function routeMatches(route, hostname, pathname) {
  var slashIndex = route.indexOf("/");
  var routeHost = slashIndex < 0 ? route : route.slice(0, slashIndex);
  var routePath = slashIndex < 0 ? "/" : "/" + route.slice(slashIndex + 1);
  var escapedPattern;

  if (String(hostname || "").toLowerCase() !== routeHost) {
    return false;
  }

  escapedPattern = routePath
    .split("*")
    .map(function(part) {
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("[^/]+");

  return new RegExp("^" + escapedPattern + "$").test(normalizePath(pathname));
}

export function matchesPurchaseRoute(routes, location) {
  location = location || window.location;

  return routes.some(function(route) {
    return routeMatches(route, location.hostname, location.pathname);
  });
}

function getPurchaseEndpoint(path) {
  return "https://" + getTrackingHost() + path;
}

async function postPurchaseRequest(path, body) {
  var response = await window.fetch(getPurchaseEndpoint(path), {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("purchase_confirmation_request_failed");
  }

  return response.json();
}

function getAttemptPayload(properties) {
  return {
    anonymous_id: getAnonymousId(),
    attempt: {
      email: String(properties.email || "").trim().toLowerCase(),
      payment_method_id: String(properties.payment_method_id || "").trim(),
      submitted_at: properties.submitted_at,
    },
  };
}

function isCompleteAttempt(payload) {
  return Boolean(
    payload.anonymous_id &&
    payload.attempt.email &&
    /^pm_[A-Za-z0-9]+$/.test(payload.attempt.payment_method_id) &&
    payload.attempt.submitted_at
  );
}

function getConfirmedProducts(charge, currency, value) {
  var products = Array.isArray(charge.products) ? charge.products : [];

  if (!products.length) {
    products = [{
      product_id: charge.product_id || "",
      product_name: charge.product_name || "",
      price: value,
      quantity: 1,
    }];
  }

  return products.map(function(product) {
    var output = {
      product_id: product.product_id || "",
      product_name: product.product_name || "",
      quantity: Number(product.quantity) || 1,
      currency: currency,
    };

    if (product.price !== null && product.price !== void 0) {
      output.price = Number(product.price);
    }
    if (product.stripe_plan_id) {
      output.stripe_plan_id = product.stripe_plan_id;
    }
    if (product.stripe_price_id) {
      output.stripe_price_id = product.stripe_price_id;
    }
    if (product.stripe_product_id) {
      output.stripe_product_id = product.stripe_product_id;
    }

    return output;
  });
}

function buildOrderCompletedProperties(charge) {
  var chargeId = String(charge.charge_id || "").trim();
  var currency = String(charge.currency || "USD").toUpperCase();
  var value = Number(charge.value);
  var products = getConfirmedProducts(charge, currency, value);
  var contentIds = Array.isArray(charge.content_ids)
    ? charge.content_ids.slice()
    : products.map(function(product) {
      return product.product_id;
    }).filter(Boolean);
  var itemPrice = contentIds.length ? value / contentIds.length : value;
  var fbContents = contentIds.map(function(contentId) {
    return {
      id: contentId,
      quantity: 1,
      item_price: itemPrice,
    };
  });

  return {
    address: charge.address || {},
    event_id: "purchase_" + chargeId,
    order_id: chargeId,
    charge_id: chargeId,
    is_payment_confirmed: true,
    payment_status: "succeeded",
    completion_basis: "stripe_charge_confirmed",
    payment_source: charge.payment_source || "",
    product_id: charge.product_id || "",
    product_name: charge.product_name || "",
    content_ids: contentIds,
    fb_content_ids: contentIds,
    fb_contents: fbContents,
    products: products,
    value: value,
    total: value,
    currency: currency,
    email: charge.email || "",
    name: charge.name || "",
    phone: charge.phone || "",
  };
}

function fireConfirmedCharge(charge) {
  var chargeId = String(charge.charge_id || "").trim();
  var properties;

  if (!/^ch_[A-Za-z0-9]+$/.test(chargeId)) {
    return;
  }
  if (firedChargeIds[chargeId]) {
    return;
  }

  firedChargeIds[chargeId] = true;
  properties = buildOrderCompletedProperties(charge);
  identifyFromProperties(properties);
  sendTrack("Order Completed", properties);
}

function wait(delay) {
  return new Promise(function(resolve) {
    window.setTimeout(resolve, delay);
  });
}

export async function pollForConfirmedPurchases() {
  var anonymousId = getAnonymousId();

  if (!anonymousId) {
    return false;
  }

  for (var index = 0; index < POLL_DELAYS_MS.length; index += 1) {
    var delay = POLL_DELAYS_MS[index];
    var result;

    if (delay > 0) {
      await wait(delay);
    }

    try {
      result = await postPurchaseRequest("/v1/purchase-confirmations", {
        anonymous_id: anonymousId,
      });
    } catch (error) {
      continue;
    }

    (result.charges || []).forEach(fireConfirmedCharge);

    if ((result.charges || []).length > 0) {
      return true;
    }
    if (!result.has_pending_attempts) {
      return false;
    }
    if (result.retry_after_ms > delay) {
      await wait(result.retry_after_ms - delay);
    }
  }

  return false;
}

export async function registerPurchaseAttempt(properties) {
  var payload = getAttemptPayload(properties || {});

  if (!isCompleteAttempt(payload)) {
    return false;
  }

  try {
    await postPurchaseRequest("/v1/purchase-attempts", payload);
  } catch (error) {
    return false;
  }

  if (matchesPurchaseRoute(POLL_AFTER_SUBMIT_ROUTES)) {
    void pollForConfirmedPurchases();
  }

  return true;
}

export function startPurchaseConfirmationPolling() {
  if (!matchesPurchaseRoute(POLL_ON_LOAD_ROUTES)) {
    return false;
  }

  void pollForConfirmedPurchases();
  return true;
}
