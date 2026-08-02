# Changelog

Newest first.

## GIS Phase 3 task 3.12 — mountGis() wiring, instance cache, invalidateSize

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.12 / `04-SPEC-gis-engine.md` §9. Wires the
already-complete engine (3.1-3.11) into the real experience switcher. Only 3.13 (harvest
script) and 3.14 (the real Iberia map document) remain in Phase 3.

- `js/app.js`'s `mountGis()` placeholder is now a real `DTSGis.mount()` call. Two lazy-load
  layers stack: `js/gis/gis-loader.js` (already lazy, vendors Leaflet/esri-leaflet) plus a
  new `loadGisEngine()` that lazily injects *our own* `gis-viewer.js`/`gis-esri.js`/
  `gis-tools.js` too -- §9's "under 200KB, loaded only on first GIS tab activation" budget
  covers `js/gis/*` itself, not just `vendor/`, so a visitor who never opens a map project
  should download none of it. (`css/15-gis.css` stays statically linked, per task 3.5's own
  precedent -- a small stylesheet with no such budget concern, not revisited here.)
- **Instance cache with an LRU cap of 2** (`gisCache`, keyed by `mapId` -- deliberately not
  experience id, since a `mapId` can be referenced by more than one project, and every
  experience's base id defaults to its `_type` alone, so two different projects' first "gis"
  experience would otherwise collide on id "gis"). Leaving a map's tab (`suspendExperience`)
  or closing its project (`closeExampleNow`) calls the engine's own `suspend()` (§5/§9 --
  stops pending tile/query requests, a backgrounded map costs nothing) and just hides the
  pane; nothing is destroyed or removed from `#exStageSlot`, so a returning visit is a cache
  hit -- same instance, same DOM node, no reload, no re-fetch, matching the "no reload on
  switch back" bar this codebase already holds Treedis to. `closeExampleNow`'s existing
  `[id^="exampleMediaFrame-"]` removal is naturally exempt from the parked GIS pane, since it
  uses its own distinct `exampleGisPane-<mapId>` id prefix. Only eviction past the cap
  actually tears an instance down (`instance.destroy()` + its `DTSGisTools` instance's own
  `destroy()` + pane removal); the map currently on screen is never a candidate.
- `invalidateSize()` wired to: the CSS-fallback fullscreen enter (`playReveal()`, covering
  the real Fullscreen-API path, the older-WebKit event path, and the no-Fullscreen-API CSS
  overlay, since all three funnel through it), the two fullscreen-exit paths (the native
  `fullscreenchange`/`webkitfullscreenchange` listener, and the CSS fallback's own tap-exit
  and Escape-exit handlers), and a plain `window` `resize` listener.
- **Finding, not a bug (confirmed live, worth recording so it isn't "fixed" again later):**
  prototype-patching `L.Map.prototype.invalidateSize` and dispatching a synthetic `resize`
  event showed vendored Leaflet 1.9.4 already calls `invalidateSize()` on every *live* map
  instance itself on `window` resize (its own internal listener, bound at construction,
  still firing even for a suspended/hidden map) -- making this task's explicit `resize`
  listener redundant for that one case. Kept anyway: it's harmless, it's what the task
  explicitly calls for, and it doesn't rely on an implementation detail of a vendored
  library that could change. It is **not** redundant for fullscreen: entering/exiting the
  CSS fallback changes the stage's size via a class toggle, with no native `resize` event at
  all, so that path only re-measures because of this task's own explicit call -- confirmed
  live by spying the same prototype method around a real `#exEnter` click (browser
  automation can't grant a script-driven `.click()` real Fullscreen-API transient activation,
  so the click reliably exercises the CSS-fallback branch, the one this task most needed to
  verify) and around a synthetic Escape keydown.
- Verified live in Chrome against the real app shell (not a standalone harness this time --
  `python -m http.server 8000` serving the actual site), with three temporary `gisMap`
  documents and matching `experiences[]` entries added to three real, existing projects
  (`energy`, `workforce`, `healthcare` -- one of the three, `healthcare`, wired to the real,
  CORS-verified Iberia parish-boundary `esriFeature` layer to confirm the *whole* pipeline
  end to end, not just the engine in isolation) and registered in `data/manifest.json`'s
  `gis` group: a deep link straight to a project's GIS tab (`?category=…&project=…&exp=…`)
  mounts correctly alongside its Treedis tab; switching tabs away and back reuses the exact
  same DOM node and Leaflet instance (checked by object identity, not just visual
  inspection); closing the project and reopening it later reuses the same cached instance
  too; opening two more distinct maps in sequence correctly evicts the least-recently-used
  entry once the cache exceeds its cap of 2, while never touching the one currently on
  screen; and a non-GIS legacy project (`campus`) loads with zero GIS/Leaflet script tags
  and no `window.DTSGis`/`window.L` globals at all, confirmed directly via the DOM rather
  than the session's network-request-capture tool, which (consistent with this session's
  already-documented automation quirks) failed to reliably attribute requests to the page
  under test. All temporary map/manifest/project-file test data reverted before committing,
  same pattern as every prior phase's live-data testing.

## GIS Phase 3 task 3.11 — print/export image, export data, and share links

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.11 / `04-SPEC-gis-engine.md` §6-7. This is the
last of the §6 tool set; only 3.12 (wiring `mountGis()` into `js/app.js`'s switcher) and the
content tasks remain in Phase 3. Nothing wired into `index.html`/`app.js` yet.

- **Share** (`getState()`/`applyState()` already existed from Phase 3a; this task adds the
  encode half): `js/gis/gis-viewer.js` gains `encodeStateParam()`, the exact inverse of the
  already-tested `decodeStateParam()` -- same `escape`/`atob` round trip, not
  `TextEncoder`/`TextDecoder` as §7 suggests, because encode has to invert what decode
  already expects, and decode's mechanism is the one every prior `applyState()` test (3.8's
  filters, 3.9's drawings, 3.10's swipe/time state) actually exercised. Exposed as
  `instance._encodeState`, same internal-seam footing as `_getLayerBounds`. §7's "consider
  splitting the view into a `#map=z/lat/lng` fragment" question was already answered
  implicitly back in Phase 3a -- `decodeStateParam` has only ever accepted the whole blob --
  so `gis-tools.js`'s share panel keeps that shape: one opaque `map=` query parameter.
  Round, per §7: centre to 5 decimals and opacity to 2 (already true of `getState()`); cap
  the encoded blob at 1500 chars, and if drawings are what pushed it over, drop them and say
  so in the panel. Verified live: encode → URL → a **second, independent `DTSGis.mount()`**
  with `stateParam` set reproduces the exact same `getState()` (center, zoom, layer
  visibility/opacity) -- the real decode path, not a hand-rolled copy of it. Also verified
  the cap: 40 synthetic drawings pushed the blob to 4774 chars; the share link correctly
  dropped them (down to 142 chars) and showed the message, while a single drawing under the
  cap round-tripped intact.
- **Export data**: a new toolbar panel, layer-scoped to currently-visible queryable layers
  (dropdown rebuilt on open, same live pattern as swipe's layer choice), with GeoJSON and
  CSV downloads. Deliberately reuses task 3.8's `queryRows`/`fieldsForLayer`/
  `matchesConditions`/`downloadCsv` wholesale instead of writing a parallel path: "currently
  visible/filtered features" is exactly the attribute table's own row set (minus its
  transient text-search box, which isn't part of the map's actual state), so there was
  nothing new to compute. Per §6, the GeoJSON export embeds the layer's attribution as a
  properties-level note (`_attribution`) on every feature -- confirmed live against the real
  Iberia parish-boundary layer.
- **Print / export image**: composes the live DOM Leaflet already rendered into a canvas --
  every `<img>`/`<canvas>` inside the map container, positioned via `getBoundingClientRect()`
  and ordered by its ancestor pane's `zIndex` -- rather than re-deriving Leaflet's internal
  pixel math. A bottom band overlays title/attribution/scale-bar-text/legend swatches read
  straight off the same `legendRowsFor()` the legend panel already uses. Downloads as PNG via
  `canvas.toBlob()`.
- **Real bug, found live (this task's central finding, matching §6's own warning that canvas
  tainting is "a common late surprise"):** MDN documents a tainted canvas as resolving
  `toBlob()`'s callback with `null`. Confirmed live against Chrome and the real Iberia
  boundary layer + CARTO dark basemap tiles (neither loaded with a `crossOrigin` attribute --
  changing that site-wide for every tile/image layer to chase untainted exports was judged
  out of scope and too risky for this task, since a server that doesn't answer the
  `crossOrigin` fetch correctly would silently break basemap tiles everywhere, not just
  export): Chrome instead throws a **synchronous `SecurityError` out of `toBlob()` itself**,
  which an unguarded call would let escape as an uncaught exception. Fixed by wrapping the
  `toBlob()` call itself in try/catch, in addition to the `null`-blob check -- both outcomes
  reach the same §11 message ("Image export isn't available for these layers — use Print
  instead."). This is not a theoretical fallback: against real project data it is the
  *normal* path, confirmed live.
- **Print fallback**, per §6 ("open a print-styled view and let the browser's own
  print-to-PDF handle it"): rather than clone the map into a second Leaflet instance (a
  second live mount re-triggers every layer's network fetch for no benefit -- the same waste
  the "one Treedis iframe ever" rule elsewhere in this codebase warns against in spirit),
  `printMap()` repositions the *real*, already-mounted map full-page via the classic
  visibility-flip `@media print` technique (`css/15-gis.css`) plus a small injected
  title/legend/attribution block. This works precisely because canvas tainting only blocks
  JS pixel *readback* -- it never affects the browser's own on-screen/print compositing, so
  the same layers that can't be exported to PNG still print correctly. Cleanup runs on the
  `afterprint` event, with a 60s fallback timer since `afterprint` doesn't fire in every
  environment. Verified live (with `window.print` stubbed to avoid blocking the test session
  on a native OS dialog -- the same reason browser-automation guidance elsewhere avoids
  triggering real dialogs): the printing class and info block appear with the correct title
  and a real legend row, and both are removed once `afterprint` fires.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (the parish boundary
  `esriFeature` layer) and a CARTO dark basemap: all three tools end-to-end, including both
  real bugs above and their fixes. Automated `computer` clicks on the small toolbar buttons
  were unreliable in this session (a CSS-pixel/screenshot-pixel scale mismatch sent clicks to
  the wrong coordinates) -- fell back to direct DOM `.click()` dispatch via the JS console for
  every interaction, the same ground-truth-over-screenshot approach documented in prior
  tasks' entries. Test harness deleted before committing.

## GIS Phase 3 task 3.10 — swipe compare and time slider

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.10 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12. This is the last of the
§6 tool set; only 3.11 (print/export/share) and the wiring/content tasks remain in
Phase 3.

- **Swipe compare**: a draggable divider clipping one chosen layer's own Leaflet pane
  via CSS `clip-path` -- simpler than reassigning the layer to a dedicated pane, and
  correct as long as each layer keeps a distinct `zIndex` (true of every layer in
  §4's own schema example and the expected authoring convention; two layers sharing
  one `zIndex` would share one pane and both get clipped -- a documented limitation,
  not a silent one). Layer choice is a dropdown of currently-*visible* layers, per §6,
  rebuilt live off the existing layerchange tracking. Dragging uses Pointer Events
  (`setPointerCapture`) for one code path across mouse and touch. Resets cleanly per
  §6's own requirement: `setLayerVisible` clears the clip immediately if the hidden
  layer is the active swipe target.
- **Time slider**: additive to the schema, same "extend, don't reshape" pattern as
  earlier tasks -- `mapDoc.timeSeries.steps: [{id,label,date?}]` (§3) and, per layer
  (§4), `def.timeStep` (pure visibility swap -- CPRA content is "separate layers per
  scenario," per §6's own text, not a continuous temporal field) or `def.timeField`
  (ArcGIS time query via the layer's own `setTimeRange`, for a source that genuinely
  is temporal). Both mechanisms are supported per §6's explicit "support both."
  `isTimeVisible()` folds into the existing `syncLayerToMap()` visibility gate
  alongside the zoom-range check, so a layer panel checkbox stays the master switch --
  turning a time-stepped layer off keeps it off regardless of the active step. Play
  advances on a timer and auto-stops at the last step; `destroy()` now clears that
  timer, since nothing else would stop it firing against a torn-down map.
  **Scope decision:** the tool only shows when `timeSeries.steps.length >= 2` -- a
  lone `timeField` layer with no declared steps has no defined positions to scrub
  between (deriving them from ArcGIS service time-extent metadata was out of scope
  for this pass); §6's "or a timeField" wording is about which layers *respond* to
  the slider once it exists, not an independent trigger for showing it.
- **Real bug, found live, pre-existing since Phase 3a (not introduced here):**
  `entry.leaflet.getPane()` throws once a layer has actually been removed from the
  map -- `map.removeLayer()` nulls the layer's internal `_map` reference, and
  Leaflet's own `getPane()` reads `this._map.getPane(...)` with no null guard. This
  is exactly what happens when a layer being used as the swipe target gets switched
  off: `setLayerVisible()`'s `syncLayerToMap()` call removes it from the map, then
  the very next line tried to clear its swipe clip via `.getPane()` and threw.
  Fixed by looking the pane up through the map object by name
  (`map.getPane(layer.options.pane)`) instead of asking the layer object for it --
  always safe, attached or not.
- **Second real bug, found live, pre-existing since the original geojson/esriFeature
  layer factories (not introduced here) -- the most consequential finding of this
  task:** `pointToLayer`'s manually-built `L.circleMarker` (in both
  `gis-viewer.js`'s `buildGeoJsonLayer` and `gis-esri.js`'s `buildFeature`) never
  forwarded the layer's `pane` option. A parent `L.geoJSON`'s own `pane` option does
  *not* propagate into a custom `pointToLayer`'s manually-constructed marker -- that's
  a separate `L.Path` instance with its own `pane` option, defaulting to Leaflet's
  shared `"overlayPane"` (zIndex 400) when unset. This meant **every point feature
  from every geojson/esriFeature layer, ever, has silently ignored its configured
  `zIndex`** and rendered into one shared pane above (almost) everything else --
  §6's "layer order follows zIndex" was never actually true for points. Harmless-
  looking in isolation (points were still visible, just in the wrong stacking order,
  which no prior test happened to check for) until this task's swipe compare, which
  clips a layer's *own* pane by name: against a point layer it was clipping the wrong
  element entirely, doing nothing visible. Fixed by forwarding `ctx.pane` /
  `opts.pane` into the `pointToLayer` marker's own options in both files.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (parish
  boundary) plus local geojson fixtures (two overlapping polygons for swipe, three
  point markers tagged to different `timeStep`s for the slider). Screenshot-based
  visual verification was unreliable in this session's automated Chrome environment
  for *both* tasks this time -- not just the already-documented animation/dblclick
  quirks, but canvas content specifically: a deliberately-painted, fully-opaque test
  rectangle on a layer's own canvas did not appear in a screenshot of that exact
  region, and `getImageData` reads immediately after a time-step change were
  inconsistent with reality. Fell back to ground-truth checks with no rendering
  dependency -- `map.hasLayer()`, `getBoundingClientRect()`, DOM pane structure, and
  computed `clipPath` values -- which is what actually caught and confirmed both bugs
  above; screenshots would have shown the point layers "worked" the whole time.
  Test harness and geojson fixtures deleted before committing.

## GIS Phase 3 task 3.9 — measure, draw, coordinates, search, geolocate, bookmarks

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.9 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12. Six tools, all gated by
`mapDoc.tools.<name>`.

- **Bookmarks**: no engine changes at all -- `setView()` already accepts either
  `{center,zoom}` or `{bbox}`, exactly what a `mapDoc.bookmarks[].view` already is.
- **Coordinates**: `gis-viewer.js` emits a new `"pointer"` event (an addition to §5's
  event set, same spirit as `"identify"`) on `mousemove`+`click` -- click covers touch
  taps, which don't fire `mousemove`. `gis-tools.js` shows an always-on readout chip
  (click-to-copy) plus a "go to coordinates" panel parsing both decimal degrees and
  DMS (`29°52'12"N 91°45'00"W`), figuring out which half of the pair is latitude from
  which one carries N/S rather than assuming input order.
- **Geolocate**: `instance._geolocate()` wraps `navigator.geolocation`, draws an
  accuracy circle, and reports whether the result falls inside `view.maxBounds`.
  Per §11, a permission denial is silent (no toast); every other outcome gets a brief
  one, and being outside the parish offers a "Zoom to parish" action instead of flying
  to the user.
- **Search**: two parish-limited scopes per §6. Feature search runs across every
  queryable (`geojson`/`esriFeature`) layer using `def.searchField` if the map
  document sets one -- an additive extension to §4's layer schema -- else the first
  field `fieldsForLayer()` (from task 3.8) resolves. Place search is Nominatim, bounded
  to the map's own `view.maxBounds`: `sources.json` already confirmed the Iberia
  AddressLocators service is token-restricted, so per §6's own fallback chain Nominatim
  is the only option, not a corner cut. A failed place search says so in the results
  list rather than silently only showing feature matches.
- **Measure**: distance (multi-segment, running total) and area, per §6. All
  interaction lives in `gis-viewer.js` -- click adds a vertex, mousemove previews the
  next segment/closing edge, dblclick finishes, Escape cancels an in-progress session,
  Clear removes every finished one. Distance uses Leaflet's own `L.LatLng#distanceTo`
  (already haversine -- §2's "hand-roll haversine" note doesn't apply once you're
  already inside Leaflet); area uses §2's own suggested shortcut, an equirectangular
  projection centred on the ring's mean latitude plus the ordinary planar shoelace
  formula. On-map segment + running-total labels are `L.divIcon` markers; the panel
  mirrors the same total as text per §10 (the on-map label isn't the only channel).
- **Draw/annotate**: point, line, polygon, rectangle, text, per §6. Same
  click-to-vertex/dblclick-finish model as measure for line/polygon; rectangle is two
  opposite corners; text places a point then `gis-tools.js` collects the label via a
  small inline input positioned at the point's `containerPoint` (same technique task
  3.7's identify popup uses) before finalizing. Drawings are a plain-object registry --
  `{id,type,color,latlng?,latlngs?,text?}` -- so `getState().d`/`applyState()` (§7) and
  the "download as GeoJSON" button both just read it directly, no Leaflet object ever
  crosses out. **Security note:** a drawing's `text` can arrive via `applyState()` from
  a share link someone else authored and is rendered through a `divIcon`'s `innerHTML`
  -- escaped before render (confirmed live: a label typed as `Test <b>label</b>`
  rendered as literal text, not a real `<b>` element), since an unescaped label would
  be a real self-XSS vector via a crafted share link, not just a cosmetic concern.
- **Real bug, found live, pre-existing in the tools UI's own DOM structure (not new to
  this task, just newly triggered by it):** `js/gis/gis-tools.js`'s `host` element is a
  DOM descendant of the same container Leaflet owns as its map root (both mounted onto
  the same `containerEl`). Per ordinary DOM bubbling, any click on a *real* control
  inside `host` (buttons, inputs -- `host` itself stays `pointer-events:none`) was also
  reaching Leaflet's own container-level listeners as a genuine map click. Mostly
  harmless before now (a stray "identify: miss" event, a misleading coordinate
  readout), but for measure it was a real functional bug: opening the measure panel,
  or switching its mode/unit mid-measurement, injected a spurious vertex at the
  clicked button's screen position, because `gis-viewer.js`'s map click listener was
  already (re-)attached by the time the same click event finished bubbling to the
  container. Fixed once, at the root: `host` now calls `stopPropagation()` on
  click/dblclick/mouse*/wheel/touch* -- the single place that fixes every current and
  future control the same way, rather than patching each one. Corollary fix: this also
  stops scrolling a panel's list (e.g. the attribute table) from also zooming the map
  via the bubbled wheel event.
- **Second real bug, found live:** `gis-viewer.js`'s `finishMeasure()` built the
  emitted `"measure"` event's `detail` (via `buildMeasureDetail(true)`) *before*
  clearing `measureSession`, so `detail.active` read `true` on the very event meant to
  announce the session had ended. `gis-tools.js`'s readout -- which resets to "Click
  the map to start measuring." only `if (!detail.active)` -- got stuck showing the
  last in-progress distance instead of resetting. Fixed by explicitly setting
  `detail.active = false` after building the (still session-derived) totals.
  Confirmed via direct `MouseEvent`/`dblclick` dispatch in the console, not the
  higher-level browser-automation `double_click` action -- that action reliably added
  a third vertex instead of finishing in this environment, but dispatching the same
  two-clicks-then-`dblclick` sequence real browsers actually produce finished the
  measurement correctly both before and after this fix was isolated, confirming the
  automation action itself doesn't reproduce a real double-click here (harness
  artifact, not a product bug -- same category as Phase 3a's animated-`setView`
  finding).
- **Naming fix, not a behavior bug:** the filter panel's Apply/Clear buttons (task
  3.8) were `.dts-gis-filter-apply`/`.dts-gis-filter-clear`. This task reused those
  same classes for the coordinates "Go" button and measure's Finish/Clear, which is
  what actually caught this: a `document.querySelector('.dts-gis-filter-clear')`
  during testing silently grabbed the filter panel's button instead of measure's.
  Renamed everywhere to `.dts-gis-btn-primary`/`.dts-gis-btn-secondary` -- generic
  names for what was always a generic style, now unambiguous for any future caller.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (parish
  boundary) plus a local geojson point fixture: every tool above end-to-end, including
  the two bugs' before/after states, `getState()`/`applyState()` round-tripping a
  restored drawing, the XSS-escaping check, and that task 3.6-3.8's existing tools
  (layer panel checkbox toggling, identify) still work unchanged after the
  `stopPropagation` fix. Console clean throughout. Test harness and geojson fixture
  deleted before committing.

## GIS Phase 3 task 3.8 — attribute table and filter/query builder

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.8 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12.

- `js/gis/gis-viewer.js` gains three internal seams for `gis-tools.js`, same "not §5
  public API" footing as `_getLayerBounds`: `_queryLayer(id, selector)` (returns every
  feature, not just an objectIds lookup -- both `esriFeature`'s and `geojson`'s
  `query()` were extended to support a selector-less "give me everything" call),
  `_setLayerFilter(id, conditions)` (an ANDed `[{field, op, value}]` list, translated
  per sourceType -- `buildWhereFromConditions()` to an ArcGIS SQL where-clause for
  esriFeature, `buildPredicateFromConditions()` to an in-memory predicate for geojson),
  and `_zoomToFeature(id, selector)` (queries once, reuses the result for both the
  highlight layer and the bounds fit, for the table's row-click).
- `js/gis/gis-esri.js`'s `buildFeature()` now also returns `setFilter(where)`, a thin
  wrapper over esri-leaflet's own `FeatureLayer.setWhere()` -- confirmed live in the
  vendored bundle that this is a real, intentional API for exactly this ("filtering out
  data" by requerying and swapping the displayed feature set), not something to
  reimplement. `js/gis/gis-viewer.js`'s `buildGeoJsonLayer()` grew a matching
  `setFilter(predicate)` that toggles each feature's already-built sub-layer in/out of
  the `L.geoJSON` group by membership -- captured once at construction, no rebuild.
- **Deliberate departure from §7's illustrative state shape:** `getState().f` holds
  `{ layerId: [{field, op, value}, …] }` -- the condition list itself -- not a raw
  ArcGIS where-clause string as §7's example shows. A where-clause string is lossy to
  parse back for the geojson predicate path, and the spec itself flags the exact `f`
  shape as an example, not a contract ("Decide in Phase 3"). This round-trips exactly
  through `applyState()` for both sourceTypes.
- `js/gis/gis-tools.js`: the attribute table (`tools.attributeTable`) is a bottom
  drawer -- `.dts-gis-drawer`, deliberately not `.dts-gis-panel`, since §6 calls for it
  full-width at every viewport, not just as a mobile bottom sheet -- with one tab per
  queryable (`geojson`/`esriFeature`, `queryable !== false`) layer (tab strip hidden
  entirely for a single such layer). Sortable columns (click a `<th>`, `aria-sort`
  kept honest), a text filter box searching every shown column, row click →
  `_zoomToFeature` + highlight, "download visible rows as CSV" (the full filtered set,
  not just the current page), paginated at 200 rows per §6 with a status line naming
  the true total. Row set reflects both the text box and the layer's active
  query-builder filter (via a small `matchesConditions()` mirroring
  `buildPredicateFromConditions()`, kept local rather than shared -- this file never
  reaches into `gis-viewer.js` beyond the instance/`_`-prefixed seams).
- The filter/query builder (`tools.filter`) is a docked panel matching the layers/
  legend panels: a layer select, one or more field+operator+value condition rows
  (`+ Add condition`, ANDed), Apply/Clear. The active filter is always shown as a
  removable chip over the map (top-left, independent of whether either panel is open,
  per §6's "never invisibly on"), each chip clickable to clear that layer's filter on
  its own.
- **Real bug, found live, pre-existing in task 3.4's code (not introduced here):**
  the parish boundary dim mask's `buildParishMask()` called `boundaryLayerGroup
  .eachLayer(...)` directly on the boundary layer's built Leaflet object. That's fine
  for the `geojson` sourceType (a real `L.geoJSON`/`LayerGroup`), but confirmed live
  against the vendored esri-leaflet 3.0.19 bundle, `FeatureLayer` extends `L.Layer`,
  not `L.LayerGroup` -- `typeof L.esri.featureLayer({url}).eachLayer` is `"undefined"`
  (esri-leaflet's own source only ever calls it guarded, `this.eachLayer &&
  this.eachLayer(...)`, i.e. it expects this to be absent on some layer types). Since
  `sources.json` recommends `esriFeature` as the *primary* sourceType for the parish
  boundary layer itself, this meant the dim mask silently never rendered for the
  boundary config every future map is actually likely to ship with. Fixed by rebuilding
  `buildParishMask()` off the layer's `query({})` (the same seam this task added
  full-fetch support to) instead of its Leaflet object directly -- works for both
  sourceTypes uniformly via one throwaway `L.geoJSON()` conversion of the query result.
- **Second real bug, found live, also pre-existing (task 3.7's `highlight()`, not
  introduced here):** `L.geoJSON(fc, {style}).addTo(highlightGroup)` renders a Point
  feature with Leaflet's default blue marker icon -- `style` only touches path layers
  (lines/polygons); points need an explicit `pointToLayer`. Surfaced live via this
  task's row-click zoom-to-feature against the point fixture layer. Fixed with a
  shared `highlightGeoJson()` helper (used by both `highlight()` and the new
  `_zoomToFeature()`) that supplies a gold `circleMarker` `pointToLayer`, matching the
  site's styling instead of Leaflet's default pin.
- **Third finding, not a code bug:** an early version of the live test harness called
  `setFilter` unconditionally on every layer load (even with no filter set, to cover
  the "restore a filter from a share link before the layer finishes loading" case).
  Confirmed live this forces esri-leaflet's `FeatureLayer.setWhere()` to run an
  immediate full requery that races the layer's own just-started initial grid load
  against the same service. Fixed by only ever touching `setFilter` from `loadLayer`'s
  ready branch when a filter is actually pending (`applyPendingFilter()`); an ordinary
  first load leaves the layer's own default query alone entirely.
- Verified live in Chrome against real, CORS-verified Iberia Parish data (parish
  boundary + a local geojson point fixture standing in for a parcels-style layer,
  since the two real `esriFeature` candidates in `sources.json` -- boundary and
  hydrography -- don't give a numeric field to exercise sort/CSV against): both
  sourceTypes' attribute tables (system fields excluded, real ArcGIS field aliases for
  the boundary, `OWNER`/`ZONE`/`ACRES` for the fixture), column sort, the text filter
  box, row-click zoom+highlight (confirmed the marker-icon fix), CSV button (no
  console errors), the filter builder's layer switch/condition rows/Apply/Clear, the
  chip appearing and disappearing in sync with both the map (only matching points
  remained) and the table ("3 of 10" narrowing correctly), and `getState()`/
  `applyState()` round-tripping a filter through the console. Also incidentally
  confirmed no regression in 3.7's identify popups (Escape-to-close) during testing.
  One real ArcGIS service quirk found and *not* fixed, because there's nothing to fix
  in our code: the Iberia hydrography layer (`Hydrography/Laterals_and_Mains_2026`,
  sublayer 3) returns a genuine server-side `400 "Unable to complete operation"` for
  esri-leaflet's default combination of `resultType=tile`+`geometryPrecision=6` query
  params specifically on that service -- confirmed via direct `curl` isolation, not an
  artifact of this task's code. The engine's existing per-layer try/catch correctly
  degraded it to "Unavailable right now" without affecting the boundary or fixture
  layers, which is §11's contract working as intended; flagged here as a content/
  sourcing note for whoever finalizes `data/gis/maps/iberia-coastal.json` in task 3.14.
  Test harness and geojson fixture deleted before committing.

## GIS Phase 3 task 3.7 — identify and popups

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.7 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12.

- `js/gis/gis-viewer.js`: click handling, gated entirely by `mapDoc.tools.identify`
  (`false` attaches no listeners and makes no requests at all, not just hides the UI).
  Two paths, matching §6's split exactly:
  - **Vector layers** (`esriFeature`/`geojson`, `queryable !== false`): a `click` listener
    on the built layer itself, resolved instantly from the already-client-side feature --
    no network round trip. `L.DomEvent.stopPropagation` keeps it from also falling through
    to the map's background-click handler below.
  - **`esriDynamic`**: a raster image has nothing to attach a per-feature click to, so a
    single `map.on("click", …)` handler runs `identifyFeatures` (via the new
    `DTSGisEsri.identify()`) against every visible+ready+queryable esriDynamic layer in
    zoom range, in parallel, and combines the results into one event -- §6's "grouped by
    layer when several hit."
  - Both paths emit a new `"identify"` event -- `{latlng, containerPoint, hits:[{layerId,
    sublayerId, properties}]}` -- through the existing `on()`/`emit()` mechanism. This is
    an *addition* to §5's documented event set (`ready`/`viewchange`/`layerchange`/
    `tourstep`/`error`), same spirit as extending `DTS_CONFIG` rather than reshaping it,
    not a change to any existing event's shape.
  - Fires with `hits: []` on a genuine miss (not silently dropped), so gis-tools.js can
    dismiss a stale popup on every click, not just on ones that hit something.
- `js/gis/gis-esri.js`: `identify(def, map, latlng)` wraps `L.esri.identifyFeatures`, but
  reads the task's raw third callback argument (the untouched ArcGIS JSON) instead of the
  GeoJSON conversion, because each result carries its own true `layerId` (which sublayer
  actually matched) -- needed since one `esriDynamic` layer can have several sublayers
  with different schemas. `fetchFieldAliases(url, sublayerId)` fetches and caches
  `<service>/<sublayerId>?f=pjson` for the popup's "no `popup.fields` configured" fallback
  (§6: "show all non-system fields with their ArcGIS aliases") -- the same per-service
  caching idea the legend fetch in gis-tools.js already uses, and it works unchanged for
  both `esriDynamic` (using the sublayer id the identify response reported) and
  `esriFeature` (using the layer's own static `layerId`).
- `js/gis/gis-tools.js`: builds and positions the popup itself -- **a plain absolutely-
  positioned div, not a Leaflet popup object.** It only needs `containerPoint` (already
  relative to the map container this module owns the overlay for) and never needs the map
  or `L`, keeping identify on the same "no Leaflet objects here" footing as the rest of
  the file. Trade-off, deliberate: it doesn't track the map on pan/zoom -- it closes on
  the next `viewchange` instead of repositioning, which is simpler and matches how most
  identify popups behave anyway. Also: system-field filtering (`OBJECTID`/`Shape*`/
  `GlobalID` pattern), `popup.title`'s `{field}` template, `format:"number"` + `suffix`
  value formatting, grouped-by-layer sections, close button, Escape-to-close, and focus
  move-in/restore-on-close per §10.
- `css/15-gis.css`: popup styling (dark glass, gold hairline, gold-bright section
  headers), continuing the tokens from 3.5/3.6.
- Verified live in Chrome against real Iberia Parish data: a real `esriFeature` click
  (Iberia Parish boundary attributes, field aliases fetched with no `popup.fields`
  configured), a real `esriDynamic` background click (FEMA BFE/floodway attributes,
  multiple fields, scrolling body), a `geojson` layer with `popup.fields` configured
  (confirmed the `{name}` title template and `format:"number"`+`suffix` -- `"128.4 ac"`)
  stacked correctly above the boundary layer by `zIndex`, the close button, Escape,
  pan-to-close, and that focus lands on the close button on open. Console clean throughout.
  Test harness and geojson fixture deleted before committing.

## GIS Phase 3 task 3.6 — layer panel, legend, basemap switcher

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.6 / `04-SPEC-gis-engine.md` §6. Nothing
wired into `index.html`/`app.js` yet -- still task 3.12.

- `js/gis/gis-tools.js` (new) -- `window.DTSGisTools.mount(containerEl, mapDoc, instance,
  opts)`: a toolbar (top-right) with toggleable Layers/Legend panels and an inline
  basemap `<select>`, gated by `mapDoc.tools.layerPanel` / `.legend` / `.basemapSwitcher`.
  Desktop: docked panels. Mobile (`max-width:760px`, matching the site's existing
  breakpoint): bottom sheets.
  - **Layer panel**: grouped by `mapDoc.groups` (open/closed per the doc), per-group
    show-all/hide-all, per-layer checkbox + expandable detail (description, attribution,
    updated date, opacity slider, zoom-to-extent). A layer whose `status` goes
    `"unavailable"` shows "Unavailable right now" in place of controls; a layer outside
    its `minZoom`/`maxZoom` greys out with "Zoom in to see this layer" -- both driven
    live off `viewchange`/`layerchange` events, not polled.
  - **Legend**: rebuilt from currently-visible layers only. `legend.mode:"custom"` renders
    `legendItems` directly; `"auto"` fetches `<serviceUrl>/legend?f=pjson` for esri layers
    (cached per URL) and filters to the layer's own sublayer id(s), falling back to a
    single swatch from `style.color` for geojson/tileXYZ/wms or a failed fetch.
  - **Basemap switcher**: a native `<select>` (keyboard/mobile-friendly by construction,
    no custom listbox needed) kept in sync via `getState()` at mount and the `layerchange`
    `{type:"basemap"}` event afterward.
  - State model is seeded from `instance.getState()` + the static `mapDoc` defaults and
    kept current purely off `viewchange`/`layerchange` events -- gis-tools.js never reads
    a Leaflet object or reaches into gis-viewer.js's closure.
- `js/gis/gis-viewer.js`: adds one narrow, deliberately-not-public method,
  `instance._getLayerBounds(id)`, for the zoom-to-extent button -- returns a `Promise` of
  plain `[[south,west],[north,east]]` or `null`. Not part of §5: the tour/CMS boundary
  stays Leaflet-object-free, but zoom-to-extent has no honest answer through ArcGIS
  service metadata alone (extents come back in the service's native SR -- State Plane for
  both Iberia servers per `data/gis/sources.json`, not WGS84, and reprojecting by hand is
  out of scope).
- **Real bug found only by live testing, now fixed:** a first version of
  `_getLayerBounds` assumed esri-leaflet's `FeatureLayer.getBounds()` was async
  (`callback(err, bounds)`, querying the service for the real full extent). Live testing
  showed otherwise: the vendored esri-leaflet 3.0.19 `FeatureLayer` and `DynamicMapLayer`
  implement no `getBounds()` at all (`typeof` is `"undefined"`, not a function of either
  arity). Zoom-to-extent is therefore only ever available for the `geojson` sourceType's
  plain `L.geoJSON` layer, which has the ordinary synchronous Leaflet `getBounds()` --
  confirmed by adding a temporary local geojson fixture layer and watching the map
  actually fly to its bounds. `_getLayerBounds` still returns a `Promise` (always
  immediately resolved) so this seam has one stable async contract regardless of which
  sourceType built the layer, rather than a sync/async split only one branch of which is
  ever real. For esri layers the button now honestly reports "Extent isn't available for
  this layer yet" rather than silently doing nothing.
- `getState()`'s `l` map only lists layers that differ from their `mapDoc` default (per
  `04-SPEC §7`), so gis-tools.js seeds its own visible/opacity state from
  `mapDoc.layers[i]`'s defaults whenever a layer id is absent from `getState().l`, rather
  than treating absence as "unknown."
- `css/15-gis.css`: extended with the tool-panel chrome (toolbar, panels, groups, layer
  rows, legend rows) styled to the same tokens as task 3.5's Leaflet-chrome pass. These
  are the project's own elements, not Leaflet's, so (unlike 3.5) there's no
  injection-order specificity race to guard against -- plain `.dts-gis-tools`-prefixed
  selectors are enough here.
- Verified live in Chrome against a temporary, not-committed test harness (same pattern as
  3.5) mounting real Iberia Parish boundary + hydrography `esriFeature` layers, a
  deliberately-nonexistent `esriFeature` URL (confirmed it degrades to "Unavailable right
  now" without affecting the other layers), and a local geojson fixture: group
  expand/collapse, per-layer checkbox/opacity/zoom-to-extent, zoom-range greying, legend
  swatches (both the real ArcGIS `data:` image swatches and the style-color fallback),
  live basemap switching, the `max-width:760px` mobile bottom sheet, keyboard reachability
  with visible gold focus rings, and a clean console. Harness and fixture deleted before
  committing.

## GIS Phase 3 task 3.5 — map chrome

Per `docs/plans/gis/09-BUILD-PLAN.md` task 3.5. CSS-only; nothing new is wired into
`index.html`/`app.js` yet.

- `css/15-gis.css`: restyles Leaflet's default white/boxy chrome to the site's dark/gold
  tokens — the zoom control bar, popups (content wrapper, tip, close button), the
  attribution control, and the scale bar — plus visible `--gold-bright` focus rings on
  every control and link (04-SPEC §10). `index.html` links it last in the stylesheet
  order, after `14-intro.css`.
- `js/gis/gis-viewer.js`: `createInstance()` now adds a `dts-gis-map` class to the mount
  container (removed again in `destroy()`) so `15-gis.css` has something to scope to.
  Also adds `L.control.scale()` on mount — the scale bar is always-on map chrome per
  04-SPEC §6, not a gated tool, so it belongs with the other init-time controls rather
  than waiting for `gis-tools.js`.
- **Real bug found and fixed by live testing, not by inspection alone:** every selector
  in `15-gis.css` is anchored on the compound `.dts-gis-map.leaflet-container` (both
  classes, no space), not plain `.dts-gis-map`. `js/gis/gis-loader.js` injects
  `leaflet.css` into `<head>` lazily, *after* this file, and several of Leaflet's own
  rules (`.leaflet-container a`, `.leaflet-container .leaflet-control-attribution`,
  `.leaflet-container a.leaflet-popup-close-button`) match at the exact same
  specificity as a plain `.dts-gis-map` equivalent — a tie that source order decides,
  and Leaflet loads later. A first pass of this file used plain `.dts-gis-map` and
  silently lost every one of those ties (link color, attribution background, close
  button color all stayed Leaflet's defaults) until a live check caught the zoom
  control showing the browser's default blue focus outline instead of gold.
- Verified live in Chrome against a temporary, not-committed test harness mounting
  `DTSGis` with the real, CORS-verified Iberia Parish boundary layer
  (`Govt_Units/Updated_Parish_Boundary`) from `data/gis/sources.json`: zoom control,
  scale bar, attribution, and a sample popup all render in the site's dark-glass/gold
  language; keyboard `Tab` shows the gold focus ring on the zoom control; console clean.
  Harness deleted before committing, same pattern as prior phases' temporary test data.

## GIS Phase 3a — map engine and layer sources

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 3 tasks 3.1-3.4 / `04-SPEC-gis-engine.md`.
Phase 3 is split into several commits per the plan; this is the first ("map engine and
layer sources"). No wiring into `index.html`/`app.js` yet -- that's task 3.12
(`mountGis()` in the switcher), still to come. Vendoring vs CDN (04-SPEC §2) was
confirmed with the human before starting.

- `vendor/leaflet/`: Leaflet 1.9.4 + esri-leaflet 3.0.19, SHA-256-verified against
  jsdelivr's package metadata; versions/hashes/licenses in `vendor/leaflet/README.md`.
- `js/gis/gis-loader.js`: idempotent `DTSGisLoader.load()` -- injects the vendored
  CSS/JS only on first call, rejects cleanly (not a hang) on failure. Verified a plain
  page load makes zero `vendor/`/`gis` requests.
- `js/gis/gis-viewer.js` -- `window.DTSGis`: map init, view/bounds (`maxBounds` +
  `restrictToBounds`), basemaps (`tileXYZ`, `esriImage`), the layer factory dispatcher,
  the parish boundary dim mask, and the full §5 public API (`setView`,
  `setLayerVisible/Opacity`, `setBasemap`, `highlight/clearHighlight`, `startTour/
  tourNext/tourPrev/exitTour`, `getState/applyState`, lifecycle, `on`).
- `js/gis/gis-esri.js` -- `window.DTSGisEsri`: `buildDynamic` (esriDynamic, image
  overlay, no client query) and `buildFeature` (esriFeature, with a `query()` that
  carries the parish envelope per §8 defence 2). `esriImage`/`geojson`/`tileXYZ`/`wms`
  are simple enough to build inline in `gis-viewer.js`.
- Each layer builds independently and asynchronously into the registry so one slow or
  broken source never blocks the map or the others (§11); a `requesterror` listener on
  each esri-leaflet layer catches runtime fetch failures, since those surface as an
  event, not a constructor throw, as an earlier version of this code assumed. Layers
  outside their declared zoom range are removed from the map on `zoomend`, not just
  hidden (§9).
- Parish boundary dim mask (§8 defence 3): once the `mapDoc.boundary.layerId` layer
  loads, its real ring geometry (recursively flattened from Polygon/MultiPolygon
  `getLatLngs()`) becomes the hole in a world-covering `evenodd`-fill donut polygon, in
  its own pane above ordinary data layers. Independent of that layer's own visibility
  toggle -- the mask is static map chrome, not a togglable layer.
- **Design departure from the spec, deliberate:** `startTour`/`tourNext`/`tourPrev`/
  `exitTour` are fully implemented in `gis-viewer.js` now (applying each step's
  `view`/`layers`/`highlight` per `05-SPEC-guided-tours.md §1`), not left as stubs for
  the later guided-tours phase. Re-read that spec to get the step schema right first.
  The rationale: §5 says the tour player "drives the map exclusively through this API,"
  which reads as the engine owning step application and the player (a later phase)
  owning presentation only (card UI, keyboard, off-script pill, autoAdvance timing).
- Verified live in Chrome against real, CORS-verified Iberia Parish ArcGIS services
  (not synthetic fixtures): all six `sourceType`s build and render; a bad service URL
  and an unsupported `sourceType` both degrade to "unavailable" without affecting other
  layers; bounds/zoom-range enforcement, state round-trip, and the dim mask all checked
  against the real parish boundary layer. Found and fixed two real bugs this way before
  they shipped: esri-leaflet's `FeatureLayer` has no `layerId` option (the sublayer id
  must be part of the URL, or every query silently hits the wrong endpoint), and
  animated `setView` calls stall in this session's automated-Chrome test harness
  (confirmed as a harness/rAF-throttling artifact, not a product bug, by reproducing it
  against bare Leaflet with no DTSGis code involved).

## GIS Phase 2 — the tabbed stage

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 2 / `03-SPEC-multi-experience.md §3-5`.

- `index.html`: `#exStageTabs` (tablist) and `#exStageSlot` (mount point) added
  inside `#exampleStage`, as siblings of the existing loading veil and seam.
- `css/06-example-window.css`: `.example-stage` is now a column flex container;
  `.example-stage iframe` narrowed to `.example-stage-slot iframe`, plus an
  explicit `[hidden]` override (author CSS otherwise beats the UA `[hidden]`
  rule, so a suspended-but-not-removed iframe would keep rendering); tab strip
  styles; a placeholder style for the not-yet-built GIS pane. Checked
  `08-responsive.css`, `09-mobile.css`, `11-desktop.css` — none had a
  conflicting `.example-stage iframe` selector to update.
- `js/app.js`: `showExperience()`/`activeExperience()` switcher,
  `mountTreedis()`/`mountVideo()`/`mountSharedShowcase()`/`mountGis()` (the last
  a placeholder — the real GIS engine lands in a later phase),
  `suspendExperience()`, `syncStageTabs()` with a full keyboard-operable
  tablist (roving tabindex; arrows move focus, Home/End jump, Enter/Space
  activates), delegated so rebuilding the tab buttons doesn't cost re-wiring.
  `exampleMediaUrl()`/`exampleOpenUrl()` replaced per spec §3.4;
  `currentURLParams()`/`applyStateFromURL()`/`restoreInitialStateFromURL()`
  carry `&exp=` (only emitted for 2+ experiences); tab switches use
  `replaceState`, never `pushState`.
- **Design departure from the spec, deliberate:** each experience gets its own
  persistent iframe (`exampleMediaFrame-<expId>`), not one `#exampleMediaFrame`
  reused across a project's tabs. A project mixing a Treedis tour with a video
  would otherwise fight over one iframe's `src` — reassigning it on every tab
  switch would force the tour to reload and re-run the TourBridge handshake on
  every return visit, which fails the phase's own "no reload on switch back"
  acceptance criterion. Suspending hides a tour's frame (never reloads it) and
  blanks a video's `src` (actually stops its audio).
- **Scope decision, confirmed with the user:** skipped the spec's proposed
  optimization of borrowing the shared showcase iframe whenever an
  experience's `tourUrl` happens to match `cfg.treedis.tourUrl`. One live
  project (Properties & Places) has exactly that match with a null `sweepId`;
  borrowing would make it show whatever pose the shared iframe already has
  instead of a deterministic fresh load, breaking this phase's own
  byte-identical-for-legacy-projects criterion. Every experience with its own
  `tourUrl` always gets its dedicated frame, matching today's behavior
  exactly. Revisit as a deliberate, separately-tested change later if wanted.
- **Deferred, not done:** the spec's optional `:has(.example-stage-tabs)`
  stage-height growth for 2+ experience projects — needs matching overrides in
  both `08-responsive.css` and `11-desktop.css` to actually win at every
  breakpoint (source order means only touching `06` has no effect at
  desktop width), out of proportion for a cosmetic nicety with zero real
  multi-experience content until Phase 6. The tab strip still renders inside
  today's stage height with no clipping, just a slightly shorter slot.
- Verified live in Chrome (`python -m http.server 8000`): temporarily gave the
  `energy` project a second (video) experience per the spec's own suggested
  test step, confirmed the tab strip, tab switching, keyboard operation (found
  and fixed a real bug here — rebuilding the tab buttons on every switch was
  dropping keyboard focus to `<body>`; `syncStageTabs()` now re-focuses the new
  active tab when the strip owned focus), `&exp=` deep links, single-step
  browser back after several tab switches (confirms `replaceState`), and — via
  the console — that switching a Treedis tab away and back fires no new
  `TourReady`. Reverted the test data before committing. Also spot-checked a
  legacy single-experience project (`campus`) renders with no tab strip and no
  `&exp=` param, and that "Try a Digital Twin" still opens/closes cleanly.

## GIS Phase 1 — multi-experience schema and loader

Per `docs/plans/gis/09-BUILD-PLAN.md` Phase 1 / `03-SPEC-multi-experience.md §1-2`.
No UI change — loader/schema only.

- `js/content-loader.js`: added `projectExperiences(p)` (normalises a project's
  `experiences[]` or legacy `media` into a uniform list) and `convertExperience(m, i)`
  (replaces `convertMedia()`; adds a `gis` branch alongside `treedis`/`video`, still drops
  unknown `_type`s silently).
- `buildConfig()`'s project loop now sets `ex.experiences = projectExperiences(p)
  .map(convertExperience).filter(Boolean)` and keeps `ex.media` as a live alias to
  `experiences[0]` — every existing `ex.media` reader in `js/app.js` keeps working
  unchanged.
- `buildConfig()` now also loads `gisMap`/`gisTour` documents straight through into
  `cfg.gisMaps`/`cfg.gisTours`, keyed by id — a deliberate exception to the flattening
  convention; the GIS engine (Phase 3) reads its own schema directly.
- `data/manifest.json`: added the (currently empty) `gis` document group.
- `js/config.js`: structural sync only — added empty `gisMaps`/`gisTours`.
- Verified against real `/data` content with a Node-based replay of `buildConfig()`
  (browser extension unavailable this pass): all 16 existing projects produce
  behaviorally identical `media` (`type`/`tourUrl`/`embedUrl`/`watchUrl`), and
  `energy.experiences` is the expected one-item array. A live in-browser console/UI
  check (`python -m http.server 8000`) is still recommended before Phase 2 starts.

## GIS Phase 0 — source verification and CORS spike

No production code; research only, per `docs/plans/gis/09-BUILD-PLAN.md` Phase 0.

- CORS spike: both `maps.iberiagov.net` and `cimsgeo3.coastal.louisiana.gov`
  return permissive, origin-reflecting CORS headers on real `/query` and
  `/exportImage` calls — `esriFeature` can be the default sourceType on both
  servers, not just the `esriDynamic`/harvest fallback.
- Enumerated both ArcGIS service trees; catalogued candidate layers for the
  Boundaries/Water/Flood/Infrastructure/Coastal-projects/Coastal-change/Imagery
  groups in `08-SPEC-gfc-project.md`'s composition table.
- Confirmed MPDV runs on MapLibre GL JS with vector tiles (not ArcGIS image
  export) — resolves the scope question flagged in `07-SPEC §C`/`04-SPEC §2`.
- Transcribed MPDV's 10-step guided tour via static bundle analysis (no live
  browser session available this pass — visual/interaction details still need
  a live spot-check before Phase 4).
- Derived the parish's WGS84 envelope and an approximate centroid from
  `Govt_Units/Updated_Parish_Boundary`.
- Flagged five open items needing a human, not more automation: Iberia/CPRA
  terms-of-use confirmation (no published ToS found for either), manual
  retrieval of the robots.txt-blocked parish factsheet, and product-level calls
  on the Parcels and Nursing-Homes layers (real PII / vulnerable-population
  sensitivity respectively).
- Output: `data/gis/sources.json` (committed) and `docs/GIS-DATA-SOURCES.md`
  (gitignored, local reference only — `docs/` is excluded from this repo).

## Code reorganization (maintainability pass)

No functional changes. The site behaves exactly as before.

- Moved all JavaScript into `js/` and renamed for clarity:
  `script.js → js/app.js`, `dts-clients.js → js/clients.js`,
  `dts-tour-bridge.js → js/tour-bridge.js`; `config.js`,
  `smoke-depth.js`, and `vision-pro-spatial.js` moved as-is.
- Split `styles.css` into 12 ordered files under `css/`
  (`01-base.css` … `12-smoke.css`). Files load in numeric order and
  later files intentionally override earlier ones, preserving the
  original cascade exactly.
- `index.html` updated to load the new stylesheet and script paths;
  all markup, IDs, and asset references are unchanged.
- Comments rewritten across all files to be short and professional;
  references to internal design files and iteration history removed.
- New `README.md` for developer onboarding.
- All referenced imagery consolidated into `assets/`; HTML/CSS paths
  updated accordingly.

## Hex-cluster alignment fix

- `.hex` aspect ratio corrected to `1/0.8660254` (true regular
  flat-top hexagon) so diagonal edges sit at exactly 60°.
- Positions recomputed for exact edge contact between different-width
  neighbours; residual joint gap is sub-pixel.
- Base unit enlarged: `--hexu` is now `clamp(132px,12.5vw,360px)`
  (tablet breakpoint scaled to match).

## Content pass — real projects, live experiences, and videos

Populated all 16 sub-vertical example windows from the project link
inventory and the DTS portfolio.

- New per-example fields in `config.js → examples`:
  - `media` — the window's main experience pane (`treedis` tour or
    `vimeo` embed).
  - `links` — related tours/videos shown as "More from this project".
  - `gallery` — real project imagery in `assets/portfolio/`.
  - `capturedWith` / `platform` — accurate chips per project.
- Three formerly illustrative windows now carry real projects:
  Healthcare Training, Healthcare Facilities, Sustainability.
  Heritage remains illustrative; Safety & Emergency has copy but no
  inventory media.
- `openExample` loads the example's own media into a dedicated
  `#exampleMediaFrame` (torn down on close so video stops); the
  shared showcase iframe + sweep navigation remain the fallback.
  "Enter Twin" and the open-in-tab button target the active
  example's own tour/video.
- Only public/unlisted links are used; private, inactive, and
  sensitive items were excluded. Unlisted Vimeo links embed with
  their `h=` hash; non-embeddable share slugs appear as external
  links only.
- New brand motto ("The World as Interface") and expanded
  question-bar prompts/answers.

## Desktop layout pass (1920×1080, holds 1024–1920)

- Sector copy aligned across all four categories; new sub-verticals
  Healthcare Facilities (Industry) and Civic Services (Government);
  `navSub` and dock `short` labels added.
- Home: evidence row restyled (spread layout, gold dots); light
  question bar; light cookie card. The hexagon cluster and
  arrow-burst CTA remain unchanged.
- Contact panel: plain centred desktop layout with uppercase CTAs.
- Access Your Twin: wide desktop popup — brand block left, form
  card right.
- Example window: near-fullscreen layout with gold CTAs, chip rows,
  PROJECT EVIDENCE band, media mosaic, "More from {Sector}" cards,
  back-to-top FAB.
- Projects window: full-screen mosaic. Client portal: desktop shell
  with horizontal nav, asymmetric HOME tile grid, 3-up APPS grid.
- Tokens: `--bg #070E18`, `--bg-2 #0A1525`, `--gold #C49A2A`.

## Mobile layout pass (360×780, holds 320–480)

- Sector accents unified: education `#E9B44C`, industry `#2E8BFF`,
  government `#34598F`, community `#D27049`.
- Nav drawer: left slide-in panel listing the four sectors; the
  active item is a full-width accent bar.
- Home hero: hexagon cluster and evidence bullets now shown on
  phones; light question bar with quoted rotating placeholder.
- Category screens: sector-named "VIEW {SECTOR} PROJECTS" button,
  right-edge "Contact & Info" tab, dock-tab rail, sector pager.
- New sector projects window and post-login client portal (HOME
  tiles, All APPS cards, tile menu).
- Contact panel: centred PLAN / PROPOSE / PILOT steps. Lead-form
  modals rebuilt with paired fields and uppercase gold submits;
  success state is the "REQUEST SENT" toast.
- Access Your Twin rebuilt as the "Welcome Back!" login; the demo
  directory was repopulated (`demo` / `1234`).

## Initial wiring pass

- Fixed the boot crash (config global renamed to `DTS_CONFIG`).
- 16 example windows populated (overview + example project +
  evidence tabs + CTAs); three flagged as illustrative.
- Access Your Twin sign-in + dashboard added (Google Sheet directory,
  see `js/clients.js`).
- Question bar answers the FAQ prompts inline.
- Evidence filters open the active sector's lead example focused on
  that proof type.
