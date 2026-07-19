/* ============================================================
   DTS Admin Board — mini CMS  (js/admin.js)
   ------------------------------------------------------------
   Signing in through ACCESS YOUR TWIN with an admin account
   (data/access.json → adminUsers, or a directory row whose
   client is "admin") opens the Admin Board instead of the
   client portal.

   The board edits the raw documents in window.DTS_CONTENT
   (loaded by js/content-loader.js from /data). Editing model:

     1. Edit any document in the board.
     2. SAVE DRAFT & PREVIEW — stores a full snapshot of all
        documents in localStorage and reloads. The loader then
        renders the site from the draft: instant live preview.
     3. EXPORT DATA FOLDER — downloads data.zip (the updated
        /data folder). Replace the repo's data/ with it and
        push: that's publishing.
     4. DISCARD DRAFT — back to whatever is in /data on disk.

   Requires no changes to js/app.js: an event listener in the
   capture phase intercepts the sign-in submit before app.js
   sees it when the credentials match an admin account.
   ============================================================ */
(function () {
  "use strict";
  if (!window.DTS_CONTENT || !window.DTS_CONTENT.docs) {
    console.warn("[admin] /data content not loaded — Admin Board disabled.");
    return;
  }

  var DRAFT_KEY = "dtsAdminDraft";
  var SESSION_KEY = "dtsAdminSession";
  var content = window.DTS_CONTENT;          // live working set (edited in place)
  var docs = content.docs;
  var dirty = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ============================================================
     ADMIN AUTHENTICATION
     ============================================================ */
  var adminAccounts = [];

  function registerAdmins(list) {
    (list || []).forEach(function (a) {
      if (a && a.access_id && a.access_code) {
        adminAccounts.push({ id: String(a.access_id).toLowerCase().trim(),
                             code: String(a.access_code).trim() });
      }
    });
  }

  // Source 1: data/access.json adminUsers
  var accessDoc = docs["access/access.json"] || {};
  registerAdmins(accessDoc.adminUsers);

  // Source 2: Google-Sheet directory rows flagged as admin
  (function preloadSheetAdmins() {
    var url = (window.DTS_CLIENTS && window.DTS_CLIENTS.sheetCsvUrl) ||
              (accessDoc.directorySource && accessDoc.directorySource.sheetCsvUrl);
    if (!url) return;
    fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (text) {
        if (!text) return;
        var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
        var headers = splitCSV(lines.shift()).map(function (h) { return h.trim().toLowerCase(); });
        lines.forEach(function (line) {
          var cells = splitCSV(line), row = {};
          headers.forEach(function (h, i) { row[h] = (cells[i] || "").trim(); });
          var isAdmin = (row.client || "").toLowerCase() === "admin" ||
                        (row.notes || "").toLowerCase().indexOf("admin") !== -1 &&
                        (row.twin_url || "").toLowerCase() === "all";
          if (isAdmin) registerAdmins([row]);
        });
      })
      .catch(function () { /* sheet unreachable — access.json admins still work */ });
  })();

  function splitCSV(line) {
    var out = [], field = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') q = false;
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(field); field = ""; }
      else field += ch;
    }
    out.push(field);
    return out;
  }

  function isAdminLogin(id, code) {
    id = String(id || "").toLowerCase().trim();
    code = String(code || "").trim();
    return adminAccounts.some(function (a) { return a.id === id && a.code === code; });
  }

  // Intercept the Access Your Twin submit BEFORE app.js (capture phase).
  document.addEventListener("submit", function (e) {
    if (!e.target || e.target.id !== "accessForm") return;
    e.preventDefault();   // never let the browser navigate, even if app.js failed
    var id = ($("#accessId") || {}).value, code = ($("#accessCode") || {}).value;
    if (!isAdminLogin(id, code)) return;   // normal clients fall through to app.js
    e.stopImmediatePropagation();
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (_) {}
    var ov = $("#accessOverlay");
    if (ov) { ov.classList.remove("is-open"); ov.setAttribute("aria-hidden", "true"); }
    var codeInput = $("#accessCode"); if (codeInput) codeInput.value = "";
    openBoard();
  }, true);

  /* ============================================================
     SMALL DOM HELPERS
     ============================================================ */
  function el(tag, cls, textContent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (textContent !== undefined) n.textContent = textContent;
    return n;
  }
  function markDirty() {
    dirty = true;
    var s = $("#admStatus");
    if (s) { s.textContent = "Unsaved changes — Save draft & preview to see them on the site."; s.classList.add("is-dirty"); }
  }
  function srcVal(s) { return (s && s.value) || ""; }

  /* ============================================================
     FIELD BUILDERS  (all write straight into the document objects)
     ============================================================ */
  function fText(parent, label, obj, key, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field" + (opts.half ? " half" : ""));
    wrap.appendChild(el("label", "adm-label", label));
    var input = el(opts.textarea ? "textarea" : "input", "adm-input");
    if (!opts.textarea) input.type = opts.type || "text";
    if (opts.textarea) input.rows = opts.rows || 3;
    input.value = obj[key] == null ? "" : obj[key];
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener("input", function () { obj[key] = input.value; markDirty(); });
    wrap.appendChild(input);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
    return input;
  }

  function fCheck(parent, label, obj, key, hint) {
    var wrap = el("div", "adm-field adm-check");
    var lab = el("label", "adm-checklabel");
    var input = el("input"); input.type = "checkbox"; input.checked = !!obj[key];
    input.addEventListener("change", function () { obj[key] = input.checked; markDirty(); });
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(" " + label));
    wrap.appendChild(lab);
    if (hint) wrap.appendChild(el("p", "adm-hint", hint));
    parent.appendChild(wrap);
  }

  function fColor(parent, label, obj, key) {
    var wrap = el("div", "adm-field half");
    wrap.appendChild(el("label", "adm-label", label));
    var row = el("div", "adm-colorrow");
    var color = el("input"); color.type = "color"; color.value = obj[key] || "#ffffff";
    var textIn = el("input", "adm-input"); textIn.type = "text"; textIn.value = obj[key] || "";
    color.addEventListener("input", function () { obj[key] = color.value; textIn.value = color.value; markDirty(); });
    textIn.addEventListener("input", function () { obj[key] = textIn.value; try { color.value = textIn.value; } catch (_) {} markDirty(); });
    row.appendChild(color); row.appendChild(textIn);
    wrap.appendChild(row);
    parent.appendChild(wrap);
  }

  /* A file reference that can be a local path or an external link. */
  function fSource(parent, label, sourceObj, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field");
    wrap.appendChild(el("label", "adm-label", label));
    var row = el("div", "adm-sourcerow");
    var kind = el("select", "adm-select adm-kind");
    [["path", "Local file path"], ["url", "External link"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; kind.appendChild(opt);
    });
    kind.value = sourceObj.kind === "url" ? "url" : "path";
    var input = el("input", "adm-input"); input.type = "text";
    input.value = sourceObj.value || "";
    input.placeholder = kind.value === "url" ? "https://…" : "assets/portfolio/photo.jpg";
    var preview = null;
    if (opts.imagePreview) {
      preview = el("img", "adm-imgpreview");
      preview.alt = ""; preview.src = sourceObj.value || "";
      preview.onerror = function () { preview.style.display = "none"; };
      preview.onload = function () { preview.style.display = ""; };
    }
    function commit() {
      sourceObj.kind = kind.value;
      sourceObj.value = input.value.trim();
      input.placeholder = kind.value === "url" ? "https://…" : "assets/portfolio/photo.jpg";
      if (preview) { preview.style.display = ""; preview.src = sourceObj.value; }
      markDirty();
    }
    kind.addEventListener("change", commit);
    input.addEventListener("input", commit);
    row.appendChild(kind); row.appendChild(input);
    wrap.appendChild(row);
    if (preview) wrap.appendChild(preview);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
  }

  /* Generic add/remove list of sub-items. */
  function fList(parent, title, arr, renderItem, makeNew, addLabel) {
    var box = el("div", "adm-listbox");
    var head = el("div", "adm-listhead");
    head.appendChild(el("span", "adm-listtitle", title));
    var add = el("button", "adm-btn adm-btn-small", addLabel || "+ Add");
    add.type = "button";
    head.appendChild(add);
    box.appendChild(head);
    var itemsWrap = el("div", "adm-listitems");
    box.appendChild(itemsWrap);

    function draw() {
      itemsWrap.innerHTML = "";
      arr.forEach(function (item, i) {
        var card = el("div", "adm-listitem");
        var bar = el("div", "adm-itembar");
        bar.appendChild(el("span", "adm-itemno", "#" + (i + 1)));
        var del = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Remove");
        del.type = "button";
        del.addEventListener("click", function () {
          arr.splice(i, 1); markDirty(); draw();
        });
        bar.appendChild(del);
        card.appendChild(bar);
        renderItem(card, item, i);
        itemsWrap.appendChild(card);
      });
      if (!arr.length) itemsWrap.appendChild(el("p", "adm-hint", "Nothing here yet."));
    }
    add.addEventListener("click", function () {
      arr.push(makeNew()); markDirty(); draw();
    });
    draw();
    parent.appendChild(box);
  }

  /* Simple list of strings (pills, evidence bar, prompts). */
  function fStringList(parent, title, arr) {
    fList(parent, title, arr, function (card, item, i) {
      var input = el("input", "adm-input"); input.type = "text"; input.value = arr[i];
      input.addEventListener("input", function () { arr[i] = input.value; markDirty(); });
      card.appendChild(input);
    }, function () { return ""; });
  }

  function section(parent, title, hint) {
    var s = el("section", "adm-section");
    s.appendChild(el("h3", "adm-sectiontitle", title));
    if (hint) s.appendChild(el("p", "adm-hint", hint));
    parent.appendChild(s);
    return s;
  }

  /* ============================================================
     EDITORS
     ============================================================ */
  function editHome(pane) {
    var home = docs["pages/home.json"];
    if (!home) { pane.appendChild(el("p", "adm-hint", "pages/home.json missing.")); return; }
    var s1 = section(pane, "Hero", "The main copy on the landing view.");
    fText(s1, "Kicker (small line above the headline)", home.hero, "kicker");
    fText(s1, "Headline — use one line break where the text should wrap", home.hero, "headline", { textarea: true, rows: 2 });
    fText(s1, "Body paragraph", home.hero, "body", { textarea: true, rows: 4 });
    fStringList(s1, "Pills (Campus / Company / City / Community)", home.hero.pills);

    var s2 = section(pane, "Hexagon images", "The four picture hexagons next to the headline. Each can point to a file in the site (e.g. assets/…) or an external link.");
    (home.hexCluster || []).forEach(function (h) {
      fSource(s2, h.slot.toUpperCase() + " image", h.image.source, { imagePreview: true });
      fText(s2, h.slot.toUpperCase() + " alt text", h.image, "alt");
    });

    var s3 = section(pane, "Primary button");
    fText(s3, "Button label", home.primaryCta, "label");
    fSource(s3, "Arrow-burst graphic behind the button", home.primaryCta.fxImage.source, { imagePreview: true });

    var s4 = section(pane, "Evidence bar", "The row of framework references along the bottom of the home view.");
    fStringList(s4, "Items", home.evidenceBar);

    var s5 = section(pane, "Info card over the live twin", "Shown when a visitor presses the main button and the twin takes over the screen.");
    fText(s5, "Kicker", home.twinRevealCard, "kicker");
    fText(s5, "Headline", home.twinRevealCard, "headline", { textarea: true, rows: 2 });
    fText(s5, "Body", home.twinRevealCard, "body", { textarea: true, rows: 3 });
    fStringList(s5, "Pills", home.twinRevealCard.pills);

    var s6 = section(pane, "Question-bar suggestions", "Rotating placeholder questions in the search bar.");
    fStringList(s6, "Prompts", home.questionPrompts);
  }

  function editContact(pane) {
    var c = docs["pages/contact.json"];
    if (!c) { pane.appendChild(el("p", "adm-hint", "pages/contact.json missing.")); return; }
    var s1 = section(pane, "Contact panel", "The \u201cReady to begin?\u201d panel inside every category.");
    fText(s1, "Kicker", c, "kicker");
    fText(s1, "Headline", c, "headline");
    fText(s1, "Headline accent (gold part)", c, "headlineAccent");
    fText(s1, "Body", c, "body", { textarea: true, rows: 3 });
    fText(s1, "Footnote", c, "footnote");
    var s2 = section(pane, "Buttons");
    (c.ctas || []).forEach(function (cta) {
      var box = el("div", "adm-listitem");
      box.appendChild(el("p", "adm-itemtitle", cta.id.toUpperCase()));
      fText(box, "Stage tag", cta, "stage", { half: true });
      fText(box, "Label", cta, "label", { half: true });
      fCheck(box, "Primary (gold) button", cta, "primary");
      s2.appendChild(box);
    });
  }

  function editSector(pane, file) {
    var s = docs[file];
    if (!s) return;
    var s1 = section(pane, "Category page — " + s.label);
    fText(s1, "Menu label", s, "label", { half: true });
    fText(s1, "Menu sublabel", s, "navSub", { half: true });
    fText(s1, "Kicker", s, "kicker", { half: true });
    fColor(s1, "Accent color", s, "accent");
    fText(s1, "Title", s, "title");
    fText(s1, "Subtitle", s, "sub");
    fText(s1, "Body", s, "body", { textarea: true, rows: 4 });
    fText(s1, "One-line blurb (used in navigation)", s, "blurb");

    var s2 = section(pane, "Cards", "The four use-case cards. Each card opens the project it points to — edit the project itself under PROJECTS.");
    fList(s2, "Cards", s.cards, function (card, item) {
      card.appendChild(el("p", "adm-itemtitle", "Opens project: " + item.projectId));
      fText(card, "Card title", item, "title");
      fText(card, "Short title (mobile, optional)", item, "short");
      fText(card, "Card text", item, "text", { textarea: true, rows: 2 });
      var sel = el("select", "adm-select");
      projectFiles().forEach(function (pf) {
        var p = docs[pf];
        var opt = el("option", null, p.title + " (" + p.id + ")");
        opt.value = p.id;
        sel.appendChild(opt);
      });
      sel.value = item.projectId;
      var wrap = el("div", "adm-field");
      wrap.appendChild(el("label", "adm-label", "Project this card opens"));
      wrap.appendChild(sel);
      sel.addEventListener("change", function () { item.projectId = sel.value; markDirty(); });
      card.appendChild(wrap);
    }, function () {
      var first = projectFiles()[0];
      return { projectId: first ? docs[first].id : "", title: "New card", text: "" };
    }, "+ Add card");
  }

  function mediaEditor(parent, project) {
    var box = section(parent, "Main experience", "What plays in the big pane of this project's window: a live Treedis experience, a Vimeo video, or nothing (the shared showcase twin is reused).");
    var holder = el("div");
    box.appendChild(holder);

    function draw() {
      holder.innerHTML = "";
      var typeWrap = el("div", "adm-field");
      typeWrap.appendChild(el("label", "adm-label", "Type"));
      var sel = el("select", "adm-select");
      [["none", "None — reuse the shared showcase twin"],
       ["treedis", "Treedis experience (interactive twin)"],
       ["video", "Vimeo video"]].forEach(function (o) {
        var opt = el("option", null, o[1]); opt.value = o[0]; sel.appendChild(opt);
      });
      sel.value = project.media ? project.media._type : "none";
      sel.addEventListener("change", function () {
        if (sel.value === "none") delete project.media;
        else if (sel.value === "treedis") {
          project.media = { _type: "treedis", label: "Explore the experience",
                            tourUrl: "https://spaces.dtsxr.com/tour/", 
                            origin: "https://spaces.dtsxr.com", sweepId: null };
        } else {
          project.media = { _type: "video", provider: "vimeo", label: "Watch the video",
                            embed: { kind: "url", value: "https://player.vimeo.com/video/" },
                            watch: { kind: "url", value: "https://vimeo.com/" } };
        }
        markDirty(); draw();
      });
      typeWrap.appendChild(sel);
      holder.appendChild(typeWrap);

      var m = project.media;
      if (m && m._type === "treedis") {
        fText(holder, "Button / pane label", m, "label");
        fText(holder, "Treedis tour URL", m, "tourUrl", { placeholder: "https://spaces.dtsxr.com/tour/xxxx" });
        fText(holder, "Treedis origin", m, "origin");
        fText(holder, "Sweep ID (optional landing sweep)", m, "sweepId", { hint: "Leave blank to open at the model default." });
      } else if (m && m._type === "video") {
        fText(holder, "Video label", m, "label");
        fSource(holder, "Embed (player URL, or a local video file)", m.embed);
        if (!m.watch) m.watch = { kind: "url", value: "" };
        fSource(holder, "Watch link (public page, optional)", m.watch);
      }
    }
    draw();
  }

  function editProject(pane, file) {
    var p = docs[file];
    if (!p) return;
    var s1 = section(pane, "Project — " + p.title);
    var secWrap = el("div", "adm-field half");
    secWrap.appendChild(el("label", "adm-label", "Category"));
    var secSel = el("select", "adm-select");
    sectorFiles().forEach(function (sf) {
      var s = docs[sf];
      var opt = el("option", null, s.label); opt.value = s.id; secSel.appendChild(opt);
    });
    secSel.value = p.sectorId;
    secSel.addEventListener("change", function () { p.sectorId = secSel.value; markDirty(); buildNav(); });
    secWrap.appendChild(secSel);
    s1.appendChild(secWrap);
    fText(s1, "Title", p, "title", { half: true });
    fText(s1, "Tagline (one line under the title)", p, "tagline");
    fText(s1, "Overview", p, "overview", { textarea: true, rows: 4 });
    fText(s1, "Captured with", p, "capturedWith", { half: true });
    fText(s1, "Platform", p, "platform", { half: true });

    var s2 = section(pane, "Featured project");
    fText(s2, "Name", p.project, "name");
    fText(s2, "Kind (e.g. \u201cActive project · USDA-commissioned\u201d)", p.project, "kind");
    fText(s2, "Blurb", p.project, "blurb", { textarea: true, rows: 4 });
    fCheck(s2, "Illustrative placeholder (swap for a real project later)", p.project, "illustrative");

    mediaEditor(pane, p);

    var s3 = section(pane, "Related links", "Chips under the experience — tours, videos, Matterport links.");
    fList(s3, "Links", p.links, function (card, item) {
      fText(card, "Label", item, "label");
      fText(card, "URL", item, "url", { placeholder: "https://…" });
    }, function () { return { _type: "link", label: "New link", url: "https://", kind: "external" }; }, "+ Add link");

    var s4 = section(pane, "Image gallery");
    fList(s4, "Images", p.gallery, function (card, item) {
      fSource(card, "Image (site path or external link)", item.source, { imagePreview: true });
      fText(card, "Alt text", item, "alt");
    }, function () { return { _type: "image", source: { kind: "path", value: "assets/portfolio/" }, alt: "" }; }, "+ Add image");

    var s5 = section(pane, "Project evidence", "One entry per tab in the evidence bar.");
    var labels = (docs["site/settings.json"] || {}).evidenceFilterLabels ||
                 Object.keys(p.evidence || {});
    if (!p.evidence) p.evidence = {};
    labels.forEach(function (label) {
      if (p.evidence[label] == null) p.evidence[label] = "\u2014";
      fText(s5, label, p.evidence, label, { textarea: true, rows: 2 });
    });

    var s6 = section(pane, "Fallback sweep");
    fText(s6, "Sweep ID for the shared showcase (optional)", p, "sweepId");

    var danger = section(pane, "Danger zone");
    var delBtn = el("button", "adm-btn adm-btn-danger", "Delete this project");
    delBtn.type = "button";
    delBtn.addEventListener("click", function () {
      if (!confirm("Delete \u201c" + p.title + "\u201d? Its category card will also be removed.")) return;
      deleteProject(file);
    });
    danger.appendChild(delBtn);
  }

  /* ============================================================
     ADD / DELETE PROJECTS  (docs + sector card + manifest)
     ============================================================ */
  function sectorFiles() {
    return Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === "sector"; })
      .sort(function (a, b) { return docs[a].order - docs[b].order; });
  }
  function projectFiles() {
    return Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === "project"; })
      .sort(function (a, b) { return docs[a].title.localeCompare(docs[b].title); });
  }

  function addProject() {
    var id = prompt("Short id for the new project (letters/numbers only, e.g. museum):");
    if (!id) return;
    id = id.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!id) return alert("That id isn't usable.");
    var file = "projects/" + id + ".json";
    if (docs[file]) return alert("A project with that id already exists.");
    var firstSector = docs[sectorFiles()[0]];
    var evidence = {};
    var labels = (docs["site/settings.json"] || {}).evidenceFilterLabels || [];
    labels.forEach(function (l) { evidence[l] = "\u2014"; });
    docs[file] = {
      _id: "project." + id, _type: "project", id: id,
      sectorId: firstSector ? firstSector.id : "education",
      title: "New Project", tagline: "New use case.", overview: "",
      project: { name: "New Project", kind: "In development", illustrative: true, blurb: "" },
      capturedWith: "", platform: "",
      links: [], gallery: [], sweepId: null,
      evidence: evidence
    };
    // Register in the manifest so loaders and future tools see it.
    content.manifest.documents.projects.push({ file: file, type: "project", id: "project." + id });
    // Give it a card in its sector so it is reachable on the site.
    if (firstSector) {
      firstSector.cards.push({ projectId: id, title: "New Project", text: "New use case." });
    }
    markDirty(); buildNav(); select("project:" + file);
  }

  function deleteProject(file) {
    var p = docs[file];
    delete docs[file];
    content.manifest.documents.projects =
      content.manifest.documents.projects.filter(function (e) { return e.file !== file; });
    sectorFiles().forEach(function (sf) {
      docs[sf].cards = docs[sf].cards.filter(function (c) { return c.projectId !== p.id; });
    });
    markDirty(); buildNav(); select("home");
  }

  /* ============================================================
     SAVE DRAFT / DISCARD / EXPORT
     ============================================================ */
  function saveDraft(reload) {
    var draft = { version: 1, savedAt: new Date().toISOString(),
                  manifest: content.manifest, docs: docs };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      dirty = false;
      if (reload) window.location.reload();
      else {
        var s = $("#admStatus");
        if (s) { s.textContent = "Draft saved."; s.classList.remove("is-dirty"); }
      }
    } catch (e) { alert("Couldn't save the draft: " + e.message); }
  }

  function discardDraft() {
    if (!confirm("Discard the draft and go back to the published data files?")) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    window.location.reload();
  }

  function exportData() {
    var files = {};
    files["manifest.json"] = JSON.stringify(content.manifest, null, 2) + "\n";
    Object.keys(docs).forEach(function (f) {
      files[f] = JSON.stringify(docs[f], null, 2) + "\n";
    });
    // Try to zip (JSZip from cdnjs); fall back to individual downloads.
    loadJSZip().then(function (JSZip) {
      var zip = new JSZip();
      var root = zip.folder("data");
      Object.keys(files).forEach(function (f) { root.file(f, files[f]); });
      return zip.generateAsync({ type: "blob" }).then(function (blob) {
        triggerDownload(URL.createObjectURL(blob), "data.zip");
      });
    }).catch(function () {
      Object.keys(files).forEach(function (f) {
        var blob = new Blob([files[f]], { type: "application/json" });
        triggerDownload(URL.createObjectURL(blob), f.replace(/\//g, "__"));
      });
      alert("Zip library unavailable — files downloaded individually. Filenames use \u201c__\u201d for folders (projects__campus.json → data/projects/campus.json).");
    });
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = function () { window.JSZip ? resolve(window.JSZip) : reject(new Error("no JSZip")); };
      s.onerror = function () { reject(new Error("load failed")); };
      document.body.appendChild(s);
    });
  }

  function triggerDownload(url, name) {
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ============================================================
     BOARD SHELL
     ============================================================ */
  var board = null, navEl = null, paneEl = null, activeKey = "home";

  var BACKUP_KEY = "dtsAdminDraftBackup";

  function maybeOfferBackup() {
    var raw = null;
    try { raw = localStorage.getItem(BACKUP_KEY); } catch (_) {}
    if (!raw) return;
    var hasDraft = false;
    try { hasDraft = !!localStorage.getItem(DRAFT_KEY); } catch (_) {}
    var msg = hasDraft
      ? "A rescued draft from an earlier session exists. Restore it? (This replaces your current draft.)"
      : "A rescued draft from an earlier session exists (it was set aside because it couldn't be loaded safely). Try restoring it?";
    if (confirm(msg)) {
      try {
        localStorage.setItem(DRAFT_KEY, raw);
        localStorage.removeItem(BACKUP_KEY);
      } catch (_) {}
      window.location.reload();
    } else if (confirm("Delete the rescued draft permanently? (Cancel keeps it for later.)")) {
      try { localStorage.removeItem(BACKUP_KEY); } catch (_) {}
    }
  }

  function openBoard() {
    if (!board) buildBoard();
    board.classList.add("is-open");
    document.body.classList.add("adm-lock");
    select(activeKey);
    setTimeout(maybeOfferBackup, 150);
  }
  function closeBoard(signOut) {
    if (dirty && !confirm("You have unsaved changes. Close anyway? (They stay in the editor until you reload.)")) return;
    board.classList.remove("is-open");
    document.body.classList.remove("adm-lock");
    if (signOut) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
      var chip = $("#admChip"); if (chip) chip.remove();
    } else showChip();
  }

  function buildBoard() {
    board = el("div", "adm-board");
    board.id = "adminBoard";

    var top = el("header", "adm-top");
    var brand = el("div", "adm-brand");
    brand.appendChild(el("span", "adm-brand-dts", "DTS"));
    brand.appendChild(el("span", "adm-brand-title", "Admin Board"));
    top.appendChild(brand);
    var status = el("span", "adm-status", "");
    status.id = "admStatus";
    top.appendChild(status);
    var actions = el("div", "adm-actions");
    var bSave = el("button", "adm-btn adm-btn-gold", "Save draft & preview");
    bSave.type = "button";
    bSave.title = "Saves your edits in this browser and reloads the site so you can see them live.";
    bSave.addEventListener("click", function () { saveDraft(true); });
    var bExport = el("button", "adm-btn", "Export data folder");
    bExport.type = "button";
    bExport.title = "Downloads data.zip — replace the site's data/ folder with it to publish.";
    bExport.addEventListener("click", exportData);
    var bDiscard = el("button", "adm-btn adm-btn-ghost", "Discard draft");
    bDiscard.type = "button";
    bDiscard.addEventListener("click", discardDraft);
    var bClose = el("button", "adm-btn adm-btn-ghost", "Sign out");
    bClose.type = "button";
    bClose.addEventListener("click", function () { closeBoard(true); });
    var bMin = el("button", "adm-btn adm-btn-ghost", "View site");
    bMin.type = "button";
    bMin.title = "Hide the board and look at the site — a small Admin chip brings you back.";
    bMin.addEventListener("click", function () { closeBoard(false); });
    [bSave, bExport, bDiscard, bMin, bClose].forEach(function (b) { actions.appendChild(b); });
    top.appendChild(actions);
    board.appendChild(top);

    var body = el("div", "adm-body");
    navEl = el("nav", "adm-nav");
    paneEl = el("main", "adm-pane");
    body.appendChild(navEl); body.appendChild(paneEl);
    board.appendChild(body);
    document.body.appendChild(board);
    buildNav();
  }

  function navBtn(label, key, sub) {
    var b = el("button", "adm-navbtn" + (sub ? " sub" : ""), label);
    b.type = "button";
    b.dataset.key = key;
    b.addEventListener("click", function () { select(key); });
    navEl.appendChild(b);
    return b;
  }

  function buildNav() {
    if (!navEl) return;
    navEl.innerHTML = "";
    navEl.appendChild(el("p", "adm-navhead", "SITE"));
    navBtn("Home page", "home");
    navBtn("Contact panel", "contact");
    navEl.appendChild(el("p", "adm-navhead", "CATEGORY PAGES"));
    sectorFiles().forEach(function (f) { navBtn(docs[f].label, "sector:" + f); });
    navEl.appendChild(el("p", "adm-navhead", "PROJECTS"));
    sectorFiles().forEach(function (sf) {
      var s = docs[sf];
      navEl.appendChild(el("p", "adm-navgroup", s.label));
      projectFiles().filter(function (pf) { return docs[pf].sectorId === s.id; })
        .forEach(function (pf) { navBtn(docs[pf].title, "project:" + pf, true); });
    });
    var orphans = projectFiles().filter(function (pf) {
      return !sectorFiles().some(function (sf) { return docs[sf].id === docs[pf].sectorId; });
    });
    if (orphans.length) {
      navEl.appendChild(el("p", "adm-navgroup", "Unassigned"));
      orphans.forEach(function (pf) { navBtn(docs[pf].title, "project:" + pf, true); });
    }
    var add = el("button", "adm-btn adm-btn-small adm-addproject", "+ Add project");
    add.type = "button";
    add.addEventListener("click", addProject);
    navEl.appendChild(add);
    highlightNav();
  }

  function highlightNav() {
    if (!navEl) return;
    Array.prototype.forEach.call(navEl.querySelectorAll(".adm-navbtn"), function (b) {
      b.classList.toggle("is-active", b.dataset.key === activeKey);
    });
  }

  function select(key) {
    activeKey = key;
    highlightNav();
    paneEl.innerHTML = "";
    if (key === "home") editHome(paneEl);
    else if (key === "contact") editContact(paneEl);
    else if (key.indexOf("sector:") === 0) editSector(paneEl, key.slice(7));
    else if (key.indexOf("project:") === 0) {
      var file = key.slice(8);
      if (docs[file]) editProject(paneEl, file);
      else select("home");
    }
    paneEl.scrollTop = 0;
  }

  /* Floating chip to return to the board while previewing the site. */
  function showChip() {
    if ($("#admChip")) return;
    var chip = el("button", "adm-chip", "\u2699 Admin");
    chip.id = "admChip";
    chip.type = "button";
    chip.title = "Back to the Admin Board";
    chip.addEventListener("click", openBoard);
    document.body.appendChild(chip);
  }

  // Returning from a Save & Preview reload: offer the chip right away.
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") showChip();
  } catch (_) {}
})();
