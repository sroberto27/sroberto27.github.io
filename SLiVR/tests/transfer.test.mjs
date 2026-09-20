import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakeIndexedDB } from "./fixtures/indexeddb.mjs";
import { projectFixture, FIXTURE_IDS, fixedId } from "./fixtures/project.mjs";
import { createWorkspaceRepo } from "../src/data/workspace-repo.js";
import {
  buildEnvelope,
  serializeEnvelope,
  parseEnvelope,
  validatePayload,
  describeEnvelope,
  importEnvelope,
  catalogVersionNote,
  normalizeBundle,
  ENVELOPE_KIND,
  TRANSFER_ERROR_CODES,
} from "../src/data/transfer.js";
import { detectConflicts, copyWithNewIds, applyResolution } from "../src/data/conflicts.js";
import { buildEmergencyExport, projectExportFilename } from "../src/exports/emergency.js";
import { sanitizeSegment, buildFilename } from "../src/exports/filenames.js";
import { TRANSFER_SCHEMA_VERSION, canReadTransferVersion } from "../src/domain/versions.js";
import { isWorkspaceId } from "../src/domain/ids.js";

const region = JSON.parse(
  readFileSync(new URL("../data/region/lafayette.region.json", import.meta.url), "utf8"),
);

async function openRepo() {
  const fake = createFakeIndexedDB();
  const repo = createWorkspaceRepo({ factory: fake.factory, storage: region.storage });
  await repo.open();
  return { repo, fake };
}

function exportText(bundle, { catalogVersion = "1.0.0" } = {}) {
  return serializeEnvelope(
    buildEnvelope({ bundle, catalogVersion, exportedAt: "2026-09-20T12:00:00.000Z" }),
  );
}

// ---- Test 18: round trip without loss ------------------------------------

test("the envelope declares every version needed to read it back", () => {
  const envelope = buildEnvelope({
    bundle: projectFixture(),
    catalogVersion: "1.0.0",
    exportedAt: "2026-09-20T12:00:00.000Z",
  });
  assert.equal(envelope.schemaVersion, TRANSFER_SCHEMA_VERSION);
  assert.equal(envelope.kind, ENVELOPE_KIND);
  assert.equal(envelope.catalogVersion, "1.0.0");
  assert.equal(typeof envelope.appVersion, "string");
  assert.equal(envelope.exportedAt, "2026-09-20T12:00:00.000Z");
});

test("a project round-trips through export and import with identical records", async () => {
  const { repo } = await openRepo();
  const original = projectFixture();
  await repo.writeProjectBundle(original);
  const stored = await repo.loadProjectBundle(FIXTURE_IDS.project);

  const text = exportText(stored);

  // A clean profile, as the test procedure requires.
  const { repo: clean } = await openRepo();
  const parsed = parseEnvelope(text);
  assert.equal(parsed.ok, true);
  const result = await importEnvelope({
    repo: clean,
    envelope: parsed.envelope,
    currentCatalogVersion: "1.0.0",
  });
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "created");

  const reloaded = await clean.loadProjectBundle(FIXTURE_IDS.project);
  assert.deepEqual(normalizeBundle(reloaded), normalizeBundle(stored));
});

test("units, coordinate frames and zero values survive the round trip", () => {
  const parsed = parseEnvelope(exportText(projectFixture()));
  assert.equal(parsed.ok, true);
  const shotScene = parsed.envelope.payload.shotScenes[0];
  assert.equal(shotScene.units, "metric");
  assert.equal(shotScene.northOffsetDeg, 0);
  assert.equal(shotScene.origin.elevationDatum, "Assumed local ground plane; no survey datum established");
  assert.equal(shotScene.calibration.accuracyMode, "schematic");
  assert.equal(parsed.envelope.payload.sceneObjects[0].transform.headingDeg, 0);
  assert.equal(parsed.envelope.payload.shots[0].order, 0);
});

test("catalog references travel as location, capture and catalog version", () => {
  const parsed = parseEnvelope(exportText(projectFixture()));
  const candidate = parsed.envelope.payload.candidates[0];
  assert.equal(candidate.locationId, "LOC-001");
  assert.equal(candidate.captureId, "CAP-001");
  assert.equal(candidate.catalogVersion, "1.0.0");
});

test("no provider imagery or credential is embedded in an export", () => {
  const text = exportText(projectFixture());
  assert.equal(/data:image\//.test(text), false);
  assert.equal(/maps\.dotd\.la\.gov/.test(text), false);
  assert.equal(/tile\.googleapis\.com/.test(text), false);
  assert.equal(/AIza[0-9A-Za-z_-]{35}/.test(text), false);
});

test("a differing catalog version imports and is reported, never rewritten", async () => {
  const { repo } = await openRepo();
  const parsed = parseEnvelope(exportText(projectFixture(), { catalogVersion: "0.9.0" }));
  const result = await importEnvelope({
    repo,
    envelope: parsed.envelope,
    currentCatalogVersion: "1.0.0",
  });
  assert.equal(result.ok, true);
  assert.match(result.catalogNote, /catalog 0\.9\.0/);
  const stored = await repo.loadProjectBundle(FIXTURE_IDS.project);
  assert.equal(stored.candidates[0].locationId, "LOC-001", "catalog facts are not rewritten");
  assert.equal(catalogVersionNote({ catalogVersion: "1.0.0" }, "1.0.0"), null);
});

test("the import summary describes the file before anything is written", () => {
  const parsed = parseEnvelope(exportText(projectFixture()));
  const summary = describeEnvelope(parsed.envelope);
  assert.equal(summary.projectId, FIXTURE_IDS.project);
  assert.equal(summary.projectName, "Pilot short — downtown nights");
  assert.equal(summary.counts.candidates, 3);
  assert.equal(summary.counts.scenes, 2);
});

// ---- Test 19: malformed and unsupported files ----------------------------

test("invalid JSON is rejected by class and changes nothing", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());

  const parsed = parseEnvelope("{ not json");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.invalidJson);
  assert.equal((await repo.listProjects()).length, 1);
});

test("a file that is not a SLiVR export is rejected by class", () => {
  assert.equal(parseEnvelope("[]").error.code, TRANSFER_ERROR_CODES.notEnvelope);
  assert.equal(parseEnvelope('{"kind":"other"}').error.code, TRANSFER_ERROR_CODES.notEnvelope);
});

test("a future schema version is refused and the version is named", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  for (const version of ["2.0.0", "1.1.0"]) {
    const parsed = parseEnvelope(JSON.stringify({ ...envelope, schemaVersion: version }));
    assert.equal(parsed.ok, false, version);
    assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.unsupportedVersion, version);
    assert.ok(parsed.error.message.includes(version), parsed.error.message);
  }
  assert.equal(canReadTransferVersion("1.0.0"), true);
  assert.equal(canReadTransferVersion("1.0.9"), true);
  assert.equal(canReadTransferVersion("0.9.0"), false);
  assert.equal(canReadTransferVersion("not-a-version"), false);
});

test("a missing schema version is refused rather than assumed", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  delete envelope.schemaVersion;
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.unsupportedVersion);
});

test("a missing required field is reported with its path", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  delete envelope.payload.projects[0].name;
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.invalidPayload);
  assert.ok(
    parsed.error.problems.some((p) => p.path === "payload.projects[0].name" && p.reason === "is required"),
    JSON.stringify(parsed.error.problems),
  );
});

test("a duplicate identifier inside one file is refused", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  envelope.payload.scenes[1].id = envelope.payload.scenes[0].id;
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.invalidPayload);
  assert.ok(parsed.error.problems.some((p) => /duplicate id/.test(p.reason)));
});

test("a reference to a record not in the file is refused", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  envelope.payload.candidates[0].sceneId = fixedId("scn", 99);
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.invalidPayload);
  assert.ok(
    parsed.error.problems.some((p) => /references a record not in this file/.test(p.reason)),
  );
});

test("a file carrying more than one project is refused", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  envelope.payload.projects.push({ ...envelope.payload.projects[0], id: fixedId("prj", 2) });
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.invalidPayload);
  assert.ok(parsed.error.problems.some((p) => /exactly one project/.test(p.reason)));
});

test("an inline asset with no matching record is refused", () => {
  const envelope = JSON.parse(exportText(projectFixture()));
  envelope.assetsInline = [{ assetId: fixedId("ast", 9), data: "" }];
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.error.code, TRANSFER_ERROR_CODES.brokenReference);
});

test("validation runs before any write, so a rejected file leaves storage alone", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const before = await repo.loadProjectBundle(FIXTURE_IDS.project);

  const envelope = JSON.parse(exportText(projectFixture()));
  envelope.payload.candidates[0].status = "definitely";
  envelope.payload.projects[0].name = "Renamed by a broken file";
  const parsed = parseEnvelope(JSON.stringify(envelope));
  assert.equal(parsed.ok, false);

  const after = await repo.loadProjectBundle(FIXTURE_IDS.project);
  assert.deepEqual(normalizeBundle(after), normalizeBundle(before));
});

test("payload validation reports every problem it finds, not only the first", () => {
  const payload = JSON.parse(exportText(projectFixture())).payload;
  delete payload.projects[0].name;
  delete payload.scenes[0].title;
  const { ok, errors } = validatePayload(payload);
  assert.equal(ok, false);
  assert.ok(errors.length >= 2, `expected at least two problems, got ${errors.length}`);
});

// ---- Test 20: identifier conflicts ---------------------------------------

test("an existing project identifier is detected before any write", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const existing = await repo.existingProjectIds();
  const conflict = detectConflicts(projectFixture(), existing);
  assert.equal(conflict.hasConflict, true);
  assert.equal(conflict.projectId, FIXTURE_IDS.project);
});

test("an import with an existing identifier refuses to guess", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const parsed = parseEnvelope(exportText(projectFixture()));
  const result = await importEnvelope({ repo, envelope: parsed.envelope });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRANSFER_ERROR_CODES.conflictUnresolved);
});

test("cancel writes nothing", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const before = await repo.loadProjectBundle(FIXTURE_IDS.project);

  const incoming = projectFixture();
  incoming.projects[0].name = "Should not appear";
  const parsed = parseEnvelope(exportText(incoming));
  const result = await importEnvelope({ repo, envelope: parsed.envelope, resolution: "cancel" });

  assert.equal(result.outcome, "cancelled");
  assert.equal(result.written, 0);
  assert.deepEqual(normalizeBundle(await repo.loadProjectBundle(FIXTURE_IDS.project)), normalizeBundle(before));
  assert.equal((await repo.listProjects()).length, 1);
});

test("add as a copy creates new identifiers with references rewritten consistently", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const parsed = parseEnvelope(exportText(projectFixture()));
  const result = await importEnvelope({ repo, envelope: parsed.envelope, resolution: "copy" });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "copy");
  assert.notEqual(result.projectId, FIXTURE_IDS.project);

  const projects = await repo.listProjects();
  assert.equal(projects.length, 2);

  const original = await repo.loadProjectBundle(FIXTURE_IDS.project);
  const copy = await repo.loadProjectBundle(result.projectId);
  assert.equal(original.scenes.length, 2);
  assert.equal(copy.scenes.length, 2);

  // No identifier is shared, and every reference points inside the copy.
  const copyIds = new Set(
    Object.values(copy)
      .flat()
      .map((record) => record.id),
  );
  for (const id of copyIds) assert.equal(copyIds.has(id) && !original.scenes.some((s) => s.id === id), true);
  for (const scene of copy.scenes) assert.equal(scene.projectId, copy.projects[0].id);
  for (const candidate of copy.candidates) {
    assert.equal(candidate.projectId, copy.projects[0].id);
    assert.equal(copy.scenes.some((scene) => scene.id === candidate.sceneId), true);
  }
  assert.equal(copy.paths[0].ownerObjectId, copy.sceneObjects.find((o) => o.type === "actor").id);
  assert.equal(copy.shots[0].variantId, copy.variants[0].id);
  assert.equal(copy.shotScenes[0].activeVariantId, copy.variants[0].id);
});

test("a copy keeps catalog identifiers, because it describes the same real place", () => {
  const { bundle } = copyWithNewIds(projectFixture());
  assert.equal(bundle.candidates[0].locationId, "LOC-001");
  assert.equal(bundle.candidates[0].captureId, "CAP-001");
  assert.equal(bundle.bookmarks[0].experienceId, "5eb11a1b");
  assert.equal(isWorkspaceId(bundle.projects[0].id, "project"), true);
});

test("replace removes only the named project", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());

  const other = projectFixture();
  other.projects[0] = { ...other.projects[0], id: fixedId("prj", 2), name: "Other production" };
  other.scenes = other.scenes.map((scene, index) => ({
    ...scene,
    id: fixedId("scn", 91 + index),
    projectId: other.projects[0].id,
  }));
  other.candidates = [];
  other.bookmarks = [];
  other.shotScenes = [];
  other.sceneObjects = [];
  other.paths = [];
  other.shots = [];
  other.variants = [];
  await repo.writeProjectBundle(other);

  const incoming = projectFixture();
  incoming.projects[0].name = "Replaced production";
  incoming.projects[0].revision = 4;
  incoming.scenes = [incoming.scenes[0]];
  incoming.candidates = incoming.candidates.filter((c) => c.sceneId === incoming.scenes[0].id);
  const parsed = parseEnvelope(exportText(incoming));
  const result = await importEnvelope({ repo, envelope: parsed.envelope, resolution: "replace" });

  assert.equal(result.outcome, "replace");
  const replaced = await repo.loadProjectBundle(FIXTURE_IDS.project);
  assert.equal(replaced.projects[0].name, "Replaced production");
  assert.equal(replaced.scenes.length, 1, "records the replacement does not carry are removed");

  const untouched = await repo.loadProjectBundle(fixedId("prj", 2));
  assert.equal(untouched.projects[0].name, "Other production");
  assert.equal(untouched.scenes.length, 2);
});

test("an unknown resolution is refused rather than treated as a default", async () => {
  const { repo } = await openRepo();
  await repo.writeProjectBundle(projectFixture());
  const parsed = parseEnvelope(exportText(projectFixture()));
  const result = await importEnvelope({ repo, envelope: parsed.envelope, resolution: "merge" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRANSFER_ERROR_CODES.conflictUnresolved);
  assert.throws(() => applyResolution(projectFixture(), "merge"), /unknown import resolution/);
});

// ---- Test 21: emergency export from memory -------------------------------

test("emergency export produces a valid importable envelope without storage", async () => {
  const bundle = projectFixture();
  const file = buildEmergencyExport({
    bundle,
    catalogVersion: "1.0.0",
    exportedAt: "2026-09-20T12:00:00.000Z",
    reason: "Local storage refused a write.",
  });

  assert.match(file.filename, /^SLiVR_Pilot-short-downtown-nights_emergency_2026-09-20_r1\.json$/);
  assert.equal(file.envelope.emergency.reason, "Local storage refused a write.");

  const parsed = parseEnvelope(file.text);
  assert.equal(parsed.ok, true);

  const { repo } = await openRepo();
  const result = await importEnvelope({ repo, envelope: parsed.envelope, currentCatalogVersion: "1.0.0" });
  assert.equal(result.ok, true);
  assert.deepEqual(
    normalizeBundle(await repo.loadProjectBundle(FIXTURE_IDS.project)),
    normalizeBundle(bundle),
  );
});

test("export filenames are sanitised for any user text", () => {
  assert.equal(sanitizeSegment("Nights / Days: ep\\2"), "Nights-Days-ep-2");
  assert.equal(sanitizeSegment("   "), "untitled");
  assert.equal(sanitizeSegment("..\\..\\etc\\passwd"), "etc-passwd");
  assert.equal(sanitizeSegment("CON"), "CON-file");
  assert.equal(sanitizeSegment("a".repeat(120)).length, 60);
  assert.equal(sanitizeSegment(null, "project"), "project");
  assert.equal(
    buildFilename({ project: "Night Shift", scene: "Sc 12", revision: 3, extension: "json", date: "2026-09-20" }),
    "SLiVR_Night-Shift_Sc-12_2026-09-20_r3.json",
  );
  assert.equal(
    projectExportFilename({ name: "Night Shift", revision: 2 }, "2026-09-20T12:00:00.000Z"),
    "SLiVR_Night-Shift_2026-09-20_r2.json",
  );
});

test("a filename never contains a path separator or a control character", () => {
  const nasty = "a/b\\c:d*e?f\"g<h>i|j\u0007k";
  const filename = buildFilename({ project: nasty, extension: "json", date: "2026-09-20" });
  assert.equal(/[<>:"/\\|?*\u0000-\u001f]/.test(filename), false, filename);
});
