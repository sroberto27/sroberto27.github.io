/* === Utils: XR detection, reprojection, lookup helpers ===
   Data loading strategy for the whole app:
     1. Fetch the .geojson / .json files (works over http/https).
     2. On failure (e.g. the page was opened from disk), fall back to
        window.SCSU_DATA populated by the data/*.js shim scripts.
   Either path yields the same in-memory data. */

const config = window.CAMPUS_CONFIG;

/* -----------------------------------------------------------
   XR / VR detection + Treedis profile selection
   -----------------------------------------------------------
   The campus ships two Treedis models (desktop and VR headset) with
   different sweep IDs, so the right profile must be chosen before the
   iframe src is set. Two signals are combined:
     1. Sync UA check at module load (catches Quest/Pico headsets even
        in "desktop mode" browsers).
     2. Async WebXR confirmation from boot() for ambiguous UAs.
   ----------------------------------------------------------- */

/* True for phones and tablets only — not desktops, not headsets.
   Drives the "touch-mode" body class (touch variant of the nav
   instructions). Classified by device type via UA, not raw touch
   capability, so touchscreen laptops still get desktop behavior. */
function isMobileOrTablet() {
  try {
    const ua = (navigator.userAgent || "").toString();

    // Never classify a headset as mobile/tablet.
    if (/OculusBrowser|Quest|Pico|Mobile VR| VR /i.test(ua)) return false;

    if (/Android|iPhone|iPod|iPad|Windows Phone|IEMobile|BlackBerry/i.test(ua)) {
      return true;
    }

    // iPadOS 13+ reports as "Macintosh"; detect it via touch support.
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
    return false;
  } catch (_) {
    return false;
  }
}

/* Sync UA-only headset check, evaluated at module load so the first
   profile resolution happens before the iframe src is set.
   OculusBrowser appears in every Meta Quest Browser UA; " VR " catches
   VR Safari; Pico catches Pico headsets. */
function isXRUserAgent() {
  try {
    const ua = (navigator.userAgent || "").toString();

    if (/OculusBrowser|Quest\s|Quest\)| VR |Mobile VR|Pico/i.test(ua)) {
      return true;
    }
  } catch (_) {}
  return false;
}

/* Async WebXR probe. Resolves true when the browser exposes an
   immersive-vr-capable device. Never rejects; cached per page load. */
let _xrAsyncPromise = null;
function detectXRAsync() {
  if (_xrAsyncPromise) return _xrAsyncPromise;
  _xrAsyncPromise = (async () => {
    try {
      if (!navigator.xr || typeof navigator.xr.isSessionSupported !== "function") {
        return false;
      }
      const ok = await navigator.xr.isSessionSupported("immersive-vr");
      return !!ok;
    } catch (_) {
      return false;
    }
  })();
  return _xrAsyncPromise;
}

/* Active profile name: "desktop" or "vr". Set by resolveTreedisProfile()
   and maybeUpgradeToVRProfile(); treat as read-only elsewhere. */
let activeTreedisProfile = "desktop";

/* Pick the initial profile from the sync UA check. Runs once at module
   load, before preloadTreedisIframe(). */
function resolveTreedisProfile() {
  const wantVR = isXRUserAgent();
  applyTreedisProfile(wantVR ? "vr" : "desktop");
}

/* Activate a profile: copy its modelId / tourUrl / homeSweepId to the
   top-level config.treedis aliases, repoint config.treedisMap to the
   matching per-location sweep map, and mirror the mode onto <body>
   (xr-mode / touch-mode classes) for CSS. */
function applyTreedisProfile(profileName) {
  if (profileName !== "desktop" && profileName !== "vr") {
    console.warn("[treedis] unknown profile, falling back to desktop:",
      profileName);
    profileName = "desktop";
  }
  activeTreedisProfile = profileName;

  try {
    document.body.classList.toggle("xr-mode", profileName === "vr");

    document.body.classList.toggle("touch-mode",
      profileName !== "vr" && isMobileOrTablet());
  } catch (_) {
    // <body> may not be parsed yet at module load; boot() re-applies.

  }

  const cfg = config.treedis || {};
  const profile = (cfg.profiles && cfg.profiles[profileName]) || null;
  if (!profile) {
    console.warn("[treedis] no profile config for:", profileName);
    return;
  }
  cfg.modelId     = profile.modelId;
  cfg.tourUrl     = profile.tourUrl;
  cfg.homeSweepId = profile.homeSweepId;

  const maps = config.treedisMaps || {};
  config.treedisMap = maps[profileName] || maps.desktop || {};

  console.info("[treedis] active profile:", profileName,
               "model:", cfg.modelId);
}

/* Plausibility gate for the async WebXR upgrade. Desktop Chrome reports
   immersive-vr support whenever an OpenXR runtime (SteamVR, WMR, Oculus
   desktop) is installed, even with no headset connected. Only allow the
   upgrade when the UA also looks like a standalone headset. Note the
   Quest 3 UA contains "X11; Linux x86_64", so the Linux test must be
   combined with an explicit absence of headset markers. */
function isPlausibleHeadsetUA() {
  try {
    const ua = (navigator.userAgent || "").toString();

    const looksDesktop =
      /Windows NT|Macintosh|Mac OS X(?!.*Mobile)/i.test(ua) ||
      (/X11/.test(ua) && !/Quest|OculusBrowser|Pico/i.test(ua));
    if (looksDesktop) return false;

    return /OculusBrowser|Quest|Pico|Mobile VR| VR /i.test(ua);
  } catch (_) {
    return false;
  }
}

/* Called from boot(). Upgrades to the VR profile when WebXR confirms a
   device and the UA plausibly belongs to a headset. Skipped if the
   iframe already loaded desktop content — reloading mid-session would
   clobber a tour the user may be inside. */
async function maybeUpgradeToVRProfile() {
  if (activeTreedisProfile === "vr") return;
  const isXR = await detectXRAsync();
  if (!isXR) return;
  if (!isPlausibleHeadsetUA()) {
    console.info(
      "[treedis] WebXR reports immersive-vr supported, but UA looks " +
      "like a desktop — staying on desktop profile. " +
      "(This is normal on a PC with SteamVR / WMR / Oculus desktop " +
      "installed.)");
    return;
  }
  if (TourBridge && TourBridge._iframe && TourBridge._iframe.src &&
      TourBridge._iframe.src !== "about:blank") {
    console.info(
      "[treedis] WebXR detected after iframe load — leaving desktop " +
      "profile active to avoid disrupting an in-flight tour");
    return;
  }
  console.info("[treedis] WebXR detected — upgrading to VR profile");
  applyTreedisProfile("vr");
}

/* Read-only accessor for the rest of the app. */
function isVRMode() {
  return activeTreedisProfile === "vr";
}

// Resolve the profile immediately so all later code sees a consistent
// treedisMap / tourUrl, then pre-warm the async WebXR probe so boot()
// awaits an already-resolved promise.
resolveTreedisProfile();

detectXRAsync();

/* -----------------------------------------------------------
   Reprojection (EPSG:3857 meters -> EPSG:4326 lat/lng)
   ----------------------------------------------------------- */
const EARTH_HALF_CIRC = 20037508.34;

function mercatorToLatLng(x, y) {
  const lng = (x / EARTH_HALF_CIRC) * 180;
  let lat = (y / EARTH_HALF_CIRC) * 180;
  lat = (180 / Math.PI) *
        (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function reprojectCoords(coords, crs) {
  if (crs !== "EPSG:3857") return coords;
  if (typeof coords[0] === "number") {
    return mercatorToLatLng(coords[0], coords[1]);
  }
  return coords.map((c) => reprojectCoords(c, crs));
}

function reprojectFC(fc, crs) {
  if (!fc || !Array.isArray(fc.features)) {
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      ...f,
      geometry: f.geometry
        ? { ...f.geometry,
            coordinates: reprojectCoords(f.geometry.coordinates, crs) }
        : null
    }))
  };
}

/* -----------------------------------------------------------
   Lookup helpers (keyed by lower-cased location name)
   ----------------------------------------------------------- */
function cleanName(name) {
  if (!name) return "";
  const cleaned = String(name).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase() === "none") return "";
  return cleaned;
}

function getCategory(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return config.categoryMap[k] || "CAMPUS";
}

function getDescription(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return config.descriptionMap[k] ||
         `${name} — more information about this location is coming soon.`;
}

function getHappensHere(name) {
  if (!name) return [];
  const k = name.toLowerCase();
  const list = (config.happensHereMap || {})[k];
  return Array.isArray(list) ? list : [];
}

/* Departments occupying a location. Always returns an array so callers
   can iterate without null checks; also used by search to match
   department names (e.g. "rotc", "engineering"). */
function getDepartments(name) {
  if (!name) return [];
  const k = name.toLowerCase();
  const list = (config.departmentMap || {})[k];
  return Array.isArray(list) ? list : [];
}

function getImage(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return (config.imageMap || {})[k] || "";
}

function getExplorable(name) {
  if (!name) return [];
  const k = name.toLowerCase();
  const list = (config.explorableMap || {})[k];
  return Array.isArray(list) ? list : [];
}

/* Street address for a location, or "" when none is configured. Used by
   the details panel to render "Open in Maps" links. */
function getAddress(name) {
  if (!name) return "";
  const k = name.toLowerCase();
  return (config.addressMap || {})[k] || "";
}

/* Look up a Treedis entry by location name (case-insensitive). Accepts
   shorthand string entries or full objects and always returns a
   normalized { sweepId, parentName, transitionTime, rotation } object,
   or null when unmapped. rotation is forwarded to navigateToSweep so
   the camera lands facing a configured direction. */
function getTreedisEntry(name) {
  if (!name) return null;
  const map = config.treedisMap || {};
  const raw = map[String(name).toLowerCase().trim()];
  if (raw == null) return null;
  if (typeof raw === "string") {
    return {
      sweepId: raw, parentName: null, transitionTime: null, rotation: null
    };
  }
  return {
    sweepId:        raw.sweepId || null,
    parentName:     raw.parentName || null,
    transitionTime: raw.transitionTime || null,
    rotation:       raw.rotation || null
  };
}

/* True when the location has a usable Treedis sweep. Controls whether
   the details panel shows the Explore CTA and VR controls; locations
   without a sweep get an info-only panel. */
function hasSweep(name) {
  const entry = getTreedisEntry(name);
  return !!(entry && entry.sweepId);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
