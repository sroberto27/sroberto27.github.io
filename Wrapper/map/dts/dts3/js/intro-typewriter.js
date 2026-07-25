/* ============================================================
   Intro loader
   • Centered kicker + headline typed with a terminal "_" caret
   • Random fun fact typed underneath
   • Big % counter bottom-right — driven by REAL load progress,
     including the hero hexagons' own images/video/3D models
   • Category-sequence banner across the top edge — a traveling
     light draws a colored line through four category markers,
     illustrating "education prepares people, industry employs
     them, government structures their society, community is
     what all three build together"
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

  /* ---------- category sequence banner ---------- */
  var FLOW_NODES = [
    { frac: 0.05, x: 82,  color: "#e9b44c", label: "Education",  clause: "education prepares people" },
    { frac: 0.35, x: 334, color: "#4a7df0", label: "Industry",   clause: "industry employs them" },
    { frac: 0.65, x: 586, color: "#5f6fa8", label: "Government", clause: "government structures their society" },
    { frac: 0.95, x: 838, color: "#d98e73", label: "Community",  clause: "community is what all three build together" }
  ];
  var FLOW_FINAL = "That sequence is the website.";
  var FLOW_RECAP = "Systems have a natural sequence \u2014 education prepares people, " +
    "industry employs them, government structures their society, " +
    "community is what all three systems build together.";
  var FLOW_START_X = 40, FLOW_END_X = 880, FLOW_LEN = FLOW_END_X - FLOW_START_X;
  var FLOW_TRAVEL_MS = 2600, FLOW_HOLD_MS = 1300, FLOW_RECAP_MS = 3400,
      FLOW_FADE_MS = 500, FLOW_GAP_MS = 500;

  function flowIconMarkup(i) {
    var tx = FLOW_NODES[i].x - 14;
    if (i === 0) {
      return '<g transform="translate(' + tx + ',62)"><g class="flow-peak">' +
        '<polygon fill="#e9b44c" points="0,10 14,2 28,10 14,18"/>' +
        '<rect fill="#e9b44c" x="8" y="13" width="12" height="9" rx="1.5"/>' +
        '<line x1="28" y1="10" x2="24" y2="24" stroke="#e9b44c" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle fill="#e9b44c" cx="24" cy="25" r="1.6"/>' +
        '</g></g>';
    }
    if (i === 1) {
      return '<g transform="translate(' + tx + ',62)"><g class="flow-peak">' +
        '<circle fill="#4a7df0" opacity=".5" cx="21" cy="-1" r="1.6"/>' +
        '<circle fill="#4a7df0" opacity=".4" cx="23.5" cy="-4.5" r="1.3"/>' +
        '<circle fill="#4a7df0" opacity=".3" cx="25" cy="-8" r="1"/>' +
        '<rect fill="#4a7df0" x="19" y="2" width="4" height="10"/>' +
        '<polygon fill="#4a7df0" points="2,18 14,8 26,18"/>' +
        '<rect fill="#4a7df0" x="2" y="18" width="24" height="8"/>' +
        '</g></g>';
    }
    if (i === 2) {
      return '<g transform="translate(' + tx + ',62)"><g class="flow-peak">' +
        '<polygon fill="#5f6fa8" points="1,10 14,2 27,10"/>' +
        '<rect fill="#5f6fa8" x="1" y="10" width="26" height="2"/>' +
        '<rect fill="#5f6fa8" x="4" y="12" width="2.6" height="12"/>' +
        '<rect fill="#5f6fa8" x="10" y="12" width="2.6" height="12"/>' +
        '<rect fill="#5f6fa8" x="16" y="12" width="2.6" height="12"/>' +
        '<rect fill="#5f6fa8" x="22" y="12" width="2.6" height="12"/>' +
        '<rect fill="#5f6fa8" x="0" y="24" width="28" height="3"/>' +
        '</g></g>';
    }
    return '<g transform="translate(' + tx + ',62)"><g class="flow-peak">' +
      '<circle fill="#d98e73" opacity=".55" cx="9" cy="8" r="4.2"/>' +
      '<path fill="#d98e73" opacity=".55" d="M 2,26 Q 2,15 9,15 Q 16,15 16,26 Z"/>' +
      '<circle fill="#d98e73" cx="18" cy="9" r="4.8"/>' +
      '<path fill="#d98e73" d="M 9,27 Q 9,16 18,16 Q 27,16 27,27 Z"/>' +
      '</g></g>';
  }

  function flowBannerMarkup() {
    var nodesSVG = "";
    FLOW_NODES.forEach(function (n, i) {
      nodesSVG += '<g id="inNode' + i + '">' +
        flowIconMarkup(i) +
        '<circle class="flow-ring" cx="' + n.x + '" cy="90" r="9" fill="none" stroke="' + n.color + '" stroke-width="2"/>' +
        '<text class="flow-label" x="' + n.x + '" y="112" fill="' + n.color + '">' + n.label + '</text>' +
        '</g>';
    });
    return '<div class="intro-flow" id="inFlow">' +
      '<svg viewBox="0 0 920 140" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="inFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">' +
            '<stop offset="0%" stop-color="#e9b44c"/>' +
            '<stop offset="33%" stop-color="#4a7df0"/>' +
            '<stop offset="66%" stop-color="#5f6fa8"/>' +
            '<stop offset="100%" stop-color="#d98e73"/>' +
          '</linearGradient>' +
          '<filter id="inFlowBlur" x="-60%" y="-60%" width="220%" height="220%">' +
            '<feGaussianBlur stdDeviation="3"/>' +
          '</filter>' +
        '</defs>' +
        '<line x1="' + FLOW_START_X + '" y1="90" x2="' + FLOW_END_X + '" y2="90" stroke="#1c2438" stroke-width="1"/>' +
        '<line id="inFlowLine" x1="' + FLOW_START_X + '" y1="90" x2="' + FLOW_END_X + '" y2="90" stroke="url(#inFlowGrad)" stroke-width="2" stroke-dasharray="' + FLOW_LEN + '" stroke-dashoffset="' + FLOW_LEN + '"/>' +
        nodesSVG +
        '<circle id="inCometGlow" class="flow-comet-glow" cx="' + FLOW_START_X + '" cy="90" r="10" fill="#fff2cf" filter="url(#inFlowBlur)"/>' +
        '<circle id="inComet" class="flow-comet" cx="' + FLOW_START_X + '" cy="90" r="3.6" fill="#fffdf5"/>' +
      '</svg>' +
      '<p class="flow-caption" id="inFlowCaption"></p>' +
    '</div>';
  }

  /* Drives the traveling pulse + node ignitions + captions. Loops on
     its own clock as ambient motion; returns a stop() the intro calls
     once at handoff so nothing keeps ticking on a detached overlay. */
  function startFlowSequence(ov) {
    var flowLine   = ov.querySelector("#inFlowLine");
    var comet      = ov.querySelector("#inComet");
    var cometGlow  = ov.querySelector("#inCometGlow");
    var flowWrap   = ov.querySelector("#inFlow");
    var caption    = ov.querySelector("#inFlowCaption");
    if (!flowLine || !comet || !flowWrap || !caption) return function () {};

    var timers = [];
    var rafId = null;
    var ignited = [false, false, false, false];
    var stopped = false;

    function setCaption(text, dim) {
      caption.classList.remove("show");
      timers.push(setTimeout(function () {
        if (stopped) return;
        caption.textContent = text || "";
        caption.classList.toggle("dim", !!dim);
        if (text) caption.classList.add("show");
      }, text ? 160 : 0));
    }

    function igniteNode(i) {
      var g = ov.querySelector("#inNode" + i);
      if (!g) return;
      g.querySelector(".flow-peak").classList.add("on");
      g.querySelector(".flow-label").classList.add("on");
      var ring = g.querySelector(".flow-ring");
      ring.classList.remove("pulse"); void ring.offsetWidth; ring.classList.add("pulse");
      setCaption(FLOW_NODES[i].clause + (i < 3 ? "\u2014" : "."));
    }

    function resetVisual() {
      ignited = [false, false, false, false];
      for (var i = 0; i < 4; i++) {
        var g = ov.querySelector("#inNode" + i);
        if (!g) continue;
        g.querySelector(".flow-peak").classList.remove("on");
        g.querySelector(".flow-label").classList.remove("on");
        g.querySelector(".flow-ring").classList.remove("pulse");
      }
      flowLine.setAttribute("stroke-dashoffset", FLOW_LEN);
      comet.setAttribute("cx", FLOW_START_X);
      cometGlow.setAttribute("cx", FLOW_START_X);
      setCaption("");
    }

    function runCycle() {
      if (stopped) return;
      resetVisual();
      flowWrap.classList.remove("is-out");

      var start = null;
      function frame(ts) {
        if (stopped) return;
        if (!start) start = ts;
        var t = Math.min((ts - start) / FLOW_TRAVEL_MS, 1);
        var x = FLOW_START_X + t * FLOW_LEN;
        comet.setAttribute("cx", x);
        cometGlow.setAttribute("cx", x);
        flowLine.setAttribute("stroke-dashoffset", FLOW_LEN * (1 - t));
        FLOW_NODES.forEach(function (n, i) {
          if (!ignited[i] && t >= n.frac) { ignited[i] = true; igniteNode(i); }
        });
        if (t < 1) rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);

      timers.push(setTimeout(function () {
        if (stopped) return;
        var lastRing = ov.querySelector("#inNode3 .flow-ring");
        if (lastRing) { lastRing.classList.remove("pulse"); void lastRing.offsetWidth; lastRing.classList.add("pulse"); }
        setCaption(FLOW_FINAL);
      }, FLOW_TRAVEL_MS + 60));

      timers.push(setTimeout(function () {
        if (!stopped) setCaption(FLOW_RECAP);
      }, FLOW_TRAVEL_MS + FLOW_HOLD_MS));

      timers.push(setTimeout(function () {
        if (!stopped) flowWrap.classList.add("is-out");
      }, FLOW_TRAVEL_MS + FLOW_HOLD_MS + FLOW_RECAP_MS));

      timers.push(setTimeout(runCycle,
        FLOW_TRAVEL_MS + FLOW_HOLD_MS + FLOW_RECAP_MS + FLOW_FADE_MS + FLOW_GAP_MS));
    }

    runCycle();

    return function stop() {
      stopped = true;
      timers.forEach(clearTimeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }

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
      flowBannerMarkup() +
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

    var stopFlow = startFlowSequence(ov);

    /* ============================================================
       PERCENTAGE — real load progress
       ------------------------------------------------------------
       Four weighted milestones complete as the site actually loads,
       including the hero hexagons' own media (images, video, 3D
       models — see hex-media.js). The displayed value eases toward
       the highest reached milestone so it never jumps or visibly
       stalls. A floor keeps the fun fact readable; a ceiling
       guarantees the loader always ends even if a third-party embed
       never finishes.
       ============================================================ */
    var milestones = { content: 0, windowLoad: 0, hexMedia: 0, typing: 0 };
    var WEIGHTS    = { content: 0.20, windowLoad: 0.25, hexMedia: 0.35, typing: 0.20 };

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

    /* Set by js/hex-media.js once every hexagon's image has decoded,
       its video has real frame data, or its 3D model has fired its
       own "load" event (a broken asset still counts as settled, via
       its "error" event — see expectHexLoad() there). Undefined until
       that script runs, which the polling loop treats as "not yet". */
    if (window.DTS_HEX_MEDIA_READY) {
      milestones.hexMedia = 1;
    } else {
      (function pollHexMedia() {
        if (window.DTS_HEX_MEDIA_READY) milestones.hexMedia = 1;
        else setTimeout(pollHexMedia, 100);
      })();
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

      if (stopFlow) stopFlow();
      var flowEl = ov.querySelector(".intro-flow");
      if (flowEl) flowEl.classList.add("is-out");

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
