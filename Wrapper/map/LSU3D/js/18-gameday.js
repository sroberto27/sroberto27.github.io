/* === LSU Death Valley Experience — Part 18: My Gameday ==============
   A personalised itinerary layered onto the existing 10-stop tour.

   What it is NOT: a second list of stops. The tour order still comes
   from data/tours.geojson and navigation still goes through
   goToStop() / selectFeature(). A gameday file only adds, per stop,
   an arrival time and an instruction — plus a kickoff time, staff
   contacts, and a note for the visit as a whole.

   It is inert unless a link carries ?g=<id>. A visitor without one
   never fetches an itinerary and sees exactly the app that shipped
   before this file existed.

   The rail's guided-tour card (#railTour, built by js/08-tourbar.js)
   is the surface. We decorate it rather than building a parallel
   panel, because it is already "Stop X of Y + progress + checklist" —
   which is most of a gameday view before we add a single line.

   Load order: after js/17-router.js (needs the parsed route) and
   therefore after js/08-tourbar.js and js/14-redesign.js, both of
   whose updateTourbar we wrap.
   ================================================================ */

(function initGameday() {
  "use strict";

  const cfg = (window.CAMPUS_CONFIG && window.CAMPUS_CONFIG.gameday) || {};
  if (cfg.enableMyGameday === false) return;

  /* ============================================================
     State
     ------------------------------------------------------------
     One store. Live Visit Mode reads this rather than keeping its
     own copy — there is one answer to "which stop are we on and
     what time is it due", and this is it.
     ============================================================ */

  const state = {
    id: null,
    data: null,             // the raw gameday document
    name: null,             // recruit first name, in memory only
    byStopKey: new Map(),   // stopKey → { arrive, depart, instruction }
    visited: new Set(),     // stopKeys marked done, persisted
    loaded: false
  };

  function progressKey() { return `gameday.progress.${state.id}`; }

  function loadProgress() {
    const saved = Core.store.get(progressKey(), null);
    if (saved && Array.isArray(saved.visited)) {
      state.visited = new Set(saved.visited);
    }
  }

  function saveProgress() {
    Core.store.set(progressKey(), {
      gamedayId: state.id,
      visited: [...state.visited],
      lastSavedAt: new Date().toISOString()
    });
  }

  /* ============================================================
     Time handling
     ------------------------------------------------------------
     `arrive` / `depart` are wall-clock strings in the gameday's own
     timezone. A phone in another zone — a recruit flying in from
     California — must still see "3:15 PM" meaning 3:15 PM in Baton
     Rouge, so we never build a Date from them for display. They are
     formatted as text.

     Only `kickoff` becomes a real Date, and only because a countdown
     is genuinely a duration. It carries an explicit UTC offset (the
     validator enforces that), so it is unambiguous.
     ============================================================ */

  /* "14:15" → "2:15 PM". Pure string work — no Date, no timezone. */
  function formatClock(hhmm) {
    if (!hhmm) return null;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
    if (!m) return null;
    let h = Number(m[1]);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m[2]} ${suffix}`;
  }

  function kickoffDate() {
    if (!state.data || !state.data.kickoff) return null;
    const d = new Date(state.data.kickoff);
    return isNaN(d.getTime()) ? null : d;
  }

  /* "in 2 hr 15 min" / "in 20 min" / "kickoff is under way". */
  function kickoffCountdown() {
    const d = kickoffDate();
    if (!d) return null;
    const ms = d.getTime() - Date.now();
    if (ms <= 0) return "Kickoff has passed";
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `Kickoff in ${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem
      ? `Kickoff in ${hrs} hr ${rem} min`
      : `Kickoff in ${hrs} hr`;
  }

  /* ============================================================
     Loading
     ============================================================ */

  async function load(id, name) {
    if (!id) return false;
    state.id = String(id).toLowerCase();
    state.name = name || null;

    let payload = null;
    try {
      payload = await loadGamedayJSON(state.id);
    } catch (err) {
      console.warn("[gameday] fetch failed:", err);
    }

    if (!payload) {
      Core.track("error", { where: "gameday", reason: "not_found", gamedayId: state.id });
      Router.showToast("We couldn’t find that gameday itinerary. Showing the standard tour.");
      state.id = null;
      return false;
    }

    state.data = payload;
    state.byStopKey.clear();

    let matched = 0;
    for (const s of payload.stops || []) {
      if (!s || !s.stopKey) continue;
      // A stop the tour doesn't have is skipped, not fatal — the
      // itinerary may have been written against a newer stop list.
      if (Router.stopIndexForKey(s.stopKey) < 0) {
        console.warn(`[gameday] itinerary stop "${s.stopKey}" is not on this tour — skipping`);
        continue;
      }
      state.byStopKey.set(String(s.stopKey).toLowerCase(), {
        arrive: s.arrive || null,
        depart: s.depart || null,
        instruction: s.instruction || null
      });
      matched++;
    }

    loadProgress();
    state.loaded = true;

    document.body.classList.add("has-gameday");

    Core.track("gameday_loaded", {
      gamedayId: state.id,
      stopsInFile: (payload.stops || []).length,
      stopsMatched: matched,
      hasKickoff: !!payload.kickoff,
      contacts: (payload.contacts || []).length,
      storageAvailable: Core.store.available()
    });

    if (!matched) {
      Router.showToast("That itinerary doesn’t match any stops on this tour.");
    }
    return true;
  }

  /* ============================================================
     Rendering — decorate the existing rail tour card
     ============================================================ */

  const $id = (id) => document.getElementById(id);

  /* The header block: greeting, opponent, countdown, and the
     "now / next" summary. Created once, then updated in place. */
  function ensureHeader() {
    let head = $id("gamedayHead");
    if (head) return head;

    const card = document.querySelector("#railTour .rail-tour-card");
    if (!card) return null;

    head = document.createElement("div");
    head.id = "gamedayHead";
    head.className = "gameday-head";
    // Above the "Stop X of Y" title, so the visit context reads first.
    card.insertBefore(head, card.firstChild);
    return head;
  }

  function renderHeader() {
    const head = ensureHeader();
    if (!head || !state.loaded) return;

    const d = state.data || {};
    const parts = [];

    const greeting = state.name
      ? `${state.name}, here’s your gameday`
      : "Your gameday";
    parts.push(`<div class="gameday-greeting">${escapeHTML(greeting)}</div>`);

    const sub = [];
    if (d.opponent && d.opponent !== "TBD") sub.push(`vs ${escapeHTML(d.opponent)}`);
    const countdown = kickoffCountdown();
    if (countdown) sub.push(escapeHTML(countdown));
    if (sub.length) {
      parts.push(`<div class="gameday-sub">${sub.join(" · ")}</div>`);
    }

    // Now / Next — the two things someone mid-visit actually needs.
    const now  = currentStop();
    const next = nextStop();
    if (now || next) {
      parts.push('<div class="gameday-nownext">');
      if (now) {
        parts.push(rowHTML("NOW", now.name, now.arrive));
      }
      if (next) {
        parts.push(rowHTML("NEXT", next.name, next.arrive));
      }
      parts.push("</div>");
    }

    if (d.notes) {
      parts.push(`<div class="gameday-note">${escapeHTML(d.notes)}</div>`);
    }

    head.innerHTML = parts.join("");
  }

  function rowHTML(label, name, arrive) {
    const time = formatClock(arrive);
    return `<div class="gameday-row">
      <span class="gameday-row-label">${label}</span>
      <span class="gameday-row-name">${escapeHTML(name)}</span>
      ${time ? `<span class="gameday-row-time">${escapeHTML(time)}</span>` : ""}
    </div>`;
  }

  /* Add the scheduled time to each row of the existing checklist.
     js/08-tourbar.js rebuilds that <ol> on every updateTourbar(), so
     this runs after it, every time, rather than once. */
  function decorateChecklist() {
    const list = $id("railTourStops");
    if (!list || !state.loaded) return;

    list.querySelectorAll(".rail-tour-stop").forEach((li) => {
      const i = Number(li.dataset.stopIndex);
      const key = Router.keyForStopIndex(i);
      const entry = key && state.byStopKey.get(key);
      if (!entry || !entry.arrive) return;

      const time = document.createElement("span");
      time.className = "gameday-stop-time";
      time.textContent = formatClock(entry.arrive) || "";
      li.appendChild(time);
    });
  }

  /* Staff contacts, at the foot of the tour card. Tel links only —
     these are published department lines, never a personal number
     (see docs/DATA-SCHEMA.md §Privacy and the validator). */
  function renderContacts() {
    const section = $id("railTour");
    if (!section || !state.loaded) return;

    let block = $id("gamedayContacts");
    const contacts = (state.data && state.data.contacts) || [];
    if (!contacts.length) { if (block) block.remove(); return; }

    if (!block) {
      block = document.createElement("div");
      block.id = "gamedayContacts";
      block.className = "gameday-contacts";
      section.appendChild(block);
    }

    block.innerHTML =
      '<div class="gameday-contacts-kicker">WHO TO CALL</div>' +
      contacts.map((c) => {
        const role = escapeHTML(c.role || "Staff");
        const note = c.note ? `<span class="gameday-contact-note">${escapeHTML(c.note)}</span>` : "";
        const phone = String(c.phone || "").trim();
        const action = phone
          ? `<a class="gameday-contact-call" href="tel:${encodeURIComponent(phone)}"
                data-role="${role}">${escapeHTML(phone)}</a>`
          : '<span class="gameday-contact-tbd">Number to be confirmed</span>';
        return `<div class="gameday-contact">
                  <span class="gameday-contact-role">${role}</span>
                  ${action}${note}
                </div>`;
      }).join("");

    block.querySelectorAll(".gameday-contact-call").forEach((a) => {
      a.addEventListener("click", () => {
        // The role, never the number — a phone number in an analytics
        // payload is exactly the kind of data we said we wouldn't keep.
        Core.track("contact_clicked", { role: a.dataset.role, gamedayId: state.id });
      });
    });
  }

  function render() {
    if (!state.loaded) return;
    try {
      renderHeader();
      decorateChecklist();
      renderContacts();
    } catch (err) {
      console.warn("[gameday] render failed:", err);
    }
  }

  /* ============================================================
     Queries — the shared model Live Visit Mode reads
     ============================================================ */

  function entryFor(key) {
    return key ? state.byStopKey.get(String(key).toLowerCase()) || null : null;
  }

  function stopSummary(i) {
    if (typeof tourStops === "undefined" || !tourStops[i]) return null;
    const key = Router.keyForStopIndex(i);
    const entry = entryFor(key) || {};
    return {
      index: i,
      key,
      name: cleanName(tourStops[i].feature.properties.name),
      arrive: entry.arrive || null,
      depart: entry.depart || null,
      instruction: entry.instruction || null,
      visited: state.visited.has(key)
    };
  }

  /* The stop the app is currently on. Falls back to the first stop
     so a gameday opened before anyone taps anything still says
     something useful. */
  function currentStop() {
    const i = (typeof tourIndex === "number" && tourIndex >= 0) ? tourIndex : 0;
    return stopSummary(i);
  }

  function nextStop() {
    const i = (typeof tourIndex === "number" && tourIndex >= 0) ? tourIndex + 1 : 1;
    if (typeof tourStops === "undefined" || i >= tourStops.length) return null;
    return stopSummary(i);
  }

  function progress() {
    const total = typeof tourStops !== "undefined" ? tourStops.length : 0;
    return {
      total,
      visited: state.visited.size,
      index: typeof tourIndex === "number" ? tourIndex : -1
    };
  }

  /* Mark a stop done. Called when it is selected — the honest
     signal available without GPS; Live Visit Mode tightens this to
     "you were actually near it". */
  function markVisited(key) {
    if (!key || !state.loaded || state.visited.has(key)) return;
    state.visited.add(key);
    saveProgress();

    if (state.visited.size === (typeof tourStops !== "undefined" ? tourStops.length : -1)) {
      Core.track("tour_completed", { gamedayId: state.id });
    }
  }

  /* ============================================================
     Hooks into the existing app
     ============================================================ */

  const _updateTourbar = updateTourbar;
  updateTourbar = function () {
    _updateTourbar();
    render();
  };

  /* Per-stop instruction in the details panel — the one place a
     mobile user reliably looks, since the rail tour card is
     desktop-only (see js/14-redesign.js: startTourBtn). */
  const _renderDetails = renderDetails;
  renderDetails = function (feature, kind) {
    _renderDetails(feature, kind);
    try {
      const body = $id("detailsBody");
      if (!body || !state.loaded) return;

      // renderDetails runs on every selection, so clear the previous
      // note before adding this stop's — otherwise they stack up.
      document.querySelectorAll(".gameday-detail-note").forEach((n) => n.remove());

      const key = Router.stopKeyForFeature(feature);
      const entry = entryFor(key);
      if (!entry) return;

      const bits = [];
      const time = formatClock(entry.arrive);
      if (time) bits.push(`<span class="gameday-detail-time">${escapeHTML(time)}</span>`);
      if (entry.instruction) {
        bits.push(`<span class="gameday-detail-text">${escapeHTML(entry.instruction)}</span>`);
      }
      if (!bits.length) return;

      const note = document.createElement("div");
      note.className = "gameday-detail-note";
      note.innerHTML = bits.join("");
      body.parentNode.insertBefore(note, body);
    } catch (err) {
      console.warn("[gameday] details decoration failed:", err);
    }
  };

  /* Selection marks progress. Wrapping selectFeature (again — the
     router already wrapped it) keeps this on the one seam every
     navigation path uses. */
  const _selectFeature = selectFeature;
  selectFeature = function (sel, kind, opts) {
    _selectFeature(sel, kind, opts);
    try {
      if (!state.loaded) return;
      markVisited(Router.stopKeyForFeature(sel && sel.feature));
    } catch (err) {
      console.warn("[gameday] progress tracking failed:", err);
    }
  };

  /* ============================================================
     Boot
     ============================================================ */

  Core.onReady(async () => {
    const route = Router.getRoute();
    if (!route.g) return;

    const ok = await load(route.g, route.n);
    if (!ok) return;

    // Show the itinerary straight away — someone who opened a
    // gameday link came for the schedule, not the overview. Desktop
    // only: on mobile #railTour is a separate bottom sheet that would
    // stack on top of the details sheet with no way to dismiss
    // either (the same reason js/14-redesign.js gates it).
    if (typeof isMobile === "function" && !isMobile()) {
      const rt = $id("railTour");
      if (rt) rt.hidden = false;
      document.body.classList.add("tour-rail-open");
    }

    if (typeof tourIndex === "number" && tourIndex < 0 &&
        typeof tourStops !== "undefined" && tourStops.length && !route.stop) {
      goToStop(0);
    } else {
      render();
    }

    // Keep the countdown honest without spinning a per-second timer
    // on a phone that is in someone's pocket for four hours.
    setInterval(() => { if (!document.hidden) renderHeader(); }, 30000);
  });

  window.Gameday = {
    state,
    load,
    isActive: () => state.loaded,
    entryFor,
    stopSummary,
    currentStop,
    nextStop,
    progress,
    markVisited,
    formatClock,
    kickoffCountdown,
    recruitName: () => state.name
  };
})();
