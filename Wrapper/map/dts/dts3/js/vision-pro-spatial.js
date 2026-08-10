/* ============================================================
   visionOS website-environment helper
   ------------------------------------------------------------
   The spatial backdrop (visionOS 26.5 developer preview) is injected by
   THIS file, dynamically, only for confirmed visionOS visitors — see
   isVisionOS()/injectSpatialBackdrop() below. It used to be a static
   <link rel="spatial-backdrop"> in index.html's head, sent to every
   visitor regardless of platform; moved here after that turned out to be
   the real cause of a live iPhone-only crash bug (a broken filename
   reference that WebKit's own native USDZ handling — shared across iOS/
   iPadOS/macOS/visionOS Safari — was apparently trying to resolve on
   every page load). Safari opens the environment from its Page Menu — a
   webpage cannot launch it. The rest of this file makes the hero button
   toggle step-by-step instructions instead.
   ============================================================ */
(function () {
  "use strict";

  /* Real, narrow visionOS detection -- three independent signals, all
     required, specifically so this can NEVER match an ordinary iPhone/iPad/
     Mac running plain Safari. visionOS Safari's user agent reports
     "(Macintosh;" the same as desktop Safari (no distinct visionOS token to
     match on), so UA alone can't tell them apart -- WebXR support
     (navigator.xr) is what actually separates them: real visionOS hardware
     has it, macOS Safari never does. Touch support is the third check,
     specifically to rule out a desktop Mac running Chrome (which DOES
     expose navigator.xr) reporting a UA close enough to trip the first
     check. Sourced from a documented working pattern for exactly this
     problem, not invented from scratch. */
  function isVisionOS() {
    return navigator.userAgent.indexOf("(Macintosh;") !== -1 &&
      !!navigator.xr &&
      document.ontouchstart !== undefined;
  }

  /* The actual fix for a real iPhone-only crash bug: this tag used to be a
     static, unconditional <link rel="spatial-backdrop"> in index.html's
     <head>, sent to EVERY visitor regardless of platform. iOS/iPadOS/macOS
     Safari all share WebKit's real, native USDZ handling (the same engine
     AR Quick Look has used since iOS 12) -- pointing that at a
     type="model/vnd.usdz+zip" resource that didn't even resolve correctly
     (a filename typo made it 404 to a mislabeled HTML page) is a plausible,
     well-evidenced crash trigger, and it sat in <head>, parsed before
     almost anything else. Android has no USDZ handling at all and was never
     affected -- exactly the asymmetry a real user reported. Injected here,
     dynamically, ONLY once isVisionOS() has already confirmed genuine
     visionOS hardware, so no other platform ever sees this tag at all now.
     Filename corrected to match what's actually in models/ (no ".1"). */
  function injectSpatialBackdrop() {
    if (document.querySelector('link[rel="spatial-backdrop"]')) return;
    var link = document.createElement("link");
    link.rel = "spatial-backdrop";
    link.type = "model/vnd.usdz+zip";
    link.href = "models/DTS_Studio_Interior_VisionPro_V2.usdz";
    link.setAttribute("alt", "A film studio interior environment");
    document.head.appendChild(link);
  }

  function initializeVisionOS26Guide() {
    const button = document.getElementById("visionSpatialTry");
    const label = button && button.querySelector(".vision-spatial-label");
    const status = document.getElementById("visionSpatialStatus");

    if (!button || !label || !status) return;

    const defaultLabel = "Try the Spatial Website on Vision Pro";
    const closeLabel = "Hide Vision Pro Instructions";
    let instructionsVisible = false;

    function showInstructions() {
      instructionsVisible = true;
      button.classList.add("is-active");
      button.setAttribute("aria-expanded", "true");
      label.textContent = closeLabel;

      status.innerHTML =
        "<strong>On visionOS 26.5:</strong><br>" +
        "1. Enable <strong>Website Environments</strong> in " +
        "Settings → Apps → Safari → Advanced → Feature Flags.<br>" +
        "2. Return to this page in Safari and reload it.<br>" +
        "3. Tap Safari’s <strong>Page Menu</strong> beside the address bar.<br>" +
        "4. Choose <strong>Open Website Environment</strong>.<br>" +
        "5. Use the Digital Crown to increase or reduce immersion.";
    }

    function hideInstructions() {
      instructionsVisible = false;
      button.classList.remove("is-active");
      button.setAttribute("aria-expanded", "false");
      label.textContent = defaultLabel;
      status.textContent = "";
    }

    button.setAttribute("aria-expanded", "false");
    button.title =
      "visionOS 26.5 opens website environments from Safari’s Page Menu";

    button.addEventListener("click", function () {
      if (instructionsVisible) hideInstructions();
      else showInstructions();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeVisionOS26Guide);
  } else {
    initializeVisionOS26Guide();
  }

  // Loaded dynamically by content-loader.js, well after <head> has already
  // parsed -- document.head is always available here, no readiness check
  // needed the way initializeVisionOS26Guide() above needs one.
  if (isVisionOS()) injectSpatialBackdrop();
})();
