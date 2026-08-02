// tools/gis-harvest.mjs
//
// Fetches ArcGIS layers from the Iberia Parish and CPRA/CIMS servers, clips
// them to the real Iberia Parish boundary, and writes frozen GeoJSON
// snapshots into data/gis/layers/ for the GIS engine's "geojson" sourceType.
//
// This is defence 1 of 04-SPEC-gis-engine.md §8 ("Iberia Parish enforcement"):
// a spatial-filter query against the parish envelope, then a real clip
// against the actual parish boundary geometry -- not just the bounding box,
// and not just an include/drop test on whole features -- before anything is
// written to disk.
//
// Run manually, on a schedule -- NOT per visitor, NOT on demand from the
// site itself. Per docs/plans/gis/09-BUILD-PLAN.md's risk register, the
// Iberia server is small; this script identifies itself with a real User-
// Agent and throttles every request.
//
//   node tools/gis-harvest.mjs
//
// Output files are plain GeoJSON with one added top-level `_harvest` key
// (provenance metadata -- source URL, fetch date, filter/tolerance applied).
// That is a GeoJSON "foreign member", explicitly allowed by RFC 7946, and
// js/gis/gis-viewer.js's buildGeoJsonLayer() only ever reads `.features`, so
// it's ignored harmlessly by the engine. These files are NOT manifest
// documents (04-SPEC §1) -- never register them in data/manifest.json or
// wire them into the Admin Board's document set.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "data", "gis", "layers");

const USER_AGENT =
  "DTSWebsite-GISHarvest/1.0 (+https://dtsxr.com; one-time/scheduled static-site " +
  "layer harvest, not a per-visitor crawler; contact via dtsxr.com)";

// Throttle hard -- per 09-BUILD-PLAN.md's risk register ("Iberia server is
// small... throttle hard, identify the UA, schedule not on-demand").
const REQUEST_DELAY_MS = 900;

// Coordinate rounding applied to every written feature: 6 decimal degrees is
// ~0.11m at this latitude -- far finer than this map ever needs, but cheap
// to keep exact-looking geometry. One of two "simplify at harvest" measures
// per 04-SPEC §9 (see SIMPLIFY_TOLERANCE_DEG below for the other, real
// vertex-count reduction). Documented again, per layer, in
// data/gis/sources.json.
const COORD_PRECISION = 6;

// Real geometry simplification, applied only to the shoreline windows
// (04-SPEC §9: "simplify at harvest with a tolerance documented per layer").
// Ramer-Douglas-Peucker at this tolerance in degrees (~10m at Iberia's
// latitude -- imperceptible on a 220-520px map pane showing a ~70mi-wide
// parish) is applied to every LineString/MultiLineString below, after
// clipping (see clipGeometryToParish). The parish boundary polygon is
// deliberately left unsimplified: it's already 32KB, far under budget, and
// it's the clip mask every other layer's accuracy depends on.
const SIMPLIFY_TOLERANCE_DEG = 0.0001;

// From data/gis/sources.json's own parishGeometry.envelopeWGS84 (Phase 0).
const PARISH_ENVELOPE_WGS84 = [
  -92.050021835543717, 29.357702082864506, -91.221632647465057, 30.123086027489265
];

// Attribution text below is a best-guess placeholder, NOT final copy.
// data/gis/sources.json's openQuestions (iberia-terms-of-use,
// cpra-cims-terms-of-use) are still open -- the human is confirming directly
// with both agencies. Do not ship this wording to production without their
// sign-off; it exists so the layer isn't silently uncredited in the meantime.
const IBERIA_ATTRIBUTION =
  "Iberia Parish GIS -- attribution wording pending confirmation with the parish GIS office (see data/gis/sources.json openQuestions.iberia-terms-of-use)";
const CPRA_ATTRIBUTION =
  "Louisiana CPRA / LSU LaSARD (BICM program) -- attribution wording pending confirmation with CPRA/LSU (see data/gis/sources.json openQuestions.cpra-cims-terms-of-use)";

// --- Iberia Parish boundary -- defence 1's own clip geometry, and a layer
// in its own right (04-SPEC §8 recommends freezing it rather than
// re-fetching it live for the boundary mask). No spatial filter needed:
// this IS the boundary.
const BOUNDARY_JOB = {
  outFile: "parish-boundary.geojson",
  queryUrl: "https://maps.iberiagov.net/server/rest/services/Govt_Units/Updated_Parish_Boundary/MapServer/0/query",
  attribution: IBERIA_ATTRIBUTION
};

// --- CPRA/LSU LaSARD historical shoreline compilation. lasard/shoreline is
// a single feature layer compiling many separate historical surveys, each
// carrying its own SRC_DATE (a YYYYMMDD string) rather than one shoreline
// per calendar year -- there is no single "the 1935 shoreline" query. Real
// coverage inside the Iberia envelope (checked live before writing this
// script) clusters unevenly across ~160 years: dense around 1931-1937,
// 1946-1955, 1994-1999, then a solid single-year-per-page count in 2008 and
// 2015. Chose 5 representative *windows* (not the per-year
// lasard/contoursYYYY services -- see the note below) labelled by their
// dominant year, each queried by a SRC_DATE string range (safe as a
// lexical/numeric-equivalent comparison since the field is a fixed-width
// zero-padded YYYYMMDD string):
//
//   NOTE ON A REAL DEVIATION FROM data/gis/sources.json's OWN DESCRIPTION:
//   sources.json's cpra-coastal-change-shorelines entry describes
//   "lasard/contoursYYYY" as historical shoreline contour layers. Checked
//   live: those services are actually TopoBathyContours -- bathymetric/
//   topographic elevation isolines (a Z_FT class-break renderer, fields like
//   V_BENCH/V_EPOCH/THICKNESS), mined from surveys *near* each labelled
//   year, not shoreline position snapshots. They are the wrong dataset for a
//   "historical shoreline" time slider. lasard/shoreline (already CORS/
//   query-verified in Phase 0) is the actual shoreline compilation and is
//   what this script harvests instead. Flagged here and in sources.json so
//   task 3.14 doesn't wire up contoursYYYY expecting shoreline lines.
const SHORELINE_JOBS = [
  { year: 1935, where: "SRC_DATE>='19300101' AND SRC_DATE<='19391231'" },
  { year: 1948, where: "SRC_DATE>='19450101' AND SRC_DATE<='19551231'" },
  { year: 1998, where: "SRC_DATE>='19940101' AND SRC_DATE<='19991231'" },
  { year: 2008, where: "SRC_DATE>='20080101' AND SRC_DATE<='20081231'" },
  { year: 2015, where: "SRC_DATE>='20150101' AND SRC_DATE<='20151231'" }
].map((j) => ({
  ...j,
  outFile: `shoreline-${j.year}.geojson`,
  queryUrl: "https://cimsgeo3.coastal.louisiana.gov/arcgis/rest/services/lasard/shoreline/MapServer/0/query",
  attribution: CPRA_ATTRIBUTION
}));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error fetching ${url}: ${JSON.stringify(data.error)}`);
  return data;
}

// Paginates an ArcGIS /query?f=geojson call at the service's page size
// (assumed 1000, the default maxRecordCount on both servers -- confirmed
// live for lasard/shoreline; a bigger true limit just means one page).
// Throttled between pages, not just between jobs.
async function queryAllFeatures(queryUrl, { where, useEnvelopeFilter }) {
  const features = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      f: "geojson",
      where,
      outFields: "*",
      outSR: "4326",
      resultRecordCount: "1000",
      resultOffset: String(offset)
    });
    if (useEnvelopeFilter) {
      params.set("geometry", PARISH_ENVELOPE_WGS84.join(","));
      params.set("geometryType", "esriGeometryEnvelope");
      params.set("inSR", "4326");
      params.set("spatialRel", "esriSpatialRelIntersects");
    }
    const data = await fetchJson(`${queryUrl}?${params.toString()}`);
    const page = data.features || [];
    features.push(...page);
    offset += page.length;
    if (page.length < 1000) break;
    await sleep(REQUEST_DELAY_MS);
  }
  return features;
}

// Point-in-polygon via the standard ray-casting/crossing-number test, run
// across every ring of every polygon at once -- correctly handles holes by
// winding parity without a separate per-ring XOR step. ~10 lines, no Turf,
// per 04-SPEC §2's explicit steer.
function pointInRings(point, rings) {
  const [x, y] = point;
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
  }
  return inside;
}

function extractRings(geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

// Defence 1's second stage, and a REAL clip (04-SPEC §1 calls the output
// "Iberia-clipped snapshots"), not just an include/drop filter on the whole
// feature. First version of this script kept a feature's entire original
// geometry if any single vertex fell inside the parish -- confirmed live
// this was wrong, not just imprecise: one shoreline-1998 feature (USGS
// DDS-79, "Coastal Erosion and Wetland Change in Louisiana") is a single
// polyline digitized across the ENTIRE Louisiana coast, and keeping it
// whole because a few hundred thousand of its vertices happen to pass near
// Iberia both shipped a huge amount of non-Iberia geometry (defeats the
// purpose of a parish-scoped layer) and was the actual cause of an
// 11.3MB output file, ~5.7x the 2MB budget. Fix: walk each line's vertices
// and keep only the contiguous run(s) that fall inside the parish polygon,
// dropping everything else -- a real trim, not a keep-or-drop decision.
// Boundary-crossing vertices (the last point before exiting the parish)
// are dropped rather than interpolated to the true edge; acceptable at
// this map's scale and far simpler than real segment/polygon-edge
// intersection.
function clipCoordsToParishRuns(coords, parishRings) {
  const runs = [];
  let current = [];
  for (const pt of coords) {
    if (pointInRings(pt, parishRings)) {
      current.push(pt);
    } else if (current.length >= 2) {
      runs.push(current);
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

// Only line geometries are harvested by this tool today (both shoreline
// jobs are LineString/MultiLineString) -- other geometry types pass through
// unclipped, since nothing here produces them.
function clipGeometryToParish(geometry, parishRings) {
  let lines;
  if (geometry.type === "LineString") lines = [geometry.coordinates];
  else if (geometry.type === "MultiLineString") lines = geometry.coordinates;
  else return geometry;
  const runs = lines.flatMap((line) => clipCoordsToParishRuns(line, parishRings));
  if (!runs.length) return null;
  return runs.length === 1 ? { type: "LineString", coordinates: runs[0] } : { type: "MultiLineString", coordinates: runs };
}

// Ramer-Douglas-Peucker, run iteratively (explicit stack, not recursion) --
// a 475k-vertex real-world feature makes naive recursive DP a stack-depth
// risk. Perpendicular distance is computed in plain lng/lat degrees, not a
// projected plane: fine at this tolerance and this parish's small latitude
// span, and this is a one-time offline harvest script, not the live engine,
// so the extra precision of a projection isn't worth the code.
function perpendicularDistance(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(x - cx, y - cy);
}

function simplifyLine(points, toleranceDeg) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    const a = points[start], b = points[end];
    let maxDist = 0, idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], a, b);
      if (d > maxDist) { maxDist = d; idx = i; }
    }
    if (idx !== -1 && maxDist > toleranceDeg) {
      keep[idx] = 1;
      stack.push([start, idx]);
      stack.push([idx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function simplifyGeometry(geometry, toleranceDeg) {
  if (geometry.type === "LineString") {
    return { ...geometry, coordinates: simplifyLine(geometry.coordinates, toleranceDeg) };
  }
  if (geometry.type === "MultiLineString") {
    return { ...geometry, coordinates: geometry.coordinates.map((line) => simplifyLine(line, toleranceDeg)) };
  }
  return geometry;
}

function roundCoords(geometry) {
  function round(n) {
    return Math.round(n * 10 ** COORD_PRECISION) / 10 ** COORD_PRECISION;
  }
  function walk(c) {
    if (typeof c[0] === "number") return [round(c[0]), round(c[1])]; // drop any z/m values
    return c.map(walk);
  }
  return { ...geometry, coordinates: walk(geometry.coordinates) };
}

function writeLayer(outFile, features, meta) {
  const fc = {
    type: "FeatureCollection",
    features,
    _harvest: { tool: "tools/gis-harvest.mjs", harvestedAt: new Date().toISOString(), ...meta }
  };
  const json = JSON.stringify(fc);
  const bytes = Buffer.byteLength(json);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, outFile), json);
  const budgetFlag = bytes > 2_000_000 ? "  *** EXCEEDS 2MB BUDGET (04-SPEC §9) ***" : "";
  console.log(`  wrote ${outFile}: ${features.length} features, ${(bytes / 1024).toFixed(1)} KB${budgetFlag}`);
}

async function harvestBoundary(job) {
  console.log(`Boundary: ${job.queryUrl}`);
  const data = await fetchJson(`${job.queryUrl}?f=geojson&where=1=1&outFields=*&outSR=4326`);
  const features = (data.features || []).map((f) => ({ ...f, geometry: roundCoords(f.geometry) }));
  writeLayer(job.outFile, features, {
    sourceUrl: job.queryUrl,
    filter: "none -- this file IS the parish boundary / the clip mask for every other layer",
    coordPrecisionDecimals: COORD_PRECISION,
    attribution: job.attribution
  });
  const rings = features.length ? extractRings(features[0].geometry) : [];
  if (!rings.length) throw new Error("Parish boundary fetch returned no usable polygon geometry -- aborting, nothing else can be clipped against it.");
  return rings;
}

async function harvestShorelineWindow(job, parishRings) {
  console.log(`Shoreline ${job.year}: ${job.where}`);
  const raw = await queryAllFeatures(job.queryUrl, { where: job.where, useEnvelopeFilter: true });
  const out = [];
  for (const f of raw) {
    const clippedGeom = clipGeometryToParish(f.geometry, parishRings);
    if (!clippedGeom) continue;
    out.push({
      ...f,
      geometry: roundCoords(simplifyGeometry(clippedGeom, SIMPLIFY_TOLERANCE_DEG)),
      properties: { ...f.properties, year: job.year }
    });
  }
  writeLayer(job.outFile, out, {
    sourceUrl: job.queryUrl,
    dateWindow: job.where,
    envelopeFilterWGS84: PARISH_ENVELOPE_WGS84,
    coordPrecisionDecimals: COORD_PRECISION,
    simplifyToleranceDegrees: SIMPLIFY_TOLERANCE_DEG,
    envelopeMatchCount: raw.length,
    parishClippedCount: out.length,
    attribution: job.attribution
  });
  return out;
}

async function main() {
  console.log(`GIS harvest starting -- UA: ${USER_AGENT}\n`);

  const parishRings = await harvestBoundary(BOUNDARY_JOB);
  await sleep(REQUEST_DELAY_MS);

  for (const job of SHORELINE_JOBS) {
    await harvestShorelineWindow(job, parishRings);
    await sleep(REQUEST_DELAY_MS);
  }

  console.log("\nDone. Spot-check the written files before wiring them into a gisMap document:");
  console.log("  - a feature's coordinates should fall inside Iberia Parish, not just its bounding box");
  console.log("  - every file should be well under the 2MB budget (04-SPEC §9)");
}

main().catch((err) => {
  console.error("\nHarvest failed:", err.message);
  process.exitCode = 1;
});
