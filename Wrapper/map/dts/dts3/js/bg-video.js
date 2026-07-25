/* ============================================================
   Background video -- deferred, connection-aware  (js/bg-video.js)
   ------------------------------------------------------------
   The looping Vimeo background lives in index.html as a data-src
   attribute on #bgVideo, not a live iframe -- so the browser never
   fetches Vimeo's player JS + video stream during the critical
   load window. This script decides IF and WHEN to actually insert
   the iframe:

     - never on a Save-Data request, or a reported 2g/3g connection
     - browsers without the Network Information API (Safari, notably)
       fall back to a simple viewport check: narrow viewports are
       treated as mobile and skip the video
     - even when eligible, waits until the window has finished
       loading (or the browser is idle) before injecting -- so it
       never competes with the JSON/JS/CSS that make the page usable

   If the video is skipped, the #bgNet canvas (already in the DOM,
   see index.html) stays as the permanent background -- nothing else
   needs to change for that fallback to work.
   ============================================================ */
(function () {
  "use strict";

  var slot = document.getElementById("bgVideo");
  if (!slot) return;
  var src = slot.getAttribute("data-src");
  if (!src) return;

  function shouldLoadVideo() {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      if (conn.saveData) return false;
      if (conn.effectiveType && conn.effectiveType !== "4g") return false;
      return true;
    }
    // No Network Information API (e.g. Safari/iOS) -- fall back to a
    // simple viewport heuristic: treat narrow viewports as mobile and
    // skip the video there rather than risk it on a phone connection
    // we have no visibility into.
    return window.innerWidth >= 820;
  }

  function insertVideo() {
    if (!shouldLoadVideo()) return; // canvas fallback stays, permanently
    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = "";
    iframe.setAttribute("frameborder", "0");
    iframe.allow = "autoplay; fullscreen";
    iframe.tabIndex = -1;
    slot.appendChild(iframe);
  }

  function schedule() {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(insertVideo, { timeout: 4000 });
    } else {
      setTimeout(insertVideo, 2000);
    }
  }

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule);
  }
})();
