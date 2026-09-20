import test from "node:test";
import assert from "node:assert/strict";

import { createStore, selectKey } from "../src/app/store.js";
import { createSaveStatus } from "../src/app/save-status.js";
import { detectCapabilities, readDiagnostics, UNKNOWN } from "../src/app/capabilities.js";
import { presentError } from "../src/app/errors.js";
import { CATALOG_ERROR_CODES } from "../src/data/catalog-repo.js";
import { TRANSFER_ERROR_CODES } from "../src/data/transfer.js";

test("state is replaced rather than mutated", () => {
  const store = createStore({ count: 1 });
  const before = store.getState();
  store.setState({ count: 2 });
  assert.equal(before.count, 1);
  assert.equal(store.getState().count, 2);
  assert.throws(() => {
    "use strict";
    store.getState().count = 9;
  }, TypeError);
});

test("a subscriber runs only when its own selection changes", () => {
  const store = createStore({ selectedId: null, mapCenter: [0, 0] });
  let calls = 0;
  store.subscribe(selectKey("selectedId"), () => {
    calls += 1;
  });

  store.setState({ mapCenter: [1, 1] });
  store.setState({ mapCenter: [2, 2] });
  assert.equal(calls, 0, "an unrelated change must not notify");

  store.setState({ selectedId: "LOC-001" });
  assert.equal(calls, 1);

  store.setState({ selectedId: "LOC-001" });
  assert.equal(calls, 1, "setting the same value again must not notify");
});

test("subscribers see the previous value alongside the new one", () => {
  const store = createStore({ mode: "explore" });
  const seen = [];
  store.subscribe(selectKey("mode"), (next, previous) => seen.push([previous, next]));
  store.setState({ mode: "projects" });
  store.setState({ mode: "shot" });
  assert.deepEqual(seen, [
    ["explore", "projects"],
    ["projects", "shot"],
  ]);
});

test("an immediate subscription renders once without a separate init path", () => {
  const store = createStore({ mode: "explore" });
  const seen = [];
  store.subscribe(selectKey("mode"), (value) => seen.push(value), { immediate: true });
  assert.deepEqual(seen, ["explore"]);
});

test("two surfaces selecting the same record do not drive each other in a loop", () => {
  // The map and the list both write the selection and both react to it. If a
  // write during notification re-entered the notifier, this would not finish.
  const store = createStore({ selectedId: null, writes: 0 });
  let mapRenders = 0;
  let listRenders = 0;

  store.subscribe(selectKey("selectedId"), (id) => {
    mapRenders += 1;
    if (id) store.setState({ selectedId: id });
  });
  store.subscribe(selectKey("selectedId"), (id) => {
    listRenders += 1;
    if (id) store.setState({ selectedId: id });
  });

  store.setState({ selectedId: "LOC-003" });

  assert.equal(mapRenders, 1);
  assert.equal(listRenders, 1);
  assert.equal(store.getState().selectedId, "LOC-003");
});

test("a state change raised during notification is applied after the pass", () => {
  const store = createStore({ step: 0, trace: [] });
  const order = [];
  store.subscribe(selectKey("step"), (step) => {
    order.push(step);
    if (step === 1) store.setState({ step: 2 });
  });
  store.setState({ step: 1 });
  assert.deepEqual(order, [1, 2]);
  assert.equal(store.getState().step, 2);
});

test("a failing subscriber does not stop the others", () => {
  const failures = [];
  const store = createStore({ value: 0 }, (error) => failures.push(error.message));
  let reached = false;
  store.subscribe(selectKey("value"), () => {
    throw new Error("view failed");
  });
  store.subscribe(selectKey("value"), () => {
    reached = true;
  });
  store.setState({ value: 1 });
  assert.deepEqual(failures, ["view failed"]);
  assert.equal(reached, true);
});

test("unsubscribing stops notifications", () => {
  const store = createStore({ value: 0 });
  let calls = 0;
  const off = store.subscribe(selectKey("value"), () => {
    calls += 1;
  });
  store.setState({ value: 1 });
  off();
  store.setState({ value: 2 });
  assert.equal(calls, 1);
  assert.equal(store.subscriberCount, 0);
});

test("save status moves through saving and saved and records when", async () => {
  const seen = [];
  const status = createSaveStatus({ onChange: (s) => seen.push(s.state), now: () => "2026-09-20T00:00:00Z" });
  const result = await status.track(async () => "written");
  assert.equal(result.ok, true);
  assert.deepEqual(seen, ["saving", "saved"]);
  assert.equal(status.status.label, "Saved locally");
  assert.equal(status.status.lastSavedAt, "2026-09-20T00:00:00Z");
});

test("a failed save stays failed, offers retry, and succeeds on retry", async () => {
  const status = createSaveStatus();
  let attempts = 0;
  const operation = async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error("quota exceeded");
      error.code = "idb-write-failed";
      throw error;
    }
    return "written";
  };

  const first = await status.track(operation);
  assert.equal(first.ok, false);
  assert.equal(status.status.state, "failed");
  assert.equal(status.status.label, "Save failed");
  assert.equal(status.status.canRetry, true);
  assert.equal(status.status.error.code, "idb-write-failed");

  const second = await status.retry();
  assert.equal(second.ok, true);
  assert.equal(status.status.state, "saved");
  assert.equal(attempts, 2);
});

test("overlapping saves report saved only when the last one finishes", async () => {
  const seen = [];
  const status = createSaveStatus({ onChange: (s) => seen.push(s.state) });
  const slow = status.track(() => new Promise((resolve) => setTimeout(() => resolve(1), 10)));
  const quick = status.track(async () => 2);
  await Promise.all([slow, quick]);
  assert.equal(seen.filter((state) => state === "saved").length, 1);
  assert.equal(status.status.state, "saved");
});

test("unconfirmed provider capabilities stay unknown rather than false", () => {
  const capabilities = detectCapabilities({ win: {} });
  assert.equal(capabilities.canvasReadback, UNKNOWN);
  assert.equal(capabilities.treedis.embedding, UNKNOWN);
  assert.equal(capabilities.treedis.poseReporting, UNKNOWN);
  // No document to test against is not evidence that WebGL is missing.
  assert.equal(capabilities.webgl, UNKNOWN);
});

test("an absent optional credential is reported as absent, never as configured", () => {
  assert.equal(detectCapabilities({ win: {} }).googleTiles, "absent");
  assert.equal(
    detectCapabilities({ win: {}, runtimeConfig: { googleMapsApiKey: "a-key" } }).googleTiles,
    "configured",
  );
  assert.equal(
    detectCapabilities({ win: {}, runtimeConfig: { googleMapsApiKey: "" } }).googleTiles,
    "absent",
  );
});

test("missing IndexedDB is detected without throwing", () => {
  assert.equal(detectCapabilities({ win: {} }).indexedDB, false);
  assert.equal(detectCapabilities({ win: { indexedDB: { open() {} } } }).indexedDB, true);
});

test("diagnostics default to off and survive unreadable storage", () => {
  assert.equal(readDiagnostics({}).forceStorageFailure, false);
  assert.equal(
    readDiagnostics({ localStorage: { getItem: () => "not json" } }).forceStorageFailure,
    false,
  );
  assert.equal(
    readDiagnostics({
      localStorage: { getItem: (key) => (key === "slivr:diagnostics" ? '{"forceStorageFailure":true}' : null) },
    }).forceStorageFailure,
    true,
  );
});

test("classified failures become explanations that say nothing was changed", () => {
  const catalog = presentError({
    code: CATALOG_ERROR_CODES.invalid,
    message: "2 errors",
    problems: [{ path: "locations[0].id", reason: "is required" }],
  });
  assert.match(catalog.title, /catalog/i);
  assert.equal(catalog.recognised, true);
  assert.ok(catalog.actions.includes("retry"));

  const transfer = presentError({ code: TRANSFER_ERROR_CODES.unsupportedVersion, message: "2.0.0" });
  assert.equal(transfer.recognised, true);
  assert.match(transfer.advice, /not imported/i);
});

test("an unrecognised failure is reported as unrecognised, with its own message", () => {
  const presented = presentError({ code: "something-new", message: "the original text" });
  assert.equal(presented.recognised, false);
  assert.equal(presented.detail, "the original text");
  assert.match(presented.advice, /not one SLiVR recognises/i);
});
