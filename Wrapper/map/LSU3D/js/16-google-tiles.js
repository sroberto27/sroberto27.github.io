/* === LSU Death Valley Experience — Part 16: Google Photorealistic 3D Tiles ===
   Opt-in replacement for the flat extruded-building fallback
   (js/07-layer-builders.js), rendered via NASA-AMMOS's open-source
   3d-tiles-renderer + three.js as a MapLibre custom layer — the same
   "reuse MapLibre's WebGL context inside a type:'custom' layer" pattern
   the deleted js/15-3d-models.js stadium loader proved out.

   OFF unless config.map3d.googleTilesEnabled is true AND a
   googleApiKey is set (config.local.js — see config.local.example.js;
   never set a real key in the committed config.js). Falls back
   automatically to the flat extruded-building view on any failure —
   missing/invalid key, a root-tileset load-error, or a timeout — never
   a blank/broken 3D view. This is billed Google Cloud usage; see
   README.md and Google Cloud Console for quota caps and billing
   alerts before enabling anywhere shared.

   Library versions pinned in index.html's importmap: three@0.183.0,
   3d-tiles-renderer@0.5.1 (peer-requires three >=0.167.0). Import
   paths, event names, and the ECEF/ENU geo-referencing math below are
   all verified against the published package source and NASA-AMMOS's
   own reference examples, not guessed — see the comment above
   buildGoogleTilesGroupTransform() for the geo-referencing derivation.

   -----------------------------------------------------------------
   LIFECYCLE — this is the part that changed after the first working
   version turned out to be unreliable across repeated 2D<->3D
   toggles. The THREE.js scene, both cameras, the TilesRenderer
   instance, and its loaded/cached tiles are now built ONCE
   (ensureGoogleTilesResources(), memoized) and kept alive for the
   rest of the session — entering/leaving Google 3D mode only
   add/removes the thin MapLibre custom layer wrapper (onRemove()
   deliberately does NOT dispose anything). Re-entering 3D therefore
   reuses whatever's already loaded/cached instead of re-fetching the
   whole tileset from scratch every time, which is what made repeated
   toggling unreliable before.

   Every activation also jumps the camera to a FIXED, known-good start
   view (config.map3d.google3DStartView) instantly (no easing) rather
   than starting from wherever the 2D camera happened to be — that's
   what guarantees the same close-up, already-detailed starting point
   every time, with no manual zooming/panning needed to "wake up" the
   real geometry. A loading veil (#googleTilesLoading) covers the map
   from the moment activation starts until waitForGoogleTilesReady()
   confirms the tile loader has actually gone quiet at that view — so
   a still-coarse intermediate frame is never shown as if it were
   finished. An incrementing "generation" counter guards every awaited
   step so a stale activation (e.g. the user left 3D mode mid-load)
   can never clobber a newer one. */

let googleTilesLibs = null;          // cached dynamic-import results
let googleTilesFallenBack = false;   // this session already failed outright — don't retry until reload
let googleActivationGeneration = 0;  // bumped on every activate/deactivate to invalidate stale async work
let googleTilesActive = false;       // true only once Google tiles have actually taken over rendering

const GOOGLE_TILES_FAILED_KEY = "lsu3d:googleTilesFailed";

/* Persistent resources, built once by ensureGoogleTilesResources() and
   never torn down for the rest of the session (see LIFECYCLE above).
   `.renderer` is populated later, inside the layer's onAdd(), since a
   THREE.WebGLRenderer needs the actual canvas/gl context MapLibre only
   hands over there. */
const googleR = {
  scene: null,
  camera: null,       // "draw" camera — projectionMatrix only, matrixWorld stays identity
  tilesCamera: null,  // LOD-only camera — real perspective + real pose, never passed to renderer.render()
  tiles: null,
  localTransform: null,
  renderer: null,
  layer: null,
  lastTilesCameraPose: null // most recent LOD camera pose, for diagnostics
};
let googleResourcesPromise = null;

function googleTilesConfigured() {
  return !!(config.map3d && config.map3d.googleTilesEnabled && config.map3d.googleApiKey);
}

function googleTilesPreviouslyFailed() {
  try {
    return sessionStorage.getItem(GOOGLE_TILES_FAILED_KEY) === "1";
  } catch (_) {
    return false; // sessionStorage unavailable (private mode etc.) — never block on this alone
  }
}

function markGoogleTilesFailed(reason) {
  googleTilesFallenBack = true;
  console.warn("[google-tiles] falling back to the simplified 3D view:", reason);
  try { sessionStorage.setItem(GOOGLE_TILES_FAILED_KEY, "1"); } catch (_) {}
}

async function ensureGoogleTilesLibs() {
  if (googleTilesLibs) return googleTilesLibs;
  const [THREE, coreMod, pluginsMod, gltfMod, dracoMod, ktx2Mod] = await Promise.all([
    import("three"),
    import("3d-tiles-renderer"),
    import("3d-tiles-renderer/core/plugins"),
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/loaders/DRACOLoader.js"),
    import("three/addons/loaders/KTX2Loader.js")
  ]);
  googleTilesLibs = {
    THREE,
    TilesRenderer: coreMod.TilesRenderer,
    WGS84_ELLIPSOID: coreMod.WGS84_ELLIPSOID,
    GoogleCloudAuthPlugin: pluginsMod.GoogleCloudAuthPlugin,
    GLTFLoader: gltfMod.GLTFLoader,
    DRACOLoader: dracoMod.DRACOLoader,
    KTX2Loader: ktx2Mod.KTX2Loader
  };
  return googleTilesLibs;
}

/* Google's tiles are authored in ECEF (Earth-Centered-Earth-Fixed)
   coordinates — meters from Earth's center, ~6.3 million units in
   magnitude. Adding tiles.group to the scene with no transform leaves
   it sitting at the THREE.js origin while the camera is effectively
   "at Earth's core" from the tiles' perspective — 3d-tiles-renderer's
   LOD/frustum logic then has no idea where the real camera is, and
   loads only the coarsest whole-planet tile. Fixed by anchoring
   tiles.group to a real point on Earth (LSU campus,
   config.map3d.initialCenter) via the ellipsoid's East-North-Up frame
   at that point:

     tiles.group.matrix = ecefToEnuRotation * translate(-anchorECEF)

   which converts raw ECEF tile geometry into local ENU meters
   (X=east, Y=north, Z=up) relative to the anchor — the same
   convention the deleted stadium-mesh loader's own hand-authored mesh
   used, which is why the second half of this (ENU meters -> MapLibre
   mercator "world" units) is the same translate+scale trick that file
   used: translate to the anchor's mercator position, then scale by
   meterInMercatorCoordinateUnits() with Y negated (mercator's Y
   increases southward, ENU's increases northward). No extra rotation
   is needed there since ENU is already Z-up, unlike a Y-up-authored
   glTF model (which is what MapLibre's own "add a 3D model" boilerplate
   assumes and rotates 90 deg for — not applicable here).

   The geographic anchoring approach is taken from NASA-AMMOS's own
   example/three/googleMapsExample.js (a global ECEF tileset anchored
   via Ellipsoid.getEastNorthUpFrame).

   The resulting ENU-meters frame is ALSO three.js world space for this
   scene, which is what makes the LOD camera below expressible without
   any mercator scale factor — see "THE LOD CAMERA" comment further
   down before changing either of these transforms. */
function buildGoogleTilesGroupTransform(THREE, WGS84_ELLIPSOID, lng, lat) {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;

  const enuFrame = new THREE.Matrix4();
  WGS84_ELLIPSOID.getEastNorthUpFrame(latRad, lonRad, 0, enuFrame);
  const ecefToEnuRotation = new THREE.Matrix4().extractRotation(enuFrame).transpose();

  const anchorEcef = new THREE.Vector3();
  WGS84_ELLIPSOID.getCartographicToPosition(latRad, lonRad, 0, anchorEcef);
  const moveToOrigin = new THREE.Matrix4().makeTranslation(-anchorEcef.x, -anchorEcef.y, -anchorEcef.z);

  const groupMatrix = new THREE.Matrix4().multiplyMatrices(ecefToEnuRotation, moveToOrigin);

  const anchorMercator = maplibregl.MercatorCoordinate.fromLngLat([lng, lat], 0);
  const meterScale = anchorMercator.meterInMercatorCoordinateUnits();
  const localTransform = new THREE.Matrix4()
    .makeTranslation(anchorMercator.x, anchorMercator.y, anchorMercator.z)
    .scale(new THREE.Vector3(meterScale, -meterScale, meterScale));
  return { groupMatrix, localTransform, anchorMercator, meterScale };
}

/* ============================================================
   THE LOD CAMERA — read this before touching any of it.
   ------------------------------------------------------------
   3d-tiles-renderer uses the camera handed to setCamera() for TWO
   separate things, and they have DIFFERENT requirements:

     1. Frustum culling. It builds the frustum from
        projectionMatrix * matrixWorldInverse * group.matrixWorld,
        i.e. only the PRODUCT of projection and view has to be right.

     2. Screen-space error (which drives whether a tile refines into
        its children, i.e. whether you get real detail or a blurry
        blob). This reads projectionMatrix.elements[5] ON ITS OWN, and
        is only meaningful for a genuine perspective matrix — there
        that element equals 1/tan(fov/2).

   Every earlier version of this file assigned MapLibre's combined
   VIEW-projection matrix (`rawMain`) to tilesCamera.projectionMatrix.
   That satisfies (1) — which is why geometry rendered at all — but
   catastrophically breaks (2): in a view-projection matrix, element[5]
   is a bearing-dependent mix of rotation terms, not 1/tan(fov/2). So
   the error metric swung with heading: refine-everything at one
   bearing, refine-nothing at the opposite one. That is exactly what
   the live diagnostics showed — inFrustum 30305 facing one way vs 1
   facing the other, with a camera position that never moved at all.

   So tilesCamera needs BOTH halves to be genuine and consistent:
     - a real perspective projection (MapLibre's own vertical FOV +
       the live canvas aspect), and
     - a real rigid camera pose expressed in three.js world space.

   And three.js world space here is LOCAL ENU METERS relative to the
   tileset anchor — that is what tiles.group.matrixWorld maps Google's
   raw ECEF tile coordinates into (see buildGoogleTilesGroupTransform).
   A previous attempt built the pose in MERCATOR units and converted
   with localTransformInverse, which carries a ~4e7 scale factor and a
   Y-mirror — putting view space in mercator units while the projection
   expected meters, which broke every direction at once. Everything
   below is therefore computed directly in ENU meters, with no mercator
   scale factor anywhere near the camera's rotation.
   ============================================================ */

/* Rebuilds tilesCamera's perspective projection when the viewport or
   MapLibre's FOV changes. map.transform.fov is a public getter in
   MapLibre v4 returning the VERTICAL fov in degrees — the same
   convention three.js PerspectiveCamera.fov uses. near/far are in
   METERS (matching ENU world space) and are deliberately generous:
   this camera is only used for culling and error metrics, never for
   depth-buffer precision. */
function updateTilesCameraProjection(mapInstance, tilesCamera) {
  const canvas = mapInstance.getCanvas();
  const width = canvas.clientWidth || canvas.width || 1;
  const height = canvas.clientHeight || canvas.height || 1;
  const t = mapInstance.transform;
  const fovDeg = (t && typeof t.fov === "number" && isFinite(t.fov) && t.fov > 0)
    ? t.fov
    : 36.87; // MapLibre's fixed default (_fov = 0.6435011087932844 rad)
  const aspect = width / height;

  if (tilesCamera.fov !== fovDeg || tilesCamera.aspect !== aspect) {
    tilesCamera.fov = fovDeg;
    tilesCamera.aspect = aspect;
    tilesCamera.updateProjectionMatrix();
  }
}

/* Drives tilesCamera's pose from MapLibre's live camera state, entirely
   in local ENU meters relative to the tileset anchor.

   Camera position replicates MapLibre's own (internal, unexported)
   cameraMercatorCoordinateFromCenterAndRotation(): the camera sits
   `cameraToCenterDistance` away from the map's center point, along the
   direction set by pitch/bearing. cameraToCenterDistance is in SCREEN
   PIXELS, converted to meters via the mercator scale at the current
   center latitude times MapLibre's world size (512 * 2^zoom).

   Orientation is built as an explicit ENU basis rather than lookAt(),
   because lookAt() degenerates when the view direction is parallel to
   the up axis — which is exactly what happens at pitch 0 (straight
   down), a state this app reaches routinely.

     X (camera right)    = ( cos b, -sin b, 0 )
     Z (camera backward) = ( -sin b sin p, -cos b sin p, cos p )
     Y (camera up)       = Z x X = ( cos p sin b, cos p cos b, sin p )

   (three.js cameras look down -Z, so Z points from the map center back
   toward the camera — the same vector the position offset uses.) */
function updateTilesCameraPose(mapInstance, tilesCamera, anchorMercator, meterScale, axes) {
  const t = mapInstance.transform;
  const pitchRad = (t.pitch * Math.PI) / 180;
  const bearingRad = (t.bearing * Math.PI) / 180;

  // Map center, as ENU meters relative to the anchor. Mercator Y grows
  // SOUTHWARD while ENU north grows northward, hence the negation —
  // the same sign flip localTransform applies for rendering.
  const centerMercator = maplibregl.MercatorCoordinate.fromLngLat(t.center, t.elevation || 0);
  const centerEast = (centerMercator.x - anchorMercator.x) / meterScale;
  const centerNorth = -(centerMercator.y - anchorMercator.y) / meterScale;
  const centerUp = (centerMercator.z - anchorMercator.z) / meterScale;

  const worldSize = 512 * Math.pow(2, mapInstance.getZoom());
  const pixelPerMeter = centerMercator.meterInMercatorCoordinateUnits() * worldSize;
  const distanceMeters = pixelPerMeter > 0 ? t.cameraToCenterDistance / pixelPerMeter : 0;

  const sinP = Math.sin(pitchRad), cosP = Math.cos(pitchRad);
  const sinB = Math.sin(bearingRad), cosB = Math.cos(bearingRad);

  axes.x.set(cosB, -sinB, 0);
  axes.y.set(cosP * sinB, cosP * cosB, sinP);
  axes.z.set(-sinB * sinP, -cosB * sinP, cosP);

  const cameraEast = centerEast + distanceMeters * axes.z.x;
  const cameraNorth = centerNorth + distanceMeters * axes.z.y;
  const cameraUp = centerUp + distanceMeters * axes.z.z;

  tilesCamera.matrix.makeBasis(axes.x, axes.y, axes.z);
  tilesCamera.matrix.setPosition(cameraEast, cameraNorth, cameraUp);
  tilesCamera.matrixWorldNeedsUpdate = true;
  // Camera.updateMatrixWorld() also refreshes matrixWorldInverse, which
  // is the half 3d-tiles-renderer actually reads.
  tilesCamera.updateMatrixWorld(true);

  return {
    centerEnuMeters: { east: centerEast, north: centerNorth, up: centerUp },
    cameraEnuMeters: { east: cameraEast, north: cameraNorth, up: cameraUp },
    cameraDistanceMeters: distanceMeters,
    cameraAltitudeMeters: cameraUp
  };
}

/* Reads the currently-visible tile set's attribution (Google's own
   getAttributions() aggregates across all registered plugins, incl.
   GoogleCloudAuthPlugin's required copyright string) into the always-
   in-DOM #googleTilesAttrib chip. */
function refreshGoogleTilesAttribution(tiles) {
  if (!el.googleTilesAttrib) return;
  const attributions = tiles.getAttributions([]);
  const text = attributions.map((a) => (a && a.value) || "").filter(Boolean).join(" | ");
  el.googleTilesAttrib.textContent = text || "Imagery ©2026 Google";
}

function showGoogleTilesAttribution(show) {
  if (!el.googleTilesAttrib) return;
  el.googleTilesAttrib.classList.toggle("is-visible", show);
  el.googleTilesAttrib.setAttribute("aria-hidden", String(!show));
}

function showGoogleTilesLoading(show) {
  if (!el.googleTilesLoading) return;
  el.googleTilesLoading.classList.toggle("is-visible", show);
  el.googleTilesLoading.setAttribute("aria-hidden", String(!show));
}

/* Throttled (~once/2s) diagnostic log of the live tile-loading state,
   so a report of "still broken" comes with real numbers instead of a
   screenshot to reverse-engineer. Also exposes window.__googleTilesDebug()
   for an on-demand snapshot from the browser console at any moment. */
let googleTilesDebugLastLog = 0;
function googleTilesDebugSnapshot(pose) {
  const tiles = googleR.tiles;
  if (!tiles) return null;
  const tilesCamera = googleR.tilesCamera;
  return {
    rootLoaded: !!tiles.rootTileset,
    stats: tiles.stats ? { ...tiles.stats } : null,
    visibleTiles: tiles.visibleTiles ? tiles.visibleTiles.size : null,
    activeTiles: tiles.activeTiles ? tiles.activeTiles.size : null,
    mapCenterLngLat: map.getCenter(),
    mapPitch: map.getPitch(),
    mapBearing: map.getBearing(),
    mapZoom: map.getZoom(),
    // The LOD camera's actual state, in three.js world space (local ENU
    // meters relative to the tileset anchor).
    lodCameraEnuMeters: pose ? pose.cameraEnuMeters : null,
    lodCameraAltitudeMeters: pose ? pose.cameraAltitudeMeters : null,
    lodCameraDistanceMeters: pose ? pose.cameraDistanceMeters : null,
    // This is THE number that was breaking tile refinement: 3d-tiles-
    // renderer derives its screen-space-error denominator from
    // projectionMatrix.elements[5], which must be a stable
    // 1/tan(fov/2) (~3.0 at MapLibre's 36.87 deg FOV). If it drifts
    // with bearing, the LOD camera is wrong again.
    lodProjectionElement5: tilesCamera ? tilesCamera.projectionMatrix.elements[5] : null,
    lodCameraFov: tilesCamera ? tilesCamera.fov : null,
    lodCameraAspect: tilesCamera ? tilesCamera.aspect : null
  };
}

function googleTilesDebugLog(pose) {
  const now = performance.now();
  if (now - googleTilesDebugLastLog < 2000) return;
  googleTilesDebugLastLog = now;
  const snapshot = googleTilesDebugSnapshot(pose);
  if (snapshot) console.debug("[google-tiles] diag", snapshot);
}

window.__googleTilesDebug = function () {
  const tiles = googleR.tiles;
  if (!tiles) return "no TilesRenderer built yet — enter 3D mode with Google tiles configured first";
  return Object.assign(
    googleTilesDebugSnapshot(googleR.lastTilesCameraPose) || {},
    {
      layerOnMap: !!map.getLayer(LAYER_IDS.googleTiles),
      active3DRenderer,
      googleTilesFallenBack,
      googleTilesPreviouslyFailed: googleTilesPreviouslyFailed()
    }
  );
};

/* Builds the persistent scene/cameras/TilesRenderer/layer exactly
   once (memoized via googleResourcesPromise) — see LIFECYCLE above.
   The actual THREE.WebGLRenderer is NOT built here (needs a live
   canvas/gl context, only available inside the layer's onAdd()); this
   just wires up everything that doesn't depend on that. */
async function ensureGoogleTilesResources() {
  if (googleResourcesPromise) return googleResourcesPromise;

  googleResourcesPromise = (async () => {
    const { THREE, TilesRenderer, WGS84_ELLIPSOID, GoogleCloudAuthPlugin, GLTFLoader, DRACOLoader, KTX2Loader } =
      await ensureGoogleTilesLibs();

    const scene = new THREE.Scene();

    // The DRAW camera. Its projectionMatrix carries MapLibre's full
    // world->clip transform each frame and its matrixWorld stays at
    // three.js's default identity — the standard MapLibre custom-layer
    // pattern, unchanged, and confirmed working.
    const camera = new THREE.PerspectiveCamera();

    // The LOD camera handed to 3d-tiles-renderer — a genuine camera
    // with a real perspective projection and a real rigid pose. See the
    // long "THE LOD CAMERA" comment above updateTilesCameraProjection()
    // for why it cannot just reuse MapLibre's matrix like the draw
    // camera does.
    const tilesCamera = new THREE.PerspectiveCamera();
    // Its matrix is written by hand every frame, so three.js must not
    // recompute it from the (never-set) position/quaternion fields.
    tilesCamera.matrixAutoUpdate = false;
    // Meters, matching ENU world space. Generous on purpose: this
    // camera only culls and measures error, it never writes depth.
    tilesCamera.near = 1;
    tilesCamera.far = 1000000;

    // Scratch basis vectors, reused each frame to avoid per-frame
    // allocation in the render loop.
    const tilesCameraAxes = {
      x: new THREE.Vector3(),
      y: new THREE.Vector3(),
      z: new THREE.Vector3()
    };

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    const tiles = new TilesRenderer(config.map3d.googleTilesetUrl);
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: config.map3d.googleApiKey }));

    // Google's tile content is Draco + KTX2(Basis)-compressed glTF —
    // both loaders are required, not just GLTFLoader.
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://unpkg.com/three@0.183.0/examples/jsm/libs/draco/");
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.183.0/examples/jsm/libs/basis/");
    // ktx2Loader.detectSupport() needs a live renderer — deferred to
    // the layer's onAdd(), the first time a real one exists.

    const gltfLoader = new GLTFLoader(tiles.manager);
    gltfLoader.setDRACOLoader(dracoLoader);
    tiles.manager.addHandler(/\.gltf$|\.glb$/, gltfLoader);

    const [anchorLng, anchorLat] = config.map3d.initialCenter;
    const { groupMatrix, localTransform, anchorMercator, meterScale } =
      buildGoogleTilesGroupTransform(THREE, WGS84_ELLIPSOID, anchorLng, anchorLat);
    tiles.group.matrix.copy(groupMatrix);
    tiles.group.matrixAutoUpdate = false;
    tiles.group.updateMatrixWorld(true);
    scene.add(tiles.group);

    tiles.setCamera(tilesCamera);

    tiles.addEventListener("load-root-tileset", () => {
      refreshGoogleTilesAttribution(tiles);
      showGoogleTilesAttribution(true);
    });
    tiles.addEventListener("tiles-load-end", () => refreshGoogleTilesAttribution(tiles));

    const layer = {
      id: LAYER_IDS.googleTiles,
      type: "custom",
      renderingMode: "3d",

      onAdd(mapInstance, gl) {
        this.map = mapInstance;
        if (!googleR.renderer) {
          googleR.renderer = new THREE.WebGLRenderer({
            canvas: mapInstance.getCanvas(),
            context: gl,
            antialias: true
          });
          googleR.renderer.autoClear = false;
          ktx2Loader.detectSupport(googleR.renderer);
          gltfLoader.setKTX2Loader(ktx2Loader);
          updateTilesCameraProjection(mapInstance, tilesCamera);
          tiles.setResolutionFromRenderer(tilesCamera, googleR.renderer);
        }
      },

      render(gl, args) {
        const renderer = googleR.renderer;
        if (!renderer || !localTransform) return;

        // Draw camera: MapLibre's own world->clip matrix, composed with
        // the ENU-meters -> mercator transform. Unchanged, and confirmed
        // to render correctly.
        const rawMain = (args && args.defaultProjectionData)
          ? args.defaultProjectionData.mainMatrix
          : args;
        camera.projectionMatrix.fromArray(rawMain);
        camera.projectionMatrix.multiply(localTransform);

        // LOD camera: a genuine perspective projection plus a genuine
        // rigid pose in ENU meters, both rebuilt from MapLibre's live
        // camera state. Critically, its projectionMatrix is NEVER set to
        // rawMain — see "THE LOD CAMERA" comment near the top of this
        // file for why doing that made tile refinement bearing-dependent
        // (real geometry facing one way, nothing facing the other).
        try {
          updateTilesCameraProjection(this.map, tilesCamera);
          googleR.lastTilesCameraPose =
            updateTilesCameraPose(this.map, tilesCamera, anchorMercator, meterScale, tilesCameraAxes);
          // Re-read each frame so a window resize can't leave the error
          // metric working off a stale viewport size.
          tiles.setResolutionFromRenderer(tilesCamera, renderer);
          googleTilesDebugLog(googleR.lastTilesCameraPose);
        } catch (err) {
          console.error("[google-tiles] render() camera math threw:", err);
        }

        tiles.update();
        renderer.resetState();
        renderer.render(scene, camera);
        this.map.triggerRepaint();
      },

      // Deliberately does NOT dispose anything — resources persist
      // across 2D<->3D toggles for the rest of the session; see
      // LIFECYCLE at the top of this file.
      onRemove() {}
    };

    googleR.scene = scene;
    googleR.camera = camera;
    googleR.tilesCamera = tilesCamera;
    googleR.tiles = tiles;
    googleR.localTransform = localTransform;
    googleR.layer = layer;

    return googleR;
  })();

  return googleResourcesPromise;
}

/* Resolves once the tile loader has actually gone quiet — no
   downloads/parses in flight — for at least `quietMs`, after the root
   tileset has loaded. LOD refinement happens in several waves (coarse
   tiles first, then children as the screen-space error is
   re-evaluated), so a single "load finished" event fires after just
   the first wave; the quiet-period debounce avoids revealing a
   still-low-resolution intermediate frame as if it were finished.
   Rejects only if the ROOT tileset itself never loads within
   googleTilesMaxWaitMs; if the root loaded but children are still
   trickling in when that ceiling hits, resolves anyway rather than
   spinning forever — better to reveal a slightly-still-refining view
   than hang indefinitely. */
function waitForGoogleTilesReady(tiles) {
  const quietMs = (config.map3d && config.map3d.googleTilesQuietMs) || 500;
  const maxWaitMs = (config.map3d && config.map3d.googleTilesMaxWaitMs) || 20000;

  return new Promise((resolve, reject) => {
    let quietTimer = null;
    let maxTimer = null;
    let rootLoaded = !!tiles.rootTileset; // already-warm cache from a previous activation
    let done = false;

    function cleanup() {
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      tiles.removeEventListener("load-root-tileset", onRootLoaded);
      tiles.removeEventListener("tiles-load-end", onActivity);
      tiles.removeEventListener("tiles-load-start", onActivity);
      tiles.removeEventListener("load-error", onError);
    }
    function finish(fn, arg) {
      if (done) return;
      done = true;
      cleanup();
      fn(arg);
    }
    function scheduleQuietCheck() {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (tiles.stats.downloading === 0 && tiles.stats.parsing === 0) {
          finish(resolve);
        } else {
          scheduleQuietCheck();
        }
      }, quietMs);
    }
    function onRootLoaded() {
      rootLoaded = true;
      scheduleQuietCheck();
    }
    function onActivity() {
      if (rootLoaded) scheduleQuietCheck();
    }
    function onError(e) {
      if (e.tile === null) finish(reject, e.error || new Error("root tileset load-error"));
    }

    tiles.addEventListener("load-root-tileset", onRootLoaded);
    tiles.addEventListener("tiles-load-end", onActivity);
    tiles.addEventListener("tiles-load-start", onActivity);
    tiles.addEventListener("load-error", onError);

    maxTimer = setTimeout(() => {
      if (rootLoaded) finish(resolve);
      else finish(reject, new Error("timed out waiting for the root tileset to load"));
    }, maxWaitMs);

    if (rootLoaded) scheduleQuietCheck();
  });
}

/* Entry point called from set3DMode() (js/05-map-helpers.js) whenever
   3D mode is entered. Jumps the camera to a fixed, known-good start
   view, shows the loading veil, waits for that view's tiles to
   actually settle, then reveals it — or falls back to the simplified
   extruded-building view on any failure. Guarded throughout by
   googleActivationGeneration so a stale attempt (the user left 3D
   mode, or re-entered again, before this one finished) can never
   clobber a newer one. */
async function activateGoogleTilesMode() {
  const myGen = ++googleActivationGeneration;
  if (!is3DMode) return;

  if (!googleTilesConfigured() || googleTilesPreviouslyFailed() || googleTilesFallenBack) {
    applySimplified3DFallback();
    return;
  }

  const start = config.map3d.google3DStartView;
  if (start) {
    map.jumpTo({
      center: start.center || config.map3d.initialCenter,
      zoom: start.zoom,
      bearing: start.bearing,
      pitch: start.pitch
    });
  }

  showGoogleTilesLoading(true);

  try {
    const resources = await ensureGoogleTilesResources();
    if (myGen !== googleActivationGeneration || !is3DMode) return;

    if (!map.getLayer(LAYER_IDS.googleTiles)) map.addLayer(resources.layer);

    await waitForGoogleTilesReady(resources.tiles);
    if (myGen !== googleActivationGeneration || !is3DMode) return;

    [LAYER_IDS.buildingsExtrusion, LAYER_IDS.toursExtrusion].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    });
    // Google's tiles bundle their own imagery + geometry, so the flat
    // DOTD raster and the neutral background plane must be hidden —
    // otherwise any gap in Google's rendering silently shows through as
    // flat 2D aerial imagery instead of an obvious hole, which is what
    // disguised the earlier LOD-camera bugs as "the map looks flat".
    [LAYER_IDS.imagery, LAYER_IDS.background].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    });

    // The OSM reference overlay is the EXCEPTION: it's kept (subject to
    // the user's own #layersBtn toggle) because it carries the street
    // and building NAMES, which Google's tiles have none of. Moving it
    // to the top of the layer stack puts it above the 3D tiles so the
    // labels stay readable instead of being buried under the mesh.
    if (map.getLayer(LAYER_IDS.referenceOverlay)) {
      map.moveLayer(LAYER_IDS.referenceOverlay);
      map.setLayoutProperty(
        LAYER_IDS.referenceOverlay, "visibility", referenceOverlayOn ? "visible" : "none"
      );
    }
    map.setTerrain(null);

    googleTilesActive = true;
    active3DRenderer = "google";
    if (typeof track === "function") track("google3d_entered", {});
    updateMode3DBadge();
    showGoogleTilesLoading(false);
    if (el.toggleImageryBtn) {
      el.toggleImageryBtn.classList.add("is-disabled");
      el.toggleImageryBtn.setAttribute("aria-disabled", "true");
      el.toggleImageryBtn.title = "Aerial imagery (Google 3D active)";
    }
  } catch (err) {
    if (myGen !== googleActivationGeneration) return; // a newer attempt already took over
    markGoogleTilesFailed(err);
    showGoogleTilesLoading(false);
    deactivateGoogleTilesMode();
    applySimplified3DFallback();
  }
}

function deactivateGoogleTilesMode() {
  googleActivationGeneration++; // invalidate any in-flight activation
  showGoogleTilesLoading(false);
  if (map.getLayer(LAYER_IDS.googleTiles)) map.removeLayer(LAYER_IDS.googleTiles);
  showGoogleTilesAttribution(false);
  googleTilesActive = false;

  // Restore whatever these were showing before Google mode hid them —
  // respecting the user's own imagery/reference-overlay toggle state
  // rather than just forcing them back on.
  if (map.getLayer(LAYER_IDS.imagery)) {
    map.setLayoutProperty(LAYER_IDS.imagery, "visibility", imageryOn ? "visible" : "none");
  }
  if (map.getLayer(LAYER_IDS.background)) {
    map.setLayoutProperty(LAYER_IDS.background, "visibility", "visible");
  }
  if (map.getLayer(LAYER_IDS.referenceOverlay)) {
    // Put the label overlay back under the building/tour layers, where
    // js/11-boot.js originally added it (activateGoogleTilesMode lifts
    // it to the top so labels clear the 3D mesh).
    if (map.getLayer(LAYER_IDS.buildingsFill)) {
      map.moveLayer(LAYER_IDS.referenceOverlay, LAYER_IDS.buildingsFill);
    }
    map.setLayoutProperty(LAYER_IDS.referenceOverlay, "visibility", referenceOverlayOn ? "visible" : "none");
  }

  if (el.toggleImageryBtn) {
    el.toggleImageryBtn.classList.remove("is-disabled");
    el.toggleImageryBtn.removeAttribute("aria-disabled");
    el.toggleImageryBtn.title = "Aerial imagery";
  }
}

/* Restores the flat extruded-building fallback's visibility + terrain —
   the same layers set3DMode() already shows by default; this just
   re-asserts it after a Google-tiles attempt hides them, and updates
   the mode badge to reflect it. */
function applySimplified3DFallback() {
  [LAYER_IDS.buildingsExtrusion, LAYER_IDS.toursExtrusion].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", is3DMode ? "visible" : "none");
  });
  if (is3DMode && map.getSource(SOURCE_IDS.terrain)) {
    map.setTerrain({ source: SOURCE_IDS.terrain, exaggeration: 1 });
  }
  active3DRenderer = is3DMode ? "simple" : null;
  // Only a *fallback* if Google tiles were meant to be showing. A
  // build with no key configured is running the simple view by
  // design, and counting that as a failure would drown the signal.
  if (is3DMode && typeof track === "function" && googleTilesConfigured()) {
    track("google3d_fallback", { reason: googleTilesPreviouslyFailed() ? "prior_failure" : "fallback" });
  }
  updateMode3DBadge();
}

function updateMode3DBadge() {
  if (!el.mode3DBadge) return;
  if (!is3DMode || !active3DRenderer) {
    el.mode3DBadge.classList.remove("is-visible", "mode-google", "mode-simple");
    return;
  }
  const isGoogle = active3DRenderer === "google";
  el.mode3DBadge.textContent = isGoogle ? "3D: Google" : "3D: Simple";
  el.mode3DBadge.classList.add("is-visible");
  el.mode3DBadge.classList.toggle("mode-google", isGoogle);
  el.mode3DBadge.classList.toggle("mode-simple", !isGoogle);
}
