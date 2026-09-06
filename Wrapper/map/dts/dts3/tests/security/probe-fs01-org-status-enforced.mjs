// PASS means: every place that decides "is this caller a member/admin of this
// org" also requires the ORGANIZATION itself to be active, so disabling an org
// actually revokes access instead of only looking like it does.
//
//   node tests/security/probe-fs01-org-status-enforced.mjs
//
// This is a structural regression guard. It needs no credentials and no
// network, so it runs in CLAUDE.md's standard checklist loop.
//
// The real behavioural exploit lives in probe-fs01-disabled-org-rls.sql, which
// disables a populated org inside a transaction, checks what its members can
// still reach, and rolls back. That one needs a database connection, so it is
// run deliberately during an audit rather than on every change. Before the fix
// it reported is_org_member = t and is_org_admin = t against a disabled org.
//
// Four sites, one root cause. F-S01 existed because the Phase 5b fix landed in
// exactly one of them (activeOrgIdsFor) and nowhere else, so this probe checks
// all four rather than the two the finding's title mentions -- a sweep, not a
// single case.
//
// A red result means one of the four dropped its organization-status check.
// That is the bug coming back, not a fixture drifting.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { begin, report, expectDenied, expectAllowed } from "./_harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

/* Comments describe the invariant; only executable code can break it. */
const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:--|\/\/).*$/gm, "");

const asResult = (ok, detail) => ({
  status: ok ? 403 : 200,
  body: ok ? "" : detail,
  json: ok ? [] : [detail],
  headers: new Headers(),
});

begin("F-S01 -- organization status is enforced everywhere membership is decided");

// ---- 1 & 2: the two RLS helpers, from the latest migration that defines them.
const migDir = path.join(ROOT, "supabase", "migrations");
const migrations = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ f, sql: strip(fs.readFileSync(path.join(migDir, f), "utf8")) }));

function latestBody(fnName) {
  let body = null;
  for (const { sql } of migrations) {
    const re = new RegExp(
      `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${fnName}\\s*\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
      "gi"
    );
    let m;
    while ((m = re.exec(sql)) !== null) body = m[1];
  }
  return body;
}

for (const fn of ["is_org_member", "is_org_admin"]) {
  const body = latestBody(fn);
  const joinsOrgs = body && /join\s+public\.organizations\b/i.test(body);
  const checksStatus = body && /o\.status\s*=\s*'active'/i.test(body);
  const ok = Boolean(joinsOrgs && checksStatus);
  expectDenied(
    `RLS helper public.${fn}() requires the organization to be active`,
    asResult(
      ok,
      body === null
        ? `${fn} not found in any migration`
        : `${fn} does not join organizations and filter o.status='active'`
    )
  );
}

// ---- 3: the Function-path guard behind requireOrgAdminOf().
const adminJs = strip(read("functions", "_lib", "admin.js"));
const isOrgAdminQuery =
  adminJs.match(/export\s+async\s+function\s+isOrgAdmin[\s\S]*?pgrst\([\s\S]*?`([^`]*)`/) || [];
const fnOk =
  /organizations!inner\(status\)/.test(isOrgAdminQuery[1] || "") &&
  /organizations\.status=eq\.active/.test(isOrgAdminQuery[1] || "");
expectDenied(
  "functions/_lib/admin.js isOrgAdmin() requires the organization to be active",
  asResult(fnOk, "isOrgAdmin()'s PostgREST filter omits organizations.status=eq.active")
);

// ---- 4: the client session that decides which team panels render.
const appJs = strip(read("js", "app.js"));
const membershipQuery =
  appJs.match(/from\("organization_members"\)[\s\S]{0,400}?;/) || [];
const clientOk =
  /organizations!inner\(/.test(membershipQuery[0] || "") &&
  /\.eq\(\s*"organizations\.status"\s*,\s*"active"\s*\)/.test(membershipQuery[0] || "");
expectDenied(
  "js/app.js buildSessionFromAuth() excludes disabled orgs from the session",
  asResult(clientOk, "the membership query does not filter organizations.status")
);

// ---- The companion. The fix must not have been "deny every org".
// activeOrgIdsFor() was already correct; it is asserted here so a later
// "simplification" cannot quietly remove the check that started all this.
const accessJs = strip(read("functions", "_lib", "access.js"));
const activeOrgQuery =
  accessJs.match(/export\s+async\s+function\s+activeOrgIdsFor[\s\S]*?`([^`]*)`/) || [];
expectAllowed(
  "activeOrgIdsFor() still resolves ACTIVE orgs (membership is not denied outright)",
  {
    status:
      /status=eq\.active/.test(activeOrgQuery[1] || "") &&
      /organizations\.status=eq\.active/.test(activeOrgQuery[1] || "")
        ? 200
        : 500,
    body: "",
    json: { query: Boolean(activeOrgQuery[1]) },
    headers: new Headers(),
  }
);

// And the helpers must still return true for an active org -- i.e. the fix
// added a condition, it did not replace the membership test with `false`.
// Deliberately written to accept the pre-fix shape too (bare `user_id` as well
// as the aliased `m.user_id`): this assertion exists to catch a fix that
// over-denies, so it must not go red merely because the code is not fixed yet.
for (const fn of ["is_org_member", "is_org_admin"]) {
  const body = latestBody(fn) || "";
  const testsMembership =
    /(?:\bm\.)?user_id\s*=\s*auth\.uid\(\)/.test(body) &&
    /(?:\bm\.)?status\s*=\s*'active'/.test(body);
  expectAllowed(
    `public.${fn}() still tests real membership (user_id = auth.uid())`,
    {
      status: testsMembership ? 200 : 500,
      body: testsMembership ? "" : `${fn} no longer tests membership at all`,
      json: { ok: testsMembership },
      headers: new Headers(),
    }
  );
}

report();
