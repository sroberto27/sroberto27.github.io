// osv.mjs -- lockfile -> OSV.dev advisories, with no install and no jq.
//
// Two jobs:
//   1. The advisory FALLBACK for when `osv-scanner` is not installed. It
//      queries the same upstream database over the public batch API, so the
//      data is real and current -- but it is a thinner check than the real
//      scanner (no transitive call-graph analysis, no container/OS
//      ecosystems, no license checks). Callers report it as DEGRADED.
//   2. The lockfile-INTEGRITY checks, which osv-scanner does not do at all.
//      Those run either way; pass --integrity-only to skip the advisory half
//      when the real scanner has already covered it.
//
// This is also the ONE thing the audit deliberately refetches on every run.
// References 20-50 are pinned at build time precisely so that CVE data is the
// only moving part.
//
// Usage:  node osv.mjs <path-to-package-lock.json> [--offline|--integrity-only]
// Output: human-readable report on stdout; exit 0 always (evidence collector,
//         not a gate).

import fs from "node:fs";

const lockPath = process.argv[2];
const offline = process.argv.includes("--offline");
// When the real osv-scanner already ran, this script is invoked purely for
// the lockfile-integrity checks it does not cover. Without this flag it would
// print "[SKIPPED] osv-query", which reads as though the advisory check never
// happened when in fact the better tool had just done it.
const integrityOnly = process.argv.includes("--integrity-only");

if (!lockPath || !fs.existsSync(lockPath)) {
  console.log(`[SKIPPED ] osv-query                          no lockfile at ${lockPath}`);
  process.exit(0);
}

// --- read the lockfile ------------------------------------------------------
// npm lockfileVersion 2/3 keeps everything under "packages", keyed by path.
// Version 1 keeps it under "dependencies". Handle both; ignore the root entry
// and anything marked dev-only is still reported (dev deps run on a developer
// machine and in CI, which is a real, if lower, blast radius).
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const pkgs = new Map();

function addPkg(name, version, extra = {}) {
  if (!name || !version) return;
  const key = `${name}@${version}`;
  if (!pkgs.has(key)) pkgs.set(key, { name, version, ...extra });
}

if (lock.packages) {
  for (const [path, meta] of Object.entries(lock.packages)) {
    if (path === "") continue; // the root project itself
    const name = meta.name || path.replace(/^.*node_modules\//, "");
    addPkg(name, meta.version, {
      dev: !!meta.dev,
      resolved: meta.resolved,
      integrity: meta.integrity,
      hasInstallScript: !!meta.hasInstallScript,
    });
  }
} else if (lock.dependencies) {
  const walk = (deps, dev) => {
    for (const [name, meta] of Object.entries(deps || {})) {
      addPkg(name, meta.version, {
        dev: dev || !!meta.dev,
        resolved: meta.resolved,
        integrity: meta.integrity,
      });
      if (meta.dependencies) walk(meta.dependencies, dev || !!meta.dev);
    }
  };
  walk(lock.dependencies, false);
}

const list = [...pkgs.values()];
console.log(`  lockfile          : ${lockPath}`);
console.log(`  lockfileVersion   : ${lock.lockfileVersion ?? "(v1)"}`);
console.log(`  packages resolved : ${list.length}`);

// --- lockfile integrity -----------------------------------------------------
// Three things worth knowing that have nothing to do with CVEs:
//   * a package resolved from somewhere other than the public registry
//   * a package with no integrity hash (nothing pins the bytes)
//   * a package that runs an install script (arbitrary code at `npm install`)
console.log("\n  --- lockfile integrity ---");

const offRegistry = list.filter(
  (p) => p.resolved && !/^https:\/\/registry\.npmjs\.org\//.test(p.resolved)
);
const noIntegrity = list.filter((p) => p.resolved && !p.integrity);
const installScripts = list.filter((p) => p.hasInstallScript);

const emit = (status, name, detail) =>
  console.log(`[${status.padEnd(8)}] ${name.padEnd(34)} ${detail}`);

if (offRegistry.length) {
  emit("LEAD", "lockfile-resolved-host",
    `${offRegistry.length} package(s) resolve off the public registry`);
  for (const p of offRegistry.slice(0, 20)) console.log(`    ${p.name}@${p.version} <- ${p.resolved}`);
} else {
  emit("OK", "lockfile-resolved-host", "every package resolves to registry.npmjs.org");
}

if (noIntegrity.length) {
  emit("LEAD", "lockfile-integrity-hash",
    `${noIntegrity.length} resolved package(s) carry no integrity hash`);
  for (const p of noIntegrity.slice(0, 20)) console.log(`    ${p.name}@${p.version}`);
} else {
  emit("OK", "lockfile-integrity-hash", "every resolved package carries an integrity hash");
}

if (installScripts.length) {
  emit("LEAD", "install-scripts",
    `${installScripts.length} package(s) run an install script`);
  for (const p of installScripts) console.log(`    ${p.name}@${p.version}`);
} else {
  emit("OK", "install-scripts", "no package declares an install script in the lockfile");
}

// --- advisories -------------------------------------------------------------
console.log("\n  --- advisories (OSV.dev) ---");

if (integrityOnly) {
  console.log("  advisories: already covered by osv-scanner above.");
  console.log("  This pass ran only for the lockfile-integrity checks, which");
  console.log("  osv-scanner does not perform.");
  process.exit(0);
}

if (offline) {
  emit("SKIPPED", "osv-query", "--offline: advisory data not fetched");
  process.exit(0);
}

const queries = list.map((p) => ({
  package: { name: p.name, ecosystem: "npm" },
  version: p.version,
}));

let results;
try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const resp = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queries }),
    signal: controller.signal,
  });
  clearTimeout(timer);
  if (!resp.ok) {
    emit("ERROR", "osv-query", `OSV.dev returned HTTP ${resp.status}`);
    process.exit(0);
  }
  results = (await resp.json()).results || [];
} catch (err) {
  emit("ERROR", "osv-query", `OSV.dev unreachable: ${err.message}`);
  process.exit(0);
}

// querybatch returns ids only; hydrate each one for severity and summary.
const hits = [];
for (let i = 0; i < results.length; i++) {
  const vulns = results[i]?.vulns || [];
  if (!vulns.length) continue;
  hits.push({ pkg: list[i], ids: vulns.map((v) => v.id) });
}

if (!hits.length) {
  emit("OK", "osv-query", `no advisories for ${list.length} package(s)`);
} else {
  const total = hits.reduce((n, h) => n + h.ids.length, 0);
  emit("LEAD", "osv-query", `${total} advisory hit(s) across ${hits.length} package(s)`);
  for (const h of hits) {
    console.log(`\n    ${h.pkg.name}@${h.pkg.version}${h.pkg.dev ? "  (dev)" : ""}`);
    for (const id of h.ids) {
      let detail = "";
      try {
        const r = await fetch(`https://api.osv.dev/v1/vulns/${id}`);
        if (r.ok) {
          const v = await r.json();
          const sev = v.database_specific?.severity ||
            v.severity?.map((s) => s.score).join(",") || "unrated";
          detail = ` [${sev}] ${(v.summary || "").slice(0, 110)}`;
        }
      } catch { /* leave detail empty rather than fail the run */ }
      console.log(`      ${id}${detail}`);
      console.log(`        https://osv.dev/vulnerability/${id}`);
    }
  }
}

console.log(`
  REACHABILITY, before you rank any of the above:
  Read package.json's description. If these dependencies are build/migration
  tooling that never ships to the browser, an advisory here is a
  developer-machine and CI risk, not a visitor risk, and must not be ranked as
  though site users were exposed. The browser-facing supply chain on this
  project is the CDN <script> tags in index.html, which this script does not
  cover -- 00-inventory.sh reports those.`);
