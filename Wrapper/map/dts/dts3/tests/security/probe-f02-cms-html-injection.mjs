// PASS means: CMS-authored sector text cannot introduce markup into the page.
// A failed "denied" assertion means a site_admin can inject executing HTML
// into every visitor's session through the sector editor (F-02). A failed
// "allowed" assertion means escaping broke ordinary text rendering.
//
//   node tests/security/probe-f02-cms-html-injection.mjs
//
// This probe evaluates the REAL expressions out of js/app.js -- it locates
// each innerHTML assignment by an anchor, extracts its right-hand side, and
// runs it with the file's own escapeHTML() and a crafted payload. So it tests
// the shipping code path, not a restatement of it, and it fails loudly if
// someone rewrites the sink rather than passing silently.
//
// Why it is not an end-to-end browser exploit: reaching these sinks for real
// means publishing a payload into shared CMS content on the dev site, which
// is a destructive write to state other people use. The injection itself is
// fully determined by the expression, so it is reproduced here instead.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { begin, report, expectDenied, expectAllowed } from "./_harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = path.join(HERE, "..", "..", "js", "app.js");
const src = fs.readFileSync(APP_JS, "utf8");

begin("F-02 -- CMS-authored sector text must not reach innerHTML unescaped");

const PAYLOAD = '<img src=x onerror="alert(1)">';
const BENIGN = "Education";

/* ---- pull the real escapeHTML() out of the file ------------------------- */

function extractFunction(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name}() not found in js/app.js`);
  let depth = 0, i = src.indexOf("{", start);
  const open = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

// eslint-disable-next-line no-new-func
const escapeHTML = new Function(`${extractFunction("escapeHTML")}; return escapeHTML;`)();

/* ---- pull each innerHTML assignment's right-hand side ------------------- */

/** The RHS of the first `<target> =` statement after `anchor`, sans trailing ";". */
function extractAssignment(anchor, target) {
  const at = src.indexOf(anchor);
  if (at === -1) throw new Error(`anchor not found in js/app.js: ${anchor}`);
  const assignAt = src.indexOf(target, at);
  if (assignAt === -1) throw new Error(`no ${target} after anchor: ${anchor}`);
  const eq = src.indexOf("=", assignAt + target.length - 1);
  const end = src.indexOf(";", eq);
  return src.slice(eq + 1, end).trim();
}

function evaluate(rhs, scope) {
  const names = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function("escapeHTML", ...names, `return (${rhs});`)(
    escapeHTML, ...names.map((n) => scope[n])
  );
}

const SINKS = [
  {
    id: "js/app.js:116 -- sector kicker (mobile nav drawer)",
    rhs: extractAssignment("data-label feeds the ghost echo", "a.innerHTML"),
    payloadScope: { c: { kicker: PAYLOAD } },
    benignScope: { c: { kicker: BENIGN } },
    // The kicker renders as authored.
    benignExpect: [BENIGN],
  },
  {
    id: "js/app.js:546 -- use-case card title and text (category view)",
    rhs: extractAssignment("use-case cards — clicking one opens", "el.innerHTML"),
    payloadScope: { card: { title: PAYLOAD, text: PAYLOAD } },
    benignScope: { card: { title: BENIGN, text: "Spatial navigation." } },
    // The title is upper-cased for display; the body text is not. Both must
    // survive -- escaping in the wrong order would mangle one of them.
    benignExpect: [BENIGN.toUpperCase(), "Spatial navigation."],
  },
];

/* The harness asserts on response shapes; an empty json array reads as
   "nothing leaked". Each sink that still emits live markup is one row. */
function asResponse(rows) {
  return { status: 200, headers: {}, body: JSON.stringify(rows), json: rows };
}

/* ---- the exploit: does the payload survive as real markup? -------------- */

/* Template-agnostic detector: render the same expression with a benign value
   and with the payload, and count tag openings. The template's own tags are
   identical in both, so any INCREASE is a tag the payload introduced -- i.e.
   an element in the DOM rather than text. Escaped output ("&lt;img") adds no
   "<" and so adds no tags. This deliberately does not grep for "onerror" or
   "<img": those strings still appear, correctly escaped, after the fix, and a
   detector that flagged them would never go green. */
const countTags = (s) => (s.match(/</g) || []).length;

const injected = [];
for (const sink of SINKS) {
  const html = evaluate(sink.rhs, sink.payloadScope);
  const baseline = countTags(evaluate(sink.rhs, sink.benignScope));
  const withPayload = countTags(html);
  if (withPayload > baseline) {
    injected.push({
      sink: sink.id,
      tagsAdded: withPayload - baseline,
      rendered: html.slice(0, 160),
    });
  }
  console.log(`  ${sink.id}\n     -> ${html.slice(0, 120)}\n     tags: ${baseline} baseline, ${withPayload} with payload`);
}
console.log("");

expectDenied("no CMS-authored sector field emits live markup", asResponse(injected));

/* ---- the companion: ordinary text must still render --------------------- */

const brokenBenign = [];
for (const sink of SINKS) {
  const html = evaluate(sink.rhs, sink.benignScope);
  const missing = sink.benignExpect.filter((want) => !html.includes(want));
  if (missing.length) {
    brokenBenign.push({ sink: sink.id, missing, rendered: html.slice(0, 160) });
  }
}
if (brokenBenign.length) console.log("  benign rendering broke:", JSON.stringify(brokenBenign, null, 2));
// Non-empty here means a sink stopped rendering its ordinary value.
expectAllowed(
  "ordinary sector text still renders unchanged",
  asResponse(brokenBenign.length ? [] : [{ ok: SINKS.length }])
);

report();
