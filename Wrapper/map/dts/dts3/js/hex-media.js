/* ============================================================
   Hex media engine  (js/hex-media.js)
   ------------------------------------------------------------
   Hydrates the four hero hexagons with the media configured in
   data/pages/home.json → hexCluster[].media and drives the
   interaction model:

     idle      image / video (per autoplayMode below) / auto-rotating
               model
     hover     the hovered hex grows, the others give way; a video set
               to autoplayMode "hover" starts playing while hovered
     click     the hex expands to the cluster centre; the media
               becomes interactive (video controls + sound,
               model orbit/zoom via <model-viewer>)
     minimize  the round button on the wrapper's top-right (or
               Escape / clicking outside) returns everything

   Media types (all editable in the Admin Board):
     image  — background-image div (as before)
     video  — local .mp4/.webm file OR a YouTube/Vimeo link.
              autoplayMode controls idle behaviour:
                "autoplay" (default) — muted loop plays immediately
                "hover"              — plays only while hovered,
                                       pauses and rewinds on leave
                "none"               — stays paused until expanded
              Whatever the idle behaviour, expanding always gives
              full controls + sound (files) or the interactive
              embed (links).
     model  — GLB/glTF rendered by Google's <model-viewer>
              (library lazy-loaded only when a model is present).
              Transparent background by default so the site shows
              through the hexagon; a CSS color can be set instead.
              Optional .usdz (iosSource) enables AR Quick Look on
              Apple devices. FBX/OBJ are not browser formats —
              convert to GLB (Blender: File → Export → glTF 2.0).

   Border treatment (media.border, CMS-chosen, default "none"): one
   of none / stroke / brackets / vignette / badge / scanline — purely
   the CSS class applied (see 02-home.css). The WebGL clip/mask fix
   that keeps models inside their hexagon is unconditional and lives
   in 02-home.css .hex-clip, independent of this choice.

   Loaded by content-loader.js after app.js. Also works in the
   file:// fallback (no /data): the inline images in index.html
   stay, and hover/expand still function.

   MEDIA READINESS (window.DTS_HEX_MEDIA_READY): js/intro-typewriter.js
   holds the loading screen's progress on this flag so the intro
   doesn't hand off to a page whose hexagons are still popping in
   images, buffering video, or streaming a 3D model. Every hexagon's
   media reports completion (loaded or errored — a broken asset
   still counts as "settled", never hangs the loader) via
   expectHexLoad() below; a short failsafe timeout guarantees the
   flag flips even if a network request never resolves.
   ============================================================ */
(function () {
  "use strict";

  var MV_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
  var MV_FALLBACK = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js";

  /* Any early-return path below marks this true immediately — there's
     nothing for the intro loader to wait on if there's no cluster, no
     boxes, or nothing configured. */
  window.DTS_HEX_MEDIA_READY = false;

  var cluster = document.getElementById("hexCluster") ||
                document.querySelector(".hex-cluster");
  if (!cluster) { window.DTS_HEX_MEDIA_READY = true; return; }
  var boxes = Array.prototype.slice.call(cluster.querySelectorAll(".hexbox"));
  if (!boxes.length) { window.DTS_HEX_MEDIA_READY = true; return; }

  /* ---------- hex media readiness tracking ---------- */
  var HEX_LOAD_FAILSAFE_MS = 12000;   // never let a stalled asset hang the intro forever
  var pendingHexLoads = 0;
  var hexLoadTimeout = null;

  /* Call once per hexagon as soon as you know it has media to load;
     call the returned function once (loaded OR errored) when settled. */
  function expectHexLoad() {
    pendingHexLoads++;
    var done = false;
    return function () {
      if (done) return;
      done = true;
      pendingHexLoads--;
      if (pendingHexLoads <= 0) {
        clearTimeout(hexLoadTimeout);
        window.DTS_HEX_MEDIA_READY = true;
      }
    };
  }

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
        idlePlaying: "https://player.vimeo.com/video/" + vm.id + "?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1" + h,
        idlePaused:  "https://player.vimeo.com/video/" + vm.id + "?background=1&autoplay=0&muted=1&loop=1&autopause=0&dnt=1" + h,
        active:      "https://player.vimeo.com/video/" + vm.id + "?autoplay=1&autopause=0&dnt=1" + h
      };
    }
    var yid = youtubeId(value);
    if (yid) return {
      idlePlaying: "https://www.youtube.com/embed/" + yid + "?autoplay=1&mute=1&loop=1&playlist=" + yid + "&controls=0&playsinline=1&rel=0&modestbranding=1",
      idlePaused:  "https://www.youtube.com/embed/" + yid + "?autoplay=0&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1",
      active:      "https://www.youtube.com/embed/" + yid + "?autoplay=1&controls=1&playsinline=1&rel=0&modestbranding=1"
    };
    return { idlePlaying: value, idlePaused: value, active: value };   // already a player/embed URL
  }

  /* ---------- media builders ---------- */
  function buildMedia(box, media) {
    var clip = box.querySelector(".hex-clip");
    if (!clip || !media) return;
    // Lets CSS style per media type (play badge, corner-badge icon)
    // and per CMS-chosen border style (see 02-home.css).
    box.classList.remove("media-image", "media-video", "media-model");
    box.classList.add("media-" + (media._type || "image"));
    box.classList.remove("border-none", "border-stroke", "border-brackets",
                          "border-vignette", "border-badge", "border-scanline");
    box.classList.add("border-" + (media.border || "none"));

    var value = srcValue(media.source);
    if (media._type === "image" || !value) {
      var img = clip.querySelector(".hex-media");
      if (img && value) {
        var markImgDone = expectHexLoad();
        var probe = new Image();
        probe.onload = markImgDone;
        probe.onerror = markImgDone;
        probe.src = value;
        img.style.backgroundImage = "url('" + value + "')";
      }
      if (img && media.alt) box.setAttribute("aria-label", media.alt + " — expand");
      return;
    }

    clip.innerHTML = "";
    box._media = { type: media._type };

    if (media._type === "video") {
      var mode = media.autoplayMode || "autoplay";
      if (isFileVideo(value) || (media.source.kind === "path" && value)) {
        var v = document.createElement("video");
        v.muted = true; v.loop = true;
        v.playsInline = true; v.setAttribute("playsinline", "");
        v.preload = mode === "autoplay" ? "auto" : "metadata";
        if (media.poster && srcValue(media.poster)) v.poster = srcValue(media.poster);
        v.src = value;
        var markVideoDone = expectHexLoad();
        v.addEventListener("loadeddata", markVideoDone, { once: true });
        v.addEventListener("error", markVideoDone, { once: true });
        clip.appendChild(v);
        box._media.el = v; box._media.kind = "file"; box._media.mode = mode;
        if (mode === "autoplay") {
          v.autoplay = true;
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else {
          // "hover"/"none" start paused. Some browsers show a blank
          // frame until playback has happened once — nudge a single
          // play+immediate-pause (still muted, no visible flash) so
          // the poster-less first frame renders instead of blank.
          v.addEventListener("loadeddata", function nudge() {
            v.removeEventListener("loadeddata", nudge);
            var pp = v.play();
            if (pp && pp.then) pp.then(function () { v.pause(); }).catch(function () {});
          });
        }
      } else {
        var urls = embedUrls(value);
        var f = document.createElement("iframe");
        f.src = mode === "autoplay" ? urls.idlePlaying : urls.idlePaused;
        f.allow = "autoplay; fullscreen; picture-in-picture";
        f.setAttribute("frameborder", "0");
        f.tabIndex = -1; f.title = "";
        var markEmbedDone = expectHexLoad();
        f.addEventListener("load", markEmbedDone, { once: true });
        f.addEventListener("error", markEmbedDone, { once: true });
        clip.appendChild(f);
        box._media.el = f; box._media.kind = "embed"; box._media.urls = urls; box._media.mode = mode;
      }
      box.setAttribute("aria-label", "Play video");
      return;
    }

    if (media._type === "model") {
      var markModelDone = expectHexLoad();
      ensureModelViewer().then(function () {
        if (!customElements.get("model-viewer")) {
          console.warn("[hex] model-viewer unavailable — showing poster only.");
          var fall = document.createElement("div");
          fall.className = "hex-media hex-img";
          if (media.poster && srcValue(media.poster)) {
            fall.style.backgroundImage = "url('" + srcValue(media.poster) + "')";
          }
          clip.appendChild(fall);
          markModelDone();
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
        mv.addEventListener("load", markModelDone, { once: true });
        mv.addEventListener("error", markModelDone, { once: true });
        clip.appendChild(mv);
        box._media.el = mv;
      }).catch(markModelDone);
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
      if (m.mode === "autoplay") {
        var p = m.el.play(); if (p && p.catch) p.catch(function () {});
      } else {
        m.el.pause();
        try { m.el.currentTime = 0; } catch (e) {}
      }
    } else if (m.type === "video" && m.kind === "embed") {
      var target = m.mode === "autoplay" ? m.urls.idlePlaying : m.urls.idlePaused;
      if (m.el.src !== target) m.el.src = target;
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
      var m = box._media;
      if (m && m.type === "video" && m.mode === "hover") {
        if (m.kind === "file" && m.el) {
          try { m.el.currentTime = 0; } catch (e) {}
          var p = m.el.play(); if (p && p.catch) p.catch(function () {});
        } else if (m.kind === "embed" && m.el && m.urls && m.el.src !== m.urls.idlePlaying) {
          m.el.src = m.urls.idlePlaying;
        }
      }
    });
    box.addEventListener("pointerleave", function () {
      box.classList.remove("is-hot");
      if (!cluster.querySelector(".hexbox.is-hot")) cluster.classList.remove("has-hover");
      if (box.classList.contains("is-expanded")) return;
      var m = box._media;
      if (m && m.type === "video" && m.mode === "hover") {
        if (m.kind === "file" && m.el) {
          m.el.pause();
          try { m.el.currentTime = 0; } catch (e) {}
        } else if (m.kind === "embed" && m.el && m.urls && m.el.src !== m.urls.idlePaused) {
          m.el.src = m.urls.idlePaused;
        }
      }
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

  /* Nothing was configured with actual media (e.g. cfg empty) — settle
     immediately rather than waiting on the failsafe for no reason. */
  if (pendingHexLoads === 0) {
    window.DTS_HEX_MEDIA_READY = true;
  } else {
    hexLoadTimeout = setTimeout(function () {
      window.DTS_HEX_MEDIA_READY = true;
    }, HEX_LOAD_FAILSAFE_MS);
  }

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
