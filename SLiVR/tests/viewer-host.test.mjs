import test from "node:test";
import assert from "node:assert/strict";

import { createViewerHost } from "../src/immersive/viewer-host.js";
import { createFakeDom } from "./fixtures/dom.mjs";

function host(options = {}) {
  const dom = createFakeDom();
  const viewer = createViewerHost({ doc: dom.document, win: dom.window, ...options });
  const label = () => viewer.element.querySelectorAll(".viewer-veil-label")[0];
  const cancel = () => viewer.element.querySelectorAll(".viewer-veil-cancel")[0];
  return { dom, viewer, label, cancel };
}

test("the frame carries the attributes the provider needs to run inside it", () => {
  // Without xr-spatial-tracking the viewer cannot enter headset mode from a
  // frame at all, and a capture opened from here would silently lose it.
  const { viewer } = host();
  assert.equal(
    viewer.frame.getAttribute("allow"),
    "xr-spatial-tracking; fullscreen; accelerometer; gyroscope; magnetometer",
  );
  assert.equal(viewer.frame.getAttribute("title"), "Captured location viewer");
  assert.equal(viewer.frame.getAttribute("src"), "about:blank", "nothing is requested until a capture is opened");
});

test("the veil covers the frame while the capture is loading and lifts once it answers", () => {
  const { viewer } = host();
  assert.equal(viewer.waiting, false, "nothing is waiting before a capture is opened");

  viewer.setAdapterState("loading");
  assert.equal(viewer.waiting, true);

  viewer.setAdapterState("handshaking");
  assert.equal(viewer.waiting, true, "the handshake is still a wait");

  viewer.setAdapterState("ready");
  assert.equal(viewer.waiting, false);
});

test("a viewer that loaded but never answered is not left behind a veil", () => {
  // The entry URL already encodes experience, sweep and orientation, so an
  // unresponsive bridge still shows the right place. Waiting gains nothing.
  const { viewer } = host();
  viewer.setAdapterState("loading");
  viewer.setAdapterState("unresponsive");
  assert.equal(viewer.waiting, false);
});

test("a long wait explains itself and then offers a way out", () => {
  let cancelled = 0;
  const { dom, viewer, label, cancel } = host({ onCancel: () => { cancelled += 1; } });

  viewer.setAdapterState("loading");
  const first = label().textContent;
  assert.match(first, /Loading/);
  assert.equal(cancel().hidden, true, "a way out is not offered while the wait is still ordinary");

  dom.advance(15000);
  assert.notEqual(label().textContent, first, "the wording changes rather than repeating");
  assert.match(label().textContent, /slower connection/);

  dom.advance(15000);
  assert.equal(cancel().hidden, false);
  cancel().click();
  assert.equal(cancelled, 1);
});

test("a fast second open does not inherit the slow wording from a slow first one", () => {
  const { dom, viewer, label, cancel } = host({ onCancel: () => {} });
  viewer.setAdapterState("loading");
  dom.advance(30000);
  assert.equal(cancel().hidden, false);

  viewer.setAdapterState("ready");
  viewer.setAdapterState("loading");
  assert.match(label().textContent, /^Loading/);
  assert.equal(cancel().hidden, true);
});

test("no escalation survives the veil being hidden", () => {
  // A timer left running would rewrite the label of a later, unrelated wait.
  const { dom, viewer, label } = host();
  viewer.setAdapterState("loading");
  viewer.setAdapterState("ready");
  const settled = label().textContent;
  dom.advance(60000);
  assert.equal(label().textContent, settled);
});

test("disposing blanks the frame so the provider session is released", () => {
  const { viewer } = host();
  viewer.frame.setAttribute("src", "https://spaces.dtsxr.com/tour/5eb11a1b");
  viewer.dispose();
  assert.equal(viewer.frame.getAttribute("src"), "about:blank");
});
