/**
 * Validates the generated catalog against the region configuration.
 *
 *   node tools/validate-catalog.mjs
 *
 * The application is tolerant at runtime so a reader is never left with a
 * blank screen, which is the wrong behaviour for whoever maintains the data.
 * This is the strict half: it exits non-zero on any error, prints warnings
 * without failing, and locates every problem positionally.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../src/domain/catalog.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8"));
}

export function loadCatalog() {
  return {
    manifest: readJson("data/catalog/manifest.json"),
    areas: readJson("data/catalog/areas.v1.json").areas,
    locations: readJson("data/catalog/locations.v1.json").locations,
    captures: readJson("data/catalog/captures.v1.json").captures,
    scoutDetails: readJson("data/catalog/scout-details.v1.json").scoutDetails,
    sources: readJson("data/catalog/sources.v1.json").sources,
  };
}

export function loadRegion() {
  return readJson("data/region/lafayette.region.json");
}

function main() {
  const catalog = loadCatalog();
  const region = loadRegion();
  const { errors, warnings, unknownCount } = validateCatalog(catalog, region);

  for (const warning of warnings) {
    console.log(`WARN   ${warning.path}: ${warning.reason}`);
  }
  for (const problem of errors) {
    console.log(`ERROR  ${problem.path}: ${problem.reason}`);
  }

  const counts = catalog.manifest.counts;
  console.log(
    `\ncatalog ${catalog.manifest.catalogVersion} — ${counts.locations} locations ` +
      `(${counts.current} current, ${counts.future} future), ${counts.areas} areas, ` +
      `${counts.captures} captures, ${counts.sources} sources`,
  );
  console.log(`${unknownCount} field values carry a preserved unknown marker`);
  console.log(
    `${errors.length} error(s), ${warnings.length} warning(s)` +
      (errors.length ? "" : " — catalog is valid."),
  );
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
