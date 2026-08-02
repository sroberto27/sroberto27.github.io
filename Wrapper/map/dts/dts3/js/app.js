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
  let gisInstances = {};           // mapId → live GIS viewer instance (wired in a later phase)

  function openExample(cardId, evidenceLabel, expId) {
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
    showExperience(ex, expId);

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

  /* Placeholder until the GIS engine lands (a later phase wires the real
     map here via DTSGis.mount()) — keeps a "gis" experience from ever
     rendering a blank pane or throwing if one becomes active early. */
  function mountGis(target, ex, slot, loading) {
    if (loading) loading.classList.add("is-hidden");
    let el = document.getElementById("exGisPlaceholder");
    if (!el) {
      el = document.createElement("div");
      el.id = "exGisPlaceholder";
      el.className = "example-gis-placeholder";
      el.textContent = "Map experience — coming soon.";
    }
    if (el.parentNode !== slot) slot.appendChild(el);
    el.hidden = false;
  }

  function suspendExperience(expId) {
    if (!expId) return;
    const frame = document.getElementById(experienceFrameId(expId));
    if (frame) {
      // Treedis must not reload when the reader comes back — just hide
      // it. Video must stop playing audio behind the newly active tab —
      // blank its src too.
      if (frame.dataset.kind === "vimeo") frame.src = "about:blank";
      frame.hidden = true;
    }
    const gisEl = document.getElementById("exGisPlaceholder");
    if (gisEl) gisEl.hidden = true;
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

  /* expId is optional — omit it to fall back to the experience marked
     `default`, or the first one. Pure mount/switch: callers own the URL
     sync (openExample()'s own trailing syncURL for a project open/swap;
     the tab click handler's own replaceState for an in-place tab switch). */
  function showExperience(ex, expId) {
    const list = ex.experiences || [];
    const target = list.find((e) => e.id === expId)
                || list.find((e) => e.default)
                || list[0];

    const slot = $("#exStageSlot");
    const loading = $("#exampleLoading");
    const enterBtn = $("#exEnter");

    suspendExperience(activeExperienceId);

    if (!target) {
      activeExperienceId = null;
      syncStageTabs([], null);
      mountSharedShowcase(ex, slot, loading);
      if (enterBtn) enterBtn.textContent = "Enter Twin";
      return;
    }

    activeExperienceId = target.id;

    if (target.type === "treedis") mountTreedis(target, slot, loading);
    else if (target.type === "vimeo") mountVideo(target, slot, loading);
    else if (target.type === "gis")  mountGis(target, ex, slot, loading);

    // A GIS pane has no "open in new tab" target — the button fullscreens
    // the map in place instead. Recomputed on every call, so switching
    // back to a tour/video tab restores the usual label automatically.
    if (enterBtn) enterBtn.textContent = target.type === "gis" ? "Full screen map" : "Enter Twin";

    syncStageTabs(list, target.id);
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
    }
  }, true);

  /* Leave the CSS fallback when the user presses Esc. */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const stage = $("#exampleStage");
    if (stage && stage.classList.contains("is-faux-fullscreen")) {
      e.stopPropagation();
      stage.classList.remove("is-faux-fullscreen", "is-revealing", "is-revealed");
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
    links.forEach((lk) => {
      const a = document.createElement("a");
      a.className = "example-link-chip";
      a.href = lk.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML =
        '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        escapeHTML(lk.label || lk.url);
      wrap.appendChild(a);
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
    const gisEl = document.getElementById("exGisPlaceholder");
    if (gisEl) gisEl.remove();
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
     ACCESS YOUR TWIN  (returning-client sign-in via Google Sheet)
     ------------------------------------------------------------
     Reads a published-CSV directory (or the built-in demo
     directory), matches access_id + access_code, then shows a
     small dashboard listing every twin that login owns and opens
     the chosen one in the experience overlay.
     ============================================================ */
  const access = { directory: null, loading: null, session: null };

  function openAccess() {
    // Reset to the sign-in view each open (unless already signed in).
    $("#accessError").hidden = true;
    const cfgC = window.DTS_CLIENTS || {};
    const ui = cfgC.ui || {};
    /* The Email field maps onto the directory's access_id and the
       Password onto its access_code (see js/clients.js). */
    $("#accessIntro").textContent = ui.intro || "";

    const offline = !cfgC.sheetCsvUrl;
    const note = $("#accessOfflineNote");
    note.hidden = !offline;
    if (offline) note.textContent = ui.offlineNote || "";

    /* Remember me — prefill the last used ID if the user opted in. */
    try {
      const remembered = localStorage.getItem("dts_access_id");
      if (remembered && !$("#accessId").value) {
        $("#accessId").value = remembered;
        $("#accessRemember").checked = true;
      }
    } catch (_) { /* storage unavailable — fine */ }

    // A signed-in client goes straight back to their portal.
    if (access.session) { openPortal(access.session); return; }
    $("#accessSignin").hidden = false;

    const ov = $("#accessOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    setTimeout(() => $("#accessId").focus(), 60);

    // Warm the directory in the background.
    loadDirectory().catch(() => {});
  }

  function closeAccess() {
    const ov = $("#accessOverlay");
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
  }

  /* Fetch + parse the published CSV once; cache it. Falls back to the
     demo directory if no URL is set or the fetch fails. */
  function loadDirectory() {
    if (access.directory) return Promise.resolve(access.directory);
    if (access.loading) return access.loading;
    const cfgC = window.DTS_CLIENTS || {};

    if (!cfgC.sheetCsvUrl) {
      access.directory = (cfgC.demoDirectory || []).map(normalizeRow);
      return Promise.resolve(access.directory);
    }

    access.loading = fetch(cfgC.sheetCsvUrl, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("sheet " + r.status); return r.text(); })
      .then((text) => {
        access.directory = parseCSV(text).map(normalizeRow);
        return access.directory;
      })
      .catch((err) => {
        console.warn("[access] sheet fetch failed, using demo directory:", err);
        access.directory = (cfgC.demoDirectory || []).map(normalizeRow);
        return access.directory;
      });
    return access.loading;
  }

  /* Minimal CSV parser: handles quoted fields, commas, and CRLF.
     Returns an array of row objects keyed by lower-cased header. */
  function parseCSV(text) {
    const rows = [];
    let field = "", row = [], inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { field += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map((h) => h.trim().toLowerCase());
    return rows
      .filter((r) => r.some((c) => c.trim() !== ""))
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
        return obj;
      });
  }

  function normalizeRow(r) {
    return {
      access_id:   (r.access_id   || r.id        || "").trim(),
      access_code: (r.access_code || r.code      || "").trim(),
      client:      (r.client      || r.name      || "Your organization").trim(),
      project:     (r.project     || r.twin      || "Your digital twin").trim(),
      twin_url:    (r.twin_url    || r.url       || cfg.treedis.tourUrl).trim(),
      sweep_id:    (r.sweep_id    || r.sweep     || "").trim(),
      notes:       (r.notes       || "").trim()
    };
  }

  /* ── Swap THIS function to plug in a real auth provider later. ──
     Returns ALL rows matching the login (a client can own several
     twins, stored as one row per twin sharing the same id + code). */
  function authenticate(id, code) {
    const dir = access.directory || [];
    const wantId = (id || "").trim().toLowerCase();
    const wantCode = (code || "").trim();
    return dir.filter((row) =>
      row.access_id.toLowerCase() === wantId && row.access_code === wantCode
    );
  }

  async function submitAccess(e) {
    e.preventDefault();
    $("#accessError").hidden = true;
    const btn = $("#accessSubmit");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Checking…";

    await loadDirectory();
    const matches = authenticate($("#accessId").value, $("#accessCode").value);

    btn.disabled = false; btn.textContent = label;

    if (!matches.length) {
      const ui = (window.DTS_CLIENTS || {}).ui || {};
      $("#accessError").textContent = ui.error || "We couldn't find a twin for that ID and code.";
      $("#accessError").hidden = false;
      return;
    }
    // One login → one client name, one or more twins.
    access.session = { client: matches[0].client, twins: matches };
    try {
      if ($("#accessRemember").checked) {
        localStorage.setItem("dts_access_id", $("#accessId").value.trim());
      } else {
        localStorage.removeItem("dts_access_id");
      }
    } catch (_) { /* storage unavailable — fine */ }
    $("#accessCode").value = "";
    openPortal(access.session);
  }

  /* ============================================================
     CLIENT PORTAL  (post-login)
     Full-screen layer: MENU / client name / Sign out header, a
     HOME tile view, an "All APPS" list built from the client's
     twins, and a tile menu overlay.
     ============================================================ */
  function openPortal(session) {
    closeAccess();
    $("#portalClientName").textContent = session.client;

    /* HOME — the primary twin as the big tile plus shortcuts into
       the other portal views. */
    const tiles = $("#portalHomeTiles");
    tiles.innerHTML = "";
    const primary = session.twins[0];
    const big = document.createElement("button");
    big.type = "button";
    big.className = "portal-tile portal-tile-primary";
    big.innerHTML =
      '<span class="portal-tile-kicker">YOUR TWIN</span>' +
      '<span class="portal-tile-title">' + escapeHTML(primary.project) + '</span>' +
      '<span class="portal-tile-cta">Open the twin</span>';
    big.addEventListener("click", () => { closePortal(false); openTwin(primary); });
    tiles.appendChild(big);

    const apps = document.createElement("button");
    apps.type = "button";
    apps.className = "portal-tile portal-tile-small";
    apps.innerHTML =
      '<span class="portal-tile-title">All Apps</span>' +
      '<span class="portal-tile-sub">' + session.twins.length +
      (session.twins.length === 1 ? " app" : " apps") + '</span>';
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

    /* ALL APPS — one card per twin. */
    const list = $("#portalAppsList");
    list.innerHTML = "";
    session.twins.forEach((rec) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "portal-app";
      card.innerHTML =
        '<span class="portal-app-media">' +
          '<span class="portal-app-media-label">' + escapeHTML(rec.client) + '</span>' +
          '<span class="portal-app-duration">Live twin</span>' +
        '</span>' +
        '<span class="portal-app-title">' + escapeHTML(rec.project) + '</span>' +
        (rec.notes ? '<span class="portal-app-note">' + escapeHTML(rec.notes) + '</span>' : '');
      card.addEventListener("click", () => { closePortal(false); openTwin(rec); });
      list.appendChild(card);
    });

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

  function signOut() {
    closePortal(true);
    $("#accessSignin").hidden = false;
    $("#accessId").value = "";
    $("#accessCode").value = "";
    $("#accessError").hidden = true;
  }

  /* Compare tour URLs ignoring cosmetic differences (trailing slash,
     hash) so we only reload the iframe when the tour truly changes. */
  function normalizeTourUrl(u) {
    return (u || "").trim().split("#")[0].replace(/\/+$/, "");
  }

  /* Open a specific twin record in the experience overlay. If the twin
     is on the same Treedis origin we reuse the live iframe and just
     navigate; otherwise we open its URL in a new tab. */
  function openTwin(rec) {
    if (!rec) return;
    closeAccess();

    const sameOrigin = rec.twin_url &&
      rec.twin_url.indexOf(cfg.treedis.origin) === 0;

    if (sameOrigin && treedisIframe) {
      goHome();            // the twin layer lives on the home shell
      openExperience();
      /* Load this record's tour into the live iframe only if it
         differs from what's currently loaded. */
      if (rec.twin_url &&
          normalizeTourUrl(treedisIframe.src) !== normalizeTourUrl(rec.twin_url)) {
        if (typeof TourBridge.reset === "function") TourBridge.reset();
        treedisIframe.src = rec.twin_url;
      }
      if (rec.sweep_id) {
        if (TourBridge.isReady) TourBridge.navigateToSweep(rec.sweep_id);
        else pendingExampleSweep = rec.sweep_id;  // fires on TourReady
      }
    } else if (rec.twin_url) {
      window.open(rec.twin_url, "_blank", "noopener");
    } else {
      goHome();
      openExperience();
    }
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

  /* Try Web3Forms if a key is set; otherwise signal failure so the
     mailto fallback kicks in. Returns true on a confirmed send. */
  async function sendLead(data, def) {
    const lead = cfg.lead || {};
    if (!lead.accessKey) return false;   // no key → use mailto fallback

    const payload = Object.assign({}, data, {
      access_key: lead.accessKey,
      subject: (lead.subjectPrefix || "DTS Lead") + " — " + (def.title || ""),
      from_name: data.name || "DTS Website",
      // Web3Forms emails this address-set; the key controls routing.
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
    $("#exEnter").addEventListener("click", () => {
      // Fullscreen the live experience pane in place. The project window
      // stays open behind it and keeps its scroll position, so exiting
      // fullscreen returns the reader exactly where they were.
      enterExampleFullscreen();
    });
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
    $$("#portalMenu .portal-menu-tile").forEach((t) =>
      t.addEventListener("click", () => showPortalView(t.dataset.portalView))
    );
    // Tapping the dimmed area below the tiles closes the portal menu.
    $("#portalMenu").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closePortalMenu();
    });

    // Sign-in extras
    $("#accessForgot").addEventListener("click", () => {
      const err = $("#accessError");
      err.textContent =
        "Contact your DTS project lead and we'll reset your access right away.";
      err.hidden = false;
    });
    $("#accessContact").addEventListener("click", () => {
      closeAccess();
      const discovery = (cfg.contact.ctas || []).find((c) => c.id === "discovery")
        || cfg.contact.ctas[0];
      if (discovery) openLeadForm(discovery.id, discovery.stage);
    });

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
    cyclePrompt();
    setInterval(cyclePrompt, 3200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
