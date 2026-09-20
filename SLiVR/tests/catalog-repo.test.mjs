import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadCatalog, locationView, CATALOG_ERROR_CODES } from "../src/data/catalog-repo.js";

const ROOT = new URL("../", import.meta.url);

/** Reads the published files, so these tests exercise the real catalog. */
function diskFetch(overrides = {}) {
  return async (path) => {
    if (path in overrides) {
      const value = overrides[path];
      if (value instanceof Error) throw value;
      return structuredClone(value);
    }
    return JSON.parse(readFileSync(new URL(path, ROOT), "utf8"));
  };
}

async function readFile(path) {
  return JSON.parse(readFileSync(new URL(path, ROOT), "utf8"));
}

const LOCATIONS = "data/catalog/locations.v1.json";
const CAPTURES = "data/catalog/captures.v1.json";
const AREAS = "data/catalog/areas.v1.json";
const MANIFEST = "data/catalog/manifest.json";
const SCOUT_DETAILS = "data/catalog/scout-details.v1.json";

test("the published catalog loads as a whole with its indexes", async () => {
  const result = await loadCatalog({ fetchJson: diskFetch() });
  assert.equal(result.ok, true, JSON.stringify(result.error ?? {}, null, 2));

  const { catalog } = result;
  assert.equal(catalog.version, "1.1.0");
  assert.equal(catalog.locations.length, 18);
  assert.equal(catalog.captures.length, 18);
  assert.equal(catalog.areas.length, 7);
  assert.equal(catalog.locationsById.size, 18);
  assert.equal(catalog.capturesByLocationId.size, 18);
  assert.equal(catalog.scoutDetailsByLocationId.size, 18);
  assert.equal(catalog.region.regionId, "lafayette-la");
});

test("the loaded catalog is read-only, so a project write cannot alter a fact", async () => {
  const { catalog } = await loadCatalog({ fetchJson: diskFetch() });
  assert.throws(() => {
    "use strict";
    catalog.locations.push({});
  }, TypeError);
  assert.throws(() => {
    "use strict";
    catalog.version = "9.9.9";
  }, TypeError);
});

test("a location view resolves its area, capture, detail sheet and sources", async () => {
  const { catalog } = await loadCatalog({ fetchJson: diskFetch() });
  const view = locationView(catalog, "LOC-003");
  assert.ok(view);
  assert.equal(view.location.id, "LOC-003");
  assert.equal(view.area.id, view.location.areaId);
  assert.equal(view.capture.locationId, "LOC-003");
  assert.equal(view.scoutDetail.locationId, "LOC-003");
  assert.equal(view.sources.length, view.location.sourceIds.length);
});

test("an unknown identifier resolves to nothing rather than to an empty record", async () => {
  const { catalog } = await loadCatalog({ fetchJson: diskFetch() });
  assert.equal(locationView(catalog, "LOC-999"), null);
  assert.equal(locationView(catalog, "not-an-id"), null);
});

test("the research vocabulary survives loading verbatim", async () => {
  const { catalog } = await loadCatalog({ fetchJson: diskFetch() });
  const text = JSON.stringify(catalog.locations) + JSON.stringify(catalog.captures);
  assert.ok(text.includes("Need validation"));
  assert.ok(text.includes("Information has not been found"));
  // No capture date was documented for any current entry, and that state is
  // carried rather than replaced with a plausible date.
  const current = catalog.captures.filter((capture) => capture.state === "current");
  assert.equal(current.length, 11);
  assert.equal(
    current.every((capture) => capture.captureDate === "Information has not been found"),
    true,
  );
});

test("future candidates carry no provider identity at all", async () => {
  const { catalog } = await loadCatalog({ fetchJson: diskFetch() });
  const future = catalog.captures.filter((capture) => capture.state === "future");
  assert.equal(future.length, 7);
  for (const capture of future) {
    assert.equal(capture.experienceId ?? null, null, capture.id);
    assert.equal(capture.sweepId ?? null, null, capture.id);
    assert.equal(capture.url ?? null, null, capture.id);
  }
});

// ---- Test 13: the application half ---------------------------------------

test("an unreachable catalog file fails the whole load, with the file named", async () => {
  const result = await loadCatalog({
    fetchJson: diskFetch({ [CAPTURES]: new Error("HTTP 404 Not Found") }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CATALOG_ERROR_CODES.fetchFailed);
  assert.ok(result.error.message.includes(CAPTURES), result.error.message);
  assert.ok(result.error.message.includes("404"), result.error.message);
});

test("a catalog file from a different version is refused rather than mixed", async () => {
  const captures = await readFile(CAPTURES);
  captures.catalogVersion = "0.9.0";
  const result = await loadCatalog({ fetchJson: diskFetch({ [CAPTURES]: captures }) });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CATALOG_ERROR_CODES.versionMismatch);
  assert.ok(result.error.message.includes("0.9.0"));
  assert.match(result.error.message, /two different snapshots/);
});

test("a manifest with no catalog version is refused", async () => {
  const manifest = await readFile(MANIFEST);
  delete manifest.catalogVersion;
  const result = await loadCatalog({ fetchJson: diskFetch({ [MANIFEST]: manifest }) });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CATALOG_ERROR_CODES.invalid);
});

test("a file that is not a catalog document is refused", async () => {
  for (const value of [[], "text", 42]) {
    const result = await loadCatalog({ fetchJson: diskFetch({ [AREAS]: value }) });
    assert.equal(result.ok, false, String(value));
    assert.equal(result.error.code, CATALOG_ERROR_CODES.notJson, String(value));
  }
});

test("a missing record identifier fails the load and names the field", async () => {
  const locations = await readFile(LOCATIONS);
  delete locations.locations[0].id;
  const result = await loadCatalog({ fetchJson: diskFetch({ [LOCATIONS]: locations }) });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, CATALOG_ERROR_CODES.invalid);
  assert.ok(result.error.problems.some((p) => p.path === "locations[0].id"), JSON.stringify(result.error.problems));
});

test("a duplicate identifier fails the load", async () => {
  const locations = await readFile(LOCATIONS);
  locations.locations[1].id = locations.locations[0].id;
  const result = await loadCatalog({ fetchJson: diskFetch({ [LOCATIONS]: locations }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => /duplicate id/.test(p.reason)));
});

test("a coordinate outside the region envelope fails the load", async () => {
  const locations = await readFile(LOCATIONS);
  locations.locations[0].position = [-90.0715, 29.9511];
  const result = await loadCatalog({ fetchJson: diskFetch({ [LOCATIONS]: locations }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => /outside the lafayette-la envelope/.test(p.reason)));
});

test("a swapped latitude and longitude pair is recognised as such", async () => {
  const locations = await readFile(LOCATIONS);
  const [lon, lat] = locations.locations[0].position;
  locations.locations[0].position = [lat, lon];
  const result = await loadCatalog({ fetchJson: diskFetch({ [LOCATIONS]: locations }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => /looks like \[latitude, longitude\]/.test(p.reason)));
});

test("an invalid capture state fails the load", async () => {
  const captures = await readFile(CAPTURES);
  captures.captures[0].state = "pending";
  const result = await loadCatalog({ fetchJson: diskFetch({ [CAPTURES]: captures }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => p.path.endsWith("state")));
});

test("an experience outside the region allowlist fails the load", async () => {
  const captures = await readFile(CAPTURES);
  const current = captures.captures.find((capture) => capture.state === "current");
  current.experienceId = "deadbeef";
  current.url = `https://spaces.dtsxr.com/tour/deadbeef?s=${current.sweepId}`;
  const result = await loadCatalog({ fetchJson: diskFetch({ [CAPTURES]: captures }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => /experience allowlist/.test(p.reason)));
});

test("a fabricated tour on a future candidate fails the load", async () => {
  const captures = await readFile(CAPTURES);
  const future = captures.captures.find((capture) => capture.state === "future");
  future.experienceId = "5eb11a1b";
  future.url = "https://spaces.dtsxr.com/tour/5eb11a1b";
  const result = await loadCatalog({ fetchJson: diskFetch({ [CAPTURES]: captures }) });
  assert.equal(result.ok, false);
  assert.ok(
    result.error.problems.some((p) => /must be null for a future candidate/.test(p.reason)),
    JSON.stringify(result.error.problems),
  );
});

test("a broken reference between records fails the load", async () => {
  const locations = await readFile(LOCATIONS);
  locations.locations[0].areaId = "AREA-99";
  const result = await loadCatalog({ fetchJson: diskFetch({ [LOCATIONS]: locations }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => /references unknown area: AREA-99/.test(p.reason)));
});

test("a manifest count that disagrees with the records fails the load", async () => {
  const manifest = await readFile(MANIFEST);
  manifest.counts.locations = 16;
  const result = await loadCatalog({ fetchJson: diskFetch({ [MANIFEST]: manifest }) });
  assert.equal(result.ok, false);
  assert.ok(result.error.problems.some((p) => p.path === "manifest.counts.locations"));
});

test("an unknown value coerced to a favourable one fails the load", () => {
  // The catalog is the research record. A build that quietly replaced its
  // unknown vocabulary with confident wording would publish claims nobody made.
  const coerce = (value) => {
    if (typeof value === "string") {
      return /Need validation|Information has not been found/.test(value) ? "Confirmed" : value;
    }
    if (Array.isArray(value)) return value.map(coerce);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, coerce(item)]));
    }
    return value;
  };

  return (async () => {
    const overrides = {};
    for (const path of [LOCATIONS, CAPTURES, SCOUT_DETAILS]) {
      overrides[path] = coerce(await readFile(path));
    }
    const result = await loadCatalog({ fetchJson: diskFetch(overrides) });
    assert.equal(result.ok, false);
    assert.ok(
      result.error.problems.some((p) => /research vocabulary was lost/.test(p.reason)),
      JSON.stringify(result.error.problems),
    );
  })();
});

test("every rejection reports the failing path and loads no records at all", async () => {
  const locations = await readFile(LOCATIONS);
  delete locations.locations[2].name;
  locations.locations[4].captureStatus = "maybe";
  const result = await loadCatalog({ fetchJson: diskFetch({ [LOCATIONS]: locations }) });

  assert.equal(result.ok, false);
  assert.equal(result.catalog, undefined, "no partially corrupted catalog is returned");
  assert.ok(result.error.problems.length >= 2);
  for (const problem of result.error.problems) {
    assert.equal(typeof problem.path, "string");
    assert.ok(problem.path.length > 0);
    assert.equal(typeof problem.reason, "string");
  }
  assert.match(result.error.message, /was not loaded/);
});

test("the expected warning is carried without failing the load", async () => {
  const { catalog } = await loadCatalog({ fetchJson: diskFetch() });
  assert.ok(
    catalog.warnings.some((warning) => /workbookLocationName/.test(warning.path)),
    JSON.stringify(catalog.warnings),
  );
});
