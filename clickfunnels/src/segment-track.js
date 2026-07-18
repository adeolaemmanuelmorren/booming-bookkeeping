import { getAttrEventProperties } from "./attribution.js";
import { getSegmentAnonymousId, getSegmentUserTraits } from "./segment-user.js";
import { addGoogleApiCompliantAttribution, buildDataLayerTraits } from "./traits.js";
import { mergeObjects } from "./utils.js";

export function getPageContext() {
  return {
    page: {
      referrer: document.referrer || "$direct",
      title: document.title || "",
      url: window.location.href,
      path: window.location.pathname || "",
      search: window.location.search || "",
    },
    attribution: getAttrEventProperties(),
  };
}

export function sendTrack(eventName, properties, traits, context) {
  properties = mergeObjects({}, properties);
  traits = mergeObjects(getSegmentUserTraits(), traits);
  context = mergeObjects(getPageContext(), context);

  if (Object.keys(traits).length) {
    context.traits = mergeObjects(context.traits, traits);
  }

  context.attribution = addGoogleApiCompliantAttribution(
    context.attribution,
    buildDataLayerTraits(properties, traits, context),
  );

  if (window.analytics && typeof window.analytics.track === "function") {
    window.analytics.track(eventName, properties, { context, integrations: { All: true } });
  }

  return properties;
}

export function sendIdentify(userId, traits, context) {
  var anonymousId = getSegmentAnonymousId();
  var options;

  traits = mergeObjects(getSegmentUserTraits(), traits);
  context = mergeObjects(getPageContext(), context);
  options = { context };

  if (anonymousId) {
    options.anonymousId = anonymousId;
  }

  if (!window.analytics || typeof window.analytics.identify !== "function") {
    return;
  }

  if (userId) {
    window.analytics.identify(userId, traits, options);
    return;
  }

  window.analytics.identify(traits, options);
}
