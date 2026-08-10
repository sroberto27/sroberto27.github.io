/* ============================================================
   Content loader — hydrates the site from /data JSON documents
   ------------------------------------------------------------
   Loads data/manifest.json + every document it lists, converts
   them into the legacy window.DTS_CONFIG shape app.js expects,
   applies the home-page content to the DOM, then injects the
   app scripts. js/config.js remains as a fallback if /data is
   unreachable (e.g. opened over file://).

   Admin drafts: the Admin Board (js/admin.js) saves a full
   snapshot of all documents to localStorage under DRAFT_KEY.
   When a draft exists it is used INSTEAD of the files on disk,
   which is what makes "Save draft & preview" instant. Publishing
   = exporting the data/ folder from the Admin Board and
   committing it; then the draft can be discarded.
   ============================================================ */
(function () {
  "use strict";

  var DRAFT_KEY = "dtsAdminDraft";
  var DATA_ROOT = "data/";

  /* ---------- utilities ---------- */
  function srcValue(s) { return s && s.value ? s.value : ""; }

  function flattenManifest(manifest) {
    var files = [];
    var groups = (manifest && manifest.documents) || {};
    Object.keys(groups).forEach(function (g) {
      (groups[g] || []).forEach(function (e) { files.push(e.file); });
    });
    return files;
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var draft = JSON.parse(raw);
      if (draft && draft.docs && draft.manifest) return draft;
    } catch (e) { console.warn("[content] bad draft, ignoring:", e); }
    return null;
  }

  /* fresh=true forces a real network hit (used only for manifest.json,
     which is tiny and must always reflect the latest publish). Every
     other document is fetched with normal HTTP caching -- safe because
     its URL carries a ?v=<contentVersion> suffix that only changes
     when the content actually changes (see admin.js exportData()). */
  function fetchJSON(path, fresh) {
    return fetch(path, { cache: fresh ? "no-store" : "default" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }

  /* ---------- load all documents ---------- */
  function loadContent() {
    var draft = loadDraft();
    if (draft) {
      console.info("[content] admin draft active (saved " + (draft.savedAt || "?") + ")");
      return Promise.resolve({ manifest: draft.manifest, docs: draft.docs, fromDraft: true });
    }
    return fetchJSON(DATA_ROOT + "manifest.json", true).then(function (manifest) {
      var ver = encodeURIComponent(manifest.contentVersion || "0");
      var files = flattenManifest(manifest);
      return Promise.all(files.map(function (f) {
        return fetchJSON(DATA_ROOT + f + "?v=" + ver).then(function (doc) { return [f, doc]; });
      })).then(function (pairs) {
        var docs = {};
        pairs.forEach(function (p) { docs[p[0]] = p[1]; });
        return { manifest: manifest, docs: docs, fromDraft: false };
      });
    });
  }

  /* ---------- convert documents → legacy DTS_CONFIG ---------- */
  function docsByType(content, type) {
    return Object.keys(content.docs)
      .map(function (f) { return content.docs[f]; })
      .filter(function (d) { return d && d._type === type; });
  }

  /* projects normally carry `experiences[]`; the 16 legacy documents still
     carry a single `media` object instead. Neither is migrated here -- the
     Admin Board does that, editor-triggered, when it first touches a project
     (see 03-SPEC-multi-experience.md §1). */
  function projectExperiences(p) {
    if (Array.isArray(p.experiences) && p.experiences.length) return p.experiences;
    if (p.media) return [Object.assign({ id: p.media._type }, p.media)];
    return [];
  }

  function convertExperience(m, i) {
    if (!m || !m._type) return undefined;
    var base = { id: m.id || (m._type + (i ? "-" + (i + 1) : "")),
                 label: m.label || "", default: !!m.default, access: m.access };
    if (m._type === "treedis") {
      return Object.assign(base, { type: "treedis", tourUrl: m.tourUrl || "",
        origin: m.origin || "https://spaces.dtsxr.com", sweepId: m.sweepId || null });
    }
    if (m._type === "video") {
      return Object.assign(base, { type: "vimeo",
        embedUrl: srcValue(m.embed), watchUrl: srcValue(m.watch) });
    }
    if (m._type === "gis") {
      return Object.assign(base, { type: "gis", mapId: m.mapId || "",
        tourId: m.tourId || null, initialView: m.initialView || null });
    }
    return undefined;                     // unknown types still dropped, deliberately
  }

  function buildConfig(content) {
    var cfg = window.DTS_CONFIG ? JSON.parse(JSON.stringify(window.DTS_CONFIG)) : {};
    var docs = content.docs;
    var settings = docs["site/settings.json"];
    var lead     = docs["site/lead.json"];
    var home     = docs["pages/home.json"];
    var contact  = docs["pages/contact.json"];
    var faq      = docs["faq/answers.json"];
    var funFacts = docs["faq/fun-facts.json"];
    var access   = docs["access/access.json"];

    if (settings) {
      cfg.brand = {
        name: settings.brand.name, short: settings.brand.short,
        tagline: settings.brand.tagline, motto: settings.brand.motto,
        domain: settings.brand.domain
      };
      cfg.treedis = settings.treedis;
      cfg.clientPortalUrl = settings.clientPortalUrl;
      cfg.evidence = settings.evidenceFilterLabels;
    }
    if (home) cfg.questionPrompts = home.questionPrompts || cfg.questionPrompts;
    if (contact) {
      cfg.contact = {
        kicker: contact.kicker, headline: contact.headline,
        headlineAccent: contact.headlineAccent, body: contact.body,
        footnote: contact.footnote,
        ctas: (contact.ctas || []).map(function (c) {
          return { id: c.id, stage: c.stage, label: c.label, primary: !!c.primary };
        })
      };
    }
    if (lead) {
      cfg.lead = cfg.lead || {};
      cfg.lead.accessKey = lead.accessKey;
      cfg.lead.ownerEmail = lead.ownerEmail;
      cfg.lead.subjectPrefix = lead.subjectPrefix;
      cfg.lead.forms = cfg.lead.forms || {};
      docsByType(content, "leadForm").forEach(function (f) {
        cfg.lead.forms[f.id] = { title: f.title, intro: f.intro,
                                 submitLabel: f.submitLabel, fields: f.fields };
      });
    }
    if (access) {
      // Sign-in form copy only (title/labels/error text) -- access.json
      // carries no credentials since Phase 2; auth itself is Supabase
      // (js/supabase-init.js + app.js authenticate()).
      cfg.accessUi = access.ui || {};
    }

    // active was loaded/mapped below (three-places rule, CLAUDE.md) but
    // never actually consumed anywhere on the site -- every real sector
    // document showed regardless of its value. Filtered here, once, at the
    // source: every consumer of cfg.categories (pillars, mobile drawer,
    // prev/next, deep-link validation -- js/app.js has many call sites)
    // already just reads this one list, so nothing else needs to change.
    // !== false (not === true) so a sector document that omits the field
    // entirely still shows -- matches js/admin.js's addSector() default.
    var sectors = docsByType(content, "sector").filter(function (s) {
      return s.active !== false;
    }).sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    if (sectors.length) {
      cfg.categories = sectors.map(function (s) {
        return {
          id: s.id, label: s.label, navSub: s.navSub, blurb: s.blurb,
          active: !!s.active, accent: s.accent, kicker: s.kicker,
          title: s.title, sub: s.sub, body: s.body,
          cards: (s.cards || []).map(function (c) {
            var card = { id: c.projectId, title: c.title, text: c.text };
            if (c.short) card.short = c.short;
            return card;
          })
        };
      });
    }

    var projects = docsByType(content, "project");
    if (projects.length) {
      cfg.examples = {};
      projects.forEach(function (p) {
        var ex = {
          sector: p.sectorId, title: p.title, tagline: p.tagline,
          overview: p.overview, project: p.project, access: p.access,
          capturedWith: p.capturedWith, platform: p.platform,
          links: (p.links || []).map(function (l, i) {
            // link-<1-based index>: matches the resource_key convention
            // functions/api/resource/[key].js resolves against (see
            // ACCESS-MODEL.md §4) -- position-based since links don't
            // carry an authored id of their own yet.
            return { id: "link-" + (i + 1), label: l.label, url: l.url,
                     kind: l.kind, access: l.access };
          }),
          gallery: (p.gallery || []).map(function (g) {
            return { src: srcValue(g.source), alt: g.alt || "" };
          }),
          sweepId: p.sweepId || null,
          evidence: p.evidence || {}
        };
        ex.experiences = projectExperiences(p).map(convertExperience).filter(Boolean);
        if (ex.experiences.length) ex.media = ex.experiences[0];   // legacy alias -- keep it
        cfg.examples[p.id] = ex;
      });
    }

    /* GIS documents pass through raw, keyed by id -- a deliberate exception
       to the flattening convention above. The GIS engine (js/gis/*, arriving
       Phase 3) reads its own schema directly rather than through a legacy
       translation layer. */
    cfg.gisMaps = {};
    docsByType(content, "gisMap").forEach(function (m) { cfg.gisMaps[m.id] = m; });
    cfg.gisTours = {};
    docsByType(content, "gisTour").forEach(function (t) { cfg.gisTours[t.id] = t; });
    // gisFeatureTour: which single map feature (by a stable attribute key,
    // not an ArcGIS internal OBJECTID -- some services don't report one)
    // opens which gisTour on click. Same raw pass-through as gisMap/gisTour
    // above -- js/app.js/js/gis/gis-tools.js read this schema directly.
    cfg.gisFeatureTours = {};
    docsByType(content, "gisFeatureTour").forEach(function (t) { cfg.gisFeatureTours[t.id] = t; });

    if (faq && faq.items) cfg.answers = faq.items;
    if (funFacts && funFacts.facts) cfg.funFacts = funFacts.facts;
    return cfg;
  }

  /* ---------- hex media normalisation ----------
     Canonical hex entry shape (data/pages/home.json → hexCluster[]):
       { slot, media: { _type: "image"|"video"|"model",
                        source: {kind, value},
                        alt?,                      (image)
                        border?,                   (any type — see below)
                        poster?: {kind, value},    (video/model, optional)
                        autoplayMode?,             (video — see below)
                        background?,               (model: "transparent" or CSS color)
                        autoRotate?,               (model)
                        iosSource?: {kind, value}  (model: optional .usdz for AR) } }
     border: "none" (default) | "stroke" | "brackets" | "vignette" |
             "badge" | "scanline" — purely visual; the WebGL clip/mask
             fix in 02-home.css .hex-clip applies to models regardless
             of this choice.
     autoplayMode (video only): "autoplay" (default, muted loop) |
             "hover" (plays only while hovered) | "none" (paused until
             the hex is clicked/expanded).
     Legacy entries that only have { image: {source, alt} } are migrated
     in place so the Admin Board and hex-media.js see one shape. */
  function normalizeHexEntry(h) {
    if (!h) return h;
    if (!h.media || !h.media._type) {
      var legacy = h.image || {};
      h.media = {
        _type: "image",
        source: legacy.source || { kind: "path", value: "" },
        alt: legacy.alt || ""
      };
    }
    if (!h.media.source) h.media.source = { kind: "path", value: "" };
    if (h.media.border == null) h.media.border = "none";
    if (h.media._type === "model") {
      if (h.media.background == null) h.media.background = "transparent";
      if (h.media.autoRotate == null) h.media.autoRotate = true;
    }
    if (h.media._type === "video" && h.media.autoplayMode == null) {
      h.media.autoplayMode = "autoplay";
    }
    return h;
  }
  window.DTS_NORMALIZE_HEX = normalizeHexEntry;   // shared with hex-media.js / admin.js

  /* ---------- apply home-page content to the DOM ---------- */
  function text(sel, value) {
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = value; });
  }
  function applyHome(content) {
    var home = content.docs["pages/home.json"];
    var settings = content.docs["site/settings.json"];
    if (!home) return;
    var hero = home.hero || {};

    // Headline supports one line break, marked with \n in the JSON.
    ["\u002ehome-headline", ".twin-card-headline"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.innerHTML = "";
        String(hero.headline || "").split("\n").forEach(function (line, i) {
          if (i) el.appendChild(document.createElement("br"));
          el.appendChild(document.createTextNode(line));
        });
      });
    });
    if (hero.kicker) text(".copy-kicker", hero.kicker);
    if (hero.body) { text(".home-body", hero.body); text(".twin-card-body", hero.body); }
    if (hero.pills) {
      document.querySelectorAll(".home-pills").forEach(function (wrap) {
        wrap.innerHTML = "";
        hero.pills.forEach(function (p) {
          var s = document.createElement("span"); s.textContent = p; wrap.appendChild(s);
        });
      });
    }
    /* Hexagon cluster — supports image / video / 3D-model media.
       Entries are normalised to h.media ({_type, source, …}); legacy
       documents that only carry h.image keep working. Images are
       painted here immediately (no flash of the built-in defaults);
       video and model media are hydrated by js/hex-media.js, which
       reads the same normalised entries. */
    (home.hexCluster || []).forEach(function (h) {
      normalizeHexEntry(h);
      var box = document.querySelector(".hexbox[data-slot='" + h.slot + "'], .hex." + h.slot);
      if (!box) return;
      if (h.media._type === "image") {
        var img = box.querySelector(".hex-media") || box;
        img.style.backgroundImage = "url('" + srcValue(h.media.source) + "')";
      }
    });
    if (home.primaryCta) {
      var cta = document.querySelector(".twin-cta");
      if (cta && home.primaryCta.label) cta.textContent = home.primaryCta.label;
      var fx = document.querySelector(".twin-cta-fx");
      if (fx && home.primaryCta.fxImage) fx.src = srcValue(home.primaryCta.fxImage.source);
    }
    if (home.evidenceBar) {
      var bar = document.querySelector(".evidence-bar");
      if (bar) {
        bar.innerHTML = "";
        home.evidenceBar.forEach(function (item) {
          var span = document.createElement("span");
          span.className = "evidence-item";
          var dot = document.createElement("span");
          dot.className = "evidence-dot"; dot.textContent = "\u25cf";
          span.appendChild(dot);
          span.appendChild(document.createTextNode(" " + item));
          bar.appendChild(span);
        });
      }
    }
    if (settings && settings.brand && settings.brand.logo) {
      var logo = document.querySelector(".brand-logo");
      if (logo) logo.src = srcValue(settings.brand.logo.source);
    }
  }

  /* ---------- admin gating ----------
     admin.js is the CMS (Admin Board). Ordinary visitors should never
     download or parse it, so it's only added to the script list when
     this browser is in an "admin context":
       - the URL carries ?admin or #admin -- bookmark this as the CMS
         entry point; visiting it once remembers the browser via
         localStorage so you don't need the flag every time
       - OR a draft is already saved (DRAFT_KEY) -- so an editor
         mid-session can still reopen/discard it after a reload even
         without the flag present in that particular URL */
  var ADMIN_FLAG_KEY = "dtsAdminMode";
  function isAdminContext() {
    try {
      if (/(^|[?&])admin(=1)?(&|$)/.test(location.search) || location.hash === "#admin") {
        localStorage.setItem(ADMIN_FLAG_KEY, "1");
        return true;
      }
      if (localStorage.getItem(ADMIN_FLAG_KEY) === "1") return true;
      if (localStorage.getItem(DRAFT_KEY)) return true;
    } catch (e) { /* storage unavailable -- default to no admin */ }
    return false;
  }

  /* ---------- boot the app scripts in order ---------- */
  function appScripts() {
    var list = ["js/app.js", "js/smoke-depth.js", "js/vision-pro-spatial.js", "js/hex-media.js"];
    if (isAdminContext()) list.push("js/admin.js");
    return list;
  }
  function injectScripts(list, done) {
    if (!list.length) { if (done) done(); return; }
    var s = document.createElement("script");
    s.src = list[0];
    s.onload = s.onerror = function () { injectScripts(list.slice(1), done); };
    document.body.appendChild(s);
  }

  /* ---------- config.js fallback loader ----------
     config.js is no longer a static <script> tag in index.html. When
     /data loads fine (the normal case) buildConfig() below gives
     app.js everything it needs and config.js is never downloaded at
     all. It's only pulled in here, on demand, when /data failed and
     app.js needs its baked-in fallback content instead. */
  function loadConfigFallback(done) {
    var s = document.createElement("script");
    s.src = "js/config.js";
    s.onload = s.onerror = done;
    document.head.appendChild(s);
  }

  function whenDOMReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  /* ---------- click-triggered admin load ----------
     The ?admin / #admin / draft checks above cover deliberate CMS
     entry points, but the everyday case is simpler: someone clicks
     ACCESS YOUR TWIN and types their normal admin credentials,
     exactly like a client would. For that to work, admin.js has to
     be loaded (and its capture-phase submit listener registered)
     BEFORE they hit submit -- so the click on #accessTwin itself
     starts loading it, giving it the several seconds a person takes
     to type an email + password to finish downloading and register.

     admin.js requires window.DTS_CONTENT to already be populated (it
     bails out otherwise), so injection waits for contentReady --
     which, on a fast click, may already be true; on a slow
     connection it queues until loadContent() resolves. */
  var contentReady = false;
  var contentReadyQueue = [];
  function markContentReady() {
    contentReady = true;
    contentReadyQueue.forEach(function (cb) { cb(); });
    contentReadyQueue = [];
  }
  function whenContentReady(cb) {
    if (contentReady) cb(); else contentReadyQueue.push(cb);
  }
  function ensureAdminBundle() {
    if (document.querySelector('script[src="js/admin.js"]')) return; // already loading/loaded
    whenContentReady(function () { injectScripts(["js/admin.js"]); });
  }
  function wireAdminTrigger() {
    var btn = document.getElementById("accessTwin");
    if (btn) btn.addEventListener("click", ensureAdminBundle);
  }
  whenDOMReady(wireAdminTrigger);

  loadContent()
    .then(function (content) {
      window.DTS_CONTENT = content;                 // raw documents (Admin Board edits these)
      window.DTS_CONFIG = buildConfig(content);     // legacy shape for app.js
      window.DTS_CONTENT_READY = true;              // js/intro-typewriter.js waits on this
      markContentReady();
      whenDOMReady(function () {
        applyHome(content);
        injectScripts(appScripts());
      });
    })
    .catch(function (err) {
      console.warn("[content] /data unavailable, using js/config.js fallback:", err);
      window.DTS_CONTENT = null;
      window.DTS_CONTENT_READY = true;              // config.js fallback is all we'll get -- don't hang the intro
      markContentReady();
      loadConfigFallback(function () {
        whenDOMReady(function () { injectScripts(appScripts()); });
      });
    });
})();
