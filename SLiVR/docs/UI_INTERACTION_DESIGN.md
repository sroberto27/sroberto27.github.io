# SLiVR UI interaction design

Revision 1, 2026-09-20. Decision D067; F01, F02, F20. Explore presentation and discovery navigation preserve SLiVR identity, palette, four-mode top navigation, catalog 1.1.0, schemas, public/private separation and provider lifecycles. This increment does not complete Phase 1 or implement comparison, shot editing or an itinerary.

## Evidence and reference provenance

Both approved projects were read only. These are **source observations**, not browser observations. Browser discovery returned no apps or browsers; reference tab creation failed with `Browser is not available: iab`. No reference or SLiVR before/after screenshot could be captured. Visual equivalence is unverified.

Paths below are relative to `E:/sroberto27.github.io/Wrapper/map/`.

| Source | Adaptation |
|---|---|
| LSU3D/css/01-base.css:87; css/03-sidebar.css:7-62; css/05-leaflet-responsive.css:224-226 | 332px desktop panel, 300px narrower laptop panel, same-box list/detail states, rounded edge spacing. Retain SLiVR palette. |
| LSU3D/css/03-sidebar.css:484-516; css/04-map-details.css:520-550 | 880px mobile breakpoint, rounded bottom sheet, half/expanded/hidden states. |
| Experimental/js/06-details-panel.js:6-45, 310-368 | Mutually exclusive list/detail sheet, half/full states and layout settling before focus. Retain SLiVR double-animation-frame focus, cancellation and ResizeObserver lifecycle. |
| LSU3D/js/09-sidebar-search.js:7-25, 28-124; Experimental/js/09-sidebar-search.js:8-135 | Selection/list synchronization and list-to-detail handoff. Use route actions and stable IDs instead of lowercased names, with native keyboard buttons. |
| LSU3D/js/14-redesign.js:156-208 | Data-driven filtering and retained browse state. Adapt to SLiVR area/capture fields and feed eligible IDs to map markers instead of list-only filtering. |
| LSU3D/css/02-header.css:84-139; Experimental/css/09-burger-settings.css:5-36 | Right drawer/backdrop with grouped secondary information, adapted to catalog/scouting help. |
| LSU3D/js/14-redesign.js:270-350; Experimental/js/10-event-wiring.js:247-276 | Retain existing adapted map controls, independent layers/imagery/3D and Recenter. Remove duplicate discovery and catalog stepping from map lifecycle. |
| LSU3D/js/14-redesign.js:100-139 | Avoid stacked mobile tour/detail sheets. Remove SLiVR's redundant previous/next strip; it is not an approved itinerary. |
| LSU3D/js/12-start-screen.js:605-660 | Reuse SLiVR's adapted focus trap, adding inert background, Escape and trigger focus return for the drawer. |

Source CSS and interaction structures were adapted inside existing shell/adapter modules. No reference data or global wrapper was imported. D067 records permitted deviations.

## Before and after

Before: permanent catalog rail left, selection/catalog-information rail right, map-menu search and previous/next strip, stacked scrolling mobile page, and development-phase descriptions in Explore. Source baseline is Git HEAD `e50834604c8decaa13dd2aacc3270a254523ca37` before this uncommitted increment.

After: discovery and dossier share the left panel; no permanent Explore right rail. Search covers name, ID, address, operational-area name and venue type, with case/outer-spacing tolerance. Capture and area filters combine; sort offers catalog order or name A-Z with ID tie-break. Clear filters recovers empty results. Advanced planned filters/sorts remain unimplemented. Catalog/help uses a shell drawer independent of MapLibre failure.

## States and transitions

| Event | Result |
|---|---|
| Open Explore | Retain query, area, capture, sort and scroll through dossier/mode visits within this shell session. Reload starts fresh discovery. |
| Select list row or pin | Resolve existing location route into the same panel; open it, focus Back to locations, select/focus map using stable ID. |
| Direct location link/history | Same dossier state. Selected record outside filters is temporarily included on map; browse filters remain unchanged. |
| Back to locations / Escape in dossier | Navigate to Explore, restore browse DOM/scroll; focus originating row with preventScroll, or search if filtered out. Clear map selection. |
| Hide panel / Escape in list | Keep list/dossier state, release space to map, focus Show locations. |
| Show locations | Restore retained list or dossier and focus its controls. |
| Select same pin while collapsed | Explicit selection request restores dossier even without a hash change. |
| Expand sheet / Half sheet | Change reserved mobile height without changing route or browse state. Drag gestures are not implemented or required. |
| Open hamburger | Modal right drawer/backdrop and focus trap; Close, backdrop or Escape restores trigger focus. |
| Leave Explore | Dispose map/mount viewer through existing lifecycle; close menu. Other modes keep their panel arrangements. |

Desktop width: 332px, or 300px below 1100px. At <=880px, the panel becomes a bottom sheet up to 46dvh, bounded by available workspace height. Expanded mode reserves at least 150px for map context. Top navigation stays above the workspace. List and dossier scroll. On short phones, expand or scroll the sheet to reach results below filters.

The map occupies remaining grid space instead of extending behind the panel. Collapse changes its actual container size. Existing ResizeObserver resizes and refits/refocuses; existing camera padding reserves marker tips, controls and imagery provenance. Do not double-count panel dimensions in padding. Focus retains pitch/bearing. Dossier animation and camera travel respect reduced motion. Popup/cluster edges and selected-pin visibility require browser acceptance.

## Actions and future extension

Discovery owns search/filter/sort/Clear filters. Dossier owns identity, coordinate provenance, capture/coverage unknowns and research validation labels. Open in Immersive appears for current captures; future records state no current capture. Persistent navigation exposes existing Projects and Shot Designer entry points.

Map controls remain right: zoom/compass, user-triggered location, fullscreen, streets, aerial, 3D and Recenter visible locations. Recenter fits represented records; Clear filters restores all 18. No-result Recenter does not fabricate a fit. Attribution/recovery remains on the map. Catalog totals/version/help belong to the drawer. Phase messaging is removed from Explore.

Approved future flow: discovery -> dossier -> project candidate/compare -> immersive inspection -> shot planning. Add working project/candidate actions to dossier action sections using stable IDs and domain actions; comparison belongs in Projects. Immersive keeps its independent lifecycle. Shot Designer retains tree/inspector/canvas layout. No disabled candidate/compare/itinerary/shot placeholders. Public facts stay read-only; private notes belong to workspace records.

## Accessibility

Native labelled controls, token-based visible focus, text capture labels and >=44px Explore targets. Panel is nonmodal, leaving map keyboard reachable. Only help is modal: inert background and existing Tab/Shift+Tab trap. Escape backs out of dossier or collapses list. Hidden controls/panel use hidden state. Result count uses a polite status role. Contrast tokens are unchanged; measured contrast, real focus order, screen-reader announcements and touch ergonomics remain unverified.

## Permitted architectural differences

Reason 1 (approved architecture and this authorized UI scope): preserve top navigation/palette; use grid-reserved map space and ResizeObserver rather than floating overlap/timed refresh; one reusable sheet instead of separate drawers; explicit size buttons instead of mandatory drag; route/store IDs, guarded lifecycle, inert/trapped modal and native controls. No campus photos/tour routing/unverified media. Filters use catalog fields and synchronize map/list.

Reason 3 (no counterpart): SLiVR catalog metadata, evidence vocabulary and private project records retain their existing implementations. No new persistence schema, telemetry or provider protocol.

## Verification and remaining limits

See [full-system testing](FULL-SYSTEM-TESTING.md), D067 execution record and tests 204-205. DOM/MapLibre doubles verify logic, not CSS painting or actual browser history events. Desktop/narrow screenshots, touch, real focus/contrast, popup placement and live providers are BLOCKED in this environment. Requested before/after screenshots remain missing, not substituted with mockups. Retest at 1440x900, 1024x768, 390x844 and short landscape with keyboard, reduced motion, empty results and provider failures; include an actual tablet before device acceptance. No participant evidence or measured usability improvement exists.


## Owner manual follow-up - 2026-09-20

The owner reports all critical-change checklist items 1-12 PASS; item 13 (forced map-library failure) was NOT TESTED. This supplies owner-reported evidence for desktop/narrow layout, discovery/dossier restoration, selection, collapse, controls, menu/keyboard, history and current immersive/other-mode entry. See the itemized [verification record](FULL-SYSTEM-TESTING.md#d067-owner-reported-manual-results---2026-09-20).

Earlier blocked automated-browser inspection remains historical evidence. Browser/device, viewport, URL/deployment/build and hard-refresh confirmation were not supplied; screenshots remain absent. Conditional 3D and phone-versus-resized-window variants cannot be inferred. Forced map failure and broader unlisted acceptance checks remain open. This is technical manual acceptance of the checklist, not a participant study or full Phase 1 closeout.

## Phase 1 continuation - 2026-09-21 (D069)

The existing D062-D067 map framing, pin design, controls, single panel and sheet lifecycle are retained. Discovery now provides 180 ms debounced token search across identity, address, area, venue, visual character, known spaces and practical descriptions. All ten approved filter dimensions compose with AND; words within a query also compose with AND. Area/name/capture/recent sorts break ties by stable ID. Recently viewed records are session-only, stored through app actions, with no persistent history or telemetry. Catalog order remains available.

More filters is a native disclosure. Desktop filters scroll within a bounded portion of the rail; mobile retains sheet scrolling and expansion. Unknown character/space classifications are offered explicitly. Historic/contemporary and interior/exterior options reflect literal catalog descriptions, not visual inspection, architectural dating or verified coverage. Public hours means reported hours, never availability. Completeness counts unresolved core descriptions, never suitability or readiness. All current records have unresolved fields.

Nearby pins within 44 screen pixels of a group's anchor use the existing ordered group expansion. Groups recompute after zoom/resize, retain eligible IDs and selection, and release listeners on disposal. A group anchor is a presentation point at its first member; selecting a member focuses its real catalog coordinate. Groups do not establish a shared property or capture. Exact-position fallback remains when projection is unavailable.

Dossiers expose overview; production considerations; visual/spatial character; immersive coverage; access; evidence/sources; project context; and public sharing. Open in Immersive stays near the title for current captures. Source disclosures merge location and scout-detail IDs and show publisher, type, access date, supported facts and authority limitations. Private source documents have no links. Missing reference photos, dimensions and observation metadata remain explicit. Public URL copying strips queries and workspace context; unavailable/rejected clipboard access leaves selectable text and visible recovery.

### D068 assessment placement contract (Phase 3 delivery)

The dossier's Project context section, after public evidence and before Share location, is the insertion point for the active project's candidate and assessment summaries. The current informational boundary remains useful by itself; no placeholder checklist button or invented empty assessment count is rendered.

When Phase 3 delivers the shared editor, show the active project name and existing candidate status separately from catalog capture/research badges. Resolve summaries by both projectId and locationId; show assessment title/room, source kind, observation date, revision, answered count, not-applicable count and unresolved count. Never use completion as suitability or permission. Each summary opens the same editor as Projects with stable assessment ID; a working Scouting checklist action creates an assessment only after a project/candidate context exists. No project: the working action selects/creates project and candidate first. Preserve selected location, filters, scroll and trigger focus when returning.

Assessment edits write only workspace records and immutable revisions through the repository. Public source/geometry/coverage fields above remain read-only. A public location link never includes project, assessment, answer or media identifiers. Phase 2 supplies capability-aware bookmark evidence; the Phase 3 editor must remain usable without the provider. Candidate comparison and create/open shot actions remain Phase 3/4 integrations, not inert Phase 1 controls. Tests 206-215 remain delivery gates for those phases; test 216 verifies this preparation boundary now.

### Verification

See FULL-SYSTEM-TESTING.md, D069 execution. Automated evidence is separate from unavailable browser presentation checks. The previous owner-reported D067 results do not certify this changed build. No Phase 1 completion is claimed.

## D070 - approved panel and cluster polish, 2026-09-21

Supersedes the desktop grid-reserved-map description above. Explore keeps one rounded floating rail while the map now spans behind it, removing the full-height rectangular backing. Camera fits reserve the actual visible panel width; observing the rail catches collapse/restore even when the full map container width stays constant. Mobile retains its reserved half/expanded sheet. Names use a full-width wrapping first row; ID/capture appear below, then research status. Other modes are unchanged.

Group badges are circular 44px targets displaying a count. Title/focus label supplies context. Click/Enter/Space fits the group's bounds with a 550ms transition (zero with reduced motion), max zoom 19 bounded by map capability, current pitch/bearing and panel-aware padding. Hover/focus/ArrowDown still exposes individual members. Groups that remain coincident keep their expanded member controls after regrouping. Group navigation cancels pending individual camera focus without changing the selected catalog ID or filter state. Recenter returns to the current filtered inventory.

Source provenance: D070. Automated tests 218 and Part C/J; live painting, touch, popup edges, contrast and browser camera animation remain BLOCKED pending owner retest.


## D072 - Immersive-to-map location link, 2026-09-22

Pressing the top Explore button while a valid catalog location is selected in
Immersive now opens that location's existing Explore dossier/selection route.
The map focuses its pin using the established panel-aware camera behavior;
a retained filter cannot hide that selected destination. Back to locations
restores the retained discovery query/filters/sort/scroll. With no resolved
Immersive location, Explore keeps its ordinary index behavior. This uses the
selected catalog location, not an inferred position from an unmapped tour sweep.
The viewer is still disposed on exit. Test 221: automated PASS; live BLOCKED.


## D073 - collapsible Immersive location map, 2026-09-22

Based on the owner's two screenshots, place the mini-map at the top of the
captured-location rail on desktop. In the existing narrow stacked layout, that
rail follows the viewer: its compact Show map/Open Explore row sits immediately
below the tour, above the location list. No provider imagery or bottom control
is covered. The map is collapsible on **every** screen; desktop initially open,
<=64rem initially closed. The user's choice persists for this shell session.

The expanded map is 180px high, uses the existing DOTD imagery/attribution and
numbered selected pin at zoom 16, and follows selected catalog locations across
shared or independent experiences. It is a static geographic preview: use the
pin or Open Explore for the full selected-location map. Show/Hide and Open
Explore are native keyboard buttons with >=44px targets. Collapse/exit releases
the additional map resources without restarting Treedis. Map failure keeps the
Explore action and retry usable. Unknown/unmapped provider sweeps do not imply
geographic movement. No capture freshness, coverage or rights claim is added.

Automated state/lifecycle/failover coverage: 222. Live desktop/narrow painting,
attribution legibility, keyboard and touch need owner retest; supplied screenshots
show the prior layout, not acceptance of this addition.


## D074 - bidirectional mode context, 2026-09-22

Explore and Immersive top tabs now carry the resolved selected location in both
directions. Search/list and pin selection share the same route identity. No
selection opens the normal Immersive picker; a future location opens its honest
no-capture state. The reverse map focus, retained filters and mini-map handoff
remain unchanged. Test 223 automated PASS; live retest BLOCKED.

Future Projects/Shot Designer integration must use the same bidirectional
context contract: retain location/capture and the active project, scene,
candidate and shot-scene IDs where applicable; restore the relevant selection
and editor/list position on return. Location alone must not choose an arbitrary
project, scene or shot. If context is missing or ambiguous, request an explicit
compatible destination; never create workspace records just by changing tabs.
Keep private context out of public location links. This is a delivery requirement
for Phases 3/4 and their integrated tests, not a new placeholder control or
implemented workspace navigation behavior.


### D075: interactive Immersive mini-map

Supersedes D073's noninteractive preview. Pins represent current captures and open that location in Immersive; groups use Explore's existing selection behavior. Drag/zoom and keyboard map navigation are enabled. Toolbar: zoom in/out, Center (selected location), 3D toggle, Streets toggle, Enlarge/Restore. Street overlay and configured 3D use Explore's adapter. No future-capture pin pretends to open a tour. The map remains collapsible on all screens, initially collapsed on narrow layouts. Enlarging preserves the map instance in a temporary floating card. Restore, Escape, outside pointer/focus/scroll and tour iframe focus return normal size; outside interactions continue to their destination. Provider content and normal viewer controls remain unchanged. Live placement and touch/iframe-focus verification pending (224).


### 2026-09-22 - D076

D076 supersedes D075 two-row text toolbar: six 32px icon buttons in one top-centered row inside the mini-map, in zoom-in, zoom-out, recenter, cube/3D, layers/streets, enlarge/restore order. Hover tooltips, screen-reader labels, keyboard focus and pressed states remain. Pins use Explore transparent hit targets; group badges retain circular styling. Header Show/Hide and Open Explore remain outside the map.
