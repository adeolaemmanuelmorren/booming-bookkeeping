import { track } from "./analytics-client.js";

var KAJABI_HOSTNAME = "learn.boomingbookkeeping.com";
var PURCHASE_EVENT_NAME = "Kajabi Data Layer Purchase";
var DATA_LAYER_NAMES = ["kajabiDataLayer", "dataLayer"];
var wrappedLayers = [];

function isKajabiPage() {
  return window.location.hostname.toLowerCase() === KAJABI_HOSTNAME;
}

function isArrayLike(value) {
  return value && typeof value === "object" && typeof value.length === "number";
}

function getArrayLikeValue(value, index) {
  if (!isArrayLike(value)) {
    return "";
  }

  return value[index];
}

function isPurchasePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (String(payload.event || "").toLowerCase() === "purchase") {
    return true;
  }

  return (
    String(getArrayLikeValue(payload, 0)).toLowerCase() === "event" &&
    String(getArrayLikeValue(payload, 1)).toLowerCase() === "purchase"
  );
}

function getJsonPayload(payload) {
  try {
    return JSON.stringify(payload);
  } catch (_error) {
    return "";
  }
}

function capturePurchasePayload(dataLayerName, capturePhase, payload) {
  if (!isPurchasePayload(payload)) {
    return;
  }

  track(PURCHASE_EVENT_NAME, {
    data_layer_name: dataLayerName,
    capture_phase: capturePhase,
    payload,
    payload_json: getJsonPayload(payload),
    page_url: window.location.href,
  });
}

function wasWrapped(dataLayer) {
  return wrappedLayers.indexOf(dataLayer) >= 0;
}

function wrapDataLayer(dataLayerName) {
  var dataLayer = window[dataLayerName];
  var originalPush;

  if (!Array.isArray(dataLayer)) {
    dataLayer = [];
    window[dataLayerName] = dataLayer;
  }

  if (wasWrapped(dataLayer)) {
    return;
  }

  wrappedLayers.push(dataLayer);
  dataLayer.forEach(function(payload) {
    capturePurchasePayload(dataLayerName, "existing", payload);
  });

  originalPush = dataLayer.push;
  dataLayer.push = function() {
    var payloads = Array.prototype.slice.call(arguments);
    var result = originalPush.apply(dataLayer, payloads);

    payloads.forEach(function(payload) {
      capturePurchasePayload(dataLayerName, "push", payload);
    });

    return result;
  };
}

export function listenForKajabiPurchaseDataLayerEvents() {
  if (!isKajabiPage()) {
    return false;
  }

  DATA_LAYER_NAMES.forEach(wrapDataLayer);
  return true;
}

