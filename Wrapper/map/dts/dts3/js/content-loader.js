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

  function fetchJSON(path) {
    return fetch(path, { cache: "no-store" }).then(function (r) {
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
    return fetchJSON(DATA_ROOT + "manifest.json").then(function (manifest) {
      var files = flattenManifest(manifest);
      return Promise.all(files.map(function (f) {
        return fetchJSON(DATA_ROOT + f).then(function (doc) { return [f, doc]; });
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

  function convertMedia(m) {
    if (!m) return undefined;
    if (m._type === "treedis") {
      return { type: "treedis", label: m.label || "", tourUrl: m.tourUrl || "",
               origin: m.origin || "https://spaces.dtsxr.com" };
    }
    if (m._type === "video") {
      return { type: "vimeo", label: m.label || "",
               embedUrl: srcValue(m.embed), watchUrl: srcValue(m.watch) };
    }
    return undefined;
  }

  function buildConfig(content) {
    var cfg = window.DTS_CONFIG ? JSON.parse(JSON.stringify(window.DTS_CONFIG)) : {};
    var docs = content.docs;
    var settings = docs["site/settings.json"];
    var lead     = docs["site/lead.json"];
    var home     = docs["pages/home.json"];
    var contact  = docs["pages/contact.json"];
    var faq      = docs["faq/answers.json"];

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

    var sectors = docsByType(content, "sector").sort(function (a, b) {
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
          overview: p.overview, project: p.project,
          capturedWith: p.capturedWith, platform: p.platform,
          links: (p.links || []).map(function (l) { return { label: l.label, url: l.url }; }),
          gallery: (p.gallery || []).map(function (g) {
            return { src: srcValue(g.source), alt: g.alt || "" };
          }),
          sweepId: p.sweepId || null,
          evidence: p.evidence || {}
        };
        var media = convertMedia(p.media);
        if (media) ex.media = media;
        cfg.examples[p.id] = ex;
      });
    }

    if (faq && faq.items) cfg.answers = faq.items;
    return cfg;
  }

  /* ---------- hex media normalisation ----------
     Canonical hex entry shape (data/pages/home.json → hexCluster[]):
       { slot, media: { _type: "image"|"video"|"model",
                        source: {kind, value},
                        alt?,                      (image)
                        poster?: {kind, value},    (video/model, optional)
                        background?,               (model: "transparent" or CSS color)
                        autoRotate?,               (model)
                        iosSource?: {kind, value}  (model: optional .usdz for AR) } }
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
    if (h.media._type === "model") {
      if (h.media.background == null) h.media.background = "transparent";
      if (h.media.autoRotate == null) h.media.autoRotate = true;
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

  /* ---------- boot the app scripts in order ---------- */
  var APP_SCRIPTS = ["js/app.js", "js/smoke-depth.js", "js/vision-pro-spatial.js", "js/hex-media.js", "js/admin.js"];
  function injectScripts(list, done) {
    if (!list.length) { if (done) done(); return; }
    var s = document.createElement("script");
    s.src = list[0];
    s.onload = s.onerror = function () { injectScripts(list.slice(1), done); };
    document.body.appendChild(s);
  }

  function whenDOMReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  loadContent()
    .then(function (content) {
      window.DTS_CONTENT = content;                 // raw documents (Admin Board edits these)
      window.DTS_CONFIG = buildConfig(content);     // legacy shape for app.js
      whenDOMReady(function () {
        applyHome(content);
        injectScripts(APP_SCRIPTS);
      });
    })
    .catch(function (err) {
      console.warn("[content] /data unavailable, using js/config.js fallback:", err);
      window.DTS_CONTENT = null;
      whenDOMReady(function () { injectScripts(APP_SCRIPTS); });
    });
})();
