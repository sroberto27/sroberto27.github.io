import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ping,
  navigate,
  requestSweeps,
  readInbound,
  readPose,
  readSweeps,
  describeShape,
  MESSAGE_REJECTIONS,
  INBOUND_TYPES,
} from "../src/immersive/treedis-messages.js";
import {
  unknownCapabilities,
  observe,
  isAvailable,
  describeCapabilities,
  UNKNOWN,
} from "../src/immersive/capability.js";
import { createTreedisAdapter } from "../src/immersive/treedis-adapter.js";
import { allowedOrigins, captureAtOrigin } from "../src/immersive/origins.js";
import { readEmbeddingPolicy } from "../tools/probe-treedis.mjs";

const region = JSON.parse(
  readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url), "utf8"),
).immersive;

const ORIGIN = region.origin;

const ENTRY = {
  captureId: "CAP-001",
  locationId: "LOC-001",
  experienceId: "5eb11a1b",
  sweepId: "sebf1e31m9u7dk7twchgfz1mc",
  url: "https://spaces.dtsxr.com/tour/5eb11a1b?s=sebf1e31m9u7dk7twchgfz1mc",
};

/** A window and iframe pair with controllable timers and message delivery. */
function harness() {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  const listeners = new Map();
  const posted = [];

  const win = {
    setTimeout(fn, delay) {
      const id = nextId++;
      timers.set(id, { fn, at: time + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
  };

  const frame = {
    attributes: {},
    handlers: new Map(),
    contentWindow: {
      postMessage(message, targetOrigin) {
        posted.push({ message, targetOrigin });
      },
    },
    setAttribute(name, value) {
      frame.attributes[name] = value;
    },
    getAttribute(name) {
      return frame.attributes[name] ?? null;
    },
    addEventListener(type, fn) {
      if (!frame.handlers.has(type)) frame.handlers.set(type, new Set());
      frame.handlers.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      frame.handlers.get(type)?.delete(fn);
    },
    fire(type) {
      for (const fn of [...(frame.handlers.get(type) ?? [])]) fn({ type });
    },
  };

  return {
    win,
    frame,
    posted,
    /** Delivers a message as the viewer would. */
    send(data, origin = ORIGIN) {
      for (const fn of [...(listeners.get("message") ?? [])]) fn({ origin, data, source: frame.contentWindow });
    },
    /**
     * Runs every timer due within `ms`, in order.
     *
     * The clock steps to each timer rather than jumping to the end, because a
     * timer that reschedules itself must get its next turn at the right time.
     */
    advance(ms) {
      const until = time + ms;
      for (;;) {
        let next = null;
        for (const [id, timer] of timers) {
          if (timer.at <= until && (next === null || timer.at < next[1].at)) next = [id, timer];
        }
        if (!next) break;
        timers.delete(next[0]);
        time = Math.max(time, next[1].at);
        next[1].fn();
      }
      time = until;
    },
    pendingTimers: () => timers.size,
  };
}

// ---- Message contract ----------------------------------------------------

test("commands are built to the documented shape", () => {
  assert.deepEqual(ping(), { type: "Ping" });
  assert.deepEqual(requestSweeps(), { type: "RequestSweeps" });
  assert.deepEqual(navigate("sweep-a"), { type: "Navigate", sweepId: "sweep-a" });
  // Zero is a real transition time, used to pre-warm a target without a move.
  assert.deepEqual(navigate("sweep-a", { transitionTime: 0 }), {
    type: "Navigate",
    sweepId: "sweep-a",
    transitionTime: 0,
  });
  assert.throws(() => navigate(""), RangeError);
});

test("a message from any other origin is refused", () => {
  const event = { origin: "https://evil.example", data: { type: "TourReady" } };
  assert.equal(readInbound(event, ORIGIN).reason, MESSAGE_REJECTIONS.wrongOrigin);
  // An unconfigured origin refuses everything rather than accepting anything.
  assert.equal(readInbound({ origin: ORIGIN, data: { type: "TourReady" } }, null).ok, false);
});

test("a malformed message is classified rather than silently dropped", () => {
  const at = (data) => readInbound({ origin: ORIGIN, data }, ORIGIN);
  assert.equal(at("TourReady").reason, MESSAGE_REJECTIONS.notAnObject);
  assert.equal(at(null).reason, MESSAGE_REJECTIONS.notAnObject);
  assert.equal(at([]).reason, MESSAGE_REJECTIONS.notAnObject);
  assert.equal(at({}).reason, MESSAGE_REJECTIONS.noType);

  const unknown = at({ type: "SomethingNew", value: 1 });
  assert.equal(unknown.reason, MESSAGE_REJECTIONS.unknownType);
  // Recorded with its shape, because an undocumented type is a finding.
  assert.deepEqual(unknown.detail.shape, ["type:string", "value:number"]);
});

test("every documented inbound type is accepted", () => {
  for (const type of INBOUND_TYPES) {
    const payload = type === "PoseChanged" ? { sweep: "sweep-a", x: 0 } :
      type === "SweepsChanged" ? { sweeps: [] } : {};
    assert.equal(readInbound({ origin: ORIGIN, data: { type, ...payload } }, ORIGIN).ok, true, type);
  }
});

test("a message shape is recorded without its contents", () => {
  const shape = describeShape({ type: "PoseChanged", yawDeg: 182.5, sweepId: "private-id" });
  assert.deepEqual(shape, ["sweepId:string", "type:string", "yawDeg:number"]);
  assert.equal(shape.join().includes("private-id"), false);
  assert.equal(shape.join().includes("182.5"), false);
});

test("an absent pose field stays absent instead of becoming zero", () => {
  const pose = readPose({ type: "PoseChanged", sweepId: "sweep-a" });
  assert.deepEqual(pose.fields, ["sweepId"]);
  assert.equal("yawDeg" in pose.values, false);

  // Zero is a real bearing and must survive.
  const north = readPose({ type: "PoseChanged", yawDeg: 0, pitchDeg: 0 });
  assert.equal(north.values.yawDeg, 0);
  assert.equal(north.values.pitchDeg, 0);

  // A nonsensical field of view is not recorded as one.
  assert.equal("fovDeg" in readPose({ fovDeg: 0 }).values, false);
  assert.equal(readPose({ pose: { yawDeg: 12 } }).values.yawDeg, 12);
});

test("the pose schema the viewer actually sends is read", () => {
  // Observed live 2026-09-20 against experience 5eb11a1b: the viewer names the
  // sweep `sweep`, not `sweepId`, and reports a rotation triple rather than
  // yaw and pitch.
  const pose = readPose({
    type: "PoseChanged",
    sweep: "dkz7wtb0t8nyprc0lpn6z7bpe",
    x: 1.5,
    y: -2.25,
    z: 0.5,
    rotationX: 10,
    rotationY: 182.5,
    rotationZ: 0,
  });

  assert.equal(pose.values.sweepId, "dkz7wtb0t8nyprc0lpn6z7bpe");
  assert.deepEqual(pose.fields, ["rotationX", "rotationY", "rotationZ", "sweepId", "x", "y", "z"]);

  // The rotation triple is carried through unmapped: guessing which axis is the
  // compass bearing would restore a bookmark to a confidently wrong direction.
  assert.equal("yawDeg" in pose.values, false);
  assert.equal("pitchDeg" in pose.values, false);
  assert.match(pose.rotationConvention, /have not been established/);
  assert.equal(pose.values.rotationZ, 0, "a zero rotation component is a real value");
});

test("a sweep list is read from either shape, or reported as absent", () => {
  assert.deepEqual(readSweeps({ sweeps: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(readSweeps({ sweeps: [{ sweepId: "a" }, { id: "b" }, {}] }), ["a", "b"]);
  assert.equal(readSweeps({}), null);
});

// ---- Capability record ---------------------------------------------------

test("every capability starts unknown and never infers another", () => {
  const capabilities = unknownCapabilities();
  for (const key of ["embedding", "messaging", "ready", "poseReporting", "sweepSwitchWithoutReload"]) {
    assert.equal(capabilities[key], UNKNOWN, key);
    assert.equal(isAvailable(capabilities, key), false, `${key} must not count as available`);
  }

  // Observing one says nothing about the rest.
  const withMessaging = observe(capabilities, "messaging", true);
  assert.equal(withMessaging.messaging, true);
  assert.equal(withMessaging.poseReporting, UNKNOWN);
  assert.throws(() => observe(capabilities, "teleport", true), RangeError);
  assert.throws(() => observe(capabilities, "messaging", "yes"), RangeError);
});

test("219: an entry URL or reported pose does not establish bookmark restoration", () => {
  const described = describeCapabilities(unknownCapabilities());
  assert.equal(described.entryByUrl, "available");
  assert.equal(described.embedding, UNKNOWN);
  assert.match(described.bookmarkRestore, /not verified/);

  for (const pose of [
    { sweep: "entry-only" },
    { sweep: "raw-rotation", rotationX: 0, rotationY: 0, rotationZ: 0 },
    { sweep: "named-angles", yawDeg: 0, pitchDeg: 0, fovDeg: 60 },
  ]) {
    const parsed = readPose(pose);
    let capabilities = observe(unknownCapabilities(), "poseReporting", parsed.fields.length > 0);
    capabilities = observe(capabilities, "ready", true);
    capabilities = observe(capabilities, "sweepSwitchWithoutReload", true);
    assert.equal(describeCapabilities(capabilities).poseReporting, "available");
    assert.match(describeCapabilities(capabilities).bookmarkRestore, /not verified/);
  }
});

// ---- Adapter lifecycle ---------------------------------------------------

test("the adapter posts to the configured origin, never to a wildcard", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");

  h.advance(region.readyPingIntervalMs ?? 2000);
  assert.ok(h.posted.length > 0, "a ping must have been sent");
  for (const { targetOrigin } of h.posted) assert.equal(targetOrigin, ORIGIN);
  assert.equal(h.frame.attributes.src, new URL(ENTRY.url).origin + new URL(ENTRY.url).pathname);
});

test("a viewer that answers reaches ready and asks for its sweeps", () => {
  const h = harness();
  const events = [];
  const adapter = createTreedisAdapter({ region, win: h.win, onEvent: (e) => events.push(e.type) });

  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");
  assert.equal(adapter.state, "handshaking");

  h.send({ type: "TourReady" });
  assert.equal(adapter.state, "handshaking", "entry loading continues through the ready-settle delay");
  assert.equal(adapter.capabilities.ready, true);
  assert.equal(adapter.capabilities.messaging, true);
  assert.equal(adapter.capabilities.embedding, true);
  assert.ok(events.includes("ready"));
  assert.ok(h.posted.some((p) => p.message.type === "RequestSweeps"));
});

test("a viewer that never answers becomes unresponsive rather than hanging", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");

  h.advance(region.readyPingIntervalMs * (region.readyPingMaxAttempts + 2));

  assert.equal(adapter.state, "unresponsive");
  assert.equal(adapter.capabilities.ready, false);
  // An iframe load can be a refusal page; it does not establish embedding.
  assert.equal(adapter.capabilities.embedding, UNKNOWN);
  assert.equal(h.pendingTimers(), 0, "pinging must stop");

  const report = adapter.report();
  assert.ok(report.observations.some((o) => o.kind === "handshake-timeout"));
});

test("a frame that fails to load records embedding as refused", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("error");

  assert.equal(adapter.state, "failed");
  assert.equal(adapter.capabilities.embedding, false);
});

test("navigation is refused before the bridge answers", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");

  const result = adapter.goToSweep("another-sweep");
  assert.equal(result.ok, false);
  assert.match(result.reason, /entry URL/);
});

test("arriving at a requested sweep observes no-reload switching", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");
  h.send({ type: "TourReady" });
  h.advance(600);

  assert.equal(adapter.goToSweep("sweep-b").ok, true);
  assert.ok(h.posted.some((p) => p.message.type === "Navigate" && p.message.sweepId === "sweep-b"));

  h.send({ type: "PoseChanged", sweepId: "sweep-b", yawDeg: 12 });

  assert.equal(adapter.capabilities.sweepSwitchWithoutReload, true);
  assert.equal(adapter.capabilities.poseReporting, true);
  assert.equal(adapter.currentSweepId, "sweep-b");
  assert.equal(h.pendingTimers(), 0, "the navigation timer must be cleared");
});

test("a navigation that never arrives times out and records it as not observed", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");
  h.send({ type: "TourReady" });
  h.advance(600);
  adapter.goToSweep("sweep-b");

  h.advance(region.navigationTimeoutMs + 1);

  assert.equal(adapter.capabilities.sweepSwitchWithoutReload, false);
  assert.ok(adapter.report().observations.some((o) => o.kind === "navigation-timeout"));
});

test("a sweep list that arrives empty is recorded as unavailable, not as absent", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");
  h.send({ type: "TourReady" });

  h.send({ type: "SweepsChanged", sweeps: [] });
  assert.equal(adapter.capabilities.sweepList, false);

  h.send({ type: "SweepsChanged", sweeps: ["a", "b", "c"] });
  assert.equal(adapter.capabilities.sweepList, true);
});

test("messages from another origin never reach the capability record", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");

  h.send({ type: "TourReady" }, "https://evil.example");

  assert.notEqual(adapter.state, "ready");
  assert.equal(adapter.capabilities.messaging, UNKNOWN);
  assert.equal(adapter.report().observations.some((o) => o.kind === "message"), false);
});

test("disposing releases the listener and every timer", () => {
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  h.frame.fire("load");
  adapter.dispose();

  assert.equal(h.pendingTimers(), 0);
  assert.equal(adapter.state, "idle");
  const before = adapter.report().observations.length;
  h.send({ type: "TourReady" });
  assert.equal(adapter.report().observations.length, before, "a disposed adapter observes nothing");
});

test("the report identifies the catalog record, not just the experience", () => {
  // Test 29: six downtown records share one experience, so the report has to
  // carry the capture and location identity or the findings cannot be told
  // apart.
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);

  const report = adapter.report();
  assert.equal(report.captureId, "CAP-001");
  assert.equal(report.locationId, "LOC-001");
  assert.equal(report.experienceId, "5eb11a1b");
  assert.equal(report.sweepId, ENTRY.sweepId);
  assert.equal(typeof report.adapterCapabilityVersion, "string");
});

// ---- Embedding policy reading --------------------------------------------

test("an embedding refusal is read from either header", () => {
  const headers = (entries) => new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  const policy = (entries) => readEmbeddingPolicy({ get: (k) => headers(entries).get(k) ?? null });

  assert.equal(policy({ "X-Frame-Options": "DENY" }).allowsEmbedding, false);
  assert.equal(policy({ "X-Frame-Options": "SAMEORIGIN" }).allowsEmbedding, false);
  assert.equal(
    policy({ "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'" }).allowsEmbedding,
    false,
  );

  // A restricted list is not a refusal, and not a permission either.
  const restricted = policy({ "Content-Security-Policy": "frame-ancestors https://example.test" });
  assert.equal(restricted.allowsEmbedding, "unknown");
  assert.match(restricted.note, /browser harness settles it/);

  // No header is the weakest possible finding and says so.
  const silent = policy({});
  assert.equal(silent.allowsEmbedding, "unknown");
  assert.match(silent.note, /necessary but not sufficient/);
});

test("re-entering the same capture does not reload the viewer", () => {
  // A reload costs the whole model download and discards wherever the person
  // had walked to. The reference guards this explicitly; a different capture
  // still reloads, because it is a different place.
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });

  const first = adapter.attach(h.frame, ENTRY);
  assert.equal(first.reloaded, true);
  assert.equal(h.frame.attributes.src, new URL(ENTRY.url).origin + new URL(ENTRY.url).pathname);

  const again = adapter.attach(h.frame, ENTRY);
  assert.equal(again.reloaded, false, "the same capture must be reused");
  assert.ok(adapter.report().observations.some((o) => o.kind === "frame-reused"));

  const elsewhere = { ...ENTRY, captureId: "CAP-009", url: "https://spaces.dtsxr.com/tour/a872109b?s=other" };
  assert.equal(adapter.attach(h.frame, elsewhere).reloaded, true, "a different place reloads");
});

test("disposing releases the provider session rather than leaving it running", () => {
  // The reference keeps its iframe warm so reopening is instant. The
  // architecture requires the session to be released on leaving, because a
  // viewer left running holds a WebGL context and keeps streaming.
  const h = harness();
  const adapter = createTreedisAdapter({ region, win: h.win });
  adapter.attach(h.frame, ENTRY);
  adapter.dispose();

  assert.equal(h.frame.attributes.src, "about:blank");
});

test("a capture can be served from any configured host, and from no other", () => {
  // The provider serves the same tour from more than one host. They are
  // different browser origins, so the URL, the post target and the accepted
  // sender must move together or the bridge goes deaf.
  const capture = {
    id: "CAP-003",
    experienceId: "5eb11a1b",
    sweepId: "kmwh5gsznuu4t01eyp7urs0ha",
    url: "https://spaces.dtsxr.com/tour/5eb11a1b?s=kmwh5gsznuu4t01eyp7urs0ha&x=24.4&y=20.7",
  };

  assert.ok(allowedOrigins(region).length >= 2, "the region configures more than one host");

  const alias = allowedOrigins(region).find((o) => o !== region.origin);
  const moved = captureAtOrigin(capture, alias, region);
  assert.equal(new URL(moved.capture.url).origin, alias);
  assert.equal(moved.origin, alias);
  assert.equal(
    new URL(moved.capture.url).search,
    new URL(capture.url).search,
    "the sweep and entry orientation survive the move",
  );

  const same = captureAtOrigin(capture, region.origin, region);
  assert.equal(same.capture, capture, "the catalog URL is left alone when it already matches");

  assert.equal(
    captureAtOrigin(capture, "https://viewer.example.com", region),
    null,
    "an unconfigured host is refused rather than loaded",
  );
});
