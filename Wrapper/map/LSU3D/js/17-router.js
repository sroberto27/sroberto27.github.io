/* === LSU Death Valley Experience — Part 17: Router / deep links =====
   Turns the URL into an entry point. Before this file the URL never
   changed: no hash, no query, no history — so a QR code on a stadium
   gate could only ever open the app at the campus overview, and the
   Share button copied a link that said nothing about what you were
   looking at.

   The shape is query parameters, not hash routes and not clean paths:

       ?stop=lawton-room
       ?stop=tiger-walk-victory-hill&src=qr
       ?g=2026-09-05-alabama&stop=registration
       ?mode=kiosk&autoplay=1

   Query params need no server rewrites, which is the only thing that
   works on GitHub Pages at all, and they keep working unchanged on any
   other static host later.

   WHAT THIS FILE DOES NOT DO: it does not navigate. Every route it
   applies goes through the app's existing selectFeature() /
   goToStop() seam. There is exactly one navigation system in this app
   and the router is a caller of it, not a replacement for it.

   Load order: after js/14-redesign.js, because it wraps selectFeature
   and renderDetails — both of which 14 has already wrapped. Wrap,
   never replace: the previous implementation always runs first and
   unmodified.
   ================================================================ */

(function initRouter() {
  "use strict";

  /* Recognised parameters. Anything else in the query string is
     ignored and stripped — a stray utm_* or a mangled QR scan must
     never be able to change app behaviour. */
  const KNOWN_PARAMS = ["stop", "g", "n", "mode", "autoplay", "src", "debug"];

  const VALID_MODES = ["live", "kiosk"];
  const VALID_SOURCES = ["qr", "nfc", "email", "sms", "web"];

  /* Guards against feedback loops: while we are applying a route we
     must not write that same route back to the URL, and while we are
     writing the URL we must not treat it as a new navigation. */
  let applyingRoute = false;

  let currentRoute = emptyRoute();

  function emptyRoute() {
    return { stop: null, g: null, n: null, mode: null, autoplay: false, src: null };
  }

  /* ============================================================
     Stop keys
     ------------------------------------------------------------
     A deep link must survive a stop being renamed — a QR code
     printed on a stadium gate cannot be re-printed because
     someone retitled "Lawton Room" to "The Lawton Room". So the
     link carries a slug, not a name.

     data/tours.geojson gains an explicit `stop_key` property; until
     every feature has one, slugify(name) produces the same value,
     so this works identically before and after that data change.
     The rule is documented in docs/DATA-SCHEMA.md and the two
     implementations must not drift.
     ============================================================ */

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")                 // é → e, so accents don't vanish silently
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")       // · and punctuation all collapse
      .replace(/^-+|-+$/g, "");
  }

  function stopKeyForFeature(feature) {
    const props = (feature && feature.properties) || {};
    if (props.stop_key) return String(props.stop_key).toLowerCase();
    return slugify(props.name);
  }

  /* Index into tourStops, or -1. */
  function stopIndexForKey(key) {
    if (!key || typeof tourStops === "undefined") return -1;
    const wanted = String(key).toLowerCase();
    return tourStops.findIndex((s) => stopKeyForFeature(s.feature) === wanted);
  }

  function keyForStopIndex(i) {
    if (typeof tourStops === "undefined" || !tourStops[i]) return null;
    return stopKeyForFeature(tourStops[i].feature);
  }

  /* ============================================================
     Parsing
     ------------------------------------------------------------
     Every value is validated and clamped. A malformed parameter is
     dropped and the app boots normally — a bad link must degrade to
     "the app opened at the overview", never to a broken page.
     ============================================================ */

  function parseRoute(search) {
    const route = emptyRoute();
    let params;
    try {
      params = new URLSearchParams(search != null ? search : location.search);
    } catch (_) {
      return route;
    }

    const stop = params.get("stop");
    if (stop) route.stop = slugify(stop);      // tolerate "Lawton%20Room" too

    const g = params.get("g");
    // Itinerary ids are filenames; allow only what a filename may be
    // so this can never be used to reach for another path.
    if (g && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(g)) route.g = g.toLowerCase();

    route.n = sanitizeName(params.get("n"));

    const mode = (params.get("mode") || "").toLowerCase();
    if (VALID_MODES.includes(mode)) route.mode = mode;

    route.autoplay = params.get("autoplay") === "1";

    const src = (params.get("src") || "").toLowerCase();
    if (VALID_SOURCES.includes(src)) route.src = src;

    return route;
  }

  /* The recruit's first name, used once for a greeting.

     Deliberately strict: letters, spaces, apostrophes and hyphens
     only, 24 characters max. That covers real names (including
     O'Neal and Jean-Luc) and excludes anything that could be an
     injection vector or a joke someone screenshots. It is never
     stored, never sent to analytics, and it is stripped from the URL
     immediately after it is read — see applyInitialRoute(). */
  function sanitizeName(raw) {
    if (!raw) return null;
    const cleaned = String(raw)
      .replace(/[^\p{L} '’-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
    return cleaned || null;
  }

  /* ============================================================
     Writing the URL
     ------------------------------------------------------------
     replaceState for corrections (stripping a bad param, removing
     the name); pushState for an actual navigation, so browser
     back/forward step through the stops the user visited. Back and
     forward previously did nothing in this app at all.
     ============================================================ */

  function buildSearch(route) {
    const params = new URLSearchParams();
    // Fixed key order so the URL is stable and diffable, and so the
    // same view always produces the same shareable string.
    if (route.g)    params.set("g", route.g);
    if (route.stop) params.set("stop", route.stop);
    if (route.mode) params.set("mode", route.mode);
    if (route.autoplay && route.mode === "kiosk") params.set("autoplay", "1");
    if (route.src)  params.set("src", route.src);
    if (isDebug())  params.set("debug", "1");
    const s = params.toString();
    // Returns the query string alone (or ""), never a path — callers
    // decide what to prefix it with.
    return s ? "?" + s : "";
  }

  function isDebug() {
    try {
      return new URLSearchParams(location.search).get("debug") === "1";
    } catch (_) { return false; }
  }

  function writeURL(route, { push = false } = {}) {
    if (!window.history || !history.replaceState) return;
    // An empty query must still replace the current URL with a bare
    // path, otherwise the old parameters would linger.
    const url = buildSearch(route) || location.pathname;
    try {
      if (push) history.pushState({ route }, "", url);
      else      history.replaceState({ route }, "", url);
    } catch (_) {
      // Some sandboxed contexts refuse history writes. The app is
      // fully functional without a synced URL; only sharing degrades.
    }
  }

  /* Merge a patch into the current route and write it out. */
  function updateURL(patch, opts) {
    currentRoute = Object.assign({}, currentRoute, patch || {});
    writeURL(currentRoute, opts);
  }

  /* ============================================================
     Toast
     ------------------------------------------------------------
     For the "your link pointed at something that isn't here" case.
     Non-blocking on purpose: the rest of the app is fine and the
     user should be left looking at a working map, not an alert
     they have to dismiss before they can see anything.
     ============================================================ */

  let toastStack = null;

  function showToast(message, { timeout = 6000 } = {}) {
    if (!message) return;
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.className = "toast-stack";
      toastStack.setAttribute("role", "status");
      toastStack.setAttribute("aria-live", "polite");
      document.body.appendChild(toastStack);
    }

    const node = document.createElement("div");
    node.className = "toast";

    const text = document.createElement("span");
    text.className = "toast-text";
    text.textContent = message;           // textContent, never innerHTML

    const close = document.createElement("button");
    close.className = "toast-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";

    node.append(text, close);
    toastStack.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));

    let timer = null;
    const dismiss = () => {
      if (timer) clearTimeout(timer);
      node.classList.remove("is-visible");
      setTimeout(() => node.remove(), 220);
    };
    close.addEventListener("click", dismiss);
    if (timeout > 0) timer = setTimeout(dismiss, timeout);
  }

  /* ============================================================
     Applying a route
     ============================================================ */

  /* Select the stop a route points at. Returns true when it landed. */
  function applyStop(key, { push = false } = {}) {
    const idx = stopIndexForKey(key);
    if (idx < 0) return false;

    applyingRoute = true;
    try {
      goToStop(idx);           // the existing seam — not a new nav path
    } finally {
      applyingRoute = false;
    }
    currentRoute.stop = key;
    writeURL(currentRoute, { push });
    return true;
  }

  /* Runs once, from the onAppReady hook — by which point tourStops,
     the pins and the lists all exist. */
  function applyInitialRoute() {
    currentRoute = parseRoute();

    const raw = (function () {
      try { return new URLSearchParams(location.search); } catch (_) { return null; }
    })();

    // Report anything we ignored, so a mis-generated QR batch is
    // discoverable in the console rather than silently mysterious.
    if (raw) {
      const unknown = [];
      raw.forEach((_v, k) => { if (!KNOWN_PARAMS.includes(k)) unknown.push(k); });
      if (unknown.length) {
        console.info("[router] ignoring unrecognised parameters:", unknown.join(", "));
      }
    }

    const hadDeepLink = !!(currentRoute.stop || currentRoute.g ||
                           currentRoute.mode || currentRoute.src);

    if (hadDeepLink) {
      Core.track("deep_link_opened", {
        stopKey: currentRoute.stop || null,
        gamedayId: currentRoute.g || null,
        mode: currentRoute.mode || null,
        src: currentRoute.src || null,
        named: !!currentRoute.n        // whether a name was present, never the name
      });
    }

    // The name is read into memory for whoever wants to greet with
    // it, then removed from the URL so it doesn't live on in a
    // screenshot, a shared link, or browser history.
    if (currentRoute.n) {
      writeURL(currentRoute);   // buildSearch() never emits `n`
    }

    if (currentRoute.stop) {
      const landed = applyStop(currentRoute.stop);
      if (!landed) {
        console.info("[router] unknown stop in link:", currentRoute.stop);
        Core.track("error", { where: "router", reason: "unknown_stop", stopKey: currentRoute.stop });
        showToast("That stop isn’t part of this tour. Showing the full map instead.");
        currentRoute.stop = null;
        writeURL(currentRoute);
      }
    } else {
      // No stop in the link: normalise the URL (drops junk params)
      // without creating a history entry.
      writeURL(currentRoute);
    }
  }

  /* ============================================================
     Keeping the URL in step with the app
     ============================================================ */

  const _selectFeature = selectFeature;
  selectFeature = function (sel, kind, opts) {
    _selectFeature(sel, kind, opts);

    // Everything below is additive and must never be able to break a
    // selection — every navigation path in the app funnels through
    // this function.
    try {
      const key = stopKeyForFeature(sel && sel.feature);
      const isTourStop = stopIndexForKey(key) >= 0;

      // Only the URL write is suppressed while a route is being
      // applied — the selection still happened, so it is still worth
      // recording. Suppressing the event too would make every
      // QR-code arrival invisible in the analytics.
      if (!applyingRoute && isTourStop && key !== currentRoute.stop) {
        currentRoute.stop = key;
        writeURL(currentRoute, { push: true });
      }

      Core.track("stop_opened", {
        stopKey: key || null,
        kind: kind || null,
        isTourStop,
        mode: currentRoute.mode || null,
        gamedayId: currentRoute.g || null
      });
    } catch (err) {
      console.warn("[router] post-selection sync failed:", err);
    }
  };

  const _clearSelection = clearSelection;
  clearSelection = function () {
    _clearSelection();
    try {
      if (applyingRoute || !currentRoute.stop) return;
      currentRoute.stop = null;
      writeURL(currentRoute, { push: true });
    } catch (err) {
      console.warn("[router] clear-selection sync failed:", err);
    }
  };

  /* Back/forward. The app previously ignored these entirely. */
  window.addEventListener("popstate", () => {
    const next = parseRoute();
    const prevStop = currentRoute.stop;
    currentRoute = next;

    if (next.stop && next.stop !== prevStop) {
      const idx = stopIndexForKey(next.stop);
      if (idx >= 0) {
        applyingRoute = true;
        try { goToStop(idx); } finally { applyingRoute = false; }
      }
    } else if (!next.stop && prevStop) {
      applyingRoute = true;
      try { clearSelection(); } finally { applyingRoute = false; }
    }
  });

  /* ============================================================
     Share — now shares what you are actually looking at
     ------------------------------------------------------------
     js/14-redesign.js already wraps renderDetails and assigns
     shareBtn.onclick on every render. We wrap it once more (this
     file loads later) and reassign afterwards, rather than editing
     that file — same wrap-don't-replace discipline it uses itself.
     ============================================================ */

  function absoluteURLFor(route) {
    return location.origin + location.pathname + buildSearch(route);
  }

  const _renderDetails = renderDetails;
  renderDetails = function (feature, kind) {
    _renderDetails(feature, kind);

    try {
      const shareBtn = document.getElementById("shareBtn");
      if (!shareBtn) return;

      const name = cleanName((feature && feature.properties || {}).name);
      const key = stopKeyForFeature(feature);
      const shareRoute = Object.assign({}, currentRoute, {
        stop: stopIndexForKey(key) >= 0 ? key : currentRoute.stop,
        src: "web"
      });
      const url = absoluteURLFor(shareRoute);

      shareBtn.onclick = async () => {
        Core.track("share_clicked", { stopKey: key || null });
        const payload = { title: `${name} — The Death Valley Experience`, url };
        try {
          if (navigator.share) {
            await navigator.share(payload);
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            const prev = shareBtn.textContent;
            shareBtn.textContent = "Link copied ✓";
            setTimeout(() => { shareBtn.textContent = prev; }, 1400);
          }
        } catch (_) { /* user cancelled the share sheet — not an error */ }
      };
    } catch (err) {
      console.warn("[router] share wiring failed:", err);
    }
  };

  /* ============================================================
     Exports + boot
     ============================================================ */

  window.Router = {
    getRoute: () => Object.assign({}, currentRoute),
    updateURL,
    parseRoute,
    slugify,
    stopKeyForFeature,
    stopIndexForKey,
    keyForStopIndex,
    urlForStop: (key) => absoluteURLFor(Object.assign({}, currentRoute, { stop: key })),
    showToast
  };

  Core.onReady(applyInitialRoute);
})();
