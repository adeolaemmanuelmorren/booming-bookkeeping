import { TRACKING_HOSTS } from "./config.js";
import { getAnonymousId } from "./analytics-client.js";
import { isRootOrSubdomain } from "./tracking-hosts.js";

var ANONYMOUS_ID_QUERY_PARAMS = ["ajs_aid", "an_aid"];

function runSafely(callback) {
  try {
    return callback();
  } catch (error) {
    return null;
  }
}

function getSupportedRoot(hostname) {
  hostname = String(hostname || "").toLowerCase();

  for (var i = 0; i < TRACKING_HOSTS.length; i += 1) {
    if (isRootOrSubdomain(hostname, TRACKING_HOSTS[i].root)) {
      return TRACKING_HOSTS[i].root;
    }
  }

  return "";
}

function getCurrentRoot() {
  return getSupportedRoot(window.location.hostname || "");
}

export function addAnonymousIdToCurrentUrl(anonymousId) {
  if (!anonymousId) {
    return false;
  }
  if (!window.history || typeof window.history.replaceState !== "function") {
    return false;
  }

  try {
    var url = new URL(window.location.href);

    if (ANONYMOUS_ID_QUERY_PARAMS.every(function(paramName) {
      return url.searchParams.get(paramName) === anonymousId;
    })) {
      return false;
    }

    ANONYMOUS_ID_QUERY_PARAMS.forEach(function(paramName) {
      url.searchParams.set(paramName, anonymousId);
    });
    window.history.replaceState(window.history.state, "", url.toString());

    return true;
  } catch (error) {
    return false;
  }
}

function shouldSkipHref(href) {
  href = String(href || "").trim().toLowerCase();

  if (!href) {
    return true;
  }
  if (href.charAt(0) === "#") {
    return true;
  }
  if (href.indexOf("mailto:") === 0) {
    return true;
  }
  if (href.indexOf("tel:") === 0) {
    return true;
  }
  if (href.indexOf("javascript:") === 0) {
    return true;
  }

  return false;
}

function getLinkUrl(link) {
  var href = link && link.getAttribute && link.getAttribute("href");

  if (shouldSkipHref(href)) {
    return null;
  }

  try {
    return new URL(href, window.location.href);
  } catch (error) {
    return null;
  }
}

function shouldDecorateUrl(url) {
  var currentRoot = getCurrentRoot();
  var destinationRoot;

  if (!currentRoot) {
    return false;
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return false;
  }

  destinationRoot = getSupportedRoot(url.hostname);
  if (!destinationRoot) {
    return false;
  }

  return destinationRoot !== currentRoot;
}

export function decorateCrossDomainLink(link) {
  var anonymousId = getAnonymousId();
  var url = getLinkUrl(link);

  if (!anonymousId) {
    return false;
  }
  if (!shouldDecorateUrl(url)) {
    return false;
  }

  ANONYMOUS_ID_QUERY_PARAMS.forEach(function(paramName) {
    url.searchParams.set(paramName, anonymousId);
  });
  link.href = url.toString();

  return true;
}

export function decorateCrossDomainLinks(root) {
  root = root || document;

  runSafely(function() {
    if (root.matches && root.matches("a[href]")) {
      decorateCrossDomainLink(root);
    }

    root.querySelectorAll("a[href]").forEach(function(link) {
      decorateCrossDomainLink(link);
    });
  });
}

function getClosestLink(element) {
  if (!element || !element.closest) {
    return null;
  }

  return element.closest("a[href]");
}

function handlePossibleLinkClick(event) {
  runSafely(function() {
    var link = getClosestLink(event.target);
    if (!link) {
      return;
    }

    decorateCrossDomainLink(link);
  });
}

function nodeIsOrContainsLink(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  if (node.matches && node.matches("a[href]")) {
    return true;
  }
  if (typeof node.querySelector !== "function") {
    return false;
  }

  return Boolean(node.querySelector("a[href]"));
}

export function observeCrossDomainLinks() {
  if (!document.body) {
    return;
  }
  if (document.__boomClickFunnelsLinkObserverBound) {
    return;
  }

  document.__boomClickFunnelsLinkObserverBound = true;

  var observer = new MutationObserver(function(mutations) {
    runSafely(function() {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (!nodeIsOrContainsLink(node)) {
            return;
          }

          decorateCrossDomainLinks(node);
        });
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

export function bindCrossDomainLinkDecoration() {
  if (document.__boomClickFunnelsLinkDecorationBound) {
    return;
  }

  document.__boomClickFunnelsLinkDecorationBound = true;

  document.addEventListener("mousedown", handlePossibleLinkClick, true);
  document.addEventListener("touchstart", handlePossibleLinkClick, true);
  document.addEventListener("click", handlePossibleLinkClick, true);
}
