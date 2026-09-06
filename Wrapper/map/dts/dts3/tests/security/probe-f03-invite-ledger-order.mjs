// PASS means: the invite route's rate-limit ledger row is written strictly and
// BEFORE the account it counts, so a failed ledger write refuses the invite
// rather than granting a free one.
//
//   node tests/security/probe-f03-invite-ledger-order.mjs
//
// READ THIS BEFORE TRUSTING IT. This is a structural regression guard, not an
// exploit probe, and it is the weakest test in this directory.
//
// F-03 has no attacker-triggerable exploit. The bypass needs the admin_audit
// insert to fail, and an org_admin has no reliable way to cause that -- the
// row's contents are server-derived except for an email GoTrue has already
// accepted. So there is nothing to reproduce end-to-end: the weakness only
// shows up under database failure, which is a robustness property, not an
// attack. Rather than fake an exploit, this asserts the ordering invariant
// that makes the failure safe, so a later refactor cannot quietly restore the
// old shape.
//
// A real behavioural test would need fault injection into the dev database.
// That is worth doing if this route ever gets a second ledger consumer.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { begin, report, expectDenied, expectAllowed } from "./_harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INVITE_JS = path.join(HERE, "..", "..", "functions", "api", "org", "invite.js");
const src = fs.readFileSync(INVITE_JS, "utf8");

begin("F-03 -- the invite rate-limit ledger must be written first, and strictly");

/* Comments describe the invariant; only executable code can break it. */
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

function asResponse(rows) {
  return { status: 200, headers: {}, body: JSON.stringify(rows), json: rows };
}

const ledgerWriteAt = code.indexOf('action: "invite.send"');
const accountCreateAt = code.indexOf('"/admin/users"');
const limitReadAt = code.indexOf("action=eq.invite.send");

const problems = [];

if (ledgerWriteAt === -1) {
  problems.push({ issue: 'no invite.send ledger row is written at all -- the limiter has no ledger' });
}
if (accountCreateAt === -1) {
  problems.push({ issue: "the GoTrue account-creation call could not be located; this probe's anchors are stale" });
}
if (ledgerWriteAt !== -1 && accountCreateAt !== -1 && ledgerWriteAt > accountCreateAt) {
  problems.push({
    issue: "the ledger row is written AFTER the account is created",
    consequence: "a failed ledger write leaves a created account that never counted against the limit",
  });
}
// The swallowing helper must not be what records this row.
if (/writeAudit\s*\(\s*env\s*,\s*{[^}]*invite\.send/s.test(code) || /\bwriteAudit\b/.test(code)) {
  problems.push({
    issue: "writeAudit() appears in this route",
    consequence: "writeAudit() swallows its own failures, which is unsafe for a row the rate limiter counts",
  });
}

console.log(`  limit read at  : ${limitReadAt}`);
console.log(`  ledger write at: ${ledgerWriteAt}`);
console.log(`  account create : ${accountCreateAt}\n`);

expectDenied("the ledger cannot silently no-op an invite", asResponse(problems));

/* ---- companion: a successful invite is still fully recorded -------------- */

const stillAudited = [];
if (ledgerWriteAt === -1) stillAudited.push("no invite.send row is written");
// The reserved row must still be tied to the account it created, or the audit
// trail loses the link between actor and target.
if (!/target_id:\s*created\.id/.test(code)) {
  stillAudited.push("the reserved row is never updated with the created user id");
}
// A reservation must be released when the invite does not go ahead, or the
// audit trail records invites that never happened.
if (!/method:\s*"DELETE"/.test(code)) {
  stillAudited.push("a reservation is never released when account creation fails");
}
if (stillAudited.length) console.log("  audit-trail gaps:", stillAudited);

expectAllowed(
  "a successful invite is still audited, and an abandoned one is not",
  asResponse(stillAudited.length ? [] : [{ ok: true }])
);

report();
