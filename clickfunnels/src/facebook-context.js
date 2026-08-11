import { normalizeProductName } from "./event-ids.js";

// Keep this aligned with:
// dataform/definitions/output/segment/segretl_repeatable_conversions.sqlx
//
// Meta already uses krc-paid-vip for campaign and ad-set optimization. The
// high-ticket rule keeps all main-Stripe mentorship purchases under one stable
// content type without grouping the Kajabi subscription into that audience.
var PURCHASE_CONTENT_TYPE_RULES = [
  {
    contentType: "krc-paid-vip",
    contentIdPatterns: [
      /^vip basic package(?:\b|$)/,
      /^keyboard rich challenge basic vip(?:\b|$)/,
      /^5-day keyboard rich challenge vip ticket(?:\b|$)/,
      /^krc - basic vip(?:\b|$)/,
    ],
  },
  {
    contentType: "bbb-high-ticket",
    paymentSource: "stripe",
    contentIdPatterns: [
      /^booming bookkeeping mentorship program(?:\b|$)/,
    ],
  },
  {
    contentType: "bbb-high-ticket",
    paymentSource: "stripe",
    value: 4997,
    contentIdPatterns: [
      /^booming bookkeeping installment$/,
    ],
  },
];

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

function ruleMatchesPurchase(rule, contentIds, properties) {
  var paymentSource = String(properties.payment_source || "").toLowerCase();

  if (rule.paymentSource && rule.paymentSource !== paymentSource) {
    return false;
  }
  if (rule.value !== void 0 && Number(properties.value) !== rule.value) {
    return false;
  }

  return contentIds.some(function(contentId) {
    return rule.contentIdPatterns.some(function(pattern) {
      return pattern.test(contentId);
    });
  });
}

function getPurchaseContentType(contentIds, properties) {
  var matchedRule = PURCHASE_CONTENT_TYPE_RULES.find(function(rule) {
    return ruleMatchesPurchase(rule, contentIds, properties);
  });

  return matchedRule ? matchedRule.contentType : "product";
}

function buildPurchaseContext(properties) {
  var contentIds = getNormalizedProductNames(properties);
  var contents = Array.isArray(properties.fb_contents)
    ? properties.fb_contents
    : [];
  var output = {
    content_ids: contentIds,
    content_name: String(properties.product_name || "").trim(),
    content_type: getPurchaseContentType(contentIds, properties),
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
