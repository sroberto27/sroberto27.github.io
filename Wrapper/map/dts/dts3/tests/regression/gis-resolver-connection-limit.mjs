// PASS means: resolving a GIS map never holds more than 6 R2 object bodies
// open at once, so Cloudflare Workers does not close them mid-read.
//
//   node tests/regression/gis-resolver-connection-limit.mjs
//
// Exit 0 = pass, 1 = fail. No credentials, no network -- it drives the real
// onRequestGet() from functions/api/resource/[key].js against a fake R2
// binding that enforces the same limit the runtime does.
//
// WHY THIS EXISTS. Workers allows at most 6 simultaneously open connections
// per invocation, and an R2 body counts as one until it is consumed. A perf
// change replaced a sequential read loop with `Promise.all` over every get()
// followed by `Promise.all` over every .json()`, which holds all 27 bodies
// (14 tours + 13 feature tours) open at once. The runtime closed them with
// "Response closed due to connection limit", the resolver's catch turned that
// into a 500, and `gismap.iberia-coastal` -- the only GIS map, reached from
// the GFC project -- became unopenable for every visitor, signed in or not,
// because the resolve runs before the access check.
//
// It shipped and stayed live because nothing exercised it: the subrequest
// COUNT was unchanged, which is what the change reasoned about, and the
// connection limit is a separate budget. A red result here means that shape
// is back. Note the failure needs enough documents to exceed the limit --
// this fixture deliberately uses the real 14 + 13.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTE = path.join(HERE, "..", "..", "functions", "api", "resource", "[key].js");

const WORKERS_CONNECTION_LIMIT = 6; // Cloudflare's documented per-invocation cap

let openBodies = 0;
let peakOpenBodies = 0;

function r2Object(data) {
  return {
    async json() {
      openBodies--; // the body is consumed here, and only here
      return data;
    },
  };
}

const store = new Map();
store.set("data/source/gis/maps/iberia-coastal.json", {
  _type: "gisMap", id: "iberia-coastal", title: "Iberia Coastal",
  access: "registered", layers: [], tours: [],
});
for (let i = 1; i <= 14; i++) {
  store.set(`data/source/gis/tours/tour-${i}.json`, { _type: "gisTour", id: `tour-${i}`, mapId: "iberia-coastal" });
}
for (let i = 1; i <= 13; i++) {
  store.set(`data/source/gis/featuretours/ft-${i}.json`, { _type: "gisFeatureTour", id: `ft-${i}`, mapId: "iberia-coastal" });
}

const env = {
  SUPABASE_URL: "https://example.invalid",
  SUPABASE_ANON_KEY: "test",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  DTS_CONTENT: {
    async list({ prefix }) {
      return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
    async get(key) {
      if (!store.has(key)) return null;
      openBodies++;
      if (openBodies > peakOpenBodies) peakOpenBodies = openBodies;
      if (openBodies > WORKERS_CONNECTION_LIMIT) {
        openBodies--;
        // Verbatim the error the real runtime raised in production.
        throw new Error("Response closed due to connection limit");
      }
      return r2Object(store.get(key));
    },
  },
};

const context = {
  env,
  params: { key: "gismap.iberia-coastal" },
  // No Authorization header -> verifyUser() returns null without any fetch,
  // so this stays offline. A `registered` map must then answer 401.
  request: { headers: { get: () => null } },
};

console.log("\n=== GIS resolver must respect the Workers connection limit ===");
console.log(`  fixture  : ${store.size} R2 objects (1 map + 14 tours + 13 feature tours)`);
console.log(`  limit    : ${WORKERS_CONNECTION_LIMIT} simultaneously open bodies\n`);

const { onRequestGet } = await import(pathToFileURL(ROUTE).href);
const resp = await onRequestGet(context);
const body = await resp.text();

console.log(`  peak simultaneously open bodies : ${peakOpenBodies}`);
console.log(`  response                        : HTTP ${resp.status} ${body}\n`);

const failures = [];
if (peakOpenBodies > WORKERS_CONNECTION_LIMIT) {
  failures.push(`held ${peakOpenBodies} bodies open at once, limit is ${WORKERS_CONNECTION_LIMIT}`);
}
if (resp.status === 500) {
  failures.push(`resolver returned 500 (${body}) -- the map is unresolvable for every caller`);
}
// The companion half: not merely "didn't crash", but still gates correctly.
if (resp.status !== 401) {
  failures.push(`expected 401 for an anonymous caller on a 'registered' map, got ${resp.status}`);
}
if (openBodies !== 0) {
  failures.push(`${openBodies} body/bodies left unconsumed -- a leak that would count against the limit`);
}

if (failures.length) {
  console.log("  FAIL");
  failures.forEach((f) => console.log(`    - ${f}`));
  console.log("");
  process.exit(1);
}
console.log("  PASS -- bounded concurrency held, and the access check still denies anonymously\n");
