/* ============================================================
   Intro loader
   • Centered kicker + headline typed with a terminal "_" caret
   • Random fun fact typed underneath
   • Big % counter bottom-right — driven by REAL load progress
   • Random sector accent color per page load
   • FLIP the headline into the hero; the kicker fades out and
     re-types itself in place once the headline lands
   ============================================================ */
(function () {
  "use strict";

  /* Reduced motion: no loader at all. The cloak was never applied
     (see the inline script in index.html), so nothing to un-cloak. */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var TYPE_MS   = 40;    // ms per character (title)
  var FACT_MS   = 22;    // ms per character (fun fact)
  var MIN_MS    = 3000;  // never finish faster than this (fact stays readable)
  var MAX_MS    = 9000;  // hard ceiling — never trap the visitor
  var FACTS_URL = "data/faq/fun-facts.json";

  /* Fallback accents if the sector config isn't reachable. */
  var FALLBACK_ACCENTS = ["#FFB22C", "#2E8BFF", "#34598F", "#D27049"];

  /* Guards against the retry loop and the fetch callback both
     kicking off a second run. */
  var started = false;

  function uncloak() {
    document.documentElement.classList.remove("intro-cloak");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("intro-pending");
    /* Wait for content-loader.js to inject /data content, so the loader
       always types the same headline the hero will end up showing.
       Caps at 3s so a failed fetch can't hang the intro. */
    var waited = 0;
    (function waitForContent() {
      if (window.DTS_CONTENT_READY || waited >= 3000) return start();
      waited += 80;
      setTimeout(waitForContent, 80);
    })();
  });

  /* ---------- helpers ---------- */

  /* Text from an element, treating ONLY real <br> as a line break
     (innerText would also capture accidental soft wraps). */
  function headlineText(el) {
    var out = "";
    [].forEach.call(el.childNodes, function (n) {
      if (n.nodeName === "BR") out += "\n";
      else out += n.textContent;
    });
    return out;
  }

  /* Cancellable typewriter. Each run claims a token on the element;
     an older loop aborts as soon as a newer run takes over, or if its
     caret has been detached. First tick is always async so an empty
     string can't fire `done` re-entrantly. */
  function typeInto(el, text, speed, done) {
    if (el._typeTimer) clearTimeout(el._typeTimer);

    el.textContent = "";
    var caret = document.createElement("span");
    caret.className = "intro-caret";
    caret.textContent = "_";
    el.appendChild(caret);

    var token = (el._typeToken = (el._typeToken || 0) + 1);
    var i = 0;
    text = text || "";

    function tick() {
      if (el._typeToken !== token || caret.parentNode !== el) {
        console.warn("[intro] typing aborted — element was overwritten:",
                     el.id || el.className);
        return;
      }

      if (i < text.length) {
        var ch = text[i++];
        if (ch === "\n") el.insertBefore(document.createElement("br"), caret);
        else el.insertBefore(document.createTextNode(ch), caret);
        el._typeTimer = setTimeout(tick, speed);
      } else {
        el._typeTimer = null;
        done && done(caret);
      }
    }

    el._typeTimer = setTimeout(tick, speed);
  }

  function pickAccent() {
    var pool = [];
    try {
      var cats = (window.DTS_CONFIG || window.CONFIG || {}).categories || [];
      cats.forEach(function (c) { if (c.accent) pool.push(c.accent); });
    } catch (e) { /* ignore */ }
    if (!pool.length) pool = FALLBACK_ACCENTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function loadFacts(cb) {
    /* Prefer the content pipeline — this is the same data source the
       Admin Board edits, so a saved draft or a published edit shows up
       here immediately. We wait for DTS_CONTENT_READY before calling
       loadFacts(), so this is populated in all but the slowest loads. */
    try {
      var doc = window.DTS_CONTENT && window.DTS_CONTENT.docs &&
                window.DTS_CONTENT.docs["faq/fun-facts.json"];
      if (doc && doc.facts && doc.facts.length) return cb(doc.facts);
    } catch (e) { /* fall through */ }
    try {
      var cfg = window.DTS_CONFIG || window.CONFIG;
      if (cfg && cfg.funFacts && cfg.funFacts.length) return cb(cfg.funFacts);
    } catch (e) { /* fall through */ }

    /* Last resort — a direct fetch, for the rare case content-loader.js
       hasn't populated the globals yet. */
    fetch(FACTS_URL)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + " — " + FACTS_URL);
        return r.json();
      })
      .then(function (d) { cb((d && d.facts) || []); })
      .catch(function (e) {
        console.warn("[intro] fun facts failed to load:", e.message);
        cb([]);
      });
  }

  function heroText() {
    var h = document.querySelector(".home-copy");
    if (!h) return null;
    var headEl = h.querySelector(".home-headline");
    return {
      kicker: (h.querySelector(".copy-kicker") || {}).textContent || "",
      headline: headEl ? headlineText(headEl) : ""
    };
  }

  /* ---------- main ---------- */
  function start() {
    if (started) return;

    var hero = heroText();
    if (!hero || !hero.headline) return setTimeout(start, 100);

    started = true;              // claim before the async fetch
    loadFacts(function (facts) {
      run(hero, facts);
    });
  }

  function run(hero, facts) {
    if (document.querySelector(".intro-loader")) return uncloak();

    var accent = pickAccent();
    var fact = facts.length
      ? facts[Math.floor(Math.random() * facts.length)]
      : "";

    var ov = document.createElement("div");
    ov.className = "intro-loader";
    ov.style.setProperty("--intro-accent", accent);
    ov.innerHTML =
      '<div class="intro-title">' +
        '<span class="intro-kicker" id="inKicker"></span>' +
        '<h1 class="intro-headline" id="inHead"></h1>' +
        '<p class="intro-fact" id="inFact"></p>' +
      '</div>' +
      '<div class="intro-pct" id="inPct">0%</div>';
    document.body.appendChild(ov);

    /* Overlay is on screen — safe to un-cloak the app underneath it. */
    uncloak();

    var kickerEl = ov.querySelector("#inKicker");
    var headEl   = ov.querySelector("#inHead");
    var factEl   = ov.querySelector("#inFact");
    var pctEl    = ov.querySelector("#inPct");

    /* ============================================================
       PERCENTAGE — real load progress
       ------------------------------------------------------------
       Three weighted milestones complete as the site actually loads.
       The displayed value eases toward the highest reached milestone
       so it never jumps or visibly stalls. A floor keeps the fun fact
       readable; a ceiling guarantees the loader always ends even if a
       third-party embed never finishes.
       ============================================================ */
    var milestones = { content: 0, windowLoad: 0, typing: 0 };
    var WEIGHTS    = { content: 0.30, windowLoad: 0.45, typing: 0.25 };

    if (window.DTS_CONTENT_READY) {
      milestones.content = 1;
    } else {
      (function pollContent() {
        if (window.DTS_CONTENT_READY) milestones.content = 1;
        else setTimeout(pollContent, 100);
      })();
    }

    if (document.readyState === "complete") {
      milestones.windowLoad = 1;
    } else {
      window.addEventListener("load", function () { milestones.windowLoad = 1; });
    }

    var t0 = performance.now(), pctDone = false, shown = 0;

    (function pct(now) {
      var elapsed = now - t0;

      /* Real progress from milestones. */
      var target = 0;
      for (var k in milestones) target += milestones[k] * WEIGHTS[k];
      target *= 100;

      /* Floor: never finish before MIN_MS. */
      var floorCap = (elapsed / MIN_MS) * 100;
      target = Math.min(target, floorCap);

      /* Ceiling: past MAX_MS, drive to 100 regardless of what's pending. */
      if (elapsed > MAX_MS) target = 100;

      /* Ease toward the target — no jumps, no dead stalls. */
      shown += (target - shown) * 0.08;
      if (target >= 100 && shown > 99.4) shown = 100;

      pctEl.textContent = Math.floor(shown) + "%";

      if (shown < 100) requestAnimationFrame(pct);
      else { pctDone = true; maybeFinish(); }
    })(t0);

    /* --- typing sequence --- */
    var typeDone = false;
    console.log("[intro] kicker:", JSON.stringify(hero.kicker),
                "| headline:", JSON.stringify(hero.headline),
                "| fact:", JSON.stringify(fact),
                "| facts loaded:", facts.length);

    typeInto(kickerEl, hero.kicker, TYPE_MS, function (caret) {
      console.log("[intro] kicker done");
      caret.remove();
      typeInto(headEl, hero.headline, TYPE_MS, function (hcaret) {
        console.log("[intro] headline done");
        hcaret.remove();
        typeInto(factEl, fact, FACT_MS, function () {
          console.log("[intro] fact done");
          milestones.typing = 1;
          typeDone = true;          // fact keeps its blinking "_"
          maybeFinish();
        });
      });
    });

    /* Failsafe: never let the loader hang if the typing chain breaks. */
    setTimeout(function () {
      if (!typeDone) {
        console.warn("[intro] typing chain stalled — forcing handoff.");
        milestones.typing = 1;
        typeDone = true;
        maybeFinish();
      }
    }, MAX_MS + 8000);

    /* --- handoff --- */
    var finished = false;
    function maybeFinish() {
      if (finished || !(pctDone && typeDone)) return;
      finished = true;

      pctEl.classList.add("is-out");
      factEl.classList.add("is-out");
      kickerEl.classList.add("is-out");   // kicker doesn't travel with the block

      var titleBlk = ov.querySelector(".intro-title");
      /* Measure from the kicker even though it's fading — it's the
         alignment anchor, and hiding it doesn't change its geometry. */
      var tKick = document.querySelector(".home-copy .copy-kicker").getBoundingClientRect();
      var fKick = kickerEl.getBoundingClientRect();

      ov.classList.add("is-leaving");
      titleBlk.classList.add("is-flip");
      requestAnimationFrame(function () {
        titleBlk.style.transform = "translate(-50%,-50%) translate(" +
          (tKick.left - fKick.left) + "px," + (tKick.top - fKick.top) + "px)";
      });

      setTimeout(function () {
        uncloak();   // belt and braces

        var realKicker  = document.querySelector(".home-copy .copy-kicker");
        var kickerFinal = realKicker.textContent;
        realKicker.textContent = "";

        document.querySelector(".home-copy").classList.add("intro-released");
        ov.classList.add("is-done");
        setTimeout(function () { ov.remove(); }, 700);
        document.body.classList.remove("intro-pending");

        /* Kicker types itself into place in the final hero position. */
        typeInto(realKicker, kickerFinal, TYPE_MS, function (caret) {
          caret.remove();
        });
      }, 950);
    }
  }
})();
