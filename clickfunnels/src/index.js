import { bindAttrTrackingTriggers, scheduleAttrTracking } from "./attr-tracking.js";
import {
  createEventId,
  getAnonymousId,
  page,
  setAnonymousId,
  waitForAnalytics,
} from "./analytics-client.js";
import { getPageContext, sendIdentify, sendTrack } from "./analytics-track.js";
import {
  bindActiveCampaignNativeSubmitHydration,
  hydrateActiveCampaignForms,
  observeActiveCampaignForms,
} from "./active-campaign.js";
import { getAttrEventProperties, pingAttributionEndpoint, writeLocalAttributionMirror } from "./attribution.js";
import { CONFIG } from "./config.js";
import { getCookie, parseJsonCookie } from "./cookies.js";
import {
  bindFormSubmitTracking,
  getSelectedCheckoutProducts,
} from "./forms.js";
import { bindIdentifyInputs, observeIdentifyInputs } from "./identity.js";
import {
  pollForConfirmedPurchases,
  registerPurchaseAttempt,
  startPurchaseConfirmationPolling,
} from "./purchase-confirmation.js";
import {
  addAnonymousIdToCurrentUrl,
  bindCrossDomainLinkDecoration,
  decorateCrossDomainLinks,
  observeCrossDomainLinks,
} from "./links.js";
import { loadJitsuAnalytics } from "./jitsu-loader.js";
import { listenForKajabiPurchaseDataLayerEvents } from "./kajabi-purchase-diagnostic.js";

listenForKajabiPurchaseDataLayerEvents();
loadJitsuAnalytics();

var hasInitialized = false;

function runDelayedAfterAnalytics(callback) {
  var delays = [0, 250, 750, 1500, 3000, 5000, 8000];

  waitForAnalytics(function() {
    delays.forEach(function(delay) {
      window.setTimeout(callback, delay);
    });
  });
}

function init() {
  if (hasInitialized) {
    return;
  }

  hasInitialized = true;
  writeLocalAttributionMirror("init");
  waitForAnalytics(function(anonymousId) {
    setAnonymousId(anonymousId);
    addAnonymousIdToCurrentUrl(anonymousId);
    page();
    startPurchaseConfirmationPolling();
  });
  hydrateActiveCampaignForms();
  runDelayedAfterAnalytics(function() {
    hydrateActiveCampaignForms();
  });
  decorateCrossDomainLinks();
  runDelayedAfterAnalytics(function() {
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
  getAnonymousId,
  waitForAnalytics,
  createEventId,
  getPageContext,
  loadJitsuAnalytics,
  listenForKajabiPurchaseDataLayerEvents,
  sendTrack,
  sendIdentify,
  pingAttributionEndpoint,
  bindActiveCampaignNativeSubmitHydration,
  addAnonymousIdToCurrentUrl,
  hydrateActiveCampaignForms,
  decorateCrossDomainLinks,
  bindFormSubmitTracking,
  getSelectedCheckoutProducts,
  pollForConfirmedPurchases,
  registerPurchaseAttempt,
  startPurchaseConfirmationPolling,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
