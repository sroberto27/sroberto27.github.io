/* ============================================================
   SCSU METAVERSITY — equivalence test
   ------------------------------------------------------------
   Verifies that loading the new JSON files through the adapter
   produces byte-for-byte the same window.CAMPUS_CONFIG /
   window.SCSU_DATA state as loading the legacy .js shims.

   This is the safety check that says "yes, the migration is
   lossless." If anything drifts, this script flags exactly
   which key in which map differs.
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.resolve(ROOT, "data");

/* ---------- Pipeline A: legacy .js shims ---------- */
const sandboxA = { window: {}, console };
vm.createContext(sandboxA);
for (const f of ["locations.js", "treedis-sweeps.js", "courses.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandboxA, { filename: f });
}

/* ---------- Pipeline B: JSON via the adapter ---------- */
// Build a sandbox that mimics enough of the browser for the
// adapter to run: window, a faked fetch that reads from disk,
// and a faked setTimeout/clearTimeout (the adapter doesn't use
// them, but the safety try/catch around applyTreedisProfile
// might if 01-utils.js were also loaded — it isn't here).
const sandboxB = {
  window: {},
  console,
  fetch: async (url) => {
    const filename = url.replace(/^data\//, "");
    const filepath = path.join(DATA, filename);
    if (!fs.existsSync(filepath)) {
      return { ok: false, headers: { get: () => "" }, json: async () => null };
    }
    const body = fs.readFileSync(filepath, "utf8");
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => JSON.parse(body)
    };
  }
};
vm.createContext(sandboxB);

// Load the adapter into sandboxB.
vm.runInContext(
  fs.readFileSync(path.join(ROOT, "js", "00-data-adapter.js"), "utf8"),
  sandboxB, { filename: "00-data-adapter.js" }
);

// Run loadDataJSON() — adapter populates sandboxB.window.*
(async () => {
  await sandboxB.loadDataJSON();

  const A = sandboxA.window.CAMPUS_CONFIG || {};
  const B = sandboxB.window.CAMPUS_CONFIG || {};
  const Adata = sandboxA.window.SCSU_DATA || {};
  const Bdata = sandboxB.window.SCSU_DATA || {};

  let problems = 0;
  problems += diffMap("categoryMap",    A.categoryMap,    B.categoryMap);
  problems += diffMap("descriptionMap", A.descriptionMap, B.descriptionMap);
  problems += diffMap("imageMap",       A.imageMap,       B.imageMap);
  problems += diffMap("happensHereMap", A.happensHereMap, B.happensHereMap);
  problems += diffMap("departmentMap",  A.departmentMap,  B.departmentMap);
  problems += diffMap("addressMap",     A.addressMap,     B.addressMap);
  problems += diffMap("explorableMap",  A.explorableMap,  B.explorableMap);

  problems += diffMap("treedisMaps.desktop",
    (A.treedisMaps || {}).desktop, (B.treedisMaps || {}).desktop);
  problems += diffMap("treedisMaps.vr",
    (A.treedisMaps || {}).vr,      (B.treedisMaps || {}).vr);

  problems += diffArray("SCSU_DATA.courses", Adata.courses, Bdata.courses);

  if (problems === 0) {
    console.log("\n✅ PASS — JSON adapter produces identical state to .js shims.");
  } else {
    console.log(`\n❌ FAIL — ${problems} discrepancy(ies) found.`);
    process.exit(1);
  }
})();

/* =========================================================== */
function diffMap(label, A, B) {
  A = A || {};
  B = B || {};
  const keysA = Object.keys(A).sort();
  const keysB = Object.keys(B).sort();
  let n = 0;

  // Keys only in A
  for (const k of keysA) {
    if (!(k in B)) {
      console.log(`  [${label}] missing in JSON: "${k}"`);
      n++;
    }
  }
  // Keys only in B
  for (const k of keysB) {
    if (!(k in A)) {
      console.log(`  [${label}] extra in JSON:   "${k}"`);
      n++;
    }
  }
  // Common keys — compare values deeply
  for (const k of keysA) {
    if (!(k in B)) continue;
    const sa = canonical(A[k]);
    const sb = canonical(B[k]);
    if (sa !== sb) {
      console.log(`  [${label}] value differs for "${k}":`);
      console.log(`     js:   ${truncate(sa)}`);
      console.log(`     json: ${truncate(sb)}`);
      n++;
    }
  }
  if (n === 0) console.log(`  [${label}] ✓ (${keysA.length} entries match)`);
  return n;
}

function diffArray(label, A, B) {
  A = A || [];
  B = B || [];
  if (A.length !== B.length) {
    console.log(`  [${label}] length differs: js=${A.length} json=${B.length}`);
    return 1;
  }
  let n = 0;
  for (let i = 0; i < A.length; i++) {
    const sa = canonical(A[i]);
    const sb = canonical(B[i]);
    if (sa !== sb) {
      console.log(`  [${label}] item ${i} differs`);
      console.log(`     js:   ${truncate(sa)}`);
      console.log(`     json: ${truncate(sb)}`);
      n++;
    }
  }
  if (n === 0) console.log(`  [${label}] ✓ (${A.length} items match)`);
  return n;
}

/* Canonicalize for comparison: sort object keys recursively so
   key-order doesn't masquerade as a difference. */
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

function truncate(s) {
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}
