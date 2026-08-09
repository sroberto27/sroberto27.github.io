/* ============================================================
   DTS Admin Board — mini CMS  (js/admin.js)
   ------------------------------------------------------------
   Signing in through ACCESS YOUR TWIN is the SAME Supabase login
   every client uses (js/app.js's submitAccess()) — there is no
   separate admin credential list anymore. Once app.js has a real
   session it dispatches "dts:signed-in" with the signed-in user's
   site_role; this module listens for that event and opens the
   Admin Board only when site_role is "site_admin" (never for an
   org_admin — that's a different axis entirely, see
   docs/migration/ACCESS-MODEL.md §8). app.js itself skips opening
   the client portal for a site_admin session, so this listener is
   the only thing that gives that session somewhere to go.

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
   ============================================================ */
(function () {
  "use strict";
  if (!window.DTS_CONTENT || !window.DTS_CONTENT.docs) {
    console.warn("[admin] /data content not loaded — Admin Board disabled.");
    return;
  }

  var DRAFT_KEY = "dtsAdminDraft";
  var content = window.DTS_CONTENT;          // live working set (edited in place)
  var docs = content.docs;
  var dirty = false;
  // One-shot hook an editor can register to run just before the very next
  // markDirty() -- used for legacy-shape migrations that must only happen on
  // the FIRST real edit, never just from opening the editor (see
  // experiencesEditor()). select() clears it on every pane switch so a stale
  // hook from a previously-viewed project can never fire against the wrong
  // document.
  var preDirtyHook = null;
  // The live GIS preview instance for whichever gismap:/gistour: pane is
  // currently open, if any -- select() tears it down before building the
  // next pane so a backgrounded Leaflet instance never keeps making network
  // requests after its DOM is gone (same discipline as suspend()/destroy()
  // in js/app.js's own GIS instance cache).
  var currentGisPreview = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ============================================================
     ADMIN AUTH ROUTING
     ------------------------------------------------------------
     No credentials or account list here — every sign-in goes
     through the same Supabase form in js/app.js. This just reacts
     once a real session exists: site_admin -> Admin Board, anyone
     else -> untouched (app.js already sends them to the ordinary
     client portal).
     ============================================================ */
  document.addEventListener("dts:signed-in", function (e) {
    var session = e.detail && e.detail.session;
    if (!session || session.siteRole !== "site_admin") return;
    var ov = $("#accessOverlay");
    if (ov) { ov.classList.remove("is-open"); ov.setAttribute("aria-hidden", "true"); }
    // restored: true means this came from restoreSession() finding an
    // already-existing session on page load (including the reload Save
    // draft & preview triggers) -- offer the chip, don't yank the reader
    // straight back into the editor over whatever they reloaded to see.
    // restored: false is a real, just-now sign-in submit -- go straight in,
    // same as the old capture-phase intercept did.
    if (e.detail.restored) showChip();
    else openBoard();
  });

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
    if (preDirtyHook) preDirtyHook();
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

  /* A labelled dropdown from an [value, label] option list. */
  function fSelect(parent, label, obj, key, options, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field" + (opts.half ? " half" : ""));
    wrap.appendChild(el("label", "adm-label", label));
    var sel = el("select", "adm-select");
    options.forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; sel.appendChild(opt);
    });
    sel.value = obj[key] == null ? options[0][0] : obj[key];
    sel.addEventListener("change", function () { obj[key] = sel.value; markDirty(); if (opts.onChange) opts.onChange(); });
    wrap.appendChild(sel);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
    return sel;
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

  /* ============================================================
     FIELD BUILDERS — Phase 5 additions (06-SPEC-cms-admin.md §1)
     ============================================================ */
  function fNumber(parent, label, obj, key, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field" + (opts.half ? " half" : ""));
    wrap.appendChild(el("label", "adm-label", label));
    var row = el("div", "adm-numrow");
    var input = el("input", "adm-input"); input.type = "number";
    if (opts.min != null) input.min = opts.min;
    if (opts.max != null) input.max = opts.max;
    if (opts.step != null) input.step = opts.step;
    input.value = obj[key] == null ? "" : obj[key];
    input.addEventListener("input", function () {
      obj[key] = input.value === "" ? null : parseFloat(input.value);
      markDirty();
    });
    row.appendChild(input);
    if (opts.suffix) row.appendChild(el("span", "adm-suffix", opts.suffix));
    wrap.appendChild(row);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
    return input;
  }

  /* Slider + live value readout. */
  function fRange(parent, label, obj, key, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field" + (opts.half ? " half" : ""));
    wrap.appendChild(el("label", "adm-label", label));
    var row = el("div", "adm-rangerow");
    var input = el("input"); input.type = "range";
    input.min = opts.min != null ? opts.min : 0;
    input.max = opts.max != null ? opts.max : 1;
    input.step = opts.step != null ? opts.step : 0.05;
    input.value = obj[key] == null ? input.min : obj[key];
    var out = el("span", "adm-rangeval", String(input.value));
    input.addEventListener("input", function () {
      obj[key] = parseFloat(input.value);
      out.textContent = input.value;
      markDirty();
    });
    row.appendChild(input); row.appendChild(out);
    wrap.appendChild(row);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
    return input;
  }

  /* fList plus ▲▼ reorder — layer draw order, tour step order. Swapping two
     items also swaps any numeric fields named in opts.swapKeys on those two
     items (e.g. "zIndex"), so reordering in the CMS actually changes draw
     order in the engine, which reads zIndex per layer, not array position —
     see js/gis/gis-viewer.js's ensurePane(), one Leaflet pane per distinct
     zIndex. Only the two swapped items are touched; nothing else in the
     list is renumbered, so this stays a minimal, predictable diff. */
  function fListOrdered(parent, title, arr, renderItem, makeNew, addLabel, opts) {
    opts = opts || {};
    var swapKeys = opts.swapKeys || [];
    var box = el("div", "adm-listbox");
    var head = el("div", "adm-listhead");
    head.appendChild(el("span", "adm-listtitle", title));
    var add = el("button", "adm-btn adm-btn-small", addLabel || "+ Add");
    add.type = "button";
    head.appendChild(add);
    box.appendChild(head);
    var itemsWrap = el("div", "adm-listitems");
    box.appendChild(itemsWrap);

    function swap(i, j) {
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      swapKeys.forEach(function (k) {
        var t = arr[i][k]; arr[i][k] = arr[j][k]; arr[j][k] = t;
      });
      markDirty(); draw();
      if (opts.onChange) opts.onChange();
    }

    function draw() {
      itemsWrap.innerHTML = "";
      arr.forEach(function (item, i) {
        var card = el("div", "adm-listitem");
        var bar = el("div", "adm-itembar");
        bar.appendChild(el("span", "adm-itemno", "#" + (i + 1)));
        var btns = el("div", "adm-itembtns");
        var up = el("button", "adm-btn adm-btn-ghost adm-btn-small", "▲");
        up.type = "button"; up.title = "Move up"; up.disabled = i === 0;
        up.addEventListener("click", function () { swap(i, i - 1); });
        var down = el("button", "adm-btn adm-btn-ghost adm-btn-small", "▼");
        down.type = "button"; down.title = "Move down"; down.disabled = i === arr.length - 1;
        down.addEventListener("click", function () { swap(i, i + 1); });
        var del = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Remove");
        del.type = "button";
        del.addEventListener("click", function () {
          if (opts.beforeRemove && opts.beforeRemove(item, i) === false) return;
          arr.splice(i, 1); markDirty(); draw();
          if (opts.onChange) opts.onChange();
        });
        btns.appendChild(up); btns.appendChild(down); btns.appendChild(del);
        bar.appendChild(btns);
        card.appendChild(bar);
        renderItem(card, item, i);
        itemsWrap.appendChild(card);
      });
      if (!arr.length) itemsWrap.appendChild(el("p", "adm-hint", "Nothing here yet."));
    }
    add.addEventListener("click", function () {
      arr.push(makeNew()); markDirty(); draw();
      if (opts.onChange) opts.onChange();
    });
    draw();
    parent.appendChild(box);
    return { redraw: draw };
  }

  /* Editable string→string object — layers.opacity-style maps. */
  function fKeyValue(parent, title, obj, opts) {
    opts = opts || {};
    var keyLabel = opts.keyLabel || "Key";
    var valueLabel = opts.valueLabel || "Value";
    var box = el("div", "adm-listbox");
    var head = el("div", "adm-listhead");
    head.appendChild(el("span", "adm-listtitle", title));
    var add = el("button", "adm-btn adm-btn-small", "+ Add");
    add.type = "button";
    head.appendChild(add);
    box.appendChild(head);
    var itemsWrap = el("div", "adm-listitems");
    box.appendChild(itemsWrap);

    function draw() {
      itemsWrap.innerHTML = "";
      var keys = Object.keys(obj);
      keys.forEach(function (k) {
        var card = el("div", "adm-listitem");
        var row = el("div", "adm-kvrow");
        var kIn = el("input", "adm-input"); kIn.type = "text"; kIn.value = k; kIn.placeholder = keyLabel;
        var vIn = el("input", "adm-input"); vIn.type = "text";
        vIn.value = obj[k] == null ? "" : obj[k]; vIn.placeholder = valueLabel;
        kIn.addEventListener("change", function () {
          var newKey = kIn.value.trim();
          if (!newKey || newKey === k) { kIn.value = k; return; }
          if (obj[newKey] != null) { alert("“" + newKey + "” already exists."); kIn.value = k; return; }
          obj[newKey] = obj[k]; delete obj[k]; markDirty(); draw();
        });
        vIn.addEventListener("input", function () { obj[k] = vIn.value; markDirty(); });
        var del = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Remove");
        del.type = "button";
        del.addEventListener("click", function () { delete obj[k]; markDirty(); draw(); });
        row.appendChild(kIn); row.appendChild(vIn); row.appendChild(del);
        card.appendChild(row);
        itemsWrap.appendChild(card);
      });
      if (!keys.length) itemsWrap.appendChild(el("p", "adm-hint", "Nothing here yet."));
    }
    add.addEventListener("click", function () {
      var n = 1, k = "key1";
      while (obj[k] != null) { n++; k = "key" + n; }
      obj[k] = ""; markDirty(); draw();
    });
    draw();
    parent.appendChild(box);
  }

  /* Dropdown that picks another document by its short id, filtered by _type. */
  function fDocPicker(parent, label, obj, key, docType, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field" + (opts.half ? " half" : ""));
    wrap.appendChild(el("label", "adm-label", label));
    var sel = el("select", "adm-select");
    if (opts.allowNone) {
      var noneOpt = el("option", null, opts.noneLabel || "— None —");
      noneOpt.value = ""; sel.appendChild(noneOpt);
    }
    Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === docType; })
      .sort(function (a, b) { return (docs[a].title || docs[a].id || "").localeCompare(docs[b].title || docs[b].id || ""); })
      .forEach(function (f) {
        var d = docs[f];
        var opt = el("option", null, (d.title || d.id) + " (" + d.id + ")");
        opt.value = d.id; sel.appendChild(opt);
      });
    sel.value = obj[key] == null ? "" : obj[key];
    sel.addEventListener("change", function () {
      obj[key] = sel.value ? sel.value : (opts.allowNone ? null : sel.value);
      markDirty();
      if (opts.onChange) opts.onChange();
    });
    wrap.appendChild(sel);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
    return sel;
  }

  function section(parent, title, hint) {
    var s = el("section", "adm-section");
    s.appendChild(el("h3", "adm-sectiontitle", title));
    if (hint) s.appendChild(el("p", "adm-hint", hint));
    parent.appendChild(s);
    return s;
  }

  /* ============================================================
     ACCESS LEVELS  (Phase 5b — 07-SPEC / ACCESS-MODEL.md §5)
     ------------------------------------------------------------
     Access is CMS content: it lives in /data, is edited here, and flows
     through the normal draft -> export/publish path like any other field.
     WHO holds a "restricted" resource does NOT -- that lives only in
     Postgres (resource_entitlements), so entitlementPicker() below is the
     one editor surface in this whole board that talks to a live API
     instead of window.DTS_CONTENT.docs, and never calls markDirty().
     ============================================================ */
  var ACCESS_TOP_OPTIONS = [
    ["registered", "Registered — any signed-in visitor"],
    ["public", "Public — no sign-in required"],
    ["client", "Client — any active org member"],
    ["restricted", "Restricted — specific grant required"]
  ];
  var ACCESS_CHILD_OPTIONS = [
    ["inherit", "Inherit from project"],
    ["public", "Public — no sign-in required"],
    ["registered", "Registered — any signed-in visitor"],
    ["client", "Client — any active org member"],
    ["restricted", "Restricted — specific grant required"]
  ];

  /* Same resolution formula as functions/api/resource/[key].js's own
     resolveExperienceTarget() and scripts/strip-public-data.mjs's resolve()
     -- kept in sync deliberately, not re-derived. UI-only: decides whether
     to show the entitlement picker, never an access decision itself (that
     only ever happens server-side). */
  function resolveAccessLevel(ownAccess, projectAccess) {
    if (ownAccess && ownAccess !== "inherit") return ownAccess;
    return projectAccess || "registered";
  }

  /* Attaches the caller's own Supabase session token, the same one
     js/app.js's fetchResource() sends -- these admin Functions verify
     site_admin server-side from it, same as every other gate. */
  function adminFetch(path, opts) {
    opts = opts || {};
    var headers = {};
    var session = window.DTS_ACCESS && window.DTS_ACCESS.session;
    if (session && session.accessToken) headers.Authorization = "Bearer " + session.accessToken;
    if (opts.body) headers["content-type"] = "application/json";
    return fetch(path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  /* Live grant/revoke UI for one resource_key. getResourceKey is a
     function, not a string, because the underlying key can change while
     this row is open (an experience/link's id is still being typed). */
  function entitlementPicker(parent, getResourceKey) {
    var box = el("div", "adm-entitlements");
    box.appendChild(el("p", "adm-label", "Who has access"));
    var listZone = el("div", "adm-listitems");
    box.appendChild(listZone);
    var status = el("p", "adm-hint", "");
    box.appendChild(status);

    var searchRow = el("div", "adm-entitlement-search");
    var typeSel = el("select", "adm-select adm-entitlement-type");
    [["org", "Organization"], ["user", "User"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; typeSel.appendChild(opt);
    });
    var q = el("input", "adm-input"); q.type = "text"; q.placeholder = "Search by name or email…";
    var resultsBox = el("div", "adm-entitlement-results");
    searchRow.appendChild(typeSel); searchRow.appendChild(q);
    box.appendChild(searchRow);
    box.appendChild(resultsBox);

    var searchTimer = null;
    function runSearch() {
      var term = q.value.trim();
      resultsBox.innerHTML = "";
      if (term.length < 2) return;
      adminFetch("/api/admin/search?type=" + typeSel.value + "&q=" + encodeURIComponent(term)).then(function (res) {
        resultsBox.innerHTML = "";
        if (!res.ok) { resultsBox.appendChild(el("p", "adm-hint", "Search failed.")); return; }
        var results = res.data.results || [];
        if (!results.length) { resultsBox.appendChild(el("p", "adm-hint", "No matches.")); return; }
        results.forEach(function (r) {
          var btn = el("button", "adm-btn adm-btn-small", "+ " + r.label);
          btn.type = "button";
          btn.addEventListener("click", function () { grant(typeSel.value, r.id); });
          resultsBox.appendChild(btn);
        });
      });
    }
    q.addEventListener("input", function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 300);
    });
    typeSel.addEventListener("change", function () { resultsBox.innerHTML = ""; q.value = ""; });

    function draw() {
      listZone.innerHTML = "";
      status.textContent = "Loading…";
      adminFetch("/api/admin/entitlements?resource_key=" + encodeURIComponent(getResourceKey())).then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t load current grants: " + (res.data.error || res.status); return; }
        status.textContent = "";
        var rows = res.data.entitlements || [];
        if (!rows.length) { listZone.appendChild(el("p", "adm-hint", "No one is specifically entitled yet.")); return; }
        rows.forEach(function (r) {
          var item = el("div", "adm-listitem");
          var bar = el("div", "adm-itembar");
          bar.appendChild(el("span", "adm-itemtitle", (r.subjectType === "org" ? "Org: " : "User: ") + r.label));
          var del = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Revoke");
          del.type = "button";
          del.addEventListener("click", function () { revoke(r.id); });
          bar.appendChild(del);
          item.appendChild(bar);
          listZone.appendChild(item);
        });
      });
    }
    function grant(subjectType, subjectId) {
      status.textContent = "Granting…";
      adminFetch("/api/admin/entitlements", {
        method: "POST",
        body: { resourceKey: getResourceKey(), subjectType: subjectType, subjectId: subjectId }
      }).then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t grant: " + (res.data.error || res.status); return; }
        q.value = ""; resultsBox.innerHTML = "";
        draw();
      });
    }
    function revoke(id) {
      status.textContent = "Revoking…";
      adminFetch("/api/admin/entitlements/" + id, { method: "DELETE" }).then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t revoke: " + (res.data.error || res.status); return; }
        draw();
      });
    }
    draw();
    parent.appendChild(box);
    return { refresh: draw };
  }

  /* Access-level dropdown, paired with the live entitlement picker when
     the row's RESOLVED level is "restricted". opts.top skips "inherit"
     (a project/GIS map document has nothing to inherit from). opts.resourceKey
     (a live getter) is what actually gets entitlements attached to it --
     omit it to never show a picker, which is deliberate for a project's own
     top-level field: a bare project.<id> key is never itself gated
     (ACCESS-MODEL.md §4), only whatever specific child resourceKey a guest
     requests is, so there is nothing to attach an entitlement to at that
     level. opts.projectAccess (child rows only, a live getter) is used
     purely to decide whether to show the picker when this row is set to
     "inherit" -- the real resolution always happens server-side regardless. */
  function accessLevelField(parent, obj, key, opts) {
    opts = opts || {};
    var options = opts.top ? ACCESS_TOP_OPTIONS : ACCESS_CHILD_OPTIONS;
    var pickerZone = el("div");
    function refreshPicker() {
      pickerZone.innerHTML = "";
      if (!opts.resourceKey) return;
      var resolved = opts.top ? (obj[key] || "registered")
        : resolveAccessLevel(obj[key], opts.projectAccess ? opts.projectAccess() : undefined);
      if (resolved !== "restricted") return;
      entitlementPicker(pickerZone, opts.resourceKey);
    }
    fSelect(parent, opts.label || "Access level", obj, key, options, { hint: opts.hint, onChange: refreshPicker });
    parent.appendChild(pickerZone);
    refreshPicker();
  }

  /* Per-hexagon media editor: a type dropdown that swaps in the
     fields for image / video / 3D model. Edits h.media in place
     (the canonical shape content-loader.js and hex-media.js read). */
  var BORDER_OPTIONS = [
    ["none", "No border (default)"],
    ["stroke", "Thin outline"],
    ["brackets", "Corner brackets"],
    ["vignette", "Inner vignette"],
    ["badge", "Corner type badge"],
    ["scanline", "Hover scan-line"]
  ];
  var AUTOPLAY_OPTIONS = [
    ["autoplay", "Autoplay (muted loop)"],
    ["hover", "Play on hover"],
    ["none", "Don\u2019t autoplay (play on click)"]
  ];

  function hexMediaEditor(parent, h) {
    // Migrate legacy image-only entries to the media shape.
    if (window.DTS_NORMALIZE_HEX) window.DTS_NORMALIZE_HEX(h);
    else if (!h.media || !h.media._type) {
      var legacy = h.image || {};
      h.media = { _type: "image",
                  source: legacy.source || { kind: "path", value: "" },
                  alt: legacy.alt || "" };
    }
    if (h.media.border == null) h.media.border = "none";

    var card = el("div", "adm-listitem");
    var bar = el("div", "adm-itembar");
    bar.appendChild(el("span", "adm-itemno", h.slot.toUpperCase()));
    card.appendChild(bar);

    var typeWrap = el("div", "adm-field half");
    typeWrap.appendChild(el("label", "adm-label", "Content type"));
    var typeSel = el("select", "adm-select");
    [["image", "Image"], ["video", "Video"], ["model", "3D model (GLB)"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; typeSel.appendChild(opt);
    });
    typeSel.value = h.media._type;
    typeWrap.appendChild(typeSel);
    card.appendChild(typeWrap);

    var fields = el("div");
    card.appendChild(fields);

    function ensure(key, fallback) { if (!h.media[key]) h.media[key] = fallback; }

    function draw() {
      fields.innerHTML = "";
      var m = h.media;

      // Border style — applies to any media type, defaults to none.
      // The clip/mask fix that keeps 3D models inside their hexagon
      // (see 02-home.css .hex-clip) is always on regardless of this
      // choice; this control is purely the visible edge treatment.
      fSelect(fields, "Border style", m, "border", BORDER_OPTIONS, {
        hint: "\u201cCorner type badge\u201d shows a cube for models, a camera for videos, a photo icon for images."
      });

      if (m._type === "image") {
        fSource(fields, "Image (site path or external link)", m.source, { imagePreview: true });
        if (m.alt == null) m.alt = "";
        fText(fields, "Alt text", m, "alt");
      } else if (m._type === "video") {
        if (m.autoplayMode == null) m.autoplayMode = "autoplay";
        fSelect(fields, "Autoplay behavior", m, "autoplayMode", AUTOPLAY_OPTIONS, {
          hint: "\u201cPlay on hover\u201d and \u201cDon\u2019t autoplay\u201d both show a still first frame at rest \u2014 add a poster below for the cleanest result."
        });
        fSource(fields, "Video — local file (assets/…​.mp4/.webm) or YouTube/Vimeo link", m.source,
                { hint: "Visitors click the hexagon to expand it with sound and full controls, whatever the autoplay behavior above." });
        ensure("poster", { kind: "path", value: "" });
        fSource(fields, "Poster image (optional, shown before playback starts)", m.poster, { imagePreview: true });
      } else if (m._type === "model") {
        fSource(fields, "3D model file (.glb / .gltf)", m.source,
                { hint: "GLB is the web format. FBX/OBJ won\u2019t load directly \u2014 export as glTF 2.0 from Blender first." });
        if (m.background == null) m.background = "transparent";
        fText(fields, "Background \u2014 \u201ctransparent\u201d shows the website behind the model, or any CSS color (e.g. #0c1322)", m, "background", { half: true });
        if (m.autoRotate == null) m.autoRotate = true;
        fCheck(fields, "Auto-rotate while idle", m, "autoRotate");
        ensure("poster", { kind: "path", value: "" });
        fSource(fields, "Poster image (optional, shown while the model loads)", m.poster, { imagePreview: true });
        ensure("iosSource", { kind: "path", value: "" });
        fSource(fields, "USDZ file for AR on Apple devices (optional)", m.iosSource,
                { hint: "Adds an AR button on iPhone/iPad/Vision Pro. Leave empty to skip." });
      }
    }
    typeSel.addEventListener("change", function () {
      var m = h.media;
      m._type = typeSel.value;
      if (!m.source) m.source = { kind: "path", value: "" };
      if (m._type === "model") {
        if (m.background == null) m.background = "transparent";
        if (m.autoRotate == null) m.autoRotate = true;
      }
      if (m._type === "video" && m.autoplayMode == null) m.autoplayMode = "autoplay";
      markDirty(); draw();
    });
    draw();
    parent.appendChild(card);
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

    var s2 = section(pane, "Hexagon media",
      "The four hexagons next to the headline. Each can show an image, a video " +
      "(local .mp4/.webm file or a YouTube/Vimeo link), or an interactive 3D model. " +
      "Models must be GLB/glTF (.glb) — convert FBX/OBJ/USDZ in Blender via " +
      "File \u2192 Export \u2192 glTF 2.0. An extra .usdz can be attached for AR on Apple devices.");
    (home.hexCluster || []).forEach(function (h) {
      hexMediaEditor(s2, h);
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

  function editFaq(pane) {
    var faq = docs["faq/answers.json"];
    if (!faq) { pane.appendChild(el("p", "adm-hint", "faq/answers.json missing.")); return; }
    var s1 = section(pane, "FAQ answers",
      "Shown in the home question bar when a visitor's question matches. \u201cMatch phrases\u201d are " +
      "lower-case substrings checked against what they type \u2014 list every wording you expect " +
      "(e.g. \u201ctreedis\u201d, \u201cwhat is treedis\u201d).");
    fList(s1, "Questions", faq.items, function (card, item) {
      fText(card, "Question (shown as the heading in the answer popover)", item, "q");
      fText(card, "Answer", item, "a", { textarea: true, rows: 4 });
      if (!item.match) item.match = [];
      fStringList(card, "Match phrases", item.match);
    }, function () {
      return { match: [], q: "New question", a: "" };
    }, "+ Add question");
  }

  function editFunFacts(pane) {
    var doc = docs["faq/fun-facts.json"];
    if (!doc) { pane.appendChild(el("p", "adm-hint", "faq/fun-facts.json missing.")); return; }
    var s1 = section(pane, "Fun facts",
      "One is picked at random and typed out under the headline while the site loads. Keep each " +
      "one short \u2014 it has to finish typing before the loader hands off to the live site.");
    if (!doc.facts) doc.facts = [];
    fStringList(s1, "Facts", doc.facts);
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

  /* A fresh experiences[] item for the given type — same field shapes
     js/content-loader.js's convertExperience() already expects, so nothing
     downstream needs to change. */
  function experienceSkeleton(type) {
    if (type === "video") {
      return { _type: "video", id: "video", label: "Watch the video",
        embed: { kind: "url", value: "https://player.vimeo.com/video/" },
        watch: { kind: "url", value: "https://vimeo.com/" }, default: false };
    }
    if (type === "gis") {
      return { _type: "gis", id: "map", label: "Parish map",
        mapId: "", tourId: null, initialView: null, default: false };
    }
    return { _type: "treedis", id: "tour", label: "Explore the experience",
      tourUrl: "https://spaces.dtsxr.com/tour/", origin: "https://spaces.dtsxr.com",
      sweepId: null, default: false };
  }

  /* project.media (legacy) -> a single experiences[]-shaped item. Same
     fields either way (content-loader.js's own projectExperiences() reads
     p.media the same way), just adding id/default. */
  function normalizeLegacyMedia(media) {
    var item = JSON.parse(JSON.stringify(media));
    if (!item.id) item.id = item._type;
    item.default = true;
    return item;
  }

  function renderExperienceItem(card, item, i, arr, project, redraw) {
    var typeWrap = el("div", "adm-field half");
    typeWrap.appendChild(el("label", "adm-label", "Type"));
    var typeSel = el("select", "adm-select");
    [["treedis", "Treedis experience"], ["video", "Vimeo video"], ["gis", "GIS map"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; typeSel.appendChild(opt);
    });
    typeSel.value = item._type;
    typeSel.addEventListener("change", function () {
      var keepLabel = item.label;
      var skeleton = experienceSkeleton(typeSel.value);
      Object.keys(item).forEach(function (k) { delete item[k]; });
      Object.assign(item, skeleton);
      if (keepLabel) item.label = keepLabel;
      markDirty();
      redraw();
    });
    typeWrap.appendChild(typeSel);
    card.appendChild(typeWrap);

    var idWrap = el("div", "adm-field half");
    idWrap.appendChild(el("label", "adm-label", "Short id (used in links)"));
    var idInput = el("input", "adm-input"); idInput.type = "text"; idInput.value = item.id || "";
    var idMsg = el("p", "adm-hint", "");
    function validateId() {
      var v = idInput.value.trim();
      var ok = /^[a-z0-9-]{1,24}$/.test(v);
      var dupe = ok && arr.some(function (o) { return o !== item && o.id === v; });
      if (!ok) idMsg.textContent = "Letters, numbers and hyphens only, 1–24 characters.";
      else if (dupe) idMsg.textContent = "Another experience in this project already uses this id.";
      else idMsg.textContent = "Deep link: …&exp=" + v;
    }
    idInput.addEventListener("input", function () { item.id = idInput.value; markDirty(); validateId(); });
    validateId();
    idWrap.appendChild(idInput); idWrap.appendChild(idMsg);
    card.appendChild(idWrap);

    fText(card, "Tab label", item, "label");

    if (item._type === "treedis") {
      fText(card, "Tour URL", item, "tourUrl", { placeholder: "https://spaces.dtsxr.com/tour/xxxx" });
      fText(card, "Origin", item, "origin");
      fText(card, "Sweep ID (optional landing sweep)", item, "sweepId", { hint: "Leave blank to open at the model default." });
    } else if (item._type === "video") {
      if (!item.embed) item.embed = { kind: "url", value: "" };
      fSource(card, "Embed (player URL, or a local video file)", item.embed);
      if (!item.watch) item.watch = { kind: "url", value: "" };
      fSource(card, "Watch link (public page, optional)", item.watch);
    } else if (item._type === "gis") {
      fDocPicker(card, "Map", item, "mapId", "gisMap", { hint: "Authored under GIS Maps in this board's nav." });
      var tourSel = fDocPicker(card, "Guided tour on open", item, "tourId", "gisTour", { allowNone: true, noneLabel: "None" });
      var mismatchNote = el("p", "adm-hint", "");
      card.appendChild(mismatchNote);
      function checkMismatch() {
        if (!item.tourId) { mismatchNote.textContent = ""; return; }
        var tourFile = Object.keys(docs).filter(function (f) {
          return docs[f] && docs[f]._type === "gisTour" && docs[f].id === item.tourId;
        })[0];
        var tourDoc = tourFile ? docs[tourFile] : null;
        mismatchNote.textContent = (tourDoc && tourDoc.mapId !== item.mapId)
          ? "This tour belongs to a different map (" + tourDoc.mapId + ") and won't line up with this one."
          : "";
      }
      tourSel.addEventListener("change", checkMismatch);
      checkMismatch();
    }

    accessLevelField(card, item, "access", {
      projectAccess: function () { return project.access; },
      resourceKey: function () { return "project." + project.id + ":" + (item.id || ""); }
    });

    var defWrap = el("div", "adm-field adm-check");
    var defLab = el("label", "adm-checklabel");
    var defRadio = el("input"); defRadio.type = "radio"; defRadio.name = "admExpDefault";
    defRadio.checked = !!item.default;
    defRadio.addEventListener("change", function () {
      arr.forEach(function (o) { o.default = (o === item); });
      markDirty();
    });
    defLab.appendChild(defRadio);
    defLab.appendChild(document.createTextNode(" Open this one first"));
    defWrap.appendChild(defLab);
    card.appendChild(defWrap);
  }

  /* Replaces the old single-media section (06-SPEC §2). Built on
     fListOrdered over project.experiences.

     Legacy migration: a project that still has `media` and no `experiences`
     is shown as a single experiences[0] item, but the document itself is
     only rewritten (experiences = [media]; delete media) the moment the
     editor makes a real change -- never just from opening the editor. That
     keeps the 16 pre-GIS projects' export diff byte-identical until an
     editor actually touches one. Implemented via preDirtyHook: the working
     array starts out detached from the document; the very next markDirty()
     (from any field edit, add, remove, or reorder inside this section)
     promotes it to project.experiences before doing anything else. */
  function experiencesEditor(parent, project) {
    var box = section(parent, "Main experiences",
      "What appears in the big pane at the top of this project's window. Add more than one and " +
      "visitors get tabs to switch between them. Leave empty to reuse the shared showcase twin.");

    var isLegacy = !(Array.isArray(project.experiences) && project.experiences.length) && !!project.media;
    var committed = !isLegacy;
    var arr = isLegacy ? [normalizeLegacyMedia(project.media)] : (project.experiences || (project.experiences = []));

    function commitIfNeeded() {
      if (committed) return;
      committed = true;
      project.experiences = arr;
      delete project.media;
    }
    preDirtyHook = commitIfNeeded;

    var listHandle = fListOrdered(box, "Experiences", arr, function (card, item, i) {
      renderExperienceItem(card, item, i, arr, project, function () { listHandle.redraw(); });
    }, function () {
      return experienceSkeleton("treedis");
    }, "+ Add experience");
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
    accessLevelField(s1, p, "access", {
      top: true,
      label: "Default access level",
      hint: "Applies to any experience or link below set to “Inherit from project.” The project's own title/overview/gallery are always public regardless of this."
    });

    var s2 = section(pane, "Featured project");
    fText(s2, "Name", p.project, "name");
    fText(s2, "Kind (e.g. \u201cActive project · USDA-commissioned\u201d)", p.project, "kind");
    fText(s2, "Blurb", p.project, "blurb", { textarea: true, rows: 4 });
    fCheck(s2, "Illustrative placeholder (swap for a real project later)", p.project, "illustrative");

    experiencesEditor(pane, p);

    var s3 = section(pane, "Related links", "Chips under the experience — tours, videos, Matterport links.");
    fList(s3, "Links", p.links, function (card, item, i) {
      fText(card, "Label", item, "label");
      fText(card, "URL", item, "url", { placeholder: "https://…" });
      accessLevelField(card, item, "access", {
        projectAccess: function () { return p.access; },
        resourceKey: function () { return "project." + p.id + ":link-" + (i + 1); },
        hint: "A link's gated identity is its position in this list (link-1, link-2, …) — removing an earlier link shifts every link after it, along with any entitlements already granted to that position."
      });
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
    docs[file] = {
      _id: "project." + id, _type: "project", id: id,
      sectorId: firstSector ? firstSector.id : "education",
      title: "New Project", tagline: "", overview: "",
      project: { name: "", kind: "", illustrative: true, blurb: "" },
      capturedWith: "", platform: "",
      links: [], gallery: [], sweepId: null,
      evidence: {}
    };
    // Register in the manifest so loaders and future tools see it.
    content.manifest.documents.projects.push({ file: file, type: "project", id: "project." + id });
    // Give it a card in its sector so it is reachable on the site.
    if (firstSector) {
      firstSector.cards.push({ projectId: id, title: "New Project", text: "" });
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
     ADD / DELETE GIS MAPS AND TOURS  (06-SPEC §3)
     ------------------------------------------------------------
     Maps, tours and sources.json all share one manifest group
     (data/manifest.json's "gis" array) — new entries are pushed
     into that same array, same as addProject()/deleteProject()
     push into "projects".
     ============================================================ */
  function gisMapFiles() {
    return Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === "gisMap"; })
      .sort(function (a, b) { return (docs[a].title || "").localeCompare(docs[b].title || ""); });
  }
  function gisTourFiles(mapId) {
    return Object.keys(docs).filter(function (f) {
      return docs[f] && docs[f]._type === "gisTour" && (!mapId || docs[f].mapId === mapId);
    }).sort(function (a, b) { return (docs[a].title || "").localeCompare(docs[b].title || ""); });
  }
  function gisSourcesFile() {
    return Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === "gisSources"; })[0];
  }

  function addGisMap() {
    var id = prompt("Short id for the new map (letters/numbers/hyphens, e.g. downtown-corridor):");
    if (!id) return;
    id = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id) return alert("That id isn't usable.");
    var file = "gis/maps/" + id + ".json";
    if (docs[file]) return alert("A map with that id already exists.");
    docs[file] = {
      _id: "gis.maps." + id, _type: "gisMap", id: id,
      title: "New map", subtitle: "", attribution: "",
      view: { center: [29.740394, -91.635827], zoom: 10, minZoom: 8, maxZoom: 18,
              maxBounds: null, restrictToBounds: false },
      boundary: { layerId: "", showMask: false, maskOpacity: 0.55 },
      basemaps: [
        { id: "streets", title: "Streets", type: "tileXYZ",
          url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          attribution: "&copy; OpenStreetMap contributors", default: true },
        { id: "none", title: "No basemap", type: "none" }
      ],
      groups: [],
      layers: [],
      tools: { layerPanel: true, basemapSwitcher: true, legend: true, identify: true,
               attributeTable: true, filter: true, measure: true, draw: true,
               coordinates: true, search: true, geolocate: true, bookmarks: true,
               swipe: true, timeline: false, print: true, exportData: true,
               share: true, fullscreen: true, scaleBar: true, miniMap: false },
      bookmarks: [],
      tours: [], defaultTour: null
    };
    content.manifest.documents.gis.push({ file: file, type: "gisMap", id: "gis.maps." + id });
    markDirty(); buildNav(); select("gismap:" + file);
  }

  function deleteGisMap(file) {
    var m = docs[file];
    if (!m) return;
    var refs = [];
    projectFiles().forEach(function (pf) {
      (docs[pf].experiences || []).forEach(function (ex) {
        if (ex._type === "gis" && ex.mapId === m.id) refs.push(docs[pf].title);
      });
    });
    var tourFiles = gisTourFiles(m.id);
    var featureTourFiles = gisFeatureTourFiles(m.id);
    var msg = "Delete “" + m.title + "”?";
    if (refs.length) msg += "\n\nStill referenced by: " + refs.join(", ") + ". Those experiences will be removed too.";
    if (tourFiles.length) msg += "\n\nIts " + tourFiles.length + " guided tour(s) will also be deleted.";
    if (featureTourFiles.length) msg += "\n\nIts " + featureTourFiles.length + " feature tour association(s) will also be deleted.";
    if (!confirm(msg)) return;
    featureTourFiles.forEach(function (ff) {
      delete docs[ff];
      content.manifest.documents.gis = content.manifest.documents.gis.filter(function (e) { return e.file !== ff; });
    });
    tourFiles.forEach(function (tf) {
      delete docs[tf];
      content.manifest.documents.gis = content.manifest.documents.gis.filter(function (e) { return e.file !== tf; });
    });
    projectFiles().forEach(function (pf) {
      var p = docs[pf];
      if (Array.isArray(p.experiences)) {
        p.experiences = p.experiences.filter(function (ex) { return !(ex._type === "gis" && ex.mapId === m.id); });
      }
    });
    delete docs[file];
    content.manifest.documents.gis = content.manifest.documents.gis.filter(function (e) { return e.file !== file; });
    markDirty(); buildNav(); select("home");
  }

  function newGisTourSkeleton(mapDoc, id) {
    return {
      _id: "gis.tour." + id, _type: "gisTour", id: id, mapId: mapDoc.id,
      title: "New tour", intro: "",
      autoStart: false, autoAdvance: false, defaultDuration: 12,
      showProgress: true, position: "left",
      steps: [],
      outro: { title: "Explore on your own",
               body: "Every layer used in this tour is in the layer panel.",
               cta: { label: "Open the layer panel", action: "openLayerPanel" } }
    };
  }

  function addGisTour(mapFile) {
    var mapDoc = docs[mapFile];
    if (!mapDoc) return;
    var id = prompt("Short id for the new tour (letters/numbers/hyphens):");
    if (!id) return;
    id = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id) return alert("That id isn't usable.");
    var file = "gis/tours/" + id + ".json";
    if (docs[file]) return alert("A tour with that id already exists.");
    docs[file] = newGisTourSkeleton(mapDoc, id);
    content.manifest.documents.gis.push({ file: file, type: "gisTour", id: "gis.tour." + id });
    if (!Array.isArray(mapDoc.tours)) mapDoc.tours = [];
    mapDoc.tours.push(id);
    markDirty(); buildNav(); select("gistour:" + file);
  }

  function deleteGisTour(file) {
    var t = docs[file];
    if (!t) return;
    var featureRefs = gisFeatureTourFiles().filter(function (ff) { return docs[ff].tourId === t.id; });
    var msg = "Delete “" + t.title + "”?";
    if (featureRefs.length) msg += "\n\nStill referenced by " + featureRefs.length + " feature tour association(s) — they'll be unlinked (tourId cleared), not deleted.";
    if (!confirm(msg)) return;
    featureRefs.forEach(function (ff) { docs[ff].tourId = null; });
    gisMapFiles().forEach(function (mf) {
      var m = docs[mf];
      if (Array.isArray(m.tours)) m.tours = m.tours.filter(function (id) { return id !== t.id; });
      if (m.defaultTour === t.id) m.defaultTour = null;
    });
    projectFiles().forEach(function (pf) {
      (docs[pf].experiences || []).forEach(function (ex) {
        if (ex._type === "gis" && ex.tourId === t.id) ex.tourId = null;
      });
    });
    delete docs[file];
    content.manifest.documents.gis = content.manifest.documents.gis.filter(function (e) { return e.file !== file; });
    markDirty(); buildNav(); select("gismap:gis/maps/" + t.mapId + ".json");
  }

  /* ============================================================
     GIS FEATURE TOURS  -- a small association type, sibling to
     gisMap/gisTour: which single clicked feature (by a stable
     attribute key -- some ArcGIS services, including CPRA's, report
     no objectIdField at all, so this deliberately isn't an ArcGIS
     OBJECTID) opens which ordinary gisTour. Kept separate from
     gisTour itself so the map-level tour pickers (Guided tours
     toolbar button, "Default tour", the "Start another tour" CTA,
     a project experience's own tourId) never have to filter
     feature-scoped tours out of a list meant for whole-map tours.
     ============================================================ */
  function gisFeatureTourFiles(mapId) {
    return Object.keys(docs).filter(function (f) {
      return docs[f] && docs[f]._type === "gisFeatureTour" && (!mapId || docs[f].mapId === mapId);
    }).sort(function (a, b) { return (docs[a].id || "").localeCompare(docs[b].id || ""); });
  }

  function addGisFeatureTour(mapFile) {
    var mapDoc = docs[mapFile];
    if (!mapDoc) return;
    var id = prompt("Short id for the new feature tour (letters/numbers/hyphens, e.g. cpra-admiral-doyle):");
    if (!id) return;
    id = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id) return alert("That id isn't usable.");
    var file = "gis/featuretours/" + id + ".json";
    if (docs[file]) return alert("A feature tour with that id already exists.");
    var firstLayer = (mapDoc.layers || [])[0];
    docs[file] = {
      _id: "gis.featuretour." + id, _type: "gisFeatureTour", id: id,
      mapId: mapDoc.id, layerId: firstLayer ? firstLayer.id : "",
      featureKey: { field: "", value: "" },
      enabled: true, tourId: null
    };
    content.manifest.documents.gis.push({ file: file, type: "gisFeatureTour", id: "gis.featuretour." + id });
    markDirty(); buildNav(); select("gisfeaturetour:" + file);
  }

  function deleteGisFeatureTour(file) {
    var ft = docs[file];
    if (!ft) return;
    if (!confirm("Delete this feature tour association? The linked tour itself (if any) is not deleted, just unlinked from this feature.")) return;
    var mapId = ft.mapId;
    delete docs[file];
    content.manifest.documents.gis = content.manifest.documents.gis.filter(function (e) { return e.file !== file; });
    markDirty(); buildNav(); select("gismap:gis/maps/" + mapId + ".json");
  }

  /* ============================================================
     LIVE MAP PREVIEW  (06-SPEC §7)
     ------------------------------------------------------------
     Lazily injects the same js/gis/* engine files js/app.js's own
     mountGis() uses (gis-loader vendors Leaflet/esri-leaflet; the
     other three are our own engine code) — same known-good load
     order verified live across Phases 3-4, not a lighter subset
     invented for the admin board.
     ============================================================ */
  var gisEnginePromise = null;
  function loadGisEngineForAdmin() {
    if (gisEnginePromise) return gisEnginePromise;
    var files = ["js/gis/gis-loader.js", "js/gis/gis-viewer.js", "js/gis/gis-esri.js", "js/gis/gis-tools.js"];
    gisEnginePromise = files.reduce(function (p, src) {
      return p.then(function () {
        return new Promise(function (resolve, reject) {
          if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
          var s = document.createElement("script");
          s.src = src;
          s.onload = function () { resolve(); };
          s.onerror = function () { reject(new Error("Failed to load " + src)); };
          document.body.appendChild(s);
        });
      });
    }, Promise.resolve());
    return gisEnginePromise;
  }

  /* getMapDoc() is called fresh on every (re)mount so the preview always
     reflects the in-memory document, including unsaved edits (same
     instant-feedback principle as Save draft & preview, just tighter).
     refresh() re-mounts debounced ~400ms -- editors call it after a
     structural edit (layers/groups/basemaps/boundary added, removed or
     rewired); plain label/text edits should just let the preview be, per
     §7's "do not re-mount on every keystroke in a title field." */
  function gisPreviewPanel(parent, getMapDoc) {
    var wrap = el("div", "adm-gispreview");
    var bar = el("div", "adm-gispreview-bar");
    var msg = el("span", "adm-hint", "Loading preview…");
    bar.appendChild(msg);
    var toggle = el("button", "adm-btn adm-btn-small adm-gispreview-toggle", "⛶ Preview map");
    toggle.type = "button";
    toggle.addEventListener("click", function () { wrap.classList.toggle("is-expanded"); });
    bar.appendChild(toggle);
    var mapHolder = el("div", "adm-gispreview-map");
    wrap.appendChild(bar);
    wrap.appendChild(mapHolder);
    parent.appendChild(wrap);

    var instance = null, mounting = false, debounceTimer = null, destroyed = false;

    function doMount() {
      if (destroyed) return;
      if (instance) { try { instance.destroy(); } catch (_e) {} instance = null; }
      mapHolder.innerHTML = "";
      msg.textContent = "Loading preview…";
      mounting = true;
      loadGisEngineForAdmin().then(function () {
        if (destroyed) return null;
        return window.DTSGis.mount(mapHolder, getMapDoc(), { preview: true });
      }).then(function (inst) {
        if (!inst) return;
        if (destroyed) { try { inst.destroy(); } catch (_e) {} return; }
        instance = inst; mounting = false; msg.textContent = "";
      }).catch(function (err) {
        mounting = false;
        msg.textContent = "Preview unavailable: " + err.message;
        console.warn("[admin] GIS preview failed to mount:", err);
      });
    }
    function refresh() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doMount, 400);
    }
    doMount();
    return {
      getInstance: function () { return mounting ? null : instance; },
      refresh: refresh,
      destroy: function () {
        destroyed = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        if (instance) { try { instance.destroy(); } catch (_e) {} instance = null; }
      }
    };
  }

  /* GIS map/tour editors need the pane wider than the normal 880px column
     (a form + a live preview side by side) -- select() clears this back to
     normal on every pane switch, same discipline as preDirtyHook. */
  function setPaneWide(wide) {
    if (paneEl) paneEl.classList.toggle("adm-pane-wide", !!wide);
  }

  /* A {center,zoom} | {bbox} view, per 04-SPEC's view schema, used for a
     map's default view, a bookmark's view, and a tour step's view alike.
     opts.withCapture adds a "Set from current preview" button that reads
     opts.getPreviewInstance().getState(). */
  function fView(parent, obj, key, opts) {
    opts = opts || {};
    if (!obj[key] || typeof obj[key] !== "object") obj[key] = { center: [29.740394, -91.635827], zoom: 10 };
    var view = obj[key];
    var wrap = el("div", "adm-viewbox");
    var modeWrap = el("div", "adm-field half");
    modeWrap.appendChild(el("label", "adm-label", "View shape"));
    var modeSel = el("select", "adm-select");
    [["center", "Center + zoom"], ["bbox", "Bounding box"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; modeSel.appendChild(opt);
    });
    modeSel.value = Array.isArray(view.bbox) ? "bbox" : "center";
    modeWrap.appendChild(modeSel);
    wrap.appendChild(modeWrap);
    var fieldsZone = el("div");
    wrap.appendChild(fieldsZone);

    function drawFields() {
      fieldsZone.innerHTML = "";
      if (modeSel.value === "bbox") {
        if (!Array.isArray(view.bbox)) view.bbox = [[29.31, -92.10], [30.17, -91.17]];
        delete view.center; delete view.zoom;
        fNumber(fieldsZone, "South lat", view.bbox[0], 0, { half: true, step: 0.0001 });
        fNumber(fieldsZone, "West lng", view.bbox[0], 1, { half: true, step: 0.0001 });
        fNumber(fieldsZone, "North lat", view.bbox[1], 0, { half: true, step: 0.0001 });
        fNumber(fieldsZone, "East lng", view.bbox[1], 1, { half: true, step: 0.0001 });
      } else {
        if (!Array.isArray(view.center)) view.center = [29.740394, -91.635827];
        if (view.zoom == null) view.zoom = 10;
        delete view.bbox;
        fNumber(fieldsZone, "Center lat", view.center, 0, { half: true, step: 0.0001 });
        fNumber(fieldsZone, "Center lng", view.center, 1, { half: true, step: 0.0001 });
        fNumber(fieldsZone, "Zoom", view, "zoom", { half: true, step: 1, min: 0, max: 22 });
      }
      if (opts.withCapture) {
        var capBtn = el("button", "adm-btn adm-btn-small", "📍 Set from current preview");
        capBtn.type = "button";
        capBtn.addEventListener("click", function () {
          var inst = opts.getPreviewInstance && opts.getPreviewInstance();
          if (!inst) { alert("Preview isn't ready yet — wait a moment and try again."); return; }
          var st = inst.getState();
          view.center = [st.c[0], st.c[1]]; view.zoom = st.z;
          delete view.bbox;
          markDirty();
          modeSel.value = "center";
          drawFields();
          if (opts.onCapture) opts.onCapture();
        });
        fieldsZone.appendChild(capBtn);
      }
    }
    modeSel.addEventListener("change", function () { markDirty(); drawFields(); });
    drawFields();
    parent.appendChild(wrap);
  }

  /* A plain [[s,w],[n,e]] bounds field with no mode toggle (view.maxBounds). */
  function fBoundsRaw(parent, label, obj, key, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field");
    wrap.appendChild(el("label", "adm-label", label));
    var row = el("div", "adm-boundsrow");
    if (!Array.isArray(obj[key])) obj[key] = [[29.31, -92.10], [30.17, -91.17]];
    var b = obj[key];
    [["S", b[0], 0], ["W", b[0], 1], ["N", b[1], 0], ["E", b[1], 1]].forEach(function (t) {
      var mini = el("div", "adm-boundsfield");
      mini.appendChild(el("span", "adm-boundslabel", t[0]));
      var input = el("input", "adm-input"); input.type = "number"; input.step = "0.0001";
      input.value = t[1][t[2]];
      input.addEventListener("input", function () { t[1][t[2]] = parseFloat(input.value); markDirty(); });
      mini.appendChild(input);
      row.appendChild(mini);
    });
    wrap.appendChild(row);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
  }

  /* A comma-separated list of integers, for a layer's esriDynamic "layers"
     sublayer-index array (04-SPEC §4: "layers": [0, 1]). */
  function fIndexList(parent, label, obj, key, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field" + (opts.half ? " half" : ""));
    wrap.appendChild(el("label", "adm-label", label));
    var input = el("input", "adm-input"); input.type = "text";
    input.value = Array.isArray(obj[key]) ? obj[key].join(", ") : "";
    input.addEventListener("input", function () {
      obj[key] = input.value.split(",").map(function (s) { return parseInt(s.trim(), 10); })
        .filter(function (n) { return !isNaN(n); });
      markDirty();
    });
    wrap.appendChild(input);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
  }

  /* ============================================================
     LAYER EDITOR  (06-SPEC §4 — "the big one")
     ============================================================ */
  var SOURCE_TYPE_OPTIONS = [
    ["esriDynamic", "ArcGIS map service (image)"],
    ["esriFeature", "ArcGIS feature layer (clickable data)"],
    ["esriImage", "ArcGIS imagery service"],
    ["geojson", "GeoJSON file in this site"],
    ["tileXYZ", "Tiled basemap (XYZ)"],
    ["wms", "WMS service"]
  ];

  function nextLayerZIndex(mapDoc) {
    var max = 0;
    (mapDoc.layers || []).forEach(function (l) { if (typeof l.zIndex === "number" && l.zIndex > max) max = l.zIndex; });
    return max + 10;
  }

  function layerSkeleton(mapDoc) {
    return {
      id: "layer-" + Math.random().toString(36).slice(2, 8),
      title: "New layer", group: (mapDoc.groups && mapDoc.groups[0]) ? mapDoc.groups[0].id : "",
      sourceType: "esriFeature", sourceRef: "", url: "", layerId: 0,
      visible: false, opacity: 1, zIndex: nextLayerZIndex(mapDoc),
      legend: { mode: "auto" }, legendItems: [],
      queryable: true, popup: { title: "", fields: [], linkField: null },
      style: { color: "#c49a2a", weight: 1.5, fillColor: "#c49a2a", fillOpacity: 0.18, dashArray: null, pointRadius: 5, classify: null },
      cluster: false, labels: { field: null, minZoom: 14 },
      clipToParish: true, attribution: "", description: "", updated: "", timeField: null
    };
  }

  function testArcgisConnection(url, statusEl) {
    if (!url) { statusEl.textContent = "Enter a service URL first."; return; }
    statusEl.textContent = "Testing…"; statusEl.style.color = "";
    fetch(url.replace(/\/$/, "") + "?f=json").then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      if (data.error) throw new Error(data.error.message || ("code " + data.error.code));
      var name = data.serviceDescription || data.mapName || data.name || "(unnamed service)";
      var subCount = Array.isArray(data.layers) ? data.layers.length : (data.fields ? 1 : 0);
      var wkid = data.spatialReference && (data.spatialReference.latestWkid || data.spatialReference.wkid);
      statusEl.textContent = "✓ " + name + " — " + subCount + " sublayer(s)" +
        (wkid ? ", SRS " + wkid : "") + ". CORS allowed this request.";
    }).catch(function (err) {
      statusEl.textContent = "✗ Couldn't reach this service directly from the browser (" + err.message + "). " +
        "This usually means CORS is blocking cross-origin access — try “ArcGIS map service (image)”, " +
        "which loads images and doesn't need CORS.";
      statusEl.style.color = "var(--adm-danger)";
    });
  }

  function loadFieldsFromService(layer, onDone) {
    var sub = layer.sourceType === "esriFeature" ? layer.layerId
      : (Array.isArray(layer.layers) && layer.layers.length ? layer.layers[0] : 0);
    var url = (layer.url || "").replace(/\/$/, "") + "/" + sub + "?f=pjson";
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      if (data.error) throw new Error(data.error.message || ("code " + data.error.code));
      if (!layer.popup) layer.popup = { title: "", fields: [], linkField: null };
      if (!Array.isArray(layer.popup.fields)) layer.popup.fields = [];
      var existing = {}; layer.popup.fields.forEach(function (f) { existing[f.name] = true; });
      var added = 0;
      (data.fields || []).forEach(function (f) {
        if (/^(OBJECTID|FID|Shape|GlobalID)/i.test(f.name)) return;
        if (existing[f.name]) return;
        layer.popup.fields.push({ name: f.name, label: f.alias || f.name });
        added++;
      });
      markDirty();
      alert(added ? ("Added " + added + " field(s) from the service.")
        : "No new fields found (all fields already listed, or the service returned none).");
      onDone();
    }).catch(function (err) { alert("Couldn't load fields: " + err.message); });
  }

  /* layer.sourceRef points at a data/gis/sources.json candidateLayers[].sourceId
     -- an entry *inside* that one document, not a document of its own -- so
     this can't be a plain fDocPicker (which filters window.DTS_CONTENT.docs
     by _type, and there's only ever one gisSources document). */
  function sourceRefPicker(parent, label, layer, opts) {
    opts = opts || {};
    var wrap = el("div", "adm-field");
    wrap.appendChild(el("label", "adm-label", label));
    var sel = el("select", "adm-select");
    var noneOpt = el("option", null, "— none —"); noneOpt.value = ""; sel.appendChild(noneOpt);
    var sourcesFile = gisSourcesFile();
    var candidates = (sourcesFile && Array.isArray(docs[sourcesFile].candidateLayers)) ? docs[sourcesFile].candidateLayers : [];
    candidates.forEach(function (c) {
      var opt = el("option", null, c.sourceId + (c.feedsGroup ? " (" + c.feedsGroup + ")" : ""));
      opt.value = c.sourceId; sel.appendChild(opt);
    });
    sel.value = layer.sourceRef || "";
    sel.addEventListener("change", function () { layer.sourceRef = sel.value || null; markDirty(); });
    wrap.appendChild(sel);
    if (opts.hint) wrap.appendChild(el("p", "adm-hint", opts.hint));
    parent.appendChild(wrap);
  }

  function layerEditor(card, layer, mapDoc, onStructural) {
    fText(card, "Title", layer, "title", { half: true });

    var idWrap = el("div", "adm-field half");
    idWrap.appendChild(el("label", "adm-label", "Short id"));
    var idInput = el("input", "adm-input"); idInput.type = "text"; idInput.value = layer.id || "";
    var idMsg = el("p", "adm-hint", "");
    function validateLayerId() {
      var v = idInput.value.trim();
      var ok = /^[a-z0-9-]{1,40}$/.test(v);
      var dupe = ok && (mapDoc.layers || []).some(function (o) { return o !== layer && o.id === v; });
      idMsg.textContent = !ok ? "Letters, numbers and hyphens only." : dupe ? "Another layer already uses this id." : "";
    }
    idInput.addEventListener("input", function () { layer.id = idInput.value; markDirty(); validateLayerId(); onStructural(); });
    validateLayerId();
    idWrap.appendChild(idInput); idWrap.appendChild(idMsg);
    card.appendChild(idWrap);

    var groupWrap = el("div", "adm-field half");
    groupWrap.appendChild(el("label", "adm-label", "Group"));
    var groupSel = el("select", "adm-select");
    (mapDoc.groups || []).forEach(function (g) { var opt = el("option", null, g.title); opt.value = g.id; groupSel.appendChild(opt); });
    groupSel.value = layer.group || "";
    groupSel.addEventListener("change", function () { layer.group = groupSel.value; markDirty(); });
    groupWrap.appendChild(groupSel);
    card.appendChild(groupWrap);

    var sourceFieldsZone = el("div");
    var typeWrap = el("div", "adm-field half");
    typeWrap.appendChild(el("label", "adm-label", "Source type"));
    var typeSel = el("select", "adm-select");
    SOURCE_TYPE_OPTIONS.forEach(function (o) { var opt = el("option", null, o[1]); opt.value = o[0]; typeSel.appendChild(opt); });
    typeSel.value = layer.sourceType;
    typeSel.addEventListener("change", function () { layer.sourceType = typeSel.value; markDirty(); onStructural(); drawSourceFields(); });
    typeWrap.appendChild(typeSel);
    card.appendChild(typeWrap);
    card.appendChild(sourceFieldsZone);

    var popupFieldsZone = el("div");
    var testStatus = el("p", "adm-hint", "");

    function drawSourceFields() {
      sourceFieldsZone.innerHTML = "";
      fText(sourceFieldsZone, "Service / file URL", layer, "url", { placeholder: "https://…/MapServer or data/gis/layers/….geojson" });
      var isEsri = layer.sourceType === "esriDynamic" || layer.sourceType === "esriFeature" || layer.sourceType === "esriImage";
      if (layer.sourceType === "esriDynamic") {
        fIndexList(sourceFieldsZone, "Sublayers (comma-separated indexes)", layer, "layers", { half: true });
      } else if (layer.sourceType === "esriFeature") {
        fNumber(sourceFieldsZone, "Sublayer index", layer, "layerId", { half: true, min: 0, step: 1 });
      }
      if (isEsri) {
        var btnRow = el("div", "adm-btnrow");
        var testBtn = el("button", "adm-btn adm-btn-small", "Test connection");
        testBtn.type = "button";
        testBtn.addEventListener("click", function () { testArcgisConnection(layer.url, testStatus); });
        btnRow.appendChild(testBtn);
        if (layer.sourceType !== "esriImage") {
          var loadBtn = el("button", "adm-btn adm-btn-small", "Load fields from service");
          loadBtn.type = "button";
          loadBtn.addEventListener("click", function () { loadFieldsFromService(layer, drawPopupFields); });
          btnRow.appendChild(loadBtn);
        }
        sourceFieldsZone.appendChild(btnRow);
        sourceFieldsZone.appendChild(testStatus);
      }
      sourceRefPicker(sourceFieldsZone, "Data source (provenance)", layer,
        { hint: "One of the entries in the Data sources editor's Candidate layers list." });
    }
    drawSourceFields();

    fCheck(card, "Visible by default", layer, "visible");
    fRange(card, "Opacity", layer, "opacity", { min: 0, max: 1, step: 0.05 });
    fNumber(card, "Zoom range — min", layer, "minZoom", { half: true, min: 0, max: 22, step: 1 });
    fNumber(card, "Zoom range — max", layer, "maxZoom", { half: true, min: 0, max: 22, step: 1 });
    fCheck(card, "Clip to Iberia Parish", layer, "clipToParish");

    var legendWrap = el("div", "adm-field half");
    legendWrap.appendChild(el("label", "adm-label", "Legend"));
    var legendSel = el("select", "adm-select");
    [["auto", "Automatic from the service / style"], ["none", "None"], ["custom", "Custom"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; legendSel.appendChild(opt);
    });
    if (!layer.legend) layer.legend = { mode: "auto" };
    legendSel.value = layer.legend.mode || "auto";
    var legendItemsZone = el("div");
    legendSel.addEventListener("change", function () {
      layer.legend.mode = legendSel.value; markDirty(); drawLegendItems();
    });
    legendWrap.appendChild(legendSel);
    card.appendChild(legendWrap);
    card.appendChild(legendItemsZone);
    function drawLegendItems() {
      legendItemsZone.innerHTML = "";
      if (layer.legend.mode !== "custom") return;
      if (!Array.isArray(layer.legendItems)) layer.legendItems = [];
      fList(legendItemsZone, "Legend rows", layer.legendItems, function (row, item) {
        fText(row, "Label", item, "label", { half: true });
        fColor(row, "Color", item, "color");
      }, function () { return { label: "", color: "#c49a2a" }; }, "+ Add row");
    }
    drawLegendItems();

    fCheck(card, "Clickable (show details on click)", layer, "queryable");
    if (!layer.popup) layer.popup = { title: "", fields: [], linkField: null };
    fText(card, "Popup title (e.g. {ZONE})", layer.popup, "title", { hint: "Curly braces pull a field's raw value, e.g. {ZONE}." });
    card.appendChild(popupFieldsZone);
    function drawPopupFields() {
      popupFieldsZone.innerHTML = "";
      if (!Array.isArray(layer.popup.fields)) layer.popup.fields = [];
      fListOrdered(popupFieldsZone, "Fields to show", layer.popup.fields, function (row, item) {
        fText(row, "Field name", item, "name", { half: true });
        fText(row, "Shown as", item, "label", { half: true });
        fSelect(row, "Format", item, "format", [["", "Plain text"], ["number", "Number"], ["date", "Date"]], { half: true });
        fText(row, "Suffix (e.g. “ ft”)", item, "suffix", { half: true });
      }, function () { return { name: "", label: "" }; }, "+ Add field");
    }
    drawPopupFields();

    var styleBox = section(card, "Style (vector layers only)");
    if (!layer.style) layer.style = { color: "#c49a2a", weight: 1.5, fillColor: "#c49a2a", fillOpacity: 0.18, dashArray: null, pointRadius: 5, classify: null };
    fColor(styleBox, "Line color", layer.style, "color");
    fNumber(styleBox, "Line width", layer.style, "weight", { half: true, min: 0, step: 0.5 });
    fColor(styleBox, "Fill color", layer.style, "fillColor");
    fRange(styleBox, "Fill opacity", layer.style, "fillOpacity", { min: 0, max: 1, step: 0.05 });
    fNumber(styleBox, "Point radius (point layers)", layer.style, "pointRadius", { half: true, min: 1, step: 1 });

    fText(card, "Description", layer, "description", { textarea: true, rows: 2 });
    fText(card, "Attribution", layer, "attribution");
    fText(card, "Last updated", layer, "updated", { placeholder: "YYYY-MM-DD", half: true });
  }

  /* ============================================================
     MAP EDITOR — remaining sections  (06-SPEC §4)
     ============================================================ */
  function groupsEditor(parent, mapDoc, onStructural) {
    var box = section(parent, "Layer groups",
      "Groups are containers for layers in the layer panel. Deleting one asks where its layers should go.");
    if (!Array.isArray(mapDoc.groups)) mapDoc.groups = [];
    fListOrdered(box, "Groups", mapDoc.groups, function (card, item) {
      fText(card, "Title", item, "title", { half: true });
      fCheck(card, "Open by default", item, "open");
    }, function () {
      return { id: "group-" + Math.random().toString(36).slice(2, 8), title: "New group", open: false };
    }, "+ Add group", {
      beforeRemove: function (item) {
        var affected = (mapDoc.layers || []).filter(function (l) { return l.group === item.id; });
        if (!affected.length) return true;
        var remaining = mapDoc.groups.filter(function (g) { return g !== item; });
        if (!remaining.length) {
          alert("Can't remove the last group while " + affected.length + " layer(s) still use it. Add another group first.");
          return false;
        }
        var choices = remaining.map(function (g, i) { return (i + 1) + ". " + g.title; }).join("\n");
        var pick = prompt(affected.length + " layer(s) are in “" + item.title + "”. Move them to which group?\n" + choices, "1");
        var idx = parseInt(pick, 10) - 1;
        if (!(idx >= 0 && idx < remaining.length)) { alert("Cancelled — group not removed."); return false; }
        affected.forEach(function (l) { l.group = remaining[idx].id; });
        onStructural();
        return true;
      },
      onChange: onStructural
    });
  }

  function basemapsEditor(parent, mapDoc, onStructural) {
    var box = section(parent, "Basemaps");
    if (!Array.isArray(mapDoc.basemaps)) mapDoc.basemaps = [];
    fListOrdered(box, "Basemaps", mapDoc.basemaps, function (card, item) {
      fText(card, "Title", item, "title", { half: true });
      fText(card, "Short id", item, "id", { half: true, hint: "Referenced by tour steps' basemap field." });
      var typeWrap = el("div", "adm-field half");
      typeWrap.appendChild(el("label", "adm-label", "Type"));
      var typeSel = el("select", "adm-select");
      [["tileXYZ", "Tiled (XYZ)"], ["esriImage", "ArcGIS image service"], ["wms", "WMS"], ["none", "No basemap"]].forEach(function (o) {
        var opt = el("option", null, o[1]); opt.value = o[0]; typeSel.appendChild(opt);
      });
      typeSel.value = item.type || "tileXYZ";
      typeSel.addEventListener("change", function () { item.type = typeSel.value; markDirty(); onStructural(); });
      typeWrap.appendChild(typeSel);
      card.appendChild(typeWrap);
      if (item.type !== "none") {
        fText(card, "URL", item, "url", { placeholder: "https://…/{z}/{x}/{y}.png" });
        fText(card, "Attribution", item, "attribution");
      }
      var defWrap = el("div", "adm-field adm-check");
      var defLab = el("label", "adm-checklabel");
      var defRadio = el("input"); defRadio.type = "radio"; defRadio.name = "admBasemapDefault";
      defRadio.checked = !!item.default;
      defRadio.addEventListener("change", function () {
        mapDoc.basemaps.forEach(function (o) { o.default = (o === item); });
        markDirty(); onStructural();
      });
      defLab.appendChild(defRadio);
      defLab.appendChild(document.createTextNode(" Default basemap"));
      defWrap.appendChild(defLab);
      card.appendChild(defWrap);
    }, function () {
      return { id: "basemap-" + Math.random().toString(36).slice(2, 8), title: "New basemap", type: "tileXYZ", url: "", attribution: "" };
    }, "+ Add basemap", {
      beforeRemove: function () {
        if (mapDoc.basemaps.length <= 1) { alert("A map needs at least one basemap."); return false; }
        return true;
      },
      onChange: onStructural
    });
  }

  var TOOL_DESCRIPTIONS = {
    layerPanel: "Grouped layer list with visibility, opacity and zoom-to-extent.",
    basemapSwitcher: "Lets visitors change the base imagery/street map.",
    legend: "Auto-built swatches for currently visible layers.",
    identify: "Click a feature to see its details in a popup.",
    attributeTable: "A sortable, filterable table of a layer's rows.",
    filter: "Build a field/operator/value query against a layer.",
    measure: "Distance and area measurement.",
    draw: "Point/line/polygon/rectangle/text annotation.",
    coordinates: "Live lat/lng readout and go-to-coordinates.",
    search: "Feature and place search, parish-limited.",
    geolocate: "One-shot “where am I” with an accuracy circle.",
    bookmarks: "Jump to the named places authored below.",
    swipe: "Drag a divider to compare two layers.",
    timeline: "Scrub through time-stepped layers.",
    print: "Print-styled full-page map view.",
    exportData: "Download visible features as GeoJSON/CSV.",
    share: "Copy a link that restores the current map state.",
    fullscreen: "Expand the map to fill the screen.",
    scaleBar: "Always-on scale bar.",
    miniMap: "A small locator inset map."
  };
  function toolLabel(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function toolsEditor(parent, mapDoc) {
    var box = section(parent, "Tools", "Each tool is optional — turn off anything this map doesn't need. Defaults to on.");
    if (!mapDoc.tools) mapDoc.tools = {};
    var grid = el("div", "adm-toolgrid");
    Object.keys(TOOL_DESCRIPTIONS).forEach(function (key) {
      if (mapDoc.tools[key] == null) mapDoc.tools[key] = true;
      var item = el("div", "adm-toolitem");
      fCheck(item, toolLabel(key), mapDoc.tools, key, TOOL_DESCRIPTIONS[key]);
      grid.appendChild(item);
    });
    box.appendChild(grid);
  }

  function bookmarksEditor(parent, mapDoc, getPreviewInstance) {
    var box = section(parent, "Bookmarks");
    if (!Array.isArray(mapDoc.bookmarks)) mapDoc.bookmarks = [];
    fListOrdered(box, "Bookmarks", mapDoc.bookmarks, function (card, item) {
      fText(card, "Title", item, "title", { half: true });
      fText(card, "Short id", item, "id", { half: true });
      fView(card, item, "view", { withCapture: true, getPreviewInstance: getPreviewInstance });
    }, function () {
      return { id: "bookmark-" + Math.random().toString(36).slice(2, 8), title: "New bookmark",
               view: { center: mapDoc.view.center.slice(), zoom: mapDoc.view.zoom } };
    }, "+ Add bookmark");
  }

  function toursSectionForMap(parent, mapFile) {
    var m = docs[mapFile];
    var box = section(parent, "Guided tours");
    var tours = gisTourFiles(m.id);
    if (!tours.length) box.appendChild(el("p", "adm-hint", "No tours yet."));
    tours.forEach(function (tf) {
      var row = el("div", "adm-listitem");
      var bar = el("div", "adm-itembar");
      bar.appendChild(el("span", "adm-itemtitle", docs[tf].title));
      var btns = el("div", "adm-itembtns");
      var openBtn = el("button", "adm-btn adm-btn-small", "Edit");
      openBtn.type = "button";
      openBtn.addEventListener("click", function () { select("gistour:" + tf); });
      var delBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Delete");
      delBtn.type = "button";
      delBtn.addEventListener("click", function () { deleteGisTour(tf); });
      btns.appendChild(openBtn); btns.appendChild(delBtn);
      bar.appendChild(btns);
      row.appendChild(bar);
      box.appendChild(row);
    });
    var defWrap = el("div", "adm-field");
    defWrap.appendChild(el("label", "adm-label", "Default tour (auto-opens once per session)"));
    var defSel = el("select", "adm-select");
    var noneOpt = el("option", null, "— None —"); noneOpt.value = ""; defSel.appendChild(noneOpt);
    tours.forEach(function (tf) { var opt = el("option", null, docs[tf].title); opt.value = docs[tf].id; defSel.appendChild(opt); });
    defSel.value = m.defaultTour || "";
    defSel.addEventListener("change", function () { m.defaultTour = defSel.value || null; markDirty(); });
    defWrap.appendChild(defSel);
    box.appendChild(defWrap);
    var addBtn = el("button", "adm-btn adm-btn-small", "+ New tour");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { addGisTour(mapFile); });
    box.appendChild(addBtn);
  }

  function featureToursSectionForMap(parent, mapFile) {
    var m = docs[mapFile];
    var box = section(parent, "Feature tours",
      "A tour that starts when someone clicks one specific feature on the map (e.g. one CPRA project pin), instead of the whole-map tour above.");
    var ftFiles = gisFeatureTourFiles(m.id);
    if (!ftFiles.length) box.appendChild(el("p", "adm-hint", "No feature tours yet."));
    ftFiles.forEach(function (ff) {
      var ft = docs[ff];
      var layerDef = (m.layers || []).find(function (l) { return l.id === ft.layerId; });
      var tourFile = gisTourFiles(m.id).filter(function (tf) { return docs[tf].id === ft.tourId; })[0];
      var row = el("div", "adm-listitem");
      var bar = el("div", "adm-itembar");
      var label = (tourFile ? docs[tourFile].title : "(no tour linked)") +
        " — " + (layerDef ? layerDef.title : ft.layerId || "?") +
        " = " + (ft.featureKey && ft.featureKey.value || "?") +
        (ft.enabled === false ? " (disabled)" : "");
      bar.appendChild(el("span", "adm-itemtitle", label));
      var btns = el("div", "adm-itembtns");
      var openBtn = el("button", "adm-btn adm-btn-small", "Edit");
      openBtn.type = "button";
      openBtn.addEventListener("click", function () { select("gisfeaturetour:" + ff); });
      var delBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Delete");
      delBtn.type = "button";
      delBtn.addEventListener("click", function () { deleteGisFeatureTour(ff); });
      btns.appendChild(openBtn); btns.appendChild(delBtn);
      bar.appendChild(btns);
      row.appendChild(bar);
      box.appendChild(row);
    });
    var addBtn = el("button", "adm-btn adm-btn-small", "+ New feature tour");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { addGisFeatureTour(mapFile); });
    box.appendChild(addBtn);
  }

  function editGisMap(pane, file) {
    var m = docs[file];
    if (!m) return;
    setPaneWide(true);

    var split = el("div", "adm-gissplit");
    var formCol = el("div", "adm-gisform");
    var previewCol = el("div", "adm-gispreview-col");
    split.appendChild(formCol); split.appendChild(previewCol);
    pane.appendChild(split);

    var preview = gisPreviewPanel(previewCol, function () { return m; });
    currentGisPreview = preview;
    function structural() { preview.refresh(); }

    var s1 = section(formCol, "Map — " + m.title);
    fText(s1, "Title", m, "title", { half: true });
    var idWrap = el("div", "adm-field half");
    idWrap.appendChild(el("label", "adm-label", "Id (read-only)"));
    var idShow = el("input", "adm-input"); idShow.type = "text"; idShow.value = m.id; idShow.disabled = true;
    idWrap.appendChild(idShow);
    s1.appendChild(idWrap);
    fText(s1, "Subtitle", m, "subtitle");
    fText(s1, "Attribution", m, "attribution");
    accessLevelField(s1, m, "access", {
      top: true,
      label: "Access level",
      resourceKey: function () { return "gismap." + m.id; },
      hint: "A GIS map is a whole-document gate (ACCESS-MODEL.md §5) — this covers the map itself, every guided tour on it, and its local layer files together, not just the project experience that links to it."
    });

    var s2 = section(formCol, "Default view");
    fView(s2, m, "view", { withCapture: true, getPreviewInstance: preview.getInstance });
    fNumber(s2, "Min zoom", m.view, "minZoom", { half: true, min: 0, max: 22, step: 1 });
    fNumber(s2, "Max zoom", m.view, "maxZoom", { half: true, min: 0, max: 22, step: 1 });
    fBoundsRaw(s2, "Max bounds", m.view, "maxBounds", { hint: "The envelope panning is restricted to, when the checkbox below is on." });
    fCheck(s2, "Restrict panning to bounds", m.view, "restrictToBounds");

    var s3 = section(formCol, "Parish boundary");
    var boundaryWrap = el("div", "adm-field");
    boundaryWrap.appendChild(el("label", "adm-label", "Boundary layer"));
    var boundarySel = el("select", "adm-select");
    function refreshBoundaryOptions() {
      boundarySel.innerHTML = "";
      (m.layers || []).forEach(function (ld) { var opt = el("option", null, ld.title); opt.value = ld.id; boundarySel.appendChild(opt); });
      boundarySel.value = m.boundary.layerId || "";
    }
    refreshBoundaryOptions();
    boundarySel.addEventListener("change", function () { m.boundary.layerId = boundarySel.value; markDirty(); structural(); });
    boundaryWrap.appendChild(boundarySel);
    s3.appendChild(boundaryWrap);
    fCheck(s3, "Dim everything outside the parish", m.boundary, "showMask");
    fRange(s3, "Mask opacity", m.boundary, "maskOpacity", { min: 0, max: 1, step: 0.05 });

    basemapsEditor(formCol, m, structural);
    groupsEditor(formCol, m, structural);

    var s6 = section(formCol, "Layers");
    if (!Array.isArray(m.layers)) m.layers = [];
    function layersChanged() { structural(); refreshBoundaryOptions(); }
    fListOrdered(s6, "Layers", m.layers, function (card, layer) {
      layerEditor(card, layer, m, layersChanged);
    }, function () { return layerSkeleton(m); }, "+ Add layer", { swapKeys: ["zIndex"], onChange: layersChanged });

    toolsEditor(formCol, m);
    bookmarksEditor(formCol, m, preview.getInstance);
    toursSectionForMap(formCol, file);
    featureToursSectionForMap(formCol, file);

    var danger = section(formCol, "Danger zone");
    var delBtn = el("button", "adm-btn adm-btn-danger", "Delete this map");
    delBtn.type = "button";
    delBtn.addEventListener("click", function () { deleteGisMap(file); });
    danger.appendChild(delBtn);
  }

  /* ============================================================
     TOUR EDITOR  (06-SPEC §5 / 05-SPEC §1)
     ============================================================ */
  function ctaActionEditor(parent, label, cta, mapDoc, currentTourFile) {
    var wrap = el("div", "adm-field");
    wrap.appendChild(el("label", "adm-label", label));
    var kindSel = el("select", "adm-select");
    [["openLayerPanel", "Open the layer panel"], ["openAttributeTable", "Open the attribute table"],
     ["startTour", "Start another tour"], ["link", "Open a link"], ["exit", "Exit the tour"]].forEach(function (o) {
      var opt = el("option", null, o[1]); opt.value = o[0]; kindSel.appendChild(opt);
    });
    var raw = cta.action || "openLayerPanel";
    var sep = raw.indexOf(":");
    var kind = sep !== -1 ? raw.slice(0, sep) : raw;
    var param = sep !== -1 ? raw.slice(sep + 1) : "";
    kindSel.value = kind;
    wrap.appendChild(kindSel);
    var paramZone = el("div");
    wrap.appendChild(paramZone);

    function drawParam() {
      paramZone.innerHTML = "";
      if (kindSel.value === "startTour") {
        var tourSel = el("select", "adm-select");
        gisTourFiles(mapDoc && mapDoc.id).filter(function (tf) { return tf !== currentTourFile; }).forEach(function (tf) {
          var opt = el("option", null, docs[tf].title); opt.value = docs[tf].id; tourSel.appendChild(opt);
        });
        if (!tourSel.options.length) { paramZone.appendChild(el("p", "adm-hint", "No other tours on this map yet.")); return; }
        tourSel.value = param || tourSel.options[0].value;
        cta.action = "startTour:" + tourSel.value;
        tourSel.addEventListener("change", function () { cta.action = "startTour:" + tourSel.value; markDirty(); });
        paramZone.appendChild(tourSel);
      } else if (kindSel.value === "link") {
        var urlIn = el("input", "adm-input"); urlIn.type = "text"; urlIn.placeholder = "https://…"; urlIn.value = param;
        urlIn.addEventListener("input", function () { cta.action = "link:" + urlIn.value; markDirty(); });
        paramZone.appendChild(urlIn);
      } else {
        cta.action = kindSel.value;
      }
    }
    kindSel.addEventListener("change", function () { markDirty(); drawParam(); });
    drawParam();
    parent.appendChild(wrap);
  }

  /* Drives the preview exactly the way js/gis/gis-tour.js's own applyStep()
     drives the real map -- through the same §5 public API only (clear
     highlight, off then on then opacity, basemap, view, highlight) -- never
     a hand-rolled shortcut through getState()/applyState()'s diff-against-
     defaults semantics, which isn't equivalent to a full step apply. */
  function previewTourStep(inst, step, mapDoc) {
    if (!inst || !mapDoc) return;
    inst.clearHighlight();
    var hideAll = step.layers && Array.isArray(step.layers.off) && step.layers.off.indexOf("*") !== -1;
    if (hideAll) (mapDoc.layers || []).forEach(function (def) { inst.setLayerVisible(def.id, false); });
    else if (step.layers && Array.isArray(step.layers.off)) step.layers.off.forEach(function (id) { inst.setLayerVisible(id, false); });
    if (step.layers && Array.isArray(step.layers.on)) step.layers.on.forEach(function (id) { inst.setLayerVisible(id, true); });
    if (step.layers && step.layers.opacity) {
      Object.keys(step.layers.opacity).forEach(function (id) { inst.setLayerOpacity(id, step.layers.opacity[id]); });
    }
    if (step.basemap) inst.setBasemap(step.basemap);
    if (step.view) inst.setView(step.view);
    if (step.highlight) {
      inst.highlight(step.highlight.layerId,
        step.highlight.objectIds ? { objectIds: step.highlight.objectIds } : { where: step.highlight.where });
    }
  }

  function tourStepEditor(card, step, mapDoc, getPreviewInstance, redraw) {
    fText(card, "Title", step, "title", { half: true });
    var idWrap = el("div", "adm-field half");
    idWrap.appendChild(el("label", "adm-label", "Short id"));
    var idIn = el("input", "adm-input"); idIn.type = "text"; idIn.value = step.id || "";
    idIn.addEventListener("input", function () { step.id = idIn.value; markDirty(); });
    idWrap.appendChild(idIn);
    card.appendChild(idWrap);

    var bodyInput = fText(card, "Body text", step, "body", { textarea: true, rows: 3 });
    var counter = el("p", "adm-hint", "");
    function updateCounter() {
      var words = (step.body || "").trim().split(/\s+/).filter(Boolean).length;
      counter.textContent = words + " word" + (words === 1 ? "" : "s") + " — keep under ~55, the card is narrow.";
      counter.style.color = words > 55 ? "var(--adm-danger)" : "";
    }
    bodyInput.addEventListener("input", updateCounter);
    updateCounter();
    card.appendChild(counter);

    if (!step.layers) step.layers = { on: [], off: ["*"] };
    fView(card, step, "view", {});

    var captureBox = el("div", "adm-capturebox");
    var capBtn = el("button", "adm-btn adm-btn-small", "📍 Capture current view");
    capBtn.type = "button";
    capBtn.title = "Drive the preview map to what this step should show, then click. Saves the position, zoom, visible layers and basemap.";
    capBtn.addEventListener("click", function () {
      var inst = getPreviewInstance && getPreviewInstance();
      if (!inst || !mapDoc) { alert("Preview isn't ready yet — wait a moment and try again."); return; }
      var st = inst.getState();
      step.view = { center: [st.c[0], st.c[1]], zoom: st.z };
      step.basemap = st.b;
      var hideAll = step.layers && Array.isArray(step.layers.off) && step.layers.off.indexOf("*") !== -1;
      var vis = {}, opacity = {};
      (mapDoc.layers || []).forEach(function (def) {
        var pair = st.l && st.l[def.id];
        vis[def.id] = pair ? !!pair[0] : !!def.visible;
        if (pair && typeof pair[1] === "number") opacity[def.id] = pair[1];
      });
      step.layers = { on: Object.keys(vis).filter(function (id) { return vis[id]; }), off: hideAll ? ["*"] : [] };
      if (Object.keys(opacity).length) step.layers.opacity = opacity;
      markDirty();
      redraw();
    });
    captureBox.appendChild(capBtn);
    var previewBtn = el("button", "adm-btn adm-btn-small adm-btn-ghost", "Preview this step");
    previewBtn.type = "button";
    previewBtn.addEventListener("click", function () {
      var inst = getPreviewInstance && getPreviewInstance();
      if (!inst) { alert("Preview isn't ready yet."); return; }
      previewTourStep(inst, step, mapDoc);
    });
    captureBox.appendChild(previewBtn);
    card.appendChild(captureBox);
    var savedInfo = el("p", "adm-hint",
      (step.layers.on || []).length + " layer(s) on" + (step.basemap ? " · basemap " + step.basemap : "") +
      (step.layers.off && step.layers.off.indexOf("*") !== -1 ? "" : " · other layers left as-is"));
    card.appendChild(savedInfo);

    var hideOthersWrap = el("div", "adm-field adm-check");
    var hideOthersLab = el("label", "adm-checklabel");
    var hideOthersCheck = el("input"); hideOthersCheck.type = "checkbox";
    hideOthersCheck.checked = Array.isArray(step.layers.off) && step.layers.off.indexOf("*") !== -1;
    hideOthersCheck.addEventListener("change", function () {
      step.layers.off = hideOthersCheck.checked ? ["*"] : [];
      markDirty();
    });
    hideOthersLab.appendChild(hideOthersCheck);
    hideOthersLab.appendChild(document.createTextNode(" Hide all other layers"));
    hideOthersWrap.appendChild(hideOthersLab);
    card.appendChild(hideOthersWrap);

    var layersWrap = el("div", "adm-field");
    layersWrap.appendChild(el("label", "adm-label", "Layers on for this step"));
    var grid = el("div", "adm-toolgrid");
    (mapDoc ? mapDoc.layers : []).forEach(function (def) {
      var item = el("div");
      var lab = el("label", "adm-checklabel");
      var cb = el("input"); cb.type = "checkbox";
      cb.checked = step.layers.on.indexOf(def.id) !== -1;
      cb.addEventListener("change", function () {
        var i = step.layers.on.indexOf(def.id);
        if (cb.checked && i === -1) step.layers.on.push(def.id);
        else if (!cb.checked && i !== -1) step.layers.on.splice(i, 1);
        markDirty();
      });
      lab.appendChild(cb); lab.appendChild(document.createTextNode(" " + def.title));
      item.appendChild(lab); grid.appendChild(item);
    });
    layersWrap.appendChild(grid);
    card.appendChild(layersWrap);

    var highlightWrap = el("div", "adm-field half");
    highlightWrap.appendChild(el("label", "adm-label", "Highlight"));
    var hlSel = el("select", "adm-select");
    var noneOpt = el("option", null, "None"); noneOpt.value = ""; hlSel.appendChild(noneOpt);
    (mapDoc ? mapDoc.layers : []).forEach(function (def) { var opt = el("option", null, def.title); opt.value = def.id; hlSel.appendChild(opt); });
    hlSel.value = step.highlight ? step.highlight.layerId : "";
    highlightWrap.appendChild(hlSel);
    card.appendChild(highlightWrap);
    var hlWhereZone = el("div");
    card.appendChild(hlWhereZone);
    function drawHlWhere() {
      hlWhereZone.innerHTML = "";
      if (!hlSel.value) { step.highlight = null; return; }
      if (!step.highlight || step.highlight.layerId !== hlSel.value) step.highlight = { layerId: hlSel.value, where: "1=1" };
      fText(hlWhereZone, "Where clause (e.g. 1=1 for everything)", step.highlight, "where", { half: true });
    }
    hlSel.addEventListener("change", function () { markDirty(); drawHlWhere(); });
    drawHlWhere();

    var mediaZone = el("div");
    card.appendChild(mediaZone);
    function drawMedia() {
      mediaZone.innerHTML = "";
      if (!step.media) {
        var addImgBtn = el("button", "adm-btn adm-btn-small", "+ Add image (optional)");
        addImgBtn.type = "button";
        addImgBtn.addEventListener("click", function () {
          step.media = { _type: "image", source: { kind: "path", value: "" }, alt: "" };
          markDirty(); drawMedia();
        });
        mediaZone.appendChild(addImgBtn);
        var addVidBtn = el("button", "adm-btn adm-btn-small adm-btn-ghost", "+ Add video (optional)");
        addVidBtn.type = "button";
        addVidBtn.addEventListener("click", function () {
          step.media = { _type: "video", source: { kind: "url", value: "" }, alt: "" };
          markDirty(); drawMedia();
        });
        mediaZone.appendChild(addVidBtn);
        return;
      }
      if (step.media._type === "video") {
        fSource(mediaZone, "Video", step.media.source, {
          hint: "A YouTube or Vimeo watch link embeds automatically (js/gis/gis-tour.js detects it from the URL — no separate provider field). Anything else is played as a direct video file."
        });
        fText(mediaZone, "Title (for screen readers)", step.media, "alt", { half: true });
        var rmVidBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Remove video");
        rmVidBtn.type = "button";
        rmVidBtn.addEventListener("click", function () { step.media = null; markDirty(); drawMedia(); });
        mediaZone.appendChild(rmVidBtn);
        return;
      }
      fSource(mediaZone, "Image", step.media.source, { imagePreview: true });
      fText(mediaZone, "Alt text", step.media, "alt", { half: true });
      var rmBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Remove image");
      rmBtn.type = "button";
      rmBtn.addEventListener("click", function () { step.media = null; markDirty(); drawMedia(); });
      mediaZone.appendChild(rmBtn);
    }
    drawMedia();
  }

  function editGisTour(pane, file) {
    var t = docs[file];
    if (!t) return;
    setPaneWide(true);

    var split = el("div", "adm-gissplit");
    var formCol = el("div", "adm-gisform");
    var previewCol = el("div", "adm-gispreview-col");
    split.appendChild(formCol); split.appendChild(previewCol);
    pane.appendChild(split);

    var mapFile = Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === "gisMap" && docs[f].id === t.mapId; })[0];
    var mapDoc = mapFile ? docs[mapFile] : null;
    var preview = null;
    if (mapDoc) {
      preview = gisPreviewPanel(previewCol, function () { return mapDoc; });
      currentGisPreview = preview;
    } else {
      previewCol.appendChild(el("p", "adm-hint", "This tour's map (“" + t.mapId + "”) doesn't exist — pick a valid map below."));
    }

    var s1 = section(formCol, "Tour — " + t.title);
    fText(s1, "Title", t, "title", { half: true });
    var idWrap = el("div", "adm-field half");
    idWrap.appendChild(el("label", "adm-label", "Id (read-only)"));
    var idShow = el("input", "adm-input"); idShow.type = "text"; idShow.value = t.id; idShow.disabled = true;
    idWrap.appendChild(idShow);
    s1.appendChild(idWrap);
    var mapSel = fDocPicker(s1, "Map", t, "mapId", "gisMap", { hint: "Changing this reloads the preview against the new map." });
    mapSel.addEventListener("change", function () { select("gistour:" + file); });
    fText(s1, "Intro text", t, "intro", { textarea: true, rows: 2 });
    fCheck(s1, "Start automatically the first time someone opens the map", t, "autoStart");
    fCheck(s1, "Advance steps automatically", t, "autoAdvance");
    fNumber(s1, "Default seconds per step", t, "defaultDuration", { half: true, min: 3, max: 120, step: 1 });
    fSelect(s1, "Card position", t, "position",
      [["left", "Left"], ["right", "Right"], ["bottom", "Bottom (forced on mobile regardless)"]], { half: true });
    fCheck(s1, "Show progress dots", t, "showProgress");

    var s2 = section(formCol, "Steps");
    if (!Array.isArray(t.steps)) t.steps = [];
    var stepsHandle = fListOrdered(s2, "Steps", t.steps, function (card, step) {
      tourStepEditor(card, step, mapDoc, preview && preview.getInstance, function () { stepsHandle.redraw(); });
    }, function () {
      return {
        id: "step-" + Math.random().toString(36).slice(2, 8), title: "New step", body: "",
        view: mapDoc ? { center: mapDoc.view.center.slice(), zoom: mapDoc.view.zoom } : { center: [29.740394, -91.635827], zoom: 10 },
        basemap: null, layers: { on: [], off: ["*"] }, highlight: null, media: null, duration: null
      };
    }, "+ Add step");

    var s3 = section(formCol, "Ending");
    if (!t.outro) t.outro = { title: "", body: "", cta: { label: "", action: "openLayerPanel" } };
    fText(s3, "Title", t.outro, "title", { half: true });
    fText(s3, "Text", t.outro, "body", { textarea: true, rows: 3 });
    if (!t.outro.cta) t.outro.cta = { label: "", action: "openLayerPanel" };
    fText(s3, "Button label", t.outro.cta, "label", { half: true });
    ctaActionEditor(s3, "Button action", t.outro.cta, mapDoc, file);

    var danger = section(formCol, "Danger zone");
    var delBtn = el("button", "adm-btn adm-btn-danger", "Delete this tour");
    delBtn.type = "button";
    delBtn.addEventListener("click", function () { deleteGisTour(file); });
    danger.appendChild(delBtn);
  }

  /* ============================================================
     FEATURE TOUR EDITOR
     ------------------------------------------------------------
     The association editor: which layer + attribute field/value
     (not an ArcGIS OBJECTID -- some services, including CPRA's,
     don't report an objectIdField) opens which ordinary gisTour.
     "Pick from map" arms a one-shot listener on the live preview's
     own "identify" event (the same event js/gis/gis-tools.js's
     popup already reacts to -- this doesn't compete with it, it
     just also listens) so an editor can click a real feature
     instead of typing a field name and value by hand.
     ============================================================ */
  function editGisFeatureTour(pane, file) {
    var ft = docs[file];
    if (!ft) return;
    setPaneWide(true);

    var split = el("div", "adm-gissplit");
    var formCol = el("div", "adm-gisform");
    var previewCol = el("div", "adm-gispreview-col");
    split.appendChild(formCol); split.appendChild(previewCol);
    pane.appendChild(split);

    var mapFile = Object.keys(docs).filter(function (f) { return docs[f] && docs[f]._type === "gisMap" && docs[f].id === ft.mapId; })[0];
    var mapDoc = mapFile ? docs[mapFile] : null;
    var preview = null;
    if (mapDoc) {
      preview = gisPreviewPanel(previewCol, function () { return mapDoc; });
      currentGisPreview = preview;
    } else {
      previewCol.appendChild(el("p", "adm-hint", "This feature tour's map (“" + ft.mapId + "”) doesn't exist."));
    }

    var s1 = section(formCol, "Feature tour");
    var idWrap = el("div", "adm-field half");
    idWrap.appendChild(el("label", "adm-label", "Id (read-only)"));
    var idShow = el("input", "adm-input"); idShow.type = "text"; idShow.value = ft.id; idShow.disabled = true;
    idWrap.appendChild(idShow);
    s1.appendChild(idWrap);
    fCheck(s1, "Enabled", ft, "enabled");

    var layerWrap = el("div", "adm-field");
    layerWrap.appendChild(el("label", "adm-label", "Layer"));
    var layerSel = el("select", "adm-select");
    (mapDoc ? mapDoc.layers : []).forEach(function (def) { var opt = el("option", null, def.title); opt.value = def.id; layerSel.appendChild(opt); });
    layerSel.value = ft.layerId || "";
    layerSel.addEventListener("change", function () { ft.layerId = layerSel.value; markDirty(); });
    layerWrap.appendChild(layerSel);
    s1.appendChild(layerWrap);

    if (!ft.featureKey) ft.featureKey = { field: "", value: "" };
    var pickWrap = el("div", "adm-field");
    pickWrap.appendChild(el("label", "adm-label", "Feature (which map feature opens this tour)"));
    var pickBtn = el("button", "adm-btn adm-btn-small", "📍 Pick from map");
    pickBtn.type = "button";
    var pickStatus = el("p", "adm-hint", "");
    var offPick = null;
    var fieldIn, valueIn;
    pickBtn.addEventListener("click", function () {
      var inst = preview && preview.getInstance && preview.getInstance();
      if (!inst) { alert("Preview isn't ready yet — wait a moment and try again."); return; }
      if (offPick) { offPick(); offPick = null; }
      pickStatus.textContent = "Click a feature on the preview map…";
      offPick = inst.on("identify", function (detail) {
        pickStatus.textContent = "";
        if (offPick) { offPick(); offPick = null; }
        var hits = (detail && detail.hits) || [];
        var hit = hits.filter(function (h) { return h.layerId === ft.layerId; })[0] || hits[0];
        if (!hit) { pickStatus.textContent = "That click didn't hit a feature — try again."; return; }
        var keys = Object.keys(hit.properties || {});
        var guess = keys.filter(function (k) { return /project_id/i.test(k); })[0] || keys[0];
        if (!guess) { pickStatus.textContent = "That feature has no usable attributes."; return; }
        ft.featureKey.field = guess;
        ft.featureKey.value = String(hit.properties[guess]);
        fieldIn.value = ft.featureKey.field;
        valueIn.value = ft.featureKey.value;
        markDirty();
      });
    });
    pickWrap.appendChild(pickBtn);
    pickWrap.appendChild(pickStatus);
    s1.appendChild(pickWrap);
    fieldIn = fText(s1, "Field name (e.g. Project_Status_List.Project_ID)", ft.featureKey, "field", { half: true });
    valueIn = fText(s1, "Value (e.g. TV-0031)", ft.featureKey, "value", { half: true });

    var tourWrap = el("div", "adm-field");
    tourWrap.appendChild(el("label", "adm-label", "Guided tour"));
    var tourSel = el("select", "adm-select");
    var noneOpt = el("option", null, "— None —"); noneOpt.value = ""; tourSel.appendChild(noneOpt);
    gisTourFiles(ft.mapId).forEach(function (tf) { var opt = el("option", null, docs[tf].title); opt.value = docs[tf].id; tourSel.appendChild(opt); });
    tourSel.value = ft.tourId || "";
    tourSel.addEventListener("change", function () { ft.tourId = tourSel.value || null; markDirty(); });
    tourWrap.appendChild(tourSel);
    s1.appendChild(tourWrap);
    var createTourBtn = el("button", "adm-btn adm-btn-small adm-btn-ghost", "+ Create tour for this feature");
    createTourBtn.type = "button";
    createTourBtn.addEventListener("click", function () {
      if (!mapFile) return;
      var id = prompt("Short id for the new tour (letters/numbers/hyphens):");
      if (!id) return;
      id = id.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!id) return alert("That id isn't usable.");
      var tourFile = "gis/tours/" + id + ".json";
      if (docs[tourFile]) return alert("A tour with that id already exists.");
      docs[tourFile] = newGisTourSkeleton(mapDoc, id);
      content.manifest.documents.gis.push({ file: tourFile, type: "gisTour", id: "gis.tour." + id });
      ft.tourId = id;
      markDirty(); buildNav(); select("gisfeaturetour:" + file);
    });
    s1.appendChild(createTourBtn);

    var danger = section(formCol, "Danger zone");
    var delBtn = el("button", "adm-btn adm-btn-danger", "Delete this feature tour");
    delBtn.type = "button";
    delBtn.addEventListener("click", function () { deleteGisFeatureTour(file); });
    danger.appendChild(delBtn);
  }

  /* ============================================================
     DATA SOURCES EDITOR  (06-SPEC §6)
     ------------------------------------------------------------
     06-SPEC's field list (Source id/name/organisation/landing page,
     an Access enum, Retrieval method, feature count…) describes an
     idealized schema that doesn't match the real, already-shipped
     data/gis/sources.json — that file is Phase 0's actual verification
     record (candidateLayers[] with sourceId/feedsGroup/publisher/
     serviceEndpoint/access/cors/harvested/harvestNotes/…, plus
     corsSpike/platformNotes/openQuestions). Per this project's own
     "extend, don't reshape" rule, this editor works the real fields
     directly rather than forcing them into the spec's idealized shape.
     corsSpike and platformNotes are Phase 0 point-in-time findings, not
     day-to-day editorial content — shown read-only; a direct JSON edit
     remains the escape hatch if one ever needs to change.
     ============================================================ */
  function editGisSources(pane, file) {
    var s = docs[file];
    if (!s) return;

    var s1 = section(pane, "Data sources — " + (s.id || "gis sources"),
      "The provenance registry behind every GIS layer's attribution and legal status. " +
      "The harvest script (tools/gis-harvest.mjs) and docs/GIS-DATA-SOURCES.md both read this file.");
    fText(s1, "Last verified", s, "lastVerified", { half: true, placeholder: "YYYY-MM-DD" });
    fText(s1, "Verified by", s, "verifiedBy", { half: true });

    var s2 = section(pane, "Candidate layers", "One entry per real-world data source.");
    if (!Array.isArray(s.candidateLayers)) s.candidateLayers = [];
    fListOrdered(s2, "Sources", s.candidateLayers, function (card, item) {
      fText(card, "Source id", item, "sourceId", { half: true });
      fText(card, "Feeds group", item, "feedsGroup", { half: true });
      fText(card, "Organisation / publisher", item, "publisher", { half: true });
      fText(card, "Service type", item, "serviceType", { half: true });
      fText(card, "Service endpoint (URL)", item, "serviceEndpoint");
      fText(card, "Access", item, "access", { half: true, hint: "Free text, e.g. “public, no token”." });
      fText(card, "CORS", item, "cors", { half: true, hint: "e.g. “verified pass” or “assumed pass”." });
      fText(card, "Native SRS", item, "nativeSRS", { half: true });
      fText(card, "Recommended source type", item, "recommendedSourceType", { half: true });
      fText(card, "Iberia filter method", item, "iberiaFilter");
      fText(card, "Attribution note", item, "attribution", { textarea: true, rows: 2 });
      fCheck(card, "Harvested to a local snapshot", item, "harvested");
      if (item.harvested) {
        if (Array.isArray(item.harvestedFiles)) {
          fStringList(card, "Harvested files", item.harvestedFiles);
        } else {
          fText(card, "Harvested file", item, "harvestedFile", { placeholder: "data/gis/layers/….geojson" });
        }
        fText(card, "Harvest notes", item, "harvestNotes", { textarea: true, rows: 3 });
      }
      fText(card, "Notes", item, "notes", { textarea: true, rows: 2 });
    }, function () {
      return { sourceId: "", feedsGroup: "", publisher: "", serviceEndpoint: "", serviceType: "",
               access: "", cors: "", recommendedSourceType: "", iberiaFilter: "", attribution: "",
               harvested: false, notes: "" };
    }, "+ Add source");

    var s3 = section(pane, "Open questions", "Anything still pending human follow-up (terms of use, judgment calls).");
    if (!Array.isArray(s.openQuestions)) s.openQuestions = [];
    fList(s3, "Open questions", s.openQuestions, function (card, item) {
      fText(card, "Id", item, "id", { half: true });
      fText(card, "Owner", item, "owner", { half: true });
      fText(card, "Question", item, "question", { textarea: true, rows: 2 });
      fText(card, "Status", item, "status", { textarea: true, rows: 2 });
      if (!Array.isArray(item.blocksLayers)) item.blocksLayers = [];
      fStringList(card, "Blocks layers", item.blocksLayers);
    }, function () {
      return { id: "", question: "", owner: "", status: "unresolved", blocksLayers: [] };
    }, "+ Add open question");

    if (s.corsSpike || s.platformNotes) {
      var s4 = section(pane, "Phase 0 findings (read-only)",
        "The CORS spike and platform notes recorded when this map was first scoped — a point-in-time " +
        "verification record, not day-to-day editorial content. Edit the JSON directly if this ever needs to change.");
      if (s.corsSpike && s.corsSpike.conclusion) s4.appendChild(el("p", "adm-hint", s.corsSpike.conclusion));
      if (s.platformNotes) {
        Object.keys(s.platformNotes).forEach(function (k) {
          var note = s.platformNotes[k];
          if (note && note.conclusion) s4.appendChild(el("p", "adm-hint", k + ": " + note.conclusion));
        });
      }
    }

    var s5 = section(pane, "Export");
    var exportBtn = el("button", "adm-btn", "Export sources document");
    exportBtn.type = "button";
    exportBtn.title = "Downloads a Markdown file generated from this document, for review before updating docs/GIS-DATA-SOURCES.md.";
    exportBtn.addEventListener("click", function () {
      var md = generateSourcesMarkdown(s);
      triggerDownload(URL.createObjectURL(new Blob([md], { type: "text/markdown" })), "GIS-DATA-SOURCES.md");
    });
    s5.appendChild(exportBtn);
  }

  function generateSourcesMarkdown(s) {
    var lines = [];
    lines.push("# GIS Data Sources — Iberia Parish / Gulf Futures Challenge");
    lines.push("");
    lines.push("Generated from `data/gis/sources.json` via the Admin Board's Data sources editor. " +
      "Verified " + (s.lastVerified || "—") + ".");
    lines.push("");
    if (s.corsSpike) {
      lines.push("## The CORS spike");
      lines.push("");
      lines.push(s.corsSpike.summary || "");
      lines.push("");
      if (s.corsSpike.conclusion) { lines.push("**Conclusion:** " + s.corsSpike.conclusion); lines.push(""); }
    }
    lines.push("## Candidate layers");
    lines.push("");
    lines.push("| Source id | Group | Endpoint | CORS | Recommended type | Harvested | Notes |");
    lines.push("|---|---|---|---|---|---|---|");
    (s.candidateLayers || []).forEach(function (c) {
      lines.push("| `" + (c.sourceId || "") + "` | " + (c.feedsGroup || "") + " | " + (c.serviceEndpoint || "") +
        " | " + (c.cors || "") + " | " + (c.recommendedSourceType || "") + " | " +
        (c.harvested ? "yes" : "no") + " | " + (c.notes || "").replace(/\n/g, " ").replace(/\|/g, "/") + " |");
    });
    lines.push("");
    if (s.openQuestions && s.openQuestions.length) {
      lines.push("## Open questions");
      lines.push("");
      s.openQuestions.forEach(function (q) {
        lines.push("- **" + (q.id || "") + "** (" + (q.status || "unresolved") + ", owner: " + (q.owner || "—") + "): " + (q.question || ""));
      });
      lines.push("");
    }
    return lines.join("\n") + "\n";
  }

  /* ============================================================
     ORGANIZATIONS / USERS / ACCESS  (Phase 5b — site_admin only)
     ------------------------------------------------------------
     Like the entitlement picker, none of these three screens go through
     the draft/export path — organizations, memberships, and site_role all
     live in Postgres (ACCESS-MODEL.md §2), never /data. Every mutation
     calls a functions/api/admin/* Function using the service role, which
     writes the matching admin_audit row itself (§7) -- never a client-side
     insert, since admin_audit has no client insert policy at all.
     ============================================================ */
  function editOrganizations(pane) {
    var box = section(pane, "Organizations",
      "Every client organization in the system. Disabling one revokes client-level access for its members immediately — membership and entitlement rows are kept, not deleted, so reactivating restores everything.");
    var listZone = el("div", "adm-listitems");
    box.appendChild(listZone);
    var status = el("p", "adm-hint", "");
    box.appendChild(status);

    function draw() {
      listZone.innerHTML = "";
      status.textContent = "Loading…";
      adminFetch("/api/admin/organizations").then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t load organizations: " + (res.data.error || res.status); return; }
        status.textContent = "";
        var orgs = res.data.organizations || [];
        if (!orgs.length) { listZone.appendChild(el("p", "adm-hint", "No organizations yet.")); return; }
        orgs.forEach(function (org) { listZone.appendChild(orgRow(org)); });
      });
    }

    function orgRow(org) {
      var card = el("div", "adm-listitem");
      var bar = el("div", "adm-itembar");
      bar.appendChild(el("span", "adm-itemtitle",
        org.name + " (" + org.slug + ")" + (org.status !== "active" ? " — disabled" : "")));
      var toggle = el("button", "adm-btn adm-btn-ghost adm-btn-small", org.status === "active" ? "Disable" : "Reactivate");
      toggle.type = "button";
      toggle.addEventListener("click", function () {
        var next = org.status === "active" ? "disabled" : "active";
        if (next === "disabled" && !confirm(
          "Disable “" + org.name + "”? Its members immediately lose client-level access. " +
          "Membership and entitlement rows are kept, not deleted — reactivate any time to restore them."
        )) return;
        status.textContent = "Saving…";
        adminFetch("/api/admin/organizations/" + org.id, { method: "PATCH", body: { status: next } }).then(function (res) {
          if (!res.ok) { status.textContent = "Couldn’t update: " + (res.data.error || res.status); return; }
          draw();
        });
      });
      bar.appendChild(toggle);
      card.appendChild(bar);

      var editRow = el("div", "adm-entitlement-search");
      var nameIn = el("input", "adm-input"); nameIn.type = "text"; nameIn.value = org.name;
      var slugIn = el("input", "adm-input"); slugIn.type = "text"; slugIn.value = org.slug;
      var saveBtn = el("button", "adm-btn adm-btn-small", "Save");
      saveBtn.type = "button";
      saveBtn.addEventListener("click", function () {
        var name = nameIn.value.trim(), slug = slugIn.value.trim();
        if (name === org.name && slug === org.slug) return;
        status.textContent = "Saving…";
        adminFetch("/api/admin/organizations/" + org.id, { method: "PATCH", body: { name: name, slug: slug } }).then(function (res) {
          if (!res.ok) { status.textContent = "Couldn’t update: " + (res.data.error || res.status); return; }
          draw();
        });
      });
      editRow.appendChild(nameIn); editRow.appendChild(slugIn); editRow.appendChild(saveBtn);
      card.appendChild(editRow);
      return card;
    }

    var addBox = section(pane, "New organization");
    var newName = el("input", "adm-input"); newName.type = "text"; newName.placeholder = "Organization name";
    var newSlug = el("input", "adm-input"); newSlug.type = "text"; newSlug.placeholder = "url-slug";
    var addBtn = el("button", "adm-btn adm-btn-gold adm-btn-small", "+ Create organization");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () {
      var name = newName.value.trim(), slug = newSlug.value.trim();
      if (!name || !slug) { status.textContent = "Name and slug are both required."; return; }
      status.textContent = "Creating…";
      adminFetch("/api/admin/organizations", { method: "POST", body: { name: name, slug: slug } }).then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t create: " + (res.data.error || res.status); return; }
        newName.value = ""; newSlug.value = "";
        draw();
      });
    });
    var addRow = el("div", "adm-entitlement-search");
    addRow.appendChild(newName); addRow.appendChild(newSlug); addRow.appendChild(addBtn);
    addBox.appendChild(addRow);

    draw();
  }

  function editUsers(pane) {
    var box = section(pane, "Users",
      "Every account in the system. Promote or demote site_admin, disable or reactivate a login, and manage which organizations someone belongs to and with what role.");
    var listZone = el("div", "adm-listitems");
    box.appendChild(listZone);
    var status = el("p", "adm-hint", "");
    box.appendChild(status);

    function draw() {
      listZone.innerHTML = "";
      status.textContent = "Loading…";
      adminFetch("/api/admin/users").then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t load users: " + (res.data.error || res.status); return; }
        status.textContent = "";
        var users = res.data.users || [];
        if (!users.length) { listZone.appendChild(el("p", "adm-hint", "No users yet.")); return; }
        users.forEach(function (u) { listZone.appendChild(userRow(u)); });
      });
    }

    function userRow(u) {
      var card = el("div", "adm-listitem");
      var bar = el("div", "adm-itembar");
      var title = u.email + (u.siteRole === "site_admin" ? " — site_admin" : "") + (u.disabled ? " — disabled" : "");
      bar.appendChild(el("span", "adm-itemtitle", title));
      var btns = el("div", "adm-itembtns");

      var roleBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small",
        u.siteRole === "site_admin" ? "Demote to user" : "Promote to site_admin");
      roleBtn.type = "button";
      roleBtn.addEventListener("click", function () {
        var next = u.siteRole === "site_admin" ? "user" : "site_admin";
        if (!confirm((next === "site_admin" ? "Grant" : "Remove") + " site_admin for " + u.email + "?")) return;
        status.textContent = "Saving…";
        adminFetch("/api/admin/users/" + u.id, { method: "PATCH", body: { siteRole: next } }).then(function (res) {
          if (!res.ok) { status.textContent = "Couldn’t update: " + (res.data.error || res.status); return; }
          draw();
        });
      });
      btns.appendChild(roleBtn);

      var disableBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small", u.disabled ? "Reactivate" : "Disable");
      disableBtn.type = "button";
      disableBtn.addEventListener("click", function () {
        var next = !u.disabled;
        if (next && !confirm("Disable the login for " + u.email + "? They won’t be able to sign in until reactivated.")) return;
        status.textContent = "Saving…";
        adminFetch("/api/admin/users/" + u.id, { method: "PATCH", body: { disabled: next } }).then(function (res) {
          if (!res.ok) { status.textContent = "Couldn’t update: " + (res.data.error || res.status); return; }
          draw();
        });
      });
      btns.appendChild(disableBtn);
      bar.appendChild(btns);
      card.appendChild(bar);

      (u.memberships || []).forEach(function (m) {
        var row = el("div", "adm-entitlement-search");
        row.appendChild(el("span", "adm-hint",
          m.orgName + " — " + m.orgRole + (m.status !== "active" ? " (" + m.status + ")" : "")));
        var toggleRole = el("button", "adm-btn adm-btn-ghost adm-btn-small",
          m.orgRole === "org_admin" ? "Make member" : "Make org_admin");
        toggleRole.type = "button";
        toggleRole.addEventListener("click", function () {
          var nextRole = m.orgRole === "org_admin" ? "member" : "org_admin";
          status.textContent = "Saving…";
          adminFetch("/api/org/members", { method: "PATCH", body: { orgId: m.orgId, userId: u.id, orgRole: nextRole } })
            .then(function (res) {
              if (!res.ok) { status.textContent = "Couldn’t update: " + (res.data.error || res.status); return; }
              draw();
            });
        });
        var removeBtn = el("button", "adm-btn adm-btn-ghost adm-btn-small", "Remove");
        removeBtn.type = "button";
        removeBtn.addEventListener("click", function () {
          if (!confirm("Remove " + u.email + " from " + m.orgName + "?")) return;
          status.textContent = "Saving…";
          adminFetch("/api/org/members?org_id=" + m.orgId + "&user_id=" + u.id, { method: "DELETE" }).then(function (res) {
            if (!res.ok) { status.textContent = "Couldn’t remove: " + (res.data.error || res.status); return; }
            draw();
          });
        });
        row.appendChild(toggleRole); row.appendChild(removeBtn);
        card.appendChild(row);
      });

      var addRow = el("div", "adm-entitlement-search");
      var orgQ = el("input", "adm-input"); orgQ.type = "text"; orgQ.placeholder = "Add to organization — search by name…";
      var roleSel = el("select", "adm-select adm-entitlement-type");
      [["member", "Member"], ["org_admin", "Org admin"]].forEach(function (o) {
        var opt = el("option", null, o[1]); opt.value = o[0]; roleSel.appendChild(opt);
      });
      addRow.appendChild(orgQ); addRow.appendChild(roleSel);
      card.appendChild(addRow);
      var orgResults = el("div", "adm-entitlement-results");
      card.appendChild(orgResults);
      var searchTimer = null;
      orgQ.addEventListener("input", function () {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          var term = orgQ.value.trim();
          orgResults.innerHTML = "";
          if (term.length < 2) return;
          adminFetch("/api/admin/search?type=org&q=" + encodeURIComponent(term)).then(function (res) {
            orgResults.innerHTML = "";
            if (!res.ok) return;
            (res.data.results || []).forEach(function (r) {
              var btn = el("button", "adm-btn adm-btn-small", "+ " + r.label);
              btn.type = "button";
              btn.addEventListener("click", function () {
                status.textContent = "Adding…";
                adminFetch("/api/org/members", { method: "POST", body: { orgId: r.id, email: u.email, orgRole: roleSel.value } })
                  .then(function (res2) {
                    if (!res2.ok) { status.textContent = "Couldn’t add: " + (res2.data.error || res2.status); return; }
                    orgQ.value = ""; orgResults.innerHTML = "";
                    draw();
                  });
              });
              orgResults.appendChild(btn);
            });
          });
        }, 300);
      });

      return card;
    }

    var addBox = section(pane, "New user",
      "Dev-only: you set the password directly here — there’s no working invite-email delivery until custom SMTP is configured (see ACCOUNT-SETUP-AND-HANDOFF.md §7).");
    var newEmail = el("input", "adm-input"); newEmail.type = "email"; newEmail.placeholder = "email@example.com";
    var newPassword = el("input", "adm-input"); newPassword.type = "text"; newPassword.placeholder = "Temporary password (8+ characters)";
    var createBtn = el("button", "adm-btn adm-btn-gold adm-btn-small", "+ Create user");
    createBtn.type = "button";
    createBtn.addEventListener("click", function () {
      var email = newEmail.value.trim(), password = newPassword.value;
      if (!email || password.length < 8) { status.textContent = "A valid email and an 8+ character password are both required."; return; }
      status.textContent = "Creating…";
      adminFetch("/api/admin/users", { method: "POST", body: { email: email, password: password } }).then(function (res) {
        if (!res.ok) { status.textContent = "Couldn’t create: " + (res.data.error || res.status); return; }
        newEmail.value = ""; newPassword.value = "";
        draw();
      });
    });
    var createRow = el("div", "adm-entitlement-search");
    createRow.appendChild(newEmail); createRow.appendChild(newPassword); createRow.appendChild(createBtn);
    addBox.appendChild(createRow);

    draw();
  }

  /* Walks the same documents strip-public-data.mjs and the Phase 4 resolver
     already treat as the source of every resource_key in the system --
     purely a client-side read of window.DTS_CONTENT.docs (already loaded),
     no new Function needed for the listing itself. */
  function enumerateResourceKeys() {
    var items = [];
    projectFiles().forEach(function (pf) {
      var p = docs[pf];
      if (Array.isArray(p.experiences) && p.experiences.length) {
        p.experiences.forEach(function (ex) {
          items.push({
            resourceKey: "project." + p.id + ":" + ex.id,
            label: p.title + " — " + (ex.label || ex.id),
            level: resolveAccessLevel(ex.access, p.access)
          });
        });
      } else if (p.media && p.media._type) {
        items.push({
          resourceKey: "project." + p.id + ":" + p.media._type,
          label: p.title + " — " + p.media._type,
          level: resolveAccessLevel(p.media.access, p.access)
        });
      }
      (p.links || []).forEach(function (link, i) {
        items.push({
          resourceKey: "project." + p.id + ":link-" + (i + 1),
          label: p.title + " — " + (link.label || ("link " + (i + 1))),
          level: resolveAccessLevel(link.access, p.access)
        });
      });
    });
    gisMapFiles().forEach(function (mf) {
      var m = docs[mf];
      items.push({ resourceKey: "gismap." + m.id, label: "GIS map — " + m.title, level: m.access || "registered" });
    });
    return items;
  }

  function editAccessIndex(pane) {
    var box = section(pane, "Access",
      "A read-only index of every gated resource in the system, resolved to its actual level — a debugging view over what's otherwise scattered across every project and GIS map editor. To change a level, edit it on the project/GIS map itself; a Restricted row's picker here writes live, same as everywhere else.");
    var items = enumerateResourceKeys();
    if (!items.length) { box.appendChild(el("p", "adm-hint", "Nothing gated yet.")); return; }
    items.forEach(function (item) {
      var card = el("div", "adm-listitem");
      var bar = el("div", "adm-itembar");
      bar.appendChild(el("span", "adm-itemtitle", item.label));
      bar.appendChild(el("span", "adm-hint", item.level));
      card.appendChild(bar);
      card.appendChild(el("p", "adm-hint", item.resourceKey));
      if (item.level === "restricted") {
        entitlementPicker(card, function () { return item.resourceKey; });
      }
      box.appendChild(card);
    });
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

  /* Every gisMap layer whose sourceType is "geojson" pointing at a harvested
     snapshot under data/gis/layers/ (06-SPEC §8). Those files are never in
     DTS_CONTENT.docs/localStorage (04-SPEC §1's size warning), so export is
     the only path that ships them at all -- fetched fresh here.

     Phase 6: these files are no longer static assets -- they live only in
     R2's private data/source/ prefix (ACCESS-MODEL.md §5's local-layer-file
     note), reachable only through the authenticated
     functions/api/resource/gismap/[mapId]/layer/[layerId].js proxy Phase 4
     already built. A plain fetch(l.url) against the old relative path would
     404 the moment a map's layers aren't in data/current/ -- returns
     {mapId, layerId, url} tuples (not bare urls) so fetchHarvestedLayers()
     below can hit that proxy with the caller's own session token instead. */
  function collectHarvestedLayerUrls() {
    var seen = {};
    var out = [];
    Object.keys(docs).forEach(function (f) {
      var d = docs[f];
      if (!d || d._type !== "gisMap") return;
      (d.layers || []).forEach(function (l) {
        if (l.sourceType === "geojson" && typeof l.url === "string" && l.url.indexOf("data/gis/layers/") === 0 && !seen[l.url]) {
          seen[l.url] = true;
          out.push({ mapId: d.id, layerId: l.id, url: l.url });
        }
      });
    });
    return out;
  }

  /* Same Bearer-token pattern as adminFetch() (admin.js:477), but returns
     raw text rather than parsed JSON -- the geojson proxy streams the file
     body directly, not a {ok,status,data} envelope. */
  function fetchHarvestedLayers(layers) {
    var session = window.DTS_ACCESS && window.DTS_ACCESS.session;
    var headers = {};
    if (session && session.accessToken) headers.Authorization = "Bearer " + session.accessToken;
    return Promise.all(layers.map(function (l) {
      var proxyPath = "/api/resource/gismap/" + encodeURIComponent(l.mapId) + "/layer/" + encodeURIComponent(l.layerId);
      return fetch(proxyPath, { headers: headers }).then(function (res) {
        if (!res.ok) throw new Error(l.url + " (" + proxyPath + ") -- HTTP " + res.status);
        return res.text();
      }).then(function (text) {
        return { url: l.url, text: text };
      }).catch(function (err) {
        throw new Error(l.url + " -- " + (err && err.message ? err.message : "fetch failed"));
      });
    }));
  }

  function exportData() {
    // Bump the version stamp so every published doc gets a fresh
    // ?v=... URL in content-loader.js -- this is what lets those
    // files be cached hard by the browser without ever going stale.
    content.manifest.contentVersion = new Date().toISOString().replace(/[:.]/g, "-");
    var files = {};
    files["manifest.json"] = JSON.stringify(content.manifest, null, 2) + "\n";
    Object.keys(docs).forEach(function (f) {
      files[f] = JSON.stringify(docs[f], null, 2) + "\n";
    });

    var harvestedUrls = collectHarvestedLayerUrls();
    fetchHarvestedLayers(harvestedUrls).then(function (layerFiles) {
      // Try to zip (JSZip from cdnjs); fall back to individual downloads.
      return loadJSZip().then(function (JSZip) {
        var zip = new JSZip();
        var root = zip.folder("data");
        Object.keys(files).forEach(function (f) { root.file(f, files[f]); });
        layerFiles.forEach(function (lf) { root.file(lf.url.replace(/^data\//, ""), lf.text); });
        return zip.generateAsync({ type: "blob" }).then(function (blob) {
          triggerDownload(URL.createObjectURL(blob), "data.zip");
        });
      }).catch(function () {
        Object.keys(files).forEach(function (f) {
          var blob = new Blob([files[f]], { type: "application/json" });
          triggerDownload(URL.createObjectURL(blob), f.replace(/\//g, "__"));
        });
        layerFiles.forEach(function (lf) {
          var blob = new Blob([lf.text], { type: "application/geo+json" });
          triggerDownload(URL.createObjectURL(blob), lf.url.replace(/\//g, "__"));
        });
        alert("Zip library unavailable — files downloaded individually" +
          (layerFiles.length ? (", including " + layerFiles.length + " harvested GIS layer file(s)") : "") +
          ". Filenames use \u201c__\u201d for folders (projects__campus.json → data/projects/campus.json).");
      });
    }).catch(function (err) {
      // Fail loudly (06-SPEC §8): never ship a data/ folder silently missing a layer snapshot.
      alert("Export stopped — couldn't fetch " + harvestedUrls.length + " harvested GIS layer file(s) this export needs:\n\n" +
        err.message + "\n\nNo data.zip was produced. Fix the missing file(s) (or the map referencing them) and try again.");
    });
  }

  /* Phase 6 -- instant publish via functions/api/publish.js, replacing the
     "export zip, replace data/ by hand, redeploy" loop with one click. Sends
     the exact same manifest/docs/harvested-layers content exportData() zips
     up, as a POST instead of a download, authenticated the same way every
     other Admin Board Function call already is (adminFetch()'s Bearer
     token). The zip export itself is UNTOUCHED and stays available as the
     fallback (WORKFLOW.md golden rule 7 -- "keep the escape hatch"). */
  function publishToSite() {
    if (!confirm("Publish this content live? This updates the site for every visitor within seconds.")) return;
    content.manifest.contentVersion = new Date().toISOString().replace(/[:.]/g, "-");
    var status = $("#admStatus");
    if (status) status.textContent = "Publishing…";

    var harvestedLayers = collectHarvestedLayerUrls();
    fetchHarvestedLayers(harvestedLayers).then(function (layerFiles) {
      return adminFetch("/api/publish", {
        method: "POST",
        body: { manifest: content.manifest, docs: docs, layers: layerFiles }
      });
    }).then(function (result) {
      if (!result.ok) {
        var msg = (result.data && result.data.error) || ("HTTP " + result.status);
        if (status) status.textContent = "Publish failed.";
        alert("Publish failed: " + msg);
        return;
      }
      if (status) status.textContent = "Published " + result.data.publishedCount + " file(s).";
      alert("Published live — " + result.data.publishedCount + " file(s) updated (snapshot " + result.data.snapshotId + ").");
    }).catch(function (err) {
      if (status) status.textContent = "Publish failed.";
      alert("Publish stopped — couldn't fetch " + harvestedLayers.length + " harvested GIS layer file(s) this publish needs:\n\n" +
        err.message + "\n\nNothing was published. Fix the missing file(s) (or the map referencing them) and try again.");
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

  function openBoard() {
    if (!board) buildBoard();
    board.classList.add("is-open");
    document.body.classList.add("adm-lock");
    select(activeKey);
  }
  function closeBoard(signOut) {
    if (dirty && !confirm("You have unsaved changes. Close anyway? (They stay in the editor until you reload.)")) return;
    board.classList.remove("is-open");
    document.body.classList.remove("adm-lock");
    if (signOut) {
      // The Supabase session IS the session now -- same full-reload sign-out
      // js/app.js's own signOut() uses, and for the same reason: it's the
      // only reliable way to guarantee every trace of the session is gone
      // client-side, not just this board's own state.
      window.DTS_SUPABASE.auth.signOut().finally(function () { window.location.reload(); });
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
    var bPublish = el("button", "adm-btn adm-btn-gold", "Publish to site");
    bPublish.type = "button";
    bPublish.title = "Publishes your edits live immediately -- no redeploy, no GitHub.";
    bPublish.addEventListener("click", publishToSite);
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
    [bSave, bPublish, bExport, bDiscard, bMin, bClose].forEach(function (b) { actions.appendChild(b); });
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
    navBtn("FAQ answers", "faq");
    navBtn("Fun facts", "funfacts");
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

    navEl.appendChild(el("p", "adm-navhead", "GIS MAPS"));
    gisMapFiles().forEach(function (mf) {
      navBtn(docs[mf].title, "gismap:" + mf, true);
      gisTourFiles(docs[mf].id).forEach(function (tf) {
        navBtn(docs[tf].title, "gistour:" + tf, true);
      });
    });
    var addMap = el("button", "adm-btn adm-btn-small adm-addproject", "+ New map");
    addMap.type = "button";
    addMap.addEventListener("click", addGisMap);
    navEl.appendChild(addMap);
    var sourcesFile = gisSourcesFile();
    if (sourcesFile) navBtn("Data sources", "gissources:" + sourcesFile);

    // No extra site_admin check needed here -- js/admin.js's whole board
    // only ever opens for a site_admin session in the first place (see
    // Phase 5's dts:signed-in routing), so anyone who can see this nav at
    // all already has the role every screen under it requires.
    navEl.appendChild(el("p", "adm-navhead", "ADMIN"));
    navBtn("Organizations", "organizations");
    navBtn("Users", "users");
    navBtn("Access", "access");

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
    preDirtyHook = null;   // never let a hook from the previous pane fire against this one
    setPaneWide(false);    // only gismap:/gistour: panes widen it back
    if (currentGisPreview) { currentGisPreview.destroy(); currentGisPreview = null; }
    highlightNav();
    paneEl.innerHTML = "";
    if (key === "home") editHome(paneEl);
    else if (key === "contact") editContact(paneEl);
    else if (key === "faq") editFaq(paneEl);
    else if (key === "funfacts") editFunFacts(paneEl);
    else if (key.indexOf("sector:") === 0) editSector(paneEl, key.slice(7));
    else if (key.indexOf("project:") === 0) {
      var file = key.slice(8);
      if (docs[file]) editProject(paneEl, file);
      else select("home");
    }
    else if (key.indexOf("gismap:") === 0) {
      var mapFile = key.slice(7);
      if (docs[mapFile]) editGisMap(paneEl, mapFile);
      else select("home");
    }
    else if (key.indexOf("gistour:") === 0) {
      var tourFile = key.slice(8);
      if (docs[tourFile]) editGisTour(paneEl, tourFile);
      else select("home");
    }
    else if (key.indexOf("gisfeaturetour:") === 0) {
      var featureTourFile = key.slice(15);
      if (docs[featureTourFile]) editGisFeatureTour(paneEl, featureTourFile);
      else select("home");
    }
    else if (key.indexOf("gissources:") === 0) {
      var sourcesFile = key.slice(11);
      if (docs[sourcesFile]) editGisSources(paneEl, sourcesFile);
      else select("home");
    }
    else if (key === "organizations") editOrganizations(paneEl);
    else if (key === "users") editUsers(paneEl);
    else if (key === "access") editAccessIndex(paneEl);
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

  // Covers a site_admin session that already existed the moment this
  // script finished loading -- most importantly the Save & Preview reload
  // (content-loader.js loads admin.js eagerly whenever a draft exists in
  // localStorage), where js/app.js's restoreSession() can resolve and
  // dispatch "dts:signed-in" before this network-loaded script has even
  // registered the listener above. Reads window.DTS_ACCESS synchronously
  // (a live reference to app.js's own access object, not a snapshot) so
  // there's no race to lose: by the time this line runs, app.js and every
  // script before this one in the load order have already finished.
  if (window.DTS_ACCESS && window.DTS_ACCESS.session &&
      window.DTS_ACCESS.session.siteRole === "site_admin") {
    showChip();
  }
})();
