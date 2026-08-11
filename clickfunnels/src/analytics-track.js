import { getAnonymousId, getUserTraits, identify, track } from "./analytics-client.js";
import { getAttrEventProperties } from "./attribution.js";
import { pushIdentifyToDataLayer, pushTrackToDataLayer } from "./datalayer.js";
import { buildFacebookContext } from "./facebook-context.js";
import { normalizePhoneTraits } from "./phone.js";
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
  var facebookContext;
  var options;

  properties = normalizePhoneTraits(properties);
  traits = normalizePhoneTraits(mergeObjects(getUserTraits(), traits));
  context = mergeObjects(getPageContext(), context);
  facebookContext = buildFacebookContext(eventName, properties);

  if (Object.keys(facebookContext).length) {
    context.fb = mergeObjects(facebookContext, context.fb);
  }

  if (Object.keys(traits).length) {
    context.traits = normalizePhoneTraits(mergeObjects(context.traits, traits));
  }

  context.attribution = addGoogleApiCompliantAttribution(
    context.attribution,
    buildDataLayerTraits(properties, traits, context),
  );

  options = { context };
  pushTrackToDataLayer(eventName, properties, options);
  track(eventName, properties, options);

  return properties;
}

export function sendIdentify(userId, traits, context) {
  var anonymousId = getAnonymousId();
  var options;

  traits = normalizePhoneTraits(mergeObjects(getUserTraits(), traits));
  context = mergeObjects(getPageContext(), context);
  options = { context };

  if (anonymousId) {
    options.anonymousId = anonymousId;
  }

  pushIdentifyToDataLayer(userId || traits, userId ? traits : options, userId ? options : void 0);
  identify(userId, traits, options);
}
