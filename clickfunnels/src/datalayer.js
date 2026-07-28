import { buildDataLayerTraits, getGA4EventConfig } from "./traits.js";

function getFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  var number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function buildGA4Item(product) {
  product = product || {};

  var itemId = String(product.product_id || "").trim();
  var itemName = String(product.product_name || "").trim();

  if (!itemId && !itemName) {
    return null;
  }

  var item = {
    quantity: getFiniteNumber(product.quantity) || 1,
  };
  var price = getFiniteNumber(product.price);

  if (itemId) {
    item.item_id = itemId;
  }
  if (itemName) {
    item.item_name = itemName;
  }
  if (price !== null) {
    item.price = price;
  }

  return item;
}

function buildGA4PurchaseItems(properties) {
  var products = Array.isArray(properties.products)
    ? properties.products
    : [];
  var items = products.map(buildGA4Item).filter(Boolean);

  if (items.length) {
    return items;
  }

  var fallbackItem = buildGA4Item({
    product_id: properties.product_id,
    product_name: properties.product_name,
    price: properties.value || properties.total,
    quantity: 1,
  });

  return fallbackItem ? [fallbackItem] : [];
}

function buildGA4Purchase(properties) {
  var transactionId = String(properties.order_id || properties.charge_id || "").trim();
  var value = getFiniteNumber(
    properties.value === undefined ? properties.total : properties.value
  );
  var currency = String(properties.currency || "").trim().toUpperCase();
  var ecommerce = {
    items: buildGA4PurchaseItems(properties),
  };

  if (transactionId) {
    ecommerce.transaction_id = transactionId;
  }
  if (value !== null) {
    ecommerce.value = value;
  }
  if (currency) {
    ecommerce.currency = currency;
  }

  return ecommerce;
}

function buildGA4Properties(properties) {
  var leadSource = String(
    properties.lead_source || properties.registration_type || ""
  ).trim();

  if (!leadSource) {
    return {};
  }

  return { lead_source: leadSource };
}

export function pushTrackToDataLayer(eventName, properties, options) {
  if (eventName === "attr") {
    return;
  }

  properties = properties || {};
  options = options || {};
  window.dataLayer = window.dataLayer || [];

  var context = options.context || {};
  var traits = context.traits || {};
  var dataLayerTraits = buildDataLayerTraits(properties, traits, context);
  var dataLayerEvent = {
    event: eventName,
    event_id: properties.event_id || dataLayerTraits.event_id || "",
    properties,
    traits: dataLayerTraits,
    context,
    segment_type: "track",
  };
  var ga4Data = getGA4EventConfig(eventName);

  if (ga4Data) {
    dataLayerEvent.ga4_event = ga4Data.ga4_event;
    dataLayerEvent.ga4_event_type = ga4Data.ga4_event_type;
  }
  if (ga4Data && ga4Data.ga4_event_type === "ecommerce") {
    dataLayerEvent.ecommerce = buildGA4Purchase(properties);
  }
  if (
    ga4Data &&
    (
      ga4Data.ga4_event_type === "standard_event" ||
      ga4Data.ga4_event_type === "custom_event"
    )
  ) {
    dataLayerEvent.ga4_properties = buildGA4Properties(properties);
  }

  window.dataLayer.push(dataLayerEvent);
}

export function pushIdentifyToDataLayer(userIdOrTraits, traitsOrOptions, maybeOptions) {
  var userId = "";
  var traits = {};
  var options = {};

  if (typeof userIdOrTraits === "string") {
    userId = userIdOrTraits;
    traits = traitsOrOptions || {};
    options = maybeOptions || {};
  } else {
    traits = userIdOrTraits || {};
    options = traitsOrOptions || {};
  }

  window.dataLayer = window.dataLayer || [];
  var context = options.context || {};
  var dataLayerTraits = buildDataLayerTraits({}, traits, context);
  window.dataLayer.push({ event: "identify", userId, traits: dataLayerTraits, context, segment_type: "identify" });
}
