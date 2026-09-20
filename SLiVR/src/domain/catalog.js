/**
 * Catalog-wide records and integrity rules.
 *
 * The per-record schemas cannot express relationships, so this module carries
 * the checks that keep the catalog usable as a whole: identifier uniqueness,
 * referential integrity, the one-capture-per-location rule, agreement between
 * a location capture status and its capture state, area membership against the
 * counts the workbook recorded, and coordinates inside the configured region.
 *
 * Errors block a build. Warnings describe something a reviewer should look at
 * but that does not make the catalog unusable, following the same split the
 * reference project used for its data checks.
 */

import { defineRecord, validate, unknownMarkerIn } from "./schema.js";
import { locationRecord } from "./location.js";
import { captureRecord, validateCapture } from "./capture.js";
import { withinBounds } from "../spatial/geo.js";

export const areaRecord = defineRecord("Area", {
  id: { type: "catalogId", kind: "area", required: true },
  name: { type: "text", required: true },
  description: { type: "text", required: true },
  productImplication: { type: "text", required: true },
  priority: { type: "text", required: true },
  validationBeforeCommitment: { type: "text", required: true },
  workbookCurrentCount: { type: "number", required: true, integer: true, min: 0 },
  workbookFutureCount: { type: "number", required: true, integer: true, min: 0 },
  locationIds: { type: "array", required: true, of: { type: "catalogId", kind: "location" } },
  sourceIds: { type: "array", required: true, of: { type: "catalogId", kind: "source" } },
});

export const sourceRecord = defineRecord("Source", {
  id: { type: "catalogId", kind: "source", required: true },
  locationIds: { type: "array", required: true, of: { type: "catalogId", kind: "location" } },
  scopeNote: { type: "string", required: false, minLength: 1 },
  title: { type: "text", required: true },
  publisher: { type: "text", required: true },
  type: { type: "text", required: true },
  url: { type: "url", required: false },
  reference: { type: "string", required: false, minLength: 1 },
  availability: {
    type: "enum",
    required: true,
    values: ["public", "private project document", "unknown"],
  },
  accessed: { type: "isoDate", required: true },
  factsSupported: { type: "text", required: true },
  authorityLimitation: { type: "text", required: true },
});

const SCOUT_DETAIL_FIELDS = [
  "visualCharacter",
  "knownSpaces",
  "parking",
  "loading",
  "basecamp",
  "power",
  "restrooms",
  "accessibility",
  "ambientSound",
  "trafficImpact",
  "lightOrientation",
  "security",
  "catering",
  "filmingRules",
  "permits",
  "availabilityConstraints",
  "hazards",
  "onSiteValidationPriorities",
  "immersiveCaptureNotes",
];

export const scoutDetailRecord = defineRecord("ScoutDetail", {
  locationId: { type: "catalogId", kind: "location", required: true },
  ...Object.fromEntries(
    SCOUT_DETAIL_FIELDS.map((field) => [field, { type: "text", required: true }]),
  ),
  sourceIds: { type: "array", required: true, of: { type: "catalogId", kind: "source" } },
  recordStatus: { type: "text", required: true },
});

/** Absolute local paths must never reach a published file. */
const LOCAL_PATH_PATTERN = /(^|["\s])([A-Za-z]:[\\/]|file:\/\/|\/Users\/|\/home\/)/;

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function collectStrings(value, path, out) {
  if (typeof value === "string") {
    out.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, path ? `${path}.${key}` : key, out);
    }
  }
}

/**
 * Validates a complete catalog.
 *
 * @param {{areas: object[], locations: object[], captures: object[], scoutDetails: object[], sources: object[], manifest: object}} catalog
 * @param {object} region Parsed region configuration.
 * @returns {{ok: boolean, errors: Array<{path: string, reason: string}>, warnings: Array<{path: string, reason: string}>}}
 */
export function validateCatalog(catalog, region) {
  const errors = [];
  const warnings = [];
  const error = (path, reason) => errors.push({ path, reason });
  const warn = (path, reason) => warnings.push({ path, reason });

  const { areas = [], locations = [], captures = [], scoutDetails = [], sources = [] } = catalog;

  const collections = [
    ["areas", areas, areaRecord],
    ["locations", locations, locationRecord],
    ["captures", captures, captureRecord],
    ["sources", sources, sourceRecord],
    ["scoutDetails", scoutDetails, scoutDetailRecord],
  ];

  for (const [name, records, definition] of collections) {
    records.forEach((record, index) => {
      const { errors: recordErrors } = validate(definition, record);
      for (const problem of recordErrors) {
        error(`${name}[${index}].${problem.path}`, problem.reason);
      }
    });
    const key = name === "scoutDetails" ? "locationId" : "id";
    for (const repeated of duplicates(records.map((r) => r[key]))) {
      error(name, `duplicate ${key}: ${repeated}`);
    }
  }

  const areaIds = new Set(areas.map((a) => a.id));
  const locationIds = new Set(locations.map((l) => l.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const locationsById = new Map(locations.map((l) => [l.id, l]));

  const checkRefs = (collectionName, records, field, allowed, kind) => {
    records.forEach((record, index) => {
      const values = Array.isArray(record[field]) ? record[field] : [record[field]];
      for (const value of values) {
        if (value !== undefined && value !== null && !allowed.has(value)) {
          error(`${collectionName}[${index}].${field}`, `references unknown ${kind}: ${value}`);
        }
      }
    });
  };

  checkRefs("locations", locations, "areaId", areaIds, "area");
  checkRefs("locations", locations, "sourceIds", sourceIds, "source");
  checkRefs("areas", areas, "locationIds", locationIds, "location");
  checkRefs("areas", areas, "sourceIds", sourceIds, "source");
  checkRefs("captures", captures, "locationId", locationIds, "location");
  checkRefs("sources", sources, "locationIds", locationIds, "location");
  checkRefs("scoutDetails", scoutDetails, "locationId", locationIds, "location");
  checkRefs("scoutDetails", scoutDetails, "sourceIds", sourceIds, "source");

  // One capture per location, with agreeing status.
  const capturesByLocation = new Map();
  captures.forEach((capture, index) => {
    if (capturesByLocation.has(capture.locationId)) {
      error(`captures[${index}]`, `a second capture for ${capture.locationId}`);
    }
    capturesByLocation.set(capture.locationId, capture);

    const { errors: captureErrors } = validateCapture(capture, region.immersive ?? {});
    for (const problem of captureErrors) {
      error(`captures[${index}].${problem.path}`, problem.reason);
    }

    const location = locationsById.get(capture.locationId);
    if (location && location.captureStatus !== capture.state) {
      error(
        `captures[${index}].state`,
        `is "${capture.state}" but ${location.id} is "${location.captureStatus}"`,
      );
    }
    if (location && location.name !== capture.workbookLocationName) {
      warn(
        `captures[${index}].workbookLocationName`,
        `differs from the location name: "${capture.workbookLocationName}" vs "${location.name}"`,
      );
    }
  });

  for (const location of locations) {
    if (!capturesByLocation.has(location.id)) {
      error(`locations`, `${location.id} has no capture record`);
    }
  }

  // One scout-detail sheet per location.
  const detailLocationIds = new Set(scoutDetails.map((d) => d.locationId));
  for (const location of locations) {
    if (!detailLocationIds.has(location.id)) {
      warn("scoutDetails", `${location.id} has no scout-detail record`);
    }
  }

  // Area membership must match what the workbook recorded.
  areas.forEach((area, index) => {
    const members = locations.filter((l) => l.areaId === area.id);
    const current = members.filter((l) => l.captureStatus === "current").length;
    const future = members.filter((l) => l.captureStatus === "future").length;
    if (current !== area.workbookCurrentCount || future !== area.workbookFutureCount) {
      error(
        `areas[${index}]`,
        `membership ${current} current / ${future} future does not match the workbook ` +
          `${area.workbookCurrentCount} / ${area.workbookFutureCount}`,
      );
    }
    const declared = [...area.locationIds].sort().join(",");
    const derived = members.map((l) => l.id).sort().join(",");
    if (declared !== derived) {
      error(`areas[${index}].locationIds`, `does not match derived membership (${derived})`);
    }
  });

  // Coordinates inside the configured envelope, with a swapped-axis hint.
  locations.forEach((location, index) => {
    const [lon, lat] = location.position;
    if (lon > 0 && lat < 0) {
      error(`locations[${index}].position`, "looks like [latitude, longitude]");
    } else if (!withinBounds(location.position, region.bounds)) {
      error(
        `locations[${index}].position`,
        `is outside the ${region.regionId} envelope: ${lon}, ${lat}`,
      );
    }
  });

  // Nothing published may contain an absolute local path.
  const strings = [];
  collectStrings({ areas, locations, captures, scoutDetails, sources }, "", strings);
  for (const [path, value] of strings) {
    if (LOCAL_PATH_PATTERN.test(value)) {
      error(path, "contains an absolute local path and must not be published");
    }
  }

  // The unknown vocabulary must survive the build rather than being defaulted.
  const unknownCount = strings.filter(([, value]) => unknownMarkerIn(value)).length;
  if (unknownCount === 0) {
    error("catalog", "no unknown markers present, which means the research vocabulary was lost");
  }

  const counts = catalog.manifest?.counts;
  if (counts) {
    const actual = {
      locations: locations.length,
      current: locations.filter((l) => l.captureStatus === "current").length,
      future: locations.filter((l) => l.captureStatus === "future").length,
      areas: areas.length,
      captures: captures.length,
      sources: sources.length,
    };
    for (const [key, value] of Object.entries(actual)) {
      if (counts[key] !== value) {
        error(`manifest.counts.${key}`, `says ${counts[key]} but the catalog holds ${value}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, unknownCount };
}
