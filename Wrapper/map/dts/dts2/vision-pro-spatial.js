/* ============================================================
   DTS — Apple Vision Pro immersive website environment
   ------------------------------------------------------------
   Uses Safari's Immersive API with the hidden HTML <model> in
   index.html. The USDZ contains both the animated DTScube and the
   inverse movement of the Backrooms environment.
   ============================================================ */
(function () {
  "use strict";

  function initializeSpatialEnvironment() {
    const button = document.getElementById("visionSpatialTry");
    const label = button && button.querySelector(".vision-spatial-label");
    const status = document.getElementById("visionSpatialStatus");
    const model = document.getElementById("dtsSpatialEnvironment");

    if (!button || !label || !status || !model) return;

    const defaultLabel = "Enter the Spatial Web on Vision Pro";
    const restartLabel = "Restart the Spatial Journey";
    const exitLabel = "Exit the Spatial Environment";

    function isSupported() {
      return document.immersiveEnabled === true &&
        typeof model.requestImmersive === "function";
    }

    function isActive() {
      return document.immersiveElement === model;
    }

    function setBusy(busy, message) {
      button.disabled = busy;
      button.classList.toggle("is-loading", busy);
      if (message !== undefined) status.textContent = message;
    }

    async function restartAnimation() {
      try {
        await model.ready;
        if (typeof model.pause === "function") model.pause();
        model.currentTime = 0;
        model.playbackRate = 1;
        if (typeof model.play === "function") model.play();
        status.textContent = "The spatial journey is playing.";
      } catch (error) {
        console.error("[DTS spatial] Model playback failed:", error);
        status.textContent = "The environment opened, but its animation could not start.";
      }
    }

    async function enterImmersive() {
      if (!isSupported()) {
        status.textContent =
          "This experience requires Safari on Apple Vision Pro with immersive website environments enabled.";
        return;
      }

      setBusy(true, "Loading the spatial environment…");

      try {
        await model.requestImmersive();
        await restartAnimation();
      } catch (error) {
        console.error("[DTS spatial] Immersive request failed:", error);
        status.textContent =
          "The spatial environment could not open. Confirm the USDZ path, hosting, and Vision Pro Safari version.";
      } finally {
        setBusy(false);
        updateInterface();
      }
    }

    async function exitImmersive() {
      if (typeof document.exitImmersive !== "function") {
        status.textContent = "Use the Digital Crown to leave the spatial environment.";
        return;
      }

      setBusy(true, "Closing the spatial environment…");
      try {
        await document.exitImmersive();
      } catch (error) {
        console.error("[DTS spatial] Exit failed:", error);
        status.textContent = "Use the Digital Crown to leave the spatial environment.";
      } finally {
        setBusy(false);
        updateInterface();
      }
    }

    function updateInterface() {
      const active = isActive();
      document.body.classList.toggle("spatial-environment-active", active);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      label.textContent = active ? exitLabel : defaultLabel;

      if (!active && status.textContent === "The spatial journey is playing.") {
        status.textContent = "";
      }
    }

    button.addEventListener("click", async function () {
      if (isActive()) {
        await exitImmersive();
      } else {
        await enterImmersive();
      }
    });

    model.addEventListener("immersivechange", function () {
      if (!isActive() && typeof model.pause === "function") model.pause();
      updateInterface();
    });

    model.addEventListener("immersiveerror", function (event) {
      console.error("[DTS spatial] Immersive error:", event);
      status.textContent = "The spatial environment stopped because of an error.";
      updateInterface();
    });

    // Keep the CTA visible on every browser. Unsupported visitors get
    // a clear compatibility message instead of a button that disappears.
    if (!isSupported()) {
      button.classList.add("is-unsupported");
      button.title = "Requires Safari on Apple Vision Pro";
    }

    updateInterface();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSpatialEnvironment);
  } else {
    initializeSpatialEnvironment();
  }
})();
