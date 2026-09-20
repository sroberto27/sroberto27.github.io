/**
 * Imagery sources and the primary-to-fallback failover.
 *
 * The reference project configures one image service and adds it to the map.
 * If that service stops answering, the basemap simply stops appearing, and a
 * neutral background is only reachable by a manual toggle. This module adds
 * the part that was missing: an actual failover with a recorded reason.
 *
 * Three states, in order: the configured primary, the configured fallback,
 * then a flat neutral ground. The last one is a real state, not a failure to
 * render. Scouting continues without imagery; it must never continue while
 * showing imagery that is stale, empty or from a year nobody was told about.
 *
 * Whatever is showing, the attribution names it, including the year. A
 * screenshot that does not say which flight it came from is not evidence.
 */

import { imagerySources } from "./region-config.js";

export const IMAGERY_STATES = Object.freeze(["pending", "active", "neutral"]);

/** Consecutive tile failures, with no success between, before giving up on a source. */
export const DEFAULT_FAILURE_THRESHOLD = 4;

/** Builds the MapLibre raster source for one configured imagery source. */
export function rasterSourceSpec(source) {
  return {
    type: "raster",
    tiles: [source.tileTemplate],
    tileSize: source.tileSize,
    maxzoom: source.maxZoom,
    attribution: source.attribution,
  };
}

/** The flat ground shown when no imagery is available. */
export function neutralBackgroundLayer(region, id = "slivr-neutral-ground-layer") {
  return {
    id,
    type: "background",
    paint: { "background-color": region.imagery.neutralBackgroundColor },
  };
}

/*
 * Sources and layers are addressed by string id on the map's own style, and a
 * source and a layer may legally share one. They do not here: an error naming
 * "slivr-imagery" would not say which of the two it meant, and that ambiguity
 * cost real debugging time.
 */
export const IMAGERY_SOURCE_ID = "slivr-imagery-source";
export const IMAGERY_LAYER_ID = "slivr-imagery-layer";
export const BACKGROUND_LAYER_ID = "slivr-neutral-ground-layer";

/**
 * The style the map is created with: a neutral ground and nothing else.
 *
 * Imagery is added after the map reports `load` rather than declared here,
 * which is the shape the reference project proved against this imagery
 * service. The reason to keep it is that swapping a source afterwards touches
 * only the imagery layer: rebuilding the whole style would discard every other
 * layer, so from Phase 1 onward the markers would vanish whenever a provider
 * failed over.
 */
export function baseStyle(region, { glyphs = null } = {}) {
  const style = {
    version: 8,
    sources: {},
    layers: [neutralBackgroundLayer(region, BACKGROUND_LAYER_ID)],
  };
  if (glyphs) style.glyphs = glyphs;
  return style;
}

/** The imagery layer, placed directly above the neutral ground. */
export function imageryLayerSpec() {
  return { id: IMAGERY_LAYER_ID, type: "raster", source: IMAGERY_SOURCE_ID };
}

/**
 * Tracks which imagery source is in use and why.
 *
 * A single failed tile is normal: a request times out, a tile falls outside
 * coverage. The source is abandoned only after consecutive failures with no
 * success in between, and any successful tile resets the count. Counting
 * without that reset would eventually retire a working service.
 *
 * Every transition is appended to `history` with a reason, so the verification
 * record can state what the provider actually did during a session rather than
 * what it was expected to do.
 *
 * @param {object} options
 * @param {object} options.region Region configuration.
 * @param {(change: object) => void} [options.onChange]
 * @param {number} [options.failureThreshold]
 * @param {() => string} [options.now]
 */
export function createImageryFailover({
  region,
  onChange = null,
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  now = () => new Date().toISOString(),
}) {
  const sources = imagerySources(region);
  let index = 0;
  let state = sources.length > 0 ? "pending" : "neutral";
  let consecutiveFailures = 0;
  const history = [];

  function current() {
    return state === "neutral" ? null : (sources[index] ?? null);
  }

  function snapshot() {
    const source = current();
    return Object.freeze({
      state,
      source,
      sourceId: source?.id ?? null,
      year: source?.year ?? null,
      attribution: source
        ? source.attribution
        : "No aerial imagery is available. The map is showing a neutral ground.",
      isFallback: source?.role === "fallback",
      history: Object.freeze([...history]),
    });
  }

  function record(event, reason) {
    history.push({ at: now(), event, sourceId: current()?.id ?? null, state, reason });
    onChange?.(snapshot());
  }

  /** A tile rendered. The current source is working. */
  function reportTileLoaded() {
    consecutiveFailures = 0;
    if (state === "pending") {
      state = "active";
      record("active", "a tile rendered from this source");
    }
    return snapshot();
  }

  /**
   * A tile failed. Moves on once the threshold is reached.
   * @param {string} [reason] What the provider reported.
   */
  function reportTileFailed(reason = "the imagery request failed") {
    if (state === "neutral") return snapshot();
    consecutiveFailures += 1;
    if (consecutiveFailures < failureThreshold) return snapshot();
    return advance(`${consecutiveFailures} consecutive tile failures: ${reason}`);
  }

  /** Abandons the current source immediately, for an unrecoverable failure. */
  function reportSourceUnusable(reason = "the imagery service is unusable") {
    if (state === "neutral") return snapshot();
    return advance(reason);
  }

  function advance(reason) {
    const abandoned = current();
    consecutiveFailures = 0;
    if (index + 1 < sources.length) {
      index += 1;
      state = "pending";
      history.push({
        at: now(),
        event: "failover",
        sourceId: abandoned?.id ?? null,
        state,
        reason: `${reason}; falling back to ${sources[index].label}`,
      });
      onChange?.(snapshot());
    } else {
      state = "neutral";
      history.push({
        at: now(),
        event: "neutral",
        sourceId: abandoned?.id ?? null,
        state,
        reason: `${reason}; no further source is configured`,
      });
      onChange?.(snapshot());
    }
    return snapshot();
  }

  /** Returns to the primary, for a manual retry. */
  function reset() {
    index = 0;
    consecutiveFailures = 0;
    state = sources.length > 0 ? "pending" : "neutral";
    record("reset", "the operator asked to try the primary source again");
    return snapshot();
  }

  return {
    get status() {
      return snapshot();
    },
    sources,
    reportTileLoaded,
    reportTileFailed,
    reportSourceUnusable,
    reset,
  };
}

/**
 * Builds one `exportImage` request for a bounding box in EPSG:3857.
 *
 * Used by the probe and by any content check, so the evidence is produced with
 * the same request shape the map uses rather than a second, kinder one.
 *
 * @param {object} source Normalised imagery source.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bbox
 * @param {{format?: string, size?: number}} [options]
 */
export function exportImageUrl(source, bbox, { format = null, size = null } = {}) {
  const box = [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY].join(",");
  let url = source.tileTemplate.replace("{bbox-epsg-3857}", box);
  if (format) url = url.replace(/([?&]format=)[^&]*/, `$1${format}`);
  if (size) url = url.replace(/([?&]size=)[^&]*/, `$1${size},${size}`);
  return url;
}

/** A square bounding box in EPSG:3857 metres, centred on a projected point. */
export function squareBbox([x, y], halfSizeM) {
  return { minX: x - halfSizeM, minY: y - halfSizeM, maxX: x + halfSizeM, maxY: y + halfSizeM };
}
