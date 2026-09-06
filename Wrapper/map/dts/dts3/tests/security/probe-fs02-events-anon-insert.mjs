// PASS means: an anonymous caller holding only the publishable key cannot
// insert a row into public.events, and the server-side /api/track path still
// can.
//
//   node tests/security/probe-fs02-events-anon-insert.mjs           # structural, offline
//   node tests/security/probe-fs02-events-anon-insert.mjs --live    # real request to dev Supabase
//
// Two modes, on purpose.
//
// DEFAULT (offline) asserts the migration state: no policy grants `anon` an
// INSERT on public.events. It needs no credentials and no network, so it runs
// in CLAUDE.md's standard checklist loop alongside the other probes.
//
// --live is the real exploit: it POSTs to /rest/v1/events with nothing but the
// publishable key read from js/supabase-init.js, using a `type` outside
// track.js's 17-value allowlist. Before the fix this returned 201 and the row
// landed. After the fix it must be refused. The live row, if one is ever
// created again, carries the marker below so it can be found and removed.
//
// Why the offline mode is the default rather than the live one: the live check
// writes to a shared database. Per the rules of engagement that is a fixture
// you create and then remove, which is fine for a deliberate audit run and
// wrong for a test people run casually after every change.
//
// A red DEFAULT result means someone re-added an anon INSERT policy on events.
// A red --live result means the deployed database does not match the
// migrations -- which is a different and more urgent problem.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  begin, report, req, expectDenied, expectAllowed,
  SUPABASE_URL, SUPABASE_KEY,
} from "./_harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(HERE, "..", "..", "supabase", "migrations");
export const MARKER = "AUDIT-FS02-PROBE";

const LIVE = process.argv.includes("--live");

begin(
  LIVE
    ? "F-S02 -- anonymous insert into public.events (live)"
    : "F-S02 -- no policy grants anon INSERT on public.events (structural)"
);

if (!LIVE) {
  // Read every migration in order and track the net policy state, so that a
  // `create policy` followed by a later `drop policy` reads as absent -- the
  // shape this fix actually takes.
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  let sql = files.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), "utf8")).join("\n");

  // Strip comments so prose describing the old policy cannot satisfy or break
  // the match -- only executable SQL counts.
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");

  const created = [...sql.matchAll(
    /create\s+policy\s+"?([\w-]+)"?\s+on\s+public\.events\s+for\s+insert([\s\S]*?);/gi
  )];
  const dropped = new Set(
    [...sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"?([\w-]+)"?\s+on\s+public\.events/gi)]
      .map((m) => m[1])
  );

  const liveInsertPolicies = created.filter(([, name]) => !dropped.has(name));

  const anonGranting = liveInsertPolicies.filter(([, , tail]) => {
    // A policy with no TO clause defaults to PUBLIC, which includes anon.
    const to = tail.match(/\bto\s+([\w\s,]+?)(?:\bwith\b|\busing\b|$)/i);
    if (!to) return true;
    const roles = to[1].split(",").map((r) => r.trim().toLowerCase());
    return roles.includes("anon") || roles.includes("public");
  });

  expectDenied(
    "no surviving INSERT policy on public.events grants anon",
    {
      status: anonGranting.length ? 200 : 403,
      body: anonGranting.length
        ? `anon-writable INSERT policies still present: ${anonGranting.map((m) => m[1]).join(", ")}`
        : "",
      json: anonGranting.length ? anonGranting.map((m) => m[1]) : [],
      headers: new Headers(),
    }
  );

  // The companion, structurally: track.js must still be the write path, so the
  // fix cannot be "delete the policy and also delete analytics".
  const trackJs = fs.readFileSync(
    path.join(HERE, "..", "..", "functions", "api", "track.js"), "utf8"
  );
  expectAllowed(
    "functions/api/track.js still inserts into events server-side",
    {
      status: /pgrst\(\s*env\s*,\s*["']events["']/.test(trackJs) ? 200 : 500,
      body: "",
      json: { present: /pgrst\(\s*env\s*,\s*["']events["']/.test(trackJs) },
      headers: new Headers(),
    }
  );

  report();
}

// ------------------------------------------------------------------- live ---

// The exploit: no session, no account, just the key every visitor already has.
// NOTE: deliberately NO `Prefer: return=representation`. That preference makes
// PostgREST add a RETURNING clause, which additionally requires the SELECT
// policy to pass -- and events_select is false for an anonymous caller. Asking
// for the row back therefore fails with 42501 even when the INSERT itself is
// permitted, which reads as "denied" and hides the finding. A real attacker
// spamming rows does not need them echoed back.
const exploit = await req(`${SUPABASE_URL}/rest/v1/events`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: `${MARKER}-not-an-allowed-type`,
    resource_key: MARKER,
    project_id: MARKER,
    metadata: { marker: MARKER, note: "security audit probe row" },
  }),
});

expectDenied("anonymous PostgREST insert into events is refused", exploit);

// The companion: the real analytics path must still work. This is the half
// that stops "drop every policy" from passing as a security fix.
const legit = await req(`${process.env.DTS_AUDIT_TARGET || "https://dts-website-4cu.pages.dev"}/api/track`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "sector_view", project_id: MARKER }),
});

expectAllowed("POST /api/track still accepts a legitimate event", legit, { requireData: false });

report();
