# DTS Website — working notes for Claude

Marketing and client-access site for **Digital Twin Studios** (dtsxr.com).
Static site: vanilla HTML/CSS/JS, no build step, no framework, no backend.
Deployed as static files to GitHub Pages.

---

## Read first

- `README.md` — architecture, content pipeline, document schemas, and the
  **Do-not-break list**. It is accurate and it is binding.
- `docs/plans/gis/` — the active build package: multi-experience project window,
  GIS engine, guided tours, CMS editors, and the GFC (Iberia Parish) project.
  Start at `docs/plans/gis/README.md`, then `09-BUILD-PLAN.md` for the phase order.

---

## Non-negotiable

- Script and CSS load order in `index.html`. Never reorder either list.
- `js/tour-bridge.js` message type strings and ping cadence — that is Treedis's
  contract, not ours.
- **One Treedis iframe, ever.** Overlays move the existing iframe in the DOM and
  return it on close. Never create a second one; it resets the session and the
  bridge handshake.
- The legacy `DTS_CONFIG` shape produced by `js/content-loader.js`. Extend it;
  don't reshape it. `js/app.js` depends on it.
- localStorage keys `dtsAdminDraft` and `dtsAdminSession`.

---

## Commit conventions

- No `Co-Authored-By` trailer, and no "Claude," "Anthropic," "AI-generated," or similar
  attribution in a commit subject or body. This overrides the harness's default git
  workflow for this repo specifically.
- The commit author is the repo's configured git identity, full stop — don't pass
  `--author` or otherwise attribute a commit to Claude.
- Before running `git commit`, show the proposed subject and body and get a go-ahead.
  This applies every session, not just the one where it was requested.
- Existing commits that already carry the trailer are left alone unless explicitly
  asked to rewrite history.

## The rule people get wrong

Adding a field to a `/data` JSON document **does nothing** until it is also:

1. registered in `data/manifest.json`,
2. mapped in `buildConfig()` in `js/content-loader.js`, and
3. rendered in `js/app.js`.

Three places, every time. `buildConfig()` only copies fields it knows about, and
`convertMedia()` silently drops any `media._type` it doesn't recognise.

---

## Local dev

```bash
python3 -m http.server 8000
```

Required. Opening `index.html` over `file://` breaks `/data` loading and the site
silently falls back to `js/config.js`, which will make you chase a bug that isn't
there.

Deploying = pushing files. There is nothing to build.

---

## Conventions

- Vanilla JS, no runtime dependencies. (JSZip is fetched from cdnjs only inside the
  Admin Board's export.) New scripts are plain IIFEs.
- CSS files are numbered and load in order; later files intentionally override
  earlier ones. Add rules to the file matching their scope; add new scopes as a new
  numbered file at the end.
- All media references use `source: { kind: "path" | "url", value }`. Renderers
  must support both.
- `js/config.js` and `js/clients.js` are **fallbacks**. `/data` is the source of
  truth, but keep them roughly in sync when making structural changes.
- Content is CMS-first: if an editor might reasonably want to change it, it belongs
  in `/data` and in the Admin Board, not as a constant in code.

---

## Testing checklist (run after any change)

- Home ↔ each of the four sector views
- One example window per sector
- "Try a Digital Twin" reveal opens and closes — **the tour must not reload**
- A lead form send, plus the `mailto:` fallback with the Web3Forms key removed
- Sign-in with `demo` / `1234`
- Admin sign-in → save draft → preview → discard
- Mobile drawer and sector swipe
- Safari check for the Vision Pro CTA
- Browser back/forward through home → sector → project → close
- Console clean on load and on every overlay

---

## Working style

- Phase gates from `docs/plans/gis/09-BUILD-PLAN.md` are hard. Finish a phase, run
  its acceptance checks and the regression checklist, commit, then start the next.
- Backward compatibility is not optional. The 16 existing project documents must
  render identically after any schema change.
- If something the plan didn't anticipate comes up, stop and say so rather than
  improvising a change to the content schema or the Treedis bridge.
- Append a short entry to `docs/CHANGES.md` after each phase.

### Verification approach (changed after the GIS Phase 4 gate)

Live, agent-driven browser testing (Claude-in-Chrome) burned a lot of tokens for
comparatively little signal in Phase 4 and is no longer the default. Verify by other
means first, in this order:

1. Read the code. Trace the actual call path a claim depends on — don't infer behavior
   from a function's name or a comment; open it and follow it.
2. Where a claim depends on a real external service or file (an ArcGIS endpoint, a
   vendored library's actual API, a real data file), check it directly — `curl` the
   service, decode a real response, `node --check`/`node -e` a small script, grep the
   vendored source for the real method name. This is cheap and gives a real answer,
   unlike guessing from documentation.
3. Only reach for live browser verification when a claim is genuinely undecidable by
   1-2 — real DOM/rendering/interaction behavior, timing, or something that only shows
   up on screen. Even then, prefer asking the human to check it manually over spending
   an extended Claude-in-Chrome session, unless they've asked for the opposite.
4. At the end of a phase, instead of (or in addition to, if 3 already happened for a
   few specific things) an agent-driven browser pass, produce a manual testing
   document in the same shape as `docs/plans/gis/GIS-FULL-SYSTEM-TESTING.md`
   (unchecked boxes, a Comments line per test, Pass/Fail/Not-tested) for the human to
   run through themselves and report back. Don't mark anything passed on their behalf.

Always be explicit in your own reporting about which claims are "confirmed by reading
the code," "confirmed against the real service/data," and "not yet confirmed live" —
don't blur those together as if they carry the same weight.
