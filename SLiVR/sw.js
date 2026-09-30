/* Scope, host exclusions and cache lifecycle follow the approved shell reference. */
importScripts("./shell-cache.js");
const CACHE_NAME = "slivr-shell-v1";
const NEVER_CACHE = ["maps.dotd.la.gov", "spaces.dtsxr.com", "treedis.com", "tile.googleapis.com", "tile.openstreetmap.org"];
const KILL_SWITCH_PATHS = ["/SLiVR/config/service-worker.js", "/SLiVR/src/app/service-worker.js", "/SLiVR/config/deployment.js", "/SLiVR/src/app/main.js", "/SLiVR/sw.js", "/SLiVR/shell-cache.js"];
const allowed = new Set(self.SLIVR_SHELL.map(path => new URL(path, self.location.href).pathname));
let disabled = false;

self.addEventListener("install", event => {
  if (new URL(self.registration.scope).pathname !== "/SLiVR/") return;
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all(self.SLIVR_SHELL.map(path =>
    cache.add(new Request(path, { cache:"reload" })).catch(() => {})))));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("slivr-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))));
});
self.addEventListener("message", event => {
  if (event.data?.type !== "SLIVR_DISABLE" || !event.source?.url) return;
  const source = new URL(event.source.url);
  if (source.origin !== self.location.origin || !source.pathname.startsWith("/SLiVR/")) return;
  disabled = true;
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("slivr-shell-")).map(key => caches.delete(key)))).then(() => self.registration.unregister()));
});
self.addEventListener("fetch", event => {
  const req=event.request, url=new URL(req.url);
  if (disabled || req.method !== "GET" || url.origin !== self.location.origin || url.search
      || NEVER_CACHE.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
      || !url.pathname.startsWith("/SLiVR/")) return;
  const pathname=url.pathname === "/SLiVR/" ? "/SLiVR/index.html" : url.pathname;
  if (!allowed.has(pathname) && !KILL_SWITCH_PATHS.includes(pathname)) return;
  // Network-first includes every kill switch and avoids mixing stale module schemas.
  event.respondWith(networkFirst(req));
});
async function networkFirst(req) {
  const cache=await caches.open(CACHE_NAME);
  try {
    const response=await fetch(req, { cache:"no-cache" });
    if (response.ok && !response.redirected && response.type !== "opaque" && !disabled) await cache.put(req,response.clone());
    return response;
  } catch {
    const hit=await cache.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      const shell=await cache.match(new URL("./index.html", self.location.href).href);
      if (shell) return shell;
    }
    return new Response("Offline. Reconnect to load this SLiVR resource.",{status:503,headers:{"Content-Type":"text/plain;charset=utf-8"}});
  }
}
