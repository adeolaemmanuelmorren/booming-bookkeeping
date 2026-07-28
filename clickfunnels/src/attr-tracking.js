import { waitForAnalytics } from "./analytics-client.js";
import { sendTrack } from "./analytics-track.js";
import { getAttrEventProperties, writeLocalAttributionMirror } from "./attribution.js";
import { logClickFunnels } from "./logger.js";
import { stableStringify } from "./utils.js";

var sentAttrEventSignatures = {};

function getAttrEventSignature() {
  var properties = getAttrEventProperties();
  if (!Object.keys(properties).length) {
    return "";
  }

  return stableStringify(properties);
}

function shouldTrackAttr() {
  var signature = getAttrEventSignature();
  if (!signature) {
    return false;
  }
  if (sentAttrEventSignatures[signature]) {
    return false;
  }

  sentAttrEventSignatures[signature] = true;
  return true;
}

function trackAttr() {
  writeLocalAttributionMirror("before attr track");

  if (!shouldTrackAttr()) {
    return;
  }

  logClickFunnels("attr track sent", { properties: getAttrEventProperties() });
  sendTrack("attr", getAttrEventProperties());
}

export function scheduleAttrTracking() {
  var delays = [0, 250, 750, 1500, 3e3, 5e3, 8e3, 12e3];

  waitForAnalytics(function() {
    delays.forEach(function(delay) {
      window.setTimeout(trackAttr, delay);
    });
  });
}

export function bindAttrTrackingTriggers() {
  var trackedCookieNames = { _attr_current_js: true, _fbc: true, _fbp: true, _uetvid: true, _uetsid: true, _ttp: true, _ttclid: true, _rdt_uuid: true, msclkid: true, gclid: true, gbraid: true, wbraid: true, fbclid: true, twclid: true, ttclid: true, rdt_cid: true, li_fat_id: true };
  var focusTimeoutId = null;

  if (window.cookieStore && typeof window.cookieStore.addEventListener === "function") {
    window.cookieStore.addEventListener("change", function(event) {
      var changed = Array.prototype.slice.call(event.changed || []);
      var deleted = Array.prototype.slice.call(event.deleted || []);
      var touched = changed.concat(deleted);

      for (var i = 0; i < touched.length; i += 1) {
        if (!trackedCookieNames[touched[i].name]) {
          continue;
        }

        writeLocalAttributionMirror("tracked cookie changed: " + touched[i].name);
        trackAttr();
        return;
      }
    });
  }

  window.addEventListener("pageshow", function() {
    trackAttr();
  });
  window.addEventListener("focus", function() {
    if (focusTimeoutId) {
      return;
    }

    focusTimeoutId = window.setTimeout(function() {
      focusTimeoutId = null;
      trackAttr();
    }, 1e3);
  });
}
