/* test-planner/js/app-look.js
 *
 * AppLook — native app feel for the Speedesk PWA.
 * Adapted from the AppLook pattern for Speedesk's app-relative paths.
 */

/* ----------------------------------------------------------
   BASIC APP-LIKE POLISH
---------------------------------------------------------- */

// Disable Google Translate banner.
(() => {
  if (document.querySelector('meta[name="google"]')) return;
  const meta = document.createElement("meta");
  meta.name = "google";
  meta.content = "notranslate";
  document.head.appendChild(meta);
})();

// Ensure <html lang> is set.
document.documentElement.setAttribute("lang", "en");

// Disable context menu globally.
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Disable long-press & middle/shift/ctrl/meta-click on links & images.
const disableLongPress = (el) => {
  el.addEventListener("touchstart", (e) => e.preventDefault(), {
    passive: false,
  });
  el.addEventListener("click", (e) => {
    if (e.which === 2 || e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      alert("Opening in new tabs/windows is disabled.");
    }
  });
};
document.querySelectorAll("a, img").forEach(disableLongPress);

// Block pinch zoom gestures.
document.addEventListener("gesturestart", (e) => e.preventDefault());

// Register service worker at the Speedesk app-relative path.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) =>
        console.log("[AppLook] Service Worker registered:", reg.scope)
      )
      .catch((err) =>
        console.error("[AppLook] Service Worker failed:", err)
      );
  });
}

/* ----------------------------------------------------------
   SMART ORIENTATION HANDLING
---------------------------------------------------------- */
document.addEventListener("fullscreenchange", async () => {
  try {
    const fsElement = document.fullscreenElement;

    if (
      fsElement &&
      fsElement.tagName === "IFRAME" &&
      /youtube|vimeo|video/i.test(fsElement.src)
    ) {
      await screen.orientation.unlock?.();
      await screen.orientation.lock?.("landscape");
      console.log("[AppLook] Landscape mode enabled for fullscreen media");
    } else {
      await screen.orientation.lock?.("portrait");
      console.log("[AppLook] Returned to portrait mode");
    }
  } catch (err) {
    console.warn("[AppLook] Orientation handling failed:", err);
  }
});
// ── Disable zoom across browsers ──
// Desktop: block Ctrl+wheel zoom.
document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false }
);

// Mobile Chrome/Android: block pinch via touchstart.
document.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);

// iOS Safari: older API, still needed.
["gesturestart", "gesturechange", "gestureend"].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
});