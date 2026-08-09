// functions/api/admin/apps/upload.js -- site_admin only.
// Streams the raw request body straight into DTS_BUILDS -- no buffering, no
// presigned-URL infra (this project has no R2 S3-API credentials anywhere;
// see functions/api/download/[key].js's own header comment for why that's
// the deliberate choice, not an oversight). Only PATCHes r2_object_key once
// the R2 write itself has actually succeeded.
//
// Known limitation, not fixed here: a single streamed PUT has practical
// ceilings -- Cloudflare's own request-body cap on lower plan tiers (today,
// on this project's Free plan, ~100MB), and R2's binding buffering a
// ReadableStream of unknown length in Worker memory rather than truly
// streaming it. Fine for dev/dummy testing; a real multi-GB client installer
// at handoff may need R2's multipart upload API instead. Flagging now
// rather than discovering it mid-handoff.

import { json, pgrst } from "../../../_lib/access.js";
import { requireSiteAdmin, writeAudit } from "../../../_lib/admin.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireSiteAdmin(request, env);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const filename = (url.searchParams.get("filename") || "").trim();
  if (!key || !filename) return json({ error: "key and filename query params are required" }, 400);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) return json({ error: "filename has unsupported characters" }, 400);

  const existingRows = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}&select=*`);
  if (!existingRows.length) return json({ error: "no client_apps row for that key -- create it first" }, 404);
  const existing = existingRows[0];

  if (!request.body) return json({ error: "no file body in request" }, 400);

  const objectKey = `builds/${key}/${filename}`;
  await env.DTS_BUILDS.put(objectKey, request.body, {
    httpMetadata: { contentType: request.headers.get("content-type") || "application/octet-stream" },
  });

  const [updated] = await pgrst(env, `client_apps?key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: { r2_object_key: objectKey, updated_at: new Date().toISOString() },
  });

  await writeAudit(env, {
    actorUserId: auth.userId,
    action: "client_app.update",
    targetType: "client_app",
    targetId: key,
    before: { r2_object_key: existing.r2_object_key },
    after: { r2_object_key: objectKey },
  });

  return json({ app: updated }, 200);
}
