/* === Treedis SDK bridge ===
   Wraps postMessage communication with the Treedis iframe, using the
   settings under window.CAMPUS_CONFIG.treedis.

   Protocol (subset):
     Outbound: { type: "Ping" }
               { type: "Navigate", sweepId, transitionTime?, rotation? }
               { type: "RequestSweeps" }
     Inbound:  { type: "TourReady" }
               { type: "PoseChanged", ... }
               { type: "SweepsChanged", sweeps: [...] }
               { type: "TagClicked" | "TagFocused" | "TagDocked" } */
const TourBridge = {
  _iframe: null,
  _pingInterval: null,
  _ready: false,
  _currentSweepId: null,

  initialize(iframeEl) {
    this._iframe = iframeEl;
    window.addEventListener("message", this._onMessage.bind(this));

    // Ping until TourReady arrives, then stop.
    this._pingInterval = setInterval(() => {
      if (this._ready) {
        clearInterval(this._pingInterval);
        this._pingInterval = null;
      } else {
        this.ping();
      }
    }, 2000);
  },

  get isReady() { return this._ready; },

  _onMessage(event) {

    // Validate the sender origin when one is configured to block
    // cross-origin injection.
    const expected = (config.treedis && config.treedis.origin) || null;
    if (expected && event.origin && event.origin !== expected) return;

    const data = event.data;
    if (!data || typeof data !== "object" || !data.type) return;

    switch (data.type) {
      case "TourReady":
        this._ready = true;
        console.info("[treedis] TourReady");

        // Defer the flush: TourReady means the bridge is up, but the
        // showcase SDK needs another moment before it accepts Navigate.
        // Firing immediately can leave Treedis on its default sweep.
        setTimeout(() => {
          try { _flushPendingSweep(); } catch (_) {}
        }, 600);
        break;
      case "SweepsChanged":
        console.info("[treedis] sweeps:", (data.sweeps || []).length);
        break;
      // Hook points for future custom tag handling.
      case "TagClicked":
      case "TagFocused":
      case "TagDocked":

        break;
        // Track the sweep Treedis is actually on. Used to verify queued
        // Navigates landed, and to keep the wrapper UI (tour bar) in
        // sync while the user walks around inside the tour.
        case "PoseChanged":

          if (data.sweep || data.sweepId) {
            const newSweepId = data.sweep || data.sweepId;
            const changed = newSweepId !== this._currentSweepId;
            this._currentSweepId = newSweepId;

            if (changed && streetViewActive) {
              try { syncWrapperToSweep(newSweepId); } catch (_) {}
            }
          }
          break;

    }
  },

  navigateToSweep(sweepId, options = {}) {
    if (!sweepId) {
      console.warn("[treedis] navigateToSweep called without sweepId");
      return;
    }
    const cmd = {
      type: "Navigate",
      sweepId,
      transitionTime: options.transitionTime
        ?? (config.treedis && config.treedis.defaultTransitionTime)
        ?? 1500
    };
    if (options.rotation) cmd.rotation = options.rotation;
    this._post(cmd);
  },

  requestSweeps() { this._post({ type: "RequestSweeps" }); },
  ping()          { this._post({ type: "Ping" }); },

  /* Silent pre-warm: Navigate with transitionTime 0 so the hidden
     iframe jumps instantly instead of animating. */
  warmSweep(sweepId) {
    if (!sweepId) return;
    this._post({ type: "Navigate", sweepId, transitionTime: 0 });
  },

  _post(cmd) {
    if (!this._iframe || !this._iframe.contentWindow) return;

    // "*" is safe here: the iframe src is set programmatically to the
    // configured origin and inbound messages are origin-checked.
    this._iframe.contentWindow.postMessage(cmd, "*");
  }
};

