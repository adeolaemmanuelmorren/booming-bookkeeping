import { bindAttrTrackingTriggers, scheduleAttrTracking } from "./attr-tracking.js";
import {
  bindActiveCampaignNativeSubmitHydration,
  hydrateActiveCampaignForms,
  observeActiveCampaignForms,
} from "./active-campaign.js";
import { getAttrEventProperties, pingAttributionEndpoint, writeLocalAttributionMirror } from "./attribution.js";
import { CONFIG } from "./config.js";
import { getCookie, parseJsonCookie } from "./cookies.js";
import { bindSegmentEmitterToDataLayer } from "./datalayer.js";
import {
  bindFormSubmitTracking,
  getSelectedCheckoutProducts,
} from "./forms.js";
import { bindIdentifyInputs, observeIdentifyInputs } from "./identity.js";
import {
  addAnonymousIdToCurrentUrl,
  bindCrossDomainLinkDecoration,
  decorateCrossDomainLinks,
  observeCrossDomainLinks,
} from "./links.js";
import { loadSegmentAnalytics } from "./segment-loader.js";
import { createEventId, getSegmentAnonymousId, waitForSegment } from "./segment-user.js";
import { getPageContext, sendIdentify, sendTrack } from "./segment-track.js";

loadSegmentAnalytics();

function runDelayedAfterSegment(callback) {
  var delays = [0, 250, 750, 1500, 3000, 5000, 8000];

  waitForSegment(function() {
    delays.forEach(function(delay) {
      window.setTimeout(callback, delay);
    });
  });
}

function init() {
  writeLocalAttributionMirror("init");
  bindSegmentEmitterToDataLayer();
  waitForSegment(function(anonymousId) {
    addAnonymousIdToCurrentUrl(anonymousId);
  });
  hydrateActiveCampaignForms();
  runDelayedAfterSegment(function() {
    hydrateActiveCampaignForms();
  });
  decorateCrossDomainLinks();
  runDelayedAfterSegment(function() {
    decorateCrossDomainLinks();
  });
  scheduleAttrTracking();
  bindAttrTrackingTriggers();
  bindActiveCampaignNativeSubmitHydration();
  bindFormSubmitTracking();
  bindCrossDomainLinkDecoration();
  bindIdentifyInputs();
  observeActiveCampaignForms();
  observeCrossDomainLinks();
  observeIdentifyInputs();
}

window.BoomClickFunnels = {
  config: CONFIG,
  getCookie,
  parseJsonCookie,
  getAttributionProperties: getAttrEventProperties,
  getSegmentAnonymousId,
  waitForSegment,
  createEventId,
  getPageContext,
  loadSegmentAnalytics,
  sendTrack,
  sendIdentify,
  bindSegmentEmitterToDataLayer,
  pingAttributionEndpoint,
  bindActiveCampaignNativeSubmitHydration,
  addAnonymousIdToCurrentUrl,
  hydrateActiveCampaignForms,
  decorateCrossDomainLinks,
  bindFormSubmitTracking,
  getSelectedCheckoutProducts,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
