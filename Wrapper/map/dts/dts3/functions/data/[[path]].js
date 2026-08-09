// DTS migration — Phase 6. Serves data/current/<path> (public, stripped)
// same-origin from R2, so js/content-loader.js's existing relative
// fetch("data/" + f) calls keep working with ZERO changes once the static
// data/ folder is removed from the deploy (content-loader.js:51,64,68).
//
// Reads ONLY the data/current/ prefix -- must never be able to resolve
// data/source/ (the full, private copy functions/api/resource/[key].js and
// its GIS-layer companion read). There is no code path here that takes a
// caller-supplied prefix; the R2 key is always this file's own hardcoded
// "data/current/" + the request's own path.
//
// Edge-cached via the Workers Cache API (caches.default) so
// functions/api/publish.js's caches.default.delete() purge is meaningful --
// Pages Functions responses are NOT auto-cached by Cloudflare's CDN the way
// static assets are, so without this explicit cache-aside step every
// request would hit R2 directly and a "purge" would have nothing to purge.

const CONTENT_TYPES = {
  json: "application/json",
  geojson: "application/geo+json",
};

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const segments = Array.isArray(params.path) ? params.path : [params.path];

  if (!segments.length || segments.some((s) => !s || s === ".." || s.includes("/"))) {
    return new Response("not found", { status: 404 });
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const relPath = segments.join("/");
  const key = `data/current/${relPath}`;
  const ext = relPath.slice(relPath.lastIndexOf(".") + 1).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

  const obj = await env.DTS_CONTENT.get(key);
  if (!obj) return new Response("not found", { status: 404 });

  const response = new Response(obj.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      // Short browser TTL (content can be republished any time) but long
      // enough for the edge cache-aside above to actually save R2 reads
      // under normal traffic; functions/api/publish.js purges this key
      // explicitly on every publish rather than relying on TTL expiry.
      "cache-control": "public, max-age=30, s-maxage=300",
    },
  });
  context.waitUntil(cache.put(request, response.clone()));
  return response;
}
