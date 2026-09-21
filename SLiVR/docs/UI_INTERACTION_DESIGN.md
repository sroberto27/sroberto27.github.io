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
