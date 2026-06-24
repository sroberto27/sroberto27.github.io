/* ============================================================
   DTS — Treedis SDK Bridge
   ------------------------------------------------------------
   ADAPTED VERBATIM (protocol-wise) from the existing SCSU wrapper
   file js/03-tour-bridge.js. The postMessage protocol and the
   ping/ready handshake are preserved EXACTLY so this prototype
   keeps talking to the same Treedis showcase the campus wrapper
   used. Only the surrounding plumbing (config source, optional
   sync callback) was generalised so the bridge can live in a
   standalone DTS page.

   DO NOT change the message `type` strings or the ping cadence —
   they are the contract Treedis expects.

   Protocol (subset, unchanged from the wrapper):
     Outbound (us → Treedis):
       { type: "Ping" }
       { type: "Navigate", sweepId, transitionTime?, rotation? }
       { type: "RequestSweeps" }
     Inbound  (Treedis → us):
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
  _onReady: null,        // optional callback fired once on TourReady
  _onPoseChanged: null,  // optional callback(newSweepId)

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

    // Keep pinging until we get a TourReady, then stop. (Same cadence
    // as the wrapper — 2s — so a cold Treedis boot is handled.)
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
    // Validate origin when configured. Treedis posts from the same
    // origin the iframe was loaded from.
    const expected = this._origin;
    if (expected && event.origin && event.origin !== expected) return;

    const data = event.data;
    if (!data || typeof data !== "object" || !data.type) return;

    switch (data.type) {
      case "TourReady":
        this._ready = true;
        console.info("[treedis] TourReady");
        // Defer the ready callback slightly — TourReady fires when the
        // bridge is up, but the showcase SDK takes another moment to
        // act on Navigate. (Mirrors the 600ms defer in the wrapper.)
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

  /* Silent pre-warm: Navigate with transitionTime: 0 so the hidden
     iframe jumps instantly instead of animating. */
  warmSweep(sweepId) {
    if (!sweepId) return;
    this._post({ type: "Navigate", sweepId, transitionTime: 0 });
  },

  _post(cmd) {
    if (!this._iframe || !this._iframe.contentWindow) return;
    // "*" targetOrigin: the iframe src is set to the configured origin
    // and inbound messages are origin-validated above. (Same rationale
    // as the wrapper.)
    this._iframe.contentWindow.postMessage(cmd, "*");
  }
};
