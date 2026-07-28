import { GA4_STANDARD_EVENT_MAP } from "./config.js";
import { getSegmentUserTraits } from "./segment-user.js";
import { copyFirstTraitValue, firstAttributionValue, getNestedObject, mergeObjects } from "./utils.js";

export function buildGoogleApiCompliantAttribution(attribution, identity) {
  attribution = attribution || {};
  identity = identity || {};

  var address = getNestedObject(identity, "address");
  var gclid = firstAttributionValue(attribution, ["gclid"]);
  var wbraid = gclid ? null : firstAttributionValue(attribution, ["wbraid"]);
  var gbraid = gclid || wbraid ? null : firstAttributionValue(attribution, ["gbraid"]);
  var canIncludeIdentity = Boolean(gclid) || (!wbraid && !gbraid);

  return {
    gclid,
    wbraid,
    gbraid,
    email: canIncludeIdentity ? firstAttributionValue(identity, ["email"]) : null,
    phone: canIncludeIdentity ? firstAttributionValue(identity, ["phone", "phone_number"]) : null,
    first_name: canIncludeIdentity ? firstAttributionValue(mergeObjects(identity, address), ["first_name", "firstName"]) : null,
    last_name: canIncludeIdentity ? firstAttributionValue(mergeObjects(identity, address), ["last_name", "lastName"]) : null,
  };
}

export function addGoogleApiCompliantAttribution(attribution, identity) {
  return mergeObjects(attribution || {}, {
    google_api_compliant: buildGoogleApiCompliantAttribution(attribution, identity),
  });
}

export function buildDataLayerTraits(properties, traits, context) {
  properties = properties || {};
  traits = traits || {};
  context = context || {};

  var contextTraits = context.traits || {};
  var segmentTraits = getSegmentUserTraits();
  var output = mergeObjects({}, traits);
  var sources = [properties, traits, contextTraits, segmentTraits];
  var addressSources = [
    properties,
    traits,
    contextTraits,
    segmentTraits,
    getNestedObject(properties, "address"),
    getNestedObject(traits, "address"),
    getNestedObject(contextTraits, "address"),
    getNestedObject(segmentTraits, "address"),
  ];

  output.address = mergeObjects({}, getNestedObject(traits, "address"));
  copyFirstTraitValue(output, sources, "email", ["email"]);
  copyFirstTraitValue(output, sources, "phone_number", ["phone_number", "phone", "mobile"]);
  copyFirstTraitValue(output.address, addressSources, "first_name", ["first_name", "firstName"]);
  copyFirstTraitValue(output.address, addressSources, "last_name", ["last_name", "lastName"]);
  copyFirstTraitValue(output.address, addressSources, "street", ["street", "address_line_1", "address1"]);
  copyFirstTraitValue(output.address, addressSources, "city", ["city"]);
  copyFirstTraitValue(output.address, addressSources, "region", ["region", "state", "province"]);
  copyFirstTraitValue(output.address, addressSources, "postal_code", ["postal_code", "postalCode", "zip"]);
  copyFirstTraitValue(output.address, addressSources, "country", ["country", "country_code", "countryCode"]);

  if (!Object.keys(output.address).length) {
    delete output.address;
  }

  return output;
}

export function transformToGA4Standard(eventName) {
  var ga4EventName = GA4_STANDARD_EVENT_MAP[eventName];
  if (!ga4EventName) {
    return null;
  }

  return { ga4_event: ga4EventName, ga4_event_type: "standard" };
}
