/**
 * Generates the public location catalog from the reviewed workbook.
 *
 * Run by hand after the workbook changes:
 *   node tools/build-catalog.mjs
 *
 * The workbook is private and is neither committed nor deployed. The JSON
 * written here is its published projection: reviewed public facts only, with
 * the research vocabulary preserved. "Need validation" and "Information has
 * not been found" are copied through exactly as written. Nothing in this file
 * may turn an unknown into a default, an empty string or a favourable claim.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readWorkbook, excelSerialToISODate } from "./lib/xlsx.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKBOOK = resolve(ROOT, "outputs/location_database/SLiVR_Location_Scouting_Database.xlsx");
const OUT_DIR = resolve(ROOT, "data/catalog");

export const CATALOG_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

/** Capture wording used in the workbook, mapped to the catalog vocabulary. */
const CAPTURE_STATUS = new Map([
  ["Current Treedis", "current"],
  ["Future candidate", "future"],
]);

const CAPTURE_STATE = new Map([
  ["Current", "current"],
  ["Future", "future"],
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** Trimmed string, or null when the cell is genuinely empty. */
function optionalText(value) {
  const trimmed = text(value);
  return trimmed === "" ? null : trimmed;
}

function number(value, field, context) {
  const parsed = Number(text(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`${context}: ${field} is not a number (${JSON.stringify(value)})`);
  }
  return parsed;
}

/** Locates the header row by its first cell and returns header plus data rows. */
function sheetTable(rows, firstHeaderCell, sheetName) {
  if (!rows) throw new Error(`${sheetName}: sheet not found in workbook`);
  const headerIndex = rows.findIndex((row) => text(row[0]) === firstHeaderCell);
  if (headerIndex === -1) {
    throw new Error(`${sheetName}: no header row starting with "${firstHeaderCell}"`);
  }
  return {
    header: rows[headerIndex].map(text),
    data: rows.slice(headerIndex + 1).filter((row) => text(row[0]) !== ""),
  };
}

/** Column-name lookup, so a column may be reordered without breaking the build. */
function columnLookup(header, sheetName) {
  const index = new Map(header.map((name, i) => [name, i]));
  return (name) => {
    if (!index.has(name)) throw new Error(`${sheetName}: missing column "${name}"`);
    return index.get(name);
  };
}

function splitIds(raw) {
  return text(raw)
    .split(";")
    .map((part) => part.trim())
    .filter((part) => /^(LOC|CAP|AREA|SRC)-\d+$/.test(part));
}

/**
 * A local file reference identifies a private project document. The filename
 * is kept because it names the evidence; the absolute path is not published.
 */
function normalizeReference(raw) {
  const value = text(raw);
  if (/^https?:\/\//i.test(value)) {
    return { url: value, reference: value, availability: "public" };
  }
  if (value === "") return { url: null, reference: null, availability: "unknown" };
  const name = basename(value.split(/[\\/]/).join("/"));
  return { url: null, reference: `docs/${name}`, availability: "private project document" };
}

function buildAreas(sheet) {
  const { header, data } = sheetTable(sheet, "Area ID", "Area Coverage");
  const col = columnLookup(header, "Area Coverage");
  return data.map((row) => {
    const id = text(row[col("Area ID")]);
    return {
      id,
      name: text(row[col("Area / cluster")]),
      description: text(row[col("Geographic description")]),
      productImplication: text(row[col("Map / product implication")]),
      priority: text(row[col("Implementation priority")]),
      validationBeforeCommitment: text(row[col("Validation before commitment")]),
      workbookCurrentCount: number(row[col("Current count")], "Current count", id),
      workbookFutureCount: number(row[col("Future count")], "Future count", id),
      locationIds: [],
      sourceIds: splitIds(row[col("Source IDs")]),
    };
  });
}

function buildLocations(sheet, areasByName) {
  const { header, data } = sheetTable(sheet, "Location ID", "Locations");
  const col = columnLookup(header, "Locations");

  return data.map((row) => {
    const id = text(row[col("Location ID")]);
    const areaName = text(row[col("Area / cluster")]);
    const area = areasByName.get(areaName);
    if (!area) throw new Error(`${id}: unknown area "${areaName}"`);

    const statusText = text(row[col("Capture status")]);
    const captureStatus = CAPTURE_STATUS.get(statusText);
    if (!captureStatus) throw new Error(`${id}: unrecognised capture status "${statusText}"`);

    return {
      id,
      name: text(row[col("Location name")]),
      areaId: area.id,
      captureStatus,
      venueType: text(row[col("Venue type")]),
      coverageSummary: text(row[col("Immersive coverage")]),
      address: {
        street: text(row[col("Street address")]),
        city: text(row[col("City")]),
        state: text(row[col("State")]),
        zip: text(row[col("ZIP")]),
      },
      position: [
        number(row[col("Longitude")], "Longitude", id),
        number(row[col("Latitude")], "Latitude", id),
      ],
      positionEvidence: text(row[col("Coordinate evidence")]),
      operator: text(row[col("Operator / steward")]),
      propertyAuthority: text(row[col("Property owner / authority")]),
      ownershipStatus: text(row[col("Ownership status")]),
      publicHours: {
        text: text(row[col("Published public hours")]),
        evidence: text(row[col("Hours evidence")]),
      },
      publicPhone: optionalText(row[col("Public phone")]),
      accessContact: text(row[col("Access / booking contact")]),
      website: optionalText(row[col("Website / primary page")]),
      filmingAccess: text(row[col("Filming / photography access")]),
      researchStatus: text(row[col("Research status")]),
      sourceIds: splitIds(row[col("Source IDs")]),
    };
  });
}

function buildCaptures(sheet) {
  const { header, data } = sheetTable(sheet, "Capture ID", "Capture Inventory");
  const col = columnLookup(header, "Capture Inventory");

  return data.map((row) => {
    const id = text(row[col("Capture ID")]);
    const stateText = text(row[col("Capture state")]);
    const state = CAPTURE_STATE.get(stateText);
    if (!state) throw new Error(`${id}: unrecognised capture state "${stateText}"`);
    const current = state === "current";

    return {
      id,
      locationId: text(row[col("Location ID")]),
      workbookLocationName: text(row[col("Location")]),
      state,
      grouping: text(row[col("Grouping")]),
      // A future candidate carries no provider identity. The absence is
      // structural rather than a placeholder string, so no interface can
      // render an invented tour or sweep for it.
      experienceId: current ? text(row[col("Experience ID")]) : null,
      sweepId: current ? text(row[col("Sweep ID")]) : null,
      // Supplied entry orientation in the provider frame. Zero is a valid
      // value and must survive every later validation step.
      startX: current ? number(row[col("Start rotation X")], "Start rotation X", id) : null,
      startY: current ? number(row[col("Start rotation Y")], "Start rotation Y", id) : null,
      url: current ? text(row[col("Treedis URL")]) : null,
      captureDate: text(row[col("Capture date")]),
      coverageNotes: text(row[col("Coverage / scan planning notes")]),
      validationStatus: text(row[col("Validation status")]),
    };
  });
}

function buildScoutDetails(sheet) {
  const { header, data } = sheetTable(sheet, "Location ID", "Scout Details");
  const col = columnLookup(header, "Scout Details");
  const field = (row, name) => text(row[col(name)]);

  return data.map((row) => ({
    locationId: field(row, "Location ID"),
    visualCharacter: field(row, "Visual / period character"),
    knownSpaces: field(row, "Known spaces / capacity"),
    parking: field(row, "Parking / vehicle access"),
    loading: field(row, "Loading / truck access"),
    basecamp: field(row, "Basecamp / crew support"),
    power: field(row, "Power"),
    restrooms: field(row, "Restrooms"),
    accessibility: field(row, "Accessibility"),
    ambientSound: field(row, "Ambient sound risks"),
    trafficImpact: field(row, "Traffic / public impact"),
    lightOrientation: field(row, "Light / orientation"),
    security: field(row, "Security"),
    catering: field(row, "Food / catering"),
    filmingRules: field(row, "Photo / filming rules"),
    permits: field(row, "Permits / approvals"),
    availabilityConstraints: field(row, "Availability constraints"),
    hazards: field(row, "Hazards / safety"),
    onSiteValidationPriorities: field(row, "On-site validation priorities"),
    immersiveCaptureNotes: field(row, "Immersive capture notes"),
    sourceIds: splitIds(row[col("Source IDs")]),
    recordStatus: field(row, "Scout record status"),
  }));
}

function buildSources(sheet) {
  const { header, data } = sheetTable(sheet, "Source ID", "Sources");
  const col = columnLookup(header, "Sources");

  return data.map((row) => {
    const scope = text(row[col("Location ID(s)")]);
    const locationIds = splitIds(scope);
    const reference = normalizeReference(row[col("URL or local path")]);
    return {
      id: text(row[col("Source ID")]),
      locationIds,
      // Some sources describe the inventory as a whole rather than a list of
      // records; the original wording is kept so the scope stays readable.
      scopeNote: locationIds.length === 0 ? scope : null,
      title: text(row[col("Source title")]),
      publisher: text(row[col("Publisher / organization")]),
      type: text(row[col("Source type")]),
      url: reference.url,
      reference: reference.reference,
      availability: reference.availability,
      accessed: text(row[col("Accessed")]),
      factsSupported: text(row[col("Facts supported")]),
      authorityLimitation: text(row[col("Authority / limitation")]),
    };
  });
}

/** Reads the workbook summary cell recording when the research was current. */
function researchSnapshot(locationsSheet) {
  for (let i = 0; i < locationsSheet.length; i += 1) {
    const labelIndex = locationsSheet[i].findIndex((cell) => text(cell) === "RESEARCH AS OF");
    if (labelIndex === -1) continue;
    const serial = text(locationsSheet[i + 1]?.[labelIndex]);
    if (serial) return excelSerialToISODate(serial);
  }
  return null;
}

export function buildCatalog(workbookPath = WORKBOOK) {
  const sheets = readWorkbook(workbookPath);

  const areas = buildAreas(sheets.get("Area Coverage"));
  const areasByName = new Map(areas.map((area) => [area.name, area]));
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const locations = buildLocations(sheets.get("Locations"), areasByName);
  const captures = buildCaptures(sheets.get("Capture Inventory"));
  const scoutDetails = buildScoutDetails(sheets.get("Scout Details"));
  const sources = buildSources(sheets.get("Sources"));

  for (const location of locations) {
    areasById.get(location.areaId).locationIds.push(location.id);
  }

  const common = { schemaVersion: SCHEMA_VERSION, catalogVersion: CATALOG_VERSION };

  return {
    manifest: {
      ...common,
      generatedAt: new Date().toISOString().slice(0, 10),
      sourceWorkbook: basename(workbookPath),
      researchSnapshot: researchSnapshot(sheets.get("Locations")),
      counts: {
        locations: locations.length,
        current: locations.filter((l) => l.captureStatus === "current").length,
        future: locations.filter((l) => l.captureStatus === "future").length,
        areas: areas.length,
        captures: captures.length,
        sources: sources.length,
      },
    },
    areas: { ...common, areas },
    locations: { ...common, locations },
    captures: { ...common, captures },
    scoutDetails: { ...common, scoutDetails },
    sources: { ...common, sources },
  };
}

function writeJson(name, value) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return name;
}

function main() {
  const catalog = buildCatalog();
  const written = [
    writeJson("manifest.json", catalog.manifest),
    writeJson("areas.v1.json", catalog.areas),
    writeJson("locations.v1.json", catalog.locations),
    writeJson("captures.v1.json", catalog.captures),
    writeJson("scout-details.v1.json", catalog.scoutDetails),
    writeJson("sources.v1.json", catalog.sources),
  ];
  const counts = catalog.manifest.counts;
  console.log(`catalog ${CATALOG_VERSION} — research snapshot ${catalog.manifest.researchSnapshot}`);
  console.log(
    `${counts.locations} locations (${counts.current} current, ${counts.future} future), ` +
      `${counts.areas} areas, ${counts.captures} captures, ${counts.sources} sources`,
  );
  console.log(`wrote ${written.length} files to data/catalog/`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
