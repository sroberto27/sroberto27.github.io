/**
 * Checks what SLiVR would actually publish.
 *
 *   node tools/check-deploy-scope.mjs
 *
 * The repository root is served by GitHub Pages, so anything committed under
 * SLiVR/ is publicly fetchable. There is no build step to filter it, which
 * makes "is it committed?" the only real allowlist. This asserts that private
 * reference material stays out, that no credential is present, and that no LSU
 * identity reaches a file the application ships.
 *
 * Provenance documents may name the reference project; application files may
 * not. That distinction is encoded in APP_PATHS below.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(ROOT, "..");
const PROJECT = `${relative(REPO, ROOT).split("\\").join("/")}/`;

/** Paths that must never be committed, because they would be published. */
export const PRIVATE_PATHS = ["docs/", "outputs/", "config/runtime.js"];

/**
 * The one file inside a private directory that is published on purpose. The
 * living verification record has to survive in source control, and it carries
 * no private reference material. Adding to this list is a deliberate decision,
 * not a way to silence the check.
 */
export const PUBLISHED_EXCEPTIONS = ["docs/FULL-SYSTEM-TESTING.md"];

/** Paths the application ships, where no LSU identity is acceptable. */
const APP_PATHS = ["src/", "data/", "styles/", "config/", "index.html", "sw.js", "manifest.webmanifest"];

/**
 * Third-party code vendored verbatim.
 *
 * It is still checked for credentials, because a committed key would be just
 * as public here. It is not checked for this project's identity rules: the
 * wording checks are about what SLiVR says, and matching them against minified
 * library source only produces false positives.
 */
const VENDOR_PATHS = ["vendor/"];

const CREDENTIAL_PATTERNS = [
  { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "bearer-style token", pattern: /\b(?:ghp|gho|xox[baprs])[-_][A-Za-z0-9]{16,}/ },
  {
    name: "inline secret assignment",
    pattern: /\b(api[_-]?key|apikey|secret|access[_-]?token|password)\b\s*[:=]\s*["'][^"']{12,}["']/i,
  },
];

const LSU_PATTERNS = [
  /\blsu\b/i,
  /lsu3d/i,
  /death valley/i,
  /baton rouge/i,
  /tiger stadium/i,
  /\bgameday\b/i,
  /CAMPUS_CONFIG/,
];

const TEXT_EXTENSIONS = new Set([
  ".js", ".mjs", ".json", ".html", ".css", ".md", ".txt", ".webmanifest", ".svg", ".csv",
]);

/** Files git would publish: tracked plus untracked that are not ignored. */
export function publishableFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", PROJECT.slice(0, -1)],
    { cwd: REPO, encoding: "utf8" },
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(PROJECT.length));
}

function isTextFile(path) {
  const dot = path.lastIndexOf(".");
  return dot !== -1 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function isAppFile(path) {
  if (VENDOR_PATHS.some((prefix) => path.startsWith(prefix))) return false;
  return APP_PATHS.some((prefix) => (prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix));
}

/**
 * @param {string[]} [files] Paths to inspect, relative to the project root.
 * @param {{verifyExceptions?: boolean}} [options] `verifyExceptions` confirms that
 *   every published exception is still publishable. Leave it on for the real
 *   file set; turn it off when checking a partial list.
 */
export function checkDeployScope(files = publishableFiles(), { verifyExceptions = true } = {}) {
  const errors = [];
  const error = (path, reason) => errors.push({ path, reason });

  for (const path of files) {
    if (PUBLISHED_EXCEPTIONS.includes(path)) continue;
    for (const priv of PRIVATE_PATHS) {
      const matches = priv.endsWith("/") ? path.startsWith(priv) : path === priv;
      if (matches) error(path, "is private reference material and must not be committed");
    }
  }

  // An exception is only meaningful while the file is actually published.
  for (const exception of verifyExceptions ? PUBLISHED_EXCEPTIONS : []) {
    if (!files.includes(exception)) {
      error(exception, "is listed as a published exception but is not publishable");
    }
  }

  for (const path of files) {
    if (!isTextFile(path)) continue;
    const absolute = resolve(ROOT, path);
    let stats;
    try {
      stats = statSync(absolute);
    } catch {
      continue;
    }
    // Skip anything unusually large; the catalog is the biggest text asset.
    if (stats.size > 2_000_000) continue;
    const content = readFileSync(absolute, "utf8");
    // Owner-approved public browser key; this exception is confined to this
    // property in this deployment file. Other credentials are still rejected.
    const scannedContent = path === "config/deployment.js"
      ? content.replace(/(\bgoogleMapsApiKey:\s*")AIza[0-9A-Za-z_-]{35}("\s*[,}])/g, "$1$2")
      : content;

    for (const { name, pattern } of CREDENTIAL_PATTERNS) {
      if (pattern.test(scannedContent)) error(path, `contains what looks like a ${name}`);
    }
    if (isAppFile(path)) {
      for (const pattern of LSU_PATTERNS) {
        const match = content.match(pattern);
        if (match) error(path, `carries reference-project identity: "${match[0]}"`);
      }
    }
  }

  return { ok: errors.length === 0, errors, fileCount: files.length };
}

function main() {
  const { errors, fileCount } = checkDeployScope();
  for (const problem of errors) {
    console.log(`ERROR  ${problem.path}: ${problem.reason}`);
  }
  console.log(`\n${fileCount} publishable file(s) under ${PROJECT}`);
  console.log(
    `${errors.length} error(s)` + (errors.length ? "" : " — deployment scope is clean."),
  );
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
