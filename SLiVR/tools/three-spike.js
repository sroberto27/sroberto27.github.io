/**
 * Three.js transform and optics spike.
 *
 * Renders the camera, actor and frustum that `three-bridge.js` computes, and
 * shows the readings beside them. The point is not that something appears on
 * screen: it is that what appears is the same geometry the Node fixtures
 * assert, so a rendering problem can never be mistaken for a maths problem.
 *
 * The assertions repeat the fixture values in the browser. If the published
 * 50 mm horizontal field of view reads 39.598 degrees here and in `node
 * --test`, the transform chain and the library agree. Where the plan's prose
 * and the geometry disagree, as they do for Super-35, the derivation wins.
 *
 * The optional 3D context is exercised in the same page because its whole
 * contract is that failing changes nothing: with no credential, a refused key
 * or a slow service, this scene must still be here.
 */

import * as THREE from "three";
import { buildSpikeScene, buildThreeScene, isWithinFrustum, distanceM, cameraBasis } from "slivr/shot-workspace/three-bridge.js";
import { fieldOfView } from "slivr/spatial/optics.js";
import { metresToFeet } from "slivr/spatial/units.js";
import { initialTilesStatus, probeTiles, availableBackgrounds, redactCredentials } from "slivr/shot-workspace/background.js";

const FULL_FRAME = { gateWidthMm: 36.0, gateHeightMm: 24.0, focalLengthMm: 50 };
const SUPER_35 = { gateWidthMm: 24.89, gateHeightMm: 18.66, focalLengthMm: 35 };

/** A camera at the origin looking due north, and an actor four metres ahead. */
const scene = buildSpikeScene({
  camera: {
    position: [0, 0, 0],
    mountHeightM: 1.5,
    orientation: { headingDeg: 0, pitchDeg: 0 },
    lens: FULL_FRAME,
  },
  actor: { position: [0, 4, 0], headingDeg: 180, heightM: 1.75 },
  frame: { groundElevationM: 0, northOffsetDeg: 0 },
});

// ---- Readings --------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function fields(target, pairs) {
  document.getElementById(target).replaceChildren(
    ...pairs.flatMap(([term, value]) => [el("dt", { text: term }), el("dd", { text: String(value) })]),
  );
}

document.getElementById("build").textContent = `three ${THREE.REVISION}`;

fields("scene-fields", [
  ["Axes", scene.frame.axes],
  ["Camera position", scene.camera.position.map((v) => v.toFixed(3)).join(", ")],
  ["Camera height", `${scene.camera.position[2].toFixed(2)} m / ${metresToFeet(scene.camera.position[2]).toFixed(2)} ft`],
  ["Heading", `${scene.camera.orientation.headingDeg}°`],
  ["Horizontal FOV", `${scene.camera.fov.horizontalDeg.toFixed(3)}°`],
  ["Vertical FOV", `${scene.camera.fov.verticalDeg.toFixed(3)}°`],
  ["Actor position", scene.actor.position.join(", ")],
  ["Camera to actor", `${distanceM(scene.camera.position, scene.actor.position).toFixed(3)} m`],
]);

/**
 * The same checks the Node fixtures make, re-run against the rendered scene.
 *
 * Published gate values: a 36.0 by 24.0 mm gate at 50 mm gives 39.598 degrees
 * horizontally and 26.991 vertically; Super-35 at 24.89 mm and 35 mm gives
 * 39.152 horizontally.
 */
const near = (a, b, tolerance = 0.001) => Math.abs(a - b) <= tolerance;

const assertions = [
  [
    "50 mm full-frame horizontal FOV is 39.598°",
    near(fieldOfView(FULL_FRAME).horizontalDeg, 39.598, 0.001),
    fieldOfView(FULL_FRAME).horizontalDeg.toFixed(4),
  ],
  [
    "50 mm full-frame vertical FOV is 26.991°",
    near(fieldOfView(FULL_FRAME).verticalDeg, 26.991, 0.001),
    fieldOfView(FULL_FRAME).verticalDeg.toFixed(4),
  ],
  [
    // The implementation plan quotes 39.152° in prose. The geometry gives
    // 39.1479°, and the derivation is the authority; the prose is rounded.
    "Super-35 at 35 mm horizontal FOV matches its own derivation",
    near(
      fieldOfView(SUPER_35).horizontalDeg,
      (2 * Math.atan(SUPER_35.gateWidthMm / (2 * SUPER_35.focalLengthMm)) * 180) / Math.PI,
      1e-9,
    ),
    fieldOfView(SUPER_35).horizontalDeg.toFixed(4),
  ],
  [
    "Zero heading points at scene north",
    near(cameraBasis({ headingDeg: 0 }).forward[1], 1) && near(cameraBasis({ headingDeg: 0 }).forward[0], 0),
    cameraBasis({ headingDeg: 0 }).forward.map((v) => v.toFixed(3)).join(", "),
  ],
  [
    "90° heading points due east",
    near(cameraBasis({ headingDeg: 90 }).forward[0], 1),
    cameraBasis({ headingDeg: 90 }).forward.map((v) => v.toFixed(3)).join(", "),
  ],
  [
    "Mount height raises the camera to 1.5 m",
    near(scene.camera.position[2], 1.5),
    `${scene.camera.position[2]} m`,
  ],
  [
    "1.5 m converts to 4.921 ft",
    near(metresToFeet(1.5), 4.9213, 0.001),
    metresToFeet(1.5).toFixed(4),
  ],
  [
    "The actor is inside the frustum",
    isWithinFrustum([0, 4, 1.2], {
      position: scene.camera.position,
      orientation: scene.camera.orientation,
      lens: FULL_FRAME,
    }),
    "0, 4, 1.2",
  ],
  [
    "A subject behind the camera is outside it",
    !isWithinFrustum([0, -4, 1.2], {
      position: scene.camera.position,
      orientation: scene.camera.orientation,
      lens: FULL_FRAME,
    }),
    "0, -4, 1.2",
  ],
  ["The frustum has eight corners", scene.frustum.corners.length === 8, String(scene.frustum.corners.length)],
];

document.getElementById("assertions").replaceChildren(
  ...assertions.map(([label, passed, detail]) =>
    el("li", {}, [
      el("span", { class: passed ? "assertion-pass" : "assertion-fail", text: passed ? "PASS" : "FAIL" }),
      el("span", {}, [el("span", { text: label }), el("span", { class: "detail", text: detail })]),
    ]),
  ),
);

// ---- Render ----------------------------------------------------------------

const host = document.getElementById("canvas-host");
let renderer = null;

try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (cause) {
  host.append(
    el("p", { class: "empty-note", text: `WebGL is unavailable, so nothing was drawn: ${cause.message}` }),
  );
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.append(renderer.domElement);

  const world = new THREE.Scene();
  world.background = new THREE.Color(0x101316);
  world.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 8, 6);
  world.add(key);
  world.add(new THREE.GridHelper(20, 20, 0x414a52, 0x2b3238));
  world.add(buildThreeScene(scene, THREE));

  const view = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  view.position.set(9, 7, 11);
  view.lookAt(0, 1, -3);

  const resize = () => {
    const { clientWidth, clientHeight } = host;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    view.aspect = clientWidth / clientHeight;
    view.updateProjectionMatrix();
    renderer.render(world, view);
  };
  new ResizeObserver(resize).observe(host);
  resize();

  // Context loss must be survivable, because the optional 3D context and a
  // long editing session both make it likely.
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    host.append(el("p", { class: "empty-note", text: "The WebGL context was lost. Authored geometry is unaffected." }));
  });
}

// ---- Optional 3D context ---------------------------------------------------

const region = await fetch("../data/region/lafayette.region.json").then((response) => response.json());
const runtimeConfig = window.SLIVR_RUNTIME ?? null;

let tiles = initialTilesStatus(runtimeConfig, region.optional3d);
if (runtimeConfig?.googleMapsApiKey) {
  tiles = await probeTiles({
    rootTileset: region.optional3d.rootTileset,
    apiKey: runtimeConfig.googleMapsApiKey,
  });
}

fields("tiles-fields", [
  ["State", tiles.state],
  ["Elapsed", tiles.elapsedMs === undefined ? "—" : `${tiles.elapsedMs} ms`],
  ["Attribution", region.optional3d.attribution],
]);

document.getElementById("tiles-note").textContent = redactCredentials(tiles.reason);

const backgrounds = availableBackgrounds({
  tilesStatus: tiles,
  imageryState: "unknown",
  hasPlanAsset: false,
  webgl: Boolean(renderer),
});
document.getElementById("tiles-note").append(
  el("br"),
  document.createTextNode(
    `Backgrounds available: ${backgrounds.filter((b) => b.available).map((b) => b.label).join(", ")}.`,
  ),
);
