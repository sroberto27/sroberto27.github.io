// rls-static.mjs -- read supabase/migrations/*.sql and report the RLS posture
// they describe.
//
// This is the fallback for `psql` + 30-rls.sql, which need a live database.
// It is genuinely weaker and callers must report it as DEGRADED, for three
// reasons worth stating plainly rather than burying:
//
//   1. It sees the migrations, not the database. Anything applied by hand, by
//      the Supabase dashboard, or by a migration that was never committed is
//      invisible to it. Drift between migrations and the real catalog is
//      exactly where this kind of bug lives.
//   2. It is a regex reader, not a SQL parser. Unusual formatting can hide a
//      statement from it.
//   3. It can tell you a policy EXISTS and report its text. It cannot tell you
//      whether the policy's logic is correct. That is the reasoning half of
//      the supabase scope -- see references/20-supabase.md.
//
// Usage: node rls-static.mjs <migrations-dir>

import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const emit = (status, name, detail) =>
  console.log(`[${status.padEnd(8)}] ${name.padEnd(34)} ${detail}`);

if (!dir || !fs.existsSync(dir)) {
  emit("SKIPPED", "rls-static", `no migrations directory at ${dir}`);
  process.exit(0);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (!files.length) {
  emit("SKIPPED", "rls-static", "no .sql migrations found");
  process.exit(0);
}

// Concatenate in filename order, which is migration order, keeping a
// file:line index so every observation can cite a real location.
const lines = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  text.split("\n").forEach((line, i) => {
    lines.push({ file: f, line: i + 1, text: line });
  });
}
const sql = lines.map((l) => l.text).join("\n");
const lower = sql.toLowerCase();

console.log(`  migrations: ${files.length} file(s), ${lines.length} lines`);
files.forEach((f) => console.log(`    ${f}`));

const where = (re) => {
  const out = [];
  for (const l of lines) if (re.test(l.text)) out.push(l);
  return out;
};

// --- statements -------------------------------------------------------------
// Statement-level split so a policy body spanning several lines stays intact.
const statements = [];
{
  let buf = "";
  let startLine = null;
  for (const l of lines) {
    const stripped = l.text.replace(/--.*$/, "");
    if (!buf && !stripped.trim()) continue;
    if (!buf) startLine = l;
    buf += stripped + "\n";
    if (stripped.includes(";")) {
      statements.push({ sql: buf, at: startLine });
      buf = "";
      startLine = null;
    }
  }
  if (buf.trim()) statements.push({ sql: buf, at: startLine });
}

const loc = (s) => `${s.at?.file}:${s.at?.line}`;

// --- tables vs RLS ----------------------------------------------------------
console.log("\n  --- tables and row level security ---");

const tables = new Set();
for (const s of statements) {
  const m = s.sql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/i);
  if (m) tables.add(m[1].replace(/"/g, "").replace(/^public\./, ""));
}
const rlsEnabled = new Set();
for (const s of statements) {
  const m = s.sql.match(/alter\s+table\s+([a-z0-9_."]+)\s+enable\s+row\s+level\s+security/i);
  if (m) rlsEnabled.add(m[1].replace(/"/g, "").replace(/^public\./, ""));
}

console.log(`  tables created            : ${tables.size}`);
console.log(`  tables with RLS enabled   : ${rlsEnabled.size}`);

const noRls = [...tables].filter((t) => !rlsEnabled.has(t));
if (noRls.length) {
  emit("LEAD", "rls-not-enabled", `${noRls.length} table(s) never get ENABLE ROW LEVEL SECURITY`);
  noRls.forEach((t) => console.log(`    ${t}`));
  console.log("    A table without RLS is readable by anyone holding the publishable");
  console.log("    key IF it is also exposed through the Data API. Check the grants");
  console.log("    section below before ranking this.");
} else {
  emit("OK", "rls-not-enabled", "every created table enables RLS");
}

// A table can also be force-RLS'd; note it, since table owners bypass RLS
// without it.
const forced = where(/force\s+row\s+level\s+security/i);
console.log(`  force row level security  : ${forced.length}`);
if (!forced.length) {
  console.log("    (no FORCE RLS anywhere -- the table owner role still bypasses");
  console.log("     every policy. Usually fine, since the app connects as anon/");
  console.log("     authenticated, but worth knowing.)");
}

// --- policies ---------------------------------------------------------------
console.log("\n  --- policies ---");

const policies = [];
for (const s of statements) {
  const m = s.sql.match(/create\s+policy\s+"?([^"\n]+?)"?\s+on\s+([a-z0-9_."]+)([\s\S]*)/i);
  if (!m) continue;
  const body = m[3];
  const forM = body.match(/\bfor\s+(all|select|insert|update|delete)\b/i);
  const toM = body.match(/\bto\s+([a-z_, ]+?)(?:\s+using|\s+with\s+check|;)/i);
  const usingM = body.match(/\busing\s*\(([\s\S]*?)\)\s*(?:with\s+check|;|$)/i);
  const checkM = body.match(/\bwith\s+check\s*\(([\s\S]*?)\)\s*;?\s*$/i);
  policies.push({
    name: m[1].trim(),
    table: m[2].replace(/"/g, "").replace(/^public\./, ""),
    cmd: (forM ? forM[1] : "ALL").toUpperCase(),
    roles: toM ? toM[1].trim() : "(default: PUBLIC)",
    using: usingM ? usingM[1].trim().replace(/\s+/g, " ") : null,
    check: checkM ? checkM[1].trim().replace(/\s+/g, " ") : null,
    at: s.at,
    loc: loc(s),
  });
}

console.log(`  policies defined: ${policies.length}\n`);
const byTable = {};
for (const p of policies) (byTable[p.table] ||= []).push(p);
for (const [t, ps] of Object.entries(byTable).sort()) {
  console.log(`    ${t}`);
  for (const p of ps) {
    console.log(`      [${p.cmd.padEnd(6)}] ${p.name}   (${p.loc})  to ${p.roles}`);
    if (p.using) console.log(`               USING      ${p.using.slice(0, 150)}`);
    if (p.check) console.log(`               WITH CHECK ${p.check.slice(0, 150)}`);
  }
}

// --- permissive predicates --------------------------------------------------
console.log("\n  --- permissive predicates ---");
const truthy = (x) => x && /^\(*\s*true\s*\)*$/i.test(x.trim());
const openUsing = policies.filter((p) => truthy(p.using));
const openCheck = policies.filter((p) => truthy(p.check));

if (openUsing.length || openCheck.length) {
  emit("LEAD", "policy-always-true",
    `${openUsing.length} USING(true) and ${openCheck.length} WITH CHECK(true)`);
  [...openUsing, ...openCheck].forEach((p) =>
    console.log(`    ${p.table}.${p.name} [${p.cmd}] ${p.loc}`));
  console.log("    USING(true) on a SELECT policy is often deliberate -- a table");
  console.log("    that is genuinely public. On INSERT/UPDATE/DELETE it means any");
  console.log("    caller the policy applies to can write any row. Read each one.");
} else {
  emit("OK", "policy-always-true", "no unconditional USING/WITH CHECK predicates");
}

// --- write policies missing WITH CHECK --------------------------------------
// The classic RLS hole: USING controls which rows you may act on, WITH CHECK
// controls what the row may look like afterwards. An UPDATE policy with only
// USING lets a caller who legitimately owns a row rewrite it into a row they
// should not own -- flipping org_id, escalating a role column, and so on.
console.log("\n  --- write policies and WITH CHECK ---");
const writeNoCheck = policies.filter(
  (p) => ["INSERT", "UPDATE", "ALL"].includes(p.cmd) && !p.check
);
if (writeNoCheck.length) {
  emit("LEAD", "write-policy-no-with-check",
    `${writeNoCheck.length} write-capable policy/policies define no WITH CHECK`);
  writeNoCheck.forEach((p) =>
    console.log(`    ${p.table}.${p.name} [${p.cmd}] ${p.loc}`));
  console.log("    For INSERT, Postgres has no USING clause at all, so a missing");
  console.log("    WITH CHECK means unrestricted insert. For UPDATE, Postgres");
  console.log("    defaults WITH CHECK to the USING expression -- which is safe only");
  console.log("    if that expression constrains the NEW row as well as the OLD one.");
  console.log("    Decide per policy; this is not automatically a finding.");
} else {
  emit("OK", "write-policy-no-with-check", "every write-capable policy defines WITH CHECK");
}

// --- grants -----------------------------------------------------------------
console.log("\n  --- grants to API roles ---");
const grants = where(/^\s*grant\s+/i).filter((l) => /\b(anon|authenticated)\b/i.test(l.text));
if (grants.length) {
  emit("LEAD", "api-role-grants", `${grants.length} GRANT statement(s) touch anon/authenticated`);
  grants.forEach((l) => console.log(`    ${l.file}:${l.line}  ${l.text.trim().slice(0, 140)}`));
  console.log("    RLS only constrains a role that has been granted table access in");
  console.log("    the first place. A GRANT to anon on a table whose policies assume");
  console.log("    an authenticated caller is the combination to look for.");
} else {
  emit("OK", "api-role-grants", "no explicit GRANT to anon/authenticated in the migrations");
  console.log("    Supabase grants these roles by default at project setup, so silence");
  console.log("    here does NOT mean the roles lack access. Only the live catalog");
  console.log("    (30-rls.sql) can answer that.");
}

// --- SECURITY DEFINER -------------------------------------------------------
// A SECURITY DEFINER function runs as its owner and bypasses RLS. Without a
// pinned search_path, a caller who can create objects in a schema earlier on
// the path can shadow a table or function the body references and have it
// executed with the owner's privileges.
console.log("\n  --- SECURITY DEFINER functions ---");
const defFns = [];
for (const s of statements) {
  if (!/security\s+definer/i.test(s.sql)) continue;
  const nameM = s.sql.match(/create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_."]+)\s*\(/i);
  defFns.push({
    name: nameM ? nameM[1] : "(unnamed)",
    pinned: /set\s+search_path\s*(?:=|to)/i.test(s.sql),
    loc: loc(s),
  });
}
console.log(`  SECURITY DEFINER functions: ${defFns.length}`);
const unpinned = defFns.filter((f) => !f.pinned);
if (unpinned.length) {
  emit("LEAD", "definer-search-path",
    `${unpinned.length} SECURITY DEFINER function(s) do not pin search_path`);
  unpinned.forEach((f) => console.log(`    ${f.name}  ${f.loc}`));
} else if (defFns.length) {
  emit("OK", "definer-search-path", "every SECURITY DEFINER function pins search_path");
} else {
  emit("OK", "definer-search-path", "no SECURITY DEFINER functions in the migrations");
}
defFns.filter((f) => f.pinned).forEach((f) =>
  console.log(`    pinned: ${f.name}  ${f.loc}`));

// --- views ------------------------------------------------------------------
// A view runs with its owner's privileges and does NOT inherit the underlying
// table's RLS unless it is declared security_invoker (PG15+). A view over an
// RLS-protected table is a standard way to accidentally publish everything.
console.log("\n  --- views ---");
const views = [];
for (const s of statements) {
  const m = s.sql.match(/create\s+(?:or\s+replace\s+)?view\s+([a-z0-9_."]+)/i);
  if (m) views.push({ name: m[1], invoker: /security_invoker/i.test(s.sql), loc: loc(s) });
}
if (!views.length) {
  emit("OK", "view-security-invoker", "no views defined in the migrations");
} else {
  const noInv = views.filter((v) => !v.invoker);
  if (noInv.length) {
    emit("LEAD", "view-security-invoker",
      `${noInv.length} view(s) not declared security_invoker`);
    noInv.forEach((v) => console.log(`    ${v.name}  ${v.loc}`));
    console.log("    Such a view runs as its owner and bypasses the RLS on the tables");
    console.log("    beneath it. Check whether it is exposed through the Data API.");
  } else {
    emit("OK", "view-security-invoker", "every view is security_invoker");
  }
}

// --- triggers that guard privilege columns ----------------------------------
console.log("\n  --- privilege-guarding triggers ---");
const trig = where(/create\s+trigger/i);
console.log(`  triggers created: ${trig.length}`);
trig.forEach((l) => console.log(`    ${l.file}:${l.line}  ${l.text.trim().slice(0, 130)}`));
if (trig.length) {
  console.log("    Where a trigger is what stops a user editing their own role or org");
  console.log("    membership, it is load-bearing authz. Read its body and ask what");
  console.log("    happens on the bootstrap path -- the first admin, a NULL old row,");
  console.log("    a service-role write. That path has already needed a fix here.");
}

console.log(`
  WHAT THIS CANNOT TELL YOU
  Everything above describes the migrations, not the live database. It also
  cannot judge whether a policy's logic is right -- only that it exists and
  what it says. Both of those are the reasoning half of the supabase scope.
  Run 30-rls.sql against the real catalog when psql and a connection string
  are available, and treat any difference as the most interesting output of
  the whole scan.`);
