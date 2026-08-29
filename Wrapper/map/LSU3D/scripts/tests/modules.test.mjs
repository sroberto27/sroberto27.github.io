/* Loads every new Phase 1 module together, in index.html order, against a
   stub DOM + map. Catches the things node --check cannot: missing globals,
   wrappers applied in the wrong order, and exceptions at onAppReady. */

import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Resolved from this file, so the tests run from any checkout and any
   working directory rather than one machine's absolute path. */
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..") + path.sep;

const read = (f) => fs.readFileSync(APP + f, "utf8");

const tours = JSON.parse(read("data/tours.geojson"));
const gameday = JSON.parse(read("data/gamedays/sample-gameday.json"));

const MODULES = [
  "js/15-core-services.js",
  "js/17-router.js",
  "js/18-gameday.js",
  "js/19-geolocation.js",
  "js/20-live-visit.js",
  "js/21-kiosk.js"
];

function makeNode(tag = "div") {
  const node = {
    tagName: tag, id: "", className: "", type: "", title: "",
    innerHTML: "", textContent: "", href: "", hidden: false, disabled: false,
    dataset: {}, style: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { node.children.push(c); return c; },
    append(...c) { node.children.push(...c); },
    insertBefore(c) { node.children.unshift(c); return c; },
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    get firstChild() { return node.children[0] || null; },
    parentNode: null
  };
  node.parentNode = {
    inserted: [],
    insertBefore(n) { node.parentNode.inserted.push(n); return n; }
  };
  return node;
}

function makeEnv(search, { gamedayFound = true } = {}) {
  const byId = new Map();
  const docListeners = {};
  const get = (id) => {
    if (!byId.has(id)) { const n = makeNode(); n.id = id; byId.set(id, n); }
    return byId.get(id);
  };

  /* Nodes appended to <body> must become findable by getElementById,
     otherwise a module that creates its own UI (the Live Visit bar, the
     kiosk overlay, the toast stack) is invisible to a test — it would
     get back an unrelated empty stub and quietly assert nothing. */
  const registerById = (node) => {
    if (node && node.id) byId.set(node.id, node);
    return node;
  };

  const history = {
    entries: [],
    replaceState(s, t, url) { this.entries.push(url); sync(url); },
    pushState(s, t, url) { this.entries.push(url); sync(url); }
  };
  const sync = (url) => {
    ctx.location.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  };

  const mkStore = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k)
    };
  };

  const mapLayers = new Set();
  const mapSources = new Map();

  const ctx = {
    console, history,
    location: { search, pathname: "/Wrapper/map/LSU3D/", origin: "https://sroberto27.github.io" },
    document: {
      body: (() => {
        const b = makeNode("body");
        const append = b.appendChild;
        b.appendChild = (c) => { append(c); return registerById(c); };
        return b;
      })(),
      documentElement: makeNode("html"),
      createElement: (t) => makeNode(t),
      getElementById: get,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(type, fn, capture) {
        (docListeners[type] = docListeners[type] || []).push({ fn, capture: !!capture });
      },
      removeEventListener(type, fn) {
        if (!docListeners[type]) return;
        docListeners[type] = docListeners[type].filter((h) => h.fn !== fn);
      },
      hidden: false,
      fullscreenElement: null
    },
    localStorage: mkStore(),
    sessionStorage: mkStore(),
    URLSearchParams, Promise, Math, Date, Object, String, Number, JSON, Array,
    isFinite, isNaN, Set, Map, RegExp, Error,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: (fn) => fn(),
    encodeURIComponent,
    navigator: {
      geolocation: {
        getCurrentPosition(ok, err) {
          if (ctx.__geoFix) ok({ coords: ctx.__geoFix });
          else err({ code: 1 });
        },
        watchPosition() { return 1; },
        clearWatch() {}
      }
    },
    // Real campus extent from config.js map3d.bounds.
    imageBounds: {
      contains: ({ lng, lat }) =>
        lng >= -91.2014 && lng <= -91.1735 && lat >= 30.4040 && lat <= 30.4202,
      getCenter: () => ({ lng: -91.18745, lat: 30.4121 })
    },
    resetCampusView() { ctx.__campusResets++; },
    __geoFix: null,
    __campusResets: 0,

    // --- map + app globals -------------------------------------------
    maplibregl: { Marker: class { constructor(o) { this.o = o; } setLngLat() { return this; } addTo() { return this; } remove() {} getElement() { return this.o.element; } } },
    map: {
      getStyle: () => ({}),
      getSource: (id) => mapSources.get(id) || null,
      addSource: (id, d) => mapSources.set(id, { setData() {} }),
      addLayer: (l) => mapLayers.add(l.id),
      getLayer: (id) => (mapLayers.has(id) ? {} : null),
      setLayoutProperty() {}, setTerrain() {}, flyTo() {}, easeTo() {},
      getMaxZoom: () => 21
    },
    tourStops: tours.features.slice()
      .sort((a, b) => a.properties.order_num - b.properties.order_num)
      .map((f, i) => ({ feature: f, featureId: i })),
    tourIndex: -1,
    selectedFeature: null,
    selectFeature(sel, kind) {
      ctx.__selected.push(sel);
      ctx.selectedFeature = { feature: sel.feature, kind, featureId: sel.featureId };
      ctx.renderDetails(sel.feature, kind);
    },
    clearSelection() {},
    renderDetails() { ctx.__detailsRenders++; },
    updateTourbar() { ctx.__tourbarRenders++; },
    goToStop(i) {
      ctx.tourIndex = i;
      ctx.__wentTo.push(i);
      const s = ctx.tourStops[i];
      if (s) ctx.selectFeature({ sourceId: "tours-source", featureId: s.featureId, feature: s.feature }, "tour", { focus: true });
      ctx.updateTourbar();
    },
    tourPrevAction() {}, tourNextAction() {},
    cleanName: (n) => String(n || "").trim(),
    escapeHTML: (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    boundsOfFeature: (f) => {
      const ring = f.geometry.coordinates[0];
      const lngs = ring.map((c) => c[0]), lats = ring.map((c) => c[1]);
      return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    },
    centerOfBounds: (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
    is3DMode: false,
    isMobile: () => false,
    CAMPUS_CONFIG: JSON.parse(JSON.stringify({
      gameday: {
        enableMyGameday: true, enableLiveVisit: true,
        enableGeolocation: true, enableKiosk: true,
        arrivalRadiusFt: 150, poorAccuracyM: 50,
        kiosk: { dwellMs: 12000, idleMs: 90000, loop: true }
      }
    })),
    async loadGamedayJSON(id) {
      ctx.__gamedayFetches.push(id);
      return gamedayFound ? gameday : null;
    },

    __selected: [], __wentTo: [], __gamedayFetches: [], __tourbarRenders: 0,
    __detailsRenders: 0, __errors: [],
    __dispatch(type, event) {
      const evt = Object.assign({ type, preventDefault() {}, target: null }, event);
      const hs = (docListeners[type] || []).slice();
      for (const h of hs) if (h.capture) h.fn(evt);
      for (const h of hs) if (!h.capture) h.fn(evt);
    }
  };

  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.addEventListener = () => {};
  ctx.removeEventListener = () => {};

  vm.createContext(ctx);
  for (const m of MODULES) {
    try {
      vm.runInContext(read(m), ctx);
    } catch (e) {
      ctx.__errors.push(`${m}: ${e.message}`);
    }
  }
  return ctx;
}

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS  ${label} ${extra}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
};

/* ---- all modules load together -------------------------------------- */
{
  const ctx = makeEnv("");
  ok("all 6 modules execute without error", ctx.__errors.length === 0, ctx.__errors.join(" | "));
  for (const name of ["Core", "Router", "Gameday", "Geo", "LiveVisit", "Kiosk"]) {
    ok(`${name} exported`, typeof ctx[name] === "object" && ctx[name] !== null);
  }
  ok("plain app boots with no route", (() => {
    try { ctx.onAppReady(); return true; } catch (e) { console.log("   ", e.message); return false; }
  })());
  ok("no gameday fetched without ?g=", ctx.__gamedayFetches.length === 0);
  ok("nothing navigated without a route", ctx.__wentTo.length === 0);
}

/* ---- wrapper chain order -------------------------------------------- */
{
  const ctx = makeEnv("");
  const calls = [];
  const orig = ctx.selectFeature;
  // The wrappers were installed over the original at load time, so calling
  // the current global must still reach the original exactly once.
  ctx.__selected.length = 0;
  ctx.onAppReady();
  ctx.selectFeature({ sourceId: "tours-source", featureId: 6, feature: ctx.tourStops[6].feature }, "tour", {});
  ok("wrapped selectFeature still reaches the original once", ctx.__selected.length === 1,
     `-> ${ctx.__selected.length}`);
  ok("wrapped updateTourbar still renders", (() => {
    const before = ctx.__tourbarRenders;
    ctx.updateTourbar();
    return ctx.__tourbarRenders === before + 1;
  })());
}

/* ---- gameday ---------------------------------------------------------- */
{
  const ctx = makeEnv("?g=sample-gameday&n=Jordan");
  ctx.onAppReady();
  await new Promise((r) => setImmediate(r));

  ok("gameday fetched once", ctx.__gamedayFetches.length === 1, `-> ${ctx.__gamedayFetches}`);
  ok("gameday active", ctx.Gameday.isActive());
  ok("all 10 itinerary stops matched", ctx.Gameday.state.byStopKey.size === 10,
     `-> ${ctx.Gameday.state.byStopKey.size}`);
  ok("recruit name held in memory", ctx.Gameday.recruitName() === "Jordan");

  const ev = ctx.Core.__events().find((e) => e.event === "gameday_loaded");
  ok("gameday_loaded tracked", !!ev);
  ok("gameday_loaded carries no name", ev && JSON.stringify(ev.props).indexOf("Jordan") === -1,
     ev ? JSON.stringify(ev.props) : "");

  ok("formatClock 14:15 -> 2:15 PM", ctx.Gameday.formatClock("14:15") === "2:15 PM",
     `-> ${ctx.Gameday.formatClock("14:15")}`);
  ok("formatClock 00:05 -> 12:05 AM", ctx.Gameday.formatClock("00:05") === "12:05 AM",
     `-> ${ctx.Gameday.formatClock("00:05")}`);
  ok("formatClock 12:00 -> 12:00 PM", ctx.Gameday.formatClock("12:00") === "12:00 PM");
  ok("formatClock rejects junk", ctx.Gameday.formatClock("2:15pm") === null);

  const s = ctx.Gameday.stopSummary(6);
  ok("stopSummary joins itinerary to stop", s && s.key === "lawton-room" && s.arrive === "16:15",
     s ? `-> ${s.key} ${s.arrive}` : "");
  ok("stopSummary carries the instruction", !!(s && s.instruction));

  // progress persists
  ctx.selectFeature({ sourceId: "tours-source", featureId: 6, feature: ctx.tourStops[6].feature }, "tour", {});
  ok("selection marks the stop visited", ctx.Gameday.state.visited.has("lawton-room"));
  const saved = ctx.Core.store.get("gameday.progress.sample-gameday", null);
  ok("progress written to storage", !!saved && saved.visited.includes("lawton-room"),
     JSON.stringify(saved));
}

/* ---- gameday that does not exist ------------------------------------- */
{
  const ctx = makeEnv("?g=no-such-gameday", { gamedayFound: false });
  let threw = false;
  try { ctx.onAppReady(); await new Promise((r) => setImmediate(r)); }
  catch (e) { threw = true; console.log("   ", e.message); }
  ok("missing gameday does not throw", !threw);
  ok("missing gameday stays inactive", !ctx.Gameday.isActive());
  ok("missing gameday tracked", ctx.Core.__events().some(
    (e) => e.event === "error" && e.props.reason === "not_found"));
}

/* ---- live visit ------------------------------------------------------- */
{
  const ctx = makeEnv("?mode=live");
  ctx.onAppReady();
  ok("live mode entered from deep link", ctx.LiveVisit.isActive());
  ok("mode_entered tracked", ctx.Core.__events().some(
    (e) => e.event === "mode_entered" && e.props.mode === "live"));
  ok("live mode started the tour", ctx.__wentTo[0] === 0, `-> ${ctx.__wentTo}`);
  ok("body carries mode-live", ctx.document.body.classList.contains("mode-live"));

  ctx.LiveVisit.exit({ reason: "test" });
  ok("live mode exits cleanly", !ctx.LiveVisit.isActive());
  ok("body class removed on exit", !ctx.document.body.classList.contains("mode-live"));
  ok("mode removed from URL", !ctx.location.search.includes("mode="), `-> "${ctx.location.search}"`);
}

/* ---- kiosk ------------------------------------------------------------ */
{
  const ctx = makeEnv("?mode=kiosk&autoplay=1");
  ctx.onAppReady();
  ok("kiosk entered from deep link", ctx.Kiosk.isActive());
  ok("autoplay=1 starts playing", ctx.Kiosk.isPlaying());
  ok("kiosk started at stop 1", ctx.__wentTo[0] === 0, `-> ${ctx.__wentTo}`);

  ctx.Kiosk.pause({ reason: "test" });
  ok("kiosk pauses", !ctx.Kiosk.isPlaying());

  ctx.Kiosk.exit({ reason: "test" });
  ok("kiosk exits cleanly", !ctx.Kiosk.isActive());
  ok("kiosk clears its URL params", !ctx.location.search.includes("kiosk"),
     `-> "${ctx.location.search}"`);
}

/* ---- kiosk without autoplay ------------------------------------------- */
{
  const ctx = makeEnv("?mode=kiosk");
  ctx.onAppReady();
  ok("kiosk without autoplay does not play", ctx.Kiosk.isActive() && !ctx.Kiosk.isPlaying());
}

/* ---- gameday reaches the DETAILS panel (regression for C1/C6/C10/C13) -- */
{
  // .rail-detail is opaque and stacks above .rail-tour, so a summary that
  // lives only in the tour card is invisible whenever a stop is selected.
  const ctx = makeEnv("?g=sample-gameday&n=Jordan&stop=lawton-room");
  ctx.onAppReady();
  await new Promise((r) => setImmediate(r));

  const mounted = ctx.document.getElementById("detailsBody").parentNode.inserted;
  const html = mounted.map((n) => n.className + " " + n.innerHTML).join(" ");

  ok("a summary is mounted in the details panel",
     mounted.some((n) => n.className === "gameday-detail-summary"));
  ok("details summary carries the greeting", html.includes("here’s your gameday"));
  ok("details summary carries the recruit name", html.includes("Jordan"));
  ok("details summary carries NOW/NEXT", html.includes("NOW") && html.includes("NEXT"));
  ok("details summary carries contacts", html.includes("WHO TO CALL"));
  ok("details summary carries the contact role", html.includes("Recruiting Operations"));
  ok("a per-stop note is mounted too",
     mounted.some((n) => n.className === "gameday-detail-note"));
  ok("the note carries this stop's time", html.includes("4:15 PM"), "lawton-room arrives 16:15");
}

{
  // The cold-deep-link race: the router renders the panel synchronously in
  // onAppReady, the itinerary arrives afterwards.
  const ctx = makeEnv("?g=sample-gameday&stop=lawton-room");
  ctx.onAppReady();
  const before = ctx.__detailsRenders;
  await new Promise((r) => setImmediate(r));
  ok("details panel is re-rendered once the itinerary lands",
     ctx.__detailsRenders > before,
     `-> ${before} then ${ctx.__detailsRenders}`);
}

{
  // Without ?g= nothing gameday-related may appear anywhere.
  const ctx = makeEnv("?stop=lawton-room");
  ctx.onAppReady();
  await new Promise((r) => setImmediate(r));
  const mounted = ctx.document.getElementById("detailsBody").parentNode.inserted;
  ok("no gameday blocks without ?g=",
     !mounted.some((n) => String(n.className).startsWith("gameday-")),
     `-> ${mounted.map((n) => n.className).join(",") || "none"}`);
}

/* ---- kiosk keyboard: capture vs bubble (regression for F9) ------------- */
{
  const ctx = makeEnv("?mode=kiosk&autoplay=1");
  ctx.onAppReady();
  ok("kiosk playing before spacebar", ctx.Kiosk.isPlaying());

  ctx.__dispatch("keydown", { key: " ", code: "Space" });
  ok("spacebar PAUSES a playing kiosk", !ctx.Kiosk.isPlaying(),
     "capture-phase interaction handler must not pre-pause and flip the toggle");

  ctx.__dispatch("keydown", { key: " ", code: "Space" });
  ok("spacebar resumes a paused kiosk", ctx.Kiosk.isPlaying());

  ctx.__dispatch("keydown", { key: " ", code: "Space" });
  ok("spacebar pauses again (true toggle)", !ctx.Kiosk.isPlaying());
}

{
  const ctx = makeEnv("?mode=kiosk&autoplay=1");
  ctx.onAppReady();
  ctx.__dispatch("keydown", { key: "Escape" });
  ok("Escape still exits kiosk", !ctx.Kiosk.isActive());
}

{
  // A real visitor touch must still pause, which is the behaviour the
  // spacebar exception has to leave intact.
  const ctx = makeEnv("?mode=kiosk&autoplay=1");
  ctx.onAppReady();
  ctx.__dispatch("pointerdown", { target: { id: "map" } });
  ok("a screen tap still pauses the kiosk", !ctx.Kiosk.isPlaying());
}

/* ---- on-campus vs previewing from home --------------------------------- */
{
  // Someone standing at Tiger Stadium.
  const ctx = makeEnv("");
  ctx.onAppReady();
  ctx.__geoFix = { longitude: -91.1836, latitude: 30.4118, accuracy: 8 };
  await ctx.Geo.locate({ source: "test" });

  ok("on-campus fix is recognised", ctx.Geo.isOnCampus() === true);
  ok("on-campus reports a distance to a stop", ctx.Geo.toStop(6) !== null);
  ok("on-campus finds a nearest stop", ctx.Geo.nearestStop() !== null);
  ok("on-campus does not reset the camera", ctx.__campusResets === 0);
}

{
  // Someone in Los Angeles, previewing weeks before the visit.
  const ctx = makeEnv("");
  ctx.onAppReady();
  ctx.__geoFix = { longitude: -118.2437, latitude: 34.0522, accuracy: 8 };
  await ctx.Geo.locate({ source: "test" });

  ok("off-campus fix is recognised", ctx.Geo.isOnCampus() === false);
  ok("off-campus quotes NO distance", ctx.Geo.toStop(6) === null,
     "1,800 mi and a 480,000 minute walk is not a useful answer");
  ok("off-campus has no nearest stop", ctx.Geo.nearestStop() === null);
  ok("off-campus falls back to the campus view", ctx.__campusResets > 0);
  ok("off-campus is reported to subscribers", ctx.Geo.getState().onCampus === false);

  const fix = ctx.Core.__events().find((e) => e.event === "geo_fix");
  ok("geo_fix records on/off campus", fix && fix.props.onCampus === false);
  ok("geo_fix still carries no coordinates",
     fix && JSON.stringify(fix.props).indexOf("118.2") === -1,
     fix ? JSON.stringify(fix.props) : "");
}

{
  // Live Visit must say so rather than showing an empty distance.
  const ctx = makeEnv("?mode=live");
  // Set the fix BEFORE entering: LiveVisit calls locate() on entry, and a
  // refusal is deliberately final, so a denial here would block every
  // later attempt — which is the app behaving correctly, not a bug.
  ctx.__geoFix = { longitude: -118.2437, latitude: 34.0522, accuracy: 8 };
  ctx.onAppReady();
  await new Promise((r) => setImmediate(r));
  ctx.LiveVisit.refresh();

  const bar = ctx.document.getElementById("liveVisitBar");
  ok("live bar shows the not-on-campus state",
     String(bar.innerHTML).includes("NOT ON CAMPUS"),
     "bar=" + String(bar.innerHTML).slice(0, 200).replace(/\s+/g, " "));
  ok("live bar shows no distance chip",
     !String(bar.innerHTML).includes("live-next-nav"));
}

/* ---- geolocation absent ----------------------------------------------- */
{
  const ctx = makeEnv("");
  ctx.onAppReady();
  let threw = false;
  try { await ctx.Geo.locate({ source: "test" }); } catch (e) { threw = true; console.log("   ", e.message); }
  ok("Geo.locate survives no geolocation API", !threw);
  ok("Geo reports no fix", ctx.Geo.getState().coords === null);
  ok("Geo.toStop returns null with no fix", ctx.Geo.toStop(0) === null);
  ok("Geo.nearestStop returns null with no fix", ctx.Geo.nearestStop() === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
