# Measurement and event dictionary

Version: Draft 0.1. These are candidate operational definitions for planning. No logging is enabled and no participant data has been collected.

## Common context fields

Every approved study observation should carry only the context needed for analysis:

| Field | Definition |
|---|---|
| `protocol_id` | Approved study protocol/version |
| `participant_id` | Pseudonymous study identifier stored separately from recruitment records |
| `session_id` | Random study-session identifier |
| `condition_id` | Assigned interface/comparison condition |
| `artifact_version` | Exact SLiVR build under evaluation |
| `feature_ids` | Feature IDs involved in the observation |
| `catalog_version` | Location-catalog schema/content version |
| `capture_version` | Treedis/capture identifier and known date/version where available |
| `device_context` | Approved non-identifying device/display/input category |
| `browser_context` | Browser name/major version where methodologically relevant |
| `provider_state` | Available, degraded, unavailable or fallback, with provider capability version |
| `task_id` | Protocol-defined task identifier |
| `event_time` | Timestamp relative to session/task start unless wall-clock time is required by protocol |

Do not log names, email addresses, private project text, access codes, credentials or precise personal geolocation.

## Candidate task outcomes

| Measure | Operational definition | Unit/type | Missing/failure rule | Evidence level before a study |
|---|---|---|---|---|
| `task_success` | Meets the protocol-defined completion conditions without facilitator completion | Boolean or predefined ordinal rubric | Record timeout, withdrawal and technical failure separately | Candidate measure |
| `task_time_s` | Time from task reveal/start action to completion condition | Seconds | Pause only under protocol-defined interruptions | Candidate measure |
| `critical_error_count` | Actions that invalidate the result, create data loss or require facilitator recovery | Count using predefined codebook | Technical/provider failures receive separate codes | Candidate measure |
| `recovery_success` | Returns to a usable state after a defined failure without data loss | Boolean plus time | State failure type and fallback offered | Technical and candidate HCI measure |
| `assessment_completeness` | Required scene/location criteria addressed in the participant's evaluation | Proportion or rubric score | Independent raters use a fixed codebook | Candidate measure |
| `unsupported_assumption_count` | Claims of permission, availability, geometry or conditions without supporting evidence | Count | Rater uncertainty is adjudicated and retained | Candidate measure |
| `unknowns_identified` | Relevant unresolved facts explicitly preserved as unknown | Count/proportion against task key | Do not score an unknown as negative or confirmed | Candidate measure |
| `decision_rationale_quality` | Coverage, evidence linkage and acknowledged tradeoffs in preferred/backup choice | Predefined expert rubric | Report rater agreement | Candidate measure |
| `confidence_rating` | Protocol-defined confidence response after task | Ordinal scale selected before study | Exact wording/anchors and timing must be versioned | Candidate measure |
| `confidence_calibration` | Difference/relationship between confidence and task correctness/rubric outcome | Derived, analysis-defined | Derivation frozen before confirmatory analysis | Candidate measure |
| `orientation_error_deg` | Smallest angular difference between reported and reference heading | Degrees | Reference pose and calibration version required | Candidate immersive measure |
| `spatial_recall_score` | Correctly identified spatial relationships using a predefined answer key/rubric | Score/proportion | Capture coverage gaps recorded separately | Candidate immersive measure |
| `shot_plan_completeness` | Required cameras, actors/marks, paths, shot metadata and calibration labels present | Proportion/rubric | Geometry feasibility and creative quality scored separately | Candidate measure |
| `fov_error_deg` | Difference between calculated/displayed and independent reference FOV | Degrees | Sensor/gate, crop and focal length required | Technical validation |
| `plan_scale_error_pct` | Relative difference between displayed known distance and reference distance | Percent | Calibration status/version required | Technical validation |
| `json_roundtrip_loss` | Required fields/relationships changed or missing after export/import | Count plus diff | Unsupported schema is a classified rejection, not silent loss | Technical validation |
| `mode_context_loss` | Active project/scene/location/shot unexpectedly changes across a mode transition | Count | Intentional user selection excluded | Technical and candidate HCI measure |

## Phase 6 Treedis Research Mode fields and quality measures

These definitions remain candidates until the Phase 6 data contract and a study protocol approve them. High-frequency trajectories are pseudonymous behavioral data rather than anonymous data.

| Field/measure | Operational definition | Unit/type | Required rule |
|---|---|---|---|
| `study_launch_id` | Short-lived authorized launch identifier/claim set | Pseudonymous string | Must not contain recruitment identity; expiry and protocol binding required |
| `consent_version` | Exact approved disclosure/consent version accepted for the session | Version string | Collection cannot start before acceptance |
| `probe_version` / `schema_version` | Injected bundle and event schema versions | Version/hash | Required on session manifest and preserved through analysis |
| `experience_id` / `entry_id` | SLiVR/Treedis capture context | Stable catalog/capture IDs | Never infer permission or participant identity from the location |
| `xr_reference_space` | WebXR coordinate reference space used for pose rows | Enum | Required before interpreting positions/orientations |
| `sample_config` | Requested pose/input rates, quantization and enabled event families | Structured manifest | Fixed per protocol/condition unless a change event is logged |
| `event_sequence` | Monotonic per-session sequence assigned before batching | Integer | Gaps and duplicates must remain detectable |
| `event_loss_rate` | Missing sequence count divided by expected emitted sequence span, with shutdown caveats | Proportion | Report client drops separately from missing batches/ingest rejection |
| `probe_overhead_ms` | Measured probe/controller work per sampled frame using the declared aggregation window | Milliseconds | Baseline, percentile/summary method and device/runtime required |
| `sampling_self_disabled` | Probe stopped high-rate sampling after exceeding the approved performance rule | Boolean/event | Threshold comes from protocol/device validation, not a universal constant |
| `withdrawal_result` | Stop/delete/retain action required by the approved protocol was completed | Categorical + timestamp | Must be tested end to end before recruitment |
| `condition_assignment` | Versioned experimental condition applied to the session | Condition ID/version | Assignment/counterbalancing source and disclosure required |
| `condition_operation_result` | Named stimulus operation attempted and whether verified | Event with target/action/result/failure | Only for separately approved manipulation mode |

Candidate Phase 6 event families include session lifecycle/capabilities, viewer/head pose, controller grip/target ray, input actions/axes, optional hand joints, safe-listed Treedis lifecycle/sweep events, study task/condition markers and quality/ingest diagnostics. The protocol chooses the minimum necessary subset. Head orientation may support a head-direction proxy; it is not eye tracking or direct evidence of attention.

## Candidate subjective and qualitative measures

Select validated questionnaires only when they match a research question. Record exact instrument/version, wording, scale anchors, scoring method, timing and license/usage conditions in the study protocol. Candidate constructs include perceived usability, workload, spatial presence, situation awareness, trust in evidence/provenance, decision confidence and simulator/visual discomfort. Do not combine scores from different versions without justification.

Qualitative sources may include think-aloud observations, post-task interviews, critical incidents, preference rationale and expert walkthrough notes. Create a versioned codebook, preserve contradictory cases, document coder training/blinding where used and report how disagreements were resolved.

## Candidate interaction events for an approved study mode

| Event | Minimal payload | Purpose |
|---|---|---|
| `task_started` / `task_completed` | task, condition, relative time, completion state | Task timing and outcome boundaries |
| `location_opened` | location ID, source surface | Discovery path without recording search text |
| `filter_changed` | filter ID and normalized option | Interaction-strategy analysis |
| `immersive_state_changed` | location/capture ID, lifecycle state, failure class | Provider exposure and recovery analysis |
| `bookmark_saved` / `bookmark_restored` | bookmark ID, supported pose fields, result | Spatial-evidence workflow |
| `candidate_status_changed` | candidate ID, normalized status | Decision progression |
| `shot_object_changed` | object type, normalized operation, scene revision | Editing strategy without free-text content |
| `variant_created` | scene/variant IDs and revision | Alternative exploration |
| `save_result` / `export_result` | operation type, result/failure class, schema version | Reliability and recovery |

Free-text content, screenshots and precise view poses require separate protocol justification. Event logging must be visible, opt-in and disabled outside an approved study session.

## How an implemented measure is computed

No measure definition changed in Phase 0.2. This records how the ones with an implementation are now calculated, so a result can be reproduced from the artifact.

| Measure | Implementation, as of tree `a8f4b4e4bd59` | What the number does not cover |
|---|---|---|
| `json_roundtrip_loss` | `normalizeBundle` in `src/data/transfer.js` sorts every record by identifier and every object key, giving a deep comparison across all ten transferred stores. A round trip is counted as lossless only when the normalised bundle after export and re-import is deeply equal to the one before. An unsupported schema version returns a classified rejection with the version named, which is counted as a refusal, never as a loss of zero | The export and import were driven in code against an in-memory database. A browser download, a file picker and real storage are not covered |
| `fov_error_deg` | `fieldOfView` in `src/spatial/optics.js`, compared against published gate and focal-length fixtures and against an independent geometric derivation | Lens distortion, focus breathing and real depth of field are outside the model |
| `plan_scale_error_pct` | Defined only. Floor-plan calibration does not exist yet | Everything |


### 2026-09-20 ? Explore 3D state interpretation (D057)

`tiles.state`: off (aerial), loading (libraries/visible geometry pending), active
(a renderer draw completed with visible tiles), fallback (missing configuration,
provider/library failure, no geometry by deadline, or graphics context loss).
Active is an implementation status, not independent proof of correct geometry,
coverage, calibration or visual quality. These states are UI state only; no
background participant logging was added.


### Phase 0 closeout evidence classification, 2026-09-20

Record three separate categories: automated PASS (named suite/build/runtime),
owner-reported manual PASS (described task/build, absent device details explicit),
and screenshot-supported manual PASS (only visible readings/assertions).
A phase acceptance exception changes the release decision, not the underlying
NOT TESTED result. No background telemetry or participant measures were enabled.


### Phase acceptance decision - 2026-09-20 (D061)

Phase 0 status is complete with explicit owner-approved exceptions. Do not count
an accepted exception as an executed test or a PASS observation. Retain separate
counts for automated results (326 PASS), owner-reported manual items (eight PASS),
and deferred live checks. The screenshot corroborates manual item 8/test 27;
it is not an additional independent participant trial.


### D062 framing and co-location semantics

Viewport bounds are the min/max longitude/latitude of the loaded pin inventory,
with screen-space padding and maximum fit zoom 18. Co-location key is longitude
and latitude rounded to six decimals, following the reference. Record count remains
the number of locations, not the number of rendered group markers. Grouping never
changes stored coordinates or merges catalog identity. No telemetry added.

### D063 control verification definitions

Recenter restores viewport-derived bounds containing all catalog positions;
selection-only redraw does not refit. Aerial visibility is a user preference
independent of source availability and reference-overlay visibility. The aerial
toggle is disabled while rendered Google geometry covers it. Catalog navigation
means previous/next in existing catalog order, not a planned production itinerary.
Search matches case-insensitive location name or ID. Geolocation is ephemeral
browser state following explicit button activation; no participant measure or
background telemetry is added. Live UI/provider checks are separately pending.

### Catalog 1.1.0 provenance and selection focus

Coordinate source classes distinguish owner-supplied map-pin corrections from the
four retained prior positions. Decimal precision describes the supplied values,
not survey accuracy. JSON uses [longitude, latitude], while workbook columns name
each axis. The snapshot has 18 records, 11 current/7 future, across seven areas.
Selection focus means moving the view to the stable record's stored coordinate,
with reference zoom cap 19 and 550 ms animation after layout settles. Recenter
means all-location fit. These are technical behavior definitions, not task-time or
usability findings; no participant or location telemetry is collected.

D064 coordinate-source update: after the additional Play N Trade, Givens House and
Former Truman corrections, 17 of 18 positions are owner-supplied (16 existing
corrections plus LaSEL). Only Carpe Diem retains its prior coordinate provenance.
Precision remains distinct from positional accuracy; no new measurement claim.
