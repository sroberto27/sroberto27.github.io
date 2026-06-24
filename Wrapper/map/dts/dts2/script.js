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
    demoOpen: false,
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
    const drawer = $("#navDrawer");
    drawer.innerHTML = "";

    // Home — returns to the main page.
    const home = document.createElement("a");
    home.href = "#";
    home.dataset.nav = "home";
    home.innerHTML =
      '<span>HOME</span><span class="drawer-sub">Main page</span>';
    home.addEventListener("click", (e) => {
      e.preventDefault();
      goHome();          // already closes the drawer
    });
    drawer.appendChild(home);

    cfg.categories.forEach((c) => {
      const a = document.createElement("a");
      a.href = "#";
      a.dataset.cat = c.id;
      a.innerHTML =
        '<span>' + c.label.toUpperCase() + '</span>' +
        '<span class="drawer-sub">' + (c.cards[0] ? c.cards[0].title : "") + '</span>';
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
     MOBILE: sector strip pager (current + peeking next)
     ============================================================ */
  function buildSectorStrip() {
    const track = $("#sectorStripTrack");
    track.innerHTML = "";
    cfg.categories.forEach((c) => {
      const item = document.createElement("div");
      item.className = "sector-item";
      item.dataset.cat = c.id;
      item.innerHTML =
        '<span class="sector-item-label">' + c.label.toUpperCase() + '</span>' +
        '<span class="sector-item-sub">' + (c.cards[0] ? c.cards[0].title : "") + '</span>';
      item.addEventListener("click", () => openCategory(c.id));
      track.appendChild(item);
    });
    positionSectorStrip();
  }

  /* Shift the strip so the active sector sits flush-left and the next
     one peeks in from the right edge. */
  function positionSectorStrip() {
    const idx = currentCatIndex();
    const track = $("#sectorStripTrack");
    if (!track) return;
    track.style.transform = "translateX(" + (-idx * 82) + "%)";
    $$("#sectorStripTrack .sector-item").forEach((el, i) =>
      el.classList.toggle("is-peek", i !== idx)
    );
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
    state.view = name;
    $$(".view").forEach((v) => {
      const match = v.id === "view-" + name;
      v.hidden = !match;
      v.classList.toggle("is-active", match);
    });
    // Bottom tabs only make sense in a category view.
    $("#dockTabs").hidden = name !== "category";
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
    positionSectorStrip();
    syncDrawer();
    syncContactBar();
  }

  /* ============================================================
     RENDER: category detail
     ============================================================ */
  function renderCategory(c) {
    $("#catKicker").textContent = "— " + c.kicker;
    $("#catTitle").textContent  = c.title;
    $("#catSub").textContent    = c.sub;
    $("#catBody").textContent   = c.body;

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
    c.cards.forEach((card) => tabs.appendChild(makeTab(card.id, card.title)));
    state.dockTab = "usecases";

    // evidence filters — open this sector's lead example window focused on
    // the chosen proof type (Case Studies, Awards, …).
    const filters = $("#evidenceFilters");
    filters.innerHTML = "";
    cfg.evidence.forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", () => {
        const lead = getCategory(state.category).cards[0];
        if (lead) openExample(lead.id, label);
      });
      filters.appendChild(b);
    });
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

    /* Expand the inline experience into the full overlay. The iframe
       is relocated into the overlay body; the Treedis session keeps
       running because the element is moved, not recreated. */
    function openDemo() {
      state.demoOpen = true;
      const ov = $("#demoOverlay");
      const overlayBody = $("#overlayBody");
      if (treedisIframe && treedisIframe.parentNode !== overlayBody) {
        overlayBody.appendChild(treedisIframe);
      }
      ov.classList.add("is-open");
      ov.setAttribute("aria-hidden", "false");
    }

    /* Collapse: move the same iframe back into the inline home stage. */
    function closeDemo() {
      state.demoOpen = false;
      const ov = $("#demoOverlay");
      if (treedisIframe) parkIframe();   // return iframe to the home stage
      ov.classList.remove("is-open");
      ov.setAttribute("aria-hidden", "true");
    }

    /* Move the live Treedis iframe back to its inline home stage. Used
       whenever an overlay that borrowed it (demo or example) closes. */
    function parkIframe() {
      const stage = $("#demoStage");
      if (treedisIframe && stage && treedisIframe.parentNode !== stage) {
        stage.appendChild(treedisIframe);
      }
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

    // Header
    $("#exKicker").textContent  = "— " + (cat.kicker || cat.label.toUpperCase());
    $("#exTitle").textContent   = ex.title;
    $("#exTagline").textContent = ex.tagline || "";
    $("#exOverview").textContent = ex.overview || "";

    // Capture chip (the solar-farm style "Captured with" line)
    $("#exCapture").textContent = "Captured with: " + (ex.capturedWith || "Matterport Pro2");

    // Project example
    $("#exProjectName").textContent  = ex.project.name;
    $("#exProjectBlurb").textContent = ex.project.blurb;
    const kindChip = $("#exKind");
    if (ex.project.kind) { kindChip.hidden = false; kindChip.textContent = ex.project.kind; }
    else kindChip.hidden = true;
    $("#exIllustrative").hidden = !ex.project.illustrative;

    // Evidence tabs
    buildExampleEvidence(ex, evidenceLabel);

    // Tint the example window to the sector colour for orientation.
    const win = $("#exampleOverlay .example-window");
    if (win) win.dataset.sector = ex.sector;

    // Borrow the live iframe into the example stage and navigate.
    const stage = $("#exampleStage");
    if (treedisIframe && stage && treedisIframe.parentNode !== stage) {
      stage.appendChild(treedisIframe);
    }
    const loading = $("#exampleLoading");
    if (loading) loading.classList.toggle("is-hidden", TourBridge.isReady);
    if (TourBridge.isReady) {
      TourBridge.navigateToSweep(ex.sweepId || cfg.treedis.homeSweepId || undefined);
    } else if (ex.sweepId) {
      // Queue the sweep for when Treedis finishes booting.
      pendingExampleSweep = ex.sweepId;
    }

    const ov = $("#exampleOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    $("#exampleContent").scrollTop = 0;
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
     small dashboard and opens the client's twin in the overlay.
     ============================================================ */
  const access = { directory: null, loading: null, signedIn: null };

  function openAccess() {
    // Reset to the sign-in view each open (unless already signed in).
    $("#accessError").hidden = true;
    const cfgC = window.DTS_CLIENTS || {};
    const ui = cfgC.ui || {};
    $("#accessIntro").textContent     = ui.intro || "";
    $("#accessIdLabel").textContent   = ui.idLabel || "Access ID";
    $("#accessCodeLabel").textContent = ui.codeLabel || "Access code";
    $("#accessSubmit").textContent    = ui.submit || "Open my twin";
    $("#accessTitle").textContent     = ui.title || "Access Your Twin";

    const offline = !cfgC.sheetCsvUrl;
    const note = $("#accessOfflineNote");
    note.hidden = !offline;
    if (offline) note.textContent = ui.offlineNote || "";

    if (access.signedIn) showDashboard(access.signedIn);
    else { $("#accessSignin").hidden = false; $("#accessDashboard").hidden = true; }

    const ov = $("#accessOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
    if (!access.signedIn) setTimeout(() => $("#accessId").focus(), 60);

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

  /* ── Swap THIS function to plug in a real auth provider later. ── */
  function authenticate(id, code) {
    const dir = access.directory || [];
    const wantId = (id || "").trim().toLowerCase();
    const wantCode = (code || "").trim();
    return dir.find((row) =>
      row.access_id.toLowerCase() === wantId && row.access_code === wantCode
    ) || null;
  }

  async function submitAccess(e) {
    e.preventDefault();
    $("#accessError").hidden = true;
    const btn = $("#accessSubmit");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Checking…";

    await loadDirectory();
    const match = authenticate($("#accessId").value, $("#accessCode").value);

    btn.disabled = false; btn.textContent = label;

    if (!match) {
      const ui = (window.DTS_CLIENTS || {}).ui || {};
      $("#accessError").textContent = ui.error || "We couldn't find a twin for that ID and code.";
      $("#accessError").hidden = false;
      return;
    }
    access.signedIn = match;
    $("#accessCode").value = "";
    showDashboard(match);
  }

  function showDashboard(rec) {
    $("#accessSignin").hidden = true;
    $("#accessDashboard").hidden = false;
    $("#dashClient").textContent  = rec.client;
    $("#dashProject").textContent = rec.project;
    $("#dashNotes").textContent   = rec.notes || "";
    $("#dashNotes").hidden = !rec.notes;
  }

  function signOut() {
    access.signedIn = null;
    $("#accessDashboard").hidden = true;
    $("#accessSignin").hidden = false;
    $("#accessId").value = "";
    $("#accessCode").value = "";
    $("#accessError").hidden = true;
    setTimeout(() => $("#accessId").focus(), 40);
  }

  /* Open the signed-in client's twin in the experience overlay. If the
     twin is on the same Treedis origin we can reuse the live iframe and
     just navigate; otherwise we load their URL into a fresh frame. */
  function openMyTwin() {
    const rec = access.signedIn;
    if (!rec) return;
    closeAccess();

    const sameOrigin = rec.twin_url &&
      rec.twin_url.indexOf(cfg.treedis.origin) === 0;

    if (sameOrigin && treedisIframe) {
      openDemo();
      if (rec.sweep_id && TourBridge.isReady) {
        TourBridge.navigateToSweep(rec.sweep_id);
      } else if (rec.sweep_id) {
        pendingExampleSweep = rec.sweep_id;
      }
    } else if (rec.twin_url) {
      // Different host: open their twin URL directly in a new tab so we
      // never break the live demo session.
      window.open(rec.twin_url, "_blank", "noopener");
    } else {
      openDemo();
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
     CONTACT PANEL (inline slide — no overlay)
     ============================================================ */
  function buildContact() {
    const c = cfg.contact;
    $("#contactKicker").textContent   = c.kicker;
    $("#contactHeadline").textContent = c.headline;
    $("#contactAccent").textContent   = c.headlineAccent;
    $("#contactBody").textContent     = c.body;
    $("#contactFoot").textContent     = c.footnote;

    const stages = $("#contactStages");
    stages.innerHTML = "";
    c.ctas.forEach((cta) => {
      const s = document.createElement("span");
      s.textContent = cta.stage;
      if (cta.primary) s.classList.add("is-primary");
      stages.appendChild(s);
    });

    const wrap = $("#contactCtas");
    wrap.innerHTML = "";
    c.ctas.forEach((cta) => {
      const b = document.createElement("button");
      b.className = "contact-cta" + (cta.primary ? " is-primary" : "");
      b.type = "button";
      b.textContent = cta.label;
      b.addEventListener("click", () => openLeadForm(cta.id, cta.stage));
      wrap.appendChild(b);
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
      // Textareas and selects span full width; short inputs pair up.
      cell.className = "form-field" +
        (f.type === "textarea" || f.type === "select" ? " full" : "");
      cell.dataset.name = f.name;

      const id = "lf_" + f.name;
      const reqMark = f.required ? ' <span class="req">*</span>' : "";
      let control;
      if (f.type === "textarea") {
        control = '<textarea id="' + id + '" name="' + f.name + '"' +
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
          '" type="' + (f.type || "text") + '"' +
          (f.required ? " required" : "") + ' />';
      }
      cell.innerHTML =
        '<label for="' + id + '">' + f.label + reqMark + '</label>' + control;
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
    $("#formView").hidden = true;
    $("#formSuccess").hidden = false;
    $("#formSuccessBody").textContent = viaMail
      ? "Your email is ready to send in your mail app — hit send and the DTS team will be in touch."
      : "The DTS team has your details and will be in touch shortly.";
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

    // The inline iframe is interactive on its own, so clicking the
    // frame does NOT open the overlay. Expansion is explicit via the
    // expand button or the "Try a Digital Twin" pill.
    $("#demoExpand").addEventListener("click", (e) => { e.stopPropagation(); openDemo(); });
    $("#demoTry").addEventListener("click", (e) => { e.stopPropagation(); openDemo(); });

    // Demo close
    $("#overlayClose").addEventListener("click", closeDemo);

    // Example window
    $("#exampleClose").addEventListener("click", closeExample);
    $$("[data-close-example]").forEach((s) => s.addEventListener("click", closeExample));
    // "Enter the twin" expands the example into the full demo overlay.
    $("#exEnter").addEventListener("click", () => { closeExample(); openDemo(); });
    // "Talk to DTS about this" routes into the proposal lead form.
    $("#exContact").addEventListener("click", () => {
      closeExample();
      const proposal = (cfg.contact.ctas || []).find((c) => c.id === "proposal")
        || cfg.contact.ctas[0];
      if (proposal) openLeadForm(proposal.id, proposal.stage);
    });

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
    $("#dashOpen").addEventListener("click", openMyTwin);
    $("#dashSignout").addEventListener("click", signOut);
    $$("[data-close-access]").forEach((s) => s.addEventListener("click", closeAccess));

    // Contact slide controls (inline — no overlay)
    $("#contactEdge").addEventListener("click", slideToContact);
    $("#contactBack").addEventListener("click", slideToCards);
    $("#contactNext").addEventListener("click", advanceToNextSector);
    // "View projects" surfaces the contact/next-step panel too.
    $("#catProjectsBtn").addEventListener("click", slideToContact);

    // Mobile sector-strip arrows (loop through sectors).
    $("#sectorPrev").addEventListener("click", () => openCategory(previousCategory().id));
    $("#sectorNext").addEventListener("click", () => openCategory(nextCategory().id));

    // Mobile slide-to-contact bar toggles cards ⇄ contact.
    $("#contactBar").addEventListener("click", () => {
      if (state.contactOpen) slideToCards();
      else slideToContact();
    });
    // Top-right portal opens the returning-client sign-in (architecturally
    // separate from the marketing/contact flow per the design rationale).
    $("#accessTwin").addEventListener("click", openAccess);

    // Generic scrim closer for the demo overlay.
    $$("[data-close-overlay]").forEach((s) =>
      s.addEventListener("click", () => { closeDemo(); })
    );

    // Escape: close whatever modal is open, or slide contact back to cards.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ($("#exampleOverlay").classList.contains("is-open")) { closeExample(); return; }
        if ($("#accessOverlay").classList.contains("is-open"))  { closeAccess();  return; }
        closeDemo();
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
  function boot() {
    buildPillars();
    buildDrawer();
    buildSectorStrip();
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
