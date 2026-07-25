/* ============================================================
   Hex media engine  (js/hex-media.js)
   ------------------------------------------------------------
   Hydrates the four hero hexagons with the media configured in
   data/pages/home.json → hexCluster[].media and drives the
   interaction model:

     idle      image / muted looping video / auto-rotating model
     hover     the hovered hex grows, the others give way
     click     the hex expands to the cluster centre; the media
               becomes interactive (video controls + sound,
               model orbit/zoom via <model-viewer>)
     minimize  the round button on the wrapper's top-right (or
               Escape / clicking outside) returns everything

   Media types (all editable in the Admin Board):
     image  — background-image div (as before)
     video  — local .mp4/.webm file OR a YouTube/Vimeo link.
              Files: <video muted loop> idle → controls+sound on
              expand. Links: background-mode iframe idle →
              interactive player on expand.
     model  — GLB/glTF rendered by Google's <model-viewer>
              (library lazy-loaded only when a model is present).
              Transparent background by default so the site shows
              through the hexagon; a CSS color can be set instead.
              Optional .usdz (iosSource) enables AR Quick Look on
              Apple devices. FBX/OBJ are not browser formats —
              convert to GLB (Blender: File → Export → glTF 2.0).

   Loaded by content-loader.js after app.js. Also works in the
   file:// fallback (no /data): the inline images in index.html
   stay, and hover/expand still function.
   ============================================================ */
(function () {
  "use strict";

  var MV_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
  var MV_FALLBACK = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";

  var cluster = document.getElementById("hexCluster") ||
                document.querySelector(".hex-cluster");
  if (!cluster) return;
  var boxes = Array.prototype.slice.call(cluster.querySelectorAll(".hexbox"));
  if (!boxes.length) return;

  /* ---------- config ---------- */
  function srcValue(s) { return s && s.value ? s.value : ""; }
  function normalize(h) {
    if (window.DTS_NORMALIZE_HEX) return window.DTS_NORMALIZE_HEX(h);
    if (h && !h.media) h.media = { _type: "image", source: (h.image && h.image.source) || { kind: "path", value: "" }, alt: (h.image && h.image.alt) || "" };
    return h;
  }
  function hexConfig() {
    var bySlot = {};
    try {
      var home = window.DTS_CONTENT && window.DTS_CONTENT.docs &&
                 window.DTS_CONTENT.docs["pages/home.json"];
      (home && home.hexCluster || []).forEach(function (h) {
        normalize(h);
        if (h && h.slot) bySlot[h.slot] = h.media;
      });
    } catch (e) { console.warn("[hex] config read failed:", e); }
    return bySlot;
  }

  /* ---------- model-viewer lazy loader ---------- */
  var mvPromise = null;
  function ensureModelViewer() {
    if (window.customElements && customElements.get("model-viewer")) return Promise.resolve();
    if (mvPromise) return mvPromise;
    mvPromise = new Promise(function (resolve) {
      function inject(src, onFail) {
        var s = document.createElement("script");
        s.type = "module"; s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = onFail || function () { resolve(); };
        document.head.appendChild(s);
      }
      inject(MV_SRC, function () { inject(MV_FALLBACK); });
    });
    return mvPromise;
  }

  /* ---------- video URL helpers ---------- */
  function isFileVideo(v) { return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i.test(v); }
  function vimeoMatch(v) {
    // Vimeo unlisted/private links look like vimeo.com/ID/HASH — the hash
    // must be passed back as ?h=HASH or the embed refuses to play.
    var m = v.match(/vimeo\.com\/(?:video\/)?(\d+)(?:[/?]([a-zA-Z0-9]+))?/);
    return m ? { id: m[1], hash: m[2] || null } : null;
  }
  function youtubeId(v) { var m = v.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/); return m ? m[1] : null; }
  function embedUrls(value) {
    var vm = vimeoMatch(value);
    if (vm) {
      var h = vm.hash ? "&h=" + vm.hash : "";
      return {
        idle:   "https://player.vimeo.com/video/" + vm.id + "?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1" + h,
        active: "https://player.vimeo.com/video/" + vm.id + "?autoplay=1&autopause=0&dnt=1" + h
      };
    }
    var yid = youtubeId(value);
    if (yid) return {
      idle:   "https://www.youtube.com/embed/" + yid + "?autoplay=1&mute=1&loop=1&playlist=" + yid + "&controls=0&playsinline=1&rel=0&modestbranding=1",
      active: "https://www.youtube.com/embed/" + yid + "?autoplay=1&controls=1&playsinline=1&rel=0&modestbranding=1"
    };
    return { idle: value, active: value };   // already a player/embed URL
  }

  /* ---------- media builders ---------- */
  function buildMedia(box, media) {
    var clip = box.querySelector(".hex-clip");
    if (!clip || !media) return;
    // Lets CSS style per media type: border only on .media-model,
    // play badge only on .media-video (see 02-home.css).
    box.classList.remove("media-image", "media-video", "media-model");
    box.classList.add("media-" + (media._type || "image"));

    var value = srcValue(media.source);
    if (media._type === "image" || !value) {
      var img = clip.querySelector(".hex-media");
      if (img && value) img.style.backgroundImage = "url('" + value + "')";
      if (img && media.alt) box.setAttribute("aria-label", media.alt + " — expand");
      return;
    }

    clip.innerHTML = "";
    box._media = { type: media._type };

    if (media._type === "video") {
      if (isFileVideo(value) || (media.source.kind === "path" && value)) {
        var v = document.createElement("video");
        v.muted = true; v.loop = true; v.autoplay = true;
        v.playsInline = true; v.setAttribute("playsinline", "");
        v.preload = "metadata";
        if (media.poster && srcValue(media.poster)) v.poster = srcValue(media.poster);
        v.src = value;
        clip.appendChild(v);
        box._media.el = v; box._media.kind = "file";
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else {
        var urls = embedUrls(value);
        var f = document.createElement("iframe");
        f.src = urls.idle;
        f.allow = "autoplay; fullscreen; picture-in-picture";
        f.setAttribute("frameborder", "0");
        f.tabIndex = -1; f.title = "";
        clip.appendChild(f);
        box._media.el = f; box._media.kind = "embed"; box._media.urls = urls;
      }
      box.setAttribute("aria-label", "Play video");
      return;
    }

    if (media._type === "model") {
      ensureModelViewer().then(function () {
        if (!customElements.get("model-viewer")) {
          console.warn("[hex] model-viewer unavailable — showing poster only.");
          var fall = document.createElement("div");
          fall.className = "hex-media hex-img";
          if (media.poster && srcValue(media.poster)) {
            fall.style.backgroundImage = "url('" + srcValue(media.poster) + "')";
          }
          clip.appendChild(fall);
          return;
        }
        var mv = document.createElement("model-viewer");
        mv.setAttribute("src", value);
        mv.setAttribute("loading", "lazy");
        mv.setAttribute("reveal", "auto");
        mv.setAttribute("interaction-prompt", "none");
        mv.setAttribute("disable-zoom", "");
        mv.setAttribute("disable-tap", "");
        if (media.autoRotate !== false) {
          mv.setAttribute("auto-rotate", "");
          mv.setAttribute("auto-rotate-delay", "0");
          mv.setAttribute("rotation-per-second", "18deg");
        }
        if (media.poster && srcValue(media.poster)) mv.setAttribute("poster", srcValue(media.poster));
        if (media.iosSource && srcValue(media.iosSource)) {
          mv.setAttribute("ios-src", srcValue(media.iosSource));
          mv.setAttribute("ar", "");
          mv.setAttribute("ar-modes", "quick-look webxr scene-viewer");
        }
        var bg = (media.background || "transparent").trim().toLowerCase();
        mv.style.backgroundColor =
          (!bg || bg === "transparent" || bg === "none") ? "transparent" : media.background;
        mv.setAttribute("shadow-intensity", "0.6");
        clip.appendChild(mv);
        box._media.el = mv;
      });
      box.setAttribute("aria-label", "Explore 3D model");
      return;
    }
  }

  /* ---------- expand / collapse state ---------- */
  var expanded = null;

  function activateMedia(box) {
    var m = box._media; if (!m || !m.el) return;
    if (m.type === "video" && m.kind === "file") {
      m.el.controls = true; m.el.muted = false;
      var p = m.el.play(); if (p && p.catch) p.catch(function () {});
    } else if (m.type === "video" && m.kind === "embed") {
      if (m.el.src !== m.urls.active) m.el.src = m.urls.active;
      m.el.tabIndex = 0;
    } else if (m.type === "model") {
      m.el.setAttribute("camera-controls", "");
      m.el.removeAttribute("disable-zoom");
      m.el.removeAttribute("disable-tap");
    }
  }
  function idleMedia(box) {
    var m = box._media; if (!m || !m.el) return;
    if (m.type === "video" && m.kind === "file") {
      m.el.controls = false; m.el.muted = true; m.el.loop = true;
      var p = m.el.play(); if (p && p.catch) p.catch(function () {});
    } else if (m.type === "video" && m.kind === "embed") {
      if (m.el.src !== m.urls.idle) m.el.src = m.urls.idle;
      m.el.tabIndex = -1;
    } else if (m.type === "model") {
      m.el.removeAttribute("camera-controls");
      m.el.setAttribute("disable-zoom", "");
      m.el.setAttribute("disable-tap", "");
    }
  }

  function expand(box) {
    if (expanded === box) return;
    if (expanded) collapse();
    expanded = box;
    box.classList.add("is-expanded");
    box.classList.remove("is-hot");
    cluster.classList.add("has-expanded");
    cluster.classList.remove("has-hover");
    box.setAttribute("aria-expanded", "true");
    var min = box.querySelector(".hex-min");
    if (min) min.tabIndex = 0;
    activateMedia(box);
  }
  function collapse() {
    if (!expanded) return;
    var box = expanded; expanded = null;
    box.classList.remove("is-expanded");
    cluster.classList.remove("has-expanded");
    box.setAttribute("aria-expanded", "false");
    var min = box.querySelector(".hex-min");
    if (min) min.tabIndex = -1;
    idleMedia(box);
  }

  /* ---------- wire the boxes ---------- */
  var cfg = hexConfig();
  boxes.forEach(function (box) {
    var slot = box.getAttribute("data-slot");
    if (cfg[slot]) buildMedia(box, cfg[slot]);
    box.setAttribute("aria-expanded", "false");

    box.addEventListener("pointerenter", function () {
      if (box.classList.contains("is-expanded")) return;
      box.classList.add("is-hot");
      cluster.classList.add("has-hover");
    });
    box.addEventListener("pointerleave", function () {
      box.classList.remove("is-hot");
      if (!cluster.querySelector(".hexbox.is-hot")) cluster.classList.remove("has-hover");
    });
    box.addEventListener("click", function (e) {
      if (e.target.closest(".hex-min")) return;
      if (!box.classList.contains("is-expanded")) { expand(box); }
    });
    box.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && !box.classList.contains("is-expanded")) {
        e.preventDefault(); expand(box);
      }
    });
    var min = box.querySelector(".hex-min");
    if (min) min.addEventListener("click", function (e) {
      e.stopPropagation(); collapse(); box.focus();
    });
  });

  /* Escape / click outside collapses. */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") collapse();
  });
  document.addEventListener("pointerdown", function (e) {
    if (expanded && !e.target.closest(".hexbox")) collapse();
  });
  /* Opening the full-screen twin puts the cluster away — tidy up. */
  var twinTry = document.getElementById("twinTry");
  if (twinTry) twinTry.addEventListener("click", collapse);

  cluster.classList.add("is-interactive");
})();
