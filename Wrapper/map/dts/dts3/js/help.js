/* In-app documentation -- shared rendering engine (js/help-content.js holds
   the actual topic data). One engine, three mount points: the Admin Board's
   "Documentation" screen (js/admin.js), the client portal's "Help" tab
   (js/app.js), and this file's own floating help icon for guests/no-org
   signed-in visitors.

   Loaded statically, appended after every other script in index.html's list
   (never reordered). js/app.js is injected dynamically by content-loader.js
   *after* this file has already run, so anything here that needs
   window.DTS_ACCESS / window.DTS_TRACK reads them lazily, at interaction
   time, never at parse time -- a missing DTS_ACCESS is treated as "guest",
   which is the correct fallback anyway. */
(function () {
  "use strict";

  var openers = {};             // audience -> function() that navigates TO that surface's Help screen
  var pendingHashTopic = parseHash();

  function parseHash() {
    var h = window.location.hash || "";
    var m = /^#help=([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)$/.exec(h);
    return m ? { audience: m[1], topicId: m[2] } : null;
  }

  function setHash(audience, topicId) {
    var value = "help=" + audience + ":" + topicId;
    try { history.replaceState(null, "", "#" + value); }
    catch (_) { window.location.hash = value; }
  }

  function consumeHashTopic(audience) {
    if (pendingHashTopic && pendingHashTopic.audience === audience) {
      var id = pendingHashTopic.topicId;
      pendingHashTopic = null;
      return id;
    }
    return null;
  }

  function requestTopic(audience, topicId) {
    setHash(audience, topicId);
    pendingHashTopic = { audience: audience, topicId: topicId };
  }

  function registerOpener(audience, fn) { openers[audience] = fn; }

  function track(type, metadata) {
    if (window.DTS_TRACK) { try { window.DTS_TRACK(type, { metadata: metadata }); } catch (_) {} }
  }

  /* ============================================================
     ENGINE -- TOC + search + print, mounted into any container.
     ============================================================ */
  function mount(container, topics, opts) {
    if (!container) return;
    opts = opts || {};
    var audience = opts.audience || "guest";
    container.innerHTML = "";
    container.classList.add("dts-help");

    var toolbar = document.createElement("div");
    toolbar.className = "dts-help-toolbar";
    var search = document.createElement("input");
    search.type = "search";
    search.className = "dts-help-search";
    search.placeholder = "Search this guide…";
    search.setAttribute("aria-label", "Search this guide");
    var printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.className = "dts-help-print";
    printBtn.textContent = "Print / Save as PDF";
    printBtn.addEventListener("click", function () { window.print(); });
    toolbar.appendChild(search);
    toolbar.appendChild(printBtn);

    var body = document.createElement("div");
    body.className = "dts-help-body";
    var toc = document.createElement("nav");
    toc.className = "dts-help-toc";
    toc.setAttribute("aria-label", "Guide sections");
    var panesWrap = document.createElement("div");
    panesWrap.className = "dts-help-panes";

    var tocLinks = {};
    var panes = {};
    var activeId = null;

    function openTopic(id) {
      if (!panes[id]) return;
      if (activeId && panes[activeId]) {
        panes[activeId].hidden = true;
        tocLinks[activeId].classList.remove("is-active");
      }
      panes[id].hidden = false;
      tocLinks[id].classList.add("is-active");
      activeId = id;
      setHash(audience, id);
      panes[id].scrollIntoView({ block: "start", behavior: "smooth" });
      track("help_topic_view", { topicId: id, audience: audience });
    }

    (topics || []).forEach(function (topic) {
      var paneId = "dts-help-" + audience + "-" + topic.id;
      // A real anchor, not a plain button: in-app clicks are intercepted to
      // animate/track via openTopic(), but the real href means "Print /
      // Save as PDF" produces a genuinely clickable, linked TOC in the PDF
      // itself (print.css keeps every pane visible and un-hides this list).
      var link = document.createElement("a");
      link.href = "#" + paneId;
      link.className = "dts-help-toclink";
      link.textContent = topic.title.replace(/&amp;/g, "&");
      link.dataset.topicId = topic.id;
      link.addEventListener("click", function (e) { e.preventDefault(); openTopic(topic.id); });
      toc.appendChild(link);
      tocLinks[topic.id] = link;

      var pane = document.createElement("section");
      pane.className = "dts-help-pane";
      pane.id = paneId;
      pane.hidden = true;
      var h = document.createElement("h3");
      h.className = "dts-help-panetitle";
      h.innerHTML = topic.title;
      pane.appendChild(h);
      var content = document.createElement("div");
      content.className = "dts-help-panebody";
      content.innerHTML = topic.html;
      pane.appendChild(content);
      panesWrap.appendChild(pane);
      panes[topic.id] = pane;
    });

    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      var matched = 0;
      (topics || []).forEach(function (topic) {
        var hay = (topic.title + " " + (topic.keywords || []).join(" ")).toLowerCase();
        var show = !q || hay.indexOf(q) !== -1;
        tocLinks[topic.id].hidden = !show;
        if (show) matched++;
      });
      clearTimeout(search._debounce);
      if (q) {
        search._debounce = setTimeout(function () {
          track("help_search", { query: q.slice(0, 200), matched: matched });
        }, 500);
      }
    });

    body.appendChild(toc);
    body.appendChild(panesWrap);
    container.appendChild(toolbar);
    container.appendChild(body);

    var deepId = consumeHashTopic(audience);
    if (deepId && panes[deepId]) openTopic(deepId);
    else if (topics && topics.length) openTopic(topics[0].id);
  }

  /* ============================================================
     "?" KEYBOARD SHORTCUT -- guarded against typing in any real field.
     Routes to whichever surface is actually open (admin board / portal),
     falling back to the floating guest overlay.
     ============================================================ */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    var tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
    if (document.body.classList.contains("adm-lock") && openers.admin) { e.preventDefault(); openers.admin(); return; }
    if (document.body.classList.contains("portal-open") && openers.portal) { e.preventDefault(); openers.portal(); return; }
    if (openers.guest) { e.preventDefault(); openers.guest(); }
  });

  /* ============================================================
     FLOATING HELP ICON -- guests + any signed-in visitor with no
     organization. Fully self-contained: owns its own open/close, mounts
     window.DTS_HELP.guest the first time it's opened.
     ============================================================ */
  var guestMounted = false;
  var HINT_KEY = "dtsHelpHintSeen";

  function openGuestOverlay() {
    var overlay = document.getElementById("dtsHelpOverlay");
    if (!overlay) return;
    if (!guestMounted) {
      guestMounted = true;
      var content = window.DTS_HELP && window.DTS_HELP.guest ? window.DTS_HELP.guest : [];
      mount(document.getElementById("dtsHelpOverlayBody"), content, { audience: "guest" });
    }
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    dismissHint();
  }
  function closeGuestOverlay() {
    var overlay = document.getElementById("dtsHelpOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
  }
  function dismissHint() {
    var fab = document.getElementById("dtsHelpFab");
    if (fab) fab.classList.remove("has-hint");
    try { localStorage.setItem(HINT_KEY, "1"); } catch (_) {}
  }

  // Real bug, reported live with a screenshot: css/16-help.css positioned
  // the fab off the STATIC --dock-h grid-row token (a single-row height
  // guess, clamp(56px,5vh,74px)), but css/08-responsive.css stacks THREE
  // rows inside #dockbar on phone (dock-tabs, sector-pager, question bar --
  // flex-direction:column) -- so the fab's real clearance need is much
  // taller than --dock-h on mobile, and it landed on top of the sector
  // pager's prev arrow. Measuring the real box instead of re-guessing a
  // bigger static number keeps this correct if #dockbar's content ever
  // changes again (a wrapped sector label, an added row, a font-scale
  // difference) rather than silently drifting stale the same way.
  function syncDockbarHeight() {
    var dockbar = document.getElementById("dockbar");
    if (!dockbar) return;
    document.documentElement.style.setProperty("--dockbar-real-h", dockbar.offsetHeight + "px");
  }

  function initFab() {
    var fab = document.getElementById("dtsHelpFab");
    var overlay = document.getElementById("dtsHelpOverlay");
    var closeBtn = document.getElementById("dtsHelpOverlayClose");
    if (!fab || !overlay) return;

    syncDockbarHeight();
    var dockbar = document.getElementById("dockbar");
    if (dockbar && window.ResizeObserver) {
      new ResizeObserver(syncDockbarHeight).observe(dockbar);
    } else {
      window.addEventListener("resize", syncDockbarHeight);
      window.addEventListener("orientationchange", syncDockbarHeight);
    }

    fab.addEventListener("click", openGuestOverlay);
    if (closeBtn) closeBtn.addEventListener("click", closeGuestOverlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeGuestOverlay();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) closeGuestOverlay();
    });

    var seen = false;
    try { seen = !!localStorage.getItem(HINT_KEY); } catch (_) {}
    if (!seen) fab.classList.add("has-hint");

    registerOpener("guest", openGuestOverlay);

    if (pendingHashTopic && pendingHashTopic.audience === "guest") openGuestOverlay();
  }

  initFab();

  window.DTSHelp = {
    mount: mount,
    requestTopic: requestTopic,
    registerOpener: registerOpener,
    consumeHashTopic: consumeHashTopic
  };
})();
