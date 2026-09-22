import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCatalog } from "../src/data/catalog-repo.js";
import { discoverLocations, discoveryFacts, evidenceState, publicLocationLink } from "../src/domain/discovery.js";
const read = file => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8"));
const raw = { manifest: read("catalog/manifest.json") };
for (const [key, file] of Object.entries({ locations:"locations", captures:"captures", areas:"areas", sources:"sources", scoutDetails:"scout-details" })) raw[key] = read(`catalog/${file}.v1.json`)[key];
const catalog = buildCatalog(raw, read("region/lafayette.region.json"));
const ids = rows => rows.map(l => l.id);

test("35: search includes identity, area, visual and practical descriptions with token/spacing tolerance", () => {
  for (const query of [" LOC-001 ", "CARPE    DIEM", "812 Jefferson", "cafe wine", "contemporary downtown", "HVAC patrons"]) {
    assert.ok(ids(discoverLocations(catalog, { query })).includes("LOC-001"), query);
  }
  assert.equal(discoverLocations(catalog, { query: "no-such-description" }).length, 0);
  assert.equal(discoverLocations(catalog).length, 18);
});

test("36: every facet and their combinations preserve exact map/list eligible IDs", () => {
  const target = catalog.locations[0];
  const facts = discoveryFacts(target, catalog.scoutDetailsByLocationId.get(target.id), catalog.capturesByLocationId.get(target.id));
  const filters = Object.fromEntries(Object.entries(facts).filter(([key]) => !["total", "unresolved"].includes(key)).map(([key,value]) => [key, Array.isArray(value) ? value[0] : value]));
  for (const [key,value] of Object.entries(filters)) assert.ok(ids(discoverLocations(catalog, { filters: { [key]:value } })).includes(target.id), key);
  assert.ok(ids(discoverLocations(catalog, { filters })).includes(target.id));
  assert.equal(discoverLocations(catalog, { filters: { ...filters, capture:"future" } }).length, 0);
  for (const capture of ["current", "future"]) for (const area of catalog.areas) {
    assert.deepEqual(ids(discoverLocations(catalog, { filters: { capture, area:area.id } })), ids(catalog.locations.filter(l => l.captureStatus === capture && l.areaId === area.id)));
  }
});

test("36/40: unknown descriptions never become verified access, hours, character or complete dossiers", () => {
  for (const location of catalog.locations) {
    const f = discoveryFacts(location, catalog.scoutDetailsByLocationId.get(location.id), catalog.capturesByLocationId.get(location.id));
    assert.equal(f.completeness, "gaps");
    assert.ok(f.unresolved > 0);
  }
  assert.equal(evidenceState("Need validation"), "validation");
  assert.equal(evidenceState("Information has not been found"), "missing");
  assert.equal(evidenceState("Information not found"), "missing");
  assert.equal(evidenceState(undefined), "missing");
  assert.equal(evidenceState(0), "reported");
  assert.equal(evidenceState(false), "reported");
  const f = discoveryFacts({ ...catalog.locations[0], coverageSummary:"Need validation", publicHours:{text:"Need validation"}, filmingAccess:"Information has not been found" });
  assert.deepEqual(f.character, ["unknown"]);
  assert.deepEqual(f.spaces, ["unknown"]);
  assert.equal(f.hours, "unknown");
  assert.equal(f.access, "missing");
});

test("37/45: all sorts are stable, session recent order is explicit, and catalog is unchanged", () => {
  const before = JSON.stringify(raw);
  for (const sort of ["catalog","name","area","capture","recent"]) {
    const opts = { sort, recent:["LOC-018","LOC-003"] };
    assert.deepEqual(ids(discoverLocations(catalog,opts)), ids(discoverLocations(catalog,opts)));
    assert.equal(new Set(ids(discoverLocations(catalog,opts))).size, 18);
  }
  assert.deepEqual(ids(discoverLocations(catalog,{ sort:"recent", recent:["LOC-018","LOC-003"] })).slice(0,2), ["LOC-018","LOC-003"]);
  assert.ok(discoverLocations(catalog,{sort:"capture"}).slice(0,11).every(l => l.captureStatus === "current"));
  assert.equal(JSON.stringify(raw), before);
});

test("44/49: share URL carries only stable public location ID at the deployment subpath", () => {
  assert.equal(publicLocationLink("https://example.org/SLiVR/?private=secret#/project/prj_abc", "LOC-003"), "https://example.org/SLiVR/#/location/LOC-003");
});
