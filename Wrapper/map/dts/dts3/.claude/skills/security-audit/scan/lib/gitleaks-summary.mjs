// gitleaks-summary.mjs -- condense a gitleaks JSON report to rule + file.
//
// Never prints a secret value. gitleaks is invoked with --redact, and this
// summariser reads only RuleID and File, so nothing written to scan/results/
// can carry a credential even if the report format changes.
//
// Hits in files already documented as accepted risk are listed separately
// from the rest. A documented, owner-accepted key re-reported as a new
// finding every run is how a scanner trains you to ignore it.
//
// Usage: node gitleaks-summary.mjs <report.json> "<accepted|file|globs>"
//
// Exit codes are the contract with 20-secrets.sh:
//   0  nothing, or only accepted-risk files
//   3  hits outside the accepted list -- needs triage
//   1  this script failed; the caller must NOT report a pass

import fs from "node:fs";

const reportPath = process.argv[2];
const acceptedRaw = process.argv[3] || "";
const accepted = acceptedRaw.split("|").map((s) => s.trim()).filter(Boolean);

// Built without a backslash literal on purpose: this string has been mangled
// by more than one layer of shell/heredoc quoting on the way into a file.
const BACKSLASH = String.fromCharCode(92);
const norm = (f) => String(f || "").split(BACKSLASH).join("/");

let rows;
try {
  const raw = fs.readFileSync(reportPath, "utf8").trim();
  rows = raw ? JSON.parse(raw) : [];
} catch (err) {
  console.error(`  summariser could not read ${reportPath}: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(rows)) {
  console.error("  summariser: unexpected report shape (expected an array)");
  process.exit(1);
}
if (rows.length === 0) {
  console.log("  no leaks reported");
  process.exit(0);
}

const isAccepted = (file) => accepted.some((a) => norm(file).endsWith(a));

// Collapse to unique rule+file pairs; the raw count is usually one hit per
// commit that touched the file, which says nothing extra.
const pairs = new Map();
for (const r of rows) {
  const file = norm(r.File);
  const key = `${r.RuleID}|${file}`;
  if (!pairs.has(key)) pairs.set(key, { rule: r.RuleID, file, n: 0 });
  pairs.get(key).n += 1;
}

const all = [...pairs.values()].sort((a, b) => a.file.localeCompare(b.file));
const known = all.filter((x) => isAccepted(x.file));
const unknown = all.filter((x) => !isAccepted(x.file));

console.log(`  ${rows.length} hit(s) across ${all.length} rule/file pair(s)`);

if (known.length) {
  console.log("  in files already documented as accepted risk:");
  for (const x of known) console.log(`    ${x.rule}  ${x.file}  x${x.n}`);
}

if (unknown.length) {
  console.log("  NOT in the accepted list -- these need triage:");
  for (const x of unknown) console.log(`    ${x.rule}  ${x.file}  x${x.n}`);
  console.log("");
  console.log("  A gitleaks hit is a lead. Open each file and read the match");
  console.log("  before it goes anywhere near a report -- generic-api-key in");
  console.log("  particular fires on plenty of things that are not credentials.");
}

process.exit(unknown.length ? 3 : 0);
