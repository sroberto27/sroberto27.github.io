import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Resolved from this file, so the tests run from any checkout and any
   working directory rather than one machine's absolute path. */
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..") + path.sep;

const src = fs.readFileSync(APP + "js/15-core-services.js", "utf8");

function makeStorage(broken) {
  const m = new Map();
  return {
    getItem: (k) => { if (broken) throw new Error("denied"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (broken) throw new Error("denied"); m.set(k, String(v)); },
    removeItem: (k) => { if (broken) throw new Error("denied"); m.delete(k); }
  };
}

function run({ search = "", brokenStorage = false } = {}) {
  const win = {};
  const ctx = {
    window: win, console,
    location: { search },
    document: { body: { classList: { contains: () => false } } },
    localStorage: makeStorage(brokenStorage),
    sessionStorage: makeStorage(brokenStorage),
    URLSearchParams, Promise, Math, Date, Object, String, JSON, isFinite
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { win, ctx };
}

const { win } = run();
const C = win.Core;
let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`PASS  ${label} ${extra}`); }
  else { fail++; console.log(`FAIL  ${label} ${extra}`); }
};

// --- geo math against known LSU points -----------------------------
// Tiger Stadium ~[-91.1836, 30.4118]; Football Ops ~[-91.1866, 30.4132]
const stadium = [-91.1836, 30.4118], ops = [-91.1866, 30.4132];
const d = C.haversineFt(stadium, ops);
ok("haversineFt plausible (900-1400ft)", d > 900 && d < 1400, `-> ${d.toFixed(0)} ft`);
ok("haversineFt identity == 0", C.haversineFt(stadium, stadium) === 0);
ok("haversineFt null-safe", C.haversineFt(null, stadium) === null);

// due north / due east sanity
ok("bearing due north ~0", Math.abs(C.bearingDeg([-91.18,30.41], [-91.18,30.42])) < 0.001);
const east = C.bearingDeg([-91.18,30.41], [-91.17,30.41]);
ok("bearing due east ~90", Math.abs(east - 90) < 0.1, `-> ${east.toFixed(3)}`);
ok("compassPoint(45)=northeast", C.compassPoint(45) === "northeast", `-> ${C.compassPoint(45)}`);
ok("compassPoint(350)=north", C.compassPoint(350) === "north", `-> ${C.compassPoint(350)}`);
ok("compassPoint(null) null-safe", C.compassPoint(null) === null);

ok("walkMinutes(1000ft)", C.walkMinutes(1000) === 5, `-> ${C.walkMinutes(1000)} min`);
ok("walkMinutes floors at 1", C.walkMinutes(5) === 1);
ok("walkMinutes null-safe", C.walkMinutes(null) === null);
ok("formatDistance ft", C.formatDistance(437) === "440 ft", `-> ${C.formatDistance(437)}`);
ok("formatDistance mi", C.formatDistance(5280) === "1.0 mi", `-> ${C.formatDistance(5280)}`);

// --- store ---------------------------------------------------------
ok("store.available", C.store.available() === true);
C.store.set("probe.obj", { a: 1 });
ok("store roundtrip", C.store.get("probe.obj").a === 1);
ok("store fallback on miss", C.store.get("nope", "fb") === "fb");
C.store.remove("probe.obj");
ok("store remove", C.store.get("probe.obj", "gone") === "gone");

// --- store with storage that throws --------------------------------
const broken = run({ brokenStorage: true }).win.Core;
ok("broken storage: available()=false", broken.store.available() === false);
ok("broken storage: set() returns false", broken.store.set("x", 1) === false);
ok("broken storage: get() returns fallback", broken.store.get("x", "fb") === "fb");
ok("broken storage: sessionId falls back", broken.sessionId === "s_ephemeral", `-> ${broken.sessionId}`);

// --- analytics -----------------------------------------------------
const seen = [];
C.setAnalyticsSink((e) => seen.push(e));
C.track("stop_opened", { stopKey: "lawton-room" });
ok("sink received event", seen.length >= 1 && seen.at(-1).event === "stop_opened");
ok("ambient sessionId attached", !!seen.at(-1).props.sessionId);
ok("ambient appMode attached", seen.at(-1).props.appMode === "explore");
ok("track('') is a no-op", (() => { const n = seen.length; C.track(""); return seen.length === n; })());

// a throwing sink must detach, not propagate
C.setAnalyticsSink(() => { throw new Error("boom"); });
let threw = false;
try { C.track("x"); } catch (_) { threw = true; }
ok("throwing sink does not propagate", threw === false);
ok("throwing sink detached (next track is quiet)", (() => { try { C.track("y"); return true; } catch { return false; } })());

// buffer replay into a late sink
const late = [];
C.setAnalyticsSink((e) => late.push(e));
ok("late sink gets buffered replay (3 tracked: stop_opened,x,y)", late.length === 3, `-> ${late.length} replayed`);

// --- onReady -------------------------------------------------------
const order = [];
C.onReady(() => order.push("a"));
C.onReady(() => { order.push("b"); C.onReady(() => order.push("nested")); });
ok("onReady defers until fired", order.length === 0);
win.onAppReady();
ok("onReady ran in registration order", order.join(",") === "a,b", `-> ${order.join(",")}`);
await Promise.resolve(); await Promise.resolve();
ok("nested onReady runs on next microtask", order.join(",") === "a,b,nested", `-> ${order.join(",")}`);
win.onAppReady();
await Promise.resolve(); await Promise.resolve();
ok("onAppReady idempotent (no re-run)", order.join(",") === "a,b,nested", `-> ${order.join(",")}`);

// a throwing callback must not stop later ones
const w2 = run().win; const C2 = w2.Core; const got = [];
C2.onReady(() => { throw new Error("nope"); });
C2.onReady(() => got.push("survived"));
w2.onAppReady();
ok("throwing onReady cb isolated", got[0] === "survived");

// late registration
let lateRan = false;
C2.onReady(() => { lateRan = true; });
await Promise.resolve(); await Promise.resolve();
ok("late onReady still runs", lateRan === true);

// --- ?debug=1 ------------------------------------------------------
const dbg = run({ search: "?debug=1" }).win.Core;
ok("?debug=1 attaches a sink", (() => { let hit=false; const o=console.info; console.info=()=>{hit=true}; dbg.track("z"); console.info=o; return hit; })());

console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
