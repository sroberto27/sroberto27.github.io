// DTS migration — Handoff: real client import.
// DORMANT. Do not run during dev (Phases 1-9). Only runs at Handoff, against
// the CLIENT's production Supabase project, with the CLIENT's real data, and
// only after the user has reviewed and approved the org/membership/
// entitlement mapping this script produces (see docs/migration/
// ACCESS-MODEL.md and .claude/commands/migrate-handoff.md).
//
// Unlike scripts/seed-dev.mjs, this GROUPS rows into organizations rather
// than creating one isolated user per row -- that's the whole point of the
// org model this migration builds. It defaults to --dry-run: nothing is
// written to Supabase unless you pass --confirm explicitly.
//
// Expected input: a JSON file (path via --input=<file>, no default) shaped
// like the OLD directory rows this migration is retiring --
//   [{ access_id, access_code, client, project, twin_url, sweep_id, notes }, ...]
// -- because that's the real, current shape of DTS's client data
// (data/access/access.json's old demoDirectory / the retired Google Sheet).
// One row per twin; a client with several twins has several rows sharing the
// same access_id + client name.
//
// What this script does NOT decide for you (per migrate-handoff.md):
//   - WHO is org_admin at each organization. Never inferred from the sheet
//     (no "is admin" column ever existed, and a job title in `notes` is not
//     a reliable signal). Pass --org-admins=<file> mapping access_id -> org
//     slug for the contacts who should be org_admin; everyone else in that
//     org becomes a plain 'member'.
//   - The mapping from a legacy twin_url to a real resource_key
//     (project.<id>:<experienceId> per ACCESS-MODEL.md §4). That mapping
//     depends on which CURRENT /data project document each legacy twin_url
//     actually corresponds to, which is a one-time judgment call, not
//     something derivable from the old sheet data alone. Pass
//     --resource-map=<file> as { "<twin_url>": "<resource_key>", ... };
//     any row whose twin_url isn't in that map is reported, not silently
//     skipped or guessed.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const dryRun = !args.confirm;

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
if (!args.input) {
  console.error("Usage: node scripts/import-clients.mjs --input=<file.json> [--org-admins=<file.json>] [--resource-map=<file.json>] [--confirm]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const rows = JSON.parse(await readFile(args.input, "utf8"));
const orgAdmins = args["org-admins"] ? JSON.parse(await readFile(args["org-admins"], "utf8")) : {};
const resourceMap = args["resource-map"] ? JSON.parse(await readFile(args["resource-map"], "utf8")) : {};

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Group rows by client name, and flag near-duplicate names (e.g. "Acme
// Hotels" vs "Acme Hotel") as a probable duplicate-organization bug rather
// than silently creating two orgs for what's really one client -- per
// migrate-handoff.md's explicit safeguard.
const byClient = new Map();
for (const row of rows) {
  const name = (row.client || "").trim();
  if (!name) continue;
  if (!byClient.has(name)) byClient.set(name, []);
  byClient.get(name).push(row);
}

const clientNames = [...byClient.keys()];
const nearDuplicates = [];
for (let i = 0; i < clientNames.length; i++) {
  for (let j = i + 1; j < clientNames.length; j++) {
    const a = slugify(clientNames[i]);
    const b = slugify(clientNames[j]);
    if (a !== b && (a.includes(b) || b.includes(a))) {
      nearDuplicates.push([clientNames[i], clientNames[j]]);
    }
  }
}
if (nearDuplicates.length) {
  console.warn("POSSIBLE DUPLICATE ORGANIZATIONS -- review before proceeding:");
  nearDuplicates.forEach(([a, b]) => console.warn(`  "${a}"  vs  "${b}"`));
  if (!args["ignore-duplicates"]) {
    console.error("\nRefusing to proceed. Fix the source data or re-run with --ignore-duplicates once you've confirmed these are genuinely different clients.");
    process.exit(1);
  }
}

const unmappedResources = new Set();
const plan = [];

for (const [clientName, clientRows] of byClient) {
  const slug = slugify(clientName);
  const accessIds = [...new Set(clientRows.map((r) => r.access_id))];
  const members = accessIds.map((id) => ({
    accessId: id,
    orgRole: orgAdmins[id] === slug ? "org_admin" : "member",
  }));
  const entitlements = clientRows.map((r) => {
    const resourceKey = resourceMap[r.twin_url];
    if (!resourceKey) unmappedResources.add(r.twin_url);
    return { resourceKey, twinUrl: r.twin_url, project: r.project };
  });
  plan.push({ orgName: clientName, orgSlug: slug, members, entitlements });
}

console.log(`Plan: ${plan.length} organization(s) from ${rows.length} source row(s).\n`);
for (const p of plan) {
  console.log(`- ${p.orgName} (${p.orgSlug})`);
  p.members.forEach((m) => console.log(`    member: ${m.accessId} -> ${m.orgRole}`));
  p.entitlements.forEach((e) =>
    console.log(`    entitlement: ${e.project} (${e.twinUrl}) -> ${e.resourceKey ?? "UNMAPPED"}`)
  );
}

if (unmappedResources.size) {
  console.warn(`\n${unmappedResources.size} twin_url(s) have no entry in --resource-map, so no entitlement can be created for them:`);
  unmappedResources.forEach((u) => console.warn(`  ${u}`));
  console.warn("Add them to the resource-map file before running with --confirm, or those clients lose access to those twins.");
}

if (dryRun) {
  console.log("\nDRY RUN -- nothing written. Re-run with --confirm once this plan looks correct.");
  process.exit(unmappedResources.size ? 1 : 0);
}

console.log("\n--confirm passed. Creating real accounts and data. This is NOT dev/dummy data.");
for (const p of plan) {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ slug: p.orgSlug, name: p.orgName })
    .select("id")
    .single();
  if (orgErr) throw new Error(`create org ${p.orgSlug}: ${orgErr.message}`);

  for (const m of p.members) {
    // access_id in the legacy sheet was never an email address -- the real
    // import needs a real email per contact, which the legacy data doesn't
    // reliably carry. This is the one piece that needs a human-provided
    // email per access_id before this can create real Auth users; flagging
    // rather than fabricating an address.
    console.warn(`  NEEDS REAL EMAIL for access_id "${m.accessId}" at ${p.orgSlug} (org_role=${m.orgRole}) -- not created.`);
  }

  for (const e of p.entitlements) {
    if (!e.resourceKey) continue;
    const { error: entErr } = await admin
      .from("resource_entitlements")
      .insert({ resource_key: e.resourceKey, subject_type: "org", subject_id: org.id });
    if (entErr) throw new Error(`entitlement ${e.resourceKey} -> ${p.orgSlug}: ${entErr.message}`);
  }
}

console.log("\nDone. Organizations and mapped entitlements created. Auth users were NOT created automatically -- see the NEEDS REAL EMAIL warnings above; that step needs a real email per contact, confirmed with the client, before sending invites.");
