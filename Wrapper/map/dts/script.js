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

  function syncPillars() {
    $$(".pillar").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.cat === state.category)
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
  }

  function goHome() {
    showView("home");
    syncPillars();
  }

  function openCategory(id) {
    state.category = id;
    syncPillars();
    renderCategory(getCategory(id));
    showView("category");
  }

  /* ============================================================
     RENDER: category detail
     ============================================================ */
  function renderCategory(c) {
    $("#catKicker").textContent = "— " + c.kicker;
    $("#catTitle").textContent  = c.title;
    $("#catSub").textContent    = c.sub;
    $("#catBody").textContent   = c.body;

    // use-case cards
    const grid = $("#catCards");
    grid.innerHTML = "";
    c.cards.forEach((card) => {
      const el = document.createElement("div");
      el.className = "uc-card";
      el.tabIndex = 0;
      el.innerHTML =
        '<h3>' + card.title.toUpperCase() + '</h3><p>' + card.text + '</p>';
      // Clicking a use case opens the demo experience (placeholder hook
      // for a per-sub-vertical Treedis sweep later).
      el.addEventListener("click", () => openDemo());
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDemo(); }
      });
      grid.appendChild(el);
    });

    // bottom dock tabs: Use Cases + one per card
    const tabs = $("#dockTabs");
    tabs.innerHTML = "";
    const useCasesTab = makeTab("usecases", "Use Cases", true);
    tabs.appendChild(useCasesTab);
    c.cards.forEach((card) => tabs.appendChild(makeTab(card.id, card.title)));
    state.dockTab = "usecases";

    // evidence filters
    const filters = $("#evidenceFilters");
    filters.innerHTML = "";
    cfg.evidence.forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", () => flashQuestion('Show me ' + label.toLowerCase()));
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
      state.dockTab = id;
      $$(".dock-tab").forEach((t) =>
        t.classList.toggle("is-active", t.dataset.tab === id)
      );
      // Highlight the matching card for orientation.
      const cards = $$(".uc-card");
      const idx = getCategory(state.category).cards.findIndex((c) => c.id === id);
      cards.forEach((card, i) => {
        card.style.outline = i === idx ? "1px solid var(--gold)" : "";
      });
    });
    return b;
  }

  /* ============================================================
     DEMO OVERLAY  +  Treedis bridge wiring
     ============================================================ */
  let treedisIframe = null;

  function startTreedis() {
    if (state.treedisStarted) return;
    state.treedisStarted = true;

    const url = cfg.treedis && cfg.treedis.tourUrl;
    const body = $("#overlayBody");

    if (!url) {
      // No Treedis configured — leave the labelled placeholder so the
      // connection point is obvious to whoever wires it up.
      $("#overlayLoadingText").textContent =
        "Treedis tour URL not set — add cfg.treedis.tourUrl in config.js";
      return;
    }

    // Build the iframe and hand it to the preserved TourBridge.
    treedisIframe = document.createElement("iframe");
    treedisIframe.id = "treedisFrame";
    treedisIframe.allow = "xr-spatial-tracking; fullscreen; vr; gyroscope; accelerometer";
    treedisIframe.setAttribute("allowfullscreen", "");
    treedisIframe.src = url;
    body.appendChild(treedisIframe);

    // ===== PRESERVED COMMUNICATION PATTERN =====
    // Same protocol/handshake as the SCSU wrapper (js/03-tour-bridge.js).
    TourBridge.initialize(treedisIframe, {
      origin: cfg.treedis.origin,
      defaultTransitionTime: cfg.treedis.defaultTransitionTime,
      onReady: function () {
        $("#overlayLoading").style.display = "none";
        // Land on the configured home sweep if one is set.
        if (cfg.treedis.homeSweepId) {
          TourBridge.navigateToSweep(cfg.treedis.homeSweepId);
        }
      },
      onPoseChanged: function (sweepId) {
        // Hook point: keep wrapper UI in sync with where the user
        // walked inside Treedis. (Mirrors syncWrapperToSweep in the
        // original 04-street-view.js.)
        console.info("[dts] pose →", sweepId);
      }
    });
  }

  function openDemo() {
    state.demoOpen = true;
    startTreedis(); // first open boots the bridge; later opens are no-ops
    const ov = $("#demoOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
  }

  function closeDemo() {
    state.demoOpen = false;
    const ov = $("#demoOverlay");
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
    // We intentionally KEEP the iframe mounted so reopening is instant
    // and the Treedis session/handshake is preserved.
  }

  /* ============================================================
     CONTACT OVERLAY
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
      b.addEventListener("click", () => {
        flashQuestion(cta.label.toLowerCase());
        closeContact();
      });
      wrap.appendChild(b);
    });
  }

  function openContact() {
    state.contactOpen = true;
    const ov = $("#contactOverlay");
    ov.classList.add("is-open");
    ov.setAttribute("aria-hidden", "false");
  }
  function closeContact() {
    state.contactOpen = false;
    const ov = $("#contactOverlay");
    ov.classList.remove("is-open");
    ov.setAttribute("aria-hidden", "true");
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
    // Demo open triggers
    $("#demoFrame").addEventListener("click", (e) => {
      // Don't double-fire when the inner "Try" button is clicked.
      if (e.target.id !== "demoTry") openDemo();
    });
    $("#demoFrame").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDemo(); }
    });
    $("#demoTry").addEventListener("click", (e) => { e.stopPropagation(); openDemo(); });

    // Demo close
    $("#overlayClose").addEventListener("click", closeDemo);

    // Contact open triggers
    $("#accessTwin").addEventListener("click", openContact);
    $("#swipeHint").addEventListener("click", openContact);
    $("#catProjectsBtn").addEventListener("click", openContact);
    $("#contactClose").addEventListener("click", closeContact);

    // Generic scrim closers
    $$("[data-close-overlay]").forEach((s) =>
      s.addEventListener("click", () => { closeDemo(); closeContact(); })
    );

    // Escape closes any overlay
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeDemo(); closeContact(); }
    });

    // Brand returns home
    $("#brandHome").addEventListener("click", (e) => { e.preventDefault(); goHome(); });

    // Question bar
    $("#qbar").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("#qbarInput").value.trim();
      if (!v) return;
      console.info("[dts] question:", v);
      // Placeholder: a real assistant/answer endpoint connects here.
      $("#qbarInput").value = "";
      $("#qbarInput").placeholder = "Thanks — we'll wire this to an assistant.";
    });

    // Cookie
    $("#cookieAccept").addEventListener("click", dismissCookie);
    $("#cookieReject").addEventListener("click", dismissCookie);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    buildPillars();
    buildContact();
    renderCategory(getCategory(state.category));
    showView("home");
    wire();
    initBackground();
    cyclePrompt();
    setInterval(cyclePrompt, 3200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
