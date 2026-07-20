/* === Start screen + coachmark walkthrough ===
   First-run welcome modal with two paths:
     - "Enter Experience" dismisses the modal.
     - "How to Use" runs a 3-step coachmark sequence highlighting the
       sidebar, the top bar, and the details panel.
   The walkthrough selects the first tour stop so the details panel has
   real content to point at, and restores the untouched app state when
   it finishes. It can be reopened anytime from the burger menu.

   Also owns the two persisted preferences (welcome screen on startup,
   3D nav instructions) and the nav-instructions modal that gates the
   first street-view open of a session. */
(function setupOnboarding() {

  // Resolve all required DOM up front. If anything is missing the
  // feature disables itself instead of throwing.
  const startScreen   = document.getElementById("startScreen");
  const startEnterBtn = document.getElementById("startEnterBtn");
  const startHowBtn   = document.getElementById("startHowToUseBtn");

  const overlay     = document.getElementById("coachmarkOverlay");
  const card        = document.getElementById("coachmarkCard");
  const ring        = document.getElementById("coachmarkRing");
  const titleEl     = document.getElementById("coachmarkTitle");
  const bodyEl      = document.getElementById("coachmarkBody");
  const prevBtn     = document.getElementById("coachmarkPrev");
  const nextBtn     = document.getElementById("coachmarkNext");
  const closeBtn    = document.getElementById("coachmarkClose");
  const currentEl   = document.getElementById("coachmarkCurrent");
  const totalEl     = document.getElementById("coachmarkTotal");
  const burgerHowTo = document.getElementById("burgerHowToUse");
  const burgerCheckbox = document.getElementById("burgerToggle");

  // Mirrored controls for "show start screen on startup". The modal
  // checkbox is worded negatively ("Don't show again"), so its checked
  // state is inverted relative to the stored preference.
  const suppressCheckbox = document.getElementById("startScreenSuppress");
  const startupSwitch    = document.getElementById("burgerShowStartScreen");

  // Mirrored controls for "show 3D navigation instructions". Same
  // pattern, separate localStorage key.
  const navModal           = document.getElementById("navInstructions");
  const navGotItBtn        = document.getElementById("navInstructionsGotIt");
  const navSuppressCheckbox = document.getElementById("navInstructionsSuppress");
  const navInstructionsSwitch = document.getElementById("burgerShowNavInstructions");

  if (!startScreen || !overlay || !card) {
    console.warn("[onboarding] required nodes missing — disabled");
    return;
  }

  /* -- Preferences ------------------------------------------
     Two independent localStorage flags, both defaulting to "show"
     when unset:
       scsu:showStartScreen      — welcome modal on boot
       scsu:showNavInstructions  — 3D nav modal on the first street
                                   view open of a session */
  const PREF_KEY = "scsu:showStartScreen";
  const NAV_PREF_KEY = "scsu:showNavInstructions";

  function readPref(key) {
    try {
      const v = localStorage.getItem(key);

      return v === null ? true : v === "1";
    } catch (_) {

      return true;
    }
  }

  /* localStorage can throw in private/sandboxed contexts; both helpers
     fail soft (read: default to show, write: skip persisting). */
  function writePref(key, show) {
    try {
      localStorage.setItem(key, show ? "1" : "0");
    } catch (_) {

    }
  }

  function readShowOnStartup()        { return readPref(PREF_KEY); }
  function writeShowOnStartup(show)   { writePref(PREF_KEY, show); }
  function readShowNavInstructions()  { return readPref(NAV_PREF_KEY); }
  function writeShowNavInstructions(show) { writePref(NAV_PREF_KEY, show); }

  /* Push the stored preferences into all four controls so each toggle
     and its mirror stay in sync. */
  function syncPrefControls() {
    const showStart = readShowOnStartup();
    if (suppressCheckbox) suppressCheckbox.checked = !showStart;
    if (startupSwitch)    startupSwitch.checked    = showStart;

    const showNav = readShowNavInstructions();
    if (navSuppressCheckbox)  navSuppressCheckbox.checked  = !showNav;
    if (navInstructionsSwitch) navInstructionsSwitch.checked = showNav;
  }

  // Four edge masks that dim everything around the highlighted rect.
  const masks = {
    top:    overlay.querySelector('[data-mask="top"]'),
    right:  overlay.querySelector('[data-mask="right"]'),
    bottom: overlay.querySelector('[data-mask="bottom"]'),
    left:   overlay.querySelector('[data-mask="left"]')
  };

  /* -- Step definitions -------------------------------------
     Each step has desktop and mobile variants. getRect() resolves the
     highlight target lazily per render so layout shifts between steps
     are reflected; `placement` picks which side the card sits on. */
     const STEPS = [
      {
        id: "left-sidebar",
        desktop: {
          title: "Locations Sidebar",
          body: "Browse all campus locations here. Search for buildings or " +
                "courses and tap to find out more about them, or simply take " +
                "a guided tour at bottom left. ",
          getRect: () => {
            const node = document.getElementById("locations");
            return node ? node.getBoundingClientRect() : null;
          },
          placement: "right"
        },
        mobile: {
          title: "Locations Menu",
          body: "Tap the Locations button to open the full list of all campus " +
                "locations here. Search for buildings or courses and tap to find " +
                "out more about them, or simply take a guided tour at bottom left. ",
          getRect: () => {
            const node = document.getElementById("locationsToggle");
            return node ? node.getBoundingClientRect() : null;
          },
          placement: "bottom"
        }
      },
      {
        id: "top-bar",
        desktop: {
          title: "Experience Toggle",
          body:"Choose Explore to discover SCSU or to find something specific; " +
               "choose Learn to access all immersive coursework available to you.",

          getRect: () => {
            const node = document.querySelector(".metabar");
            return node ? node.getBoundingClientRect() : null;
          },
          placement: "bottom"
        },
        mobile: {
          title: "Experience Toggle",
          body:"Choose Explore to discover SCSU or to find something specific; " +
               "choose Learn to access all immersive coursework available to you.",
          getRect: () => {
            const node = document.querySelector(".metabar");
            return node ? node.getBoundingClientRect() : null;
          },
          placement: "bottom"
        }
      },
      {
        id: "right-panel",
        desktop: {
          title: "Location Details",
          body: "Choose any location to see its details here. Tap Explore " +
                "to drop into an immersive street view (where available). " +
                "Explorable locations are shortcuts. ",

          getRect: () => {
            const node = document.getElementById("details");
            return node ? node.getBoundingClientRect() : null;
          },
          placement: "left"
        },
        mobile: {
          title: "Location Details",
          body: "Choose any location to see its details here. Tap Explore " +
                "to drop into an immersive street view (where available). " +
                "Explorable locations are shortcuts. ",
          getRect: () => {
            const node = document.getElementById("details");
            return node ? node.getBoundingClientRect() : null;
          },
          placement: "top"
        }
      }
    ];

  let stepIndex = 0;
  let active    = false;
  let resizeRaf = 0;
  let prevFocus = null;

  /* -- Layout helpers ---------------------------------------
     positionCutout() sizes the four masks so they cover everything
     except the target rect; positionCard() places the tooltip beside
     the rect with a matching arrow. */
  function positionCutout(rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // No measurable target — fully dim the screen, skip the ring, and
    // let the card fall back to centered.
    if (!rect || rect.width === 0 || rect.height === 0) {

      masks.top.style.cssText    = "top:0;left:0;width:100%;height:100%";
      masks.right.style.cssText  = "top:0;left:0;width:0;height:0";
      masks.bottom.style.cssText = "top:0;left:0;width:0;height:0";
      masks.left.style.cssText   = "top:0;left:0;width:0;height:0";
      ring.style.display = "none";
      return;
    }

    // No padding: the cutout hugs the target so the dim edges align
    // cleanly with each panel instead of spilling onto neighbors.
    const pad = 0;
    const x  = Math.max(0, rect.left   - pad);
    const y  = Math.max(0, rect.top    - pad);
    const w  = Math.min(vw - x, rect.width  + pad * 2);
    const h  = Math.min(vh - y, rect.height + pad * 2);

    masks.top.style.top    = "0";
    masks.top.style.left   = "0";
    masks.top.style.width  = vw + "px";
    masks.top.style.height = y + "px";

    masks.bottom.style.top    = (y + h) + "px";
    masks.bottom.style.left   = "0";
    masks.bottom.style.width  = vw + "px";
    masks.bottom.style.height = Math.max(0, vh - (y + h)) + "px";

    masks.left.style.top    = y + "px";
    masks.left.style.left   = "0";
    masks.left.style.width  = x + "px";
    masks.left.style.height = h + "px";

    masks.right.style.top    = y + "px";
    masks.right.style.left   = (x + w) + "px";
    masks.right.style.width  = Math.max(0, vw - (x + w)) + "px";
    masks.right.style.height = h + "px";

    // Outline on the cutout itself.
    ring.style.display = "block";
    ring.style.top    = y + "px";
    ring.style.left   = x + "px";
    ring.style.width  = w + "px";
    ring.style.height = h + "px";
  }

  function positionCard(rect, placement) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = card.offsetWidth  || 360;
    const cardH = card.offsetHeight || 180;
    const gap   = 18;
    const edge  = 16;

    let top, left, arrow = "none";

    // Centered fallback when there is no target.
    if (!rect || rect.width === 0 || rect.height === 0) {

      top  = Math.max(edge, (vh - cardH) / 2);
      left = Math.max(edge, (vw - cardW) / 2);
      card.dataset.arrow = "none";
      card.style.top  = top  + "px";
      card.style.left = left + "px";
      return;
    }

    // Pick the placement, then clamp into the viewport.
    switch (placement) {
      case "right":
        left  = rect.right + gap;
        top   = rect.top   + Math.min(40, rect.height / 2 - 24);
        arrow = "left";
        break;
      case "left":
        left  = rect.left - gap - cardW;
        top   = rect.top   + Math.min(40, rect.height / 2 - 24);
        arrow = "right";
        break;
      case "bottom":
        left  = rect.left + Math.min(40, rect.width / 2 - 24);
        top   = rect.bottom + gap;
        arrow = "top";
        break;
      case "top":
      default:
        left  = rect.left + Math.min(40, rect.width / 2 - 24);
        top   = rect.top - gap - cardH;
        arrow = "bottom";
        break;
    }

    // If the chosen placement runs off-screen, fall back to a centered
    // or opposite-axis position rather than covering the highlight,
    // keeping the original axis intent where possible.
    const fitsHoriz = left >= edge && (left + cardW) <= (vw - edge);
    const fitsVert  = top  >= edge && (top  + cardH) <= (vh - edge);

    if (!fitsHoriz || !fitsVert) {

      if (placement === "right" || placement === "left") {

        left  = Math.max(edge, Math.min(vw - cardW - edge, (vw - cardW) / 2));
        top   = rect.bottom + gap;
        if (top + cardH > vh - edge) {
          top = Math.max(edge, rect.top - gap - cardH);
        }
        arrow = "none";
      } else {

        const roomRight = vw - rect.right;
        const roomLeft  = rect.left;
        if (roomRight >= roomLeft) {
          left  = Math.min(vw - cardW - edge, rect.right + gap);
          arrow = "left";
        } else {
          left  = Math.max(edge, rect.left - gap - cardW);
          arrow = "right";
        }
        top = Math.max(edge, Math.min(vh - cardH - edge, (vh - cardH) / 2));
      }

      left = Math.max(edge, Math.min(vw - cardW - edge, left));
      top  = Math.max(edge, Math.min(vh - cardH - edge, top));
    }

    card.dataset.arrow = arrow;
    card.style.top  = top  + "px";
    card.style.left = left + "px";
  }

  /* Render the current step: copy, counter, nav buttons, then measure
     and position the cutout + card on the next frame. */
  function renderStep() {
    const stepBase = STEPS[stepIndex];
    if (!stepBase) return;

    const step = (isMobile() && stepBase.mobile) ? stepBase.mobile
                                                 : stepBase.desktop;

    titleEl.textContent = step.title;
    bodyEl.textContent  = step.body;
    currentEl.textContent = String(stepIndex + 1);
    totalEl.textContent   = String(STEPS.length);

    const isFirst = stepIndex === 0;
    const isLast  = stepIndex === STEPS.length - 1;

    // Previous stays visible (disabled on step 1) so the counter
    // remains centered.
    prevBtn.hidden = false;
    prevBtn.disabled = isFirst;
    nextBtn.hidden = false;
    nextBtn.disabled = false;
    nextBtn.textContent = isLast ? "Finish" : "Next";
    nextBtn.classList.toggle("coachmark-nav-finish", isLast);

    requestAnimationFrame(() => {
      const rect = step.getRect && step.getRect();
      positionCutout(rect);
      requestAnimationFrame(() => positionCard(rect, step.placement));
    });
  }

  function onResize() {
    if (!active) return;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const stepBase = STEPS[stepIndex];
      if (!stepBase) return;
      const step = (isMobile() && stepBase.mobile) ? stepBase.mobile
                                                   : stepBase.desktop;
      const rect = step.getRect && step.getRect();
      positionCutout(rect);
      positionCard(rect, step.placement);
    });
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeWalkthrough();
    } else if (e.key === "ArrowRight") {
      if (stepIndex < STEPS.length - 1) {
        stepIndex += 1;
        renderStep();
      }
    } else if (e.key === "ArrowLeft") {
      if (stepIndex > 0) {
        stepIndex -= 1;
        renderStep();
      }
    }
  }

  /* -- Open / close ----------------------------------------- */
  function openWalkthrough() {
    if (active) return;
    active = true;
    stepIndex = 0;

    prevFocus = document.activeElement;

    // Select the first tour stop so the details panel has real content
    // to highlight.
    try {
      if (Array.isArray(tourStops) && tourStops.length) {

        goToStop(0);
      }
    } catch (err) {
      console.warn("[onboarding] could not focus first tour stop:", err);
    }

    document.body.classList.add("coachmarks-active");
    overlay.setAttribute("aria-hidden", "false");

    // Let the details-panel transition settle before measuring (320ms
    // covers the 260ms map-refresh delay used elsewhere), then move
    // focus into the card and trap Tab there.
    setTimeout(() => {
      renderStep();

      try { closeBtn.focus({ preventScroll: true }); }
      catch (_) {  }
      installFocusTrap(card);
    }, 320);

    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
  }

  function closeWalkthrough() {
    if (!active) return;
    active = false;

    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("coachmarks-active");
    removeFocusTrap();

    window.removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey);

    // Defensive cleanup: collapse masks/ring/card so they can't swallow
    // clicks even if a browser leaves them paintable for a frame.
    try {
      Object.values(masks).forEach((m) => {
        m.style.cssText = "top:0;left:0;width:0;height:0";
      });
      ring.style.cssText = "display:none;top:0;left:0;width:0;height:0";
      card.style.top = "";
      card.style.left = "";
      card.dataset.arrow = "none";
    } catch (_) {  }

    // Undo everything the walkthrough touched: clear the auto-selected
    // building and restore the campus-wide view.
    try { if (typeof clearSelection === "function") clearSelection(); }
    catch (err) { console.warn("[onboarding] clearSelection failed:", err); }

    try {
      if (typeof resetCampusView === "function") resetCampusView(true);
    } catch (err) {
      console.warn("[onboarding] resetCampusView failed:", err);
    }

    // Restore focus.
    if (prevFocus && typeof prevFocus.focus === "function") {
      try { prevFocus.focus({ preventScroll: true }); }
      catch (_) {  }
    }
    prevFocus = null;
  }

  /* On the last step "Next" acts as Finish and closes gracefully. */
  function nextStep() {
    if (stepIndex >= STEPS.length - 1) {

      closeWalkthrough();
      return;
    }
    stepIndex += 1;
    renderStep();
  }

  function prevStep() {
    if (stepIndex <= 0) return;
    stepIndex -= 1;
    renderStep();
  }

  /* -- Focus trap -------------------------------------------
     A modal that visually blocks the page must also block keyboard
     navigation. While a trap is active, a capture-phase keydown
     listener bounces focus back into the container and wraps Tab /
     Shift+Tab between the first and last focusable elements. */
  let activeTrapContainer = null;

  function getFocusables(container) {
    if (!container) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(container.querySelectorAll(selector))
      // Filter out display:none nodes, but keep the visually-hidden
      // checkbox inputs used under custom styling — those must stay
      // reachable.
      .filter((node) => {

        if (node.offsetParent === null && node.getClientRects().length === 0) {

          if (node.matches('input[type="checkbox"]')) return true;
          return false;
        }
        return true;
      });
  }

  function onTrapKeydown(e) {
    if (e.key !== "Tab" || !activeTrapContainer) return;
    const focusables = getFocusables(activeTrapContainer);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    const current = document.activeElement;

    if (e.shiftKey) {
      if (current === first || !activeTrapContainer.contains(current)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (current === last || !activeTrapContainer.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function installFocusTrap(container) {
    activeTrapContainer = container;
    document.addEventListener("keydown", onTrapKeydown, true);
  }

  function removeFocusTrap() {
    activeTrapContainer = null;
    document.removeEventListener("keydown", onTrapKeydown, true);
  }

  /* -- Start screen ----------------------------------------- */

  /* Show the welcome modal. Natural boots respect the stored
     preference; burger-menu re-opens pass { force: true }. Marks the
     body modal-open so global shortcuts can opt out, focuses the
     primary button, and traps Tab inside the modal. */
  function showStartScreen(opts) {

    const force = !!(opts && opts.force);
    if (!force && !readShowOnStartup()) return;

    syncPrefControls();

    startScreen.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    if (startEnterBtn) {
      requestAnimationFrame(() => {
        try { startEnterBtn.focus({ preventScroll: true }); }
        catch (_) {  }
      });
    }
    installFocusTrap(startScreen);
  }

  function hideStartScreen() {
    startScreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    removeFocusTrap();
  }

  /* -- Navigation instructions modal ------------------------
     Same modal pattern, used for 3D street-view onboarding. Which
     instruction image shows (mouse / touch / VR) is driven purely by
     the body classes set at boot; see 10-nav-instructions.css. */
  function showNavInstructions(opts) {
    if (!navModal) return false;

    const force = !!(opts && opts.force);
    if (!force && !readShowNavInstructions()) return false;

    syncPrefControls();
    navModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (navGotItBtn) {
      requestAnimationFrame(() => {
        try { navGotItBtn.focus({ preventScroll: true }); }
        catch (_) {  }
      });
    }
    installFocusTrap(navModal);
    return true;
  }

  function hideNavInstructions() {
    if (!navModal) return;
    navModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    removeFocusTrap();
  }

  /* -- openStreetView gating wrapper ------------------------
     The nav-instructions modal must appear on the first street-view
     open of a session. Several call sites open street view, so the
     cleanest seam is the function itself: window.openStreetView is
     wrapped once and every caller goes through the gate. Skipped when
     the preference is off or street view is already active (mid-
     session sweep changes shouldn't re-prompt). */
  let pendingStreetViewArgs = null;
  let originalOpenStreetView = null;

  function installStreetViewGate() {
    if (typeof window.openStreetView !== "function") {
      console.warn("[onboarding] openStreetView not on window — gate disabled");
      return;
    }
    originalOpenStreetView = window.openStreetView;

    window.openStreetView = function gatedOpenStreetView() {
      const args = Array.prototype.slice.call(arguments);

      if (typeof streetViewActive !== "undefined" && streetViewActive) {
        return originalOpenStreetView.apply(this, args);
      }

      if (!readShowNavInstructions()) {
        return originalOpenStreetView.apply(this, args);
      }

      // Cache the args and show the modal; "Got it" replays the call
      // with the same arguments.
      pendingStreetViewArgs = args;
      showNavInstructions();

    };
  }

  /* Replay the deferred openStreetView() call after "Got it". */
  function replayPendingStreetView() {
    if (!pendingStreetViewArgs || !originalOpenStreetView) return;
    const args = pendingStreetViewArgs;
    pendingStreetViewArgs = null;
    try { originalOpenStreetView.apply(null, args); }
    catch (err) {
      console.warn("[onboarding] failed to replay street view:", err);
    }
  }

  // Exposed for boot().
  window.showStartScreen = showStartScreen;

  /* -- Event wiring ----------------------------------------- */
  if (startEnterBtn) {
    startEnterBtn.addEventListener("click", () => {
      hideStartScreen();
    });
  }

  if (startHowBtn) {
    startHowBtn.addEventListener("click", () => {
      hideStartScreen();

      // Pause so the start-screen fade-out completes before the
      // coachmark fade-in begins.
      setTimeout(openWalkthrough, 200);
    });
  }

  prevBtn.addEventListener("click", prevStep);
  nextBtn.addEventListener("click", nextStep);
  closeBtn.addEventListener("click", closeWalkthrough);

  // Burger "How to use" reopens the walkthrough; close the panel first
  // and wait out its slide animation.
  if (burgerHowTo) {
    burgerHowTo.addEventListener("click", (e) => {
      e.preventDefault();
      if (burgerCheckbox) burgerCheckbox.checked = false;

      setTimeout(openWalkthrough, 280);
    });
  }

  // Mirrored preference controls: the modal checkbox is inverted, the
  // burger switch is direct. Both write the same flag and re-sync the
  // other on change.
  if (suppressCheckbox) {
    suppressCheckbox.addEventListener("change", () => {
      writeShowOnStartup(!suppressCheckbox.checked);
      syncPrefControls();
    });
  }
  if (startupSwitch) {
    startupSwitch.addEventListener("change", () => {
      writeShowOnStartup(startupSwitch.checked);
      syncPrefControls();
    });
  }

  if (navGotItBtn) {
    navGotItBtn.addEventListener("click", () => {
      hideNavInstructions();

      replayPendingStreetView();
    });
  }
  if (navSuppressCheckbox) {
    navSuppressCheckbox.addEventListener("change", () => {
      writeShowNavInstructions(!navSuppressCheckbox.checked);
      syncPrefControls();
    });
  }
  if (navInstructionsSwitch) {
    navInstructionsSwitch.addEventListener("change", () => {
      writeShowNavInstructions(navInstructionsSwitch.checked);
      syncPrefControls();
    });
  }

  // openStreetView is declared at top level before this IIFE runs, so
  // it is already on window when the gate installs.
  installStreetViewGate();

  // Reflect stored preferences into the controls immediately.
  syncPrefControls();
})();

/* Kick off boot. On fatal errors, surface the message on the splash. */
boot().catch((err) => {
  console.error("[metaversity] fatal:", err);
  el.splash.innerHTML =
    "<div style='font-family:monospace;padding:24px;color:#b91c1c;" +
    "text-align:center;max-width:480px'>" +
    "Failed to initialise the map:<br><br><code>" +
    String(err && err.message || err) + "</code></div>";
});
