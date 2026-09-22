/**
 * MapLibre behind one interface.
 *
 * The adapter emits events and answers questions; it never writes application
 * state. Everything it reports goes through an action, which is what keeps map
 * selection and list selection from correcting each other.
 *
 * The style itself is built by `imagery.js` as plain data, so the parts with
 * real decisions in them — which source, which attribution, what happens on
 * failure — are testable without a browser. What is left here is the part that
 * genuinely needs one.
 *
 * Failure is expected, not exceptional. WebGL may be unavailable, the library
 * may not load, and the image service may stop answering mid-session. Each of
 * those leaves the rest of the application usable and says what happened.
 */

import {
  baseStyle,
  rasterSourceSpec,
  imageryLayerSpec,
  createImageryFailover,
  IMAGERY_SOURCE_ID,
  IMAGERY_LAYER_ID,
  BACKGROUND_LAYER_ID,
} from "./imagery.js";
import { boundsArray } from "./region-config.js";
import { createMarkers } from "./markers.js";
import { TILTED_PITCH_DEG } from "./controls.js";
import { createExploreControls } from "./explore-controls.js";
import { createGoogleTiles } from "./google-tiles.js";
import { locationBounds, inventoryFitOptions } from "./viewport.js";

export const MAP_ERROR_CODES = Object.freeze({
  libraryUnavailable: "map-library-unavailable",
  webglUnavailable: "map-webgl-unavailable",
  initFailed: "map-init-failed",
});

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {object} options.region Region configuration.
 * @param {object} options.maplibre The `maplibre-gl` module.
 * @param {(event: object) => void} [options.onEvent] Receives adapter events.
 * @param {boolean|string} [options.webgl] Capability as reported by `app/capabilities.js`.
 * @param {boolean} [options.compact] Compact interactive context with externally supplied controls.
 */
export function createMapAdapter({ container, region, maplibre, onEvent = null, webgl = true, runtimeConfig = null, compact = false }) {
  const failover = createImageryFailover({
    region,
    onChange: (status) => emit({ type: "imagery-changed", status }),
  });

  let map = null;
  let disposed = false;
  // The source currently on the map, and whether the style is ready to accept
  // one at all.
  let styledSourceId = null;
  let styleReady = false;
  let resizeObserver = null;
  let markers = null;
  let tilted = false;
  let dimensionControl = null;
  let googleTiles = null;
  let inventoryBounds = null;
  let inventoryKey = null;
  let lastSize = "";
  let imageryVisible = true;
  let referenceVisible = false;
  let locations = [];
  let selectLocation = null;
  let selectedLocationId = null;
  let focusedLocationId = null;
  let focusedGroup = null;
  let focusGeneration = 0;
  const referenceSource = "slivr-reference-source";
  const referenceLayer = "slivr-reference-layer";

  function syncVisibility() {
    if (!map || disposed || !styleReady) return;
    const active = googleTiles?.status.state === "active";
    if (map.getLayer(IMAGERY_LAYER_ID)) map.setLayoutProperty(IMAGERY_LAYER_ID, "visibility", imageryVisible && !active ? "visible" : "none");
    if (map.getLayer(referenceLayer)) map.setLayoutProperty(referenceLayer, "visibility", referenceVisible ? "visible" : "none");
    if (map.getLayer(referenceLayer) && map.getStyle().layers.at(-1)?.id !== referenceLayer) {
      map.moveLayer(referenceLayer);
    }
    dimensionControl?.refresh();
  }

  function toggleReference() {
    if (!styleReady) return;
    referenceVisible = !referenceVisible;
    // The reference overlay is a translucent street map, not a label-only layer.
    if (referenceVisible && !map.getSource(referenceSource)) {
      map.addSource(referenceSource, {
        type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256, maxzoom: 19,
        attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
      });
      map.addLayer({ id: referenceLayer, type: "raster", source: referenceSource,
        paint: { "raster-opacity": 0.35 } });
    }
    syncVisibility();
  }

  function visit(locationId) {
    const location = locations.find(item => item.id === locationId);
    if (!location || disposed) return;
    selectLocation?.(locationId);
    focusLocation(locationId);
  }

  function focusLocation(locationId) {
    const location = locations.find(item => item.id === locationId);
    if (!map || disposed || !location) return;
    focusedLocationId = locationId;
    focusedGroup = null;
    const generation = ++focusGeneration;
    const settle = globalThis.requestAnimationFrame ?? (callback => callback());
    // Wait for the selected record's panels to settle before measuring the map.
    settle(() => settle(() => {
      if (disposed || generation !== focusGeneration) return;
      const plateHeight = container.parentElement?.querySelector(".imagery-plate")?.getBoundingClientRect().height ?? 0;
      map.resize?.();
      map.flyTo?.({
        center: location.position,
        zoom: Math.min(map.getMaxZoom?.() ?? 20, compact ? 16 : 19),
        duration: compact || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 550,
        padding: viewFitOptions(plateHeight).padding,
        retainPadding: false,
      });
    }));
  }

  function recenter() {
    focusedLocationId = null;
    focusedGroup = null;
    focusGeneration++;
    fitInventory();
  }

  function viewFitOptions(plateHeight = 0) {
    if (compact) return { padding: { top: 20, right: 20, bottom: 36, left: 20 }, maxZoom: 16, duration: 0 };
    const options = inventoryFitOptions(container.clientWidth, container.clientHeight, plateHeight);
    const panel = container.closest?.(".workspace")?.querySelector(".rail-left");
    const panelRect = !panel?.hidden && panel?.getBoundingClientRect?.();
    const mapRect = container.getBoundingClientRect?.();
    if (panelRect && mapRect && panelRect.top < mapRect.bottom && panelRect.bottom > mapRect.top && panelRect.right > mapRect.left) {
      options.padding.left = Math.min(container.clientWidth * .5, Math.max(options.padding.left, panelRect.right - mapRect.left + 24));
    }
    return options;
  }

  function focusGroup(members, animate = true) {
    const bounds = locationBounds(members);
    if (!map || disposed || !bounds) return;
    focusedLocationId = null;
    focusedGroup = members;
    focusGeneration++;
    const plateHeight = container.parentElement?.querySelector(".imagery-plate")?.getBoundingClientRect().height ?? 0;
    map.fitBounds(bounds, { ...viewFitOptions(plateHeight), maxZoom: Math.min(map.getMaxZoom?.() ?? 20, 19),
      duration: animate && !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 550 : 0,
      bearing: map.getBearing(), pitch: map.getPitch(), retainPadding: false });
  }

  function fitInventory() {
    if (!map || disposed || !inventoryBounds) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!(width > 0 && height > 0)) return;
    const plateHeight = container.parentElement?.querySelector(".imagery-plate")?.getBoundingClientRect().height ?? 0;
    map.fitBounds(inventoryBounds, {
      ...viewFitOptions(plateHeight),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    });
  }

  /** Whether the style is already loaded, tolerating a library that cannot say. */
  function isLoaded() {
    try {
      return Boolean(map?.loaded?.());
    } catch {
      return false;
    }
  }

  function emit(event) {
    onEvent?.(event);
  }

  /**
   * Creates the map.
   *
   * Returns a classified failure rather than throwing, because every caller
   * has the same job either way: keep the list and the dossier working and say
   * that the map is unavailable.
   */
  function create() {
    if (webgl === false) {
      return failure(
        MAP_ERROR_CODES.webglUnavailable,
        "This browser reports no WebGL support, so the map cannot be drawn. The location list and dossiers still work.",
      );
    }
    if (!maplibre || typeof maplibre.Map !== "function") {
      return failure(
        MAP_ERROR_CODES.libraryUnavailable,
        "The map library did not load. The location list and dossiers still work.",
      );
    }

    const source = failover.status.source;
    try {
      map = new maplibre.Map({
        container,
        style: baseStyle(region),
        // The planning envelope is a temporary view until the catalog supplies
        // actual pin bounds. It is not used to constrain user navigation.
        bounds: boundsArray(region),
        fitBoundsOptions: { padding: 24 },
        bearing: region.defaultView.bearing ?? 0,
        pitch: region.defaultView.pitch ?? 0,
        maxZoom: source?.maxZoom ?? 20,
        attributionControl: { compact: false },
        ...(compact ? { interactive: true, bearing: 0, pitch: 0 } : {}),
      });
    } catch (cause) {
      return failure(MAP_ERROR_CODES.initFailed, `The map could not be created: ${cause.message}`);
    }
    /*
     * Zoom, a compass that resets bearing, and a scale bar. The reference
     * builds its own control rail; these are the same affordances from the
     * library, themed by `20-explore.css`. A scouting map without a scale
     * gives no sense of whether a street has room for a unit.
     */
    if (!compact) try {
      if (typeof maplibre.NavigationControl === "function") {
        map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      }
      if (typeof maplibre.ScaleControl === "function") {
        map.addControl(new maplibre.ScaleControl({ maxWidth: 140, unit: "metric" }), "bottom-right");
      }
      if (typeof maplibre.GeolocateControl === "function") {
        const geolocate = new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
          trackUserLocation: false, showAccuracyCircle: true, showUserLocation: true,
        });
        geolocate.on("error", () => emit({ type: "error", message: "Your location could not be retrieved. Check browser location permissions or use Recenter." }));
        map.addControl(geolocate, "top-right");
      }
      if (typeof maplibre.FullscreenControl === "function") {
        map.addControl(new maplibre.FullscreenControl({ container: container.parentElement ?? container }), "top-right");
      }
      dimensionControl = createExploreControls({
        getState: () => ({ tilted, imagery: imageryVisible, layers: referenceVisible, tiles: googleTiles?.status.state ?? "off" }),
        recenter,
        toggleLayers: toggleReference,
        toggleImagery: () => {
          imageryVisible = !imageryVisible;
          syncVisibility();
          emit({ type: "imagery-changed", status: failover.status });
        },
        toggleDimension: () => setTilted(!tilted),
        visit,
      });
      map.addControl(dimensionControl, "top-right");
    } catch (cause) {
      emit({ type: "error", message: `Map controls could not be added: ${cause.message}` });
    }

    /*
     * Sources and layers cannot be added before the style has loaded, and the
     * map may already be loaded by the time this runs. Attaching the handler
     * without checking would mean the event had already fired, imagery would
     * never be added, and the map would sit empty with nothing reported.
     */
    const onStyleReady = () => {
      if (styleReady || disposed) return;
      styleReady = true;
      applyImagerySource();
      if (focusedLocationId) focusLocation(focusedLocationId);
      else fitInventory();
      if (tilted) activateTiles();
      emit({ type: "ready" });
    };
    if (isLoaded()) onStyleReady();
    else map.on("load", onStyleReady);

    /*
     * The library tracks the window, not the container. This one changes size
     * on its own whenever a rail appears or a mode changes, and a stale canvas
     * shows a map at the wrong size with no error.
     */
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        try {
          map?.resize();
          const size = `${container.clientWidth}x${container.clientHeight}:${viewFitOptions().padding.left}`;
          if (size !== lastSize) {
            lastSize = size;
            if (focusedLocationId) focusLocation(focusedLocationId);
            else if (focusedGroup) focusGroup(focusedGroup, false);
            else fitInventory();
          }
        } catch {
          // The map is being torn down; nothing to resize.
        }
      });
      resizeObserver.observe(container);
      const panel = container.closest?.(".workspace")?.querySelector(".rail-left");
      if (panel) resizeObserver.observe(panel);
    }
    map.on("data", (event) => {
      // A raster tile that actually rendered is the only evidence that the
      // configured source is answering.
      if (!disposed && event.sourceId === IMAGERY_SOURCE_ID && event.tile) {
        failover.reportTileLoaded();
      }
    });
    map.on("error", (event) => handleError(event));

    return { ok: true };
  }

  function handleError(event) {
    if (disposed) return;
    const sourceId = event?.sourceId ?? event?.source?.id ?? null;
    const message = event?.error?.message ?? "the map reported an error";
    if (sourceId === IMAGERY_SOURCE_ID) {
      failover.reportTileFailed(message);
      // A no-op unless the failover has actually moved on.
      applyImagerySource();
      return;
    }
    emit({ type: "error", message });
  }

  /**
   * Puts whatever source the failover now names onto the map.
   *
   * Only the imagery source and its layer are touched. Rebuilding the whole
   * style would discard every other layer, which from Phase 1 onward means the
   * markers would vanish whenever a provider failed.
   */
  function applyImagerySource() {
    if (!map || disposed || !styleReady) return;
    const { source } = failover.status;
    if ((source?.id ?? null) === styledSourceId) return;

    try {
      if (map.getLayer(IMAGERY_LAYER_ID)) map.removeLayer(IMAGERY_LAYER_ID);
      if (map.getSource(IMAGERY_SOURCE_ID)) map.removeSource(IMAGERY_SOURCE_ID);
      styledSourceId = null;
      if (!source) return;

      map.addSource(IMAGERY_SOURCE_ID, rasterSourceSpec(source));
      // Directly above the ground, so anything added later stays on top.
      const above = map.getStyle().layers.find((layer) => layer.id !== BACKGROUND_LAYER_ID);
      map.addLayer(imageryLayerSpec(), above?.id);

      /*
       * These do not throw on a rejected style mutation: the library reports
       * it through the error event and otherwise leaves the layer quietly
       * absent. Without this check the adapter would record the source as
       * applied, and no tile would ever be requested or fail, so the failover
       * would never fire either. The map would simply stay empty.
       */
      if (!map.getSource(IMAGERY_SOURCE_ID) || !map.getLayer(IMAGERY_LAYER_ID)) {
        styledSourceId = null;
        failover.reportSourceUnusable(
          `the map rejected the ${source.label} source without raising an error`,
        );
        applyImagerySource();
        return;
      }
      styledSourceId = source.id;
      googleTiles?.refreshVisibility();
      syncVisibility();
    } catch (cause) {
      emit({ type: "error", message: `The imagery source could not be swapped: ${cause.message}` });
    }
  }

  function activateTiles() {
    if (!map || disposed || !styleReady) return;
    googleTiles ??= createGoogleTiles({
      map, maplibre, region, runtimeConfig,
      onStatus: (status) => {
        syncVisibility();
        emit({ type: "tiles-changed", status });
      },
    });
    void googleTiles.activate();
  }

  /** Enters streamed 3D with an explicit aerial fallback, or returns north-up. */
  function setTilted(next) {
    tilted = Boolean(next);
    dimensionControl?.refresh();
    try {
      map?.easeTo({
        pitch: tilted ? TILTED_PITCH_DEG : 0,
        bearing: tilted ? map.getBearing() : 0,
        duration: 800,
      });
    } catch (cause) {
      emit({ type: "error", message: `The view could not be tilted: ${cause.message}` });
    }
    if (tilted) activateTiles();
    else googleTiles?.deactivate();
    syncVisibility();
    emit({ type: "dimension", tilted });
    return tilted;
  }

  function failure(code, message) {
    emit({ type: "unavailable", code, message });
    return { ok: false, error: { code, message } };
  }

  /** Releases the WebGL context and every listener. */
  function dispose() {
    disposed = true;
    focusGeneration++;
    styleReady = false;
    styledSourceId = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    markers?.dispose();
    markers = null;
    googleTiles?.dispose();
    googleTiles = null;
    try {
      map?.remove();
    } finally {
      map = null;
    }
  }

  return {
    create,
    dispose,
    get map() {
      return map;
    },
    get imagery() {
      return failover.status;
    },
    get imageryVisible() { return imageryVisible; },
    /** Abandons the current source now, used by the fallback check. */
    forceImageryFailure(reason) {
      const status = failover.reportSourceUnusable(reason);
      applyImagerySource();
      return status;
    },
    /** Draws a marker per location. Selection is reported, never written. */
    setLocations(nextLocations, onSelect) {
      if (!map || disposed) return 0;
      locations = nextLocations;
      selectLocation = onSelect;
      dimensionControl?.setLocations(locations);
      markers ??= createMarkers({ map, maplibre, onSelect: visit, onGroup: focusGroup });
      markers.setLocations(locations);
      const nextKey = JSON.stringify(locations.map(location => [location.id, location.position]));
      if (nextKey !== inventoryKey) {
        inventoryKey = nextKey;
        inventoryBounds = locationBounds(locations);
        focusedGroup = null;
        fitInventory();
      }
      return markers.count;
    },
    setSelectedLocation(locationId) {
      markers?.setSelected(locationId ?? null);
      dimensionControl?.setSelected(locationId ?? null);
      if (selectedLocationId !== locationId) {
        selectedLocationId = locationId;
        if (locationId) focusLocation(locationId);
        else { focusedLocationId = null; focusGeneration++; }
      }
    },
    recenter,
    toggleReference,
    get referenceVisible() { return referenceVisible; },
    zoomIn() { if (!disposed) map?.zoomIn(); },
    zoomOut() { if (!disposed) map?.zoomOut(); },
    resize() { if (!disposed) map?.resize(); },
    focusLocation,
    focusGroup,
    setTilted,
    get tilted() {
      return tilted;
    },
    retryImagery() {
      const status = failover.reset();
      applyImagerySource();
      return status;
    },
  };
}
