import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Resolved from this file, so the tests run from any checkout and any
   working directory rather than one machine's absolute path. */
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..") + path.sep;

const read = (f) => fs.readFileSync(APP + f, "utf8");

// Real stop data from the repo, so slugs are tested against reality.
const tours = JSON.parse(read("data/tours.geojson"));

function makeEnv(search = "") {
  const listeners = {};
  const el = () => ({
    className: "", id: "", type: "", innerHTML: "", textContent: "",
    dataset: {}, style: {}, hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; },
    append() {}, appendChild() {}, remove() {}, insertBefore() {},
    querySelectorAll() { return []; }, addEventListener() {},
    parentNode: { insertBefore() {} }
  });
  const win = {};
  const history = {
    entries: [],
    replaceState(s, t, url) { this.entries.push(["replace", url]); sync(url); },
    pushState(s, t, url) { this.entries.push(["push", url]); sync(url); }
  };
  function sync(url) {
    ctx.location.search = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  }
  const mkStore = () => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k)
    };
  };
  const ctx = {
    window: win, console, history,
    location: {
      search,
      pathname: "/Wrapper/map/LSU3D/",
      origin: "https://sroberto27.github.io"
    },
    document: {
      body: {
        classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
        appendChild() {}
      },
      createElement: el,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      hidden: false
    },
    localStorage: mkStore(),
    sessionStorage: mkStore(),
    URLSearchParams, Promise, Math, Date, Object, String, Number, JSON,
    isFinite, Array, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (fn) => fn(),
    encodeURIComponent, navigator: {},

    // --- app globals the router reads ---
    tourStops: tours.features
      .slice()
      .sort((a, b) => a.properties.order_num - b.properties.order_num)
      .map((f, i) => ({ feature: f, featureId: i })),
    tourIndex: -1,
    goToStop(i) {
      ctx.tourIndex = i;
      ctx.__wentTo.push(i);
      // Mirrors js/08-tourbar.js: goToStop delegates to selectFeature,
      // so wrappers on selectFeature must run here too.
      const s = ctx.tourStops[i];
      if (s) ctx.selectFeature({ sourceId: "tours-source", featureId: s.featureId, feature: s.feature }, "tour", { focus: true });
    },
    selectFeature(sel) { ctx.__selected.push(sel); },
    clearSelection() { ctx.__cleared++; },
    renderDetails() {},
    cleanName: (n) => String(n || "").trim(),
    is3DMode: false,
    isMobile: () => false,
    __wentTo: [], __selected: [], __cleared: 0
  };
  // In a browser `window` IS the global object, so `window.Core = ...`
  // creates a bare global `Core`. Mirror that, or the modules can't
  // see each other's exports.
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
  ctx.__listeners = listeners;
  vm.createContext(ctx);
  vm.runInContext(read("js/15-core-services.js"), ctx);
  vm.runInContext(read("js/17-router.js"), ctx);
  return ctx;
}

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS  ${label} ${extra}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
};

/* ---- slugify parity with the validator / schema doc ---------------- */
{
  const ctx = makeEnv();
  const R = ctx.window.Router;
  const expected = {
    "Lot 414 \u00b7 River Road Arrival": "lot-414-river-road-arrival",
    "Board the Charter Bus": "board-the-charter-bus",
    "Tiger Tailgate \u00b7 Indoors": "tiger-tailgate-indoors",
    "Kickoff \u00b7 Death Valley": "kickoff-death-valley",
    "Postgame \u00b7 Nicholson Gateway": "postgame-nicholson-gateway"
  };
  for (const [name, slug] of Object.entries(expected)) {
    ok(`slugify("${name}")`, R.slugify(name) === slug, `-> ${R.slugify(name)}`);
  }
  ok("slugify strips accents",
     R.slugify("Caf\u00e9 D\u00e9j\u00e0") === "cafe-deja",
     `-> ${R.slugify("Caf\u00e9 D\u00e9j\u00e0")}`);

  let allFound = true;
  for (const f of tours.features) {
    if (R.stopIndexForKey(f.properties.stop_key) < 0) {
      allFound = false;
      console.log("   missing:", f.properties.stop_key);
    }
  }
  ok("all 10 stop_keys resolve to a tour stop", allFound);
  ok("unknown key returns -1", R.stopIndexForKey("not-a-stop") === -1);
  ok("stop_key preferred over name",
     R.stopKeyForFeature({ properties: { name: "Anything At All", stop_key: "frozen-key" } }) === "frozen-key");
  ok("falls back to name slug",
     R.stopKeyForFeature({ properties: { name: "Lawton Room" } }) === "lawton-room");
}

/* ---- parseRoute validation ----------------------------------------- */
{
  const ctx = makeEnv();
  const R = ctx.window.Router;
  const p = (s) => R.parseRoute(s);

  ok("stop parsed", p("?stop=lawton-room").stop === "lawton-room");
  ok("stop tolerates spaces/case",
     p("?stop=Lawton%20Room").stop === "lawton-room",
     `-> ${p("?stop=Lawton%20Room").stop}`);
  ok("gameday id accepted", p("?g=2026-09-05-alabama").g === "2026-09-05-alabama");
  ok("path traversal in g rejected", p("?g=../../secret").g === null,
     `-> ${p("?g=../../secret").g}`);
  ok("absolute path in g rejected", p("?g=/etc/passwd").g === null);
  ok("over-long g rejected", p("?g=" + "a".repeat(80)).g === null);
  ok("mode=live accepted", p("?mode=live").mode === "live");
  ok("mode=kiosk accepted", p("?mode=kiosk").mode === "kiosk");
  ok("bogus mode rejected", p("?mode=admin").mode === null);
  ok("autoplay only on 1",
     p("?autoplay=1").autoplay === true && p("?autoplay=yes").autoplay === false);
  ok("src whitelist", p("?src=qr").src === "qr" && p("?src=evil").src === null);

  ok("name kept", p("?n=Jordan").n === "Jordan");
  ok("apostrophe name kept", p("?n=O%27Neal").n === "O'Neal", `-> ${p("?n=O%27Neal").n}`);
  ok("hyphen name kept", p("?n=Jean-Luc").n === "Jean-Luc");
  ok("script tag stripped",
     p("?n=%3Cscript%3Ealert(1)%3C/script%3E").n === "scriptalertscript",
     `-> ${p("?n=%3Cscript%3Ealert(1)%3C/script%3E").n}`);
  ok("digits stripped", p("?n=Bob123").n === "Bob", `-> ${p("?n=Bob123").n}`);
  ok("name truncated to 24", (p("?n=" + "a".repeat(60)).n || "").length === 24);
  ok("empty name -> null", p("?n=%20%20").n === null);
}

/* ---- initial route application -------------------------------------- */
{
  const ctx = makeEnv("?stop=lawton-room&src=qr");
  ctx.window.onAppReady();
  ok("deep link navigated to stop 7 (index 6)", ctx.__wentTo[0] === 6, `-> ${ctx.__wentTo[0]}`);
  const ev = ctx.window.Core.__events().map((e) => e.event);
  ok("deep_link_opened tracked", ev.includes("deep_link_opened"));
  ok("URL kept stop+src",
     ctx.location.search.includes("stop=lawton-room") && ctx.location.search.includes("src=qr"),
     `-> ${ctx.location.search}`);
}

{
  const ctx = makeEnv("?stop=nope-not-real");
  ctx.window.onAppReady();
  ok("unknown stop does not navigate", ctx.__wentTo.length === 0);
  ok("unknown stop tracked as error",
     ctx.window.Core.__events().some((e) => e.event === "error" && e.props.reason === "unknown_stop"));
  ok("bad stop stripped from URL", !ctx.location.search.includes("nope"),
     `-> "${ctx.location.search}"`);
}

{
  const ctx = makeEnv("?n=Jordan&stop=registration");
  ctx.window.onAppReady();
  ok("name never written back to URL",
     !ctx.location.search.includes("n=") && !ctx.location.search.includes("Jordan"),
     `-> ${ctx.location.search}`);
  ok("name still available in memory", ctx.window.Router.getRoute().n === "Jordan");
  const dl = ctx.window.Core.__events().find((e) => e.event === "deep_link_opened");
  ok("name not in analytics payload",
     JSON.stringify(dl.props).indexOf("Jordan") === -1,
     `-> ${JSON.stringify(dl.props)}`);
}

{
  const ctx = makeEnv("?utm_source=twitter&fbclid=abc123");
  ctx.window.onAppReady();
  ok("junk params stripped",
     !ctx.location.search.includes("utm") && !ctx.location.search.includes("fbclid"),
     `-> "${ctx.location.search}"`);
}

{
  const ctx = makeEnv("");
  ctx.window.onAppReady();
  ok("no params: nothing navigates", ctx.__wentTo.length === 0);
  ok("no params: no deep_link event",
     !ctx.window.Core.__events().some((e) => e.event === "deep_link_opened"));
}

/* ---- URL sync on selection ------------------------------------------ */
{
  const ctx = makeEnv("");
  ctx.window.onAppReady();
  const stop = ctx.tourStops[6];
  ctx.selectFeature({ sourceId: "tours-source", featureId: 6, feature: stop.feature }, "tour", {});
  ok("selection pushes stop into URL", ctx.location.search.includes("stop=lawton-room"),
     `-> ${ctx.location.search}`);
  ok("selection creates a history entry", ctx.history.entries.some((e) => e[0] === "push"));
  ok("stop_opened tracked on selection",
     ctx.window.Core.__events().some((e) => e.event === "stop_opened" && e.props.stopKey === "lawton-room"));
}

{
  const ctx = makeEnv("?stop=lawton-room");
  ctx.window.onAppReady();
  const before = ctx.history.entries.length;
  ctx.clearSelection();
  ok("clearSelection removes stop from URL", !ctx.location.search.includes("stop="),
     `-> "${ctx.location.search}"`);
  ok("clearSelection added a history entry", ctx.history.entries.length > before);
}

{
  const ctx = makeEnv("?stop=registration&src=nfc");
  ctx.window.onAppReady();
  ok("deep-linked arrival still records stop_opened",
     ctx.window.Core.__events().some((e) => e.event === "stop_opened"));
}

/* ---- urlForStop ------------------------------------------------------ */
{
  const ctx = makeEnv("?g=sample-gameday");
  ctx.window.onAppReady();
  const url = ctx.window.Router.urlForStop("lawton-room");
  ok("urlForStop is absolute with a single path",
     url === "https://sroberto27.github.io/Wrapper/map/LSU3D/?g=sample-gameday&stop=lawton-room",
     `-> ${url}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
