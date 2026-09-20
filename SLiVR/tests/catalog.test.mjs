import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateCatalog } from "../src/domain/catalog.js";
import { validate, unknownMarkerIn, UNKNOWN_MARKERS } from "../src/domain/schema.js";
import { locationRecord } from "../src/domain/location.js";
import { withinBounds } from "../src/spatial/geo.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => JSON.parse(readFileSync(resolve(ROOT, relative), "utf8"));

const manifest = read("data/catalog/manifest.json");
const areas = read("data/catalog/areas.v1.json").areas;
const locations = read("data/catalog/locations.v1.json").locations;
const captures = read("data/catalog/captures.v1.json").captures;
const scoutDetails = read("data/catalog/scout-details.v1.json").scoutDetails;
const sources = read("data/catalog/sources.v1.json").sources;
const region = read("data/region/lafayette.region.json");

const catalog = { manifest, areas, locations, captures, scoutDetails, sources };

/** The shared downtown experience, which six separate records enter. */
const SHARED_DOWNTOWN_EXPERIENCE = "5eb11a1b";

test("the catalog holds exactly 18 locations, 11 current and 7 future", () => {
  assert.equal(locations.length, 18);
  assert.equal(locations.filter((l) => l.captureStatus === "current").length, 11);
  assert.equal(locations.filter((l) => l.captureStatus === "future").length, 7);
  assert.equal(captures.length, 18);
  assert.equal(scoutDetails.length, 18);
  assert.equal(areas.length, 7);
});

test("the manifest counts agree with the catalog it describes", () => {
  assert.deepEqual(manifest.counts, {
    locations: 18,
    current: 11,
    future: 7,
    areas: 7,
    captures: 18,
    sources: sources.length,
  });
  assert.equal(manifest.researchSnapshot, "2026-09-20");
  assert.equal(manifest.catalogVersion, "1.1.0");
});

test("location identifiers are the documented stable sequence", () => {
  const expected = Array.from({ length: 18 }, (_, i) => `LOC-${String(i + 1).padStart(3, "0")}`);
  assert.deepEqual([...locations.map((l) => l.id)].sort(), expected);
  assert.deepEqual(
    [...captures.map((c) => c.id)].sort(),
    Array.from({ length: 18 }, (_, i) => `CAP-${String(i + 1).padStart(3, "0")}`),
  );
  assert.deepEqual(
    [...areas.map((a) => a.id)].sort(),
    ["AREA-01", "AREA-02", "AREA-03", "AREA-04", "AREA-05", "AREA-06", "AREA-07"],
  );
});

test("every location record validates against its schema", () => {
  for (const location of locations) {
    const result = validate(locationRecord, location);
    assert.equal(result.ok, true, `${location.id}: ${JSON.stringify(result.errors)}`);
  }
});

test("the whole catalog passes integrity validation with no errors", () => {
  const result = validateCatalog(catalog, region);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("the six shared-experience records remain six distinct locations", () => {
  const shared = captures.filter((c) => c.experienceId === SHARED_DOWNTOWN_EXPERIENCE);
  assert.equal(shared.length, 6);

  const locationIds = shared.map((c) => c.locationId);
  assert.equal(new Set(locationIds).size, 6, "one capture per location, not one merged record");

  const sweepIds = shared.map((c) => c.sweepId);
  assert.equal(new Set(sweepIds).size, 6, "each entry has its own sweep");

  const records = locationIds.map((id) => locations.find((l) => l.id === id));
  assert.ok(records.every(Boolean));
  assert.equal(new Set(records.map((l) => l.name)).size, 6, "distinct names");
  assert.equal(
    new Set(records.map((l) => `${l.address.street}|${l.address.zip}`)).size,
    6,
    "distinct addresses",
  );
  assert.ok(records.every((l) => l.areaId === "AREA-01"));
});

test("the current inventory uses exactly the six allowlisted experiences", () => {
  const used = new Set(captures.filter((c) => c.experienceId).map((c) => c.experienceId));
  assert.deepEqual([...used].sort(), [...region.immersive.experienceAllowlist].sort());
  assert.equal(used.size, 6);
});

test("every future candidate has no provider identity and no tour URL", () => {
  const future = captures.filter((c) => c.state === "future");
  assert.equal(future.length, 7);
  for (const capture of future) {
    assert.equal(capture.experienceId, null, capture.id);
    assert.equal(capture.sweepId, null, capture.id);
    assert.equal(capture.startX, null, capture.id);
    assert.equal(capture.startY, null, capture.id);
    assert.equal(capture.url, null, capture.id);
  }
  const futureLocationIds = new Set(future.map((c) => c.locationId));
  for (const location of locations) {
    if (location.captureStatus === "future") assert.ok(futureLocationIds.has(location.id));
  }
});

test("every current capture URL carries its own experience, sweep and orientation", () => {
  for (const capture of captures.filter((c) => c.state === "current")) {
    const url = new URL(capture.url);
    assert.equal(url.origin, region.immersive.origin, capture.id);
    assert.equal(url.pathname, `/tour/${capture.experienceId}`, capture.id);
    assert.equal(url.searchParams.get("s"), capture.sweepId, capture.id);
    assert.equal(Number(url.searchParams.get("x")), capture.startX, capture.id);
    assert.equal(Number(url.searchParams.get("y")), capture.startY, capture.id);
  }
});

test("entry orientation values keep full precision and accept zero", () => {
  for (const capture of captures.filter((c) => c.state === "current")) {
    assert.equal(typeof capture.startX, "number", capture.id);
    assert.equal(typeof capture.startY, "number", capture.id);
    assert.ok(Number.isFinite(capture.startX) && Number.isFinite(capture.startY), capture.id);
  }
  const carpeDiem = captures.find((c) => c.id === "CAP-001");
  assert.equal(carpeDiem.startX, 4.479141140601165);
  assert.equal(carpeDiem.startY, 76.06015671262044);
});

test("the research vocabulary survives the build verbatim", () => {
  const serialised = JSON.stringify({ locations, captures, scoutDetails, areas, sources });
  for (const marker of UNKNOWN_MARKERS) {
    assert.ok(serialised.includes(marker), `missing marker: ${marker}`);
  }

  // Nothing may have become an empty string, a null stand-in or a boolean.
  for (const location of locations) {
    for (const field of ["propertyAuthority", "ownershipStatus", "filmingAccess", "researchStatus"]) {
      assert.equal(typeof location[field], "string", `${location.id}.${field}`);
      assert.notEqual(location[field], "", `${location.id}.${field}`);
    }
    assert.notEqual(location.publicHours.text, "", location.id);
  }

  // The known Old City Hall case: hours were researched and not found.
  const oldCityHall = locations.find((l) => l.id === "LOC-003");
  assert.equal(oldCityHall.publicHours.text, "Information has not been found");
  assert.equal(oldCityHall.ownershipStatus, "Need validation");
  assert.match(oldCityHall.positionEvidence, /Owner-supplied map-pin coordinate/);
  assert.equal(unknownMarkerIn(oldCityHall.filmingAccess), "Need validation");
});

test("coordinate provenance is recorded for every location", () => {
  for (const location of locations) {
    assert.equal(typeof location.positionEvidence, "string");
    assert.ok(location.positionEvidence.length > 0, location.id);
  }
  const corrected = locations.filter((l) => /Owner-supplied map-pin coordinate, 2026-09-20/.test(l.positionEvidence));
  assert.equal(corrected.length, 17);
});

test("every coordinate sits inside the configured envelope", () => {
  for (const location of locations) {
    assert.ok(
      withinBounds(location.position, region.bounds),
      `${location.id} at ${location.position.join(", ")}`,
    );
    const [lon, lat] = location.position;
    assert.ok(lon < 0 && lat > 0, `${location.id} looks like a swapped pair`);
  }
});

test("area membership reconciles with the workbook counts", () => {
  let current = 0;
  let future = 0;
  for (const area of areas) {
    const members = locations.filter((l) => l.areaId === area.id);
    assert.equal(members.length, area.locationIds.length, area.id);
    assert.deepEqual(
      members.map((l) => l.id).sort(),
      [...area.locationIds].sort(),
      area.id,
    );
    assert.equal(
      members.filter((l) => l.captureStatus === "current").length,
      area.workbookCurrentCount,
      `${area.id} current`,
    );
    assert.equal(
      members.filter((l) => l.captureStatus === "future").length,
      area.workbookFutureCount,
      `${area.id} future`,
    );
    current += area.workbookCurrentCount;
    future += area.workbookFutureCount;
  }
  assert.equal(current, 11);
  assert.equal(future, 7);
});

test("the owner-requested LaSEL destination is a linked future record without an invented capture", () => {
  const location = locations.find(l => l.id === "LOC-018");
  assert.match(location.name, /LaSEL.*Antoun Hall/);
  assert.equal(location.captureStatus, "future");
  assert.deepEqual(location.position, [-92.04441771641942, 30.228764095274858]);
  assert.equal(location.address.street, "439 Eraste Landry Rd");
  assert.ok(areas.find(a => a.id === location.areaId).locationIds.includes(location.id));
  const capture = captures.find(c => c.locationId === location.id);
  assert.equal(capture.url, null);
  assert.equal(capture.captureDate, "Information has not been found");
  assert.ok(scoutDetails.find(d => d.locationId === location.id));
  assert.ok(location.sourceIds.every(id => sources.some(s => s.id === id)));
});

test("all owner-supplied coordinate pairs are published exactly in longitude-first order", () => {
  const evidence = readFileSync(resolve(ROOT, "docs/CATALOG_COORDINATE_UPDATES_2026-09-20.md"), "utf8");
  const points = [...evidence.matchAll(/^\| (LOC-\d+) \| [^|]+ \| ([\d.]+) \| (-[\d.]+) \|$/gm)];
  assert.equal(points.length, 17);
  for (const [, id, lat, lon] of points) {
    assert.deepEqual(locations.find(l => l.id === id).position, [Number(lon), Number(lat)], id);
  }
});

test("no published value contains an absolute local path", () => {
  const serialised = JSON.stringify(catalog);
  // Anchored at a quote or whitespace so the "s://" inside an https URL is
  // not mistaken for a Windows drive letter.
  assert.ok(
    !/(^|[\s"])[A-Za-z]:[\/]/.test(serialised),
    "a drive-letter path reached the catalog",
  );
  assert.ok(!serialised.includes("file://"), "a file URL reached the catalog");
  const projectDocs = sources.filter((s) => s.availability === "private project document");
  assert.ok(projectDocs.length > 0, "private project documents are identified as such");
  for (const source of projectDocs) {
    assert.equal(source.url, null, source.id);
    assert.ok(source.reference.startsWith("docs/"), source.id);
  }
});

test("no LSU identity reached the catalog", () => {
  const serialised = JSON.stringify(catalog).toLowerCase();
  for (const token of ["lsu", "death valley", "baton rouge", "tiger stadium", "gameday"]) {
    assert.ok(!serialised.includes(token), `found "${token}" in the catalog`);
  }
});

// Negative cases: structural damage must be reported, not silently accepted.

function damaged(mutate) {
  const copy = JSON.parse(JSON.stringify(catalog));
  mutate(copy);
  return validateCatalog(copy, region);
}

test("a duplicate location ID is reported", () => {
  const result = damaged((c) => {
    c.locations[1].id = c.locations[0].id;
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("duplicate id")));
});

test("a missing area reference is reported", () => {
  const result = damaged((c) => {
    c.locations[0].areaId = "AREA-99";
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("unknown area")));
});

test("a broken source reference is reported", () => {
  const result = damaged((c) => {
    c.locations[0].sourceIds = ["SRC-999"];
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("unknown source")));
});

test("a coordinate outside the envelope is reported", () => {
  const result = damaged((c) => {
    c.locations[0].position = [-91.18745, 30.4121];
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("outside")));
});

test("a swapped coordinate pair is reported", () => {
  const result = damaged((c) => {
    c.locations[0].position = [30.2215626, -92.018864];
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("[latitude, longitude]")));
});

test("a fabricated tour for a future candidate is reported", () => {
  const result = damaged((c) => {
    const future = c.captures.find((cap) => cap.state === "future");
    future.experienceId = SHARED_DOWNTOWN_EXPERIENCE;
    future.sweepId = "sebf1e31m9u7dk7twchgfz1mc";
    future.url = `https://spaces.dtsxr.com/tour/${SHARED_DOWNTOWN_EXPERIENCE}?s=sebf1e31m9u7dk7twchgfz1mc`;
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("must be null for a future candidate")));
});

test("a capture state disagreeing with its location is reported", () => {
  const result = damaged((c) => {
    const capture = c.captures.find((cap) => cap.state === "current");
    capture.state = "future";
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("but LOC-")));
});

test("an experience outside the allowlist is reported", () => {
  const result = damaged((c) => {
    c.captures.find((cap) => cap.state === "current").experienceId = "abcdef12";
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("allowlist")));
});

test("area membership drifting from the workbook counts is reported", () => {
  const result = damaged((c) => {
    c.areas[0].workbookCurrentCount += 1;
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("does not match the workbook")));
});

test("coercing the unknown vocabulary away is reported", () => {
  const result = damaged((c) => {
    const scrub = (node) => {
      if (Array.isArray(node)) return node.map(scrub);
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) node[key] = scrub(value);
        return node;
      }
      // A favourable-sounding replacement is the exact failure this guards.
      return unknownMarkerIn(node) ? "Confirmed available" : node;
    };
    scrub(c.locations);
    scrub(c.captures);
    scrub(c.scoutDetails);
    scrub(c.areas);
    scrub(c.sources);
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("research vocabulary was lost")));
});

test("a mismatched manifest count is reported", () => {
  const result = damaged((c) => {
    c.manifest.counts.locations = 16;
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "manifest.counts.locations"));
});

test("an absolute local path in published data is reported", () => {
  const result = damaged((c) => {
    c.sources[0].reference = "E:/sroberto27.github.io/SLiVR/docs/private.txt";
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.reason.includes("absolute local path")));
});

test("a missing identifier is reported", () => {
  const result = damaged((c) => {
    delete c.locations[0].id;
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "locations[0].id" && e.reason === "is required"));
});

test("an invalid capture status is reported", () => {
  const result = damaged((c) => {
    c.locations[0].captureStatus = "maybe";
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "locations[0].captureStatus"));
});

test("an invalid source availability state is reported", () => {
  const result = damaged((c) => {
    c.sources[0].availability = "probably fine";
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "sources[0].availability"));
});

test("regenerating the catalog produces identical records", async () => {
  const { buildCatalog } = await import("../tools/build-catalog.mjs");
  const first = buildCatalog();
  const second = buildCatalog();
  for (const part of ["areas", "locations", "captures", "scoutDetails", "sources"]) {
    assert.deepEqual(second[part], first[part], part);
  }
  // Stable identifiers survive regeneration, which is what makes a shared
  // location link and a saved candidate reference durable.
  assert.deepEqual(
    second.locations.locations.map((l) => l.id),
    locations.map((l) => l.id),
  );
  assert.deepEqual(
    second.captures.captures.map((c) => c.id),
    captures.map((c) => c.id),
  );
});
