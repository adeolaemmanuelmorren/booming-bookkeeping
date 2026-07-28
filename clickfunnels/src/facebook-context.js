import { normalizeProductName } from "./event-ids.js";

function getNormalizedProductNames(properties) {
  var contentIds = [];
  var seen = {};
  var products = Array.isArray(properties.products) ? properties.products : [];
  var providedContentIds = Array.isArray(properties.content_ids)
    ? properties.content_ids
    : [];

  providedContentIds.forEach(function(value) {
    var contentId = normalizeProductName(value);

    if (!contentId || seen[contentId]) {
      return;
    }

    seen[contentId] = true;
    contentIds.push(contentId);
  });

  if (contentIds.length) {
    return contentIds;
  }

  products.forEach(function(product) {
    var contentId = normalizeProductName(
      product && (product.product_id || product.product_name)
    );

    if (!contentId || seen[contentId]) {
      return;
    }

    seen[contentId] = true;
    contentIds.push(contentId);
  });

  if (contentIds.length) {
    return contentIds;
  }

  var fallbackContentId = normalizeProductName(properties.product_name);

  if (!fallbackContentId) {
    return [];
  }

  return [fallbackContentId];
}

function buildPurchaseContext(properties) {
  var contentIds = getNormalizedProductNames(properties);
  var contents = Array.isArray(properties.fb_contents)
    ? properties.fb_contents
    : [];
  var output = {
    content_ids: contentIds,
    content_name: String(properties.product_name || "").trim(),
    content_type: "product",
  };

  if (contents.length) {
    output.contents = contents;
  }
  if (properties.value !== null && properties.value !== void 0) {
    output.value = properties.value;
  }
  if (properties.currency) {
    output.currency = properties.currency;
  }

  return output;
}

function buildFormContext(properties) {
  var contentName = String(
    properties.content_name ||
    properties.page_title ||
    properties.form_name ||
    "Form Submitted",
  ).trim();

  return {
    content_name: contentName,
  };
}

export function buildFacebookContext(eventName, properties) {
  properties = properties || {};

  if (eventName === "Order Completed") {
    return buildPurchaseContext(properties);
  }
  if (eventName === "Form Submitted") {
    return buildFormContext(properties);
  }

  return {};
}
