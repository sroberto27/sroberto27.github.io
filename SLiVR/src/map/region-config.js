/**
 * Region configuration: every imagery URL, year, attribution and bound.
 *
 * Nothing else in the application may name an imagery endpoint. Keeping them
 * here is what makes it possible to say, from one file, which service produced
 * a screenshot and which year it was flown.
 *
 * The excluded list is part of the configuration rather than a comment. One
 * service was tested and found not to cover this inventory, and the rule that
 * it can never become the Lafayette primary has to be enforced by something
 * that fails loudly, not remembered.
 */

import { metresPerPixel } from "../spatial/geo.js";

const REQUIRED_SOURCE_FIELDS = ["id", "label", "year", "service", "tileTemplate", "attribution"];

/** Ordered imagery candidates: the primary is tried first, then the fallback. */
export function imagerySources(region) {
  const imagery = region?.imagery ?? {};
  return [imagery.primary, imagery.fallback]
    .filter(Boolean)
    .map((source, index) => normalizeSource(source, index === 0 ? "primary" : "fallback"));
}

function normalizeSource(source, role) {
  return Object.freeze({
    role,
    id: source.id,
    label: source.label,
    year: source.year,
    service: source.service,
    tileTemplate: source.tileTemplate,
    tileSize: source.tileSize ?? 256,
    maxZoom: source.maxZoom ?? 20,
    attribution: source.attribution,
    sourcePixelSizeM: source.sourcePixelSizeM ?? null,
  });
}

/** Services that were tested and must never be configured for this region. */
export function excludedServices(region) {
  return region?.imagery?.excluded ?? [];
}

/**
 * Validates the imagery configuration.
 *
 * Errors block use of the configuration. Warnings describe something a
 * reviewer should decide about, following the same split the catalog
 * validation uses.
 *
 * @returns {{ok: boolean, errors: Array<{path: string, reason: string}>, warnings: Array<{path: string, reason: string}>}}
 */
export function validateRegionImagery(region) {
  const errors = [];
  const warnings = [];
  const error = (path, reason) => errors.push({ path, reason });
  const warn = (path, reason) => warnings.push({ path, reason });

  const imagery = region?.imagery;
  if (!imagery || typeof imagery !== "object") {
    return { ok: false, errors: [{ path: "imagery", reason: "is required" }], warnings };
  }

  const sources = imagerySources(region);
  if (sources.length === 0) error("imagery.primary", "is required");
  const latitude = region?.defaultView?.center?.[1];
  if (!sources.some((source) => source.role === "fallback")) {
    error("imagery.fallback", "is required, so a primary failure has somewhere to go");
  }

  for (const source of sources) {
    const path = `imagery.${source.role}`;
    for (const field of REQUIRED_SOURCE_FIELDS) {
      if (source[field] === undefined || source[field] === null || source[field] === "") {
        error(`${path}.${field}`, "is required");
      }
    }
    if (source.tileTemplate && !source.tileTemplate.includes("{bbox-epsg-3857}")) {
      error(
        `${path}.tileTemplate`,
        "must carry the {bbox-epsg-3857} token, because this is a dynamic image service rather than a tile pyramid",
      );
    }
    if (source.tileTemplate && !templateMatchesTileSize(source.tileTemplate, source.tileSize)) {
      error(
        `${path}.tileSize`,
        `is ${source.tileSize} but the request asks for a different pixel size, so tiles would be resampled`,
      );
    }
    if (source.attribution && String(source.year) && !source.attribution.includes(String(source.year))) {
      error(`${path}.attribution`, "must name the year, so a screenshot identifies what it shows");
    }
    // Requesting past the source resolution pays for pixels that do not exist.
    if (Number.isFinite(source.sourcePixelSizeM) && Number.isFinite(latitude)) {
      const requested = metresPerPixel(latitude, source.maxZoom, source.tileSize);
      if (requested < source.sourcePixelSizeM * 0.9) {
        warn(
          `${path}.maxZoom`,
          `requests about ${requested.toFixed(3)} m per pixel, finer than the ${source.sourcePixelSizeM.toFixed(3)} m ` +
            "the source holds, so the top zoom level upsamples",
        );
      }
    }
  }

  // A service recorded as not covering this inventory cannot be configured.
  const excludedIds = new Set(excludedServices(region).map((entry) => entry.service));
  for (const source of sources) {
    if (excludedIds.has(source.service)) {
      error(
        `imagery.${source.role}.service`,
        "is on the excluded list, which records that it was tested and did not cover this inventory",
      );
    }
  }
  for (const [index, entry] of excludedServices(region).entries()) {
    if (!entry.reason) error(`imagery.excluded[${index}].reason`, "is required");
  }

  if (!imagery.neutralBackgroundColor) {
    error("imagery.neutralBackgroundColor", "is required, so a total failure shows a flat ground rather than nothing");
  }
  if (!imagery.accuracyNote) {
    error("imagery.accuracyNote", "is required, because aerial imagery is context and not survey evidence");
  }

  const bounds = region?.bounds;
  for (const edge of ["west", "south", "east", "north"]) {
    if (!Number.isFinite(bounds?.[edge])) error(`bounds.${edge}`, "must be a finite number");
  }
  if (bounds && bounds.west >= bounds.east) error("bounds", "west must be less than east");
  if (bounds && bounds.south >= bounds.north) error("bounds", "south must be less than north");

  return { ok: errors.length === 0, errors, warnings };
}

/** The size= parameter and the declared tileSize must agree. */
function templateMatchesTileSize(template, tileSize) {
  const match = /[?&]size=(\d+),(\d+)/.exec(template);
  if (!match) return true;
  return Number(match[1]) === tileSize && Number(match[2]) === tileSize;
}

/** MapLibre bounds array, as [west, south, east, north]. */
export function boundsArray(region) {
  const { west, south, east, north } = region.bounds;
  return [west, south, east, north];
}

/** The note that must accompany any presentation of this imagery. */
export function accuracyNote(region) {
  return region?.imagery?.accuracyNote ?? "";
}
