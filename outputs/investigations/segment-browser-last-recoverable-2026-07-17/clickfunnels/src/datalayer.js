import { buildDataLayerTraits, transformToGA4Standard } from "./traits.js";

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
  var ga4Data = transformToGA4Standard(eventName);

  if (ga4Data) {
    dataLayerEvent.ga4_event = ga4Data.ga4_event;
    dataLayerEvent.ga4_event_type = ga4Data.ga4_event_type;
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

export function bindSegmentEmitterToDataLayer() {
  if (!window.analytics || typeof window.analytics.on !== "function") {
    return;
  }
  if (window.analytics.__boomClickFunnelsEmitterBridgeBound) {
    return;
  }

  window.analytics.__boomClickFunnelsEmitterBridgeBound = true;
  window.analytics.on("track", function(eventName, properties, options) {
    pushTrackToDataLayer(eventName, properties, options);
  });
  window.analytics.on("identify", function(userIdOrTraits, traitsOrOptions, maybeOptions) {
    pushIdentifyToDataLayer(userIdOrTraits, traitsOrOptions, maybeOptions);
  });
}
