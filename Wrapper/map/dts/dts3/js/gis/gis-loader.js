/* ============================================================
   GIS dependency loader
   ------------------------------------------------------------
   Injects the vendored Leaflet + esri-leaflet build on first use.
   Nothing here runs until something calls DTSGisLoader.load() --
   no GIS bytes reach a project that never opens a GIS experience.
   Idempotent: concurrent/repeat calls share one in-flight load.
   ============================================================ */
(function () {
  "use strict";

  const VENDOR = {
    css: "vendor/leaflet/leaflet.css",
    leaflet: "vendor/leaflet/leaflet.js",
    esriLeaflet: "vendor/leaflet/esri-leaflet.js"
  };

  let pending = null;

  function injectCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing && existing.dataset.loaded === "true") { resolve(); return; }
      if (existing) existing.remove(); // a prior failed attempt -- retry clean
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { s.dataset.loaded = "true"; resolve(); };
      s.onerror = () => { s.remove(); reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function load() {
    if (pending) return pending;

    pending = Promise.resolve()
      .then(() => injectCss(VENDOR.css))
      .then(() => injectScript(VENDOR.leaflet))
      .then(() => {
        if (!window.L) throw new Error("Leaflet failed to initialise");
        return injectScript(VENDOR.esriLeaflet);
      })
      .then(() => {
        if (!window.L || !window.L.esri) throw new Error("esri-leaflet failed to initialise");
        return window.L;
      })
      .catch((err) => {
        pending = null; // let a retry (e.g. reopening the tab) try again
        throw err;
      });

    return pending;
  }

  window.DTSGisLoader = { load };
})();
