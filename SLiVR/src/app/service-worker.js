import { enableServiceWorker } from "../../config/service-worker.js";

/** Unregister only this application; never reload over an unsaved workspace. */
export async function configureServiceWorker(win = globalThis.window, enabled = enableServiceWorker) {
  const api = win.navigator?.serviceWorker;
  if (!api || !win.location.pathname.startsWith("/SLiVR/")) return { state:"unavailable", dispose() {} };
  const scope = new URL("/SLiVR/", win.location.href).href;
  const forcedOff = new URLSearchParams(win.location.search).get("sw") === "off";
  if (!enabled || forcedOff) {
    const registrations = (await api.getRegistrations()).filter(reg => reg.scope === scope);
    await Promise.all(registrations.map(reg => {
      reg.active?.postMessage({ type:"SLIVR_DISABLE" });
      return reg.unregister();
    }));
    if (win.caches) await Promise.all((await win.caches.keys()).filter(key => key.startsWith("slivr-shell-")).map(key => win.caches.delete(key)));
    return { state:"disabled", dispose() {} };
  }
  if (win.document.readyState === "loading") await new Promise(resolve => win.addEventListener("load", resolve, { once:true }));
  const registration = await api.register("/SLiVR/sw.js", { scope:"/SLiVR/", updateViaCache:"none" });
  const update = () => { if (!win.document.hidden) registration.update().catch(() => {}); };
  win.document.addEventListener("visibilitychange", update);
  return { state:"enabled", dispose:() => win.document.removeEventListener("visibilitychange", update) };
}
