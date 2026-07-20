/* === Street view controller ===
   Thin UI layer over TourBridge:
     - preloads the iframe in the background at boot
     - shows/hides the overlay panel and its loading veil
     - keeps the caption in sync with the active location
     - bridges UI actions (Explore CTA, explorable list, tour arrows,
       locations list) into Navigate calls */

/* Start loading the Treedis tour in the hidden iframe. The src is set
   only once, so reopening the overlay never reloads the tour. */
function preloadTreedisIframe() {
  if (!el.tourFrame) return;
  const url = config.treedis && config.treedis.tourUrl;
  if (!url) {
    console.warn("[treedis] no tourUrl configured — iframe will stay blank");
    return;
  }

  if (el.tourFrame.src && el.tourFrame.src !== "about:blank") return;
  el.tourFrame.src = url;
  TourBridge.initialize(el.tourFrame);
}

function setStreetViewCaption(title, sub) {
  if (el.streetviewTitle) el.streetviewTitle.textContent = title || "—";
  if (el.streetviewSub)   el.streetviewSub.textContent   = sub || "";
}

/* Map a PoseChanged sweep id back to its location and update the tour
   bar, so the wrapper UI follows the user as they move inside Treedis.
   Sub-locations (rooms, floors) resolve to their parent via parentName,
   since sub-locations are not tour stops themselves. */
function syncWrapperToSweep(sweepId) {
  if (!sweepId || !config.treedisMap) return;

  let matchedKey = null;
  let matchedEntry = null;
  for (const [key, entry] of Object.entries(config.treedisMap)) {
    if (entry && entry.sweepId === sweepId) {
      matchedKey = key;
      matchedEntry = entry;
      break;
    }
  }
  // Unknown sweep — nothing to sync.
  if (!matchedEntry) return;

  const targetName = (matchedEntry.parentName || matchedKey).toLowerCase();

  const newIndex = tourStops.findIndex(
    (s) => cleanName(s.feature.properties.name).toLowerCase() === targetName
  );
  if (newIndex < 0 || newIndex === tourIndex) return;

  tourIndex = newIndex;
  updateTourbar();
}

/* Open the street view overlay at the given sweep. `title` / `sub`
   populate the caption pill. `options.rotation` ({x, y} degrees) and
   `options.transitionTime` (ms) are forwarded to navigateToSweep.

   Two paths:
     - Treedis ready: fire Navigate immediately.
     - Not ready: show the loading veil and queue the sweep in
       pendingSweep; _flushPendingSweep() finishes on TourReady. */
function openStreetView(sweepId, title, sub, options) {
  // With no sweep id, still open the overlay (without a targeted
  // Navigate) so placeholder entries don't feel broken.
  if (!sweepId) {
    console.warn("[streetview] open request ignored — no sweep id for", title);

  }

  const navOpts = {
    rotation:       (options && options.rotation)       || null,
    transitionTime: (options && options.transitionTime) || null
  };

  // Cancel any in-flight warm-up so it can't override this Navigate.
  warmupCancelled = true;

  streetViewActive = true;
  if (el.streetview) {
    el.streetview.setAttribute("aria-hidden", "false");
    el.streetview.classList.add("is-open");
  }
  document.body.classList.add("streetview-open");

  setStreetViewCaption(title, sub);

  if (sweepId) {
    if (TourBridge.isReady) {

      TourBridge.navigateToSweep(sweepId, _buildNavOptions(navOpts));
      lastStreetViewSweepId = sweepId;
      _hideStreetViewLoading();
      pendingSweep = null;
    } else {

      console.info("[streetview] queueing sweep until TourReady:", sweepId);
      pendingSweep = {
        sweepId, title, sub,
        rotation:       navOpts.rotation,
        transitionTime: navOpts.transitionTime
      };
      _showStreetViewLoading();
    }
  } else {

    _hideStreetViewLoading();
    pendingSweep = null;
  }

  // Re-arm the mobile "tap to interact" guard on every open so the
  // first deliberate tap activates 3D interaction.
  if (isTouchDevice() && el.streetviewTouchGuard) {
    el.streetviewTouchGuard.classList.add("is-active");
  }

  // On mobile, tuck the details sheet away so it doesn't cover the 3D
  // scene. The selection is preserved to keep the caption and tour bar
  // in sync; any open drawer is closed too.
  if (isMobile() && el.details && el.details.classList.contains("is-open")) {

    el.details.classList.add("is-hidden");
    el.details.classList.remove("is-full");
    el.shell.classList.remove("details-full");

    if (drawerOpen) closeMobileLocations({ silent: true });
  }
}

/* Build the navigateToSweep options object, omitting nulls so the
   bridge's own defaults (e.g. defaultTransitionTime) apply. */
function _buildNavOptions(navOpts) {
  const out = {};
  if (navOpts && navOpts.rotation)       out.rotation       = navOpts.rotation;
  if (navOpts && navOpts.transitionTime) out.transitionTime = navOpts.transitionTime;
  return out;
}

/* Close the overlay. Drops any queued sweep so it can't fire after the
   user has moved on, and hides the loading veil. */
function closeStreetView() {
  streetViewActive = false;
  if (el.streetview) {
    el.streetview.setAttribute("aria-hidden", "true");
    el.streetview.classList.remove("is-open");
  }
  document.body.classList.remove("streetview-open");

  pendingSweep = null;
  _hideStreetViewLoading();
}

/* Loading veil over the iframe while Treedis boots. On slow connections
   Treedis can take 20–60s, so the messaging escalates on timers:
     t=0s  default label
     t=15s slow-connection note
     t=30s reveal a Cancel button
   Timers are cleared whenever the veil hides. */
const STREETVIEW_LOADING_DEFAULT = "Loading street view…";
const STREETVIEW_LOADING_SLOW =
  "Loading 3D tour — this can take a moment on slower connections.";
let _streetviewLoadingTimers = [];

function _clearStreetViewLoadingTimers() {
  _streetviewLoadingTimers.forEach((t) => clearTimeout(t));
  _streetviewLoadingTimers = [];
}

function _showStreetViewLoading() {
  if (!el.streetviewLoading) return;

  el.streetviewLoading.classList.add("is-active");
  el.streetviewLoading.setAttribute("aria-hidden", "false");

  // Reset to the initial state on every show so a fast reopen doesn't
  // inherit the slow-connection copy.
  if (el.streetviewLoadingLabel) {
    el.streetviewLoadingLabel.textContent = STREETVIEW_LOADING_DEFAULT;
  }
  if (el.streetviewLoadingCancel) {
    el.streetviewLoadingCancel.hidden = true;
  }

  _clearStreetViewLoadingTimers();

  _streetviewLoadingTimers.push(setTimeout(() => {
    if (el.streetviewLoadingLabel) {
      el.streetviewLoadingLabel.textContent = STREETVIEW_LOADING_SLOW;
    }
  }, 15000));

  _streetviewLoadingTimers.push(setTimeout(() => {
    if (el.streetviewLoadingCancel) {
      el.streetviewLoadingCancel.hidden = false;
    }
  }, 30000));
}

function _hideStreetViewLoading() {
  _clearStreetViewLoadingTimers();
  if (el.streetviewLoading) {
    el.streetviewLoading.classList.remove("is-active");
    el.streetviewLoading.setAttribute("aria-hidden", "true");
  }
  if (el.streetviewLoadingCancel) {
    el.streetviewLoadingCancel.hidden = true;
  }
  if (el.streetviewLoadingLabel) {
    el.streetviewLoadingLabel.textContent = STREETVIEW_LOADING_DEFAULT;
  }
}

/* Runs after TourReady. Fires the queued Navigate, then watches
   PoseChanged to confirm Treedis landed on the requested sweep,
   re-sending up to maxAttempts times before giving up gracefully. */
function _flushPendingSweep() {
  if (!pendingSweep) {
    if (streetViewActive) _hideStreetViewLoading();
    return;
  }

  const targetSweepId = pendingSweep.sweepId;
  const verifyMs = 1500;
  const maxAttempts = 4;
  let attempt = 0;

  // Each attempt bails if the panel closed or a different sweep was
  // queued since it was scheduled.
  const tryNavigate = () => {

    if (!streetViewActive) return;
    if (!pendingSweep || pendingSweep.sweepId !== targetSweepId) return;

    attempt += 1;
    console.info(
      `[streetview] firing queued Navigate (attempt ${attempt}/${maxAttempts}):`,
      targetSweepId
    );

    TourBridge.navigateToSweep(targetSweepId, _buildNavOptions({
      rotation:       pendingSweep && pendingSweep.rotation,
      transitionTime: pendingSweep && pendingSweep.transitionTime
    }));
    lastStreetViewSweepId = targetSweepId;

    setTimeout(() => {

      if (!streetViewActive) return;
      if (!pendingSweep || pendingSweep.sweepId !== targetSweepId) return;

      if (TourBridge._currentSweepId === targetSweepId) {
        console.info("[streetview] Navigate confirmed via PoseChanged");
        pendingSweep = null;
        _hideStreetViewLoading();
        return;
      }

      if (attempt < maxAttempts) {
        console.warn(
          "[streetview] no PoseChanged for target sweep yet — retrying. " +
          "Treedis says it is on:", TourBridge._currentSweepId
        );
        tryNavigate();
      } else {

        console.warn(
          "[streetview] giving up after " + maxAttempts + " Navigate attempts. " +
          "Showing the panel anyway."
        );
        pendingSweep = null;
        _hideStreetViewLoading();
      }
    }, verifyMs);
  };

  tryNavigate();
}

function isTouchDevice() {
  return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
}

/* Navigate the open street view to the location behind `layer`. No-op
   when the panel is closed. If Treedis isn't ready yet, the target is
   queued instead of fired. Locations without a mapping still get a
   caption update as feedback. */
function navigateStreetViewToLayer(layer) {
  if (!streetViewActive || !layer || !layer.feature) return;
  const name = cleanName(layer.feature.properties && layer.feature.properties.name);
  if (!name) return;

  const entry = getTreedisEntry(name);
  if (!entry || !entry.sweepId) {

    setStreetViewCaption(name, getCategory(name));
    return;
  }

  setStreetViewCaption(name, getCategory(name));

  if (!TourBridge.isReady) {

    pendingSweep = {
      sweepId: entry.sweepId,
      title: name,
      sub: getCategory(name),
      rotation:       entry.rotation       || null,
      transitionTime: entry.transitionTime || null
    };
    _showStreetViewLoading();
    return;
  }

  if (entry.sweepId !== lastStreetViewSweepId) {

    TourBridge.navigateToSweep(entry.sweepId, _buildNavOptions({
      rotation:       entry.rotation,
      transitionTime: entry.transitionTime
    }));
    lastStreetViewSweepId = entry.sweepId;
  }
}

/* Open street view at a sub-location from the "Explorable Locations"
   list, keeping the caption anchored to the parent building. Opens even
   when the sweep is a placeholder so the user still sees the parent's
   current view. */
function openSubLocationInStreetView(parentName, subLocationName) {
  const entry = getTreedisEntry(subLocationName);
  const sweepId = entry && entry.sweepId;
  const displayParent = parentName || (entry && entry.parentName) || "";
  const caption = displayParent
    ? `${displayParent} — ${subLocationName}`
    : subLocationName;

  if (!sweepId) {
    console.warn(
      `[streetview] no sweep configured for "${subLocationName}" — ` +
      `open config.treedisMap to add one`
    );
  }

  openStreetView(
    sweepId,
    displayParent || subLocationName,
    subLocationName,
    {
      rotation:       (entry && entry.rotation)       || null,
      transitionTime: (entry && entry.transitionTime) || null
    }
  );
  setStreetViewCaption(displayParent || subLocationName, subLocationName);
}
