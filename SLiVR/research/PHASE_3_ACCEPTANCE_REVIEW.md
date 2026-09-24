# Phase 3 closeout - D089

Status: COMPLETE for the delivered Phase 3 scope. App0.3.7; DB2;
transfer1.3.0; template1.0.0; catalog1.1.0. Historical entries below retain
their original status and do not supersede this closeout.

Owner reported all earlier nine functional checks and all ten D087 layout checks
passed. Those reports cover storage recovery, project/scene/candidate work,
assessments, comparison and evidence workflows as instructed; device/build
metadata was not supplied and is not invented. Phase2 remains accepted under E2.
E1 allocates shot actions to Phase4 and the integrated retest to Phase5.

D088 stable236 final live Chrome check: existing LOC-003 assessment opened;
pinning retained its ownership on LOC-001 list selection; Follow switched to
LOC-001 explicit empty/start state; returning through the list reopened LOC-003;
Immersive and390x844 requested responsive viewport retained visible ownership
without horizontal overflow. No answers were modified in this live check.
Save-failure, rapid selection, multiple dated assessments and candidate selection
are automated integration evidence, not claimed as live observations. Prior
owner save-failure and mobile functional passes remain separate evidence.
Chrome interactions included timeouts and one unmatched accessible locator;
state was inspected and the successful checks resumed. Override reset.

Final automated suite:409 PASS,0 FAIL; deploy199 files/0errors; catalog0errors,
one preserved Old City Hall alias warning. Runtime SHA256: `b8bc8f97adec4678c21d8a92e2052ecd408b06f4d31f5d7d8804fde594d07091`
(126 files; sorted path,NUL,bytes,NUL; index/src/styles/config/data/vendor;
config/runtime.js excluded). Log: outputs/phase3-closeout-tests.txt (local only).
No measurement/pose restoration or universal physical-device certification is
claimed. Future integrated/physical-device regression remains Phase5 work;
no new participant evidence or telemetry. Scope excludes Phase4 spatial shot
editing and Phase5 native packet/ZIP/print features.

Commit/push authorized by owner for all SLiVR changes only. Existing ignored
runtime credentials, private references, local exports and outputs remain local.
Publish using a clean branch based on origin/main: the working branch includes
unrelated unpublished history and must not be pushed wholesale. Verify every
outgoing diff is SLiVR-only, no force push, preserve unrelated worktree changes.

﻿# Phase 3 acceptance review - D083

2026-09-23. Status: IMPLEMENTED, AWAITING LIVE ACCEPTANCE. Do not mark COMPLETE
until the new live gates below pass or the owner explicitly approves a bounded
exception with a retest condition. No such new exception is recorded.

Phase 2 remains COMPLETE under E2 entry-only bookmarks. Preserve every earlier
owner-reported PASS. E1 allocates candidate/comparison actions to Phase 3, shot
actions to Phase 4 and integrated retest to Phase 5. Do not repeat Phase 2 tests.

## Build and automated evidence

HEAD fd4900a6f14348dd3a574911bfcc500e5e9786a5 plus retained uncommitted D078-D083.
App 0.3.2; transfer 1.3.0; workspace database 2 (additive from 1); catalog 1.1.0;
template 1.0.0; MapLibre 4.7.1; Treedis contract treedis-recon-2. Windows,
PowerShell, Node v24.18.0. No native browser/device/provider test executed.

399 full-suite PASS, zero failures: outputs/phase3-d083/full-acceptance-final.txt.
Runtime digest 5408733c6a40d5ef6d0457be08034f291dee1b013c71807b2bc492a9622d5555,
106 files (sorted index/src/styles/config/data/vendor, excluding config/runtime.js,
path + NUL + bytes + NUL). identity.json records versions/digest. Catalog: zero
errors, retained Old City Hall alias warning. Deployment scope: zero errors.
No telemetry, staging, commits, pushes or changes to either reference project.

| Gates | Delivered and automated evidence | Remaining live evidence |
|---|---|---|
| 68-71, 227-228 | Metadata, scene briefs/order, idempotent candidates, ownership | New editing UI/reload |
| 72-77, 176 | Five explicit fit states, three-candidate grid/detail edits, decision snapshots/reopening, comparison context | Desktop/tablet comparison, exact navigation/focus/scroll and reload |
| 78-79, 82 | Schematic shot record linkage; entry bookmark candidate/evidence links; transfer | Link/reopen and new evidence flow. Spatial shot editing belongs to Phase 4. |
| 80-84, 179-181 | Autosave flush/order, failed-write memory/retry, scoped delete; no private-contact fields | Real storage failure/recovery and project transfer/deletion |
| 206-208 | Eight sections, false/zero/unknown, dated history, compatible entry evidence, shared editor | Repeat assessments and provider-blocked editor on real browser |
| 209-210 | Ordered writes, late media identity guard, bounded Blob/base64 ownership, missing placeholders | Actual image/video/panorama decode, flat fallback/context loss, resource lifecycle and quota |
| 211-212 | DB1 migration; JSON copy/reference remapping; legacy JSON/ZIP preview, exclusions, touched/ambiguous semantics | Clean-profile native storage upgrade/transfer/media; cancellation and preview UI |
| 214 | Selected assessments/media; required evidence exclusion rejected; data-only report | Browser download/reimport. Native SLiVR ZIP/print packets are Phase 5. |
| 215, 172, 182-184 | Native labels, focus helpers, deployment/catalog/boundary and reference audit contracts | Desktop/tablet keyboard/layout, console/network/cache/sibling isolation |

Browser discovery returned apps=[] and browsers=[]. Creating an iab tab failed:
"Browser is not available: iab". Live gates are BLOCKED for this execution, not
PASS. Automated DOM and IndexedDB stand-ins do not substitute for those gates.

## New owner checklist (earlier passes do not need repeating)

1. In Projects, create/edit a project and two scenes; add three candidates to one
   scene. Edit a name/brief/candidate note, wait for Saved locally, reload, and
   confirm the latest values and selection. Re-adding the same location to one
   scene must keep one candidate; another scene may use the same location.
2. Open Scouting assessments for a candidate. Make a virtual assessment and a
   separate dated room/visit assessment. Across the eight sections, enter zero,
   explicit false, needs-validation and not-applicable. Attach a saved entry
   bookmark and supplied photo, short video and existing panorama. Check progress
   labels, media open/close, keyboard use and desktop/tablet layout. Close while
   typing and reopen: the latest answer must survive. Block the tour provider:
   the checklist must remain usable. Exact camera restoration is not claimed.
3. In comparison, set known/unknown/conflicting ratings for three candidates,
   link a chosen assessment revision/question, choose preferred plus a different
   backup, and write rationale/open questions. Reload and reopen the decision.
   Edit its assessment: changed evidence must be flagged while the old snapshot
   remains. Change a rating from candidate detail and comparison; both agree.
   Go to a candidate location/Immersive and return to the same scene/candidate.
4. Export full project JSON and import into a clean browser profile. Confirm
   assessments, history, notes, decision links and media reopen. Test copy,
   cancel and reviewed replace. Export selected media/data-only: omitted bytes
   must be reported, never silently complete. Preview legacy checklist JSON/ZIP
   with private contacts, untouched defaults and missing media; verify explicit
   project/location mapping, visible exclusions/ambiguity, safe cancel, and no
   imported private values. The original CheckList app/data must be unchanged.
5. Force a new workspace save failure: retain answers, show Save failed, export
   emergency JSON and retry after recovery. Archive/detach evidence and confirm
   history remains. Review/cancel project deletion; confirmed deletion must
   remove only that project's records. Check the linked shot workspace returns
   to its candidate; the spatial editor itself remains Phase 4. Check browser
   console/network and sibling apps for new errors or unintended storage changes.

Report only these new results, including any failures. Browser/device details are
useful evidence metadata but must not trigger repeated confirmation of old passes.

## D084 follow-up: owner Create failure - unresolved

Owner screenshot reports failed Create and selection metadata save. slivr:diagnostics
returns null, so an active persisted simulation setting is not confirmed. Record
new live 68/80/81/230 FAIL; do not repeat or revoke earlier Phase 2 passes.
App 0.3.3 now preserves the raw failure message after navigation and shows native
transaction-start details. The separate diagnostic gap is fixed with complete
write coverage and explicit off/retry recovery. 401 automated PASS; deployment
178 files/zero errors; logs/digest outputs/phase3-d084. Owner was asked to export
emergency JSON, hard-refresh and report the Not saved message (or successful Create).
Actual cause and live recovery remain pending. Phase 3 cannot close yet.

## D085 follow-up - startup fix, live recovery pending

Owner supplied "Not saved: the workspace database is not open"; diagnostics null.
App 0.3.4 separates database startup from catalog loading and makes Create wait
for initialization. It also supports editing with a pending catalog and restores
projects opened through direct URLs after database startup. 231 automated PASS;
402 full-suite PASS; deployment clean. Evidence: outputs/phase3-d085.

Live 68/80/81/230 failure is preserved; no live recovery PASS is claimed. Keep an
emergency JSON copy of any unsaved draft, refresh to the updated build, create a
named project, confirm Saved locally, then reload and confirm it remains. Resume
remaining new Phase 3 acceptance only after this focused check succeeds. Earlier
Phase 2 owner passes require no repetition. Phase 3 is not complete.

## Owner results and D086 approved revision - 2026-09-23

Owner states all nine supplied critical tests passed. Accept that report, including
the previous Create/save blocker; no repeat confirmation is needed. The report
covers the supplied checklist, without independent browser/build identification.
Historical FAIL/BLOCKED results remain in this document as history.

Owner disliked the basic checklist presentation and approved a unified Explore,
floating-first V2 interface. App0.3.5 delivers that revision, with 407 automated
PASS and clean deployment/catalog validation. The previous UI's accepted evidence
does not prove the revised interface visually. New232-234 live acceptance remains
pending; do not label the revised design fully accepted from automated doubles.

Focused new review: open a checklist over a tour; compare its appearance with V2;
try minimize/restore/maximize/resize and side-by-side without resetting the tour;
create/select project/scenes from the top controls; change viewed locations and
confirm assessment ownership remains clear; enter an answer through V2 controls
and check save/reopen. Test the narrow-screen and keyboard interactions. Keep
previous feature passes; no need to rerun the entire earlier nine-item checklist.


### D087 responsive workspace update

App0.3.6 implements reserved desktop toolbar/tray and exclusive phone full/half
tools with compact navigation, collapsible map controls/context and Back dismissal.
408 automated tests PASS plus critical Chrome responsive checks. Stable235 and
source rationale are recorded in research/DECISION_RECORD.md and
 docs/FULL-SYSTEM-TESTING.md. Physical-phone keyboard/touch/orientation/provider
acceptance remains NOT TESTED. Preserve prior owner functional passes and D086
screenshot failures. No telemetry or reference changes. Use Chrome only for
critical checks, as requested. No staging/commit/push.


### D088 checklist location following

Owner reports all D087 critical checks passed; preserve prior acceptance. App0.3.7
adds prominent location identity, default following of route/candidate selection,
pin/follow controls, save guards, explicit start for empty locations and session
memory of dated assessment selection. Stable236 and evidence: DECISION_RECORD D088
and docs/FULL-SYSTEM-TESTING.md.409 automated PASS; focused Chrome identity check;
new end-to-end mobile/provider following acceptance remains NOT TESTED. Prior
passes do not need repeating. No data schema changes or telemetry.
