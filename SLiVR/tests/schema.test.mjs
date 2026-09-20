import test from "node:test";
import assert from "node:assert/strict";

import {
  defineRecord,
  validate,
  formatErrors,
  unknownMarkerIn,
  isExactlyUnknown,
  UNKNOWN_MARKERS,
} from "../src/domain/schema.js";
import {
  newId,
  isWorkspaceId,
  isCatalogId,
  createIdRemapper,
  WORKSPACE_ID_PREFIXES,
} from "../src/domain/ids.js";
import { validateCapture, entryUrl, groupByExperience } from "../src/domain/capture.js";
import { openValidationItems, formatAddress } from "../src/domain/location.js";

const demo = defineRecord("Demo", {
  id: { type: "catalogId", kind: "location", required: true },
  name: { type: "text", required: true },
  position: { type: "lonlat", required: true },
  status: { type: "enum", values: ["current", "future"], required: true },
  angle: { type: "number", required: true },
  count: { type: "number", required: false, integer: true, min: 0 },
  site: { type: "url", required: false },
  seen: { type: "isoDate", required: false },
  tags: { type: "array", required: false, of: { type: "string", minLength: 1 } },
  nested: {
    type: "object",
    required: false,
    fields: { inner: { type: "string", required: true, minLength: 2 } },
  },
});

const valid = {
  id: "LOC-001",
  name: "Carpe Diem Cafe & Wine Bar",
  position: [-92.018864, 30.2215626],
  status: "current",
  angle: 0,
};

test("a valid record passes with no errors", () => {
  const result = validate(demo, valid);
  assert.equal(result.ok, true, formatErrors(result.errors));
  assert.deepEqual(result.errors, []);
});

test("zero is a value, not a missing field", () => {
  assert.equal(validate(demo, { ...valid, angle: 0 }).ok, true);
  assert.equal(validate(demo, { ...valid, angle: -0 }).ok, true);
  assert.equal(validate(demo, { ...valid, count: 0 }).ok, true);
  const missing = validate(demo, { ...valid, angle: undefined });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => e.path === "angle" && e.reason === "is required"));
});

test("each failure reports a path and a reason", () => {
  const result = validate(demo, {
    id: "LOC-1",
    name: "",
    position: [200, 30],
    status: "maybe",
    angle: "0",
    count: 1.5,
    site: "ftp://example.org",
    seen: "19 September 2026",
    tags: [""],
    nested: { inner: "a" },
    stray: true,
  });
  assert.equal(result.ok, false);
  const paths = result.errors.map((e) => e.path);
  for (const expected of [
    "id",
    "name",
    "position",
    "status",
    "angle",
    "count",
    "site",
    "seen",
    "tags[0]",
    "nested.inner",
    "stray",
  ]) {
    assert.ok(paths.includes(expected), `expected an error at ${expected}: ${paths.join(", ")}`);
  }
  assert.ok(result.errors.every((e) => typeof e.reason === "string" && e.reason.length > 0));
});

test("a non-object is rejected rather than coerced", () => {
  for (const value of [null, undefined, 42, "LOC-001", []]) {
    assert.equal(validate(demo, value).ok, false, String(value));
  }
});

test("unknown markers are recognised whole or inline", () => {
  assert.deepEqual(UNKNOWN_MARKERS, ["Need validation", "Information has not been found"]);
  assert.equal(unknownMarkerIn("Need validation"), "Need validation");
  assert.equal(unknownMarkerIn("Information has not been found"), "Information has not been found");
  assert.equal(
    unknownMarkerIn("Need validation: HVAC, patrons, street activity"),
    "Need validation",
  );
  assert.equal(
    unknownMarkerIn("Filming and commercial photography rules Need validation"),
    "Need validation",
  );
  assert.equal(unknownMarkerIn("Mon 8am-8pm"), null);
  assert.equal(unknownMarkerIn(""), null);
  assert.equal(unknownMarkerIn(null), null);

  assert.equal(isExactlyUnknown("Need validation"), true);
  assert.equal(isExactlyUnknown("  Need validation  "), true);
  assert.equal(isExactlyUnknown("Need validation: HVAC"), false);
});

test("workspace identifiers are typed, unique and never display names", () => {
  for (const kind of Object.keys(WORKSPACE_ID_PREFIXES)) {
    const id = newId(kind);
    assert.equal(isWorkspaceId(id, kind), true, `${kind} -> ${id}`);
    assert.notEqual(newId(kind), id);
  }
  assert.throws(() => newId("nonsense"), RangeError);
  assert.equal(isWorkspaceId("carpe diem cafe"), false);
  assert.equal(isWorkspaceId("LOC-001"), false);
  assert.equal(isWorkspaceId(newId("project"), "scene"), false);
});

test("catalog identifiers follow their documented shape", () => {
  assert.equal(isCatalogId("location", "LOC-001"), true);
  assert.equal(isCatalogId("location", "LOC-1"), false);
  assert.equal(isCatalogId("capture", "CAP-017"), true);
  assert.equal(isCatalogId("area", "AREA-06"), true);
  assert.equal(isCatalogId("area", "AREA-006"), false);
  assert.equal(isCatalogId("source", "SRC-042"), true);
  assert.equal(isCatalogId("location", "loc-001"), false);
});

test("an add-as-copy remap rewrites workspace IDs and keeps catalog IDs", () => {
  const remapper = createIdRemapper();
  const project = newId("project");
  const scene = newId("scene");

  const copiedProject = remapper.remap(project);
  assert.notEqual(copiedProject, project);
  assert.equal(remapper.remap(project), copiedProject, "the same source maps to the same copy");
  assert.notEqual(remapper.remap(scene), copiedProject);
  assert.equal(remapper.remap("LOC-001"), "LOC-001");
  assert.equal(remapper.remap("CAP-001"), "CAP-001");
  assert.ok(isWorkspaceId(copiedProject, "project"));
});

const currentCapture = {
  id: "CAP-001",
  locationId: "LOC-001",
  workbookLocationName: "Carpe Diem Cafe & Wine Bar",
  state: "current",
  grouping: "Shared downtown experience",
  experienceId: "5eb11a1b",
  sweepId: "sebf1e31m9u7dk7twchgfz1mc",
  startX: 4.479141140601165,
  startY: 76.06015671262044,
  url: "https://spaces.dtsxr.com/tour/5eb11a1b?s=sebf1e31m9u7dk7twchgfz1mc&x=4.479141140601165&y=76.06015671262044",
  captureDate: "Information has not been found",
  coverageNotes: "Entry sweep supplied; coverage extent and capture date not documented",
  validationStatus: "User-supplied URL parsed; live experience not independently validated",
};

const futureCapture = {
  id: "CAP-012",
  locationId: "LOC-012",
  workbookLocationName: "CAJUNDOME",
  state: "future",
  grouping: "Future scan candidate",
  experienceId: null,
  sweepId: null,
  startX: null,
  startY: null,
  url: null,
  captureDate: "Information has not been found",
  coverageNotes: "Define arena, convention, backstage, loading and exterior scan zones",
  validationStatus: "Need validation",
};

const region = { experienceAllowlist: ["5eb11a1b"], origin: "https://spaces.dtsxr.com" };

test("a current capture needs its whole provider identity", () => {
  assert.equal(validateCapture(currentCapture, region).ok, true);

  for (const field of ["experienceId", "sweepId", "startX", "startY", "url"]) {
    const result = validateCapture({ ...currentCapture, [field]: null }, region);
    assert.equal(result.ok, false, field);
    assert.ok(result.errors.some((e) => e.path === field), field);
  }
});

test("a zero entry orientation is valid", () => {
  const result = validateCapture({ ...currentCapture, startX: 0, startY: 0 }, region);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("a future candidate cannot carry provider identity or a tour URL", () => {
  assert.equal(validateCapture(futureCapture, region).ok, true);
  assert.equal(entryUrl(futureCapture), null);

  const fabricated = { ...futureCapture, experienceId: "5eb11a1b", url: "https://spaces.dtsxr.com/tour/5eb11a1b" };
  const result = validateCapture(fabricated, region);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "experienceId"));
  assert.ok(result.errors.some((e) => e.path === "url"));
});

test("a capture outside the region allowlist or origin is rejected", () => {
  const foreign = { ...currentCapture, experienceId: "deadbeef" };
  assert.equal(validateCapture(foreign, region).ok, false);

  const elsewhere = { ...currentCapture, url: "https://example.org/tour/5eb11a1b?s=sebf1e31m9u7dk7twchgfz1mc" };
  const result = validateCapture(elsewhere, region);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "url"));
});

test("a URL that does not reference its own sweep is rejected", () => {
  const mismatched = {
    ...currentCapture,
    url: "https://spaces.dtsxr.com/tour/5eb11a1b?s=dkz7wtb0t8rqzzc01gn5z7bpd&x=0&y=0",
  };
  const result = validateCapture(mismatched, region);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "url"));
});

test("captures group by experience without merging locations", () => {
  const second = { ...currentCapture, id: "CAP-002", locationId: "LOC-002", sweepId: "dkz7wtb0t8rqzzc01gn5z7bpd" };
  const grouped = groupByExperience([currentCapture, second, futureCapture]);
  assert.equal(grouped.size, 1);
  const shared = grouped.get("5eb11a1b");
  assert.equal(shared.length, 2);
  assert.deepEqual(shared.map((c) => c.locationId), ["LOC-001", "LOC-002"]);
});

test("open validation items list only the fields still carrying a marker", () => {
  const location = {
    propertyAuthority: "Need validation",
    ownershipStatus: "Need validation",
    publicHours: { text: "Mon 8am-8pm", evidence: "Official public hours" },
    accessContact: "Contact venue directly",
    filmingAccess: "Private business; filming, fees and insurance Need validation",
    researchStatus: "Partially verified",
    address: { street: "812 Jefferson St", city: "Lafayette", state: "LA", zip: "70501" },
  };
  const items = openValidationItems(location);
  assert.deepEqual(items.map((i) => i.path).sort(), [
    "filmingAccess",
    "ownershipStatus",
    "propertyAuthority",
  ]);
  assert.ok(items.every((i) => i.marker === "Need validation"));
  assert.equal(formatAddress(location), "812 Jefferson St, Lafayette, LA 70501");
});

test("error formatting stays readable and bounded", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ path: `f${i}`, reason: "bad" }));
  const formatted = formatErrors(many, 5);
  assert.equal(formatted.split("\n").length, 6);
  assert.ok(formatted.includes("and 25 more"));
  assert.ok(formatErrors([{ path: "", reason: "bad" }]).includes("(root)"));
});
