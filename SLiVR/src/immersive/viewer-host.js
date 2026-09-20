/**
 * The frame the Treedis viewer is rendered into, and the veil over it.
 *
 * Separated from the adapter because the two answer different questions. The
 * adapter owns the provider conversation; this owns what the person is looking
 * at while that conversation is still going on.
 *
 * The veil is adopted from Experimental's street-view overlay
 * (`js/04-street-view.js:194-250`), including its escalation. The provider can
 * take twenty to sixty seconds to boot a model on a slow connection, and a
 * spinner that says nothing for a minute is indistinguishable from a hang, so
 * the wording changes at eight seconds and a way out appears at twenty-five.
 *
 * The iframe attributes follow Experimental/map.html:299-306, widened
 * to the set the reconnaissance harness uses. Without `xr-spatial-tracking`
 * the viewer cannot enter headset mode from inside a frame at all, and without
 * the motion sensors a phone cannot look around by being moved. The harness is
 * the only configuration in this project the viewer has been seen running in,
 * so its permissions are the ones adopted.
 */

/** Veil copy, escalating with the wait. */
const VEIL_DEFAULT = "Loading the captured location…";
const VEIL_SLOW = "Still loading. A captured model can take a moment on a slower connection.";
const SLOW_NOTICE_MS = 8000;
const CANCEL_OFFER_MS = 25000;

/**
 * @param {object} options
 * @param {Document} [options.doc]
 * @param {object} [options.win] Timer source.
 * @param {() => void} [options.onCancel] Offered once the wait becomes long.
 */
export function createViewerHost({
  doc = globalThis.document,
  win = globalThis,
  onCancel = null,
} = {}) {
  const element = doc.createElement("div");
  element.className = "viewer-host";

  function makeFrame() {
    const frame = doc.createElement("iframe");
    frame.className = "viewer-frame";
    frame.setAttribute("title", "Captured location viewer");
    frame.setAttribute("allow", "xr-spatial-tracking; fullscreen; accelerometer; gyroscope; magnetometer");
    frame.setAttribute("src", "about:blank");
    return frame;
  }
  let frame = makeFrame();

  const veil = doc.createElement("div");
  veil.className = "viewer-veil";
  veil.setAttribute("role", "status");
  veil.setAttribute("aria-live", "polite");

  const spinner = doc.createElement("span");
  spinner.className = "viewer-veil-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const label = doc.createElement("p");
  label.className = "viewer-veil-label";
  label.textContent = VEIL_DEFAULT;

  const cancel = doc.createElement("button");
  cancel.setAttribute("type", "button");
  cancel.className = "viewer-veil-cancel";
  cancel.textContent = "Stop waiting";
  cancel.hidden = true;
  cancel.addEventListener("click", () => onCancel?.());

  veil.append(spinner, label, cancel);
  element.append(frame, veil);

  let timers = [];
  let visible = false;

  function clearTimers() {
    for (const timer of timers) win.clearTimeout(timer);
    timers = [];
  }

  /**
   * Shows the veil, resetting its wording.
   *
   * A fast second open must not inherit the slow-connection copy from a slow
   * first one, so every escalation is rebuilt rather than left running.
   */
  function show() {
    visible = true;
    element.classList.add("is-waiting");
    veil.hidden = false;
    label.textContent = VEIL_DEFAULT;
    cancel.hidden = true;

    clearTimers();
    timers.push(win.setTimeout(() => { label.textContent = VEIL_SLOW; }, SLOW_NOTICE_MS));
    timers.push(win.setTimeout(() => { cancel.hidden = !onCancel; }, CANCEL_OFFER_MS));
  }

  function hide() {
    visible = false;
    element.classList.remove("is-waiting");
    veil.hidden = true;
    clearTimers();
  }

  hide();

  return {
    element,
    get frame() { return frame; },
    // Independent experiences need distinct WindowProxy identities so a queued
    // message from the previous model cannot pass the event.source check.
    renewFrame() {
      frame.setAttribute("src", "about:blank");
      frame = makeFrame();
      element.replaceChildren(frame, veil);
      return frame;
    },
    /**
     * Matches the veil to the adapter state.
     *
     * A timeout reveals the provider surface and recovery controls without
     * claiming that the viewer rendered or reached the requested sweep.
     */
    setAdapterState(state) {
      if (state === "loading" || state === "handshaking") show();
      else hide();
    },
    get waiting() {
      return visible;
    },
    dispose() {
      clearTimers();
      frame.setAttribute("src", "about:blank");
    },
  };
}
