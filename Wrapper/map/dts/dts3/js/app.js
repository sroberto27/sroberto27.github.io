/* ============================================================
   Main application logic
   ------------------------------------------------------------
   App-shell state machine: views are swapped via JS state
   (home / category), not scroll. Overlays (example window,
   forms, sign-in, portal) layer over the shell.

   Contents:
     - App state + nav (pillars, drawer, sector pager, swipe)
     - View switching + category rendering
     - Treedis embed + TourBridge wiring (js/tour-bridge.js)
     - Twin experience (full-screen reveal)
     - Example window
     - Access Your Twin (sign-in) + client portal
     - Question bar, projects window, contact panel, lead forms
     - Background canvas, event wiring, boot
   ============================================================ */
(function () {
  "use strict";

  const cfg = window.DTS_CONFIG;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Real bug, found live testing Phase 4's deep-link restore (05-SPEC
  // criterion 4, `?...&map=<state>`): openExample()'s own syncURL() call
  // rewrites the address bar from category/project/exp alone (buildStateURL()
  // never carries `map`), synchronously, on the same call that opens the
  // project -- before mountGis()'s lazy-loaded engine ever gets an async
  // turn to read location.search itself. By the time it did, the param was
  // already gone. Captured once here, at parse time, before any syncURL()
  // call in this file can run.
  let pendingGisStateParam = (function () {
    try { return new URLSearchParams(location.search).get("map"); } catch (_e) { return null; }
  })();

  /* ---------------- App state ---------------- */
  const state = {
    view: "home",          // "home" | "category"
    category: "education", // active pillar id
    dockTab: "usecases",
    twinOpen: false,       // full-screen Treedis experience (centre-out reveal)
    contactOpen: false,
    treedisStarted: false
  };

  function getCategory(id) {
    return cfg.categories.find((c) => c.id === id) || cfg.categories[0];
  }

  /* ============================================================
     BUILD: top nav pillars
     ============================================================ */
  function buildPillars() {
    const nav = $("#pillars");
    nav.innerHTML = "";
    cfg.categories.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "pillar" + (c.id === state.category ? " is-active" : "");
      btn.type = "button";
      btn.dataset.cat = c.id;
      btn.setAttribute("role", "tab");
      btn.textContent = c.label.toUpperCase();
      btn.addEventListener("click", () => openCategory(c.id));
      nav.appendChild(btn);
    });
  }

  /* ============================================================
     MOBILE: nav drawer
     ============================================================ */
  function buildDrawer() {
    /* Left slide-in panel listing the four sectors; the active sector
       gets a full-width bar in its accent colour. Home is reached via
       the brand logo. */
    const drawer = $("#navDrawer");
    drawer.innerHTML = "";

    cfg.categories.forEach((c) => {
      const a = document.createElement("a");
      a.href = "#";
      a.dataset.cat = c.id;
      a.style.setProperty("--item-accent", c.accent || "#E9B44C");
      /* data-label feeds the ghost echo behind the active item
         (see .nav-drawer a.is-active::before). */
      a.dataset.label = c.kicker;
      a.innerHTML = '<span>' + c.kicker + '</span>';
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openCategory(c.id);
        closeDrawer();
      });
      drawer.appendChild(a);
    });
  }

  function syncDrawer() {
    const onHome = state.view === "home";
    $$("#navDrawer a").forEach((a) => {
      if (a.dataset.nav === "home") {
        a.classList.toggle("is-active", onHome);
      } else {
        a.classList.toggle("is-active",
          !onHome && a.dataset.cat === state.category);
      }
    });
  }

  function openDrawer() {
    $("#burger").classList.add("is-open");
    $("#burger").setAttribute("aria-expanded", "true");
    $("#navDrawer").classList.add("is-open");
    $("#navDrawer").setAttribute("aria-hidden", "false");
    $("#navScrim").hidden = false;
  }
  function closeDrawer() {
    $("#burger").classList.remove("is-open");
    $("#burger").setAttribute("aria-expanded", "false");
    $("#navDrawer").classList.remove("is-open");
    $("#navDrawer").setAttribute("aria-hidden", "true");
    $("#navScrim").hidden = true;
  }
  function toggleDrawer() {
    if ($("#navDrawer").classList.contains("is-open")) closeDrawer();
    else openDrawer();
  }

  /* ============================================================
     MOBILE: sector dots pager — ‹ SECTOR › with one dot per sector.
     Arrows step through sectors (looping), dots jump directly.
     Sync is a class/text toggle only, so it can't fall out of step.
     ============================================================ */
  function buildSectorPager() {
    const dots = $("#sectorPagerDots");
    if (!dots) return;
    dots.innerHTML = "";
    cfg.categories.forEach((c) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "sector-dot";
      d.dataset.cat = c.id;
      d.setAttribute("aria-label", c.kicker);
      d.style.setProperty("--item-accent", c.accent || "#E9B44C");
      d.addEventListener("click", () => openCategory(c.id));
      dots.appendChild(d);
    });
    $("#sectorPrev").addEventListener("click", () => openCategory(previousCategory().id));
    $("#sectorNext").addEventListener("click", () => openCategory(nextCategory().id));
    syncSectorPager();
  }

  /* Update the centred label (text + accent) and the active dot. */
  function syncSectorPager() {
    const idx = currentCatIndex();
    const c = cfg.categories[idx];
    const label = $("#sectorPagerLabel");
    if (!label || !c) return;
    label.textContent = c.kicker;
    label.style.color = c.accent || "#E9B44C";
    $$("#sectorPagerDots .sector-dot").forEach((el, i) => {
      el.classList.toggle("is-active", i === idx);
    });
  }

  /* ============================================================
     MOBILE: swipe gestures on the category stage
     Swipe LEFT  → cards → contact; contact → next sector's cards.
     Swipe RIGHT → contact → cards; cards → previous sector's cards.
     ============================================================ */
  function previousCategory() {
    const i = currentCatIndex();
    return cfg.categories[(i - 1 + cfg.categories.length) % cfg.categories.length];
  }

  function initSwipe() {
    const stage = $("#view-category");
    let x0 = null, y0 = null;
    const THRESH = 48;

    stage.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      x0 = t.clientX; y0 = t.clientY;
    }, { passive: true });

    stage.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < THRESH || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx < 0) {
        if (state.contactOpen) advanceToNextSector();
        else slideToContact();
      } else {
        if (state.contactOpen) slideToCards();
        else openCategory(previousCategory().id);
      }
    }, { passive: true });
  }

  /* Sync the nav highlight. The logo is a menu item: it takes the
     gold highlight when home is active. Pillars highlight only when
     their category view is showing. */
  function syncNav() {
    const onHome = state.view === "home";
    const brand = $("#brandHome");
    if (brand) brand.classList.toggle("is-active", onHome);
    $$(".pillar").forEach((b) =>
      b.classList.toggle("is-active", !onHome && b.dataset.cat === state.category)
    );
  }

  /* ============================================================
     VIEW SWITCHING (state, not scroll)
     ============================================================ */
  function showView(name) {
    // Leaving home? Snap the twin layer closed so the hero is
    // reset on return (covers mid-animation states too).
    if (name !== "home") resetExperience();
    state.view = name;
    $$(".view").forEach((v) => {
      const match = v.id === "view-" + name;
      v.hidden = !match;
      v.classList.toggle("is-active", match);
    });
    // Bottom tabs only make sense in a category view; the "Explore
    // your world below" hint only on home.
    $("#dockTabs").hidden = name !== "category";
    $("#sectorPager").hidden = name !== "category";

    syncNav();
    syncDrawer();
  }

  function goHome() {
    showView("home");
    closeDrawer();
    if (!restoringFromHistory) syncURL(false);
  }

  function openCategory(id) {
    state.category = id;
    renderCategory(getCategory(id));
    // Always land on the cards panel when (re)entering a sector.
    const track = $("#catTrack");
    if (track) track.classList.remove("show-contact");
    state.contactOpen = false;
    showView("category");
    updateNextLabel();
    syncSectorPager();
    syncDrawer();
    syncContactBar();
    if (!restoringFromHistory) syncURL(false);
  }

  /* ============================================================
     URL STATE  (history.pushState / popstate)
     ------------------------------------------------------------
     Only three states ever get a history entry: home, a category
     view, and a category view with a project window open on top of
     it (or, for a bare `?project=` link with no category context —
     e.g. an old-style share link — a project window open on top of
     home). Everything else (lead form, sign-in, share popup, FAQ
     answer bar, any other overlay) stays in-memory only.

     goHome / openCategory / openExample / closeExample are the only
     choke points that ever touch the URL, via syncURL() below — so
     every existing call site (pillars, drawer, dock tabs, "More from
     Sector", the sector projects window, the brand logo, Share) gets
     correct history entries automatically.

     restoringFromHistory mutes those same choke points while we're
     rebuilding state FROM a URL (popstate, or the initial page load)
     so we never push a redundant second entry on top of the one
     already in the address bar.
     ============================================================ */
  let restoringFromHistory = false;

  /* How many history entries THIS app has pushed in this session.
     history.length can't be used for that — it counts every entry in
     the tab, including pages visited before ours — and there's no way
     to ask the browser "is there anything behind me that I own". We
     track it ourselves: incremented on every pushState, decremented
     whenever popstate moves us backwards. closeExample() consults it
     before calling history.back(), so a project opened from a fresh
     deep link (depth 0) tears down in place instead of navigating the
     reader out of the site entirely. */
  let pushDepth = 0;

  /* Monotonic position marker written into history.state on every
     entry we create. Comparing the incoming entry's marker against the
     one we left tells us whether a popstate went backwards or forwards,
     which is what keeps pushDepth honest. */
  let histIndex = 0;

  /* The query string for whatever the app is showing right now.

     When a project window is open, the project's OWN sector is
     authoritative — not state.category. openExample() can be called
     from a different category than the project belongs to ("More from
     Sector" cards, dock tabs, the sector projects window), and the URL
     has to describe the project's real home so that reloading or
     sharing it rebuilds the correct backdrop underneath. Using
     state.category here would emit URLs like
     ?category=education&project=civic for a government project. */
  function currentURLParams() {
    const params = new URLSearchParams();

    if (activeExampleId) {
      const ex = cfg.examples && cfg.examples[activeExampleId];
      const sector = (ex && ex.sector) || state.category;
      if (sector) params.set("category", sector);
      params.set("project", activeExampleId);
      // Only emit &exp= once there's something to disambiguate — keeps
      // every existing single-experience project URL byte-identical.
      const list = (ex && ex.experiences) || [];
      if (list.length > 1 && activeExperienceId) params.set("exp", activeExperienceId);
      return params;
    }

    if (state.view === "category" && state.category) {
      params.set("category", state.category);
    }
    return params;
  }

  function buildStateURL() {
    const qs = currentURLParams().toString();
    return location.pathname + (qs ? "?" + qs : "");
  }

  /* Push (or replace) a history entry matching current app state.
     Skips a redundant push when the URL wouldn't actually change
     (e.g. re-clicking the already-active pillar). */
  function syncURL(replace) {
    try {
      const url = buildStateURL();
      if (!replace && url === location.pathname + location.search) return;
      if (replace) {
        // Keep whatever index this entry already had (or claim the
        // current one) so replacing never reorders the sequence.
        const existing = history.state && typeof history.state.i === "number"
          ? history.state.i : histIndex;
        histIndex = existing;
        history.replaceState({ i: existing }, "", url);
      } else {
        histIndex++;
        history.pushState({ i: histIndex }, "", url);
        pushDepth++;
      }
    } catch (_e) { /* history API unavailable — URL just won't update */ }
  }

  /* Rebuild app state (home / category / category+project) to match
     whatever the address bar says RIGHT NOW. Used for popstate
     (back/forward). Never pushes a new entry itself —
     restoringFromHistory mutes the choke points above while it runs. */
  function applyStateFromURL() {
    let categoryId = null, projectId = null, expId = null;
    try {
      const params = new URLSearchParams(location.search);
      categoryId = params.get("category");
      projectId = params.get("project");
      expId = params.get("exp");
    } catch (_e) { /* malformed URL params — treat as home */ }

    const validProject = !!(projectId && cfg.examples && cfg.examples[projectId]);

    // Same rule as on first load: the project's own sector is the
    // backdrop, whatever the category param happens to say.
    if (validProject) {
      const sector = cfg.examples[projectId].sector;
      if (sector && cfg.categories.some((c) => c.id === sector)) categoryId = sector;
    }
    const validCategory = !!(categoryId && cfg.categories.some((c) => c.id === categoryId));

    restoringFromHistory = true;
    try {
      // 1. Backdrop — home or a category.
      if (validCategory) {
        if (state.view !== "category" || state.category !== categoryId) {
          openCategory(categoryId);
        }
      } else if (state.view !== "home") {
        goHome();
      }
      // 2. Project window on top of it (or nothing).
      if (validProject) {
        if (activeExampleId !== projectId) openExample(projectId, undefined, expId);
      } else if (activeExampleId) {
        // Raw teardown, never closeExample() — we're already responding
        // to a history move, so the URL is correct and nothing should
        // navigate again.
        closeExampleNow();
      }
    } finally {
      restoringFromHistory = false;
    }
  }

  window.addEventListener("popstate", (e) => {
    /* Track which direction the reader moved before rebuilding state,
       so pushDepth still reflects how many of our own entries sit
       behind the current one. Entries created before this marker
       existed (or by another script) report no index — treat those as
       "unknown" and just resync rather than guessing a direction. */
    const incoming = e.state && typeof e.state.i === "number" ? e.state.i : null;
    if (incoming !== null) {
      if (incoming < histIndex) pushDepth = Math.max(0, pushDepth - (histIndex - incoming));
      else if (incoming > histIndex) pushDepth += incoming - histIndex;
      histIndex = incoming;
    }
    applyStateFromURL();
  });

  /* Wait for the intro loading screen to genuinely finish (or be
     skipped, for reduced-motion) before revealing restored state that
     lives outside .app — the project window overlay isn't covered by
     the cloak's opacity:0 rule, so opening it early would flash on
     screen before the loader itself even appears. */
  function waitForIntroCloak(cb) {
    if (!document.documentElement.classList.contains("intro-cloak")) { cb(); return; }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(bail);
      cb();
    };
    const poll = setInterval(() => {
      if (!document.documentElement.classList.contains("intro-cloak")) finish();
    }, 60);
    /* Bailout. index.html's inline script already removes the cloak
       after 4s if the loader never runs, but that script could itself
       be edited or fail — without a ceiling here a stuck cloak would
       silently swallow the deep link and the reader would land on a
       bare category with no project window and no error. */
    const bail = setTimeout(finish, 5000);
  }

  /* Called once at boot: resolve the page's starting URL into app
     state, then normalize the URL with replaceState (never pushState)
     so the starting entry isn't duplicated. The home/category part is
     safe to apply immediately — it's hidden behind the cloak either
     way — while a project window is deferred behind waitForIntroCloak,
     same as the old share-link deep-link behavior it replaces. */
  function restoreInitialStateFromURL() {
    let categoryId = null, projectId = null, expId = null;
    try {
      const params = new URLSearchParams(location.search);
      categoryId = params.get("category");
      projectId = params.get("project");
      expId = params.get("exp");
    } catch (_e) { /* malformed URL params — treat as home */ }

    const validProject = !!(projectId && cfg.examples && cfg.examples[projectId]);

    /* A project's own sector wins over the category in the URL. That
       makes old-style share links (?project=<id>, no category) restore
       the right backdrop instead of stranding the window over home,
       and it repairs any link that names a mismatched pair. */
    if (validProject) {
      const sector = cfg.examples[projectId].sector;
      if (sector && cfg.categories.some((c) => c.id === sector)) categoryId = sector;
    }
    const validCategory = !!(categoryId && cfg.categories.some((c) => c.id === categoryId));

    restoringFromHistory = true;
    if (validCategory) {
      openCategory(categoryId);
    } else {
      renderCategory(getCategory(state.category));
      goHome();
    }
    restoringFromHistory = false;
    syncURL(true);   // normalize the starting entry — replace, never push

    if (validProject) {
      waitForIntroCloak(() => {
        restoringFromHistory = true;
        openExample(projectId, undefined, expId);
        restoringFromHistory = false;
        syncURL(true);
      });
    }
  }

  /* ============================================================
     RENDER: category detail
     ============================================================ */
  function renderCategory(c) {
    // Expose the active sector so CSS can colour the kicker / card
    // titles with that sector's Figma accent.
    $("#view-category").dataset.sector = c.id;
    /* Expose the sector accent globally — the drawer bar, sector strip,
       divider line, contact tab, and projects button all take it. */
    document.documentElement.style.setProperty("--sector-accent", c.accent || "#E9B44C");
    $("#catKicker").textContent = "— " + c.kicker;
    $("#catTitle").textContent  = c.title;
    $("#catSub").textContent    = c.sub;
    $("#catBody").textContent   = c.body;
    /* The button names the active sector. */
    $("#catProjectsBtn").textContent = "VIEW " + c.kicker + " PROJECTS";

    // use-case cards — clicking one opens that sub-vertical's example window.
    const grid = $("#catCards");
    grid.innerHTML = "";
    c.cards.forEach((card) => {
      const el = document.createElement("div");
      el.className = "uc-card";
      el.tabIndex = 0;
      el.dataset.card = card.id;
      el.innerHTML =
        '<h3>' + card.title.toUpperCase() + '</h3><p>' + card.text + '</p>';
      el.addEventListener("click", () => openExample(card.id));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openExample(card.id); }
      });
      grid.appendChild(el);
    });

    // bottom dock tabs: Use Cases + one per card. "Use Cases" returns to
    // the cards grid; each sub-vertical tab opens its example window.
    const tabs = $("#dockTabs");
    tabs.innerHTML = "";
    tabs.appendChild(makeTab("usecases", "Use Cases", true));
    c.cards.forEach((card) => tabs.appendChild(makeTab(card.id, card.short || card.title)));
    state.dockTab = "usecases";

  }

  function makeTab(id, label, active) {
    const b = document.createElement("button");
    b.className = "dock-tab" + (active ? " is-active" : "");
    b.type = "button";
    b.dataset.tab = id;
    b.textContent = label;
    b.addEventListener("click", () => {
      $$(".dock-tab").forEach((t) =>
        t.classList.toggle("is-active", t.dataset.tab === id)
      );
      if (id === "usecases") {
        state.dockTab = "usecases";
        if (state.contactOpen) slideToCards();
        $$(".uc-card").forEach((card) => (card.style.outline = ""));
      } else {
        openExample(id);
      }
    });
    return b;
  }

  /* ============================================================
     TREEDIS EMBED + bridge wiring
     ------------------------------------------------------------
     The live Treedis iframe is created once at boot inside
     #demoStage. Overlays borrow the same iframe by moving it in
     the DOM and return it on close — moving (not recreating)
     keeps the session and the TourBridge handshake intact.
     ============================================================ */
    let treedisIframe = null;
    let pendingExampleSweep = null;   // sweep queued while Treedis is still booting

    function startTreedis() {
      if (state.treedisStarted) return;
      state.treedisStarted = true;

      const url = cfg.treedis && cfg.treedis.tourUrl;
      const stage = $("#demoStage");

      if (!url) {
        $("#demoLoadingText").textContent =
          "Treedis tour URL not set — add cfg.treedis.tourUrl in config.js";
        return;
      }

      // Build the live iframe directly in the inline demo stage.
      treedisIframe = document.createElement("iframe");
      treedisIframe.id = "treedisFrame";
      treedisIframe.title = "Digital Twin experience";
      treedisIframe.allow = "xr-spatial-tracking; fullscreen; vr; gyroscope; accelerometer";
      treedisIframe.setAttribute("allowfullscreen", "");
      treedisIframe.src = url;
      stage.appendChild(treedisIframe);

      // Bridge handshake — protocol lives in js/tour-bridge.js.
      TourBridge.initialize(treedisIframe, {
        origin: cfg.treedis.origin,
        defaultTransitionTime: cfg.treedis.defaultTransitionTime,
        onReady: function () {
          // Hide all loading veils once Treedis is live.
          ["#demoLoading", "#overlayLoading", "#exampleLoading"].forEach((sel) => {
            const v = $(sel); if (v) v.classList.add("is-hidden");
          });
          // Honour a sweep queued before the bridge was ready (an example
          // window or a client twin opened during cold boot), else the
          // configured home sweep.
          if (pendingExampleSweep) {
            TourBridge.navigateToSweep(pendingExampleSweep);
            pendingExampleSweep = null;
          } else if (cfg.treedis.homeSweepId) {
            TourBridge.navigateToSweep(cfg.treedis.homeSweepId);
          }
        },
        onPoseChanged: function (sweepId) {
          // Hook point: react to where the user walked inside Treedis.
          console.info("[dts] pose →", sweepId);
        }
      });
    }

    /* Move the live Treedis iframe back to its home mount (#demoStage,
       inside the twin layer). Used whenever an overlay that borrowed it
       (the example window) closes. */
    function parkIframe() {
      const stage = $("#demoStage");
      if (treedisIframe && stage && treedisIframe.parentNode !== stage) {
        stage.appendChild(treedisIframe);
      }
    }

  /* ============================================================
     TWIN EXPERIENCE  (full-screen centre-out reveal)
     ------------------------------------------------------------
     On "Try a Digital Twin":
       1. the twin layer mounts as a narrow centre slice with a
          bright seam line
       2. the slice expands until the live experience fills
          everything below the fixed header
       3. after a beat, the hero copy fades back in as a glass
          card over the experience
     The Treedis iframe never reloads — the layer only reveals it.
     ============================================================ */
    let cardTimer = null;

    function openExperience() {
      if (state.twinOpen) return;
      state.twinOpen = true;

      // Make sure the iframe is home in the twin layer before revealing.
      parkIframe();

      const layer = $("#twinLayer");
      layer.setAttribute("aria-hidden", "false");
      document.body.classList.add("twin-active");

      // Mount as a centre slice, then expand on the next frame so the
      // clip-path transition actually runs.
      layer.classList.add("is-mounted");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => layer.classList.add("is-open"))
      );

      // Glass card fades in once the user has had a moment inside the twin.
      clearTimeout(cardTimer);
      cardTimer = setTimeout(showHeroCard, 3200);
    }

    function showHeroCard() {
      const card = $("#twinHeroCard");
      card.classList.add("is-visible");
      card.setAttribute("aria-hidden", "false");
      hideRestoreChip();               // card open ⇒ chip away
    }

    function hideHeroCard() {
      const card = $("#twinHeroCard");
      card.classList.remove("is-visible");
      card.setAttribute("aria-hidden", "true");
    }

    /* Minimize — collapse the glass card into the small DTS chip
       parked bottom-left, just above Treedis' own circular buttons.
       Clicking the chip (wired in wire()) calls showHeroCard() to
       restore the card to its normal position. */
    function minimizeHeroCard() {
      hideHeroCard();
      const chip = $("#twinCardRestore");
      chip.classList.add("is-visible");
      chip.setAttribute("aria-hidden", "false");
    }

    function hideRestoreChip() {
      const chip = $("#twinCardRestore");
      chip.classList.remove("is-visible");
      chip.setAttribute("aria-hidden", "true");
    }

    function closeExperience() {
      if (!state.twinOpen) return;
      state.twinOpen = false;
      clearTimeout(cardTimer);
      hideHeroCard();
      hideRestoreChip();

      const layer = $("#twinLayer");
      layer.classList.remove("is-open");           // reverse reveal
      document.body.classList.remove("twin-active");

      // Unmount once the clip animation has closed back to the seam.
      setTimeout(() => {
        if (!state.twinOpen) {
          layer.classList.remove("is-mounted");
          layer.setAttribute("aria-hidden", "true");
        }
      }, 1200);
    }

    /* Instant reset (no animation) — used when leaving the home view. */
    function resetExperience() {
      state.twinOpen = false;
      clearTimeout(cardTimer);
      hideHeroCard();
      hideRestoreChip();
      const layer = $("#twinLayer");
      layer.classList.remove("is-open", "is-mounted");
      layer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("twin-active");
      parkIframe();
    }

  /* ============================================================
     EXAMPLE WINDOW  (per sub-vertical)
     ------------------------------------------------------------
     Opened by a use-case card, a bottom dock tab, or an evidence
     filter. Populates content from cfg.examples[cardId], borrows
     the live Treedis iframe into its experience pane, and (when the
     example specifies a sweepId) navigates the tour to that sweep.
     ============================================================ */
  let activeExampleId = null;
  let activeExperienceId = null;   // id of the active tab within the open example

  function openExample(cardId, evidenceLabel, expId, showOpts) {
    const ex = cfg.examples && cfg.examples[cardId];
    if (!ex) { console.warn("[dts] no example for", cardId); return; }

    /* Dock tabs, "More from Sector", and the sector projects window can
       all open a different project while the window is ALREADY open
       (a swap, not a fresh entry). A swap replaces the current history
       entry instead of pushing a new one — otherwise every project
       browsed in one sitting stacks up its own back-button stop, and
       closing the window (which steps back exactly one entry) would
       land on whichever project was viewed just before this one
       instead of the category underneath all of them. */
    const isSwap = !!activeExampleId && activeExampleId !== cardId;
    activeExampleId = cardId;

    const cat = cfg.categories.find((c) => c.id === ex.sector) || getCategory(state.category);

    // Header — the window is titled with the project name; the
    // sub-vertical rides in the kicker.
    $("#exKicker").textContent  = "— " + (cat.kicker || cat.label.toUpperCase()) + " · " + ex.title;
    $("#exTitle").textContent   = ex.project.name;
    $("#exTagline").textContent = ex.tagline || "";
    $("#exOverview").textContent = ex.overview || "";

    // Capture / platform chips.
    $("#exCapture").textContent = ex.capturedWith || "Matterport Pro3";
    const platChip = $("#exPlatform");
    if (platChip) platChip.textContent = ex.platform || "Treedis";

    // Project example
    $("#exProjectName").textContent  = ex.project.name;
    $("#exProjectBlurb").textContent = ex.project.blurb;
    const kindChip = $("#exKind");
    if (ex.project.kind) { kindChip.hidden = false; kindChip.textContent = ex.project.kind; }
    else kindChip.hidden = true;
    $("#exIllustrative").hidden = !ex.project.illustrative;

    // Evidence tabs
    buildExampleEvidence(ex, evidenceLabel);

    // "More from {Sector}" — the sector's other sub-verticals.
    const moreTitle = $("#exMoreTitle");
    const moreGrid  = $("#exMoreGrid");
    if (moreTitle && moreGrid) {
      moreTitle.textContent = "More from " + cat.label;
      moreGrid.innerHTML = "";
      (cat.cards || []).filter((cd) => cd.id !== cardId).slice(0, 3).forEach((cd) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "example-more-card";
        b.innerHTML =
          '<span class="example-more-name">' + escapeHTML(cd.title) + '</span>' +
          '<span class="example-more-text">' + escapeHTML(cd.text) + '</span>';
        b.addEventListener("click", () => openExample(cd.id));
        moreGrid.appendChild(b);
      });
    }

    // Tint the example window to the sector colour for orientation.
    const win = $("#exampleOverlay .example-window");
    if (win) win.dataset.sector = ex.sector;

    // "Photos and Video" — real project imagery (portfolio extractions)
    // when the example provides a gallery; placeholder mosaic otherwise.
    buildExampleGallery(ex);

    // Related live experiences & videos from the link inventory.
    buildExampleLinks(ex);

    // ---- Experience pane ----------------------------------------
    // Priority: the example's own experiences[] (tabbed if 2+) > the
    // shared showcase iframe navigated to a sweep, for legacy projects
    // that carry no media/experiences at all.
    showExperience(ex, expId, showOpts);

    const ov = $("#exampleOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    // The window itself is the scroll container on desktop; the inner
    // pane still scrolls on phones. Reset whichever applies.
    const exWin = document.querySelector("#exampleOverlay .example-window");
    if (exWin) exWin.scrollTop = 0;
    const exPane = $("#exampleContent");
    if (exPane) exPane.scrollTop = 0;

    if (!restoringFromHistory) syncURL(isSwap);
  }

  /* ============================================================
     EXPERIENCE SWITCHER  (tabbed stage — one or more experiences
     per project: a Treedis tour, a video, or — in a later phase — a
     GIS map)
     ------------------------------------------------------------
     Each dedicated experience gets its own persistent iframe, keyed
     by experience id (exampleMediaFrame-<expId>), instead of one
     shared element reused across tabs. That's deliberate: a project
     that mixes a Treedis tour with a video would otherwise have both
     fight over a single iframe's `src`, and reassigning it every tab
     switch would force the tour to reload and re-run the TourBridge
     handshake on every return visit. Suspending a tab hides its
     frame rather than removing it, so a Treedis session survives
     switching away and back; a video's frame is blanked instead, so
     its audio actually stops.
     ============================================================ */
  function experienceFrameId(expId) { return "exampleMediaFrame-" + expId; }

  function activeExperience(ex) {
    const list = (ex && ex.experiences) || [];
    return list.find((e) => e.id === activeExperienceId)
        || list.find((e) => e.default) || list[0] || null;
  }

  /* The URL "Enter Twin" / "open in new tab" should target for the
     ACTIVE experience — its own tour or video when it has one. */
  function exampleOpenUrl(ex) {
    const e = activeExperience(ex);
    if (!e) return null;
    if (e.type === "treedis") return e.tourUrl || null;
    if (e.type === "vimeo")   return e.watchUrl || e.embedUrl || null;
    return null;   // gis — no "open in new tab" target
  }

  function videoEmbedUrl(target) {
    if (!target.embedUrl) return null;
    // Autoplay muted so the pane reads as a live experience.
    const sep = target.embedUrl.indexOf("?") >= 0 ? "&" : "?";
    return target.embedUrl + sep + "muted=1&title=0&byline=0&portrait=0";
  }

  function ensureFrame(id) {
    let frame = document.getElementById(id);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = id;
      frame.className = "twin-iframe";
      frame.allow = "autoplay; fullscreen; picture-in-picture; xr-spatial-tracking; gyroscope; accelerometer";
      frame.allowFullscreen = true;
      frame.addEventListener("load", () => {
        const l = $("#exampleLoading");
        if (l) l.classList.add("is-hidden");
      });
    }
    return frame;
  }

  function mountTreedis(target, slot, loading) {
    if (treedisIframe && slot && treedisIframe.parentNode === slot) parkIframe();
    const frame = ensureFrame(experienceFrameId(target.id));
    frame.dataset.kind = "treedis";
    if (frame.parentNode !== slot) slot.appendChild(frame);
    frame.hidden = false;
    if (loading) loading.classList.toggle("is-hidden", frame.src === target.tourUrl);
    if (target.tourUrl && frame.src !== target.tourUrl) frame.src = target.tourUrl;
  }

  function mountVideo(target, slot, loading) {
    if (treedisIframe && slot && treedisIframe.parentNode === slot) parkIframe();
    const url = videoEmbedUrl(target);
    const frame = ensureFrame(experienceFrameId(target.id));
    frame.dataset.kind = "vimeo";
    if (frame.parentNode !== slot) slot.appendChild(frame);
    frame.hidden = false;
    if (loading) loading.classList.toggle("is-hidden", frame.src === url);
    if (url && frame.src !== url) frame.src = url;
  }

  /* No structured media at all (a legacy project with neither
     `experiences` nor `media`) — borrow the shared showcase iframe and
     navigate it to this project's sweep, exactly as before multi-
     experience support existed. */
  function mountSharedShowcase(ex, slot, loading) {
    if (treedisIframe && slot && treedisIframe.parentNode !== slot) {
      slot.appendChild(treedisIframe);
    }
    if (loading) loading.classList.toggle("is-hidden", TourBridge.isReady);
    if (TourBridge.isReady) {
      TourBridge.navigateToSweep(ex.sweepId || cfg.treedis.homeSweepId || undefined);
    } else if (ex.sweepId) {
      // Queue the sweep for when Treedis finishes booting.
      pendingExampleSweep = ex.sweepId;
    }
  }

  /* ============================================================
     GIS EXPERIENCE MOUNTING  (task 3.12)
     ------------------------------------------------------------
     Real DTSGis.mount() wiring. Two lazy-load layers stack here:
     js/gis/gis-loader.js (already lazy) injects the vendored
     Leaflet/esri-leaflet bundle; loadGisEngine() below lazily
     injects our OWN wrapper code (gis-viewer.js/gis-esri.js/
     gis-tools.js) too — §9's "under 200KB, loaded only on first
     GIS tab activation" budget covers js/gis/* itself, not just
     vendor/, so nothing GIS-related should download for a visitor
     who never opens a map project.

     Instances are cached by mapId (not experience id — a mapId
     can be referenced by more than one project) with a small LRU
     cap: leaving a map's tab, or closing its project, suspends the
     live instance (§5/§9 — stops pending tile/query requests, a
     backgrounded map costs nothing) and leaves its pane parked
     (hidden, still inside #exStageSlot — closeExampleNow's own
     iframe cleanup only matches the "exampleMediaFrame-" prefix,
     so a parked GIS pane is naturally exempt) rather than
     destroying it, so reopening the same map is instant and never
     re-fetches a single layer. Only eviction past the cap actually
     tears an instance down.
     ============================================================ */
  const GIS_CACHE_CAP = 2;
  const gisCache = new Map();      // mapId → { pane, instance, toolsInstance, lastUsed }
  let activeGisMapId = null;       // mapId currently shown in the stage, or null

  let gisEnginePromise = null;
  function loadGisEngine() {
    if (gisEnginePromise) return gisEnginePromise;
    const files = ["js/gis/gis-loader.js", "js/gis/gis-viewer.js", "js/gis/gis-esri.js", "js/gis/gis-tools.js", "js/gis/gis-tour.js"];
    gisEnginePromise = files.reduce((p, src) => p.then(() => new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.body.appendChild(s);
    })), Promise.resolve());
    return gisEnginePromise;
  }

  function featureToursForMap(mapDoc) {
    return Object.keys(cfg.gisFeatureTours || {})
      .map((id) => cfg.gisFeatureTours[id])
      .filter((ft) => ft && ft.mapId === mapDoc.id && ft.enabled !== false);
  }

  function toursForMap(mapDoc) {
    const listedIds = Array.isArray(mapDoc.tours) ? mapDoc.tours : [];
    const listed = listedIds.map((id) => cfg.gisTours && cfg.gisTours[id]).filter(Boolean);
    // A feature tour's own tourId also has to be in the set instance.startTour()
    // resolves against (gis-viewer.js's findTour reads only opts.tours) even
    // though it's deliberately left out of mapDoc.tours -- that array drives
    // the map-level "Guided tours" button/autostart, which a per-feature tour
    // must not appear in or compete with.
    const extra = featureToursForMap(mapDoc)
      .map((ft) => ft.tourId)
      .filter((id) => id && listedIds.indexOf(id) === -1)
      .map((id) => cfg.gisTours && cfg.gisTours[id])
      .filter(Boolean);
    return listed.concat(extra);
  }

  /* Never evicts the map currently on screen. */
  function evictGisIfOverCap() {
    if (gisCache.size <= GIS_CACHE_CAP) return;
    let oldestId = null, oldestTime = Infinity;
    gisCache.forEach((entry, id) => {
      if (id === activeGisMapId) return;
      if (entry.lastUsed < oldestTime) { oldestTime = entry.lastUsed; oldestId = id; }
    });
    if (!oldestId) return;
    const entry = gisCache.get(oldestId);
    gisCache.delete(oldestId);
    if (entry.toolsInstance) { try { entry.toolsInstance.destroy(); } catch (_e) {} }
    try { entry.instance.destroy(); } catch (_e) {}
    entry.pane.remove();
  }

  function showGisError(slot, message) {
    let el = document.getElementById("exGisError");
    if (!el) {
      el = document.createElement("div");
      el.id = "exGisError";
      el.className = "example-gis-placeholder";
    }
    el.textContent = message;
    if (el.parentNode !== slot) slot.appendChild(el);
    el.hidden = false;
  }
  function hideGisError() {
    const el = document.getElementById("exGisError");
    if (el) el.hidden = true;
  }

  function mountGis(target, ex, slot, loading) {
    const mapId = target.mapId;
    const mapDoc = cfg.gisMaps && cfg.gisMaps[mapId];
    if (!mapId || !mapDoc) {
      if (loading) loading.classList.add("is-hidden");
      activeGisMapId = null;
      showGisError(slot, "Map not available.");
      return;
    }
    hideGisError();
    activeGisMapId = mapId;

    const cached = gisCache.get(mapId);
    if (cached) {
      cached.lastUsed = Date.now();
      if (cached.pane.parentNode !== slot) slot.appendChild(cached.pane);
      cached.pane.hidden = false;
      cached.instance.resume();
      cached.instance.invalidateSize();
      if (loading) loading.classList.add("is-hidden");
      return;
    }

    if (loading) loading.classList.remove("is-hidden");
    loadGisEngine().then(() => {
      // Superseded by a later mountGis()/close while the engine was
      // still loading — don't mount a map nobody is looking at.
      if (activeGisMapId !== mapId) return;
      const pane = document.createElement("div");
      pane.className = "example-gis-pane";
      pane.id = "exampleGisPane-" + mapId;
      slot.appendChild(pane);
      // §7/05-SPEC criterion 4: a `?...&map=<state>` link (built by the
      // share tool's own buildShareUrl()) was never actually read back on
      // load anywhere in the app -- gis-viewer.js's decodeStateParam/
      // applyState() has supported this since Phase 3a, but nothing wired
      // the URL to opts.stateParam. Reads the value captured at parse time
      // (see pendingGisStateParam above), not a fresh location.search read
      // here -- by the time this async callback runs, openExample()'s own
      // syncURL() has already rewritten the address bar without it. Consumed
      // exactly once, for whichever GIS map is the first to actually mount
      // this session (a deep link's category/project/exp params always
      // route straight to it) -- a later map switch shouldn't keep
      // replaying a stale deep link.
      const stateParam = pendingGisStateParam;
      pendingGisStateParam = null;
      const tours = toursForMap(mapDoc);
      return DTSGis.mount(pane, mapDoc, {
        tours: tours,
        tourId: stateParam ? null : (target.tourId || null),
        initialView: target.initialView || null,
        stateParam: stateParam || null
      }).then((instance) => {
        if (activeGisMapId !== mapId) {
          // Same race, one async hop later — tear down rather than leave
          // an orphaned, invisible live map running in the background.
          instance.destroy();
          pane.remove();
          return;
        }
        const toolsInstance = window.DTSGisTools ? DTSGisTools.mount(pane, mapDoc, instance, { tours: tours, featureTours: featureToursForMap(mapDoc), hasStateParam: !!stateParam }) : null;
        gisCache.set(mapId, { pane, instance, toolsInstance, lastUsed: Date.now() });
        evictGisIfOverCap();
        if (loading) loading.classList.add("is-hidden");
      }).catch((err) => {
        pane.remove();
        throw err;
      });
    }).catch((err) => {
      console.warn("[dts] GIS mount failed:", err);
      if (loading) loading.classList.add("is-hidden");
      if (activeGisMapId === mapId) showGisError(slot, "The map couldn't load. Reload the page to try again.");
    });
  }

  function invalidateActiveGisSize() {
    if (!activeGisMapId) return;
    const entry = gisCache.get(activeGisMapId);
    if (entry) entry.instance.invalidateSize();
  }

  function suspendActiveGis() {
    if (!activeGisMapId) return;
    const entry = gisCache.get(activeGisMapId);
    if (entry) {
      entry.instance.suspend();
      entry.pane.hidden = true;
    }
    activeGisMapId = null;
  }

  function suspendExperience(expId) {
    if (expId) {
      const frame = document.getElementById(experienceFrameId(expId));
      if (frame) {
        // Treedis must not reload when the reader comes back — just hide
        // it. Video must stop playing audio behind the newly active tab —
        // blank its src too.
        if (frame.dataset.kind === "vimeo") frame.src = "about:blank";
        frame.hidden = true;
      }
    }
    suspendActiveGis();
  }

  function experienceGlyph(type) {
    if (type === "treedis") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    }
    if (type === "vimeo") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
    }
    if (type === "gis") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3L3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3zM9 5.2v13M15 5.5v13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    }
    return "";
  }

  /* Tab strip — one button per experience; hidden entirely for fewer
     than two so the 16 legacy single-experience projects render exactly
     as before, with no extra chrome and no layout shift. A real ARIA
     tablist: roving tabindex, arrow/Home/End to move focus, Enter/Space
     to activate (wired once, by delegation, in wire() below). */
  function syncStageTabs(list, activeId) {
    const wrap = $("#exStageTabs");
    if (!wrap) return;
    // Rebuilding replaces every button, which would silently drop focus
    // out of the strip (to <body>) on a keyboard-driven switch — re-focus
    // the new active tab afterward if the strip owned focus beforehand.
    const hadFocus = wrap.contains(document.activeElement);
    wrap.innerHTML = "";
    if (list.length < 2) { wrap.hidden = true; return; }
    wrap.hidden = false;
    let activeBtn = null;
    list.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "example-stage-tab";
      b.id = "exTab-" + e.id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(e.id === activeId));
      b.setAttribute("aria-controls", "exStageSlot");
      b.tabIndex = e.id === activeId ? 0 : -1;
      b.dataset.expId = e.id;
      b.innerHTML = experienceGlyph(e.type) + "<span>" + escapeHTML(e.label || e.type) + "</span>";
      wrap.appendChild(b);
      if (e.id === activeId) activeBtn = b;
    });
    if (hadFocus && activeBtn) activeBtn.focus();
  }

  /* True once an experience can be mounted with zero network calls — either
     it was always public (real target already on the node) or it was
     resolved earlier this session (Object.assign in resolveExperienceNode
     mutates the node in place; a GIS map's own resolve is tracked in
     access.resolvedGisMaps/cfg.gisMaps since the mapId itself is a second,
     separate resource). Drives the locked-placeholder gate below — never
     assumed, always re-checked against the live node/cache. */
  function experienceIsAvailable(target) {
    if (target.tourUrl || target.embedUrl || target.watchUrl || target.url) return true;
    if (target.type === "gis" && target.mapId) {
      const existing = cfg.gisMaps && cfg.gisMaps[target.mapId];
      return access.resolvedGisMaps.has(target.mapId) || !!(existing && existing.layers);
    }
    return false;
  }

  function lockGlyph() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  /* Shown in #exStageSlot for a gated, not-yet-resolved experience instead
     of auto-resolving (which would silently fire the sign-in prompt the
     instant a guest opens the project window — see the 2026-08-08 fix).
     Clicking it is the explicit "I want to view this" action that DOES
     trigger a resolve, same as "Enter Twin". */
  function showLockedPlaceholder(slot, target) {
    let el = document.getElementById("exLocked");
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.id = "exLocked";
      el.className = "example-locked-placeholder";
      el.addEventListener("click", () => {
        const ex = cfg.examples && cfg.examples[activeExampleId];
        if (ex) showExperience(ex, activeExperienceId, { resolveNow: true });
      });
    }
    if (el.parentNode !== slot) slot.appendChild(el);
    const noun = target.type === "gis" ? "map" : target.type === "vimeo" ? "video" : "experience";
    el.innerHTML =
      '<span class="example-locked-icon">' + lockGlyph() + "</span>" +
      '<span class="example-locked-text">Sign in to view this ' + noun + "</span>";
    el.hidden = false;
  }
  function hideLockedPlaceholder() {
    const el = document.getElementById("exLocked");
    if (el) el.hidden = true;
  }

  /* expId is optional — omit it to fall back to the experience marked
     `default`, or the first one. Pure mount/switch: callers own the URL
     sync (openExample()'s own trailing syncURL for a project open/swap;
     the tab click handler's own replaceState for an in-place tab switch).

     opts.resolveNow forces an immediate resolve (and, for a gated target,
     the sign-in prompt) even though the target isn't available yet —
     used only where the reader already took an explicit action asking for
     THIS experience (destination preservation after login, a portal card
     click, the locked placeholder itself, "Enter Twin"). Every other
     caller (opening a project card, a tab switch, a deep link, back/
     forward) omits it, so just opening a project window never pops the
     sign-in form on its own — only trying to actually view a gated pane
     does. */
  async function showExperience(ex, expId, opts) {
    const resolveNow = !!(opts && opts.resolveNow);
    const list = ex.experiences || [];
    const target = list.find((e) => e.id === expId)
                || list.find((e) => e.default)
                || list[0];

    const slot = $("#exStageSlot");
    const loading = $("#exampleLoading");
    const enterBtn = $("#exEnter");

    suspendExperience(activeExperienceId);
    hideLockedPlaceholder();

    if (!target) {
      activeExperienceId = null;
      syncStageTabs([], null);
      mountSharedShowcase(ex, slot, loading);
      if (enterBtn) enterBtn.textContent = "Enter Twin";
      return;
    }

    activeExperienceId = target.id;
    syncStageTabs(list, target.id);
    // A GIS pane has no "open in new tab" target — the button fullscreens
    // the map in place instead. Recomputed on every call, so switching
    // back to a tour/video tab restores the usual label automatically.
    if (enterBtn) enterBtn.textContent = target.type === "gis" ? "Full screen map" : "Enter Twin";

    if (!resolveNow && !experienceIsAvailable(target)) {
      if (loading) loading.classList.add("is-hidden");
      showLockedPlaceholder(slot, target);
      return;
    }

    if (loading) loading.classList.remove("is-hidden");
    const resolved = await resolveExperienceNode(target.id, target);
    // The reader may have switched tabs again while this was in flight —
    // don't let a stale resolve mount something nobody is looking at
    // anymore (same guard mountGis already uses for its own async mount).
    if (activeExperienceId !== target.id) return;
    if (!resolved.ok) {
      if (loading) loading.classList.add("is-hidden");
      handleResolveFailure(resolved);
      // Still not available (closing the sign-in form doesn't retry it) —
      // put the locked tile back so there's something to click again,
      // rather than leaving the stage with no visible content at all.
      if (!experienceIsAvailable(target)) showLockedPlaceholder(slot, target);
      return;
    }

    if (target.type === "treedis") mountTreedis(target, slot, loading);
    else if (target.type === "vimeo") mountVideo(target, slot, loading);
    else if (target.type === "gis") {
      const gisResolved = await resolveGisMapById(target.mapId);
      if (activeExperienceId !== target.id) return;
      if (!gisResolved.ok) {
        if (loading) loading.classList.add("is-hidden");
        handleResolveFailure(gisResolved);
        if (!experienceIsAvailable(target)) showLockedPlaceholder(slot, target);
        return;
      }
      mountGis(target, ex, slot, loading);
    }
  }

  /* Fullscreen the example's live experience pane.

     Fullscreening the STAGE (not the iframe) keeps the loading spinner
     and any future stage chrome visible, and leaves the overlay's own
     scroll position untouched underneath. Esc / the browser's exit
     control returns the reader to the exact same spot. */
  function enterExampleFullscreen() {
    const stage = $("#exampleStage");
    if (!stage) return;

    // Mount as a narrow centre slice + seam, matching the home page's
    // twin layer, then expand on the next frame so the clip-path
    // transition actually runs (a single rAF is too early).
    const playReveal = () => {
      stage.classList.add("is-revealing");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => stage.classList.add("is-revealed"))
      );
      // Drop the helper classes once the 1.15s clip has finished so the
      // stage returns to plain styling and nothing lingers clipped.
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        stage.classList.remove("is-revealing", "is-revealed");
      }, 1500);
      // Covers every entry path (real Fullscreen API, older-WebKit event,
      // and the CSS-only fallback below) — a GIS pane mounted at the old
      // stage size must re-measure once the fullscreen size is real.
      invalidateActiveGisSize();
    };

    const req = stage.requestFullscreen
      || stage.webkitRequestFullscreen
      || stage.msRequestFullscreen;

    if (req) {
      const p = req.call(stage);
      if (p && typeof p.then === "function") {
        // Start the reveal only once the browser is actually fullscreen,
        // otherwise the slice animates at the old pane size.
        p.then(playReveal).catch(() => {
          stage.classList.add("is-faux-fullscreen");
          playReveal();
        });
      } else {
        // Non-promise (older WebKit): fullscreenchange drives it instead.
        pendingReveal = playReveal;
      }
      return;
    }
    // iOS Safari on iPhone has no element fullscreen — CSS overlay.
    stage.classList.add("is-faux-fullscreen");
    playReveal();
  }

  let revealTimer = null;
  let pendingReveal = null;

  /* Older WebKit resolves fullscreen via event, not promise. */
  ["fullscreenchange", "webkitfullscreenchange"].forEach((evt) =>
    document.addEventListener(evt, () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl && pendingReveal) { pendingReveal(); pendingReveal = null; return; }
      // Exiting fullscreen: clear any leftover reveal state.
      if (!fsEl) {
        const stage = $("#exampleStage");
        if (stage) stage.classList.remove("is-revealing", "is-revealed");
        invalidateActiveGisSize();
      }
    })
  );

  /* Tap the exit pill to leave the CSS fallback. The pill is a
     pseudo-element, so hit-test the bottom strip of the stage. */
  document.addEventListener("click", (e) => {
    const stage = $("#exampleStage");
    if (!stage || !stage.classList.contains("is-faux-fullscreen")) return;
    const r = stage.getBoundingClientRect();
    if (e.clientY > r.bottom - 56) {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.remove("is-faux-fullscreen", "is-revealing", "is-revealed");
      invalidateActiveGisSize();
    }
  }, true);

  /* Leave the CSS fallback when the user presses Esc. */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const stage = $("#exampleStage");
    if (stage && stage.classList.contains("is-faux-fullscreen")) {
      e.stopPropagation();
      stage.classList.remove("is-faux-fullscreen", "is-revealing", "is-revealed");
      invalidateActiveGisSize();
    }
  }, true);

  /* Real project imagery when the example has a gallery;
     decorative placeholder mosaic otherwise. */
  function buildExampleGallery(ex) {
    const grid = $("#exMediaGrid");
    if (!grid) return;

    // CMS contract: 0-4 items. Anything beyond 4 is ignored rather than
    // breaking the grid; the layout is driven entirely by the real count.
    const shots = (ex.gallery || []).slice(0, 4);
    const n = shots.length;

    grid.innerHTML = "";
    grid.dataset.count = String(n);

    // No media yet — a labelled placeholder, not a decorative mosaic.
    if (!n) {
      grid.removeAttribute("aria-hidden");
      const empty = document.createElement("p");
      empty.className = "example-media-empty";
      empty.textContent = "Photos and video coming soon.";
      grid.appendChild(empty);
      return;
    }

    grid.removeAttribute("aria-hidden");
    shots.forEach((shot) => {
      // A gallery entry is a video when it carries a poster/embed pair or
      // an explicit type; otherwise it renders as a still image.
      const isVideo = shot.type === "video" || !!shot.embedUrl;
      if (isVideo) {
        const a = document.createElement("a");
        a.className = "example-tile example-tile-video";
        a.href = shot.watchUrl || shot.embedUrl || "#";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.setAttribute("aria-label", shot.alt || "Play video");
        if (shot.poster) {
          const img = document.createElement("img");
          img.className = "example-tile-photo";
          img.src = shot.poster;
          img.alt = shot.alt || "";
          img.loading = "lazy";
          a.appendChild(img);
        }
        const play = document.createElement("span");
        play.className = "example-tile-play";
        play.setAttribute("aria-hidden", "true");
        a.appendChild(play);
        grid.appendChild(a);
        return;
      }
      const img = document.createElement("img");
      img.className = "example-tile example-tile-photo";
      img.src = shot.src;
      img.alt = shot.alt || "";
      img.loading = "lazy";
      grid.appendChild(img);
    });
  }

  /* Related live experiences & videos for this project (link inventory). */
  function buildExampleLinks(ex) {
    const wrap = $("#exMediaLinks");
    if (!wrap) return;
    const links = ex.links || [];
    wrap.hidden = !links.length;
    wrap.innerHTML = "";
    if (!links.length) return;
    const label = document.createElement("span");
    label.className = "example-links-label";
    label.textContent = "More from this project";
    wrap.appendChild(label);
    const icon =
      '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    links.forEach((lk) => {
      // A link with its url already present is public (never stripped) —
      // a plain <a>, exactly as before. One WITHOUT a url was stripped
      // because it's gated (automotive/campus's treedis links are the
      // real case today) — render a locked tile that resolves-then-opens
      // on click instead of a raw href a guest could just read out of
      // the page source.
      if (lk.url) {
        const a = document.createElement("a");
        a.className = "example-link-chip";
        a.href = lk.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.innerHTML = icon + escapeHTML(lk.label || lk.url);
        wrap.appendChild(a);
        return;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "example-link-chip example-link-chip-locked";
      btn.innerHTML = icon + escapeHTML(lk.label || "Locked");
      btn.addEventListener("click", async () => {
        const resolved = await resolveExperienceNode(lk.id, lk);
        if (!resolved.ok) { handleResolveFailure(resolved); return; }
        window.open(lk.url, "_blank", "noopener");
      });
      wrap.appendChild(btn);
    });
  }

  function buildExampleEvidence(ex, preferredLabel) {
    const tabsWrap = $("#exEvidenceTabs");
    const body = $("#exEvidenceBody");
    tabsWrap.innerHTML = "";
    const ev = ex.evidence || {};
    const labels = cfg.evidence.filter((l) => ev[l] !== undefined);
    const start = (preferredLabel && ev[preferredLabel] !== undefined)
      ? preferredLabel : labels[0];

    function select(label) {
      $$("#exEvidenceTabs button").forEach((b) =>
        b.classList.toggle("is-active", b.dataset.label === label));
      body.textContent = ev[label] && ev[label] !== "\u2014"
        ? ev[label]
        : "No " + label.toLowerCase() + " published for this project yet.";
    }

    labels.forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.label = label;
      b.textContent = label;
      b.addEventListener("click", () => select(label));
      tabsWrap.appendChild(b);
    });
    if (start) select(start);
  }

  /* Close the project window and drop back to whatever's underneath.

     If the address bar is currently showing THIS project's entry, we
     step backwards through history rather than pushing a new one, so
     the ✕ button and the browser back button do the same thing —
     otherwise closing would leave a forward entry behind and pressing
     back would reopen the window the reader just dismissed.

     popstate then runs applyStateFromURL(), which performs the actual
     teardown, so this call returns early and lets that happen. The
     guard covers the cases where stepping back ISN'T right: a project
     opened directly via a deep link (nothing behind it in this
     session) or any state where the URL doesn't name this project. */
  function closeExample() {
    if (activeExampleId && !restoringFromHistory && canStepBackFromProject()) {
      history.back();
      return;
    }
    closeExampleNow();
  }

  /* True when the current history entry is this project's own entry AND
     there's somewhere in-session to step back to. history.length is a
     coarse signal (it counts the whole tab's history, not just ours),
     so we also track how many entries this app pushed itself. */
  function canStepBackFromProject() {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get("project") !== activeExampleId) return false;
      return pushDepth > 0;
    } catch (_e) {
      return false;
    }
  }

  function closeExampleNow() {
    const wasOpen = !!activeExampleId;
    const ov = $("#exampleOverlay");
    // Tear down every dedicated experience frame (one per experience id)
    // so a video doesn't keep playing behind the closed window, and the
    // next project opened starts from a clean slot.
    $$('[id^="exampleMediaFrame-"]').forEach((f) => f.remove());
    suspendActiveGis();   // parks the live map (cached, not destroyed) — see mountGis()
    const gisErr = document.getElementById("exGisError");
    if (gisErr) gisErr.remove();
    if (treedisIframe) parkIframe();
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
    activeExampleId = null;
    activeExperienceId = null;
    syncStageTabs([], null);
    closeShare();     // never leave the share popup open behind a closed window
    /* Reached either via popstate (restoringFromHistory — the URL is
       already correct, nothing to write) or by closing a deep-linked
       project with no in-session entry behind it. In that second case
       there's nothing to step back to, so replace the current entry
       with the bare category rather than pushing a new one — the
       reader shouldn't have to press back twice to leave. */
    if (wasOpen && !restoringFromHistory) syncURL(true);
  }

  /* ============================================================
     SHARE THIS PROJECT
     ------------------------------------------------------------
     The link is just the current URL. openExample() (via syncURL, see
     the URL STATE section above) already keeps the address bar in
     sync with whatever project window is open — including which
     category it belongs to — so there's nothing extra to build here.
     Loading that URL reconstructs the same state on the way in (see
     restoreInitialStateFromURL / applyStateFromURL above), so a
     shared link never just lands on the homepage or the live tour.
     ============================================================ */
  function exampleShareUrl() {
    return location.href;
  }

  function openShare() {
    if (!activeExampleId) return;
    const ex = cfg.examples && cfg.examples[activeExampleId];
    const name = (ex && ex.project && ex.project.name) || (ex && ex.title) || "Digital Twin Studios";
    const url = exampleShareUrl();
    const encUrl = encodeURIComponent(url);
    const text = encodeURIComponent(name + " — Digital Twin Studios");

    $("#shareLinkInput").value = url;
    $("#shareFacebook").href = "https://www.facebook.com/sharer/sharer.php?u=" + encUrl;
    $("#shareX").href = "https://twitter.com/intent/tweet?url=" + encUrl + "&text=" + text;
    $("#shareLinkedIn").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encUrl;
    $("#shareEmail").href = "mailto:?subject=" + text + "&body=" + encodeURIComponent(name + "\n\n" + url);

    const ov = $("#shareOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
  }

  function closeShare() {
    const ov = $("#shareOverlay");
    if (!ov) return;
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
  }

  /* ============================================================
     ACCESS YOUR TWIN  (Supabase Auth)
     ------------------------------------------------------------
     access.session shape once signed in:
       { user: {id, email}, accessToken, siteRole, orgs: [{id, slug, name, orgRole}] }
     Real resource access levels are enforced server-side by
     functions/api/resource/[key].js — this module's job is auth
     (sign in/out/restore) plus the resolve-then-open flow that
     calls that Function. See docs/migration/ACCESS-MODEL.md.
     ============================================================ */
  const access = { session: null, pendingResourceKey: null, resolvedGisMaps: new Set() };
  // Exposed by reference (same pattern as window.DTS_CONFIG/DTS_CONTENT) so
  // js/admin.js -- lazy-loaded via a separate <script> tag, sometimes well
  // after a session has already been restored -- can synchronously check
  // "is there already a site_admin session" the instant it finishes loading,
  // instead of only finding out via the dts:signed-in event below, which it
  // can easily lose the race to register a listener for in time to catch.
  window.DTS_ACCESS = access;
  const PENDING_RESOURCE_KEY_STORAGE = "dtsPendingResourceKey";
  // True for the whole duration of a LOCAL sign-in action (submitAccess(),
  // restoreSession()'s OAuth-return branch) that already calls
  // finishSignIn() itself -- suppresses the listener below so a
  // same-tab sign-in never gets handled twice.
  let localAuthInFlight = false;

  /* Supabase fires SIGNED_IN/SIGNED_OUT here for state changes this tab
     didn't directly cause itself -- most importantly, confirming a
     sign-up's email link in a SEPARATE tab. Without this, the original
     tab's sign-in form just sits there still showing the sign-up fields
     forever, with no way to know anything happened elsewhere (found in
     testing 2026-08-08: "the old page... the log in is not detected
     automatically"). supabase-js syncs sessions across tabs of the same
     origin via localStorage + a storage-event listener it sets up
     internally; this is what surfaces that sync to the UI. */
  window.DTS_SUPABASE.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { access.session = null; return; }
    if (event !== "SIGNED_IN" || !session || localAuthInFlight) return;
    if (access.session && access.session.user.id === session.user.id) return;
    finishSignIn(session);
  });

  /* Toggles the sign-in form between "Log In" and "Create Account" — same
     markup, same Supabase-backed submitAccess() handler underneath, just a
     different Auth call and a couple of swapped labels/fields. OAuth
     ("Continue with Google/Microsoft") isn't mode-dependent — Supabase
     creates the account on first OAuth sign-in either way, so those buttons
     stay visible in both modes. */
  function setAccessMode(mode) {
    access.mode = mode;
    const isSignup = mode === "signup";
    $("#accessError").hidden = true;
    $("#accessSuccessNote").hidden = true;
    $("#accessTitle").textContent = isSignup ? "Create Your Account" : "Welcome Back!";
    $("#accessConfirmField").hidden = !isSignup;
    $("#accessConfirm").required = isSignup;
    $("#accessCode").setAttribute("autocomplete", isSignup ? "new-password" : "current-password");
    $("#accessSubmit").textContent = isSignup ? "Create Account" : "Log In";
    $("#accessForgot").hidden = isSignup;
    $("#accessToggleLead").textContent = isSignup ? "Already have an account?" : "Don’t have an account?";
    $("#accessModeToggle").textContent = isSignup ? "Log In" : "Create one";
  }

  function openAccess() {
    $("#accessError").hidden = true;
    const ui = cfg.accessUi || {};
    $("#accessIntro").textContent = ui.intro || "";
    setAccessMode("login");

    // A signed-in client goes straight back to their portal; a signed-in
    // site_admin has no portal at all -- js/admin.js's floating chip
    // (already showing for an active site_admin session) is the way back
    // in, so this is a deliberate no-op for them rather than forcing the
    // wrong destination open.
    if (access.session) {
      if (access.session.siteRole !== "site_admin") openPortal(access.session);
      return;
    }
    $("#accessSignin").hidden = false;

    const ov = $("#accessOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    setTimeout(() => $("#accessId").focus(), 60);
  }

  function closeAccess() {
    const ov = $("#accessOverlay");
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
  }

  /* ============================================================
     RESOURCE RESOLUTION  (the actual gate)
     ------------------------------------------------------------
     The browser never decides access — it asks
     functions/api/resource/[key].js and gets back either the real
     target or 401/403. See ACCESS-MODEL.md §3-5.
     ============================================================ */
  async function fetchResource(resourceKey) {
    const headers = {};
    if (access.session && access.session.accessToken) {
      headers.Authorization = "Bearer " + access.session.accessToken;
    }
    let resp;
    try {
      resp = await fetch("/api/resource/" + encodeURIComponent(resourceKey), { headers });
    } catch (_) {
      return { ok: false, reason: "error", resourceKey };
    }
    if (resp.status === 401) return { ok: false, reason: "signin", resourceKey };
    if (resp.status === 403) return { ok: false, reason: "denied", resourceKey };
    if (!resp.ok) return { ok: false, reason: "error", resourceKey };
    const data = await resp.json();
    return { ok: true, data, resourceKey };
  }

  /* Resolves one experience/link node in place. If it already carries its
     real target (a public resource, never stripped from DTS_CONFIG), this
     makes ZERO network calls — the common case stays exactly as fast as
     before gating existed. */
  async function resolveExperienceNode(expId, node) {
    if (node.tourUrl || node.embedUrl || node.watchUrl || node.mapId || node.url) {
      return { ok: true };
    }
    const resourceKey = "project." + activeExampleId + ":" + expId;
    const result = await fetchResource(resourceKey);
    if (!result.ok) return result;
    Object.assign(node, result.data);
    return { ok: true };
  }

  /* Resolves a GIS map, populating cfg.gisMaps/cfg.gisTours/
     cfg.gisFeatureTours exactly the way buildConfig() populates them for
     a public map — mountGis()/toursForMap()/featureToursForMap() need
     zero changes because of that. */
  async function resolveGisMapById(mapId) {
    const existing = cfg.gisMaps && cfg.gisMaps[mapId];
    if (access.resolvedGisMaps.has(mapId) || (existing && existing.layers)) {
      return { ok: true };
    }
    const result = await fetchResource("gismap." + mapId);
    if (!result.ok) return result;

    cfg.gisMaps = cfg.gisMaps || {};
    cfg.gisTours = cfg.gisTours || {};
    cfg.gisFeatureTours = cfg.gisFeatureTours || {};
    cfg.gisMaps[mapId] = result.data.mapDoc;
    (result.data.tours || []).forEach((t) => { cfg.gisTours[t.id] = t; });
    (result.data.featureTours || []).forEach((ft) => { cfg.gisFeatureTours[ft.id] = ft; });
    access.resolvedGisMaps.add(mapId);
    return { ok: true };
  }

  /* Shared failure handling for a blocked resolve: 401 opens the sign-in
     form and remembers what was being asked for so a successful login
     re-opens it; 403 tells the guest to ask their DTS contact. */
  function handleResolveFailure(result) {
    if (result.reason === "signin") {
      access.pendingResourceKey = result.resourceKey;
      openAccess();
    } else if (result.reason === "denied") {
      window.alert("You don't have access to this resource yet. Ask your DTS contact for access.");
    } else {
      console.warn("[dts] resource resolution failed:", result.resourceKey);
    }
  }

  /* Re-opens whatever the guest originally asked for, now that they're
     signed in — used by submitAccess()'s destination-preservation path.
     Only project experiences are round-trippable this way today (a GIS
     map's own key isn't tied to a specific project window to reopen). */
  function openResourceByKey(resourceKey) {
    const m = /^project\.([^:]+):(.+)$/.exec(resourceKey);
    // resolveNow: the reader already clicked this exact experience once
    // (that's how it became "pending" in the first place) — reopening it
    // passively behind a locked placeholder would make login feel like it
    // didn't work.
    if (m) { openExample(m[1], null, m[2], { resolveNow: true }); return; }
    openPortal(access.session);
  }

  /* Shared tail for both password sign-in and a same-tab (no redirect)
     sign-up: rebuild access.session, notify admin.js's listener, then
     either resume exactly what the guest originally asked for or fall
     back to the portal — same destination-preservation submitAccess()
     always did, just factored out so signUp()'s success path can reuse
     it instead of duplicating it. */
  async function finishSignIn(session) {
    await buildSessionFromAuth(session);
    document.dispatchEvent(new CustomEvent("dts:signed-in",
      { detail: { session: access.session, restored: false } }));

    // A site_admin has no client portal and no gated experience to resume
    // into -- js/admin.js's own dts:signed-in listener owns their whole
    // destination (the Admin Board), never this function.
    if (access.session.siteRole === "site_admin") return;

    if (access.pendingResourceKey) {
      const key = access.pendingResourceKey;
      access.pendingResourceKey = null;
      closeAccess();
      openResourceByKey(key);
      return;
    }
    openPortal(access.session);
  }

  async function submitAccess(e) {
    e.preventDefault();
    $("#accessError").hidden = true;
    $("#accessSuccessNote").hidden = true;
    const btn = $("#accessSubmit");
    const label = btn.textContent;

    // Suppressed for the whole call (even the validation-error early
    // returns, harmlessly) so the onAuthStateChange listener never
    // double-handles a sign-in this function is already completing itself.
    localAuthInFlight = true;
    try {

    if (access.mode === "signup") {
      const email = $("#accessId").value.trim();
      const password = $("#accessCode").value;
      if (password !== $("#accessConfirm").value) {
        $("#accessError").textContent = "Passwords don’t match.";
        $("#accessError").hidden = false;
        return;
      }
      btn.disabled = true; btn.textContent = "Creating…";
      const { data, error } = await window.DTS_SUPABASE.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      btn.disabled = false; btn.textContent = label;

      if (error) {
        $("#accessError").textContent = error.message ||
          "We couldn't create that account. Try again, or contact the DTS team.";
        $("#accessError").hidden = false;
        return;
      }

      $("#accessCode").value = "";
      $("#accessConfirm").value = "";

      // Email confirmation is required (project setting) — signUp() never
      // returns a usable session in that case. Tell the reader to check
      // their inbox and drop them back on the login form for when they do.
      if (!data.session) {
        $("#accessSuccessNote").textContent =
          "Account created — check your email for a confirmation link, then log in.";
        $("#accessSuccessNote").hidden = false;
        setAccessMode("login");
        return;
      }

      // Confirmation disabled on this project — signed in immediately.
      await finishSignIn(data.session);
      return;
    }

    btn.disabled = true; btn.textContent = "Checking…";
    const { data, error } = await window.DTS_SUPABASE.auth.signInWithPassword({
      email: $("#accessId").value.trim(),
      password: $("#accessCode").value
    });
    btn.disabled = false; btn.textContent = label;

    if (error) {
      const ui = cfg.accessUi || {};
      $("#accessError").textContent = ui.error ||
        "We couldn't find a twin for that email and password. Check your welcome email, or contact the DTS team.";
      $("#accessError").hidden = false;
      return;
    }

    $("#accessCode").value = "";
    await finishSignIn(data.session);
    } finally {
      localAuthInFlight = false;
    }
  }

  /* Google/Microsoft sign-in. Supabase's OAuth flow is a full-page
     redirect away and back (accounts.google.com / login.microsoftonline.com
     -> Supabase's callback -> redirectTo), so any in-memory JS state —
     including access.pendingResourceKey — is gone by the time the reader
     lands back here. Persist what to do next in sessionStorage before
     navigating away; restoreSession() picks it up on the return trip (and
     ONLY then — an ordinary page load with an already-existing session must
     not auto-open the portal). First-time OAuth sign-in auto-creates the
     account (same profiles-row trigger as signUp()) — there's no separate
     "sign up with Google" action, the button works identically either way. */
  function signInWithOAuth(provider) {
    sessionStorage.setItem(PENDING_RESOURCE_KEY_STORAGE, access.pendingResourceKey || "portal");
    window.DTS_SUPABASE.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
  }

  /* Builds access.session from a live Supabase Auth session: the user's
     own site_role (profiles) and org memberships (organization_members
     joined to organizations) — both readable under RLS as "your own
     rows", no service role needed here. */
  async function buildSessionFromAuth(authSession) {
    if (!authSession) { access.session = null; return; }
    const sb = window.DTS_SUPABASE;
    const user = authSession.user;

    const [{ data: profile }, { data: memberships }] = await Promise.all([
      sb.from("profiles").select("site_role").eq("user_id", user.id).maybeSingle(),
      sb.from("organization_members")
        .select("org_id, org_role, organizations(slug, name)")
        .eq("user_id", user.id).eq("status", "active")
    ]);

    access.session = {
      user: { id: user.id, email: user.email },
      accessToken: authSession.access_token,
      siteRole: (profile && profile.site_role) || "user",
      orgs: (memberships || []).map((m) => ({
        id: m.org_id, slug: m.organizations.slug, name: m.organizations.name, orgRole: m.org_role
      }))
    };
  }

  /* On boot: restore an existing Supabase session (if any) so reload no
     longer signs clients out. Fire-and-forget from boot() — never blocks
     initial paint on a network round trip.

     Also the landing point for an OAuth return trip (supabase-js's
     detectSessionInUrl, on by default, has already turned the redirect's
     URL fragment into a real session by the time getSession() resolves
     here). Only THAT case should resume anything — an ordinary page load
     that simply already had a session must stay silent, or every reload
     would re-pop the portal on a signed-in visitor. The sessionStorage
     marker signInWithOAuth() sets right before navigating away is what
     tells the two apart. */
  async function restoreSession() {
    localAuthInFlight = true;
    try {
      const { data } = await window.DTS_SUPABASE.auth.getSession();
      if (!data || !data.session) return;
      await buildSessionFromAuth(data.session);
      document.dispatchEvent(new CustomEvent("dts:signed-in",
        { detail: { session: access.session, restored: true } }));

      const returnTo = sessionStorage.getItem(PENDING_RESOURCE_KEY_STORAGE);
      if (returnTo) sessionStorage.removeItem(PENDING_RESOURCE_KEY_STORAGE);
      // Same as finishSignIn(): a site_admin's destination is the Admin
      // Board, handled entirely by js/admin.js's own listener.
      if (access.session.siteRole === "site_admin") return;
      if (!returnTo) return;
      access.pendingResourceKey = null;
      if (returnTo === "portal") { openPortal(access.session); return; }
      openResourceByKey(returnTo);
    } finally {
      localAuthInFlight = false;
    }
  }

  function submitForgotPassword(email) {
    if (!email) return;
    // The UI message stays generic either way (don't leak whether an
    // email has an account) -- but log the real failure reason so a
    // silent delivery problem (rate limit, unwhitelisted redirect URL,
    // etc.) is actually diagnosable instead of just "no email arrived".
    window.DTS_SUPABASE.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    }).then(({ error }) => {
      if (error) console.warn("[dts] forgot-password request failed:", error.message);
    });
  }

  /* ============================================================
     CLIENT PORTAL  (post-login)
     ------------------------------------------------------------
     "All Apps" lists every resource the signed-in user can reach
     right now: every registered experience/link (any signed-in
     user), every client-level one (if they belong to an org), and
     every restricted one they hold a direct or org entitlement
     for. There's no server-side "list my resources" endpoint —
     access levels are public data (cfg.examples already has them
     for anything not yet resolved), so this scans cfg.examples and
     cross-references the user's own entitlements (readable
     client-side under RLS as "your own").
     ============================================================ */
  function resolveOwnAccess(ownAccess, projectAccess) {
    if (ownAccess && ownAccess !== "inherit") return ownAccess;
    if (projectAccess) return projectAccess;
    return "registered";
  }

  async function computeAccessibleResources(session) {
    const orgIds = session.orgs.map((o) => o.id);
    const restrictedKeys = new Set();
    if (session.siteRole !== "site_admin") {
      const sb = window.DTS_SUPABASE;
      const { data } = await sb.from("resource_entitlements").select("resource_key, subject_type, subject_id");
      (data || []).forEach((row) => {
        if (row.subject_type === "user" && row.subject_id === session.user.id) restrictedKeys.add(row.resource_key);
        if (row.subject_type === "org" && orgIds.indexOf(row.subject_id) !== -1) restrictedKeys.add(row.resource_key);
      });
    }

    const items = [];
    Object.keys(cfg.examples || {}).forEach((projectId) => {
      const ex = cfg.examples[projectId];
      const nodes = (Array.isArray(ex.experiences) && ex.experiences.length) ? ex.experiences : (ex.media ? [ex.media] : []);
      nodes.forEach((node) => {
        const level = resolveOwnAccess(node.access, ex.access);
        const resourceKey = "project." + projectId + ":" + (node.id || node._type);
        const reachable =
          level === "public" || level === "registered" ||
          (level === "client" && orgIds.length > 0) ||
          (level === "restricted" && (session.siteRole === "site_admin" || restrictedKeys.has(resourceKey)));
        if (reachable && level !== "public") {
          items.push({ projectId: projectId, expId: node.id || node._type, title: ex.title, label: node.label || ex.title, resourceKey: resourceKey });
        }
      });
    });
    return items;
  }

  async function openPortal(session) {
    closeAccess();
    $("#portalClientName").textContent = session.orgs.length ? session.orgs[0].name : session.user.email;

    const items = await computeAccessibleResources(session);

    /* HOME — the first accessible resource as the big tile plus
       shortcuts into the other portal views. */
    const tiles = $("#portalHomeTiles");
    tiles.innerHTML = "";
    if (items.length) {
      const primary = items[0];
      const big = document.createElement("button");
      big.type = "button";
      big.className = "portal-tile portal-tile-primary";
      big.innerHTML =
        '<span class="portal-tile-kicker">YOUR TWIN</span>' +
        '<span class="portal-tile-title">' + escapeHTML(primary.title) + '</span>' +
        '<span class="portal-tile-cta">Open the twin</span>';
      big.addEventListener("click", () => { closePortal(false); openExample(primary.projectId, null, primary.expId, { resolveNow: true }); });
      tiles.appendChild(big);
    }

    const apps = document.createElement("button");
    apps.type = "button";
    apps.className = "portal-tile portal-tile-small";
    apps.innerHTML =
      '<span class="portal-tile-title">All Apps</span>' +
      '<span class="portal-tile-sub">' + items.length +
      (items.length === 1 ? " app" : " apps") + '</span>';
    apps.addEventListener("click", () => showPortalView("apps"));
    tiles.appendChild(apps);

    const support = document.createElement("button");
    support.type = "button";
    support.className = "portal-tile portal-tile-small";
    support.innerHTML =
      '<span class="portal-tile-title">Support</span>' +
      '<span class="portal-tile-sub">We reply within a day</span>';
    support.addEventListener("click", () => showPortalView("support"));
    tiles.appendChild(support);

    /* Manage shortcut so all four portal sections are reachable
       from HOME. */
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "portal-tile portal-tile-small portal-tile-manage";
    manage.innerHTML =
      '<span class="portal-tile-title">Manage</span>' +
      '<span class="portal-tile-sub">Twin management with your DTS lead</span>';
    manage.addEventListener("click", () => showPortalView("manage"));
    tiles.appendChild(manage);

    /* ALL APPS — one card per accessible resource. */
    const list = $("#portalAppsList");
    list.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "portal-app";
      card.innerHTML =
        '<span class="portal-app-media">' +
          '<span class="portal-app-media-label">' + escapeHTML(item.title) + '</span>' +
          '<span class="portal-app-duration">Live twin</span>' +
        '</span>' +
        '<span class="portal-app-title">' + escapeHTML(item.label) + '</span>';
      card.addEventListener("click", () => { closePortal(false); openExample(item.projectId, null, item.expId, { resolveNow: true }); });
      list.appendChild(card);
    });

    renderOrgAdminPanel(session);

    showPortalView("home");
    closePortalMenu();
    const layer = $("#portalLayer");
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("portal-open");
  }

  function closePortal(clearSession) {
    const layer = $("#portalLayer");
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("portal-open");
    if (clearSession) access.session = null;
  }

  function showPortalView(name) {
    ["home", "apps", "manage", "support"].forEach((v) => {
      const el = $("#portal" + v[0].toUpperCase() + v.slice(1));
      if (el) {
        el.hidden = v !== name;
        el.classList.toggle("is-active", v === name);
      }
    });
    $$("#portalNav .portal-nav-link").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.portalView === name)
    );
    closePortalMenu();
  }

  function openPortalMenu() {
    $("#portalMenu").hidden = false;
    $("#portalMenuBtn").setAttribute("aria-expanded", "true");
    $("#portalLayer").classList.add("menu-open");
  }
  function closePortalMenu() {
    $("#portalMenu").hidden = true;
    $("#portalMenuBtn").setAttribute("aria-expanded", "false");
    $("#portalLayer").classList.remove("menu-open");
  }
  function togglePortalMenu() {
    if ($("#portalMenu").hidden) openPortalMenu();
    else closePortalMenu();
  }

  /* Minimal HTML escaper for user-provided strings. */
  function escapeHTML(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ============================================================
     ORG-ADMIN TEAM PANEL  (Phase 5b — client portal's Manage tab)
     ------------------------------------------------------------
     Separate from js/admin.js's Admin Board entirely — this is client-
     portal surface, scoped to the caller's own organization(s), reachable
     only by org_role "org_admin" (never site_admin's CMS). Every mutation
     calls functions/api/org/members.js or invite.js, which re-derive the
     caller's real org_admin status for the SPECIFIC org_id in the request
     server-side (never trusted from the client) — see ACCESS-MODEL.md §8.
     ============================================================ */
  function orgAdminFetch(path, opts) {
    opts = opts || {};
    const headers = {};
    if (access.session && access.session.accessToken) headers.Authorization = "Bearer " + access.session.accessToken;
    if (opts.body) headers["content-type"] = "application/json";
    return fetch(path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok, status: r.status, data })));
  }

  function renderOrgAdminPanel(session) {
    const box = $("#portalOrgAdmin");
    if (!box) return;
    const orgAdminOrgs = (session.orgs || []).filter((o) => o.orgRole === "org_admin");
    if (!orgAdminOrgs.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = "";
    orgAdminOrgs.forEach((org) => box.appendChild(orgAdminOrgPanel(org)));
  }

  function orgAdminOrgPanel(org) {
    const wrap = document.createElement("div");
    wrap.className = "portal-orgadmin-org";
    wrap.innerHTML =
      '<h3 class="portal-orgadmin-title">' + escapeHTML(org.name) + '</h3>' +
      '<p class="portal-orgadmin-status"></p>' +
      '<div class="portal-orgadmin-members"></div>' +
      '<div class="portal-orgadmin-form"></div>' +
      '<div class="portal-orgadmin-form"></div>' +
      '<div class="portal-orgadmin-entitlements"></div>';

    const statusEl = wrap.querySelector(".portal-orgadmin-status");
    const membersEl = wrap.querySelector(".portal-orgadmin-members");
    const forms = wrap.querySelectorAll(".portal-orgadmin-form");
    const addFormEl = forms[0];
    const inviteFormEl = forms[1];
    const entitlementsEl = wrap.querySelector(".portal-orgadmin-entitlements");

    function setStatus(text) { statusEl.textContent = text || ""; }

    function loadMembers() {
      membersEl.innerHTML = '<p class="portal-orgadmin-hint">Loading…</p>';
      orgAdminFetch("/api/org/members?org_id=" + org.id).then((res) => {
        if (!res.ok) { membersEl.innerHTML = '<p class="portal-orgadmin-hint">Couldn’t load members.</p>'; return; }
        membersEl.innerHTML = "";
        (res.data.members || []).forEach((m) => membersEl.appendChild(memberRow(m)));
      });
    }

    function memberRow(m) {
      const row = document.createElement("div");
      row.className = "portal-orgadmin-member";
      const label = document.createElement("span");
      label.textContent = m.email + " — " + m.orgRole;
      row.appendChild(label);

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button"; toggleBtn.className = "portal-orgadmin-btn";
      toggleBtn.textContent = m.orgRole === "org_admin" ? "Make member" : "Make org admin";
      toggleBtn.addEventListener("click", () => {
        setStatus("Saving…");
        orgAdminFetch("/api/org/members", {
          method: "PATCH",
          body: { orgId: org.id, userId: m.userId, orgRole: m.orgRole === "org_admin" ? "member" : "org_admin" },
        }).then((res) => {
          if (!res.ok) { setStatus(res.data.error || "Couldn’t update."); return; }
          setStatus(""); loadMembers();
        });
      });
      row.appendChild(toggleBtn);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button"; removeBtn.className = "portal-orgadmin-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        if (!window.confirm("Remove " + m.email + " from " + org.name + "?")) return;
        setStatus("Saving…");
        orgAdminFetch("/api/org/members?org_id=" + org.id + "&user_id=" + m.userId, { method: "DELETE" }).then((res) => {
          if (!res.ok) { setStatus(res.data.error || "Couldn’t remove."); return; }
          setStatus(""); loadMembers();
        });
      });
      row.appendChild(removeBtn);
      return row;
    }

    // Add an existing account by email.
    addFormEl.innerHTML = '<p class="portal-orgadmin-label">Add an existing teammate</p>';
    const addEmail = document.createElement("input");
    addEmail.type = "email"; addEmail.placeholder = "Their email"; addEmail.className = "portal-orgadmin-input";
    const addBtn = document.createElement("button");
    addBtn.type = "button"; addBtn.className = "portal-orgadmin-btn"; addBtn.textContent = "+ Add";
    addBtn.addEventListener("click", () => {
      const email = addEmail.value.trim();
      if (!email) return;
      setStatus("Adding…");
      orgAdminFetch("/api/org/members", { method: "POST", body: { orgId: org.id, email, orgRole: "member" } }).then((res) => {
        if (!res.ok) { setStatus(res.data.error || "Couldn’t add."); return; }
        addEmail.value = ""; setStatus(""); loadMembers();
      });
    });
    addFormEl.appendChild(addEmail); addFormEl.appendChild(addBtn);

    // Invite a brand-new account (dev: sets the password directly -- no
    // working invite-email delivery until custom SMTP is configured).
    inviteFormEl.innerHTML = '<p class="portal-orgadmin-label">Invite someone new</p>';
    const inviteEmail = document.createElement("input");
    inviteEmail.type = "email"; inviteEmail.placeholder = "New teammate’s email"; inviteEmail.className = "portal-orgadmin-input";
    const invitePassword = document.createElement("input");
    invitePassword.type = "text"; invitePassword.placeholder = "Temporary password (8+ characters)"; invitePassword.className = "portal-orgadmin-input";
    const inviteBtn = document.createElement("button");
    inviteBtn.type = "button"; inviteBtn.className = "portal-orgadmin-btn"; inviteBtn.textContent = "+ Invite";
    inviteBtn.addEventListener("click", () => {
      const email = inviteEmail.value.trim(), password = invitePassword.value;
      if (!email || password.length < 8) { setStatus("A valid email and an 8+ character password are both required."); return; }
      setStatus("Inviting…");
      orgAdminFetch("/api/org/invite", { method: "POST", body: { orgId: org.id, email, password, orgRole: "member" } }).then((res) => {
        if (!res.ok) { setStatus(res.data.error || "Couldn’t invite."); return; }
        inviteEmail.value = ""; invitePassword.value = ""; setStatus(""); loadMembers();
      });
    });
    inviteFormEl.appendChild(inviteEmail); inviteFormEl.appendChild(invitePassword); inviteFormEl.appendChild(inviteBtn);

    // Read-only: resources entitled to this org. A direct client-side
    // Supabase read, not a Function call -- resource_entitlements' own RLS
    // policy already allows "the entitled subject, or a member of the
    // entitled org" to SELECT it, exactly the scope needed here, so there
    // is nothing a server-side re-check would add for a read.
    async function loadEntitlements() {
      entitlementsEl.innerHTML = '<p class="portal-orgadmin-hint">Loading…</p>';
      const { data, error } = await window.DTS_SUPABASE
        .from("resource_entitlements")
        .select("resource_key, created_at")
        .eq("subject_type", "org")
        .eq("subject_id", org.id);
      if (error) { entitlementsEl.innerHTML = '<p class="portal-orgadmin-hint">Couldn’t load entitlements.</p>'; return; }
      entitlementsEl.innerHTML = '<p class="portal-orgadmin-label">Resources entitled to ' + escapeHTML(org.name) + '</p>';
      if (!data.length) {
        const p = document.createElement("p"); p.className = "portal-orgadmin-hint"; p.textContent = "None yet.";
        entitlementsEl.appendChild(p);
        return;
      }
      data.forEach((row) => {
        const p = document.createElement("p"); p.className = "portal-orgadmin-hint"; p.textContent = row.resource_key;
        entitlementsEl.appendChild(p);
      });
    }

    loadMembers();
    loadEntitlements();
    return wrap;
  }

  function signOut() {
    closePortal(true);
    $("#accessSignin").hidden = false;
    $("#accessId").value = "";
    $("#accessCode").value = "";
    $("#accessError").hidden = true;
    // A full reload, not just clearing access.session, is the only
    // reliable way to actually revoke access client-side: every
    // experience resolved this session had its real target written
    // straight into the shared cfg node (resolveExperienceNode()'s
    // Object.assign), and the GIS map/tour cache has no clean "undo" —
    // without reloading, previously-viewed gated content stayed openable
    // after sign-out with no server round trip to catch it (found in
    // testing 2026-08-08).
    window.DTS_SUPABASE.auth.signOut().finally(() => {
      window.location.reload();
    });
  }

  /* ============================================================
     QUESTION BAR  →  inline FAQ answers
     ============================================================ */
  function answerQuestion(text) {
    const q = (text || "").trim().toLowerCase();
    if (!q) return;
    const hit = (cfg.answers || []).find((entry) =>
      entry.match.some((m) => q.indexOf(m.toLowerCase()) !== -1)
    );
    const panel = $("#qbarAnswer");
    if (hit) {
      $("#qbarAnswerQ").textContent = hit.q;
      $("#qbarAnswerA").textContent = hit.a;
    } else {
      $("#qbarAnswerQ").textContent = "Thanks — we'll get you an answer.";
      $("#qbarAnswerA").textContent =
        "That one's not in our quick answers yet. Use Contact & Info (or ACCESS YOUR TWIN) and the DTS team will follow up directly.";
    }
    panel.hidden = false;
  }
  function closeAnswer() { $("#qbarAnswer").hidden = true; }

  /* ============================================================
     SECTOR PROJECTS WINDOW
     Opened by "VIEW {SECTOR} PROJECTS": a full-screen sheet with
     one card per sub-vertical project. Tapping a card opens that
     project's example window.
     ============================================================ */
  function openProjects() {
    const c = getCategory(state.category);
    $("#projectsTitle").textContent = c.kicker + " BASED PROJECTS";

    const list = $("#projectsList");
    list.innerHTML = "";
    c.cards.forEach((card) => {
      const ex = (cfg.examples || {})[card.id];
      const proj = ex && ex.project;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "project-card";
      el.innerHTML =
        '<span class="project-card-media">' +
          '<span class="project-card-name">' +
            escapeHTML(proj ? proj.name : card.title) + '</span>' +
          (proj ? '<span class="project-card-blurb">' + escapeHTML(proj.blurb) + '</span>' : '') +
        '</span>' +
        '<span class="project-card-chips">' +
          '<span class="project-chip-label">Captured with:</span>' +
          '<span class="project-chip">Matterport Pro2</span>' +
          '<span class="project-chip-label">Platform:</span>' +
          '<span class="project-chip">Treedis</span>' +
        '</span>';
      el.addEventListener("click", () => {
        closeProjects();
        openExample(card.id);
      });
      list.appendChild(el);
    });

    const ov = $("#projectsOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    setTimeout(() => $("#projectsClose").focus(), 60);
  }

  function closeProjects() {
    const ov = $("#projectsOverlay");
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
  }

  /* ============================================================
     CONTACT PANEL (inline slide — no overlay)
     ============================================================ */
  function buildContact() {
    const c = cfg.contact;
    $("#contactKicker").textContent   = c.kicker;
    $("#contactHeadline").textContent = c.headline;
    $("#contactAccent").textContent   = c.headlineAccent;
    $("#contactBody").textContent     = c.body;
    $("#contactFoot").textContent     = c.footnote;

    /* Each CTA is a centred step: its stage label (PLAN / PROPOSE /
       PILOT) above the button, with a decorative connector line.
       The separate stages row is unused and stays hidden. */
    const stages = $("#contactStages");
    stages.innerHTML = "";
    stages.hidden = true;

    const wrap = $("#contactCtas");
    wrap.innerHTML = "";
    c.ctas.forEach((cta) => {
      const step = document.createElement("div");
      step.className = "contact-step" + (cta.primary ? " is-primary" : "");

      const label = document.createElement("span");
      label.className = "contact-step-label";
      label.textContent = cta.stage;

      const b = document.createElement("button");
      b.className = "contact-cta" + (cta.primary ? " is-primary" : "");
      b.type = "button";
      b.textContent = cta.label;
      b.addEventListener("click", () => openLeadForm(cta.id, cta.stage));

      const line = document.createElement("span");
      line.className = "contact-step-line";
      line.setAttribute("aria-hidden", "true");

      step.appendChild(label);
      step.appendChild(b);
      step.appendChild(line);
      wrap.appendChild(step);
    });
  }

  /* ============================================================
     LEAD FORM  →  emails the owner (Web3Forms, mailto fallback)
     ============================================================ */
  let activeFormId = null;

  function openLeadForm(formId, stage) {
    const def = cfg.lead && cfg.lead.forms && cfg.lead.forms[formId];
    if (!def) { console.warn("[lead] no form def for", formId); return; }
    activeFormId = formId;

    // Reset to the form view (in case it was left on success).
    $("#formView").hidden = false;
    $("#formSuccess").hidden = true;
    document.querySelector("#formOverlay .form-window").classList.remove("is-success");
    $("#formError").hidden = true;

    $("#formStage").textContent = stage || "";
    $("#formTitle").textContent = def.title;
    $("#formIntro").textContent = def.intro || "";
    $("#formSubmit").textContent = def.submitLabel || "Send";

    buildFormFields(def.fields);
    // Gate submission on Turnstile actually completing -- without this, a
    // user who submits before the async verification finishes (or a
    // managed-mode checkbox they haven't clicked yet) gets silently bounced
    // to mailto with no explanation, which is what real testing caught:
    // the button looked clickable, wasn't actually ready, and the server
    // correctly rejected the missing token every time.
    $("#formSubmit").disabled = true;
    ensureTurnstileRendered();

    const ov = $("#formOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    // Focus the first field for quick entry.
    const first = $("#formFields input, #formFields select, #formFields textarea");
    if (first) setTimeout(() => first.focus(), 60);
  }

  function closeLeadForm() {
    const ov = $("#formOverlay");
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
  }

  function buildFormFields(fields) {
    const wrap = $("#formFields");
    wrap.innerHTML = "";
    fields.forEach((f) => {
      const cell = document.createElement("div");
      /* Short fields pair two-up; textareas span the full row.
         `half: true` in config opts a field into the pair layout. */
      const full = f.type === "textarea" || !f.half;
      cell.className = "form-field" + (full ? " full" : "");
      cell.dataset.name = f.name;

      const id = "lf_" + f.name;
      const reqMark = f.required ? ' <span class="req">*</span>' : "";
      const optMark = f.optional ? ' <span class="opt">(optional)</span>' : "";
      const ph = f.placeholder
        ? ' placeholder="' + f.placeholder.replace(/"/g, "&quot;") + '"'
        : "";
      let control;
      if (f.type === "textarea") {
        control = '<textarea id="' + id + '" name="' + f.name + '"' + ph +
          (f.required ? " required" : "") + '></textarea>';
      } else if (f.type === "select") {
        control = '<select id="' + id + '" name="' + f.name + '"' +
          (f.required ? " required" : "") + '>' +
          '<option value="" disabled selected>Choose…</option>' +
          (f.options || []).map((o) =>
            '<option value="' + o.replace(/"/g, "&quot;") + '">' + o + '</option>'
          ).join("") +
          '</select>';
      } else {
        control = '<input id="' + id + '" name="' + f.name +
          '" type="' + (f.type || "text") + '"' + ph +
          (f.required ? " required" : "") + ' />';
      }
      cell.innerHTML =
        '<label for="' + id + '">' + f.label + reqMark + optMark + '</label>' + control;
      wrap.appendChild(cell);
    });
  }

  /* Validate required fields; mark invalid cells. Returns true if OK. */
  function validateForm() {
    let ok = true;
    $$("#formFields .form-field").forEach((cell) => {
      const ctrl = cell.querySelector("input,select,textarea");
      cell.classList.remove("invalid");
      if (ctrl && ctrl.required && !ctrl.value.trim()) {
        cell.classList.add("invalid");
        ok = false;
      }
      if (ctrl && ctrl.type === "email" && ctrl.value.trim() &&
          !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ctrl.value.trim())) {
        cell.classList.add("invalid");
        ok = false;
      }
    });
    return ok;
  }

  /* Collect field values into a flat object, plus context. */
  function collectFormData() {
    const data = {};
    $$("#formFields input, #formFields select, #formFields textarea").forEach((c) => {
      data[c.name] = c.value.trim();
    });
    // Auto-attach the sector the user was browsing + which form this is.
    const cat = getCategory(state.category);
    data.sector = cat ? cat.label : "";
    data.request_type = activeFormId;
    return data;
  }

  async function submitLeadForm(e) {
    e.preventDefault();
    $("#formError").hidden = true;
    if (!validateForm()) {
      $("#formError").textContent = "Please complete the required fields.";
      $("#formError").hidden = false;
      return;
    }

    const data = collectFormData();
    const def = cfg.lead.forms[activeFormId];
    const submitBtn = $("#formSubmit");
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const sent = await sendLead(data, def);

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (sent) {
      showFormSuccess();
    } else {
      // Network/key failure → fall back to the user's mail app.
      openMailtoFallback(data, def);
    }
  }

  /* Phase 7 (simplified after real-world testing): Web3Forms documents
     its access key as public/safe for client-side use -- their own abuse
     protection (rate limiting, etc.) lives on their end, confirmed live
     during testing. A server-side proxy Function added real complexity
     (an extra secret to manage, Cloudflare-Worker-to-Web3Forms fetch
     behavior differing from a real browser's) for security the key
     itself doesn't actually need per Web3Forms's own design. Reverted to
     calling Web3Forms directly; Turnstile stays as a client-side gate on
     the submit button (see below) without a server verification round
     trip. No key → mailto fallback, same as the original pre-Phase-7
     design. Returns true on a confirmed send. */
  async function sendLead(data, def) {
    const lead = cfg.lead || {};
    if (!lead.accessKey) return false;   // no key → use mailto fallback

    const payload = Object.assign({}, data, {
      access_key: lead.accessKey,
      subject: (lead.subjectPrefix || "DTS Lead") + " — " + (def.title || ""),
      from_name: data.name || "DTS Website",
      to: lead.ownerEmail || undefined
    });

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      return res.ok && json.success !== false;
    } catch (err) {
      console.warn("[lead] Web3Forms send failed, using mailto:", err);
      return false;
    }
  }

  /* ---------- Turnstile (client-side bot gate) ----------
     Explicit render (not the auto-render markup) so the SAME widget
     instance can be reset between opens of this one shared #leadForm --
     an expired/stale token from a previous open must never silently ride
     along on a later submit. Rendered once; reset (not re-rendered) on
     every subsequent open.

     Client-side only: the submit button stays disabled until Turnstile
     confirms, but nothing server-side re-verifies the token (see
     sendLead() above) -- a deliberate simplification, not an oversight.
     If Turnstile never becomes ready at all (script blocked, network
     issue), the bounded retry below still re-enables the button after
     ~3s rather than trapping the user. */
  let turnstileWidgetId = null;

  function setSubmitReady(ready) {
    const btn = $("#formSubmit");
    if (btn) btn.disabled = !ready;
  }

  function ensureTurnstileRendered(attempt) {
    attempt = attempt || 0;
    if (!window.turnstile) {
      if (attempt < 20) { setTimeout(() => ensureTurnstileRendered(attempt + 1), 150); return; }
      // Bounded retry exhausted (~3s) -- let the user submit anyway rather
      // than trap them (script blocked/network issue, not the user's fault).
      setSubmitReady(true);
      return;
    }
    if (turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      return;
    }
    const container = $("#turnstileWidget");
    if (!container || !window.DTS_TURNSTILE_SITE_KEY) { setSubmitReady(true); return; }
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: window.DTS_TURNSTILE_SITE_KEY,
      callback: () => setSubmitReady(true),
      "expired-callback": () => setSubmitReady(false),
      "error-callback": () => setSubmitReady(true)
    });
  }

  /* mailto: fallback — opens the user's mail app pre-filled with all
     answers, addressed to the owner. Works with zero setup. */
  function openMailtoFallback(data, def) {
    const owner = (cfg.lead && cfg.lead.ownerEmail) || "";
    const subject = (cfg.lead.subjectPrefix || "DTS Lead") + " — " + (def.title || "");
    const lines = Object.keys(data).map((k) => {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      return label + ": " + data[k];
    });
    const body = "New " + (def.title || "lead") + " request from the DTS website:\n\n" +
      lines.join("\n");
    const href = "mailto:" + encodeURIComponent(owner) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    window.location.href = href;
    // Show success too — from the user's perspective the message is on its way.
    showFormSuccess(true);
  }

  function showFormSuccess(viaMail) {
    /* "REQUEST SENT" success toast. */
    $("#formView").hidden = true;
    $("#formSuccess").hidden = false;
    document.querySelector("#formOverlay .form-window").classList.add("is-success");
    $("#formSuccessBody").innerHTML = viaMail
      ? "Your email is ready to send in your mail app — hit send and the DTS team will be in touch."
      : "We appreciate that you’ve taken the time to write to us.<br>We’ll get back to you as soon as we can.";
    setTimeout(() => $("#formSuccessClose").focus(), 60);
  }

  /* Slide the category track to reveal the inline contact panel. */
  function slideToContact() {
    state.contactOpen = true;
    $("#catTrack").classList.add("show-contact");
    updateNextLabel();
    syncContactBar();
  }

  /* Slide back to the current sector's cards. */
  function slideToCards() {
    state.contactOpen = false;
    $("#catTrack").classList.remove("show-contact");
    syncContactBar();
  }

  /* The mobile contact bar doubles as a toggle: it reads "Contact & Info →"
     on the cards panel and "← Back to sector" on the contact panel. */
  function syncContactBar() {
    const bar = $("#contactBar");
    const lbl = $("#contactBarLabel");
    if (!bar || !lbl) return;
    if (state.contactOpen) {
      bar.classList.add("is-back");
      lbl.textContent = "Back to sector";
    } else {
      bar.classList.remove("is-back");
      lbl.textContent = "Contact & Info";
    }
  }

  /* Index helpers for sector sequencing. */
  function currentCatIndex() {
    return cfg.categories.findIndex((c) => c.id === state.category);
  }
  function nextCategory() {
    const i = currentCatIndex();
    return cfg.categories[(i + 1) % cfg.categories.length];
  }

  /* Update the "Next" arrow's label to name the next sector. */
  function updateNextLabel() {
    const lbl = $("#contactNextLabel");
    if (lbl) lbl.textContent = nextCategory().label;
  }

  /* Next arrow: advance the whole category to the next sector's CARDS
     view. openCategory() snaps the slider back to cards and syncs the
     top-nav highlight (Education → Industry → …). */
  function advanceToNextSector() {
    openCategory(nextCategory().id);
  }

  /* ============================================================
     QUESTION BAR  (placeholder interaction)
     ============================================================ */
  let promptIdx = 0;
  function cyclePrompt() {
    const input = $("#qbarInput");
    if (document.activeElement === input || input.value) return;
    input.placeholder = '"' + cfg.questionPrompts[promptIdx] + '"';
    promptIdx = (promptIdx + 1) % cfg.questionPrompts.length;
  }
  function flashQuestion(text) {
    const input = $("#qbarInput");
    input.value = text;
    input.focus();
  }

  /* ============================================================
     COOKIE DISCLOSURE
     ============================================================ */
  function dismissCookie() { $("#cookie").classList.add("is-hidden"); }

  /* ============================================================
     ANIMATED SPATIAL BACKGROUND  (subtle network of points)
     ============================================================ */
  function initBackground() {
    const canvas = $("#bgNet");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;                 // headless / unsupported — skip decor
    let w, h, pts, raf;

    function resize() {
      w = canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
      const count = Math.min(70, Math.floor((w * h) / 38000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      // links
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          const max = 150 * devicePixelRatio;
          if (d < max) {
            ctx.strokeStyle = "rgba(214,168,73," + (0.10 * (1 - d / max)) + ")";
            ctx.lineWidth = devicePixelRatio * 0.6;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      // nodes
      for (const p of pts) {
        ctx.fillStyle = "rgba(150,180,210,0.45)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, devicePixelRatio * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener("resize", () => { cancelAnimationFrame(raf); resize(); tick(); });
  }

  /* ============================================================
     WIRING
     ============================================================ */
  function wire() {
    // Mobile drawer
    $("#burger").addEventListener("click", toggleDrawer);
    $("#navScrim").addEventListener("click", closeDrawer);

    // Twin experience: the CTA starts the centre-out reveal; the
    // exit pill (top-left, once open) reverses it back to the hero.
    $("#twinTry").addEventListener("click", openExperience);
    $("#twinExit").addEventListener("click", closeExperience);

    // Glass hero card: minimize to the small DTS chip and restore.
    $("#twinCardMin").addEventListener("click", minimizeHeroCard);
    $("#twinCardRestore").addEventListener("click", showHeroCard);

    // Example window
    $("#exampleClose").addEventListener("click", closeExample);
    $$("[data-close-example]").forEach((s) => s.addEventListener("click", closeExample));
    // Experience tab strip — delegated (syncStageTabs() rebuilds the
    // buttons on every switch, so listeners live on the wrapper instead
    // of the buttons themselves). Tab switching replaces the current
    // history entry rather than pushing — the back stack shouldn't grow
    // just because the reader looked at a different tab.
    const exStageTabs = $("#exStageTabs");
    exStageTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".example-stage-tab");
      if (!btn) return;
      const ex = cfg.examples && cfg.examples[activeExampleId];
      if (!ex) return;
      showExperience(ex, btn.dataset.expId);
      syncURL(true);
    });
    exStageTabs.addEventListener("keydown", (e) => {
      const tabs = $$(".example-stage-tab", exStageTabs);
      if (!tabs.length) return;
      const i = tabs.indexOf(document.activeElement);
      let next = -1;
      if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (i >= 0) tabs[i].click();
        return;
      } else return;
      e.preventDefault();
      tabs.forEach((t, idx) => { t.tabIndex = idx === next ? 0 : -1; });
      tabs[next].focus();
    });
    // "Enter Twin" — if the active example has its own experience,
    // open it in a new tab; otherwise open the shared showcase.
    $("#exEnter").addEventListener("click", async () => {
      // A gated experience isn't resolved until this explicit click (see
      // showExperience()'s resolveNow gate) — resolve it now, which opens
      // the sign-in form on a 401 instead of fullscreening a blank pane.
      const ex = cfg.examples && cfg.examples[activeExampleId];
      const target = ex && (ex.experiences || []).find((e) => e.id === activeExperienceId);
      if (target && !experienceIsAvailable(target)) {
        await showExperience(ex, activeExperienceId, { resolveNow: true });
        if (!experienceIsAvailable(target)) return;
      }
      // Fullscreen the live experience pane in place. The project window
      // stays open behind it and keeps its scroll position, so exiting
      // fullscreen returns the reader exactly where they were.
      enterExampleFullscreen();
    });
    // A live GIS pane must re-measure on every plain window resize too,
    // not just fullscreen enter/exit (04-SPEC §9).
    window.addEventListener("resize", invalidateActiveGisSize);
    // "Contact Us about this" routes into the proposal lead form.
    $("#exContact").addEventListener("click", () => {
      closeExample();
      const proposal = (cfg.contact.ctas || []).find((c) => c.id === "proposal")
        || cfg.contact.ctas[0];
      if (proposal) openLeadForm(proposal.id, proposal.stage);
    });
    // Share this project window
    $("#exShare").addEventListener("click", openShare);
    $("#shareClose").addEventListener("click", closeShare);
    $$("[data-close-share]").forEach((s) => s.addEventListener("click", closeShare));
    $("#shareCopyBtn").addEventListener("click", () => {
      const input = $("#shareLinkInput");
      const btn = $("#shareCopyBtn");
      const showCopied = () => {
        const original = "Copy";
        btn.textContent = "Copied!";
        btn.classList.add("is-copied");
        clearTimeout(btn._copyTimer);
        btn._copyTimer = setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove("is-copied");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(showCopied).catch(() => {
          input.select();
          document.execCommand("copy");
          showCopied();
        });
      } else {
        input.select();
        document.execCommand("copy");
        showCopied();
      }
    });

    // Back-to-top FAB inside the window.
    const exFab = $("#exampleFab");
    if (exFab) exFab.addEventListener("click", () => {
      // The example window is the scroll container on desktop; on phones
      // the inner content pane still scrolls. Scroll whichever applies.
      const win = document.querySelector("#exampleOverlay .example-window");
      const pane = $("#exampleContent");
      const target = win && win.scrollHeight > win.clientHeight ? win : pane;
      if (target) target.scrollTo({ top: 0, behavior: "smooth" });
    });
    // Desktop portal nav links.
    $$("#portalNav .portal-nav-link").forEach((b) =>
      b.addEventListener("click", () => showPortalView(b.dataset.portalView))
    );

    // Lead form modal
    $("#leadForm").addEventListener("submit", submitLeadForm);
    $("#formClose").addEventListener("click", closeLeadForm);
    $("#formSuccessClose").addEventListener("click", closeLeadForm);
    $$("[data-close-form]").forEach((s) =>
      s.addEventListener("click", closeLeadForm)
    );

    // Access Your Twin (returning-client portal)
    $("#accessForm").addEventListener("submit", submitAccess);
    $("#accessClose").addEventListener("click", closeAccess);
    $$("[data-close-access]").forEach((s) => s.addEventListener("click", closeAccess));

    // Contact slide controls (inline — no overlay)
    $("#contactEdge").addEventListener("click", slideToContact);
    $("#contactBack").addEventListener("click", slideToCards);
    $("#contactNext").addEventListener("click", advanceToNextSector);
    // "VIEW {SECTOR} PROJECTS" opens the sector projects window.
    $("#catProjectsBtn").addEventListener("click", openProjects);
    $("#projectsClose").addEventListener("click", closeProjects);
    $$("[data-close-projects]").forEach((s) => s.addEventListener("click", closeProjects));

    // Client portal (post-login)
    $("#portalMenuBtn").addEventListener("click", togglePortalMenu);
    $("#portalSignout").addEventListener("click", signOut);
    $("#portalClose").addEventListener("click", () => closePortal(false));
    $$("#portalMenu .portal-menu-tile").forEach((t) =>
      t.addEventListener("click", () => showPortalView(t.dataset.portalView))
    );
    // Tapping the dimmed area below the tiles closes the portal menu.
    $("#portalMenu").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closePortalMenu();
    });

    // Sign-in extras
    $("#accessForgot").addEventListener("click", () => {
      const email = $("#accessId").value.trim();
      const err = $("#accessError");
      if (!email) {
        err.textContent = "Enter your email above first, then tap Forgot password? again.";
        err.hidden = false;
        $("#accessId").focus();
        return;
      }
      submitForgotPassword(email);
      err.textContent = "If that email has an account, a reset link is on its way.";
      err.hidden = false;
    });
    $("#accessContact").addEventListener("click", () => {
      closeAccess();
      const discovery = (cfg.contact.ctas || []).find((c) => c.id === "discovery")
        || cfg.contact.ctas[0];
      if (discovery) openLeadForm(discovery.id, discovery.stage);
    });
    $("#accessModeToggle").addEventListener("click", () => {
      setAccessMode(access.mode === "signup" ? "login" : "signup");
      setTimeout(() => $("#accessId").focus(), 30);
    });
    $("#accessGoogle").addEventListener("click", () => signInWithOAuth("google"));
    $("#accessMicrosoft").addEventListener("click", () => signInWithOAuth("azure"));

    // Mobile slide-to-contact bar toggles cards ⇄ contact.
    $("#contactBar").addEventListener("click", () => {
      if (state.contactOpen) slideToCards();
      else slideToContact();
    });
    // Top-right button opens the returning-client sign-in.
    $("#accessTwin").addEventListener("click", openAccess);


    // Escape: close whatever modal is open, or slide contact back to cards.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$("#portalMenu").hidden) { closePortalMenu(); return; }
        if ($("#portalLayer").classList.contains("is-open")) { closePortal(false); return; }
        if ($("#shareOverlay").classList.contains("is-open")) { closeShare(); return; }
        if ($("#projectsOverlay").classList.contains("is-open")) { closeProjects(); return; }
        if ($("#exampleOverlay").classList.contains("is-open")) { closeExample(); return; }
        if ($("#accessOverlay").classList.contains("is-open"))  { closeAccess();  return; }
        if (state.twinOpen) { closeExperience(); return; }
        closeLeadForm();
        closeAnswer();
        if (state.contactOpen) slideToCards();
      }
    });

    // Brand returns home
    $("#brandHome").addEventListener("click", (e) => { e.preventDefault(); goHome(); });

    // Question bar — answer the FAQ inline.
    $("#qbar").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#qbarInput").value.trim();
      if (!v) return;
      answerQuestion(v);
      $("#qbarInput").value = "";
      $("#qbarInput").blur();
    });
    $("#qbarAnswerClose").addEventListener("click", closeAnswer);

    // Cookie
    $("#cookieAccept").addEventListener("click", dismissCookie);
    $("#cookieReject").addEventListener("click", dismissCookie);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  /* The Vision Pro spatial-website CTA is a Safari feature, so it's
     shown only in real Safari. Other browsers (including iOS shells)
     add extra UA tokens alongside "Safari"; requiring Safari without
     those identifies genuine Safari on macOS, iOS/iPadOS, visionOS. */
  function detectSafari() {
    const ua = navigator.userAgent || "";
    const isSafari = /Safari\//.test(ua) &&
      !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|OPR\/|OPiOS|Android|SamsungBrowser/.test(ua);
    document.body.classList.toggle("is-safari", isSafari);
  }

  function boot() {
    detectSafari();
    buildPillars();
    buildDrawer();
    buildSectorPager();
    buildContact();
    restoreInitialStateFromURL();  // home / ?category=… / ?category=…&project=… → matching state; URL normalized via replaceState
    wire();
    initSwipe();
    initBackground();
    startTreedis();              // embed the live experience right away
    restoreSession();            // fire-and-forget — never blocks initial paint
    cyclePrompt();
    setInterval(cyclePrompt, 3200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
