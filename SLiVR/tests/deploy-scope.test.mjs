import test from "node:test";
import assert from "node:assert/strict";

import {
  checkDeployScope,
  publishableFiles,
  PRIVATE_PATHS,
  PUBLISHED_EXCEPTIONS,
} from "../tools/check-deploy-scope.mjs";

test("nothing private is currently publishable", () => {
  const result = checkDeployScope();
  assert.deepEqual(result.errors, []);
  assert.ok(result.fileCount > 0, "the check found no files to inspect");
});

test("the private reference directories are excluded from publication", () => {
  const files = publishableFiles();
  for (const prefix of PRIVATE_PATHS) {
    const offenders = files
      .filter((path) => (prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix))
      .filter((path) => !PUBLISHED_EXCEPTIONS.includes(path));
    assert.deepEqual(offenders, [], `${prefix} would be published`);
  }
  // The scanned set must still contain the application itself, otherwise a
  // broken file listing would make this suite pass vacuously.
  assert.ok(files.some((path) => path.startsWith("src/")));
  assert.ok(files.some((path) => path.startsWith("data/catalog/")));
});

test("a committed private path is reported", () => {
  const result = checkDeployScope(
    ["src/app/main.js", "docs/locationScoutingBookOCR_compressed.pdf"],
    { verifyExceptions: false },
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path.startsWith("docs/")));
});

test("the workbook and a runtime credential file are reported", () => {
  const result = checkDeployScope(
    ["outputs/location_database/SLiVR_Location_Scouting_Database.xlsx", "config/runtime.js"],
    { verifyExceptions: false },
  );
  assert.equal(result.errors.length, 2);
});

test("provenance documents may name the reference project", () => {
  // These are development records, not application files, and the reference
  // project has to be identifiable in them.
  const result = checkDeployScope(
    ["SLIVR_SOURCE_REVIEW.md", "research/DECISION_RECORD.md"],
    { verifyExceptions: false },
  );
  assert.deepEqual(result.errors, []);
});

test("the verification record is published and nothing else in docs is", () => {
  const files = publishableFiles();
  const published = files.filter((path) => path.startsWith("docs/"));
  assert.deepEqual(published, ["docs/FULL-SYSTEM-TESTING.md"]);
  assert.deepEqual(PUBLISHED_EXCEPTIONS, ["docs/FULL-SYSTEM-TESTING.md"]);
});

test("an exception does not open the rest of its directory", () => {
  const result = checkDeployScope([
    "docs/FULL-SYSTEM-TESTING.md",
    "docs/locationScoutingBookOCR_compressed.pdf",
    "docs/Elsevier_2026_VR_based_Location_Scouting.docx",
  ]);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((e) => e.path !== "docs/FULL-SYSTEM-TESTING.md"));
});

test("an exception that stopped being published is reported", () => {
  // Guards against the negation line being dropped from .gitignore later.
  const result = checkDeployScope(["src/app/main.js"]);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.path === "docs/FULL-SYSTEM-TESTING.md" && e.reason.includes("not publishable"),
    ),
  );
});
