/* Guards the "How to use" walkthrough against drifting from the UI.

   This has already gone wrong once. The walkthrough pointed at
   `.metabar` for its "Experience Toggle" step long after
   css/02-header.css had hidden that element outright and the toggle had
   moved into the rail — so the step dimmed the whole screen and
   described something that was not there. Nothing errored; it just
   quietly stopped being true, and only a person opening the walkthrough
   would ever notice.

   These checks are text-level: they read js/12-start-screen.js,
   index.html and the stylesheets and compare. They cannot tell you the
   walkthrough reads *well* — that is A18 in docs/TEST-PLAN.md and needs
   a person. They can tell you it points at things that exist and are
   not hidden.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..") + path.sep;
const read = (f) => fs.readFileSync(APP + f, "utf8");

const js = read("js/12-start-screen.js");
const html = read("index.html");
const css = fs.readdirSync(APP + "css").map((f) => read("css/" + f)).join("\n");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS  ${label} ${extra}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
};

/* ---- isolate the STEPS array ----------------------------------- */

const start = js.indexOf("const STEPS = [");
const end = js.indexOf("let stepIndex", start);
ok("STEPS array is findable", start !== -1 && end > start);
const steps = js.slice(start, end);

/* ---- every id target exists in index.html ---------------------- */

const ids = [...steps.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
ok("the walkthrough targets some elements", ids.length > 0, `(${ids.length} references)`);

const missingIds = [...new Set(ids)].filter((id) => !html.includes(`id="${id}"`));
ok("every targeted id exists in index.html", missingIds.length === 0,
   missingIds.length ? `MISSING: ${missingIds.join(", ")}` : `(${[...new Set(ids)].join(", ")})`);

/* ---- no target is hidden outright ------------------------------ */

/* A class selector hidden with `display: none !important` outside any
   media query can never be highlighted at any breakpoint. That is
   exactly what happened with .metabar. */
const selectors = [...steps.matchAll(/querySelector\("([^"]+)"\)/g)].map((m) => m[1]);
const hardHidden = selectors.filter((sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${esc}\\s*\\{[^}]*display:\\s*none\\s*!important`).test(css);
});
ok("no targeted selector is hidden with display:none !important",
   hardHidden.length === 0,
   hardHidden.length ? `HIDDEN: ${hardHidden.join(", ")}` : "");

ok("the walkthrough does not point at the legacy .metabar",
   !steps.includes(".metabar"),
   "it is display:none — the Explore/Learn toggle moved into the rail");

/* ---- desktop-only elements are not used as mobile targets ------- */

/* .tour-pill is hidden below 880px, so a mobile step must not target
   #tourPill. Check each step's mobile block specifically. */
const mobileBlocks = [...steps.matchAll(/mobile:\s*\{([\s\S]*?)\n\s{8}\}/g)].map((m) => m[1]);
ok("mobile step blocks are parseable", mobileBlocks.length > 0, `(${mobileBlocks.length} found)`);

const mobileTargetsPill = mobileBlocks.some((b) => b.includes('"tourPill"'));
ok("no mobile step targets the desktop-only tour pill", !mobileTargetsPill,
   ".tour-pill is display:none under 880px");

/* #details is translated off-screen on mobile until a stop is selected,
   so highlighting it there draws the cutout below the fold. */
const mobileTargetsDetails = mobileBlocks.some((b) => b.includes('"details"'));
ok("no mobile step targets the off-screen details sheet", !mobileTargetsDetails,
   ".rail-detail sits at translateY(105%) until something is selected");

/* ---- step count in the markup matches ------------------------- */

const stepCount = (steps.match(/\n\s{6}\{\n\s{8}id:/g) || []).length;
ok("step count is detectable", stepCount > 0, `(${stepCount} steps)`);

const htmlTotal = (html.match(/id="coachmarkTotal">(\d+)</) || [])[1];
ok("index.html's placeholder total matches the step count",
   Number(htmlTotal) === stepCount,
   `markup says ${htmlTotal}, STEPS has ${stepCount} — JS overwrites it, but a mismatch flashes the wrong number`);

/* ---- each step has both breakpoints and real copy -------------- */

const titles = [...steps.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
ok("every step has a title for both breakpoints", titles.length === stepCount * 2,
   `${titles.length} titles for ${stepCount} steps`);

const placements = [...steps.matchAll(/placement:\s*"([^"]+)"/g)].map((m) => m[1]);
const validPlacements = ["top", "bottom", "left", "right"];
const badPlacement = placements.filter((p) => !validPlacements.includes(p));
ok("every placement is valid", badPlacement.length === 0,
   badPlacement.length ? badPlacement.join(", ") : `(${placements.length} placements)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
