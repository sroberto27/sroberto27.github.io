/**
 * Imagery coverage probe.
 *
 *   node tools/probe-imagery.mjs [--out outputs/imagery-probe] [--keep-images]
 *
 * Answers one question with evidence: does the configured imagery actually
 * hold pixels over this inventory? The service publishes an extent covering
 * much of the state while holding imagery only for selected areas, and its own
 * metadata records the no-data value as 0, so a request outside coverage
 * returns a valid, entirely black image with a 200 response. A status-code
 * check would call that success.
 *
 * One representative point per operational area is taken from the catalog, so
 * the probe tests the places the inventory actually contains rather than a
 * convenient centre. Each point is requested from the primary, the fallback
 * and every excluded service, at the source ground resolution.
 *
 * Pixels are read from an uncompressed BMP rendering of the same request. The
 * production requests use JPEG, which is far smaller; the probe records the
 * JPEG response alongside so the shape the map actually uses is exercised too.
 *
 * Results are written under `outputs/`, which is not committed, so probe
 * imagery and the provider response are never published.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeBmp } from "./lib/bmp.mjs";
import { classifyImageContent, CONTENT_THRESHOLDS } from "../src/map/image-content.js";
import { imagerySources, excludedServices, validateRegionImagery } from "../src/map/region-config.js";
import { exportImageUrl, squareBbox } from "../src/map/imagery.js";
import { toWebMercator } from "../src/spatial/geo.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROBE_SIZE_PX = 512;
/**
 * Ground sample distance used when a source does not declare its own.
 *
 * The probe sizes its request from the resolution the source actually holds,
 * rather than from a map zoom level. Asking for finer detail makes the service
 * upsample, which smooths the very texture the coverage check measures.
 */
const FALLBACK_PIXEL_SIZE_M = 0.15;
const REQUEST_TIMEOUT_MS = 30000;

/** Half-width in metres of a probe square at a source's own resolution. */
function probeHalfWidthM(source) {
  const pixelSize = Number.isFinite(source.sourcePixelSizeM)
    ? source.sourcePixelSizeM
    : FALLBACK_PIXEL_SIZE_M;
  return (pixelSize * PROBE_SIZE_PX) / 2;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

/** One representative location per operational area, in catalog order. */
export function representativePoints(catalog) {
  const byArea = new Map();
  for (const location of catalog.locations) {
    if (!byArea.has(location.areaId)) byArea.set(location.areaId, location);
  }
  return [...byArea.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([areaId, location]) => ({
      areaId,
      areaName: catalog.areas.find((area) => area.id === areaId)?.name ?? areaId,
      locationId: location.id,
      locationName: location.name,
      position: location.position,
    }));
}

async function request(url) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      bytes,
      byteLength: bytes.length,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (cause) {
    return {
      ok: false,
      status: 0,
      contentType: null,
      bytes: new Uint8Array(),
      byteLength: 0,
      elapsedMs: Date.now() - startedAt,
      error: cause.name === "AbortError" ? `timed out after ${REQUEST_TIMEOUT_MS} ms` : cause.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Requests one point from one source and classifies what came back. */
async function probePoint(source, point, { outDir, keepImages }) {
  const halfM = probeHalfWidthM(source);
  const bbox = squareBbox(toWebMercator(point.position), halfM);

  const bmpUrl = exportImageUrl(source, bbox, { format: "bmp", size: PROBE_SIZE_PX });
  const jpgUrl = exportImageUrl(source, bbox, { size: PROBE_SIZE_PX });

  const [bmp, jpg] = await Promise.all([request(bmpUrl), request(jpgUrl)]);

  const result = {
    sourceId: source.id,
    sourceRole: source.role,
    year: source.year,
    areaId: point.areaId,
    areaName: point.areaName,
    locationId: point.locationId,
    position: point.position,
    bbox3857: [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY],
    groundSampleDistanceM: Number((halfM * 2 / PROBE_SIZE_PX).toFixed(4)),
    endpoint: bmpUrl,
    productionRequest: {
      url: jpgUrl,
      status: jpg.status,
      contentType: jpg.contentType,
      byteLength: jpg.byteLength,
      elapsedMs: jpg.elapsedMs,
    },
    probeRequest: {
      status: bmp.status,
      contentType: bmp.contentType,
      byteLength: bmp.byteLength,
      elapsedMs: bmp.elapsedMs,
    },
  };

  if (!bmp.ok || !bmp.contentType?.startsWith("image/bmp")) {
    result.verdict = "no-image";
    result.reason = bmp.error
      ? `the request failed: ${bmp.error}`
      : `the service returned ${bmp.status} ${bmp.contentType ?? "with no content type"}`;
    return result;
  }

  let decoded;
  try {
    decoded = decodeBmp(bmp.bytes);
  } catch (cause) {
    result.verdict = "no-image";
    result.reason = `the response did not decode: ${cause.message}`;
    return result;
  }

  const { verdict, reason, statistics } = classifyImageContent(decoded);
  result.verdict = verdict;
  result.reason = reason;
  result.statistics = {
    meanStdDev: round(statistics.meanStdDev),
    nearBlackFraction: round(statistics.nearBlackFraction, 4),
    dominantColourFraction: round(statistics.dominantColourFraction, 4),
    distinctColours: statistics.distinctColours,
    mean: statistics.mean.map((value) => round(value, 1)),
    min: statistics.min,
    max: statistics.max,
  };

  if (keepImages) {
    const name = `${source.id}_${point.areaId}_${point.locationId}`;
    writeFileSync(join(outDir, `${name}.bmp`), bmp.bytes);
    if (jpg.ok && jpg.byteLength > 0) writeFileSync(join(outDir, `${name}.jpg`), jpg.bytes);
    result.images = { bmp: `${name}.bmp`, jpg: jpg.ok ? `${name}.jpg` : null };
  }

  return result;
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

/**
 * Confirms an excluded service is still what the configuration says it is.
 *
 * The excluded entry is a layer inside a map service, not an image service, so
 * it is rendered through the parent map service `export` operation with that
 * layer shown. Calling the image-service operation instead would return a 400
 * that says nothing at all about coverage.
 */
async function probeExcluded(entry, point) {
  const layerMatch = /^(.*\/MapServer)\/(\d+)$/.exec(entry.service);
  const source = {
    id: entry.id,
    role: "excluded",
    tileTemplate: layerMatch
      ? `${layerMatch[1]}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857` +
        `&size=${PROBE_SIZE_PX},${PROBE_SIZE_PX}&format=bmp&transparent=false` +
        `&layers=show:${layerMatch[2]}&f=image`
      : `${entry.service}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857` +
        `&size=${PROBE_SIZE_PX},${PROBE_SIZE_PX}&format=bmp&f=image&bandIds=0,1,2`,
  };
  const bbox = squareBbox(toWebMercator(point.position), probeHalfWidthM(source));
  const url = exportImageUrl(source, bbox);
  const response = await request(url);

  const result = {
    id: entry.id,
    service: entry.service,
    operation: layerMatch ? "MapServer export, layers=show:" + layerMatch[2] : "ImageServer exportImage",
    configuredReason: entry.reason,
    areaId: point.areaId,
    locationId: point.locationId,
    endpoint: url,
    status: response.status,
    contentType: response.contentType,
    byteLength: response.byteLength,
  };

  if (!response.ok || !response.contentType?.startsWith("image/bmp")) {
    result.verdict = "no-image";
    result.reason = response.error ?? `the service returned ${response.status}`;
    return result;
  }
  try {
    const { verdict, reason, statistics } = classifyImageContent(decodeBmp(response.bytes));
    result.verdict = verdict;
    result.reason = reason;
    result.statistics = {
      meanStdDev: round(statistics.meanStdDev),
      nearBlackFraction: round(statistics.nearBlackFraction, 4),
      distinctColours: statistics.distinctColours,
    };
  } catch (cause) {
    result.verdict = "no-image";
    result.reason = `the response did not decode: ${cause.message}`;
  }
  return result;
}

/**
 * A point that is inside the published extent but known to hold no imagery.
 *
 * This is the calibration control. Without it, "all six areas returned pixels"
 * rests on thresholds nobody checked against a real negative.
 */
const NO_COVERAGE_CONTROLS = Object.freeze([
  { label: "open water inside the published extent", position: [-90.5, 28.9] },
  { label: "rural land inside the published extent", position: [-91.5, 31.5] },
]);

async function probeControls(source, { outDir, keepImages }) {
  const results = [];
  for (const control of NO_COVERAGE_CONTROLS) {
    const point = {
      areaId: "CONTROL",
      areaName: control.label,
      locationId: "CONTROL",
      locationName: control.label,
      position: control.position,
    };
    const result = await probePoint(source, point, { outDir, keepImages });
    results.push({ ...result, control: control.label });
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.indexOf("--out");
  const outDir = resolve(ROOT, outArg === -1 ? "outputs/imagery-probe" : args[outArg + 1]);
  const keepImages = args.includes("--keep-images");

  const region = readJson("data/region/lafayette.region.json");
  const catalog = {
    locations: readJson("data/catalog/locations.v1.json").locations,
    areas: readJson("data/catalog/areas.v1.json").areas,
  };

  const configuration = validateRegionImagery(region);
  for (const problem of configuration.warnings ?? []) {
    console.log(`WARN   ${problem.path}: ${problem.reason}`);
  }
  if (!configuration.ok) {
    for (const problem of configuration.errors) {
      console.log(`ERROR  ${problem.path}: ${problem.reason}`);
    }
    console.log(`\n${configuration.errors.length} configuration error(s); no request was made.`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  const sources = imagerySources(region);
  const points = representativePoints(catalog);
  const report = {
    probeVersion: "1.0.0",
    runAt: new Date().toISOString(),
    regionId: region.regionId,
    catalogVersion: readJson("data/catalog/manifest.json").catalogVersion,
    probe: {
      sizePx: PROBE_SIZE_PX,
      requestedAtSourceResolution: true,
      pixelFormat: "bmp, uncompressed",
      productionFormat: "jpg",
      thresholds: CONTENT_THRESHOLDS,
    },
    sources: sources.map((source) => ({ id: source.id, role: source.role, year: source.year, service: source.service })),
    results: [],
    controls: [],
    excluded: [],
  };

  for (const source of sources) {
    console.log(`\n${source.label}`);
    for (const point of points) {
      const result = await probePoint(source, point, { outDir, keepImages });
      report.results.push(result);
      console.log(
        `  ${point.areaId}  ${result.verdict.padEnd(8)} ` +
          `${String(result.probeRequest.status).padStart(3)}  ` +
          `jpg ${String(result.productionRequest.byteLength).padStart(7)}b  ` +
          `${result.reason}`,
      );
    }
    const controls = await probeControls(source, { outDir, keepImages });
    report.controls.push(...controls);
    for (const control of controls) {
      console.log(`  control   ${control.verdict.padEnd(8)} ${control.control}: ${control.reason}`);
    }
  }

  const excluded = excludedServices(region);
  if (excluded.length > 0) console.log("\nExcluded services");
  for (const entry of excluded) {
    for (const point of points) {
      const result = await probeExcluded(entry, point);
      report.excluded.push(result);
      console.log(`  ${entry.id}  ${point.areaId}  ${result.verdict}: ${result.reason}`);
    }
  }

  const covered = report.results.filter((r) => r.verdict === "covered");
  const primaryResults = report.results.filter((r) => r.sourceRole === "primary");
  const controlsClear = report.controls.every((r) => r.verdict === "no-data" || r.verdict === "no-image");

  writeFileSync(join(outDir, "imagery-probe.json"), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n${covered.length}/${report.results.length} point/source combinations returned photographic content`);
  console.log(
    `primary: ${primaryResults.filter((r) => r.verdict === "covered").length}/${primaryResults.length} operational areas covered`,
  );
  console.log(
    `controls: ${controlsClear ? "every no-coverage control was rejected, so the thresholds separate coverage from no-data" : "A CONTROL WAS ACCEPTED AS COVERAGE — the thresholds do not hold"}`,
  );
  console.log(`report written to ${join(outDir, "imagery-probe.json")}`);

  // A control accepted as coverage invalidates every other result in the run.
  process.exit(controlsClear ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
