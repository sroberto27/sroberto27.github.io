/**
 * Treedis viewer lifecycle, behind one adapter.
 *
 * The adapter owns the iframe, the handshake and the message contract, and it
 * emits events. It never writes application state, and it never assumes a
 * capability it has not observed.
 *
 * Queue, ready delay and arrival retries follow Experimental/js/03-tour-bridge.js
 * and 04-street-view.js. A silent bridge does not prove the capture rendered.
 *
 * Nothing is posted to `"*"`. Commands go to the configured origin, so a frame
 * that has been navigated elsewhere cannot receive them.
 */

import { ping, navigate, requestSweeps, readInbound, readPose, readSweeps } from "./treedis-messages.js";
import { unknownCapabilities, observe, ADAPTER_CAPABILITY_VERSION } from "./capability.js";

export const ADAPTER_STATES = Object.freeze([
  "idle",
  "loading",
  "handshaking",
  "ready",
  "navigating",
  "timedOut",
  "unresponsive",
  "failed",
]);

/**
 * @param {object} options
 * @param {object} options.region Region configuration `immersive` block.
 * @param {object} options.win Window-like object exposing message events and timers.
 * @param {(event: object) => void} [options.onEvent]
 * @param {() => string} [options.now]
 */
export function createTreedisAdapter({ region, win, onEvent = null, now = () => new Date().toISOString() }) {
  const origin = region.origin;
  const pingIntervalMs = region.readyPingIntervalMs ?? 2000;
  const pingMaxAttempts = region.readyPingMaxAttempts ?? 30;
  const navigationTimeoutMs = region.navigationTimeoutMs ?? 6000;
  const loadTimeoutMs = region.loadTimeoutMs ?? 60000;

  let frame = null;
  let state = "idle";
  let capabilities = unknownCapabilities();
  let pingTimer = null;
  let pingAttempts = 0;
  let navigationTimer = null;
  let frameListeners = [];
  let pendingSweepId = null;
  let currentSweepId = null;
  let entry = null;
  let generation = 0;
  let loadTimer = null;
  let settleTimer = null;
  let verifyTimer = null;
  let readyToNavigate = false;
  let pendingOptions = {};
  let navigationGeneration = 0;

  /** Everything the viewer actually did, for the reconnaissance record. */
  const observations = [];

  function record(kind, detail) {
    observations.push({ at: now(), kind, ...detail });
    emit({ type: "observation", kind, detail });
  }

  function emit(event) {
    onEvent?.({ ...event, state, capabilities });
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    emit({ type: "state" });
  }

  function post(command) {
    if (!frame?.contentWindow) return false;
    try {
      // Explicit target origin: a frame that navigated away gets nothing.
      frame.contentWindow.postMessage(command, origin);
      return true;
    } catch (cause) {
      record("post-failed", { command: command.type, message: cause.message });
      return false;
    }
  }

  function onMessage(event) {
    if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
    const result = readInbound(event, origin);
    if (!result.ok) {
      // A message from elsewhere is not evidence about this provider, so only
      // a rejected message that did come from the expected origin is recorded.
      if (result.reason !== "message-wrong-origin") {
        record("message-rejected", { reason: result.reason, detail: result.detail });
      }
      return;
    }

    capabilities = observe(capabilities, "messaging", true);
    record("message", { messageType: result.type, shape: result.shape });

    switch (result.type) {
      case "TourReady":
        if (capabilities.ready === true) return;
        stopPinging();
        clearLoadTimer();
        capabilities = observe(capabilities, "ready", true);
        capabilities = observe(capabilities, "embedding", true);
        if (!pendingSweepId) setState("ready");
        emit({ type: "ready" });
        // Ask once for the sweep list; whether it answers is a finding.
        post(requestSweeps());
        // SCSU waits for the showcase SDK to accept navigation after TourReady.
        {
          const session = generation;
          settleTimer = win.setTimeout(() => {
            settleTimer = null;
            if (session !== generation) return;
            readyToNavigate = true;
            flushPendingSweep();
          }, 600);
        }
        break;

      case "SweepsChanged": {
        const sweeps = readSweeps(result.data);
        capabilities = observe(capabilities, "sweepList", Array.isArray(sweeps) && sweeps.length > 0);
        record("sweeps", { count: sweeps?.length ?? 0 });
        emit({ type: "sweeps", sweeps });
        break;
      }

      case "PoseChanged": {
        const pose = readPose(result.data);
        capabilities = observe(capabilities, "poseReporting", pose.fields.length > 0);
        if (pose.values.sweepId) {
          const previous = currentSweepId;
          currentSweepId = pose.values.sweepId;
          if (navigationTimer !== null && pendingSweepId && currentSweepId === pendingSweepId) {
            clearNavigationTimer();
            // Arriving without a reload is the capability Phase 2 depends on.
            capabilities = observe(capabilities, "sweepSwitchWithoutReload", true);
            record("navigation-arrived", { sweepId: currentSweepId, from: previous });
            pendingSweepId = null;
            setState("ready");
            emit({ type: "navigated", sweepId: currentSweepId });
          }
        }
        emit({ type: "pose", pose });
        break;
      }

      default:
        // Tag events are recorded as observations and otherwise ignored.
        break;
    }
  }

  function startPinging() {
    if (capabilities.ready === true || pingTimer !== null) return;
    stopPinging();
    pingAttempts = 0;
    setState("handshaking");
    const session = generation;
    const tick = () => {
      if (session !== generation || capabilities.ready === true) return;
      pingAttempts += 1;
      if (pingAttempts > pingMaxAttempts) {
        stopPinging();
        // The viewer loaded but never answered. Embedding may still work.
        capabilities = observe(capabilities, "ready", false);
        capabilities = observe(capabilities, "messaging", capabilities.messaging === true);
        setState("unresponsive");
        record("handshake-timeout", { attempts: pingAttempts - 1, intervalMs: pingIntervalMs });
        emit({ type: "unresponsive" });
        return;
      }
      post(ping());
      pingTimer = win.setTimeout(tick, pingIntervalMs);
    };
    pingTimer = win.setTimeout(tick, pingIntervalMs);
  }

  function stopPinging() {
    if (pingTimer !== null) win.clearTimeout(pingTimer);
    pingTimer = null;
  }

  function clearNavigationTimer() {
    navigationGeneration++;
    if (navigationTimer !== null) win.clearTimeout(navigationTimer);
    if (verifyTimer !== null) win.clearTimeout(verifyTimer);
    navigationTimer = null;
    verifyTimer = null;
  }

  function clearLoadTimer() {
    if (loadTimer !== null) win.clearTimeout(loadTimer);
    loadTimer = null;
  }

  function entryOptions(capture) {
    const url = new URL(capture.url);
    const angle = (field, param) => capture[field] ??
      (url.searchParams.has(param) ? Number(url.searchParams.get(param)) : undefined);
    const x = angle("startX", "x");
    const y = angle("startY", "y");
    return {
      transitionTime: region.defaultTransitionTime ?? 0,
      ...(Number.isFinite(x) && Number.isFinite(y) ? { rotation: { x, y } } : {}),
    };
  }

  function flushPendingSweep() {
    if (!pendingSweepId || !readyToNavigate) return;
    clearNavigationTimer();
    const target = pendingSweepId;
    const session = generation;
    const navigation = navigationGeneration;
    let attempts = 0;
    setState("navigating");
    const attempt = () => {
      if (session !== generation || navigation !== navigationGeneration || pendingSweepId !== target) return;
      attempts++;
      post(navigate(target, pendingOptions));
      if (attempts < 4) verifyTimer = win.setTimeout(attempt, 1500);
    };
    navigationTimer = win.setTimeout(() => {
      if (session !== generation || navigation !== navigationGeneration || pendingSweepId !== target) return;
      clearNavigationTimer();
      // No arrival within the window. Recorded as not observed rather than as
      // a failure of the feature, because the viewer may simply not report it.
      capabilities = observe(capabilities, "sweepSwitchWithoutReload", false);
      record("navigation-timeout", { sweepId: pendingSweepId, timeoutMs: navigationTimeoutMs });
      pendingSweepId = null;
      setState("timedOut");
      emit({ type: "navigation-timeout", sweepId: target });
    }, navigationTimeoutMs);
    attempt();
  }

  /**
   * Attaches to an iframe that is already in the document.
   *
   * @param {object} iframeElement
   * @param {{captureId: string, locationId: string, experienceId: string, sweepId: string, url: string}} capture
   */
  function attach(iframeElement, capture) {
    if (frame === iframeElement && entry?.url === capture.url &&
        !["failed", "timedOut", "unresponsive"].includes(state)) {
      record("frame-reused", { url: capture.url });
      return { ok: true, reloaded: false };
    }
    if (frame === iframeElement && entry?.experienceId === capture.experienceId &&
        capabilities.ready === true && ["ready", "navigating"].includes(state)) {
      entry = capture;
      clearNavigationTimer();
      pendingSweepId = capture.sweepId;
      pendingOptions = entryOptions(capture);
      flushPendingSweep();
      return { ok: true, reloaded: false };
    }
    detach();
    frame = iframeElement;
    entry = capture;
    currentSweepId = null;
    capabilities = unknownCapabilities();
    readyToNavigate = false;
    pendingSweepId = capture.sweepId ?? null;
    pendingOptions = entryOptions(capture);
    observations.length = 0;
    const session = generation;
    // Experimental loads its base tour once, then applies the queued entry
    // through Navigate. Keep the supplied deep link intact for external recovery.
    const launchUrl = new URL(capture.url);
    launchUrl.search = "";
    launchUrl.hash = "";
    setState("loading");
    win.addEventListener("message", onMessage);

    const onLoad = () => {
      if (session !== generation) return;
      clearLoadTimer();
      // A load event only proves the frame navigated. Whether the document
      // inside is the viewer, or a refusal page, is not knowable from here.
      record("frame-load", { url: launchUrl.href, experienceId: capture.experienceId });
      emit({ type: "loaded" });
      startPinging();
    };

    const onError = () => {
      if (session !== generation) return;
      detach({ blank: true });
      capabilities = observe(capabilities, "embedding", false);
      setState("failed");
      record("frame-error", { url: capture.url });
      emit({ type: "failed", reason: "The experience did not load in the frame." });
    };

    // Handlers are removed on replacement and disposal; shared entries keep
    // the current frame, while independent experiences get a fresh host frame.
    frameListeners = [["load", onLoad], ["error", onError]];
    for (const [type, handler] of frameListeners) frame.addEventListener(type, handler);

    // Bound even the case where the frame emits neither load nor error.
    loadTimer = win.setTimeout(() => {
      if (session !== generation) return;
      detach({ blank: true });
      setState("timedOut");
      record("load-timeout", { timeoutMs: loadTimeoutMs });
      emit({ type: "load-timeout" });
    }, loadTimeoutMs);
    frame.setAttribute("src", launchUrl.href);
    // Match the reference: readiness polling begins when the frame is attached,
    // without depending on a delayed iframe load event.
    startPinging();
    return { ok: true, reloaded: true };
  }

  /**
   * Moves to a sweep inside the loaded experience.
   *
   * Only attempted once the bridge has answered. Before that the caller must
   * use the URL-entry fallback; provider availability still needs verification.
   */
  function goToSweep(sweepId, options = {}) {
    if (!frame || capabilities.ready !== true) {
      return { ok: false, reason: "the viewer bridge has not answered, so use the entry URL" };
    }
    navigate(sweepId, options);
    clearNavigationTimer();
    pendingSweepId = sweepId;
    pendingOptions = { transitionTime: region.defaultTransitionTime ?? 0, ...options };
    record("navigation-requested", { sweepId });
    flushPendingSweep();
    return { ok: true };
  }

  /**
   * Releases the frame, the listener and every timer.
   *
   * The frame is blanked rather than left warm. The reference keeps its iframe
   * loaded so reopening is instant, but the architecture requires the provider
   * session to be released on leaving, and a viewer left running holds a WebGL
   * context and keeps streaming.
   */
  function detach({ blank = false } = {}) {
    generation++;
    stopPinging();
    clearNavigationTimer();
    clearLoadTimer();
    if (settleTimer !== null) win.clearTimeout(settleTimer);
    settleTimer = null;
    try {
      win.removeEventListener("message", onMessage);
    } catch {
      // The window may already be gone during teardown.
    }
    for (const [type, handler] of frameListeners) {
      try {
        frame?.removeEventListener?.(type, handler);
      } catch {
        // The frame is already detached.
      }
    }
    frameListeners = [];
    try {
      if (blank) frame?.setAttribute?.("src", "about:blank");
    } catch {
      // The frame is already detached.
    }
    frame = null;
    pendingSweepId = null;
  }

  function dispose() {
    detach({ blank: true });
    setState("idle");
  }

  return {
    attach,
    goToSweep,
    dispose,
    get state() {
      return state;
    },
    get capabilities() {
      return capabilities;
    },
    get currentSweepId() {
      return currentSweepId;
    },
    get entry() {
      return entry;
    },
    /** The reconnaissance record for this entry. */
    report() {
      return {
        adapterCapabilityVersion: ADAPTER_CAPABILITY_VERSION,
        captureId: entry?.id ?? entry?.captureId ?? null,
        locationId: entry?.locationId ?? null,
        experienceId: entry?.experienceId ?? null,
        sweepId: entry?.sweepId ?? null,
        state,
        capabilities,
        observations: [...observations],
      };
    },
  };
}
