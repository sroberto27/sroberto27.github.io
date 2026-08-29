/* === LSU Death Valley Experience — Part 22: Service worker control ===
   Registers, updates and — importantly — removes ./sw.js.

   SHIPPED SWITCHED OFF. `config.gameday.enableServiceWorker` defaults to
   false, so nothing is installed for any visitor until someone
   deliberately turns it on. The reason is not doubt about the worker: it
   is that a service worker's failure mode is pinning a broken build onto
   a real device where a normal reload will not clear it, and this app
   still has two feature areas (geolocation, Live Visit Mode) that have
   never been exercised in a browser. Putting a cache layer over untested
   code makes somebody else's bug much harder to diagnose.

   THE KILL SWITCH MATTERS MORE THAN THE FEATURE. Three ways out, in
   increasing order of desperation:

     1. Set enableServiceWorker back to false and deploy. On their next
        visit, the block below unregisters the worker and deletes its
        caches. This is the normal path and needs no user action.

     2. Send someone the app URL with `?sw=off`. Unregisters immediately,
        no deploy required. This is the one to use when a bad build is
        already live and someone is stuck on it.

     3. DevTools → Application → Service Workers → Unregister.

   Path 1 works only if the visitor can still load index.html — which is
   why sw.js keeps navigations network-first. A stale shell can never
   pin someone to a build that has no way to update itself.
   ================================================================ */

(function initServiceWorkerControl() {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  const cfg = (window.CAMPUS_CONFIG && window.CAMPUS_CONFIG.gameday) || {};

  /* Explicit opt-out always wins, whatever the config says. Checked
     before anything else so a stuck device can always be rescued. */
  let forcedOff = false;
  try {
    forcedOff = new URLSearchParams(location.search).get("sw") === "off";
  } catch (_) { /* URLSearchParams is universally available; belt and braces */ }

  const wanted = cfg.enableServiceWorker === true && !forcedOff;

  /* ---------------- Removal path ---------------- */

  if (!wanted) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => {
        if (!regs.length) return;

        console.info("[sw] service worker disabled — removing", regs.length,
                     "registration(s)");

        return Promise.all(regs.map((reg) => {
          // Ask the worker to clear its own caches first; it knows which
          // ones are its own and must not delete another app's.
          if (reg.active) {
            try { reg.active.postMessage({ type: "UNREGISTER" }); } catch (_) {}
          }
          return reg.unregister();
        })).then(() => {
          if (typeof track === "function") {
            track("mode_exited", { mode: "service_worker", reason: forcedOff ? "sw_off_param" : "disabled" });
          }
          // A page loaded THROUGH the old worker is still being served by
          // it. One reload lands on the real network.
          if (navigator.serviceWorker.controller) location.reload();
        });
      })
      .catch((err) => console.warn("[sw] removal failed:", err));
    return;
  }

  /* ---------------- Registration path ---------------- */

  /* Registered after load rather than during it. The worker's install
     step precaches ~45 files, and doing that while the map, data and
     imagery are still being fetched would have it competing with the
     very first paint it is meant to protect. */
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then((reg) => {
        console.info("[sw] registered, scope:", reg.scope);
        if (typeof track === "function") {
          track("mode_entered", { mode: "service_worker", scope: reg.scope });
        }

        // Check for a new deploy when the tab regains focus — relevant
        // for a kiosk display left running for days, which would
        // otherwise never look for an update.
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      })
      .catch((err) => {
        // Registration failing is not fatal: the app works exactly as it
        // did before service workers existed.
        console.warn("[sw] registration failed:", err);
        if (typeof track === "function") {
          track("error", { where: "service_worker", message: String(err && err.message || err) });
        }
      });
  });
})();
