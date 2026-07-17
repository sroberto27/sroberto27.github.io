/* ============================================================
   DTS — App logic
   ------------------------------------------------------------
   App-shell state machine. Major sections are swapped via JS
   state (home / category) — NOT scroll. Modals (demo, contact)
   layer over the shell.

   Treedis: the demo overlay reuses the preserved TourBridge
   (dts-tour-bridge.js), which carries the exact postMessage
   protocol from the SCSU wrapper.
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
    /* Figma mobile menu (frames clip13–clip16): a left slide-in panel
       listing ONLY the four sectors in caps; the active sector is a
       full-width bar in that sector's accent colour. Home is reached
       via the brand logo, matching the board. */
    const drawer = $("#navDrawer");
    drawer.innerHTML = "";

    cfg.categories.forEach((c) => {
      const a = document.createElement("a");
      a.href = "#";
      a.dataset.cat = c.id;
      a.style.setProperty("--item-accent", c.accent || "#E9B44C");
      /* data-label feeds the oversized ghost echo shown behind the
         active item (see .nav-drawer a.is-active::before). */
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
    /* Figma clip17/31/32/33: the button names the sector. */
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
     DEMO EXPERIENCE  +  Treedis bridge wiring
     ------------------------------------------------------------
     The live Treedis experience is embedded INLINE in the home
     demo frame at boot (opens right away — no click needed). The
     SAME iframe is physically moved into the full overlay when the
     user expands, and moved back when they close. Moving (rather
     than recreating) keeps the live Treedis session and the
     TourBridge handshake intact — no reload, no re-init.
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

      // ===== PRESERVED COMMUNICATION PATTERN =====
      // Same protocol/handshake as the SCSU wrapper (js/03-tour-bridge.js).
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
          // Hook point: sync wrapper UI to where the user walked
          // inside Treedis (mirrors syncWrapperToSweep in the
          // original 04-street-view.js).
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
     Sequence on "Try a Digital Twin" (mockup 4:00 → 12:00):
       1. the twin layer mounts as a narrow vertical slice in the
          centre of the viewport, with a bright seam line (4:00)
       2. the slice expands horizontally until the live Treedis
          experience fills everything below the fixed header
          (4:75 → 6:00)
       3. after a beat, the hero copy fades back in as a dark
          glass card over the experience (8:00 → 9:00)
     The Treedis iframe itself was created at boot inside
     #demoStage and never reloads — the layer only reveals it.
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

      // Glass card fades in once the user has had a moment inside
      // the twin (mockup: reveal ends ~6s, card at ~8s).
      clearTimeout(cardTimer);
      cardTimer = setTimeout(showHeroCard, 3200);
    }

    function showHeroCard() {
      const card = $("#twinHeroCard");
      card.classList.add("is-visible");
      card.setAttribute("aria-hidden", "false");
    }

    function hideHeroCard() {
      const card = $("#twinHeroCard");
      card.classList.remove("is-visible");
      card.setAttribute("aria-hidden", "true");
    }

    function closeExperience() {
      if (!state.twinOpen) return;
      state.twinOpen = false;
      clearTimeout(cardTimer);
      hideHeroCard();

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

  function openExample(cardId, evidenceLabel) {
    const ex = cfg.examples && cfg.examples[cardId];
    if (!ex) { console.warn("[dts] no example for", cardId); return; }
    activeExampleId = cardId;

    const cat = cfg.categories.find((c) => c.id === ex.sector) || getCategory(state.category);

    // Header — the desktop board (clip2, "Solar Farm Sample") titles the
    // window with the PROJECT name; the sub-vertical rides in the kicker.
    $("#exKicker").textContent  = "— " + (cat.kicker || cat.label.toUpperCase()) + " · " + ex.title;
    $("#exTitle").textContent   = ex.project.name;
    $("#exTagline").textContent = ex.tagline || "";
    $("#exOverview").textContent = ex.overview || "";

    // Capture chips — board layout: "Captured with: [chip]" / "Platform: [chip]".
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

    // "More from {Sector}" (board clip6): the sector's other sub-verticals.
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
    // Priority: the example's OWN media (its Treedis tour or its best
    // project video) > shared showcase iframe navigated to a sweep.
    const stage = $("#exampleStage");
    const loading = $("#exampleLoading");
    const mediaUrl = exampleMediaUrl(ex);

    if (mediaUrl) {
      // Park the shared showcase iframe (if it was borrowed here before).
      if (treedisIframe && treedisIframe.parentNode === stage) parkIframe();
      let frame = $("#exampleMediaFrame");
      if (!frame) {
        frame = document.createElement("iframe");
        frame.id = "exampleMediaFrame";
        frame.className = "twin-iframe";
        frame.allow = "autoplay; fullscreen; picture-in-picture; xr-spatial-tracking; gyroscope; accelerometer";
        frame.allowFullscreen = true;
        frame.addEventListener("load", () => {
          const l = $("#exampleLoading");
          if (l) l.classList.add("is-hidden");
        });
      }
      if (frame.parentNode !== stage) stage.appendChild(frame);
      if (loading) loading.classList.toggle("is-hidden", frame.src === mediaUrl);
      if (frame.src !== mediaUrl) frame.src = mediaUrl;
    } else {
      // Fallback — borrow the shared live iframe and navigate by sweep.
      const oldFrame = $("#exampleMediaFrame");
      if (oldFrame) oldFrame.remove();
      if (treedisIframe && stage && treedisIframe.parentNode !== stage) {
        stage.appendChild(treedisIframe);
      }
      if (loading) loading.classList.toggle("is-hidden", TourBridge.isReady);
      if (TourBridge.isReady) {
        TourBridge.navigateToSweep(ex.sweepId || cfg.treedis.homeSweepId || undefined);
      } else if (ex.sweepId) {
        // Queue the sweep for when Treedis finishes booting.
        pendingExampleSweep = ex.sweepId;
      }
    }

    const ov = $("#exampleOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    $("#exampleContent").scrollTop = 0;
  }

  /* The URL to load in the example stage: the example's own Treedis
     tour, or its best directly-related project video (Vimeo embed). */
  function exampleMediaUrl(ex) {
    const m = ex.media;
    if (!m) return null;
    if (m.type === "treedis" && m.tourUrl) return m.tourUrl;
    if (m.type === "vimeo" && m.embedUrl) {
      // Autoplay muted so the pane reads as a live experience.
      const sep = m.embedUrl.indexOf("?") >= 0 ? "&" : "?";
      return m.embedUrl + sep + "muted=1&title=0&byline=0&portrait=0";
    }
    return null;
  }

  /* The URL "Enter Twin" / "open in new tab" should target for the
     ACTIVE example — its own tour or video when it has one. */
  function exampleOpenUrl(ex) {
    if (!ex || !ex.media) return null;
    if (ex.media.type === "treedis") return ex.media.tourUrl || null;
    if (ex.media.type === "vimeo")   return ex.media.watchUrl || ex.media.embedUrl || null;
    return null;
  }

  /* Real project imagery (extracted from the DTS portfolio) when the
     example carries a gallery; decorative mosaic otherwise. */
  function buildExampleGallery(ex) {
    const grid = $("#exMediaGrid");
    if (!grid) return;
    const shots = ex.gallery || [];
    if (!shots.length) {
      grid.setAttribute("aria-hidden", "true");
      grid.innerHTML =
        '<span class="example-tile example-tile-tall"></span>' +
        '<span class="example-tile"></span>' +
        '<span class="example-tile"></span>' +
        '<span class="example-tile example-tile-tall"></span>';
      return;
    }
    grid.removeAttribute("aria-hidden");
    grid.innerHTML = "";
    shots.forEach((shot, i) => {
      const img = document.createElement("img");
      img.className = "example-tile example-tile-photo" + (i === 0 ? " example-tile-tall" : "");
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

  function closeExample() {
    const ov = $("#exampleOverlay");
    // Tear down the per-example media frame so a video doesn't keep
    // playing behind the closed window.
    const mediaFrame = $("#exampleMediaFrame");
    if (mediaFrame) mediaFrame.remove();
    if (treedisIframe) parkIframe();
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
    activeExampleId = null;
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
    /* The sign-in card follows the Figma mobile login (frame clip1):
       "Welcome Back!", Email + Password, gold "Login In". The Email
       field maps onto the directory's access ID. */
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
     CLIENT PORTAL  (post-login — Figma mobile frames clip4/5/6)
     Full-screen layer: MENU / client-logo / Sign out header, a HOME
     tile view, an "All APPS" list built from the client's twins, and
     a tile menu overlay. Replaces the old inline dashboard.
     ============================================================ */
  function openPortal(session) {
    closeAccess();
    $("#portalClientName").textContent = session.client;

    /* HOME — the clip4 wireframe blocks, made real: the primary twin
       as the big tile plus shortcuts into the other portal views. */
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

    /* Desktop board clip36 shows a wider tile dashboard — add the
       Manage shortcut so the four portal sections are all reachable
       from HOME. */
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "portal-tile portal-tile-small portal-tile-manage";
    manage.innerHTML =
      '<span class="portal-tile-title">Manage</span>' +
      '<span class="portal-tile-sub">Twin management with your DTS lead</span>';
    manage.addEventListener("click", () => showPortalView("manage"));
    tiles.appendChild(manage);

    /* ALL APPS — clip5: one card per twin, image area with a duration
       hint bottom-right and the title captioned below. */
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

  /* Tiny local escaper (the wrapper's escapeHTML lives in another
     file in the SCSU build; this page is standalone). */
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
      /* Load THIS record's tour into the live iframe if it differs
         from what's currently loaded. (Fix: previously every
         same-origin twin reused the boot tour, so all portal apps
         opened the same experience regardless of their twin_url.) */
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
     SECTOR PROJECTS WINDOW  (Figma frame clip28)
     Opened by "VIEW {SECTOR} PROJECTS": a full-screen dark sheet
     titled "{SECTOR} BASED PROJECTS" with a stacked card per
     sub-vertical project, each carrying the capture / platform
     chips. Tapping a card opens that project's example window.
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

    /* Figma clip18: each CTA is a centred step — its stage label
       (PLAN / PROPOSE / PILOT) above the button, with a thin
       decorative connector line running off to the right. The old
       separate stages row is retired. */
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
      /* Figma modals (clip19/21/25) pair the short fields two-up —
         including the selects — and give textareas the full row.
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
    /* Figma clip23: "REQUEST SENT / Thanks for contacting us!" toast. */
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

    // Example window
    $("#exampleClose").addEventListener("click", closeExample);
    $$("[data-close-example]").forEach((s) => s.addEventListener("click", closeExample));
    // "Enter the twin" — if the active example has its OWN experience
    // (its Treedis tour or project video), open that full-size in a new
    // tab; otherwise fall back to the shared full-screen showcase.
    $("#exEnter").addEventListener("click", () => {
      const ex = cfg.examples && cfg.examples[activeExampleId];
      const own = exampleOpenUrl(ex);
      if (own) { window.open(own, "_blank", "noopener"); return; }
      closeExample();
      goHome();
      openExperience();
    });
    // "Contact Us about this" routes into the proposal lead form.
    $("#exContact").addEventListener("click", () => {
      closeExample();
      const proposal = (cfg.contact.ctas || []).find((c) => c.id === "proposal")
        || cfg.contact.ctas[0];
      if (proposal) openLeadForm(proposal.id, proposal.stage);
    });
    // Small gold square (board clip2/clip3) — opens the live tour in a
    // new tab. (The board shows the button without a label; this is the
    // documented interpretation.)
    const exOpenTab = $("#exOpenTab");
    if (exOpenTab) exOpenTab.addEventListener("click", () => {
      const ex = cfg.examples && cfg.examples[activeExampleId];
      window.open(exampleOpenUrl(ex) || cfg.treedis.tourUrl, "_blank", "noopener");
    });
    // Back-to-top FAB inside the window (board clip5/clip6).
    const exFab = $("#exampleFab");
    if (exFab) exFab.addEventListener("click", () => {
      $("#exampleContent").scrollTo({ top: 0, behavior: "smooth" });
    });
    // Desktop portal nav links (board clip36/clip37).
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
    // "VIEW {SECTOR} PROJECTS" opens the sector projects window (clip28).
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

    // Sign-in extras (Figma clip1)
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
    // Top-right portal opens the returning-client sign-in (architecturally
    // separate from the marketing/contact flow per the design rationale).
    $("#accessTwin").addEventListener("click", openAccess);


    // Escape: close whatever modal is open, or slide contact back to cards.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$("#portalMenu").hidden) { closePortalMenu(); return; }
        if ($("#portalLayer").classList.contains("is-open")) { closePortal(false); return; }
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
  /* The Vision Pro spatial-website CTA is a Safari feature — show it
     only when the site is actually opened in Safari (stakeholder
     review). Chrome/Edge/Opera/Firefox (including their iOS shells)
     and Android browsers all include extra tokens alongside "Safari",
     so requiring Safari-without-those identifies real Safari (macOS,
     iOS/iPadOS, and visionOS). */
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
    renderCategory(getCategory(state.category));
    showView("home");
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
