/* === LSU Death Valley Experience — Part 21: Kiosk mode ==============
   Unattended full-screen presentation for a display in a recruiting
   office or the Lawton Room.

   Entered with ?mode=kiosk (add &autoplay=1 to start advancing
   immediately). Reuses the tour it already has: auto-advance is a
   timer calling goToStop(). There is no second slideshow engine, no
   duplicate stop list, and no separate content.

   Behaviour that matters for something left running all day:

   • A manual touch pauses the loop rather than fighting it. After
     `idleMs` of nobody touching anything, the display resets to
     stop 1 and resumes. Someone can walk up, take over, walk away,
     and the display fixes itself.

   • FULLSCREEN NEEDS A GESTURE. Browsers refuse requestFullscreen()
     that isn't inside a user interaction, so a kiosk URL cannot go
     fullscreen on load. The first tap does it, and until then a
     small prompt says so — better than silently not working.

   • THE EXIT IS DELIBERATE BUT NOT SECRET. Esc, or three taps in the
     top-left corner. Kiosk mode grants no capability a normal
     visitor lacks, so this is a convenience, not a lock — and it
     must never become one, because there is nothing behind it worth
     locking.

   • EVERY TIMER IS CLEARED on exit and on pagehide. A display left
     on for a week must not accumulate intervals.
   ================================================================ */

(function initKiosk() {
  "use strict";

  const cfg  = (window.CAMPUS_CONFIG && window.CAMPUS_CONFIG.gameday) || {};
  const kcfg = cfg.kiosk || {};
  if (cfg.enableKiosk === false) return;

  const DWELL_MS = Number(kcfg.dwellMs) > 0 ? Number(kcfg.dwellMs) : 12000;
  const IDLE_MS  = Number(kcfg.idleMs)  > 0 ? Number(kcfg.idleMs)  : 90000;
  const LOOP     = kcfg.loop !== false;

  const $id = (id) => document.getElementById(id);

  let active = false;
  let playing = false;
  let advanceTimer = null;
  let idleTimer = null;
  let cornerTaps = 0;
  let cornerResetTimer = null;
  let chromeNode = null;
  let cycles = 0;

  /* ============================================================
     Auto-advance
     ============================================================ */

  function scheduleAdvance() {
    clearAdvance();
    if (!playing || !active) return;
    advanceTimer = setTimeout(advance, DWELL_MS);
  }

  function clearAdvance() {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
  }

  function advance() {
    if (!active || typeof tourStops === "undefined" || !tourStops.length) return;

    const last = tourStops.length - 1;
    const next = (typeof tourIndex === "number" ? tourIndex : -1) + 1;

    if (next > last) {
      if (!LOOP) { pause({ reason: "end" }); return; }
      cycles++;
      Core.track("kiosk_cycle", { cycles });
      goToStop(0);
    } else {
      goToStop(next);
    }
    scheduleAdvance();
  }

  function play({ source = "auto" } = {}) {
    if (!active) return;
    playing = true;
    if (typeof tourIndex === "number" && tourIndex < 0 &&
        typeof tourStops !== "undefined" && tourStops.length) {
      goToStop(0);
    }
    scheduleAdvance();
    renderChrome();
    Core.track("mode_entered", { mode: "kiosk_play", source });
  }

  function pause({ reason = "manual" } = {}) {
    playing = false;
    clearAdvance();
    renderChrome();
    if (reason !== "end") Core.track("mode_exited", { mode: "kiosk_play", reason });
  }

  /* ============================================================
     Idle reset
     ------------------------------------------------------------
     Any real interaction restarts the clock. When it runs out the
     display goes back to the top and resumes on its own — the
     property that makes it genuinely unattended.
     ============================================================ */

  function noteInteraction() {
    if (!active) return;

    // A touch takes over: stop advancing under the visitor's hands.
    if (playing) pause({ reason: "interaction" });

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!active) return;
      goToStop(0);
      play({ source: "idle_reset" });
      Core.track("kiosk_cycle", { cycles, reason: "idle_reset" });
    }, IDLE_MS);
  }

  /* ============================================================
     Chrome — a minimal overlay: stop counter, prev/next, play/pause
     ============================================================ */

  function ensureChrome() {
    if (chromeNode) return chromeNode;
    chromeNode = document.createElement("div");
    chromeNode.id = "kioskChrome";
    chromeNode.className = "kiosk-chrome";
    document.body.appendChild(chromeNode);

    // Triple-tap the top-left corner to leave. A separate element so
    // it can't be hit by accident while someone browses.
    const corner = document.createElement("button");
    corner.id = "kioskCorner";
    corner.className = "kiosk-corner";
    corner.type = "button";
    corner.setAttribute("aria-label", "Exit kiosk mode (tap three times)");
    corner.addEventListener("click", onCornerTap);
    document.body.appendChild(corner);

    return chromeNode;
  }

  function renderChrome() {
    if (!active) return;
    const node = ensureChrome();

    const total = typeof tourStops !== "undefined" ? tourStops.length : 0;
    const idx = (typeof tourIndex === "number" && tourIndex >= 0) ? tourIndex : 0;
    const name = total ? cleanName(tourStops[idx].feature.properties.name) : "";

    node.innerHTML = `
      <div class="kiosk-title">${escapeHTML(name)}</div>
      <div class="kiosk-counter">Stop ${idx + 1} of ${total}</div>
      <div class="kiosk-dots" aria-hidden="true">${
        Array.from({ length: total }, (_, i) =>
          `<span class="kiosk-dot${i === idx ? " is-current" : ""}"></span>`).join("")
      }</div>
      <div class="kiosk-controls">
        <button class="kiosk-btn" id="kioskPrev" type="button" aria-label="Previous stop">‹</button>
        <button class="kiosk-btn kiosk-btn-play" id="kioskPlay" type="button"
                aria-label="${playing ? "Pause" : "Play"}">${playing ? "❚❚" : "▶"}</button>
        <button class="kiosk-btn" id="kioskNext" type="button" aria-label="Next stop">›</button>
      </div>
      ${needsFullscreenPrompt()
        ? '<div class="kiosk-fs-hint">Tap anywhere to go full screen</div>'
        : ""}
    `;

    const prev = $id("kioskPrev");
    const next = $id("kioskNext");
    const playBtn = $id("kioskPlay");
    if (prev) prev.onclick = () => { tourPrevAction(); };
    if (next) next.onclick = () => { tourNextAction(); };
    if (playBtn) playBtn.onclick = () => {
      if (playing) pause({ reason: "manual" });
      else play({ source: "manual" });
    };
  }

  function needsFullscreenPrompt() {
    return active && !document.fullscreenElement &&
           typeof document.documentElement.requestFullscreen === "function";
  }

  /* Fullscreen can only be requested from inside a user gesture, so
     this is called from the first real interaction, not from enter(). */
  function tryFullscreen() {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    if (typeof el.requestFullscreen !== "function") return;
    el.requestFullscreen().then(renderChrome).catch(() => {
      // Refused (iOS Safari has no element fullscreen on iPhone).
      // The mode still works; it just shares the screen with the
      // browser's own chrome.
    });
  }

  /* ============================================================
     Exit
     ============================================================ */

  function onCornerTap() {
    cornerTaps++;
    if (cornerResetTimer) clearTimeout(cornerResetTimer);
    cornerResetTimer = setTimeout(() => { cornerTaps = 0; }, 1200);
    if (cornerTaps >= 3) exit({ reason: "corner_taps" });
  }

  function exit({ reason = "user" } = {}) {
    if (!active) return;
    active = false;
    playing = false;

    clearAdvance();
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (cornerResetTimer) { clearTimeout(cornerResetTimer); cornerResetTimer = null; }

    document.body.classList.remove("mode-kiosk");
    if (chromeNode) { chromeNode.remove(); chromeNode = null; }
    const corner = $id("kioskCorner");
    if (corner) corner.remove();

    document.removeEventListener("pointerdown", onAnyInteraction, true);
    document.removeEventListener("keydown", onAnyInteraction, true);

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { /* nothing to undo */ });
    }

    Router.updateURL({ mode: null, autoplay: false });
    Core.track("mode_exited", { mode: "kiosk", reason, cycles });
  }

  /* ============================================================
     Enter
     ============================================================ */

  function onAnyInteraction(e) {
    // The corner button handles its own taps; don't let them also
    // count as "a visitor is browsing".
    if (e.target && e.target.id === "kioskCorner") return;

    if (e.type === "pointerdown") tryFullscreen();
    noteInteraction();
  }

  function enter({ autoplay = false, source = "deep_link" } = {}) {
    if (active) return;
    active = true;

    document.body.classList.add("mode-kiosk");
    ensureChrome();
    renderChrome();

    // Capture phase: we want to see the interaction regardless of
    // what else handles it, without interfering with any of it.
    document.addEventListener("pointerdown", onAnyInteraction, true);
    document.addEventListener("keydown", onAnyInteraction, true);

    Core.track("mode_entered", { mode: "kiosk", source, autoplay, dwellMs: DWELL_MS });

    if (autoplay) play({ source: "autoplay_param" });
    else noteInteraction();   // start the idle clock even when paused
  }

  /* Keep the overlay in step with tour navigation, whatever moved it. */
  const _updateTourbar = updateTourbar;
  updateTourbar = function () {
    _updateTourbar();
    if (active) renderChrome();
  };

  document.addEventListener("keydown", (e) => {
    if (!active) return;
    if (e.key === "Escape") exit({ reason: "escape" });
    // Space is the universal "pause the thing on screen".
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (playing) pause({ reason: "spacebar" });
      else play({ source: "spacebar" });
    }
  });

  /* A display that is power-cycled or a tab that is closed must not
     leave a timer behind. */
  window.addEventListener("pagehide", () => {
    clearAdvance();
    if (idleTimer) clearTimeout(idleTimer);
  });

  Core.onReady(() => {
    const route = Router.getRoute();
    if (route.mode !== "kiosk") return;
    enter({ autoplay: route.autoplay, source: "deep_link" });
  });

  window.Kiosk = {
    enter,
    exit,
    play,
    pause,
    isActive: () => active,
    isPlaying: () => playing
  };
})();
