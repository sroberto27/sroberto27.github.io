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
import { createDimensionControl, TILTED_PITCH_DEG } from "./controls.js";

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
 */
export function createMapAdapter({ container, region, maplibre, onEvent = null, webgl = true }) {
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
        // `bounds` overrides centre and zoom, so passing all three would leave
        // the configured default view silently doing nothing. The envelope is
        // what Explore is meant to open on; `defaultView` stays the reference
        // view other callers measure against.
        bounds: boundsArray(region),
        fitBoundsOptions: { padding: 24 },
        bearing: region.defaultView.bearing ?? 0,
        pitch: region.defaultView.pitch ?? 0,
        maxZoom: source?.maxZoom ?? 20,
        attributionControl: { compact: false },
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
    try {
      if (typeof maplibre.NavigationControl === "function") {
        map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");
      }
      if (typeof maplibre.ScaleControl === "function") {
        map.addControl(new maplibre.ScaleControl({ maxWidth: 140, unit: "metric" }), "bottom-right");
      }
      dimensionControl = createDimensionControl({
        isTilted: () => tilted,
        onToggle: () => setTilted(!tilted),
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
        } catch {
          // The map is being torn down; nothing to resize.
        }
      });
      resizeObserver.observe(container);
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
    } catch (cause) {
      emit({ type: "error", message: `The imagery source could not be swapped: ${cause.message}` });
    }
  }

  /**
   * Tilts the camera, or returns it flat and north-up.
   *
   * Aerial imagery seen at an angle is what makes a street read as a space
   * with height rather than a plan. Terrain is deliberately not added: this
   * region is almost flat, and a digital elevation provider would be a third
   * party this project has not validated or recorded.
   */
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
    styleReady = false;
    styledSourceId = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    markers?.dispose();
    markers = null;
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
    /** Abandons the current source now, used by the fallback check. */
    forceImageryFailure(reason) {
      const status = failover.reportSourceUnusable(reason);
      applyImagerySource();
      return status;
    },
    /** Draws a marker per location. Selection is reported, never written. */
    setLocations(locations, onSelect) {
      if (!map || disposed) return 0;
      markers ??= createMarkers({ map, maplibre, onSelect });
      markers.setLocations(locations);
      return markers.count;
    },
    setSelectedLocation(locationId) {
      markers?.setSelected(locationId ?? null);
    },
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
