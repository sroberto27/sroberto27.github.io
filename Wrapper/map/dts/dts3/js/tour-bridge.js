/* ============================================================
   Treedis SDK bridge
   ------------------------------------------------------------
   postMessage bridge between the site and the embedded Treedis
   showcase iframe.

   DO NOT change the message `type` strings or the ping cadence —
   they are the contract Treedis expects.

   Protocol (subset):
     Outbound (site → Treedis):
       { type: "Ping" }
       { type: "Navigate", sweepId, transitionTime?, rotation? }
       { type: "RequestSweeps" }
     Inbound  (Treedis → site):
       { type: "TourReady" }
       { type: "PoseChanged", ... }
       { type: "SweepsChanged", sweeps: [...] }
       { type: "TagClicked" | "TagFocused" | "TagDocked" | "TagHovered" }
   ============================================================ */
const TourBridge = {
  _iframe: null,
  _pingInterval: null,
  _ready: false,
  _currentSweepId: null,
  _origin: null,
  _defaultTransitionTime: 1500,
  _onReady: null,        // fired once on TourReady
  _onPoseChanged: null,  // fired with the new sweep id on movement

  /* opts: { origin, defaultTransitionTime, onReady, onPoseChanged } */
  initialize(iframeEl, opts = {}) {
    this._iframe = iframeEl;
    this._origin = opts.origin || null;
    if (typeof opts.defaultTransitionTime === "number") {
      this._defaultTransitionTime = opts.defaultTransitionTime;
    }
    this._onReady = opts.onReady || null;
    this._onPoseChanged = opts.onPoseChanged || null;

    window.addEventListener("message", this._onMessage.bind(this));

    // Ping every 2s until TourReady arrives (covers a cold Treedis boot).
    this._pingInterval = setInterval(() => {
      if (this._ready) {
        clearInterval(this._pingInterval);
        this._pingInterval = null;
      } else {
        this.ping();
      }
    }, 2000);
  },

  /* Re-arm the bridge after the iframe src changes to a different tour:
     clears the stale ready state and restarts the ping loop. */
  reset() {
    this._ready = false;
    this._currentSweepId = null;
    if (this._pingInterval) { clearInterval(this._pingInterval); this._pingInterval = null; }
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
    // Validate origin when configured. Treedis posts from the iframe's origin.
    const expected = this._origin;
    if (expected && event.origin && event.origin !== expected) return;

    const data = event.data;
    if (!data || typeof data !== "object" || !data.type) return;

    switch (data.type) {
      case "TourReady":
        this._ready = true;
        console.info("[treedis] TourReady");
        // Defer slightly — the showcase SDK needs a moment after
        // TourReady before it acts on Navigate.
        setTimeout(() => {
          try { if (this._onReady) this._onReady(); } catch (_) {}
        }, 600);
        break;
      case "SweepsChanged":
        console.info("[treedis] sweeps:", (data.sweeps || []).length);
        break;
      case "TagClicked":
      case "TagFocused":
      case "TagDocked":
        // Hook points for future custom tag handling.
        break;
      case "PoseChanged":
        if (data.sweep || data.sweepId) {
          const newSweepId = data.sweep || data.sweepId;
          const changed = newSweepId !== this._currentSweepId;
          this._currentSweepId = newSweepId;
          if (changed) {
            try { if (this._onPoseChanged) this._onPoseChanged(newSweepId); } catch (_) {}
          }
        }
        break;
      /* Unhandled types are silently ignored. */
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
      transitionTime: options.transitionTime ?? this._defaultTransitionTime
    };
    if (options.rotation) cmd.rotation = options.rotation;
    this._post(cmd);
  },

  requestSweeps() { this._post({ type: "RequestSweeps" }); },
  ping()          { this._post({ type: "Ping" }); },

  /* Silent pre-warm: Navigate with transitionTime 0 so a hidden
     iframe jumps instantly instead of animating. */
  warmSweep(sweepId) {
    if (!sweepId) return;
    this._post({ type: "Navigate", sweepId, transitionTime: 0 });
  },

  _post(cmd) {
    if (!this._iframe || !this._iframe.contentWindow) return;
    // "*" targetOrigin is acceptable here: the iframe src is set to the
    // configured origin and inbound messages are origin-validated above.
    this._iframe.contentWindow.postMessage(cmd, "*");
  }
};
