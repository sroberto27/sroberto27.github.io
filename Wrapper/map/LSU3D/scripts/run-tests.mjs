/* run-tests.mjs — run every test under scripts/tests/.
   ------------------------------------------------------------------
       node scripts/run-tests.mjs

   These are NOT a substitute for the browser checklist in
   docs/TEST-PLAN.md, and it is worth being precise about why. They load
   the real js/*.js files into a Node vm against a stubbed DOM and a
   stubbed map, so they can prove logic: that a slug resolves, that a
   wrapper still calls through, that a route is rejected, that a handler
   fires in the right order.

   They cannot see anything visual. Contrast, stacking order, whether a
   panel is covered by another panel, layout on a phone — all invisible
   here, and all real bugs this project has actually shipped. Green here
   means "the logic holds", never "it works".

   Exit code 0 = every test passed.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "tests");

if (!fs.existsSync(DIR)) {
  console.error("No scripts/tests directory found.");
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".test.mjs")).sort();
if (!files.length) {
  console.error("No *.test.mjs files in scripts/tests/.");
  process.exit(1);
}

let failed = 0;
const rows = [];

for (const file of files) {
  const res = spawnSync(process.execPath, [path.join(DIR, file)], { encoding: "utf8" });
  const out = (res.stdout || "") + (res.stderr || "");
  const summary = (out.match(/^\d+ passed, \d+ failed$/m) || ["(no summary)"])[0];
  const ok = res.status === 0;
  if (!ok) failed++;

  rows.push(`${ok ? "PASS" : "FAIL"}  ${file.padEnd(26)} ${summary}`);

  // Only show the detail of a run that failed — a green run's output is
  // hundreds of lines nobody reads.
  if (!ok) {
    console.log(`\n──────── ${file} ────────`);
    console.log(out.trimEnd());
  }
}

console.log("\n" + rows.join("\n"));
console.log(failed ? `\n${failed} suite(s) failed.` : "\nAll suites passed.");
process.exit(failed ? 1 : 0);
