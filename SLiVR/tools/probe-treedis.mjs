/**
 * Treedis entry reconnaissance, from the command line.
 *
 *   node tools/probe-treedis.mjs [--out outputs/treedis-probe]
 *
 * Establishes what can be established without a browser: whether each supplied
 * entry answers, and whether the response carries a header that would refuse
 * embedding from another origin. That second question is the one the
 * architecture names as the single uncertainty able to block a phase gate.
 *
 * The limits are as important as the results. Absent `X-Frame-Options` and
 * absent `frame-ancestors` mean nothing in the response forbids embedding.
 * They do not mean the viewer will run in a frame: a script inside the page
 * can still refuse, WebGL can fail in a cross-origin frame, and the asset
 * requests the viewer makes afterwards carry their own headers. Only the
 * browser harness can answer those, so this probe records a necessary
 * condition and says so.
 *
 * Nothing here evaluates page scripts. It reads headers and looks for the
 * supplied identifiers in the delivered document.
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUEST_TIMEOUT_MS = 30000;

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

/**
 * Reads the embedding policy a response declares.
 *
 * @returns {{allowsEmbedding: boolean|"unknown", xFrameOptions: string|null, frameAncestors: string|null, note: string}}
 */
export function readEmbeddingPolicy(headers) {
  const xfo = headers.get("x-frame-options");
  const csp = headers.get("content-security-policy") ?? "";
  const match = /frame-ancestors([^;]*)/i.exec(csp);
  const frameAncestors = match ? match[1].trim() : null;

  if (xfo && /deny|sameorigin/i.test(xfo)) {
    return {
      allowsEmbedding: false,
      xFrameOptions: xfo,
      frameAncestors,
      note: `X-Frame-Options: ${xfo} refuses embedding from another origin.`,
    };
  }
  if (frameAncestors && /'none'/i.test(frameAncestors)) {
    return {
      allowsEmbedding: false,
      xFrameOptions: xfo ?? null,
      frameAncestors,
      note: "Content-Security-Policy frame-ancestors 'none' refuses embedding.",
    };
  }
  if (frameAncestors) {
    return {
      allowsEmbedding: "unknown",
      xFrameOptions: xfo ?? null,
      frameAncestors,
      note:
        `frame-ancestors is restricted to ${frameAncestors}. Whether this origin is included ` +
        "cannot be decided from here; the browser harness settles it.",
    };
  }
  return {
    allowsEmbedding: "unknown",
    xFrameOptions: xfo ?? null,
    frameAncestors: null,
    note:
      "No header refuses embedding. That is necessary but not sufficient: the page may still " +
      "refuse in script, and the viewer may fail in a cross-origin frame.",
  };
}

async function request(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      headers: response.headers,
      body,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (cause) {
    return {
      ok: false,
      status: 0,
      error: cause.name === "AbortError" ? `timed out after ${REQUEST_TIMEOUT_MS} ms` : cause.message,
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** One capture entry, probed. */
async function probeEntry(capture, location) {
  const result = {
    captureId: capture.id,
    locationId: capture.locationId,
    locationName: location?.name ?? null,
    experienceId: capture.experienceId,
    sweepId: capture.sweepId,
    grouping: capture.grouping,
    url: capture.url,
    catalogCaptureDate: capture.captureDate,
    catalogCoverage: capture.coverageNotes,
  };

  const response = await request(capture.url);
  result.status = response.status;
  result.elapsedMs = response.elapsedMs;

  if (!response.ok) {
    result.available = false;
    result.reason = response.error ?? `the service answered ${response.status}`;
    return result;
  }

  result.available = true;
  result.finalUrl = response.finalUrl;
  result.redirected = response.finalUrl !== capture.url;
  result.bytes = response.body.length;
  result.embedding = readEmbeddingPolicy(response.headers);

  // Does the delivered document acknowledge the identifiers we were given?
  result.documentMentions = {
    experienceId: response.body.includes(capture.experienceId),
    sweepId: response.body.includes(capture.sweepId),
  };

  // Whether a supported embed or SDK path is advertised at all.
  result.sdkHints = ["treedis-sdk", "embed.js", "iframe-api", "postMessage"]
    .filter((hint) => response.body.toLowerCase().includes(hint.toLowerCase()));

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.indexOf("--out");
  const outDir = resolve(ROOT, outArg === -1 ? "outputs/treedis-probe" : args[outArg + 1]);

  const region = readJson("data/region/lafayette.region.json");
  const captures = readJson("data/catalog/captures.v1.json").captures;
  const locations = readJson("data/catalog/locations.v1.json").locations;
  const locationsById = new Map(locations.map((l) => [l.id, l]));

  const current = captures.filter((capture) => capture.state === "current");
  mkdirSync(outDir, { recursive: true });

  const report = {
    probeVersion: "1.0.0",
    runAt: new Date().toISOString(),
    provider: region.immersive.provider,
    origin: region.immersive.origin,
    catalogVersion: readJson("data/catalog/manifest.json").catalogVersion,
    scope:
      "Availability and declared embedding policy only. Runtime behaviour — whether the viewer runs " +
      "in a frame, answers the message bridge, switches sweeps without a reload, or reports pose — " +
      "requires the browser harness at tools/treedis-recon.html.",
    entries: [],
  };

  console.log(`${current.length} supplied entries, origin ${region.immersive.origin}\n`);

  for (const capture of current) {
    const entry = await probeEntry(capture, locationsById.get(capture.locationId));
    report.entries.push(entry);
    const policy = entry.embedding
      ? entry.embedding.allowsEmbedding === false
        ? "REFUSED"
        : "no refusal"
      : "—";
    console.log(
      `  ${entry.captureId}  ${entry.locationId}  ${String(entry.status).padStart(3)}  ` +
        `${entry.experienceId}  embedding ${policy.padEnd(10)} ` +
        `ids in document: exp ${entry.documentMentions?.experienceId ?? "—"}, sweep ${entry.documentMentions?.sweepId ?? "—"}`,
    );
  }

  const allowlist = new Set(region.immersive.experienceAllowlist);
  const experiences = [...new Set(current.map((c) => c.experienceId))];
  report.summary = {
    entries: current.length,
    reachable: report.entries.filter((e) => e.available).length,
    refusingEmbedding: report.entries.filter((e) => e.embedding?.allowsEmbedding === false).length,
    experiences: experiences.length,
    sharedExperience: experiences.find(
      (id) => current.filter((c) => c.experienceId === id).length > 1,
    ) ?? null,
    outsideAllowlist: experiences.filter((id) => !allowlist.has(id)),
    sweepIdsEchoed: report.entries.filter((e) => e.documentMentions?.sweepId).length,
  };

  writeFileSync(join(outDir, "treedis-probe.json"), `${JSON.stringify(report, null, 2)}\n`);

  const s = report.summary;
  console.log(`\n${s.reachable}/${s.entries} entries reachable`);
  console.log(`${s.refusingEmbedding} entries declare a header refusing embedding`);
  console.log(
    `${s.experiences} distinct experiences; shared downtown experience: ${s.sharedExperience ?? "none"}`,
  );
  console.log(
    s.outsideAllowlist.length === 0
      ? "every experience is inside the region allowlist"
      : `OUTSIDE THE ALLOWLIST: ${s.outsideAllowlist.join(", ")}`,
  );
  console.log(`report written to ${join(outDir, "treedis-probe.json")}`);
  console.log(`\n${report.scope}`);

  process.exit(s.outsideAllowlist.length === 0 ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
