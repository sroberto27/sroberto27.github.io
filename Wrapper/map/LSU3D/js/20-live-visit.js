/* === LSU Death Valley Experience — Part 20: Live Visit Mode =========
   The in-hand view for someone who is actually on campus, walking.

   Everything else in this app is for looking at LSU. This is for
   being at LSU, which is a different problem: the user is outdoors,
   in a crowd, on a phone, half-watching where they're going. So the
   mode answers four questions and nothing else —

       where am I · where next · how far · when

   — in one bar at the top of the screen, and gets out of the way of
   the map.

   It is a VIEW, not a system. It owns no navigation, no tour state
   and no itinerary data: it reads Gameday (js/18-gameday.js), Geo
   (js/19-geolocation.js) and the existing tourStops/tourIndex, and
   it moves by calling goToStop() like everything else does.

   Entered with ?mode=live, or from the button this file adds to the
   guided-tour card. Leaving restores the normal app exactly.
   ================================================================ */

(function initLiveVisit() {
  "use strict";

  const cfg = (window.CAMPUS_CONFIG && window.CAMPUS_CONFIG.gameday) || {};
  if (cfg.enableLiveVisit === false) return;

  const $id = (id) => document.getElementById(id);

  let active = false;
  let barNode = null;
  let tickTimer = null;

  /* ============================================================
     The bar
     ============================================================ */

  function ensureBar() {
    if (barNode) return barNode;

    barNode = document.createElement("section");
    barNode.id = "liveVisitBar";
    barNode.className = "live-bar";
    barNode.setAttribute("aria-label", "Live visit");
    // polite, not assertive: this updates as someone walks, and a
    // screen reader interrupting every few metres would be unusable.
    barNode.setAttribute("aria-live", "polite");
    document.body.appendChild(barNode);
    return barNode;
  }

  /* One render pass. Cheap enough to run on every position update. */
  function render() {
    if (!active) return;
    const bar = ensureBar();

    const hasGameday = window.Gameday && Gameday.isActive();
    const total = typeof tourStops !== "undefined" ? tourStops.length : 0;
    const idx = (typeof tourIndex === "number" && tourIndex >= 0) ? tourIndex : 0;

    const current = hasGameday ? Gameday.stopSummary(idx) : basicStop(idx);
    const next    = idx + 1 < total ? (hasGameday ? Gameday.stopSummary(idx + 1) : basicStop(idx + 1)) : null;

    bar.innerHTML = [
      `<div class="live-bar-inner">`,
        hereHTML(),
        currentHTML(current),
        nextHTML(next),
        progressHTML(idx, total),
      `</div>`,
      actionsHTML(hasGameday)
    ].join("");

    wireActions();
  }

  function basicStop(i) {
    if (typeof tourStops === "undefined" || !tourStops[i]) return null;
    return {
      index: i,
      key: Router.keyForStopIndex(i),
      name: cleanName(tourStops[i].feature.properties.name),
      arrive: null,
      instruction: null
    };
  }

  /* "You are here" — the honest version. Three states: no fix yet,
     a vague fix, a good fix. Each says something different. */
  function hereHTML() {
    const geo = window.Geo ? Geo.getState() : null;

    if (!geo || (!geo.coords && !geo.denied)) {
      return `<div class="live-here is-waiting">
                <span class="live-here-label">LOCATING…</span>
                <span class="live-here-text">Finding you on campus</span>
              </div>`;
    }
    if (geo.denied) {
      return `<div class="live-here is-off">
                <span class="live-here-label">LOCATION OFF</span>
                <span class="live-here-text">Distances are unavailable</span>
              </div>`;
    }
    /* Previewing from home is the normal case for most of this app's
       life, so it gets a real state rather than a broken-looking one.
       Checked before accuracy: "you're in another state" is the more
       useful thing to say than "your signal is weak". */
    if (geo.onCampus === false) {
      return `<div class="live-here is-away">
                <span class="live-here-label">NOT ON CAMPUS</span>
                <span class="live-here-text">Previewing the route — distances appear when you arrive</span>
              </div>`;
    }

    if (geo.approximate) {
      return `<div class="live-here is-approx">
                <span class="live-here-label">APPROXIMATE</span>
                <span class="live-here-text">Signal is weak here</span>
              </div>`;
    }

    const near = Geo.nearestStop();
    const at = near && near.feet <= (cfg.arrivalRadiusFt || 150)
      ? cleanName(tourStops[near.index].feature.properties.name)
      : null;

    return `<div class="live-here is-fixed">
              <span class="live-here-label">YOU ARE HERE</span>
              <span class="live-here-text">${at ? escapeHTML(at) : "On campus"}</span>
            </div>`;
  }

  function currentHTML(stop) {
    if (!stop) return "";
    const time = stop.arrive && window.Gameday ? Gameday.formatClock(stop.arrive) : null;
    return `<div class="live-stop live-stop-current">
              <span class="live-stop-label">CURRENT STOP</span>
              <span class="live-stop-name">${escapeHTML(stop.name)}</span>
              ${time ? `<span class="live-stop-time">${escapeHTML(time)}</span>` : ""}
              ${stop.instruction ? `<span class="live-stop-note">${escapeHTML(stop.instruction)}</span>` : ""}
            </div>`;
  }

  /* The next destination, with direction and distance when we can
     honestly give them. */
  function nextHTML(stop) {
    if (!stop) {
      return `<div class="live-stop live-stop-next is-end">
                <span class="live-stop-label">NEXT</span>
                <span class="live-stop-name">That’s the last stop</span>
              </div>`;
    }

    const nav = window.Geo ? Geo.toStop(stop.index) : null;
    const time = stop.arrive && window.Gameday ? Gameday.formatClock(stop.arrive) : null;

    let dist = "";
    if (nav && nav.label) {
      // The arrow points at the stop in true bearing; the map is
      // north-up, so a plain rotation is correct.
      dist = `<span class="live-next-nav">
                <span class="live-next-arrow" style="transform: rotate(${Math.round(nav.bearing)}deg)"
                      aria-hidden="true">↑</span>
                <span class="live-next-dist">${escapeHTML(nav.label)}</span>
                <span class="live-next-walk">${nav.minutes} min ${escapeHTML(nav.compass || "")}</span>
              </span>`;
    }

    return `<div class="live-stop live-stop-next">
              <span class="live-stop-label">NEXT</span>
              <span class="live-stop-name">${escapeHTML(stop.name)}</span>
              ${time ? `<span class="live-stop-time">${escapeHTML(time)}</span>` : ""}
              ${dist}
            </div>`;
  }

  function progressHTML(idx, total) {
    if (!total) return "";
    const pct = Math.round(((idx + 1) / total) * 100);
    return `<div class="live-progress">
              <div class="live-progress-track" aria-hidden="true">
                <div class="live-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="live-progress-text">Stop ${idx + 1} of ${total}</span>
            </div>`;
  }

  function actionsHTML(hasGameday) {
    const contact = hasGameday && (Gameday.state.data.contacts || [])
      .find((c) => c && String(c.phone || "").trim());

    return `<div class="live-actions">
      <button class="live-btn" id="livePrev" type="button">Back</button>
      <button class="live-btn live-btn-primary" id="liveNext" type="button">Next stop</button>
      ${contact
        ? `<a class="live-btn live-btn-call" id="liveCall"
              href="tel:${encodeURIComponent(String(contact.phone).trim())}"
              data-role="${escapeHTML(contact.role || "Staff")}">Call staff</a>`
        : ""}
      <button class="live-btn live-btn-exit" id="liveExit" type="button">Full map</button>
    </div>`;
  }

  function wireActions() {
    const prev = $id("livePrev");
    const next = $id("liveNext");
    const exit = $id("liveExit");
    const call = $id("liveCall");

    if (prev) {
      prev.disabled = !(typeof tourIndex === "number" && tourIndex > 0);
      prev.onclick = () => tourPrevAction();
    }
    if (next) {
      const total = typeof tourStops !== "undefined" ? tourStops.length : 0;
      next.disabled = typeof tourIndex === "number" && tourIndex >= total - 1;
      next.onclick = () => tourNextAction();
    }
    if (exit) exit.onclick = () => exitMode({ reason: "user" });
    if (call) {
      call.onclick = () => Core.track("contact_clicked", {
        role: call.dataset.role,
        from: "live_visit"
      });
    }
  }

  /* ============================================================
     Entering and leaving
     ============================================================ */

  function enterMode({ source = "button" } = {}) {
    if (active) return;
    active = true;

    document.body.classList.add("mode-live");
    ensureBar();

    // Continuous position only while this mode is open — this is the
    // single place in the app that asks for a watch.
    if (window.Geo) {
      Geo.onChange(render);
      Geo.requestWatch({ source: "live_visit" });
      // Seed with a one-shot too: watchPosition can take a while to
      // produce its first fix and the bar shouldn't sit on "locating"
      // any longer than it has to.
      Geo.locate({ source: "live_visit", fly: false });
    }

    // Start the tour if nothing is selected — Live Visit with no
    // current stop has nothing to say.
    if (typeof tourIndex === "number" && tourIndex < 0 &&
        typeof tourStops !== "undefined" && tourStops.length) {
      goToStop(0);
    }

    render();

    // Times and countdowns drift; positions are pushed by Geo. A
    // 30s tick is enough for the clock and cheap on battery.
    tickTimer = setInterval(() => { if (!document.hidden) render(); }, 30000);

    Router.updateURL({ mode: "live" });
    Core.track("mode_entered", { mode: "live", source });
  }

  function exitMode({ reason = "user" } = {}) {
    if (!active) return;
    active = false;

    document.body.classList.remove("mode-live");
    if (barNode) { barNode.remove(); barNode = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }

    if (window.Geo) {
      Geo.offChange(render);
      Geo.releaseWatch();
    }

    Router.updateURL({ mode: null });
    Core.track("mode_exited", { mode: "live", reason });
  }

  /* ============================================================
     Entry point in the UI
     ------------------------------------------------------------
     One button, in the guided-tour card's action row, so it sits
     with the other tour controls rather than adding a new piece of
     map furniture.
     ============================================================ */

  function addEntryButton() {
    const actions = document.querySelector("#railTour .rail-tour-actions");
    if (!actions || $id("liveVisitStart")) return;

    const btn = document.createElement("button");
    btn.id = "liveVisitStart";
    btn.type = "button";
    btn.className = "pill-btn pill-btn-outline live-visit-start";
    btn.textContent = "I’m on campus";
    btn.title = "Switch to the walking view for your visit";
    btn.addEventListener("click", () => enterMode({ source: "rail_button" }));
    actions.appendChild(btn);
  }

  /* Keep the bar in step with tour navigation. */
  const _updateTourbar = updateTourbar;
  updateTourbar = function () {
    _updateTourbar();
    if (active) render();
  };

  /* Esc leaves the mode — matching how Esc already closes panels in
     js/10-event-wiring.js, so it behaves the way the rest of the app
     has taught the user to expect. */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) exitMode({ reason: "escape" });
  });

  Core.onReady(() => {
    addEntryButton();
    if (Router.getRoute().mode === "live") enterMode({ source: "deep_link" });
  });

  window.LiveVisit = {
    enter: enterMode,
    exit: exitMode,
    isActive: () => active,
    refresh: render
  };
})();
