/* === LSU Death Valley Experience — Part 15: Core services =========
   The shared, dependency-free spine every Phase 1 gameday feature
   builds on. Four small things, deliberately in one file because
   none of them is big enough to justify its own:

     • onReady()   — a "the app has finished booting" hook
     • track()     — a first-party analytics event bus with a
                     swappable sink (no-op by default)
     • store       — namespaced localStorage that never throws
     • geo math    — haversine distance, bearing, walking time

   This file touches no DOM, wraps no existing function, and reads
   no app state at load time. It is safe at any position in the
   load order; it sits at 15 because that slot was free and it
   needs to be defined before the feature modules at 17+.

   NOTE ON LOAD ORDER: js/11-boot.js calls boot() at parse time —
   before this script has executed. boot() is async, so this file
   runs during one of boot()'s awaits, and the onAppReady() call at
   the end of boot is guarded with `typeof onAppReady === "function"`
   exactly like the existing showStartScreen() call. Nothing here
   may assume boot has or hasn't started, and boot may never assume
   this file loaded.
   ================================================================ */

(function initCoreServices() {
  "use strict";

  /* ============================================================
     App-ready hook
     ------------------------------------------------------------
     js/11-boot.js fires window.onAppReady() once, after the app
     shell is revealed and the map, layers, pins and lists all
     exist. Feature modules register here instead of racing boot
     with their own setTimeout.

     Late registration is explicitly supported: a module that
     loads after boot has already fired still gets called, on the
     next microtask. That matters because the relative order of
     "boot finishes" and "script 21 parses" is not guaranteed.
     ============================================================ */

  let appReadyFired = false;
  const readyQueue = [];

  function onReady(fn) {
    if (typeof fn !== "function") return;
    if (appReadyFired) {
      // Already booted — run it, but asynchronously, so a caller
      // registering at parse time never re-enters synchronously.
      Promise.resolve().then(() => safely(fn, "onReady(late)"));
      return;
    }
    readyQueue.push(fn);
  }

  /* Called by js/11-boot.js. Idempotent — a second call is a no-op
     rather than a double-render of every feature panel. */
  window.onAppReady = function onAppReady() {
    if (appReadyFired) return;
    appReadyFired = true;

    track("app_ready", {
      deepLinked: location.search.length > 1,
      is3D: typeof is3DMode !== "undefined" ? !!is3DMode : false
    });

    // Drain rather than iterate, so the queue is empty afterwards.
    // A callback registering another callback is fine — the flag is
    // already set above, so the new one takes the late path and runs
    // on the next microtask rather than extending this loop.
    while (readyQueue.length) {
      safely(readyQueue.shift(), "onReady");
    }
  };

  /* Every registered callback runs behind this. One feature module
     throwing must never stop the others from initialising — the
     map is already usable by the time we get here, and a broken
     panel is a much better outcome than a broken app. */
  function safely(fn, label) {
    try {
      fn();
    } catch (err) {
      console.warn(`[core] ${label} callback failed:`, err);
      track("error", { where: label, message: String(err && err.message || err) });
    }
  }

  /* ============================================================
     Analytics bus
     ------------------------------------------------------------
     Phase 1 ships with a no-op sink: nothing leaves the device,
     no third-party script, no cookie, no cross-visit identifier,
     so there is nothing to put behind a consent banner. What ships
     is the *vocabulary* and the seam — every feature emits from
     day one, so whenever a real sink is wired up later it starts
     receiving events that are directly comparable to anything
     recorded from the first real gameday.

     `?debug=1` swaps in a console sink for development.
     ============================================================ */

  const EVENT_BUFFER_MAX = 200;
  const eventBuffer = [];
  let sink = null;

  /* Per-tab, per-session id. sessionStorage, NOT localStorage and
     NOT a cookie — it dies with the tab, so it can distinguish
     "two stops in one visit" from "two separate visits" without
     being an identifier that follows anyone between visits. */
  const sessionId = (function resolveSessionId() {
    const KEY = "lsu3d.sid";
    try {
      const existing = sessionStorage.getItem(KEY);
      if (existing) return existing;
      const fresh = "s_" + Math.random().toString(36).slice(2, 10) +
                    Date.now().toString(36).slice(-4);
      sessionStorage.setItem(KEY, fresh);
      return fresh;
    } catch (_) {
      // Private mode / storage disabled. An in-memory id still
      // groups this page view's events together, which is all it
      // is for.
      return "s_ephemeral";
    }
  })();

  /* Dimensions worth attaching to every event so a future dashboard
     can segment without each call site remembering to pass them.
     Read lazily — is3DMode and isMobile() belong to other files and
     may not exist yet when an early event fires. */
  function ambientProps() {
    const out = { sessionId };
    try {
      if (typeof isMobile === "function") out.device = isMobile() ? "mobile" : "desktop";
      if (typeof is3DMode !== "undefined")  out.is3D = !!is3DMode;
      // Explore vs Learn — read off the body class js/13-learn-mode.js
      // sets, rather than a global, because that class is the actual
      // source of truth for which shell is visible.
      out.appMode = document.body.classList.contains("mode-learn") ? "learn" : "explore";
    } catch (_) { /* never let instrumentation break a feature */ }
    return out;
  }

  /* Fire-and-forget. Never throws, never blocks, never does network
     I/O in Phase 1. Safe to call from inside a click handler. */
  function track(event, props) {
    if (!event) return;
    let record;
    try {
      record = {
        event: String(event),
        ts: Date.now(),
        props: Object.assign(ambientProps(), props || {})
      };
    } catch (_) {
      return;
    }

    // Keep a bounded tail so a sink attached mid-session (or a
    // developer opening the console) can see what already happened.
    eventBuffer.push(record);
    if (eventBuffer.length > EVENT_BUFFER_MAX) eventBuffer.shift();

    if (sink) {
      try {
        sink(record);
      } catch (err) {
        console.warn("[analytics] sink threw; detaching it:", err);
        sink = null; // a broken sink must not keep costing every event
      }
    }
  }

  /* Replace the sink. Passing null returns to the no-op state.
     The buffered tail is replayed into a newly attached sink so
     events emitted during boot aren't lost. */
  function setAnalyticsSink(fn) {
    sink = typeof fn === "function" ? fn : null;
    if (!sink) return;
    for (const record of eventBuffer.slice()) {
      try { sink(record); } catch (_) { /* replay is best-effort */ }
    }
  }

  /* Development sink, opt-in via ?debug=1. */
  try {
    if (new URLSearchParams(location.search).get("debug") === "1") {
      setAnalyticsSink((e) => console.info("[analytics]", e.event, e.props));
    }
  } catch (_) { /* URLSearchParams is universally supported; belt and braces */ }

  /* ============================================================
     Namespaced storage
     ------------------------------------------------------------
     localStorage throws outright in some private-browsing and
     sandboxed-iframe contexts — js/12-start-screen.js already
     wraps every access in try/catch for exactly this reason. This
     is that same discipline, factored out, so no feature module
     invents a second (and probably less careful) helper.

     Values are JSON. A read that fails for any reason — missing,
     unparseable, storage unavailable — returns the caller's
     fallback rather than throwing or returning undefined.
     ============================================================ */

  const STORE_PREFIX = "lsu3d.";

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(STORE_PREFIX + key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
        return true;
      } catch (_) {
        // Quota exceeded or storage disabled. Callers treat storage
        // as a convenience, never as the source of truth.
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(STORE_PREFIX + key);
        return true;
      } catch (_) {
        return false;
      }
    },

    /* True when storage actually works. Lets a feature tell the
       user "your progress won't be saved" instead of silently
       losing it. */
    available() {
      try {
        const probe = STORE_PREFIX + "__probe";
        localStorage.setItem(probe, "1");
        localStorage.removeItem(probe);
        return true;
      } catch (_) {
        return false;
      }
    }
  };

  /* ============================================================
     Geo math
     ------------------------------------------------------------
     Straight-line only. The campus footprint is ~1.5 km across and
     the gameday route is mostly open plaza and sidewalk, so a
     crow-flies distance plus a direction arrow is honest enough to
     navigate by and costs nothing. Real turn-by-turn walking routes
     would mean a routing API — a dependency, a key, and a per-request
     bill — which is not justified at this scale.

     All coordinates are [lng, lat] (MapLibre order), matching every
     other coordinate in this app. Getting this backwards is the
     classic bug here; see config.js's note on Leaflet's [lat, lng].
     ============================================================ */

  const EARTH_RADIUS_FT = 20902231; // mean Earth radius in feet
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  /* Great-circle distance in feet between two [lng, lat] points. */
  function haversineFt(a, b) {
    if (!a || !b) return null;
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const dLat = lat2 - lat1;
    const dLng = toRad(b[0] - a[0]);

    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_FT * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* Initial bearing from `a` to `b`, in degrees clockwise from true
     north (0–360). Feeds the Live Visit direction arrow.

     True north, not magnetic — the map is north-up and the arrow is
     drawn relative to the map, so declination doesn't enter into it. */
  function bearingDeg(a, b) {
    if (!a || !b) return null;
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const dLng = toRad(b[0] - a[0]);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /* Nearest 8-point compass label for a bearing — "northeast" reads
     better than "47°" in a sentence a recruit's family is following
     on foot. */
  const COMPASS = ["north", "northeast", "east", "southeast",
                   "south", "southwest", "west", "northwest"];

  function compassPoint(deg) {
    if (deg == null || !isFinite(deg)) return null;
    return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  }

  /* Walking time in whole minutes, always at least 1.

     4.4 ft/s (~3 mph) is the standard unimpeded adult pace. Gameday
     is not unimpeded — crowds, crossings, and a group moving
     together — so 3.3 ft/s (~2.25 mph) is the working figure. It is
     deliberately pessimistic: telling a family a walk takes longer
     than it does is a much smaller failure than making them late. */
  const WALK_FT_PER_SEC = 3.3;

  function walkMinutes(feet) {
    if (feet == null || !isFinite(feet) || feet < 0) return null;
    return Math.max(1, Math.round(feet / WALK_FT_PER_SEC / 60));
  }

  /* Distance formatted the way people say it on foot: feet up to a
     quarter mile, then miles to one decimal. */
  function formatDistance(feet) {
    if (feet == null || !isFinite(feet)) return null;
    if (feet < 1320) return `${Math.round(feet / 10) * 10} ft`;
    return `${(feet / 5280).toFixed(1)} mi`;
  }

  /* ============================================================
     Exports
     ------------------------------------------------------------
     One namespace object, plus `track` as a bare global because it
     is called from a dozen places and `Core.track(...)` at every
     call site would be noise. Matches how the app already exposes
     window.setAppMode / window.__captureView.
     ============================================================ */

  window.Core = {
    onReady,
    track,
    setAnalyticsSink,
    store,
    haversineFt,
    bearingDeg,
    compassPoint,
    walkMinutes,
    formatDistance,
    sessionId,
    /* Dev helper: dump the buffered event tail from the console. */
    __events: () => eventBuffer.slice()
  };

  window.track = track;
})();
