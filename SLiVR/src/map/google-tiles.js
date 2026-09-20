/** Optional streamed exterior geometry. Resources persist across toggles, until map disposal. */
import { IMAGERY_LAYER_ID, BACKGROUND_LAYER_ID } from "./imagery.js";
import { initialTilesStatus } from "../shot-workspace/background.js";
import {
  buildGoogleTilesGroupTransform, updateTilesCameraProjection, updateTilesCameraPose,
} from "./google-tiles-camera.js";

export const GOOGLE_TILES_LAYER_ID = "slivr-google-tiles";

async function loadLibraries() {
  const [THREE, core, plugins, gltf, draco, ktx] = await Promise.all([
    import("three"), import("3d-tiles-renderer"), import("3d-tiles-renderer/core/plugins"),
    import("three/addons/loaders/GLTFLoader.js"), import("three/addons/loaders/DRACOLoader.js"),
    import("three/addons/loaders/KTX2Loader.js"),
  ]);
  return { THREE, ...core, ...plugins, ...gltf, ...draco, ...ktx };
}

export function createGoogleTiles({ map, maplibre, region, runtimeConfig, onStatus = () => {},
  load = loadLibraries, timers = globalThis, timeoutMs = 20000 }) {
  const initial = initialTilesStatus(runtimeConfig, region.optional3d);
  let resources = null;
  let pending = null;
  let enabled = false;
  let disposed = false;
  let generation = 0;
  let deadline = null;
  let status = { state: "off", message: "Aerial imagery" };

  function report(state, message, attribution = "") {
    status = { state, message, attribution };
    onStatus(status);
  }

  function showAerial(show) {
    for (const id of [IMAGERY_LAYER_ID, BACKGROUND_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    }
  }

  function clearDeadline() {
    timers.clearTimeout(deadline);
    deadline = null;
  }

  function detach() {
    if (map.getLayer(GOOGLE_TILES_LAYER_ID)) map.removeLayer(GOOGLE_TILES_LAYER_ID);
    showAerial(true);
  }

  function fail(message) {
    if (!enabled || disposed) return;
    enabled = false;
    generation++;
    clearDeadline();
    detach();
    report("fallback", `${message} Showing tilted aerial imagery.`);
  }

  async function ensureResources() {
    if (resources) return resources;
    if (pending) return pending;
    pending = load().then((libs) => {
      if (disposed) return null;
      const { THREE, TilesRenderer, WGS84_ELLIPSOID, GoogleCloudAuthPlugin,
        GLTFLoader, DRACOLoader, KTX2Loader } = libs;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const lodCamera = new THREE.PerspectiveCamera();
      lodCamera.matrixAutoUpdate = false;
      lodCamera.near = 1;
      lodCamera.far = 1000000;
      const axes = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
      const tiles = new TilesRenderer(region.optional3d.rootTileset);
      tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: runtimeConfig.googleMapsApiKey }));
      const draco = new DRACOLoader();
      draco.setDecoderPath(new URL("../../vendor/three/addons/libs/draco/", import.meta.url).href);
      const ktx = new KTX2Loader();
      ktx.setTranscoderPath(new URL("../../vendor/three/addons/libs/basis/", import.meta.url).href);
      const gltf = new GLTFLoader(tiles.manager);
      gltf.setDRACOLoader(draco);
      tiles.manager.addHandler(/\.gltf$|\.glb$/, gltf);
      const center = map.getCenter();
      const { groupMatrix, localTransform, anchorMercator, meterScale } =
        buildGoogleTilesGroupTransform(THREE, WGS84_ELLIPSOID, maplibre, center.lng, center.lat);
      tiles.group.matrix.copy(groupMatrix);
      tiles.group.matrixAutoUpdate = false;
      tiles.group.updateMatrixWorld(true);
      scene.add(tiles.group);
      scene.add(new THREE.AmbientLight(0xffffff, 1));
      tiles.setCamera(lodCamera);
      let renderer = null;
      let failed = false;
      const layer = {
        id: GOOGLE_TILES_LAYER_ID, type: "custom", renderingMode: "3d",
        onAdd(mapInstance, gl) {
          failed = false;
          if (!renderer) {
            renderer = new THREE.WebGLRenderer({ canvas: mapInstance.getCanvas(), context: gl, antialias: true });
            renderer.autoClear = false;
            ktx.detectSupport(renderer);
            gltf.setKTX2Loader(ktx);
          }
        },
        render(gl, args) {
          if (!enabled || disposed || failed || !renderer) return;
          try {
            camera.projectionMatrix.fromArray(args?.defaultProjectionData?.mainMatrix ?? args);
            camera.projectionMatrix.multiply(localTransform);
            updateTilesCameraProjection(map, lodCamera);
            updateTilesCameraPose(maplibre, map, lodCamera, anchorMercator, meterScale, axes);
            tiles.setResolutionFromRenderer(lodCamera, renderer);
            tiles.update();
            renderer.resetState();
            renderer.render(scene, camera);
            // A root JSON response alone does not prove that geometry rendered.
            if (tiles.visibleTiles.size > 0) {
              const attribution = tiles.getAttributions([]).map(a => a.value).filter(Boolean).join(" | ");
              if (status.state !== "active" || attribution !== status.attribution) {
                clearDeadline();
                showAerial(false);
                report("active", "Google photorealistic 3D · approximate exterior context", attribution);
              }
            } else if (status.state === "active") {
              showAerial(true);
              report("loading", "Loading 3D geometry for this view… Showing aerial imagery while waiting.");
              deadline = timers.setTimeout(() => fail("No 3D geometry rendered for this view."), timeoutMs);
            }
            map.triggerRepaint();
          } catch {
            failed = true;
            // MapLibre must finish its render pass before the layer is removed.
            queueMicrotask(() => fail("The 3D renderer could not draw the tiles."));
          }
        },
        onRemove() {},
      };
      tiles.addEventListener("load-error", (event) => {
        if (event.tile == null) queueMicrotask(() => fail("The 3D service could not load. Check the deployment key and Map Tiles API access."));
      });
      resources = { tiles, layer, dispose() {
        tiles.dispose(); draco.dispose(); ktx.dispose(); renderer?.dispose();
      } };
      return resources;
    }).finally(() => { pending = null; });
    return pending;
  }

  async function activate() {
    if (disposed) return;
    const current = ++generation;
    enabled = true;
    clearDeadline();
    if (initial.state !== "configured") {
      fail(initial.state === "absent" ? "Photorealistic 3D is not configured for this deployment." : initial.reason);
      return;
    }
    report("loading", "Loading Google photorealistic 3D… Aerial imagery remains visible until tiles render.");
    deadline = timers.setTimeout(() => fail("No 3D geometry rendered within the loading time limit."), timeoutMs);
    try {
      const ready = await ensureResources();
      if (!ready || disposed || !enabled || current !== generation) return;
      ready.tiles.resetFailedTiles();
      if (!map.getLayer(GOOGLE_TILES_LAYER_ID)) map.addLayer(ready.layer);
      map.triggerRepaint();
    } catch {
      if (current === generation) fail("The 3D libraries could not load.");
    }
  }

  function deactivate() {
    enabled = false;
    generation++;
    clearDeadline();
    detach();
    report("off", "Aerial imagery");
  }

  function onContextLost() { fail("The graphics context was lost."); }
  map.getCanvas().addEventListener("webglcontextlost", onContextLost);
  return {
    activate, deactivate,
    get status() { return status; },
    refreshVisibility() { if (status.state === "active") showAerial(false); },
    dispose() {
      if (disposed) return;
      deactivate();
      disposed = true;
      map.getCanvas().removeEventListener("webglcontextlost", onContextLost);
      resources?.dispose();
      resources = null;
    },
  };
}
