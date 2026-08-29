/* Guards the service worker's hand-maintained precache list.

   This project has no build step, so sw.js cannot generate its own
   asset list — it is typed by hand. The classic way that breaks is
   silent: someone adds js/23-whatever.js, forgets sw.js, and from then
   on every visitor with the worker installed runs a version of the app
   missing one file. Nothing errors at deploy time; it just breaks later,
   for some people, in a way that looks like a caching ghost.

   These tests are text-level only — they read sw.js and index.html and
   compare. They say nothing about whether the worker actually works;
   that needs a browser and lives in docs/TEST-PLAN.md.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..") + path.sep;
const read = (f) => fs.readFileSync(APP + f, "utf8");

const sw = read("sw.js");
const html = read("index.html");
const config = read("config.js");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS  ${label} ${extra}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
};

/* ---- what index.html actually loads ---------------------------- */

const referenced = [...html.matchAll(/(?:src|href)="((?:css|js)\/[0-9]{2}-[A-Za-z0-9._-]+\.(?:css|js))"/g)]
  .map((m) => m[1]);

/* ---- what sw.js precaches -------------------------------------- */

const precache = [...sw.matchAll(/"\.\/((?:css|js|data)\/[A-Za-z0-9._-]+)"/g)].map((m) => m[1]);

/* ---- the drift check ------------------------------------------- */

const missing = referenced.filter((f) => !precache.includes(f));
const stale = precache
  .filter((f) => f.startsWith("css/") || f.startsWith("js/"))
  .filter((f) => !referenced.includes(f));

ok("every css/js file in index.html is precached", missing.length === 0,
   missing.length ? `MISSING FROM sw.js: ${missing.join(", ")}` : `(${referenced.length} files)`);

ok("sw.js precaches nothing index.html no longer loads", stale.length === 0,
   stale.length ? `STALE IN sw.js: ${stale.join(", ")}` : "");

/* config.js and the registration script decide whether this worker
   should exist at all. They ARE precached, so the app still works
   offline — but they must be served network-first, or turning the flag
   off would take two visits to take effect. */
ok("config.js and the registrar are precached",
   precache.includes("js/22-service-worker.js") && /"\.\/config\.js"/.test(sw));

ok("the kill-switch files are served network-first",
   /KILL_SWITCH_PATHS/.test(sw) &&
   /KILL_SWITCH_PATHS[\s\S]{0,400}?networkFirst/.test(sw),
   "a stale cached config.js would keep the worker alive after it was disabled");

for (const f of ["/config.js", "/js/22-service-worker.js"]) {
  ok(`${f} is on the kill-switch list`, sw.includes(`"${f}"`));
}

/* ---- every precached file exists ------------------------------- */

const absent = precache.filter((f) => !fs.existsSync(APP + f));
ok("every precached path exists on disk", absent.length === 0,
   absent.length ? absent.join(", ") : `(${precache.length} paths)`);

/* ---- data files ------------------------------------------------ */

for (const f of ["data/buildings.geojson", "data/tours.geojson",
                 "data/locations.json", "data/treedis-sweeps.json"]) {
  ok(`precaches ${f}`, precache.includes(f));
}

/* Gameday itineraries are deliberately NOT precached — they are fetched
   only when a link carries ?g=, and precaching every one would grow
   without bound as gamedays are added. */
ok("does not precache gameday itineraries",
   !precache.some((f) => f.startsWith("data/gamedays/")));

/* ---- third-party safety ---------------------------------------- */

for (const host of ["maps.dotd.la.gov", "tile.openstreetmap.org",
                    "tile.googleapis.com", "treedis.com"]) {
  ok(`${host} is on the never-cache list`, sw.includes(`"${host}"`),
     "metered or licensed third-party content must not be cached");
}

ok("no third-party host is precached",
   !precache.some((f) => f.startsWith("http")));

/* ---- shipped switched off -------------------------------------- */

ok("enableServiceWorker defaults to false",
   /enableServiceWorker:\s*false/.test(config),
   "must stay off until geolocation and Live Visit have run in a browser");

/* ---- the kill switch exists ------------------------------------ */

const reg = read("js/22-service-worker.js");
ok("registration honours the config flag", /enableServiceWorker === true/.test(reg));
ok("?sw=off forces removal", /get\("sw"\)\s*===\s*"off"/.test(reg));
ok("disabled path unregisters existing workers", /\.unregister\(\)/.test(reg));
ok("worker can clear its own caches on request", /UNREGISTER/.test(sw));

/* ---- navigations must not be cache-first ----------------------- */

ok("navigations are network-first",
   /req\.mode === "navigate"/.test(sw) && /networkFirst/.test(sw),
   "a cache-first shell can pin someone to a build with no way to update");

ok("cache name is versioned", /CACHE_VERSION\s*=\s*"[^"]+"/.test(sw));
ok("old caches are cleaned up on activate",
   /caches\.delete/.test(sw) && /activate/.test(sw));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
