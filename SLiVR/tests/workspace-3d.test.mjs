import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  cameraBasis,
  frustumCorners,
  buildSpikeScene,
  isWithinFrustum,
  distanceM,
  enuToThree,
  buildThreeScene,
} from "../src/shot-workspace/three-bridge.js";
import {
  initialTilesStatus,
  probeTiles,
  availableBackgrounds,
  chooseBackground,
  redactCredentials,
  TILES_STATES,
} from "../src/shot-workspace/background.js";
import { fieldOfView } from "../src/spatial/optics.js";
import { metresToFeet } from "../src/spatial/units.js";

const region = JSON.parse(
  readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url), "utf8"),
);

const FULL_FRAME = { gateWidthMm: 36.0, gateHeightMm: 24.0, focalLengthMm: 50 };
const near = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

// ---- Test 27: transforms, heights, units and optics ----------------------

test("zero heading points at scene north and zero rotation is the identity", () => {
  const basis = cameraBasis({ headingDeg: 0, pitchDeg: 0 });
  assert.ok(near(basis.forward[0], 0), `east component ${basis.forward[0]}`);
  assert.ok(near(basis.forward[1], 1), `north component ${basis.forward[1]}`);
  assert.ok(near(basis.forward[2], 0), `up component ${basis.forward[2]}`);
  assert.ok(near(basis.right[0], 1));
  assert.ok(near(basis.up[2], 1));
});

test("heading follows a compass, clockwise from north", () => {
  assert.ok(near(cameraBasis({ headingDeg: 90 }).forward[0], 1), "90° is east");
  assert.ok(near(cameraBasis({ headingDeg: 180 }).forward[1], -1), "180° is south");
  assert.ok(near(cameraBasis({ headingDeg: 270 }).forward[0], -1), "270° is west");
});

test("the basis stays orthonormal at an arbitrary orientation", () => {
  const { forward, right, up } = cameraBasis({ headingDeg: 37.5, pitchDeg: -12.25 });
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const length = (v) => Math.hypot(...v);

  for (const [name, vector] of [["forward", forward], ["right", right], ["up", up]]) {
    assert.ok(near(length(vector), 1, 1e-12), `${name} length ${length(vector)}`);
  }
  assert.ok(near(dot(forward, right), 0, 1e-12));
  assert.ok(near(dot(forward, up), 0, 1e-12));
  assert.ok(near(dot(right, up), 0, 1e-12));
});

test("pitch raises the view without moving it off its bearing", () => {
  const level = cameraBasis({ headingDeg: 0, pitchDeg: 0 });
  const raised = cameraBasis({ headingDeg: 0, pitchDeg: 30 });
  assert.ok(raised.forward[2] > level.forward[2], "a positive pitch looks upward");
  assert.ok(near(raised.forward[2], Math.sin(Math.PI / 6), 1e-12));
  // Right stays level whatever the pitch, so the horizon does not roll.
  assert.ok(near(raised.right[2], 0));
});

test("a mount height is measured from the floor the camera stands on", () => {
  const scene = buildSpikeScene({
    camera: {
      position: [0, 0, 0],
      mountHeightM: 1.5,
      orientation: { headingDeg: 0 },
      lens: FULL_FRAME,
    },
    actor: { position: [0, 4, 0] },
  });
  assert.equal(scene.camera.position[2], 1.5);

  // On a floor one storey up, the same mount height stacks on the floor.
  const upstairs = buildSpikeScene({
    camera: {
      position: [0, 0, 3.2],
      mountHeightM: 1.5,
      orientation: { headingDeg: 0 },
      lens: FULL_FRAME,
    },
    actor: { position: [0, 4, 0] },
  });
  assert.equal(upstairs.camera.position[2], 4.7);
});

test("the published field-of-view fixtures hold through the scene builder", () => {
  // Independently calculated: 2 * atan(36 / (2 * 50)) = 39.5978°, and
  // 2 * atan(24 / (2 * 50)) = 26.9915°.
  const scene = buildSpikeScene({
    camera: { position: [0, 0, 0], orientation: { headingDeg: 0 }, lens: FULL_FRAME },
    actor: { position: [0, 4, 0] },
  });
  assert.ok(near(scene.camera.fov.horizontalDeg, 39.5978, 0.0001), scene.camera.fov.horizontalDeg);
  assert.ok(near(scene.camera.fov.verticalDeg, 26.9915, 0.0001), scene.camera.fov.verticalDeg);

  const independent = (2 * Math.atan(36 / (2 * 50)) * 180) / Math.PI;
  assert.ok(near(scene.camera.fov.horizontalDeg, independent, 1e-9));

  // Super-35, 24.89 mm at 35 mm. The implementation plan quotes 39.152° in
  // prose; the value the geometry actually gives is 39.1479°, and the Phase 0.1
  // fixture already asserts 39.15 within tolerance. The derivation is the
  // authority, so this checks against it rather than against the rounded prose.
  const super35 = fieldOfView({ gateWidthMm: 24.89, gateHeightMm: 18.66, focalLengthMm: 35 });
  const super35Independent = (2 * Math.atan(24.89 / (2 * 35)) * 180) / Math.PI;
  assert.ok(near(super35.horizontalDeg, super35Independent, 1e-9), super35.horizontalDeg);
  assert.ok(near(super35.horizontalDeg, 39.15, 0.01), super35.horizontalDeg);
});

test("unit conversion at the boundary matches the fixture", () => {
  assert.ok(near(metresToFeet(1.5), 4.92126, 0.00001), metresToFeet(1.5));
  assert.ok(near(metresToFeet(1), 3.28084, 0.00001));
});

test("the frustum has eight corners that widen with distance", () => {
  const { corners, fov } = frustumCorners({
    position: [0, 0, 1.5],
    orientation: { headingDeg: 0 },
    lens: FULL_FRAME,
    nearM: 1,
    farM: 10,
  });
  assert.equal(corners.length, 8);

  const halfWidthAt = (distance) => Math.tan((fov.horizontalDeg * Math.PI) / 360) * distance;
  // The near face sits one metre ahead, centred on the camera height.
  assert.ok(near(corners[0][1], 1, 1e-9), `near plane north offset ${corners[0][1]}`);
  assert.ok(near(Math.abs(corners[0][0]), halfWidthAt(1), 1e-9));
  assert.ok(near(Math.abs(corners[4][0]), halfWidthAt(10), 1e-9));
  assert.ok(Math.abs(corners[4][0]) > Math.abs(corners[0][0]), "the far face is wider");

  assert.throws(
    () => frustumCorners({ position: [0, 0, 0], orientation: { headingDeg: 0 }, lens: FULL_FRAME, nearM: 5, farM: 5 }),
    RangeError,
  );
});

test("a frustum rotates with its camera", () => {
  const east = frustumCorners({
    position: [0, 0, 1.5],
    orientation: { headingDeg: 90 },
    lens: FULL_FRAME,
    nearM: 1,
    farM: 10,
  });
  // Looking east, the far face is out along +X rather than +Y.
  const farCentreX = east.corners.slice(4).reduce((sum, c) => sum + c[0], 0) / 4;
  const farCentreY = east.corners.slice(4).reduce((sum, c) => sum + c[1], 0) / 4;
  assert.ok(near(farCentreX, 10, 1e-9), `far centre east ${farCentreX}`);
  assert.ok(near(farCentreY, 0, 1e-9), `far centre north ${farCentreY}`);
});

test("framing is decided by the frustum, not by proximity", () => {
  const camera = { position: [0, 0, 1.5], orientation: { headingDeg: 0 }, lens: FULL_FRAME };

  assert.equal(isWithinFrustum([0, 4, 1.5], camera), true, "straight ahead");
  assert.equal(isWithinFrustum([0, -4, 1.5], camera), false, "directly behind");
  assert.equal(isWithinFrustum([4, 0, 1.5], camera), false, "directly beside");
  // Just inside and just outside the horizontal edge at four metres.
  const halfWidth = Math.tan((fieldOfView(FULL_FRAME).horizontalDeg * Math.PI) / 360) * 4;
  assert.equal(isWithinFrustum([halfWidth - 0.01, 4, 1.5], camera), true);
  assert.equal(isWithinFrustum([halfWidth + 0.01, 4, 1.5], camera), false);
  // Nearer than the near plane is not framed either.
  assert.equal(isWithinFrustum([0, 0.1, 1.5], camera), false);
});

test("distance is measured in three dimensions", () => {
  assert.ok(near(distanceM([0, 0, 0], [3, 4, 0]), 5));
  assert.ok(near(distanceM([0, 0, 0], [0, 0, 2.5]), 2.5));
});

test("the ENU to Three.js mapping happens once, at the boundary", () => {
  // East stays +X, north becomes -Z, up becomes +Y.
  assert.deepEqual(enuToThree([1, 0, 0]), [1, 0, 0]);
  assert.deepEqual(enuToThree([0, 1, 0]), [0, 0, -1]);
  assert.deepEqual(enuToThree([0, 0, 1]), [0, 1, 0]);
});

test("the scene is handed to the library without recomputing anything", () => {
  // A stand-in for Three.js: the bridge must only place what was computed.
  const made = [];
  const vec = () => ({ set(...args) { made.push(args); } });
  const THREE = {
    Group: class { constructor() { this.children = []; this.name = ""; } add(c) { this.children.push(c); } },
    Mesh: class { constructor() { this.position = vec(); this.name = ""; } },
    LineSegments: class { constructor() { this.name = ""; } },
    BoxGeometry: class {},
    CapsuleGeometry: class {},
    BufferGeometry: class { setAttribute() {} setIndex() {} },
    BufferAttribute: class {},
    MeshStandardMaterial: class {},
    LineBasicMaterial: class {},
  };

  const scene = buildSpikeScene({
    camera: { position: [0, 0, 0], mountHeightM: 1.5, orientation: { headingDeg: 0 }, lens: FULL_FRAME },
    actor: { position: [0, 4, 0], heightM: 1.75 },
  });
  const root = buildThreeScene(scene, THREE);

  assert.deepEqual(root.children.map((child) => child.name), ["camera", "actor", "frustum"]);
  // The camera lands at its computed height, mapped to the Y-up frame.
  assert.deepEqual(made[0], enuToThree(scene.camera.position));
  // The actor capsule is centred at half its height above the floor.
  assert.deepEqual(made[1], enuToThree([0, 4, 1.75 / 2]));
});

// ---- Test 26: the optional 3D context ------------------------------------

test("no credential is an explicit absent state, not an error", () => {
  const status = initialTilesStatus(null, region.optional3d);
  assert.equal(status.state, TILES_STATES.absent);
  assert.match(status.reason, /Aerial, imported-plan and blank-grid workspaces are unaffected/);

  assert.equal(initialTilesStatus({ googleMapsApiKey: "" }, region.optional3d).state, TILES_STATES.absent);
  assert.equal(
    initialTilesStatus({ googleMapsApiKey: "a-key" }, region.optional3d).state,
    TILES_STATES.configured,
  );
});

test("a disabled configuration is distinguishable from a missing credential", () => {
  const status = initialTilesStatus({ googleMapsApiKey: "a-key" }, { enabled: false });
  assert.equal(status.state, TILES_STATES.disabled);
  assert.match(status.reason, /switched off/);
});

test("a refused credential is reported as a configuration problem", async () => {
  const status = await probeTiles({
    rootTileset: region.optional3d.rootTileset,
    apiKey: "a-key",
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });
  assert.equal(status.state, TILES_STATES.denied);
  assert.match(status.reason, /referrer restriction/);
  assert.match(status.reason, /unaffected/);
});

test("a slow service times out rather than holding the workspace", async () => {
  const status = await probeTiles({
    rootTileset: region.optional3d.rootTileset,
    apiKey: "a-key",
    timeoutMs: 20,
    fetchImpl: (url, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  assert.equal(status.state, TILES_STATES.slow);
  assert.match(status.reason, /did not answer within 20 ms/);
});

test("an unreachable service is distinguished from a refusal", async () => {
  const offline = await probeTiles({
    rootTileset: region.optional3d.rootTileset,
    apiKey: "a-key",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(offline.state, TILES_STATES.unreachable);

  const serverError = await probeTiles({
    rootTileset: region.optional3d.rootTileset,
    apiKey: "a-key",
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(serverError.state, TILES_STATES.unreachable);
});

test("no request is made without a credential", async () => {
  let called = false;
  const status = await probeTiles({
    rootTileset: region.optional3d.rootTileset,
    apiKey: "",
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200 };
    },
  });
  assert.equal(called, false);
  assert.equal(status.state, TILES_STATES.absent);
});

test("the blank grid is always available, whatever every provider does", () => {
  // Test 26: every failure of the optional 3D context must still leave a
  // usable workspace.
  for (const tilesStatus of [
    initialTilesStatus(null, region.optional3d),
    { state: TILES_STATES.denied, reason: "refused" },
    { state: TILES_STATES.slow, reason: "slow" },
    { state: TILES_STATES.unreachable, reason: "offline" },
    { state: TILES_STATES.disabled, reason: "off" },
  ]) {
    const options = availableBackgrounds({
      tilesStatus,
      imageryState: "neutral",
      hasPlanAsset: false,
      webgl: false,
    });
    const usable = options.filter((option) => option.available);
    assert.deepEqual(usable.map((option) => option.kind), ["grid"], tilesStatus.state);
    assert.equal(chooseBackground("google3d", options).kind, "grid");
    // Every unavailable option explains itself rather than vanishing.
    for (const option of options) assert.ok(option.reason.length > 0, option.kind);
  }
});

test("a working credential and WebGL make the 3D context selectable", () => {
  const options = availableBackgrounds({
    tilesStatus: { state: TILES_STATES.available, reason: "answered" },
    imageryState: "active",
    hasPlanAsset: true,
    webgl: true,
  });
  assert.deepEqual(options.filter((o) => o.available).map((o) => o.kind), [
    "google3d",
    "aerial",
    "plan",
    "grid",
  ]);
  assert.equal(chooseBackground("google3d", options).kind, "google3d");
});

test("no WebGL removes the 3D context and says why, keeping the rest", () => {
  const options = availableBackgrounds({
    tilesStatus: { state: TILES_STATES.available, reason: "answered" },
    imageryState: "active",
    hasPlanAsset: false,
    webgl: false,
  });
  const google = options.find((option) => option.kind === "google3d");
  assert.equal(google.available, false);
  assert.match(google.reason, /no WebGL support/);
  assert.deepEqual(options.filter((o) => o.available).map((o) => o.kind), ["aerial", "grid"]);
});

test("a credential is never carried into text that is shown or stored", () => {
  const leak = "https://tile.googleapis.com/v1/3dtiles/root.json?key=AIzaSyFAKEKEY123&session=abc";
  const safe = redactCredentials(leak);
  assert.equal(safe.includes("AIzaSyFAKEKEY123"), false);
  assert.match(safe, /key=REDACTED/);
  assert.equal(redactCredentials("?api_key=secret-value").includes("secret-value"), false);
  assert.equal(redactCredentials("?token=secret-value").includes("secret-value"), false);
  assert.equal(redactCredentials(null), null);
});
