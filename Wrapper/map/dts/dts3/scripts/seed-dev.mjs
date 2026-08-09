// DTS migration — Phase 3 dummy dev seed.
// Creates DUMMY organizations, users, memberships, and entitlements so the
// portal has something real to exercise end to end. NEVER point this at real
// client data — see scripts/import-clients.mjs for the real (dormant) import.
// Schema/vocabulary: docs/migration/ACCESS-MODEL.md.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function devPassword() {
  return crypto.randomBytes(12).toString("base64url") + "!Aa1";
}

async function ensureOrg(slug, name) {
  const { data: existing } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin.from("organizations").insert({ slug, name }).select("id").single();
  if (error) throw new Error(`create org ${slug}: ${error.message}`);
  return data.id;
}

async function ensureUser(email) {
  const password = devPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error) return { id: data.user.id, password };

  // GoTrue's actual wording is "has already been registered" -- the "been"
  // meant the original /already registered/ substring check never matched,
  // so every re-run of this script hard-failed on the first existing user
  // instead of reaching the idempotent lookup path below (found while
  // re-running for Phase 8's org-level download entitlement).
  if (!/already (been )?registered|already exists/i.test(error.message)) {
    throw new Error(`create user ${email}: ${error.message}`);
  }
  // Re-run case: user already exists from a prior seed attempt. Look it up,
  // but the ORIGINAL password from that prior run is gone — flag it clearly
  // rather than pretend we still know it.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw new Error(`lookup existing user ${email}: ${listErr.message}`);
  const found = list.users.find((u) => u.email === email);
  if (!found) throw new Error(`${email} reported as existing but not found in listUsers()`);
  return { id: found.id, password: null };
}

async function setSiteRole(userId, role) {
  const { error } = await admin.from("profiles").update({ site_role: role }).eq("user_id", userId);
  if (error) throw new Error(`set site_role for ${userId}: ${error.message}`);
}

async function ensureMembership(orgId, userId, orgRole) {
  const { error } = await admin
    .from("organization_members")
    .upsert({ org_id: orgId, user_id: userId, org_role: orgRole }, { onConflict: "org_id,user_id" });
  if (error) throw new Error(`membership org=${orgId} user=${userId}: ${error.message}`);
}

async function ensureEntitlement(resourceKey, subjectType, subjectId, grantedBy) {
  const { data: existing } = await admin
    .from("resource_entitlements")
    .select("id")
    .eq("resource_key", resourceKey)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (existing) return;
  const { error } = await admin
    .from("resource_entitlements")
    .insert({ resource_key: resourceKey, subject_type: subjectType, subject_id: subjectId, granted_by: grantedBy });
  if (error) throw new Error(`entitlement ${resourceKey} -> ${subjectType}:${subjectId}: ${error.message}`);
}

async function ensureClientApp(key) {
  const { data: existing } = await admin.from("client_apps").select("id").eq("key", key).maybeSingle();
  if (existing) return;
  const { error } = await admin.from("client_apps").insert({
    key,
    name: "Dummy Viewer (dev)",
    platform: "windows",
    version: "0.0.1-dev",
    r2_object_key: "builds/dummy-viewer-win/dummy.zip",
    access: "restricted",
    enabled: true,
  });
  if (error) throw new Error(`client_app ${key}: ${error.message}`);
}

console.log("Seeding DUMMY dev data...\n");

const acmeId = await ensureOrg("acme-hotels", "Acme Hotels");
const betaId = await ensureOrg("beta-municipal", "Beta Municipal");
console.log(`Organizations: acme-hotels=${acmeId}  beta-municipal=${betaId}`);

const admin1 = await ensureUser("testadmin@example.com");
const user1 = await ensureUser("testuser@example.com");
const orgAdmin1 = await ensureUser("testorgadmin@example.com");
const member1 = await ensureUser("testmember@example.com");

await setSiteRole(admin1.id, "site_admin");

await ensureMembership(acmeId, orgAdmin1.id, "org_admin");
await ensureMembership(betaId, orgAdmin1.id, "member");
await ensureMembership(betaId, member1.id, "member");
// testuser@example.com deliberately gets NO membership — the plain
// registered-user-with-no-org case.

await ensureEntitlement("project.gfc:map", "org", acmeId, admin1.id);
await ensureEntitlement("download.dummy-viewer-win", "user", user1.id, admin1.id);
// Org-level grant, on a DIFFERENT account than the direct user grant above,
// so the two entitlement paths (subject_type='user' vs 'org') are each
// provably exercised by a distinct account rather than one account that
// happens to satisfy both: testorgadmin (member of acme-hotels, no direct
// entitlement of their own) can only reach this download via the org path.
await ensureEntitlement("download.dummy-viewer-win", "org", acmeId, admin1.id);

await ensureClientApp("dummy-viewer-win");

console.log("\nOrganization memberships:");
console.log("  testorgadmin@example.com -> org_admin @ acme-hotels, member @ beta-municipal");
console.log("  testmember@example.com   -> member @ beta-municipal");
console.log("  testadmin@example.com    -> site_role=site_admin (no org membership)");
console.log("  testuser@example.com     -> registered only, no org membership");

console.log("\nEntitlements:");
console.log("  project.gfc:map           -> org:acme-hotels");
console.log("  download.dummy-viewer-win -> user:testuser@example.com");
console.log("  download.dummy-viewer-win -> org:acme-hotels (testorgadmin reaches it via this; testmember/beta-municipal does not)");

console.log("\nClient apps: dummy-viewer-win (enabled)");

console.log("\n--- DEV-ONLY PASSWORDS (not written to any file, shown once) ---");
for (const [email, u] of [
  ["testadmin@example.com", admin1],
  ["testuser@example.com", user1],
  ["testorgadmin@example.com", orgAdmin1],
  ["testmember@example.com", member1],
]) {
  console.log(`  ${email}: ${u.password ?? "(already existed from a prior run — password unknown, reset via Supabase dashboard if needed)"}`);
}
console.log("------------------------------------------------------------------\n");

console.log("Seed complete.");
