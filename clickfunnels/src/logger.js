export function logClickFunnels(message, data) {
  if (!window.console || typeof window.console.log !== "function") {
    return;
  }

  window.console.log("[Boom ClickFunnels] " + message, data || {});
}
