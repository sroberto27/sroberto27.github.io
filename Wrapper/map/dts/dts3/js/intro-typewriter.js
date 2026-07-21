/* ============================================================
   Intro loader
   • Centered kicker + headline typed with a terminal "_" caret
   • Random fun fact typed underneath
   • Big % counter bottom-right
   • Random sector accent color per page load
   • FLIP into the real hero, then re-type the headline
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var TYPE_MS   = 40;    // ms per character (title)
  var FACT_MS   = 22;    // ms per character (fun fact)
  var LOAD_MS   = 3600;  // 0 → 100%
  var FACTS_URL = "data/faq/fun-facts.json";

  /* Fallback accents if the sector config isn't reachable. */
  var FALLBACK_ACCENTS = ["#FFB22C", "#2E8BFF", "#34598F", "#D27049"];

  /* Guards against the retry loop and the fetch callback both
     kicking off a second run (the cause of the insertBefore error). */
  var started = false;

  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("intro-pending");
    setTimeout(start, 60);
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
     caret has been detached. The first tick is always async so an
     empty string can't fire `done` re-entrantly. */
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
      if (el._typeToken !== token || caret.parentNode !== el) return;

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
    if (document.querySelector(".intro-loader")) return;

    var accent = pickAccent();
    var fact = facts.length
      ? facts[Math.floor(Math.random() * facts.length)]
      : "";

    var ov = document.createElement("div");
    ov.className = "intro-loader";
    ov.style.setProperty("--intro-accent", accent);
    ov.innerHTML =
      '<div class="intro-title">' +
        '<span class="copy-kicker" id="inKicker"></span>' +
        '<h1 class="home-headline" id="inHead"></h1>' +
        '<p class="intro-fact" id="inFact"></p>' +
      '</div>' +
      '<div class="intro-pct" id="inPct">0%</div>';
    document.body.appendChild(ov);

    var kickerEl = ov.querySelector("#inKicker");
    var headEl   = ov.querySelector("#inHead");
    var factEl   = ov.querySelector("#inFact");
    var pctEl    = ov.querySelector("#inPct");

    /* --- percentage --- */
    var t0 = performance.now(), pctDone = false;
    (function pct(now) {
      var p = Math.min(100, Math.round(((now - t0) / LOAD_MS) * 100));
      pctEl.textContent = p + "%";
      if (p < 100) requestAnimationFrame(pct);
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
          typeDone = true;
          maybeFinish();
        });
      });
    });

    /* Failsafe: never let the loader hang if the typing chain breaks. */
    setTimeout(function () {
      if (!typeDone) {
        console.warn("[intro] typing chain stalled — forcing handoff.");
        typeDone = true;
        maybeFinish();
      }
    }, LOAD_MS + 8000);

    /* --- handoff --- */
    var finished = false;
    function maybeFinish() {
      if (finished || !(pctDone && typeDone)) return;
      finished = true;

      pctEl.classList.add("is-out");
      factEl.classList.add("is-out");

      var titleBlk = ov.querySelector(".intro-title");
      var tKick = document.querySelector(".home-copy .copy-kicker").getBoundingClientRect();
      var fKick = kickerEl.getBoundingClientRect();

      ov.classList.add("is-leaving");
      titleBlk.classList.add("is-flip");
      requestAnimationFrame(function () {
        titleBlk.style.transform = "translate(-50%,-50%) translate(" +
          (tKick.left - fKick.left) + "px," + (tKick.top - fKick.top) + "px)";
      });

      setTimeout(function () {
        var realHead = document.querySelector(".home-copy .home-headline");
        var finalText = headlineText(realHead);
        realHead.textContent = "";
        document.querySelector(".home-copy").classList.add("intro-released");
        ov.classList.add("is-done");
        setTimeout(function () { ov.remove(); }, 700);

        typeInto(realHead, finalText, TYPE_MS, function (caret) {
          caret.remove();
          document.body.classList.remove("intro-pending");
        });
      }, 950);
    }
  }
})();
