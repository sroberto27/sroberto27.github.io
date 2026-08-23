/* === LSU Death Valley Experience — local config override (TEMPLATE) ===
   Copy this file to config.local.js (same folder) and fill in a real
   API key to opt into Google Photorealistic 3D Tiles locally.
   config.local.js is gitignored — it is loaded by index.html right
   after config.js and, if present, is layered on top of it.

   Getting a key: see README.md's "Google Photorealistic 3D Tiles"
   section for the full Google Cloud Console setup checklist (enable
   billing + the Map Tiles API, restrict the key by HTTP referrer and
   to the Map Tiles API only, set a daily quota cap) before using a
   real key here.

   IMPORTANT: this file only keeps the key out of git history. Once
   this site is actually deployed with googleTilesEnabled:true, the
   key is still public static JS served to every visitor — the real
   protection is the key's HTTP-referrer restriction + quota cap in
   Google Cloud Console, not secrecy. Do not enable this in a shared
   or production deployment until those are confirmed set. */
window.CAMPUS_CONFIG = window.CAMPUS_CONFIG || {};
window.CAMPUS_CONFIG.map3d = window.CAMPUS_CONFIG.map3d || {};
Object.assign(window.CAMPUS_CONFIG.map3d, {
  googleTilesEnabled: true,
  googleApiKey: "YOUR_GOOGLE_MAPS_PLATFORM_API_KEY"
});
