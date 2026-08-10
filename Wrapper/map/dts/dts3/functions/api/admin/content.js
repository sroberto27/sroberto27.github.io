// functions/api/admin/content.js -- site_admin only, read-only.
//
// Fixes a real gap: js/content-loader.js's loadContent() (the ONE
// content-loading path for every visitor, admin included) only ever fetches
// from functions/data/[[path]].js, which is hard-coded, by explicit design,
// to read ONLY the data/current/ prefix -- it can never resolve
// data/source/. So a site_admin session, exactly like a guest, only ever
// saw the public/stripped document set: gated GIS maps/tours entirely
// absent (whole-document exclusion, ACCESS-MODEL.md §5), and any gated
// project experience's real tourUrl/mapId stripped (field-level). This
// endpoint is the missing other half -- js/admin.js's ensureFullContent()
// calls it once, right when a site_admin session is confirmed, and merges
// the result into window.DTS_CONTENT before building the nav.
//
// Reads data/source/_latest.json -- ONE combined object functions/api/
// publish.js now also writes on every publish (same shape/reasoning as its
// existing data/snapshots/<id>.json, just a fixed key instead of
// timestamped) -- rather than the manifest plus all 61 individual
// documents separately. That would be ~62 R2 operations in one Function
// invocation, the exact ceiling publish.js's own file header documents
// hitting ("Too many subrequests") at a similar document count; one R2 read
// avoids the problem entirely instead of rediscovering it.
//
// data/source/* is already unreachable through the public catch-all route
// by construction (functions/data/[[path]].js only ever resolves
// data/current/), so this Function is the only way to reach it -- same
// security boundary every other private data/source/ read already relies
// on (_hashes.json, data/snapshots/*).

import { json } from "../../_lib/access.js";
import { requireSiteAdmin } from "../../_lib/admin.js";

const LATEST_KEY = "data/source/_latest.json";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const obj = await env.DTS_CONTENT.get(LATEST_KEY);
  if (!obj) {
    return json({ error: "No full content bundle yet -- publish once to create it." }, 404);
  }

  const { manifest, docs } = await obj.json();
  return json({ manifest, docs }, 200);
}
