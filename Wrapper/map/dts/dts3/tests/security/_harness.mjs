// _harness.mjs -- shared plumbing for security probes.
//
// Plain ESM, run with node directly, matching scripts/*.mjs. The only
// dependency is @supabase/supabase-js, which the project already has.
//
//   node tests/security/probe-f01-something.mjs
//
// What this gives a probe:
//   signInAs()        a real session for one of the seeded dev fixtures
//   req()             fetch that logs every request and response
//   sb()              a supabase-js client at a chosen identity
//   expectDenied()    assert access is refused, and say why if it is not
//   expectAllowed()   the companion assertion -- legitimate access still works
//   report()          exit code and summary
//
// Two rules this file enforces rather than documents:
//   1. It refuses to run against production without DTS_ALLOW_PROD=1.
//   2. It redacts tokens and keys before anything is written to the log.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- targets ---

export const DEV_SITE = "https://dts-website-4cu.pages.dev";

export const TARGET = process.env.DTS_AUDIT_TARGET || DEV_SITE;
export const SUPABASE_URL = process.env.SUPABASE_URL || readClientUrl();
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || readClientKey();

// Read the project URL and publishable key from the client init file rather
// than hardcoding them, so probes keep working after handoff moves the
// project to different accounts.
function readClientInit() {
  try {
    return fs.readFileSync(path.join(HERE, "..", "..", "js", "supabase-init.js"), "utf8");
  } catch {
    return "";
  }
}
function readClientUrl() {
  const m = readClientInit().match(/https:\/\/[a-z0-9]+\.supabase\.co/);
  return m ? m[0] : null;
}
function readClientKey() {
  const m = readClientInit().match(/(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]{40,})/);
  return m ? m[0] : null;
}

// Production guard. A probe writes; a probe against production writes to
// production. references/50-pentest.md: approval is per run and is never
// inherited from an earlier one.
const PROD_MARKERS = [/dtsxr\.com/i];
function assertTargetAllowed() {
  const isProd = PROD_MARKERS.some((re) => re.test(TARGET));
  if (isProd && process.env.DTS_ALLOW_PROD !== "1") {
    console.error(
      `\nREFUSING TO RUN.\n` +
      `  target: ${TARGET}\n` +
      `  This looks like production. Security probes create fixtures, exercise\n` +
      `  auth flows, and may write. Point at the dev preview instead, or set\n` +
      `  DTS_ALLOW_PROD=1 for THIS run only if you have explicit approval.\n`
    );
    process.exit(2);
  }
  if (isProd) {
    console.warn(`\n*** RUNNING AGAINST PRODUCTION (DTS_ALLOW_PROD=1) ***\n`);
  }
}

// ---------------------------------------------------------------- fixtures ---
//
// The seeded dev accounts. Passwords come from the environment -- never from
// this file, and never from a default. A probe that cannot authenticate says
// so rather than silently testing nothing.
export const FIXTURES = {
  siteAdmin: { email: "testadmin@example.com", envVar: "DTS_TEST_SITEADMIN_PW" },
  orgAdmin: { email: "testorgadmin@example.com", envVar: "DTS_TEST_ORGADMIN_PW" },
  member: { email: "testmember@example.com", envVar: "DTS_TEST_MEMBER_PW" },
  user: { email: "testuser@example.com", envVar: "DTS_TEST_USER_PW" },
};

// ---------------------------------------------------------------- logging ---

const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_DIR = path.join(HERE, "logs");
const LOG_FILE = path.join(LOG_DIR, `${RUN_ID}.jsonl`);

function redact(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_<REDACTED>")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "<REDACTED-JWT>")
    .replace(/("(?:access_token|refresh_token|password|apikey)"\s*:\s*")[^"]*/g, "$1<REDACTED>")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1<REDACTED>");
}

function logLine(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Logging must never be the reason a probe fails.
  }
}

// ---------------------------------------------------------------- requests ---

/**
 * fetch, with every request and response recorded.
 * Returns { status, headers, body, json } -- body is text, json is parsed or null.
 */
export async function req(url, opts = {}) {
  const started = Date.now();
  const init = { ...opts, headers: { ...(opts.headers || {}) } };

  let resp, body = "", err = null;
  try {
    resp = await fetch(url, init);
    body = await resp.text();
  } catch (e) {
    err = e.message;
  }

  const entry = {
    at: new Date().toISOString(),
    ms: Date.now() - started,
    method: init.method || "GET",
    url,
    reqHeaders: Object.fromEntries(
      Object.entries(init.headers).map(([k, v]) => [k, redact(String(v))])
    ),
    reqBody: init.body ? redact(String(init.body)).slice(0, 2000) : undefined,
    status: resp?.status ?? null,
    respHeaders: resp ? Object.fromEntries(resp.headers.entries()) : null,
    respBody: redact(body).slice(0, 4000),
    error: err,
  };
  logLine(entry);

  let json = null;
  try { json = JSON.parse(body); } catch { /* not json */ }

  return {
    status: resp?.status ?? 0,
    headers: resp?.headers ?? new Headers(),
    body,
    json,
    error: err,
  };
}

// ------------------------------------------------------------------- auth ---

/**
 * Sign in as one of the seeded fixtures. Returns { userId, accessToken, email }.
 * Throws with an actionable message if the password env var is unset -- a probe
 * must never silently degrade into testing the anonymous case by accident.
 */
export async function signInAs(fixtureName) {
  const fx = FIXTURES[fixtureName];
  if (!fx) throw new Error(`unknown fixture "${fixtureName}"`);
  const password = process.env[fx.envVar];
  if (!password) {
    throw new Error(
      `${fx.envVar} is not set, so this probe cannot sign in as ${fx.email}.\n` +
      `Set it for the dev project before running. Do not hardcode it.`
    );
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("could not resolve the Supabase URL/publishable key");
  }

  const r = await req(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: fx.email, password }),
  });
  if (r.status !== 200 || !r.json?.access_token) {
    throw new Error(`sign-in failed for ${fx.email}: HTTP ${r.status}`);
  }
  return {
    email: fx.email,
    userId: r.json.user?.id,
    accessToken: r.json.access_token,
  };
}

/** Authorization headers for a session from signInAs(), or anonymous. */
export function authHeaders(session) {
  const h = { apikey: SUPABASE_KEY };
  if (session?.accessToken) h.Authorization = `Bearer ${session.accessToken}`;
  return h;
}

/** PostgREST request at a given identity. Pass null for anonymous. */
export function pgrst(session, queryPath, opts = {}) {
  return req(`${SUPABASE_URL}/rest/v1/${queryPath}`, {
    ...opts,
    headers: { ...authHeaders(session), ...(opts.headers || {}) },
  });
}

/** A site route (Pages Function) at a given identity. */
export function site(session, routePath, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  return req(`${TARGET}${routePath}`, { ...opts, headers });
}

// ------------------------------------------------------------- assertions ---

const results = [];

/**
 * Assert access is refused.
 *
 * "Refused" means a 401/403, OR a 200 carrying no rows. A 200 with rows is a
 * failure even though the status looks fine -- which is exactly the mistake a
 * status-only assertion makes.
 */
export function expectDenied(label, resp, { allowEmpty = true } = {}) {
  let passed, detail;
  if ([401, 403, 404].includes(resp.status)) {
    passed = true;
    detail = `HTTP ${resp.status}`;
  } else if (resp.status === 200 && allowEmpty && isEmptyPayload(resp)) {
    passed = true;
    detail = "HTTP 200 with no rows (RLS filtered)";
  } else {
    passed = false;
    detail = `HTTP ${resp.status} returned data: ${redact(resp.body).slice(0, 300)}`;
  }
  record(label, passed, detail, "denied");
  return passed;
}

/** The companion assertion. Legitimate access must still work after a fix. */
export function expectAllowed(label, resp, { requireData = true } = {}) {
  let passed, detail;
  if (resp.status >= 200 && resp.status < 300) {
    if (requireData && isEmptyPayload(resp)) {
      passed = false;
      detail = `HTTP ${resp.status} but no data -- the fix may have over-denied`;
    } else {
      passed = true;
      detail = `HTTP ${resp.status}`;
    }
  } else {
    passed = false;
    detail = `HTTP ${resp.status}: ${redact(resp.body).slice(0, 300)}`;
  }
  record(label, passed, detail, "allowed");
  return passed;
}

function isEmptyPayload(resp) {
  if (Array.isArray(resp.json)) return resp.json.length === 0;
  if (resp.json && typeof resp.json === "object") return Object.keys(resp.json).length === 0;
  return resp.body.trim() === "" || resp.body.trim() === "[]";
}

function record(label, passed, detail, kind) {
  results.push({ label, passed, detail, kind });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}\n         ${detail}`);
  logLine({ at: new Date().toISOString(), assertion: label, kind, passed, detail });
}

// ----------------------------------------------------------------- runner ---

export function begin(title) {
  assertTargetAllowed();
  console.log(`\n=== ${title} ===`);
  console.log(`  target   : ${TARGET}`);
  console.log(`  supabase : ${SUPABASE_URL}`);
  console.log(`  log      : ${path.relative(process.cwd(), LOG_FILE)}\n`);
  logLine({ at: new Date().toISOString(), probe: title, target: TARGET });
}

/**
 * Print the summary and exit. Exit 1 if any assertion failed, so this can be
 * wired into a checklist or a CI step later.
 */
export function report() {
  const failed = results.filter((r) => !r.passed);
  console.log(`\n  ${results.length - failed.length}/${results.length} assertions passed`);
  if (failed.length) {
    console.log(`\n  FAILED:`);
    failed.forEach((r) => console.log(`    ${r.label} -- ${r.detail}`));
    console.log(
      `\n  A failed "denied" assertion means the exploit still works.\n` +
      `  A failed "allowed" assertion means the fix broke legitimate access.\n` +
      `  Both matter; neither is done until the other passes.\n`
    );
  }
  console.log(`  full request log: ${LOG_FILE}\n`);
  process.exit(failed.length ? 1 : 0);
}
