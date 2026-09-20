/**
 * Runtime capability detection.
 *
 * Feature modules consult this object instead of assuming what a browser or a
 * provider will do. Only what can be observed right now is reported.
 *
 * `"unknown"` is a real value here and is never rounded to `false`. Whether the
 * immersive provider permits embedding from this origin, and whether aerial
 * tiles can be read back from a canvas, cannot be determined without making the
 * request; reporting them as unavailable would state a finding that has not
 * been made. Treating them as available would be worse.
 */

export const UNKNOWN = "unknown";

/**
 * @param {object} [options]
 * @param {object} [options.win] Window-like object.
 * @param {object} [options.runtimeConfig] Optional gitignored configuration.
 */
export function detectCapabilities({ win = globalThis, runtimeConfig = null } = {}) {
  return Object.freeze({
    indexedDB: hasIndexedDB(win),
    webgl: detectWebgl(win),
    // Determined by the imagery probe in Phase 0.3.
    canvasReadback: UNKNOWN,
    googleTiles: runtimeConfig?.googleMapsApiKey ? "configured" : "absent",
    // Determined by the provider reconnaissance in Phase 0.4.
    treedis: Object.freeze({
      embedding: UNKNOWN,
      messaging: UNKNOWN,
      sweepSwitchWithoutReload: UNKNOWN,
      poseReporting: UNKNOWN,
    }),
    detectedAt: new Date().toISOString(),
  });
}

function hasIndexedDB(win) {
  try {
    return Boolean(win.indexedDB) && typeof win.indexedDB.open === "function";
  } catch {
    // Accessing storage can throw outright in a restricted profile.
    return false;
  }
}

/**
 * Reports WebGL support without keeping the context alive.
 *
 * Returns `"unknown"` where there is no document to test with, such as a
 * non-browser runtime, rather than claiming the absence of support.
 */
function detectWebgl(win) {
  const doc = win.document;
  if (!doc || typeof doc.createElement !== "function") return UNKNOWN;
  try {
    const canvas = doc.createElement("canvas");
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const DIAGNOSTICS_OFF = Object.freeze({
  forceStorageFailure: false,
  forceImageryFailure: false,
  viewerOrigin: null,
});

/**
 * Reads the optional local diagnostics flags.
 *
 * These exist so a tester can force a failure path that cannot otherwise be
 * produced on demand: a storage write refusing, or the primary imagery service
 * becoming unreachable. They live in a SLiVR-scoped storage key, default to
 * off, and are never written by the application itself.
 */
export function readDiagnostics(win = globalThis, keyPrefix = "slivr:") {
  try {
    const raw = win.localStorage?.getItem(`${keyPrefix}diagnostics`);
    if (!raw) return DIAGNOSTICS_OFF;
    const parsed = JSON.parse(raw);
    return Object.freeze({
      forceStorageFailure: parsed?.forceStorageFailure === true,
      forceImageryFailure: parsed?.forceImageryFailure === true,
      // Loads the viewer from one of the region's other configured hosts.
      // Validated against that list before use; an unlisted value is ignored.
      viewerOrigin: typeof parsed?.viewerOrigin === "string" ? parsed.viewerOrigin : null,
    });
  } catch {
    return DIAGNOSTICS_OFF;
  }
}

/** Human-readable capability lines for the shell and for test evidence. */
export function describeCapabilities(capabilities) {
  return [
    ["Local database", capabilities.indexedDB ? "IndexedDB available" : "IndexedDB unavailable"],
    ["WebGL", capabilities.webgl === true ? "available" : String(capabilities.webgl)],
    ["Aerial canvas read-back", String(capabilities.canvasReadback)],
    ["Optional 3D credential", capabilities.googleTiles],
    ["Immersive provider embedding", String(capabilities.treedis.embedding)],
  ];
}
