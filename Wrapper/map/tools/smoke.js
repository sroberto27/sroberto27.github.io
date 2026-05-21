/* ============================================================
   End-to-end smoke test
   ------------------------------------------------------------
   Simulates the full browser load order:
     1. Legacy .js shims load and populate window.CAMPUS_CONFIG
     2. config.js merges structural settings
     3. Adapter loads (defines functions)
     4. 01-utils.js loads (runs resolveTreedisProfile at parse)
     5. Adapter's loadDataJSON() runs (simulating boot)
     6. Verify a representative sample of lookups produce
        the same results both before and after the JSON load.
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.resolve(ROOT, "data");

const sandbox = {
  window: {},
  console,
  navigator: { userAgent: "Mozilla/5.0", xr: undefined },
  document: { body: { classList: { toggle: () => {} } } },
  fetch: async (url) => {
    const filepath = path.join(ROOT, url);
    if (!fs.existsSync(filepath)) {
      return { ok: false, headers: { get: () => "" }, json: async () => null };
    }
    return {
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => JSON.parse(fs.readFileSync(filepath, "utf8"))
    };
  },
  setTimeout, clearTimeout
};
vm.createContext(sandbox);

// 1. Legacy shims
for (const f of ["locations.js", "treedis-sweeps.js", "courses.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
}
// 2. config.js
vm.runInContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"), sandbox, { filename: "config.js" });
// 3. Adapter
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "00-data-adapter.js"), "utf8"), sandbox, { filename: "00-data-adapter.js" });
// 4. 01-utils.js (this calls resolveTreedisProfile() at parse time)
vm.runInContext(fs.readFileSync(path.join(ROOT, "01-utils.js"), "utf8"), sandbox, { filename: "01-utils.js" });

// Helper to evaluate an expression in the VM context (needed
// because `config` is a `const` inside 01-utils.js and isn't
// exposed on the sandbox object directly).
const evalIn = (expr) => vm.runInContext(expr, sandbox);

// Capture state BEFORE JSON load (shim path only)
const beforeJSON = {
  nanceDesc:  evalIn("getDescription('Nance Hall')"),
  nanceCat:   evalIn("getCategory('Nance Hall')"),
  nanceImg:   evalIn("getImage('Nance Hall')"),
  nanceHere:  evalIn("getHappensHere('Nance Hall')"),
  nanceExpl:  evalIn("getExplorable('Nance Hall')"),
  nanceSweep: evalIn("getTreedisEntry('Nance Hall')"),
  olarAddr:   evalIn("getAddress('Olar Farm')"),
  hasSweepNance:   evalIn("hasSweep('Nance Hall')"),
  hasSweepFaculty: evalIn("hasSweep('Faculty Suite')"),
  treedisProfile:  evalIn("activeTreedisProfile"),
  tourUrl:         evalIn("config.treedis.tourUrl"),
  modelId:         evalIn("config.treedis.modelId")
};

// 5. Run loadDataJSON()
(async () => {
  const report = await evalIn("loadDataJSON()");
  console.log("Adapter report:", report);

  // Capture state AFTER JSON load
  const afterJSON = {
    nanceDesc:  evalIn("getDescription('Nance Hall')"),
    nanceCat:   evalIn("getCategory('Nance Hall')"),
    nanceImg:   evalIn("getImage('Nance Hall')"),
    nanceHere:  evalIn("getHappensHere('Nance Hall')"),
    nanceExpl:  evalIn("getExplorable('Nance Hall')"),
    nanceSweep: evalIn("getTreedisEntry('Nance Hall')"),
    olarAddr:   evalIn("getAddress('Olar Farm')"),
    hasSweepNance:   evalIn("hasSweep('Nance Hall')"),
    hasSweepFaculty: evalIn("hasSweep('Faculty Suite')"),
    treedisProfile:  evalIn("activeTreedisProfile"),
    tourUrl:         evalIn("config.treedis.tourUrl"),
    modelId:         evalIn("config.treedis.modelId")
  };

  let problems = 0;
  for (const key of Object.keys(beforeJSON)) {
    const sa = JSON.stringify(beforeJSON[key]);
    const sb = JSON.stringify(afterJSON[key]);
    if (sa !== sb) {
      problems++;
      console.log(`  ❌ ${key} drifted`);
      console.log(`     before JSON: ${sa.slice(0, 100)}`);
      console.log(`     after  JSON: ${sb.slice(0, 100)}`);
    } else {
      console.log(`  ✓ ${key}`);
    }
  }

  // Spot-check the actual lookup values to make sure they're correct
  console.log("\nSpot-check values:");
  console.log("  getDescription('Nance Hall'):", afterJSON.nanceDesc.slice(0, 60) + "...");
  console.log("  getCategory('Nance Hall'):   ", afterJSON.nanceCat);
  console.log("  getImage('Nance Hall'):      ", afterJSON.nanceImg);
  console.log("  getExplorable('Nance Hall'): ", afterJSON.nanceExpl);
  console.log("  getTreedisEntry('Nance Hall').sweepId:", afterJSON.nanceSweep.sweepId);
  console.log("  getAddress('Olar Farm'):     ", afterJSON.olarAddr);
  console.log("  hasSweep('Nance Hall'):      ", afterJSON.hasSweepNance);
  console.log("  hasSweep('Faculty Suite'):   ", afterJSON.hasSweepFaculty);
  console.log("  Active treedis profile:      ", afterJSON.treedisProfile);

  // Test the courses
  const courses = sandbox.window.SCSU_DATA.courses;
  console.log("  courses count:", courses.length);
  console.log("  courses[0].id:", courses[0].id);
  console.log("  courses[0].title:", courses[0].title);

  if (problems === 0) {
    console.log("\n✅ End-to-end smoke test PASSED. Adapter is idempotent.");
  } else {
    console.log(`\n❌ ${problems} discrepancy(ies)`);
    process.exit(1);
  }
})();
