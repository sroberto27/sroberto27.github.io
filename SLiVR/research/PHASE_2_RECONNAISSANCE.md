# Phase 2 independent reconnaissance

2026-09-22, D071. Technical source review, automated doubles and HTTP observations;
no live viewer or participant evidence. Dependent feature implementation remains
blocked by the [Phase 1 acceptance gates](PHASE_1_ACCEPTANCE_REVIEW.md).

## Reference inspection and reuse

Both reference trees were inspected read-only. Paths below are relative to
`E:/sroberto27.github.io/Wrapper/map/`. Existing SLiVR behavior is retained.

| Concern | Experimental/SCSU inspected source | LSU3D inspected counterpart | Application to SLiVR |
|---|---|---|---|
| Readiness and navigation | js/03-tour-bridge.js:20-119 | js/03-tour-bridge.js:27-128 | Prefer SCSU's working queued navigation, 600ms ready delay and Navigate/rotation shape already adapted. Keep exact origin/source/payload validation and bounded timers; never copy wildcard posting. |
| Base tour, entry queue and return | js/04-street-view.js:11-20, 67-155, 217-281 | js/04-street-view.js:12-29, 86-191, 269-332 | Preserve SLiVR base-tour load, supplied deep-link recovery, four arrival attempts and disposal. Both reference option builders use truthiness for transitionTime; preserve SLiVR's legitimate zero instead. |
| Viewer host/configuration | map.html:297-306; config.js:92-126 | js/04-street-view.js:12-29, 178-191; config.js:315-328 | Keep existing SLiVR viewer-host and region allowlist/configuration. Do not copy campus model IDs, hidden prewarming, or retained streaming after mode exit. |
| Sweep identity/context | js/04-street-view.js:32-56 | js/04-street-view.js:41-69 | Both use display-name lookups. SLiVR requires stable location/capture IDs and six distinct downtown entries; no name-based joins. |
| Persistent project bookmarks/capability evidence | No bookmark/captureVersionRef/supportedFields counterpart found in js/ | Same search: no counterpart | Use existing SLiVR bookmark schema, workspace repository and transfer contracts. No separate storage owner or inferred restore capability. |

Architecture-required deviations above are standing reasons 1/2 (identity,
security, zero values, cancellation/disposal and recorded defects), not a new
viewer rewrite. Diagnostic capability interpretation has no counterpart in
either bridge (reason 3). D071 changes only the descriptor used by the recon
page: reported pose no longer implies that a bookmark can be restored.

## Findings and remaining implementation contract

| Finding | Evidence and implication |
|---|---|
| Existing viewer is substantially delivered | src/immersive/treedis-adapter.js:252-391 and viewer-host.js; src/app/actions.js:603-745. Reuse shared responsive sessions; renew independent frame identity; retain loading veil, generation cancellation, bounded retry and release on exit. |
| Exact requested route sequence now covered with doubles | Stable 220 in tests/reference-regressions.test.mjs runs LOC-001 -> LOC-005 -> LOC-009 -> LOC-011, checks shared reuse/independent frame replacement, rejects abandoned-frame messages, verifies matching acknowledgements and clears timers on exit. This is not actual provider arrival. |
| Restore was overstated by diagnostics | src/immersive/capability.js:78 previously returned available from poseReporting alone; adapter sets that flag for even a sweep-only PoseChanged. Corrected to not verified. Test 219 includes sweep-only, raw-zero rotations and named angles with navigation capability. No restore command or UI is added. |
| Pose receipt is not orientation interpretation | src/immersive/treedis-messages.js:141-192 preserves raw rotationX/Y/Z, explicitly unknown units/axes. src/app/actions.js:699-715 does not retain pose values for bookmarks. Do not map raw rotations to yaw/pitch or infer FOV support. Capture only observed supported fields with the current session identity after prerequisites pass. |
| Bookmark record/storage foundation exists | src/domain/bookmark.js:21-58 already requires projectId, locationId, captureId, catalogVersion, captureVersionRef, adapterCapabilityVersion, experience/sweep IDs, supportedFields, timestamps/revision. Repository and transfer tests round-trip fixtures, not user-created views. No save/restore actions or editor in the current shell. |
| Capture version semantics need an honest definition | Public Capture has no provider revision field (src/domain/capture.js:20-36). Bind captureVersionRef to the referenced catalog snapshot/capture record and label provider capture revision/date unknown; never present catalog version as capture freshness. Define/test a stable encoding before creating bookmarks. |
| Ownership checks need contextual validation | transfer.js:130-151 validates project and optional candidate references; schema checks alone do not prove candidate/location/capture/experience agreement. At save/import/restore validate those relationships within the project; preserve a retired reference with a visible limitation rather than silently redirecting it. D068 assessment linking remains Phase 3. |
| Explore return is incomplete for camera state | shell.js:1136-1137 unmounts the map outside Explore; actions.js:476-528,576-583 recreate/dispose without a camera snapshot; maplibre-adapter.js:216-225 recreates bounds/default orientation. Retained discovery DOM is not retained center/zoom. Test 64 needs a session camera snapshot/restore through existing ownership, without keeping the provider alive or allowing resize/selection fits to overwrite it. Source finding, not an executed live failure. |
| Requested versus observed location needs care | App viewer state updates sweepId on navigated, not every pose; catalog route remains the requested location. Walking inside a shared experience must not silently attach an unknown-room view to an unrelated location. Resolve known capture/entry matches by IDs; retain requested context and explicitly label unresolved coverage. |
| Screenshots/media remain unavailable for reliance | No screenshot operation/evidence exists in the current adapter. Capture dates, extent, rights and orientation convention remain unknown. No provider imagery export or media-dependent feature is enabled. |

## Evidence needed before implementation/reliance

1. Pass Phase 1 gates or obtain exact bounded approved exceptions. D061 real
   IndexedDB/linked-fixture tests must pass before persistence expansion.
2. On a recorded build/browser, open all 11 supplied captures and save per-entry
   diagnostic reports. Observe actual rendering separately. For six downtown
   targets, confirm requested and observed sweep IDs match after Navigate;
   exercise Magnolia and Moncus model changes in the app, including rapid switches.
3. Record readiness, sweep-list and pose observations independently. Verify
   orientation restoration against a known view only if supported units/axes and
   outbound parameters are established. HTTP 200, TourReady, or a sweep ID alone
   cannot certify full-view restoration. Do not test screenshot extraction without
   a supported capability and necessary content authorization.
4. After prerequisites, implement basic project-owned bookmarks through existing
   actions/repository: name/note, exact references/version, only supported fields,
   finite zeros, revision-safe writes/emergency export, capability-aware restore
   and explicit entry-only/retired-view limitations. Preserve bookmarks on failure.
   No checklist/editor or placeholder assessment buttons before Phase 3.
5. Test 60-62, 64 and 208's bookmark dependency with storage/reload/transfer and
   stale-session cases; run all affected 50-67 plus Part J. Full 208 editor handoff
   stays NOT TESTED until Phase 3, independently of bookmark foundation tests.

The local outputs search found only HTTP probe JSON, not raw browser capability
reports. Historical D061 owner entry/navigation acceptance and the recorded
2026-09-20 pose-shape observation remain evidence with their original limits.
They are not per-entry orientation, sweep-list or screenshot validation.


## D072 follow-up - 2026-09-22

The owner explicitly requested the Explore button focus the location selected
in Immersive. This narrow handoff is now implemented through the existing
location route and map focus, tested under 221 (355 automated PASS overall).
The camera-snapshot finding above remains historical and technically applicable
to exact prior-view restoration; that is not the requested return-to-current-pin
behavior. No provider-walking location mapping or bookmark work is implied.
