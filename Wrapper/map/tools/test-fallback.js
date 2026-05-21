/* ============================================================
   file:// fallback test
   ------------------------------------------------------------
   Simulates what happens when fetch() fails (e.g. opening
   map.html directly from disk). The page should still load
   off the legacy .js shims with no JSON file involvement.
   ============================================================ */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const sandbox = {
  window: {},
  console,
  navigator: { userAgent: "Mozilla/5.0", xr: undefined },
  document: { body: { classList: { toggle: () => {} } } },
  // fetch always rejects — simulates file:// origin
  fetch: async () => { throw new Error("Failed to fetch (file:// origin)"); },
  setTimeout, clearTimeout
};
vm.createContext(sandbox);

// Browser load order (no network)
for (const f of ["locations.js", "treedis-sweeps.js", "courses.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
}
vm.runInContext(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"), sandbox, { filename: "config.js" });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "00-data-adapter.js"), "utf8"), sandbox, { filename: "00-data-adapter.js" });
vm.runInContext(fs.readFileSync(path.join(ROOT, "01-utils.js"), "utf8"), sandbox, { filename: "01-utils.js" });

const evalIn = (e) => vm.runInContext(e, sandbox);

(async () => {
  const report = await evalIn("loadDataJSON()");
  console.log("Adapter report:", report);
  if (report.locations !== "shim" || report.sweeps !== "shim" || report.courses !== "shim") {
    console.log("❌ Expected all to be 'shim' when fetch fails");
    process.exit(1);
  }

  // App must still work
  console.log("getDescription('Nance Hall'):", evalIn("getDescription('Nance Hall')").slice(0, 60) + "...");
  console.log("getCategory('Nance Hall'):", evalIn("getCategory('Nance Hall')"));
  console.log("getTreedisEntry('Nance Hall').sweepId:", evalIn("getTreedisEntry('Nance Hall').sweepId"));
  console.log("courses count:", evalIn("(window.SCSU_DATA.courses || []).length"));

  console.log("\n✅ file:// fallback works — page boots cleanly off the legacy shims when fetch fails.");
})();
