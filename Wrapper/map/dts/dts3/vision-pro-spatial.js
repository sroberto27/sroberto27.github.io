/* ============================================================
   DTS — visionOS 26.5 website-environment helper
   ------------------------------------------------------------
   IMPORTANT:
   visionOS 26.5 uses the developer-preview <link
   rel="spatial-backdrop"> API declared in index.html.

   Safari, not webpage JavaScript, opens that environment. The
   visitor must use Safari's Page Menu and choose
   "Open Website Environment". This script makes the webpage
   button explain those steps; it does not pretend to launch the
   environment directly.
   ============================================================ */
(function () {
  "use strict";

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
})();
