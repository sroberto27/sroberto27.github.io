/**
 * Catalog repository: loads and validates the published catalog.
 *
 * The catalog is the researched evidence the whole application reasons about,
 * so it loads as a unit. If one file is missing, unreadable, from a different
 * catalog version, or structurally broken, nothing is published to the store
 * and the failure is reported with the file and the field that caused it.
 *
 * A partially loaded catalog is the dangerous outcome, because it looks like a
 * working application with silently missing places.
 *
 * The result is read-only. Indexes are built once so features can resolve a
 * location, its capture, its area and its sources without scanning.
 */

import { validateCatalog } from "../domain/catalog.js";

export const CATALOG_ERROR_CODES = Object.freeze({
  fetchFailed: "catalog-fetch-failed",
  notJson: "catalog-not-json",
  versionMismatch: "catalog-version-mismatch",
  invalid: "catalog-invalid",
});

const CATALOG_FILES = Object.freeze([
  { key: "locations", file: "locations.v1.json", property: "locations" },
  { key: "captures", file: "captures.v1.json", property: "captures" },
  { key: "areas", file: "areas.v1.json", property: "areas" },
  { key: "sources", file: "sources.v1.json", property: "sources" },
  { key: "scoutDetails", file: "scout-details.v1.json", property: "scoutDetails" },
]);

function failure(code, message, problems = []) {
  return { ok: false, error: { code, message, problems } };
}

/**
 * Reads one JSON document.
 *
 * `fetch` is injected so the same loader runs in the browser and under
 * `node --test` against fixture files.
 */
async function readJson(fetchJson, path) {
  try {
    return { ok: true, value: await fetchJson(path) };
  } catch (cause) {
    return failure(
      CATALOG_ERROR_CODES.fetchFailed,
      `Could not read ${path}: ${cause?.message ?? cause}`,
      [{ path, reason: String(cause?.message ?? cause) }],
    );
  }
}

/** Groups records by a key, preserving order within each group. */
function indexBy(records, key) {
  return new Map(records.map((record) => [record[key], record]));
}

/**
 * Loads the region configuration, the manifest and the five catalog files, then
 * validates the whole set.
 *
 * @param {object} options
 * @param {(path: string) => Promise<unknown>} options.fetchJson
 * @param {string} [options.catalogPath] Directory holding the catalog files.
 * @param {string} [options.regionPath] Region configuration file.
 * @param {object} [options.region] Already-loaded region configuration, so the
 *   boot sequence does not read the same file twice.
 * @returns {Promise<{ok: true, catalog: object}|{ok: false, error: {code: string, message: string, problems: Array}}>}
 */
export async function loadCatalog({
  fetchJson,
  catalogPath = "data/catalog",
  regionPath = "data/region/lafayette.region.json",
  region: preloadedRegion = null,
}) {
  const region = preloadedRegion
    ? { ok: true, value: preloadedRegion }
    : await readJson(fetchJson, regionPath);
  if (!region.ok) return region;

  const manifest = await readJson(fetchJson, `${catalogPath}/manifest.json`);
  if (!manifest.ok) return manifest;

  const catalogVersion = manifest.value?.catalogVersion;
  if (typeof catalogVersion !== "string" || !catalogVersion) {
    return failure(
      CATALOG_ERROR_CODES.invalid,
      "The catalog manifest does not declare a catalog version.",
      [{ path: "manifest.catalogVersion", reason: "is required" }],
    );
  }

  const collections = {};
  for (const { key, file, property } of CATALOG_FILES) {
    const result = await readJson(fetchJson, `${catalogPath}/${file}`);
    if (!result.ok) return result;

    const document = result.value;
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      return failure(CATALOG_ERROR_CODES.notJson, `${file} does not contain a catalog document.`, [
        { path: file, reason: "must be an object" },
      ]);
    }
    if (document.catalogVersion !== catalogVersion) {
      return failure(
        CATALOG_ERROR_CODES.versionMismatch,
        `${file} is catalog ${document.catalogVersion} but the manifest declares ${catalogVersion}. ` +
          "Nothing was loaded, because mixing catalog versions would present facts from two different snapshots.",
        [{ path: `${file}.catalogVersion`, reason: `expected ${catalogVersion}` }],
      );
    }
    if (!Array.isArray(document[property])) {
      return failure(CATALOG_ERROR_CODES.notJson, `${file} has no ${property} array.`, [
        { path: `${file}.${property}`, reason: "must be an array" },
      ]);
    }
    collections[key] = document[property];
  }

  const raw = { ...collections, manifest: manifest.value };
  const { ok, errors, warnings } = validateCatalog(raw, region.value);
  if (!ok) {
    return failure(
      CATALOG_ERROR_CODES.invalid,
      `The catalog failed validation with ${errors.length} error(s) and was not loaded.`,
      errors,
    );
  }

  return { ok: true, catalog: buildCatalog(raw, region.value, warnings) };
}

/** Assembles the read-only catalog with its lookup indexes. */
export function buildCatalog(raw, region, warnings = []) {
  const capturesByLocationId = indexBy(raw.captures, "locationId");
  const scoutDetailsByLocationId = indexBy(raw.scoutDetails, "locationId");

  return Object.freeze({
    version: raw.manifest.catalogVersion,
    researchSnapshot: raw.manifest.researchSnapshot ?? null,
    manifest: raw.manifest,
    region,
    locations: Object.freeze([...raw.locations]),
    captures: Object.freeze([...raw.captures]),
    areas: Object.freeze([...raw.areas]),
    sources: Object.freeze([...raw.sources]),
    scoutDetails: Object.freeze([...raw.scoutDetails]),
    locationsById: indexBy(raw.locations, "id"),
    capturesById: indexBy(raw.captures, "id"),
    areasById: indexBy(raw.areas, "id"),
    sourcesById: indexBy(raw.sources, "id"),
    capturesByLocationId,
    scoutDetailsByLocationId,
    warnings: Object.freeze([...warnings]),
  });
}

/** Everything known about one location, or null when the ID is unknown. */
export function locationView(catalog, locationId) {
  const location = catalog.locationsById.get(locationId);
  if (!location) return null;
  return {
    location,
    area: catalog.areasById.get(location.areaId) ?? null,
    capture: catalog.capturesByLocationId.get(locationId) ?? null,
    scoutDetail: catalog.scoutDetailsByLocationId.get(locationId) ?? null,
    sources: location.sourceIds.map((id) => catalog.sourcesById.get(id)).filter(Boolean),
  };
}

/** A fetcher for the browser that refuses a non-OK response rather than parsing an error page. */
export function createHttpFetchJson(basePath = "") {
  return async (path) => {
    const response = await fetch(`${basePath}${path}`, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.json();
  };
}
