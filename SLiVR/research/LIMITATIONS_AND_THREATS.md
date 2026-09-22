# Limitations and threats to validity register

| ID | Category | Current threat or limitation | Affected claim/feature | Mitigation or evidence needed | Status |
|---|---|---|---|---|---|
| L001 | Construct | Time and click counts do not alone represent scouting quality | RQ1; F01–F06 | Combine task metrics with completeness, evidence and qualitative rationale | Open |
| L002 | Construct | Confidence may increase despite incomplete or stale immersive coverage | RQ2/RQ4; F02–F04, F19 | Measure confidence calibration and unsupported assumptions; show capture limits | Open |
| L003 | Internal | Learning and novelty may favor the integrated/immersive condition | RQ1–RQ3 | Counterbalance, equalize training and record prior tool/VR experience | Future study control |
| L004 | Internal | Provider latency/failure can be mistaken for interface usability | F03, F20 | Log normalized provider state and analyze technical failures separately | Phase 0/2 validation |
| L005 | Internal | Developer/researcher involvement may influence facilitation or coding | All participant studies | Standardize scripts; use independent/blinded rating where practical; disclose roles | Future protocol |
| L006 | External | Seventeen Lafayette records may not represent other regions or production types | RQ1–RQ5 | Bound claims to the pilot and replicate with other geographies/scene briefs | Open |
| L007 | External | Film students, professionals and general users may use the tool differently | RQ6 | Define target population; report expertise; avoid unsupported generalization | Future protocol |
| L008 | Ecological | Standardized tasks may omit real negotiations, time pressure and team coordination | RQ1/RQ3 | Follow controlled work with expert and longitudinal field evaluation | Later evaluation |
| L009 | Spatial validity | Aerials, floor plans and 360 captures may be approximate, outdated or incomplete | F01–F04, F08–F12 | Preserve date/provenance/calibration state; compare selected judgments on site | Phase 0 onward |
| L010 | Measurement | Creative shot quality lacks a single objective ground truth | RQ3 | Use predefined multidimensional expert rubric and report rater agreement | Future protocol |
| L011 | Measurement | Interaction logging can miss reasoning and alter behavior | All logged studies | Use minimal logging with interviews/think-aloud when appropriate; disclose instrumentation | Future protocol |
| L012 | Conclusion | Small samples may produce unstable subgroup or significance estimates | RQ1–RQ6 | Justify sample plan, emphasize effect uncertainty, limit exploratory claims | Future protocol |
| L013 | Reproducibility | External Treedis/Google/DOTD services can change independently of the artifact | F01, F03, F08, F19 | Record provider/service/capture versions and fallback state; retain allowed manifests | Phase 0 onward |
| L014 | Privacy | Free text, screenshots or precise poses may reveal private production intent | Study mode | Minimize fields, require protocol justification, controlled storage and redaction | Required before collection |
| L015 | Accessibility | Desktop/tablet findings may not generalize to phone, headset or assistive setups not tested | F20 | Report tested configurations; evaluate deferred modes separately | Open |
| L016 | Authorization/security | Reverse proxying and changing Treedis response headers/content may conflict with provider/content-owner terms or security expectations | F21 | Prefer supported interfaces; require documented authorization and institutional security review before deployment | Phase 6 prerequisite |
| L017 | Privacy | Head/controller/hand trajectories can be behaviorally identifying despite a random session ID | F21 | Treat as pseudonymous/sensitive; minimize rate/fields; separate identity; restrict access/retention; document infrastructure logs | Phase 6 prerequisite |
| L018 | Instrumentation | Wrapping WebXR calls/frame callbacks can change timing, fail after runtime updates or bias the behavior measured | F21 | Test call transparency and performance against baseline on each approved device/runtime; log self-disable/loss; fail closed for research | Phase 6 validation |
| L019 | Reproducibility | Treedis and browser/headset updates may change object handles, events, rendering or reference-space behavior | F21 | Freeze/report versions; run compatibility suite before each study window; preserve manifests and synthetic fixtures | Open |
| L020 | Experimental validity | Active manipulation may change more than the intended stimulus or expose condition assignment | F21 manipulation | Use named/versioned operations, manipulation checks, counterbalancing, rollback and record-only comparison | Future protocol |
| L021 | Reproducibility | The published catalog is generated from a workbook that is deliberately kept out of version control, so the exact source of a catalog version cannot be recovered from the repository alone | F01, F02, F19 | Record catalog version, research snapshot date and the regeneration digest with every result; keep an independent archived copy of each workbook revision used to build a released catalog | Open |
| L022 | Spatial validity | The scene coordinate frame is a tangent-plane approximation whose error grows with the square of the distance from the origin, and most catalog coordinates are geocoded approximations rather than surveyed positions | F08-F12, F01 | Flag conversions beyond the declared validity radius; display coordinate provenance; never present a scene measurement as surveyed geometry | Mitigated in part for Phase 0.1: the frame flags out-of-range conversions and every coordinate carries its provenance string |
| L023 | Reproducibility | Workspace persistence is evidenced by an in-memory test double rather than a browser IndexedDB implementation, so quota behaviour, durability across a reload, and cross-browser differences in transaction and upgrade semantics remain unverified | F20; tests 16, 17, 21 | Execute tests 16, 17 and 21 in each supported browser and record the observed database, stores, indexes and failure behaviour separately from the automated evidence | Open |
| L024 | Reproducibility | The workspace lives in one browser profile on one device, so a research session cannot be reconstructed from the artifact alone unless the participant or facilitator exports the project JSON | F20; any study using the prototype | Require a project JSON export at the end of every recorded session and store the envelope with its `catalogVersion`, `appVersion` and `exportedAt`; treat a session with no export as unreconstructable | Open |
| L025 | Construct | The unknown-vocabulary guard in the catalog validator fires only when the markers disappear from the catalog as a whole, so a coercion confined to a single field would pass it | F02; tests 9, 13, 40, 42 | Continue asserting specific verbatim values per record in `tests/catalog.test.mjs`, and add a per-field comparison against the workbook projection when the dossier renderer lands in Phase 1 | Open |
| L026 | Spatial validity | The configured top zoom level requests about 0.064 m per pixel while both imagery services hold about 0.150 m, so the sharpest view a person can reach is an upsample rather than new detail, which can suggest more certainty about small features than the imagery supports | F01, F08-F12 | Warned on by `validateRegionImagery`; decide during the manual browser pass whether to lower `maxZoom`, and never present a zoomed view as evidence of a feature smaller than the source resolution | Open |
| L027 | Reproducibility | Imagery coverage was confirmed at one representative location per operational area, not across each area, and the services can be reflown or withdrawn at any time | F01; test 22 | Re-run `tools/probe-imagery.mjs` before each study window and keep the dated report with the result; treat a changed verdict as a provider change rather than an artifact change | Open |
| L028 | Measurement | Pixel statistics come from a lossless BMP rendering, while the browser is served JPEG, so the probe does not measure exactly the bytes a participant sees | F01; test 22 | Compare the production JPEG status, type, size and timing in the same run, as the probe already does, and treat a large divergence in size as a reason to look at the rendered tile | Open |
| L029 | Internal | The boot smoke check exercises the shell against a DOM stand-in with no layout, styling, focus handling or real event dispatch, so it can pass while the interface is unusable on screen | F20; tests 14, 15 | Treat it as a startup and wiring check only; keep its results recorded as automated evidence and decide tests 14 and 15 on the live browser pass | Open |
| L030 | Construct | Capture date, coverage extent and reuse rights are unknown for all 11 supplied immersive entries, so any judgement made from a capture rests on material of unknown age and completeness | F03, F04, F19; RQ2, RQ4 | Retrieve the metadata through the administrative access the content owner holds, and until then keep the unknown visible wherever a capture is presented; never let capture age be inferred from the catalog snapshot date | Open |
| L031 | Reproducibility | The optional photorealistic 3D context is evidenced only through injected responses and the no-credential path, because no key has been supplied, so its behaviour under a real quota, a real referrer restriction and real network latency is unverified | F08; test 26 | Exercise the available, denied and slow paths once a referrer-restricted key exists, and record the key's restriction and the date; never let a study depend on this provider | Open |
| L032 | Internal | Absence of an embedding-refusal header is being used as early evidence about the provider, and it is weak: the page can refuse in script and the viewer can fail inside a cross-origin frame for reasons no header predicts | F03; tests 28, 29; architecture risk B1 | Treat embedding as `unknown` until the browser harness observes a viewer running in the frame, and re-run the header probe alongside every harness run so a provider change is visible | Open |
| L033 | Internal | The viewer loads in the frame and begins booting, then fails to fetch its own tour data: observed 2026-09-20 on `#/immersive/LOC-003`, every `api.treedis.com` call from the viewer document was refused with 403 and no `Access-Control-Allow-Origin` header, including the public sweep and tour endpoints. The refused requests originate from the provider's own page, not from SLiVR, so no change to the embedding code has been shown to affect them. Whether the same entry succeeds in a top-level tab has not been observed, so it is not yet known whether this is a property of embedding, of the account, or of the provider at that moment | F03, F04; tests 28, 29; architecture risk B1 | Open the same entry URL in a top-level tab and compare. If it succeeds there and fails in the frame, the cause is third-party context and the remedies are provider-side (CORS and cookie attributes) or a different host; if it fails in both, the cause is the provider or the account and no client change will fix it. Acted on 2026-09-20 (D052): the catalog now records the host the working reference project embeds, with the primary kept as a configured alias and selectable through the `viewerOrigin` diagnostic, so the two can be compared without editing the catalog. That is a change of configuration, not evidence. This stays open until a capture is observed rendering, and it closes as resolved only if the new host renders where the primary did not | Open |

| L034 | Internal / verification | The 305-test baseline passed while initial SCSU-style navigation was absent, load could override readiness, sibling frames could spoof messages, shared entries reloaded, and real imagery events bypassed failover. An unbounded iframe load and Stop waiting remount also escaped existing checks | F01, F03, F20; test 184's earlier Phase 0 comparison is not evidence that these paths worked | New tests 185–199 preserve concrete failure outputs and corrections. Fourteen checks failed before their corresponding correction; test 198 is additional integration coverage. Test doubles still cannot establish rendered behavior | Client regressions mitigated in `treedis-recon-2`; browser verification open |
| L035 | Reproducibility | No browser was connected for the 2026-09-20 reference repair. Browser discovery returned an empty list and Chrome and in-app browser creation both returned `Browser is not available` | F03; L033; tests 28, 29, 50–53, 175 | Reconnect a supported browser and compare the same Lafayette entry in SLiVR and a top-level tab; verify all 11 entries, shared downtown switching, Magnolia and a non-downtown capture. Preserve console/network output if data still fail | Open; the earlier API 403 was not reproduced and is not claimed fixed |

Add threats when discovered; do not delete resolved entries. Change status to `Mitigated for {version/study}` and link the evidence while retaining the original limitation.


### 2026-09-20 ? Optional 3D deployment correction (D057)

The initial deployment's 3D button only tilted raster imagery and must not count
as evidence of rendered exterior geometry. The replacement adapts the reference
renderer but has no live Google-rendering evidence yet. Shared-origin key reuse
was requested by the owner; provider acceptance, quotas and coverage remain
unverified. The owner will test after publication. Placements against streamed
geometry remain approximate and are not surveyed measurement evidence.


### Phase 0 closeout evidence limits, 2026-09-20

Automated regression is 326/326 PASS, using IndexedDB/DOM/provider doubles where
stated. Owner manual acceptance supplies actual deployed-use evidence, with a
Three.js screenshot but no raw all-entry capability report or exact browser
version. Full linked fixture/store inspection in a real browser, remaining
failure/device variants and capture metadata/rights remain unverified. Precise
retest conditions and proposed acceptance exceptions are in PHASE_0_CLOSEOUT.md;
these exceptions are not approved merely because technical checks pass.


### Approved Phase 0 evidence exceptions - 2026-09-20 (D061)

The owner approved carrying the explicitly listed evidence gaps while closing
Phase 0. Required retests: storage/schema/full fixture at the first Phase 1 browser
integration before persistence expansion; device/provider/console variants on
next deployment; per-entry Treedis reports and administrative metadata before
Phase 2 dependent features/claims. Approval changes phase acceptance only and
does not resolve these limitations or establish unobserved capabilities.


### D062 map presentation limits

The geographic spread of the inventory and the available viewport constrain the
closest zoom that can show every pin. Exact-position grouping follows six-decimal
coordinates; distinct nearby points can still overlap at a broad inventory scale.
Do not claim proximity clustering or improved usability from the implementation.
Live resize, marker legibility, touch/keyboard interaction and screen-edge expanded
arrays require the next deployment's visual/device check.

### D063 map UI limitations

MapLibre/DOM doubles verify control actions, not rendering. Check the expanded
controls, location strip, attribution, imagery plate and edge pins on desktop,
portrait and landscape after deployment. Test geolocation allow/deny/unavailable,
fullscreen enter/exit, 3D loading/fallback and OSM availability. The streets layer
is a translucent OSM raster, not isolated labels or authoritative property data.
Native fullscreen availability depends on browser support. Campus welcome/exit
and recruitment-specific itinerary UI are not SLiVR features; catalog navigation
uses existing records. No geolocation is collected in research logs.

### D064-D065 evidence limits

Fourteen map-pin coordinates (13 corrections plus new LaSEL) come from the project
owner on 2026-09-20, not a geodetic survey or independent entrance verification.
LaSEL official sources establish facility identity and address; current interior
layout, filming authority, visiting hours, capture scope and production logistics
remain open. Historical 17-record findings must not be relabeled as 18-record results.
Workbook renders and OOXML checks passed; native Excel UI was not exercised. The
camera behavior is verified using DOM/MapLibre doubles; desktop/tablet animation,
3D focus and overlay avoidance still require the next live deployment check.


### D067 - Unverified UI presentation (2026-09-20)

Browser discovery returned no surfaces; attempted in-app reference tab creation returned Browser is not available: iab. Thus LSU3D/SCSU behavior was inspected as source only. Before/after screenshots are unavailable. Desktop/mobile proportions, touch/scroll, real keyboard/focus/inert behavior, contrast, selected pin/cluster edges and live provider failure recovery remain BLOCKED for this build. Tests use DOM/MapLibre/IndexedDB doubles and cannot establish visual resemblance or usability. Short mobile sheets may require expansion/scroll to expose results. Advanced filters, comparison and shot editor remain pending; no phase exit or new exception approval is implied. Retest conditions and viewports are in docs/UI_INTERACTION_DESIGN.md. No human study evidence exists.


### D067 manual-evidence update - 2026-09-20

Owner-reported PASS for critical checklist items 1-12 now supplies manual evidence for the tested Explore flow; this supersedes the earlier absence of manual evidence for those portions only. Item 13, deliberate map-library failure, remains NOT TESTED. Browser/version, device/viewport, local/published URL, exact build and hard-refresh confirmation are unknown. No screenshots were supplied. Do not infer phone hardware testing from the phone-or-narrow-window instruction, or live 3D from its conditional instruction. Full provider-failure, contrast/reduced-motion, reference-comparison and broader phase acceptance remain distinct. Owner acceptance is technical evidence, not human-participant usability-study evidence.

## Scouting Assessments planning limits - D068, 2026-09-21

Source review does not establish live device, provider or offline behavior. Virtual observations cannot establish current circuit capacity, permission or acoustic performance; record source/date and preserve unknowns. Checklist JSON contains media IDs without binaries; ZIP manifests omit touched metadata, making false/zero defaults ambiguous. Preview and report these limitations rather than fabricating evidence. Local storage quota, large videos, interrupted imports and shared historical media require bounded transactional tests. Existing panoramas may contain stitched/gap-filled regions and are not measured geometry. Completion can be inflated by not-applicable answers, so show their count separately. All mitigation is planned under tests 206-215, not validated.

## D069 limitations - 2026-09-21

Browser discovery again returned apps=[] and browsers=[]; creating an iab tab failed with Browser is not available: iab. Live desktop/tablet, keyboard/focus/contrast, touch, clipboard/new-tab/history, cluster edges and provider failures are BLOCKED for this exact increment. No new screenshots exist. The Phase 0 live catalog/storage fixture obligations remain open because no browser-connected integration was possible; persistence has not expanded.

Catalog-derived search facets are description matches, not a curated visual taxonomy or verified physical characteristics. Completeness uses 23 core descriptions and known uncertainty wording; prose may contain uncertainty outside that vocabulary, so even zero unresolved fields would mean described only. Sources are associated at record level; field-specific observers/dates/methods, approved photos, measured dimensions, capture dates/extents/rights and current permission remain missing or unverified. Reference source inspection does not establish visual equivalence. Candidate badges/actions and comparison/shot integrations require their later-phase workspace delivery; test 44's complete integrated workflow is NOT TESTED and no new exit exception is approved. D068 editor tests 206-215 remain NOT TESTED. No usability benefit or phase completion is inferred from unit/DOM doubles.

### D070 - 2026-09-21

The desktop floating panel overlays imagery; camera padding accounts for its measured right edge plus 24px, capped at half the map width. This changes the D067 layout assumption and needs live edge/cluster, collapse/restore, tablet and 3D checks. Browser connection remains unavailable. Owner-reported functional passes for the prior build do not resolve its screenshot-visible truncation or establish this correction's appearance. Checklist 15/16 have no affirmative execution evidence and remain NOT TESTED. No new exception or participant result.


## D071 ? acceptance and capability limits, 2026-09-22

No browser surfaces were available; the live attempt failed before opening a
page. D070 visual/keyboard/narrow/coincident tests, provider recovery and D061
real IndexedDB/linked-fixture checks remain BLOCKED. Prior screenshot FAIL and
owner checklist 15/16 NOT TESTED are retained. New HTTP 200 responses for all
11 entries cannot show iframe rendering, requested arrival, pose/navigation/
sweep-list/screenshot capabilities, capture freshness, extent or rights.

Diagnostic restore capability previously inferred from poseReporting alone;
corrected to unverified and covered by test 219. This correction is not a
bookmark implementation. Source inspection finds no map camera snapshot across
Explore disposal/remount, and no bookmark save/restore UI/actions. Existing
transfer validates record references but is not proof of future cross-location
assessment evidence checks. Exact remaining contracts and retest conditions are
in PHASE_2_RECONNAISSANCE.md and PHASE_1_ACCEPTANCE_REVIEW.md. E1 remains a proposal;
no dependent implementation, phase completion or new exception is authorized.


### D073 - mini-map limits, 2026-09-22

Mini-map follows the selected catalog location, not the user's uncalibrated
position/heading inside Treedis. DOTD aerial context is approximate and separate
from the captured view/date/extent. The additional WebGL context exists only
while expanded; real concurrent-provider/GPU behavior needs live testing.
Supplied screenshots are baseline desktop and browser-emulated phone evidence,
not physical-device or mini-map acceptance. Attribution/selected-pin legibility,
short-screen list space and real keyboard/touch remain BLOCKED without a browser.


### 2026-09-22 - D075

D075: DOM doubles cannot establish toolbar fit, fixed-card visibility, gestures, 3D rendering or cross-origin focus ordering. Desktop and phone tests must verify blur plus active-iframe focus dismissal. Mini-map exposes 11 current captures only; future locations cannot open tours. No new capability or phase-completion claim.


### 2026-09-22 - D076

D076: 32px icon buttons intentionally reduce toolbar footprint as requested. Actual phone targeting, icon recognition and map visibility still need owner testing; automated DOM tests do not establish CSS rendering. Owner screenshot demonstrates the prior presentation defect, not corrected-build acceptance.


### 2026-09-22 - D077

D077 owner-reported latest mini-map retest PASS reduces the pending owner UI acceptance gap. Unknown device/browser/build coverage remains explicit. It supplies no missing bookmark implementation or raw provider capability evidence; no phase-wide generalization.


#### D077 owner scope clarification

Owner explicitly confirms "yeah all the test even the ones before the map" in response to the question naming earlier provider-failure and real-browser storage/reload/export/import checks. All earlier instructed delivered-function checklists, including owner 15-16, are now owner-reported PASS. Preserve earlier NOT TESTED/BLOCKED/FAIL entries as historical; do not repeat those checks solely for missing tool access. Browser/version/device and exact tested digest remain unspecified. This does not make unimplemented bookmark save/restore tested, supply absent raw provider reports, or explicitly approve E1. Bookmark-specific and later-phase workflows remain NOT TESTED. No runtime changes or new automated execution.
