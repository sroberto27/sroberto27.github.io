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
  var LOAD_MS   = 5000;  // 0 → 100%
  var FACTS_URL = "data/fun-facts.json";

  /* Fallback accents if the sector config isn't reachable. */
  var FALLBACK_ACCENTS = ["#FFB22C", "#2E8BFF", "#34598F", "#D27049"];

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

  function typeInto(el, text, speed, done) {
    el.textContent = "";
    var caret = document.createElement("span");
    caret.className = "intro-caret";
    caret.textContent = "_";
    el.appendChild(caret);
    var i = 0;
    (function tick() {
      if (i < text.length) {
        var ch = text[i++];
        if (ch === "\n") el.insertBefore(document.createElement("br"), caret);
        else el.insertBefore(document.createTextNode(ch), caret);
        setTimeout(tick, speed);
      } else {
        done && done(caret);
      }
    })();
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
      .then(function (r) { return r.json(); })
      .then(function (d) { cb((d && d.facts) || []); })
      .catch(function () { cb([]); });
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
    var hero = heroText();
    if (!hero || !hero.headline) return setTimeout(start, 100);

    loadFacts(function (facts) {
      run(hero, facts);
    });
  }

  function run(hero, facts) {
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
    typeInto(kickerEl, hero.kicker, TYPE_MS, function (caret) {
      caret.remove();
      typeInto(headEl, hero.headline, TYPE_MS, function (hcaret) {
        hcaret.remove();
        typeInto(factEl, fact, FACT_MS, function () {
          typeDone = true;          // fact keeps its blinking "_"
          maybeFinish();
        });
      });
    });

    /* --- handoff --- */
    function maybeFinish() {
      if (!(pctDone && typeDone)) return;

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
